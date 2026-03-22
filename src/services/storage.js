const { Storage } = require('@google-cloud/storage');
const config = require('../config');

let storage = null;
let bucket = null;

// In-memory fallback for development without GCS
const memoryStore = new Map();

function initStorage() {
  if (storage) return;
  try {
    const opts = {};
    if (config.gcs.projectId) opts.projectId = config.gcs.projectId;
    storage = new Storage(opts);
    bucket = storage.bucket(config.gcs.bucketName);
    console.log(`[GCS] Connected to bucket: ${config.gcs.bucketName}`);
  } catch (err) {
    console.warn('[GCS] Failed to initialize, using in-memory store:', err.message);
    storage = null;
  }
}

/**
 * Save analysis result to GCS (or memory fallback).
 */
async function saveResult(analysisId, data) {
  initStorage();
  const payload = JSON.stringify(data);

  if (bucket) {
    const file = bucket.file(`results/${analysisId}.json`);
    await file.save(payload, { contentType: 'application/json' });
    return `gs://${config.gcs.bucketName}/results/${analysisId}.json`;
  }

  // Memory fallback
  memoryStore.set(analysisId, payload);
  return `memory://${analysisId}`;
}

/**
 * Load analysis result from GCS (or memory fallback).
 */
async function loadResult(analysisId) {
  initStorage();

  if (bucket) {
    const file = bucket.file(`results/${analysisId}.json`);
    const [exists] = await file.exists();
    if (!exists) return null;
    const [contents] = await file.download();
    return JSON.parse(contents.toString());
  }

  // Memory fallback
  const data = memoryStore.get(analysisId);
  return data ? JSON.parse(data) : null;
}

/**
 * Save uploaded file to GCS (or memory fallback).
 */
async function saveUpload(analysisId, filename, buffer) {
  initStorage();

  if (bucket) {
    const file = bucket.file(`uploads/${analysisId}/${filename}`);
    await file.save(buffer);
    return `gs://${config.gcs.bucketName}/uploads/${analysisId}/${filename}`;
  }

  memoryStore.set(`upload:${analysisId}`, { filename, buffer });
  return `memory://upload/${analysisId}`;
}

/**
 * List all analysis IDs.
 */
async function listResults() {
  initStorage();

  if (bucket) {
    const [files] = await bucket.getFiles({ prefix: 'results/' });
    return files.map(f => f.name.replace('results/', '').replace('.json', ''));
  }

  return Array.from(memoryStore.keys()).filter(k => !k.startsWith('upload:'));
}

module.exports = { saveResult, loadResult, saveUpload, listResults };
