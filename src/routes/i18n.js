const express = require('express');
const crypto = require('crypto');
const { Storage } = require('@google-cloud/storage');
const config = require('../config');
const llm = require('../services/llm');

const router = express.Router();

// ─── GCS setup (mirrors storage.js pattern) ─────────────────────────────────

let storage = null;
let bucket = null;
const memoryStore = new Map();

function initStorage() {
  if (storage !== null) return;
  if (!config.gcs.projectId && !config.gcs.keyFile && !process.env.GOOGLE_APPLICATION_CREDENTIALS && !process.env.K_SERVICE) {
    console.log('[i18n] No GCS credentials configured, using in-memory store');
    storage = 'memory';
    return;
  }
  try {
    const opts = {};
    if (config.gcs.projectId) opts.projectId = config.gcs.projectId;
    if (config.gcs.keyFile) opts.keyFilename = config.gcs.keyFile;
    const gcs = new Storage(opts);
    bucket = gcs.bucket(config.gcs.bucketName);
    storage = gcs;
    console.log(`[i18n] Connected to GCS bucket: ${config.gcs.bucketName}`);
  } catch (err) {
    console.warn('[i18n] Failed to initialize GCS, using in-memory store:', err.message);
    storage = 'memory';
  }
}

// ─── Hash helper ─────────────────────────────────────────────────────────────

function generateHash(text) {
  return crypto.createHash('sha256')
    .update(text.trim()).digest('hex').substring(0, 16);
}

// ─── In-memory translation cache ─────────────────────────────────────────────

const translationCache = new Map(); // key: `${lang}:${hash}` => translatedText

// ─── Concurrency queue (max 3 concurrent LLM calls) ─────────────────────────

const MAX_CONCURRENT = 3;
let activeCalls = 0;
const queue = [];

function enqueue(fn) {
  return new Promise((resolve, reject) => {
    queue.push({ fn, resolve, reject });
    processQueue();
  });
}

function processQueue() {
  while (activeCalls < MAX_CONCURRENT && queue.length > 0) {
    const { fn, resolve, reject } = queue.shift();
    activeCalls++;
    fn()
      .then(resolve)
      .catch(reject)
      .finally(() => {
        activeCalls--;
        processQueue();
      });
  }
}

// ─── GCS helpers for i18n files ──────────────────────────────────────────────

async function loadTranslations(lang) {
  initStorage();
  const filePath = `i18n/${lang}.json`;

  if (bucket) {
    const file = bucket.file(filePath);
    const [exists] = await file.exists();
    if (!exists) return {};
    const [contents] = await file.download();
    return JSON.parse(contents.toString());
  }

  // Memory fallback
  const data = memoryStore.get(`i18n:${lang}`);
  return data ? JSON.parse(data) : {};
}

async function saveTranslations(lang, translations) {
  initStorage();
  const filePath = `i18n/${lang}.json`;
  const payload = JSON.stringify(translations);

  if (bucket) {
    await bucket.file(filePath).save(payload, { contentType: 'application/json' });
    return;
  }

  // Memory fallback
  memoryStore.set(`i18n:${lang}`, payload);
}

// ─── Supported languages ─────────────────────────────────────────────────────

const SUPPORTED_LANGUAGES = [
  { code: 'zh', name: '中文 (Chinese)', rtl: false },
  { code: 'es', name: 'Español (Spanish)', rtl: false },
  { code: 'fr', name: 'Français (French)', rtl: false },
  { code: 'de', name: 'Deutsch (German)', rtl: false },
  { code: 'ja', name: '日本語 (Japanese)', rtl: false },
  { code: 'ko', name: '한국어 (Korean)', rtl: false },
  { code: 'ar', name: 'العربية (Arabic)', rtl: true },
  { code: 'pt', name: 'Português (Portuguese)', rtl: false },
  { code: 'ru', name: 'Русский (Russian)', rtl: false },
  { code: 'hi', name: 'हिन्दी (Hindi)', rtl: false },
  { code: 'vi', name: 'Tiếng Việt (Vietnamese)', rtl: false },
  { code: 'th', name: 'ไทย (Thai)', rtl: false },
  { code: 'he', name: 'עברית (Hebrew)', rtl: true },
  { code: 'fa', name: 'فارسی (Persian)', rtl: true },
];

const LANGUAGE_NAMES = {};
SUPPORTED_LANGUAGES.forEach(l => { LANGUAGE_NAMES[l.code] = l.name; });

// ─── Routes ──────────────────────────────────────────────────────────────────

/**
 * GET /api/i18n/load?lang=zh — Load all translations for a language.
 */
router.get('/load', async (req, res) => {
  try {
    const { lang } = req.query;
    if (!lang) {
      return res.status(400).json({ error: 'Missing "lang" query parameter.' });
    }
    const translations = await loadTranslations(lang);
    res.json({ translations });
  } catch (err) {
    console.error('[GET /api/i18n/load]', err);
    res.status(500).json({ error: 'Failed to load translations.' });
  }
});

/**
 * POST /api/i18n/translate — Translate a single text via LLM.
 */
router.post('/translate', async (req, res) => {
  try {
    const { text, lang, hash } = req.body;
    if (!text || !lang) {
      return res.status(400).json({ error: 'Missing "text" or "lang" in request body.' });
    }

    const textHash = hash || generateHash(text);
    const cacheKey = `${lang}:${textHash}`;

    // Check in-memory cache first
    if (translationCache.has(cacheKey)) {
      return res.json({ hash: textHash, translation: translationCache.get(cacheKey) });
    }

    const languageName = LANGUAGE_NAMES[lang] || lang;

    // Use concurrency queue to limit parallel LLM calls
    const translation = await enqueue(async () => {
      // Double-check cache after waiting in queue
      if (translationCache.has(cacheKey)) {
        return translationCache.get(cacheKey);
      }

      const prompt = `Translate the following text to ${languageName}. Return ONLY the translated text, no explanations.\n\n${text}`;
      const result = await llm.complete(prompt, { maxTokens: 1024 });
      return result.trim();
    });

    // Cache the result
    translationCache.set(cacheKey, translation);

    res.json({ hash: textHash, translation });
  } catch (err) {
    console.error('[POST /api/i18n/translate]', err);
    res.status(500).json({ error: 'Failed to translate text.' });
  }
});

/**
 * POST /api/i18n/batch-save — Merge and save translation entries to GCS.
 */
router.post('/batch-save', async (req, res) => {
  try {
    const { lang, entries } = req.body;
    if (!lang || !entries) {
      return res.status(400).json({ error: 'Missing "lang" or "entries" in request body.' });
    }

    // Load existing translations, merge, and save
    const existing = await loadTranslations(lang);
    const merged = { ...existing, ...entries };
    await saveTranslations(lang, merged);

    const count = Object.keys(entries).length;
    res.json({ saved: count });
  } catch (err) {
    console.error('[POST /api/i18n/batch-save]', err);
    res.status(500).json({ error: 'Failed to save translations.' });
  }
});

/**
 * GET /api/i18n/languages — Return supported languages.
 */
router.get('/languages', (req, res) => {
  res.json({ languages: SUPPORTED_LANGUAGES });
});

module.exports = router;
