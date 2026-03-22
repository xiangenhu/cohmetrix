const express = require('express');
const storage = require('../services/storage');

const router = express.Router();

/**
 * GET /api/results — List all results with summary metadata.
 * Optionally ?full=true to include score summaries from each result file.
 */
router.get('/', async (req, res) => {
  try {
    const entries = await storage.listResults();
    const includeSummary = req.query.full === 'true';

    if (!includeSummary) {
      return res.json({ results: entries });
    }

    // Load each result to extract summary info
    const results = await Promise.all(entries.map(async (entry) => {
      try {
        const data = await storage.loadResult(entry.id);
        if (!data) return { ...entry, summary: null };
        return {
          ...entry,
          summary: {
            overallScore: data.overallScore,
            wordCount: data.document?.wordCount,
            sentenceCount: data.document?.sentenceCount,
            analysisTime: data.analysisTime,
            timestamp: data.timestamp,
            layerCount: data.layers?.length || 0,
            promptText: data.document?.promptText ? data.document.promptText.substring(0, 80) : null,
          },
        };
      } catch {
        return { ...entry, summary: null };
      }
    }));

    res.json({ results });
  } catch (err) {
    console.error('[GET /api/results]', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/results/:id — Fetch full analysis result.
 */
router.get('/:id', async (req, res) => {
  try {
    const result = await storage.loadResult(req.params.id);
    if (!result) {
      return res.status(404).json({ error: 'Analysis not found' });
    }
    res.json(result);
  } catch (err) {
    console.error('[GET /api/results/:id]', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * DELETE /api/results/:id — Delete an analysis result.
 */
router.delete('/:id', async (req, res) => {
  try {
    const deleted = await storage.deleteResult(req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: 'Analysis not found' });
    }
    res.json({ message: 'Result deleted', id: req.params.id });
  } catch (err) {
    console.error('[DELETE /api/results/:id]', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
