const express = require('express');
const multer = require('multer');
const path = require('path');
const storage = require('../services/storage');
const { extractText } = require('../utils/fileParser');
const config = require('../config');

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: config.analysis.maxFileSizeMB * 1024 * 1024 },
});

const CONTENT_TYPES = {
  '.txt': 'text/plain',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.pdf': 'application/pdf',
};

/**
 * GET /api/documents — List all documents in the library.
 */
router.get('/', async (req, res) => {
  try {
    const folder = req.query.folder || '';
    const docs = await storage.listDocuments(folder);

    // Add human-readable size and file extension
    const enriched = docs.map(d => ({
      ...d,
      ext: path.extname(d.name).toLowerCase(),
      sizeLabel: formatSize(d.size),
    }));

    res.json({ documents: enriched });
  } catch (err) {
    console.error('[GET /api/documents]', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/documents — Upload a document to the library.
 */
router.post('/', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file provided.' });
    }

    const ext = path.extname(req.file.originalname).toLowerCase();
    if (!['.txt', '.docx', '.pdf'].includes(ext)) {
      return res.status(400).json({ error: `Unsupported format: ${ext}. Use .txt, .docx, or .pdf` });
    }

    // Use subfolder if provided
    const folder = req.body.folder ? req.body.folder.replace(/^\/|\/$/g, '') + '/' : '';
    const filename = folder + req.file.originalname;
    const contentType = CONTENT_TYPES[ext] || 'application/octet-stream';

    const result = await storage.saveDocument(filename, req.file.buffer, contentType);

    res.json({
      message: 'Document saved',
      name: filename,
      path: result.path,
      uri: result.uri,
      size: req.file.size,
      sizeLabel: formatSize(req.file.size),
    });
  } catch (err) {
    console.error('[POST /api/documents]', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/documents/content/:path — Download or extract text from a document.
 */
router.get('/content/*', async (req, res) => {
  try {
    const filePath = 'documents/' + req.params[0];
    const doc = await storage.loadDocument(filePath);

    if (!doc) {
      return res.status(404).json({ error: 'Document not found' });
    }

    // If ?extract=true, return extracted text instead of raw file
    if (req.query.extract === 'true') {
      const text = await extractText(doc.buffer, doc.name);
      return res.json({ name: doc.name, text, size: doc.buffer.length });
    }

    // Otherwise send raw file
    res.set('Content-Type', doc.contentType);
    res.set('Content-Disposition', `inline; filename="${path.basename(doc.name)}"`);
    res.send(doc.buffer);
  } catch (err) {
    console.error('[GET /api/documents/content]', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * DELETE /api/documents/:path — Delete a document.
 */
router.delete('/*', async (req, res) => {
  try {
    const filePath = 'documents/' + req.params[0];
    const deleted = await storage.deleteDocument(filePath);
    if (!deleted) {
      return res.status(404).json({ error: 'Document not found' });
    }
    res.json({ message: 'Document deleted', path: filePath });
  } catch (err) {
    console.error('[DELETE /api/documents]', err);
    res.status(500).json({ error: err.message });
  }
});

function formatSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

module.exports = router;
