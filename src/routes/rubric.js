const express = require('express');
const multer = require('multer');
const path = require('path');
const storage = require('../services/storage');
const { evaluateWithRubric } = require('../services/rubric');
const { extractText } = require('../utils/fileParser');
const config = require('../config');

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB for rubrics
});

// ─── Rubric CRUD (stored in GCS under rubrics/) ──────────────────────────────

const RUBRIC_PREFIX = 'rubrics/';

/**
 * GET /api/rubrics — List saved rubrics.
 */
router.get('/', async (req, res) => {
  try {
    const docs = await storage.listDocuments('');
    // Filter to rubric prefix — reuse document storage with a prefix convention
    // Actually, let's use a dedicated listing
    const rubrics = await listRubrics();
    res.json({ rubrics });
  } catch (err) {
    console.error('[GET /api/rubrics]', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/rubrics — Save a rubric (text or file upload).
 */
router.post('/', upload.single('file'), async (req, res) => {
  try {
    let text = req.body.text || '';
    let name = req.body.name || 'Untitled Rubric';

    // Extract text from file if uploaded
    if (req.file) {
      text = await extractText(req.file.buffer, req.file.originalname);
      if (!req.body.name) {
        name = path.basename(req.file.originalname, path.extname(req.file.originalname));
      }
    }

    if (!text.trim()) {
      return res.status(400).json({ error: 'No rubric text provided.' });
    }

    const rubricId = slugify(name) + '_' + Date.now();
    const payload = JSON.stringify({ id: rubricId, name, text, createdAt: new Date().toISOString() });

    await storage.saveDocument(`${RUBRIC_PREFIX}${rubricId}.json`, Buffer.from(payload), 'application/json');

    res.json({ id: rubricId, name, message: 'Rubric saved' });
  } catch (err) {
    console.error('[POST /api/rubrics]', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/rubrics/:id — Get a specific rubric.
 */
router.get('/:id', async (req, res) => {
  try {
    const doc = await storage.loadDocument(`documents/${RUBRIC_PREFIX}${req.params.id}.json`);
    if (!doc) return res.status(404).json({ error: 'Rubric not found' });
    const rubric = JSON.parse(doc.buffer.toString());
    res.json(rubric);
  } catch (err) {
    console.error('[GET /api/rubrics/:id]', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * DELETE /api/rubrics/:id — Delete a rubric.
 */
router.delete('/:id', async (req, res) => {
  try {
    await storage.deleteDocument(`documents/${RUBRIC_PREFIX}${req.params.id}.json`);
    res.json({ message: 'Rubric deleted' });
  } catch (err) {
    console.error('[DELETE /api/rubrics/:id]', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/rubrics/evaluate — Evaluate an analysis result against a rubric.
 */
router.post('/evaluate', async (req, res) => {
  try {
    const { analysisId, rubricId, rubricText } = req.body;

    if (!analysisId) {
      return res.status(400).json({ error: 'analysisId is required.' });
    }

    // Load analysis result
    const result = await storage.loadResult(analysisId);
    if (!result) {
      return res.status(404).json({ error: 'Analysis result not found.' });
    }

    // Get rubric text
    let rubric = rubricText || '';
    if (rubricId && !rubric) {
      const doc = await storage.loadDocument(`documents/${RUBRIC_PREFIX}${rubricId}.json`);
      if (!doc) return res.status(404).json({ error: 'Rubric not found.' });
      const parsed = JSON.parse(doc.buffer.toString());
      rubric = parsed.text;
    }

    if (!rubric.trim()) {
      return res.status(400).json({ error: 'No rubric text provided.' });
    }

    // Run evaluation
    const evaluation = await evaluateWithRubric(
      rubric,
      result.layers,
      result.document,
      {
        overallScore: result.overallScore,
        compositeScores: result.compositeScores,
        targetAudience: result.targetAudience || config.targetAudience,
      }
    );

    // Save evaluation alongside the result
    if (evaluation.success) {
      result.rubricEvaluation = evaluation;
      await storage.saveResult(analysisId, result);
    }

    const llm = require('../services/llm');
    evaluation.tokenUsage = llm.getSessionTracker().getSummary();
    res.json(evaluation);
  } catch (err) {
    console.error('[POST /api/rubrics/evaluate]', err);
    res.status(500).json({ error: err.message });
  }
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function listRubrics() {
  const docs = await storage.listDocuments(RUBRIC_PREFIX);
  return Promise.all(docs.map(async (d) => {
    try {
      const doc = await storage.loadDocument(d.path);
      const parsed = JSON.parse(doc.buffer.toString());
      return { id: parsed.id, name: parsed.name, createdAt: parsed.createdAt, size: d.size };
    } catch {
      return { id: d.name.replace('.json', ''), name: d.name, createdAt: d.updated, size: d.size };
    }
  }));
}

function slugify(str) {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').substring(0, 40);
}

module.exports = router;
