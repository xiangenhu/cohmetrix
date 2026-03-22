const express = require('express');
const storage = require('../services/storage');

const router = express.Router();

/**
 * GET /api/results/:id — Fetch analysis results
 */
router.get('/:id', async (req, res) => {
  try {
    const result = await storage.loadResult(req.params.id);
    if (!result) {
      return res.status(404).json({ error: 'Analysis not found' });
    }
    res.json(result);
  } catch (err) {
    console.error('[GET /api/results]', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/results — List all analysis IDs
 */
router.get('/', async (req, res) => {
  try {
    const ids = await storage.listResults();
    res.json({ analyses: ids });
  } catch (err) {
    console.error('[GET /api/results]', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
