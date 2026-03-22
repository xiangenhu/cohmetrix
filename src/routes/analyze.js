const express = require('express');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const { extractText } = require('../utils/fileParser');
const { runAnalysis } = require('../services/pipeline');
const storage = require('../services/storage');
const config = require('../config');

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: config.analysis.maxFileSizeMB * 1024 * 1024 },
});

// In-memory SSE connections and progress events
const sseClients = new Map();
const analysisProgress = new Map();

/**
 * POST /api/analyze — Start analysis
 */
router.post('/', upload.single('file'), async (req, res) => {
  try {
    const analysisId = uuidv4();
    let text = req.body.text || '';
    const promptText = req.body.promptText || '';
    const learnerId = req.body.learnerId || '';
    let enabledLayers;
    try {
      enabledLayers = JSON.parse(req.body.enabledLayers || '[]');
    } catch {
      enabledLayers = ['L0', 'L1', 'L2', 'L3', 'L4', 'L5', 'L6', 'L7', 'L8', 'L9'];
    }

    // Extract text from file if uploaded
    if (req.file) {
      text = await extractText(req.file.buffer, req.file.originalname);
      await storage.saveUpload(analysisId, req.file.originalname, req.file.buffer);
    }

    if (!text.trim()) {
      return res.status(400).json({ error: 'No text provided. Upload a file or paste text.' });
    }

    // Check word count
    const wordCount = text.split(/\s+/).filter(w => w.length > 0).length;
    if (wordCount > config.analysis.maxEssayWords) {
      return res.status(400).json({ error: `Text too long (${wordCount} words). Maximum: ${config.analysis.maxEssayWords} words.` });
    }

    // Initialize progress tracking
    analysisProgress.set(analysisId, []);

    // Return analysis ID immediately
    res.json({ analysisId });

    // Run analysis in background
    runAnalysis(text, {
      promptText,
      learnerId,
      enabledLayers,
      onProgress: (event) => {
        const events = analysisProgress.get(analysisId) || [];
        events.push(event);
        analysisProgress.set(analysisId, events);

        // Push to SSE clients
        const clients = sseClients.get(analysisId) || [];
        clients.forEach(client => {
          client.write(`data: ${JSON.stringify(event)}\n\n`);
        });
      },
    }).then(async (result) => {
      result.id = analysisId;
      await storage.saveResult(analysisId, result);

      // Notify SSE clients of completion
      const clients = sseClients.get(analysisId) || [];
      clients.forEach(client => {
        client.write(`data: ${JSON.stringify({ type: 'complete', message: `All layers processed · ${result.analysisTime.toFixed(1)}s total` })}\n\n`);
        client.end();
      });
      sseClients.delete(analysisId);

      // Clean up progress after 5 minutes
      setTimeout(() => analysisProgress.delete(analysisId), 300000);
    }).catch((err) => {
      console.error('[Analysis Error]', err);
      const clients = sseClients.get(analysisId) || [];
      clients.forEach(client => {
        client.write(`data: ${JSON.stringify({ type: 'error', message: err.message })}\n\n`);
        client.end();
      });
      sseClients.delete(analysisId);
    });

  } catch (err) {
    console.error('[POST /api/analyze]', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/analyze/:id/stream — SSE progress stream
 */
router.get('/:id/stream', (req, res) => {
  const analysisId = req.params.id;

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',
  });

  // Send any buffered events
  const buffered = analysisProgress.get(analysisId) || [];
  buffered.forEach(event => {
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  });

  // Register for future events
  const clients = sseClients.get(analysisId) || [];
  clients.push(res);
  sseClients.set(analysisId, clients);

  // Clean up on disconnect
  req.on('close', () => {
    const remaining = (sseClients.get(analysisId) || []).filter(c => c !== res);
    if (remaining.length) {
      sseClients.set(analysisId, remaining);
    } else {
      sseClients.delete(analysisId);
    }
  });
});

module.exports = router;
