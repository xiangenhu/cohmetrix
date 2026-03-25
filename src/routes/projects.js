const express = require('express');
const multer = require('multer');
const path = require('path');
const { v4: uuid } = require('uuid');
const storage = require('../services/storage');
const { extractText, convertDocxToHtml } = require('../utils/fileParser');
const { runAnalysis } = require('../services/pipeline');
const llm = require('../services/llm');
const config = require('../config');

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: config.analysis.maxFileSizeMB * 1024 * 1024 },
});

function uid(user) { return storage.getUserId(user); }

function formatSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

// ─── Projects CRUD ──────────────────────────────────────────────────────────

router.get('/', async (req, res) => {
  try {
    const projects = await storage.listProjects(uid(req.user));
    // Enrich with file/result counts
    const enriched = await Promise.all(projects.map(async (p) => {
      const [files, results] = await Promise.all([
        storage.listProjectFiles(uid(req.user), p.id),
        storage.listProjectResults(uid(req.user), p.id),
      ]);
      return { ...p, fileCount: files.length, resultCount: results.length };
    }));
    res.json({ projects: enriched });
  } catch (err) {
    console.error('[GET /api/projects]', err);
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { name, description } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: 'Project name is required' });
    const project = {
      id: uuid(),
      name: name.trim(),
      description: (description || '').trim(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      config: {
        enabledLayers: ['L0','L1','L2','L3','L4','L5','L6','L7','L8','L9','L10'],
        genre: '',
        promptText: '',
        learnerId: '',
      },
    };
    await storage.saveProject(uid(req.user), project.id, project);
    res.json({ project });
  } catch (err) {
    console.error('[POST /api/projects]', err);
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const project = await storage.getProject(uid(req.user), req.params.id);
    if (!project) return res.status(404).json({ error: 'Project not found' });
    const userId = uid(req.user);
    const [rawFiles, rawResults] = await Promise.all([
      storage.listProjectFiles(userId, req.params.id),
      storage.listProjectResults(userId, req.params.id),
    ]);
    const [files, results] = await Promise.all([
      Promise.all(rawFiles.map(async (f) => {
        const meta = await storage.loadProjectFileMeta(userId, req.params.id, f.name);
        return { ...f, sizeLabel: formatSize(f.size), ext: path.extname(f.name).toLowerCase(), meta: meta || null };
      })),
      Promise.all(rawResults.map(async (r) => {
        try {
          const data = await storage.loadProjectResult(userId, req.params.id, r.id);
          if (data) {
            r.sourceFile = data.sourceFile || null;
            r.overallScore = data.overallScore != null ? data.overallScore : null;
            r.timestamp = data.timestamp || r.updated;
            r.wordCount = data.document?.wordCount || null;
            r.language = data.language || null;
          }
        } catch {}
        return r;
      })),
    ]);
    res.json({ project, files, results });
  } catch (err) {
    console.error('[GET /api/projects/:id]', err);
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const project = await storage.getProject(uid(req.user), req.params.id);
    if (!project) return res.status(404).json({ error: 'Project not found' });
    if (req.body.name) project.name = req.body.name.trim();
    if (req.body.description !== undefined) project.description = req.body.description.trim();
    if (req.body.config) project.config = { ...project.config, ...req.body.config };
    project.updatedAt = new Date().toISOString();
    await storage.saveProject(uid(req.user), project.id, project);
    res.json({ project });
  } catch (err) {
    console.error('[PUT /api/projects/:id]', err);
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const deleted = await storage.deleteProject(uid(req.user), req.params.id);
    if (!deleted) return res.status(404).json({ error: 'Project not found' });
    res.json({ message: 'Project deleted' });
  } catch (err) {
    console.error('[DELETE /api/projects/:id]', err);
    res.status(500).json({ error: err.message });
  }
});

// ─── Project Files ──────────────────────────────────────────────────────────

router.get('/:id/files', async (req, res) => {
  try {
    const files = await storage.listProjectFiles(uid(req.user), req.params.id);
    const enriched = await Promise.all(files.map(async (f) => {
      const meta = await storage.loadProjectFileMeta(uid(req.user), req.params.id, f.name);
      return { ...f, sizeLabel: formatSize(f.size), ext: path.extname(f.name).toLowerCase(), meta: meta || null };
    }));
    res.json({ files: enriched });
  } catch (err) {
    console.error('[GET /api/projects/:id/files]', err);
    res.status(500).json({ error: err.message });
  }
});

router.post('/:id/files', upload.array('files', 20), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) return res.status(400).json({ error: 'No files provided' });
    const saved = [];
    for (const file of req.files) {
      const ext = path.extname(file.originalname).toLowerCase();
      if (!['.txt', '.docx', '.pdf'].includes(ext)) continue;
      const ct = { '.txt': 'text/plain', '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', '.pdf': 'application/pdf' }[ext];
      await storage.saveProjectFile(uid(req.user), req.params.id, file.originalname, file.buffer, ct);
      saved.push({ name: file.originalname, size: file.size, sizeLabel: formatSize(file.size) });
    }
    // Update project timestamp
    const project = await storage.getProject(uid(req.user), req.params.id);
    if (project) { project.updatedAt = new Date().toISOString(); await storage.saveProject(uid(req.user), req.params.id, project); }
    res.json({ saved, count: saved.length });
  } catch (err) {
    console.error('[POST /api/projects/:id/files]', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/projects/:id/files/:filename/meta — Get file metadata.
 */
router.get('/:id/files/:filename/meta', async (req, res) => {
  try {
    const meta = await storage.loadProjectFileMeta(uid(req.user), req.params.id, req.params.filename);
    res.json({ meta: meta || { genre: '', readingLevel: '', promptText: '', author: '', notes: '' } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * PUT /api/projects/:id/files/:filename/meta — Save file metadata.
 */
router.put('/:id/files/:filename/meta', async (req, res) => {
  try {
    const meta = {
      // Document context
      genre: req.body.genre || '',
      readingLevel: req.body.readingLevel || '',
      language: req.body.language || 'en',
      // Assignment context
      promptText: req.body.promptText || '',
      assignmentType: req.body.assignmentType || '',
      expectedWordCount: req.body.expectedWordCount || '',
      rubricNotes: req.body.rubricNotes || '',
      // Author context
      author: req.body.author || '',
      authorLevel: req.body.authorLevel || '',
      course: req.body.course || '',
      // Analysis hints
      focusAreas: req.body.focusAreas || '',
      knownIssues: req.body.knownIssues || '',
      notes: req.body.notes || '',
      // Tracking
      updatedAt: new Date().toISOString(),
    };
    await storage.saveProjectFileMeta(uid(req.user), req.params.id, req.params.filename, meta);
    res.json({ meta });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/projects/:id/files/:filename/auto-meta — AI-detect metadata from file content.
 */
router.post('/:id/files/:filename/auto-meta', async (req, res) => {
  try {
    const userId = uid(req.user);
    const doc = await storage.loadProjectFile(userId, req.params.id, req.params.filename);
    if (!doc) return res.status(404).json({ error: 'File not found' });

    const text = await extractText(doc.buffer, doc.name);
    const wordCount = text.split(/\s+/).filter(w => w.length > 0).length;
    const preview = text.substring(0, 3000);

    const prompt = `You are an expert writing analyst. Analyze the following document excerpt and infer metadata about it.

DOCUMENT (first ~3000 chars):
"""
${preview}
"""

Word count: ${wordCount}

Return a JSON object with these fields (use empty string "" if you cannot determine a field):
{
  "language": "ISO 639-1 code of the document's language, e.g. en, es, fr, de, zh, ja, ko, ar, etc.",
  "genre": "one of: academic-essay, research-paper, argumentative-essay, expository-essay, narrative-essay, personal-narrative, reflection, lab-report, book-review, literary-analysis, opinion-editorial, creative-fiction, creative-nonfiction, business-report, technical-writing, other",
  "readingLevel": "one of: elementary, middle-school, high-school, college, graduate",
  "assignmentType": "one of: argumentative, expository, narrative, analytical, compare-contrast, research-paper, lab-report, reflection, creative, summary, other",
  "promptText": "your best guess at what the writing assignment/prompt was, based on the content",
  "expectedWordCount": "estimated expected range like 800-1000",
  "authorLevel": "one of: esl-beginner, esl-intermediate, esl-advanced, native-k5, native-middle, native-high, college-freshman, college-upper, graduate, professional",
  "focusAreas": "comma-separated areas that deserve attention based on a quick read",
  "knownIssues": "any obvious issues spotted in the excerpt"
}`;

    const language = llm.getRequestLanguage(req);
    const result = await llm.completeJSON(prompt, { language });
    res.json({
      suggested: result,
      wordCount,
      tokenUsage: llm.getSessionTracker().getSummary(),
    });
  } catch (err) {
    console.error('[POST /auto-meta]', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/projects/:id/files/:filename/content — View file content.
 *   ?extract=true  → extracted plain text as JSON { name, text, wordCount }
 *   ?format=html   → DOCX rendered as HTML, TXT as pre-formatted HTML
 *   (no params)    → raw file (PDF renders natively in browser iframe)
 */
router.get('/:id/files/:filename/content', async (req, res) => {
  try {
    const doc = await storage.loadProjectFile(uid(req.user), req.params.id, req.params.filename);
    if (!doc) return res.status(404).json({ error: 'File not found' });
    const ext = path.extname(doc.name).toLowerCase();

    // Extracted plain text as JSON
    if (req.query.extract === 'true') {
      const text = await extractText(doc.buffer, doc.name);
      const wordCount = text.split(/\s+/).filter(w => w.length > 0).length;
      return res.json({ name: doc.name, text, wordCount });
    }

    // HTML preview (for DOCX conversion or TXT wrapping)
    if (req.query.format === 'html') {
      let html;
      if (ext === '.docx') {
        const body = await convertDocxToHtml(doc.buffer);
        html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
          body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:700px;margin:24px auto;padding:0 16px;color:#1a202c;font-size:14px;line-height:1.7}
          h1,h2,h3{margin:1.2em 0 0.4em}table{border-collapse:collapse;width:100%}td,th{border:1px solid #ccc;padding:6px 10px}
          img{max-width:100%}blockquote{border-left:3px solid #ccc;margin:1em 0;padding:0.5em 1em;color:#555}
        </style></head><body>${body}</body></html>`;
      } else if (ext === '.txt') {
        const text = doc.buffer.toString('utf-8');
        html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
          body{font-family:monospace;max-width:700px;margin:24px auto;padding:0 16px;color:#1a202c;font-size:13px;line-height:1.6;white-space:pre-wrap}
        </style></head><body>${text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}</body></html>`;
      } else {
        return res.status(400).json({ error: 'HTML preview not supported for this file type. Use raw view for PDF.' });
      }
      res.set('Content-Type', 'text/html; charset=utf-8');
      return res.send(html);
    }

    // Raw file — browser renders PDF natively in iframe
    res.set('Content-Type', doc.contentType || 'application/octet-stream');
    const basename = path.basename(doc.name);
    res.set('Content-Disposition', `inline; filename="${encodeURIComponent(basename)}"; filename*=UTF-8''${encodeURIComponent(basename)}`);
    res.send(doc.buffer);
  } catch (err) {
    console.error('[GET /api/projects/:id/files/:filename/content]', err);
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id/files/:filename', async (req, res) => {
  try {
    const deleted = await storage.deleteProjectFile(uid(req.user), req.params.id, req.params.filename);
    if (!deleted) return res.status(404).json({ error: 'File not found' });
    res.json({ message: 'File deleted' });
  } catch (err) {
    console.error('[DELETE /api/projects/:id/files/:filename]', err);
    res.status(500).json({ error: err.message });
  }
});

// ─── Project Summary ───────────────────────────────────────────────────────

/**
 * GET /api/projects/:id/summary — Aggregate metadata summary across all files and results.
 */
router.get('/:id/summary', async (req, res) => {
  try {
    const userId = uid(req.user);
    const project = await storage.getProject(userId, req.params.id);
    if (!project) return res.status(404).json({ error: 'Project not found' });

    const [rawFiles, results] = await Promise.all([
      storage.listProjectFiles(userId, req.params.id),
      storage.listProjectResults(userId, req.params.id),
    ]);

    // Load metadata and match results for each file
    const files = [];
    let totalWords = 0;
    let totalMetaFilled = 0;
    let totalMetaFields = 0;
    const genreBreakdown = {};
    const scores = [];

    for (const f of rawFiles) {
      const meta = await storage.loadProjectFileMeta(userId, req.params.id, f.name) || {};
      const metaFields = ['genre', 'readingLevel', 'language', 'promptText', 'assignmentType',
        'expectedWordCount', 'rubricNotes', 'author', 'authorLevel', 'course', 'focusAreas', 'knownIssues'];
      const filled = metaFields.filter(k => meta[k] && meta[k].trim()).length;

      // Find matching result by sourceFile
      let score = null;
      let wordCount = 0;
      for (const r of results) {
        // Load result to check sourceFile if not already known
        if (!r._loaded) {
          try {
            const full = await storage.loadProjectResult(userId, req.params.id, r.id);
            r.sourceFile = full?.sourceFile;
            r.overallScore = full?.overallScore;
            r.wordCount = full?.document?.wordCount;
            r._loaded = true;
          } catch { r._loaded = true; }
        }
        if (r.sourceFile === f.name) {
          score = r.overallScore;
          wordCount = r.wordCount || 0;
          break;
        }
      }

      if (score != null) scores.push(score);
      totalWords += wordCount;
      totalMetaFilled += filled;
      totalMetaFields += metaFields.length;

      if (meta.genre) genreBreakdown[meta.genre] = (genreBreakdown[meta.genre] || 0) + 1;

      files.push({
        name: f.name,
        size: f.size,
        sizeLabel: formatSize(f.size),
        wordCount,
        language: meta.language || 'en',
        genre: meta.genre || '',
        readingLevel: meta.readingLevel || '',
        authorLevel: meta.authorLevel || '',
        metaFilled: filled,
        metaTotal: metaFields.length,
        score,
      });
    }

    const avgScore = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length * 10) / 10 : null;
    const metaCompleteness = totalMetaFields > 0 ? Math.round(totalMetaFilled / totalMetaFields * 100) : 0;

    res.json({
      projectName: project.name,
      fileCount: rawFiles.length,
      resultCount: results.length,
      files,
      aggregates: {
        totalWords,
        avgScore,
        minScore: scores.length > 0 ? Math.min(...scores) : null,
        maxScore: scores.length > 0 ? Math.max(...scores) : null,
        genreBreakdown,
        metaCompleteness: metaCompleteness + '%',
      },
    });
  } catch (err) {
    console.error('[GET /api/projects/:id/summary]', err);
    res.status(500).json({ error: err.message });
  }
});

// ─── Project Results ────────────────────────────────────────────────────────

router.get('/:id/results', async (req, res) => {
  try {
    const userId = uid(req.user);
    const raw = await storage.listProjectResults(userId, req.params.id);
    // Enrich each result with sourceFile, overallScore, timestamp, wordCount
    const results = await Promise.all(raw.map(async (r) => {
      try {
        const data = await storage.loadProjectResult(userId, req.params.id, r.id);
        if (data) {
          r.sourceFile = data.sourceFile || null;
          r.overallScore = data.overallScore != null ? data.overallScore : null;
          r.timestamp = data.timestamp || r.updated;
          r.wordCount = data.document?.wordCount || null;
          r.language = data.language || null;
        }
      } catch {}
      return r;
    }));
    res.json({ results });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id/results/:resultId', async (req, res) => {
  try {
    const result = await storage.loadProjectResult(uid(req.user), req.params.id, req.params.resultId);
    if (!result) return res.status(404).json({ error: 'Result not found' });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id/results/:resultId', async (req, res) => {
  try {
    const deleted = await storage.deleteProjectResult(uid(req.user), req.params.id, req.params.resultId);
    if (!deleted) return res.status(404).json({ error: 'Result not found' });
    res.json({ message: 'Result deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Project Usage / Cost Tracking ──────────────────────────────────────────

router.get('/:id/usage', async (req, res) => {
  try {
    const usage = await storage.loadProjectUsage(uid(req.user), req.params.id);
    res.json(usage);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Cost Estimation ────────────────────────────────────────────────────────

router.post('/:id/estimate', async (req, res) => {
  try {
    const project = await storage.getProject(uid(req.user), req.params.id);
    if (!project) return res.status(404).json({ error: 'Project not found' });

    const allFiles = await storage.listProjectFiles(uid(req.user), req.params.id);
    const selectedNames = req.body.fileNames || allFiles.map(f => f.name);
    const pricing = llm.getPricing();
    const llmLayers = (project.config.enabledLayers || []).filter(l => l !== 'L0' && l !== 'L5');
    const llmCallsPerFile = llmLayers.length + 2; // layers + evidence enrichment + feedback

    const files = [];
    let totalWords = 0;
    for (const name of selectedNames) {
      const doc = await storage.loadProjectFile(uid(req.user), req.params.id, name);
      if (!doc) continue;
      try {
        const text = await extractText(doc.buffer, doc.name);
        const wordCount = text.split(/\s+/).filter(w => w.length > 0).length;
        const estTokens = Math.round(wordCount * 1.3 * llmCallsPerFile);
        files.push({ name, wordCount, estimatedTokens: estTokens });
        totalWords += wordCount;
      } catch { files.push({ name, wordCount: 0, estimatedTokens: 0, error: 'Could not read' }); }
    }

    const totalTokens = files.reduce((s, f) => s + f.estimatedTokens, 0);
    const estInputCost = (totalTokens * 0.7 / 1_000_000) * pricing.promptPer1M;
    const estOutputCost = (totalTokens * 0.3 / 1_000_000) * pricing.completionPer1M;
    const estimatedCost = estInputCost + estOutputCost;

    res.json({
      files,
      totalFiles: files.length,
      totalWords,
      totalEstimatedTokens: totalTokens,
      estimatedCost: Math.round(estimatedCost * 1000) / 1000,
      pricing,
      enabledLayers: project.config.enabledLayers,
      llmCallsPerFile,
    });
  } catch (err) {
    console.error('[POST /api/projects/:id/estimate]', err);
    res.status(500).json({ error: err.message });
  }
});

// ─── Batch Analysis (SSE) ───────────────────────────────────────────────────

router.post('/:id/analyze', async (req, res) => {
  try {
    const userId = uid(req.user);

    // Check user quota before starting batch analysis
    const quota = await storage.loadUserQuota(userId);
    const remaining = quota.quota - quota.spent;
    if (remaining <= 0) {
      return res.status(402).json({
        error: 'Insufficient balance. Please add funds to continue.',
        quota_exceeded: true,
        quota: quota.quota,
        spent: +quota.spent.toFixed(6),
        remaining: 0,
      });
    }

    const project = await storage.getProject(userId, req.params.id);
    if (!project) return res.status(404).json({ error: 'Project not found' });

    const allFiles = await storage.listProjectFiles(userId, req.params.id);
    const selectedNames = req.body.fileNames || allFiles.map(f => f.name);
    const saveToProject = req.body.saveToProject !== false; // default true
    const cfg = project.config || {};

    // SSE setup
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    });

    const send = (data) => { res.write(`data: ${JSON.stringify(data)}\n\n`); };
    const batchId = uuid();
    const results = [];

    send({ type: 'batch_start', batchId, totalFiles: selectedNames.length });

    for (let i = 0; i < selectedNames.length; i++) {
      const fileName = selectedNames[i];
      send({ type: 'batch_file_start', fileIndex: i, totalFiles: selectedNames.length, fileName });

      try {
        const doc = await storage.loadProjectFile(userId, req.params.id, fileName);
        if (!doc) { send({ type: 'batch_file_error', fileIndex: i, fileName, error: 'File not found' }); continue; }

        const text = await extractText(doc.buffer, doc.name);
        // Set audit context for LLM call tracking
        llm.setAuditContext({ userId, projectId: req.params.id, fileName, action: 'analysis' });
        // Per-file metadata overrides project config
        const fileMeta = await storage.loadProjectFileMeta(userId, req.params.id, fileName) || {};
        const result = await runAnalysis(text, {
          promptText: fileMeta.promptText || cfg.promptText || '',
          learnerId: cfg.learnerId || '',
          genre: fileMeta.genre || cfg.genre || '',
          language: fileMeta.language || 'en',
          enabledLayers: cfg.enabledLayers || ['L0','L1','L2','L3','L4','L5','L6','L7','L8','L9','L10'],
          onProgress: (evt) => { send({ ...evt, fileIndex: i, fileName }); },
        });

        const resultId = uuid();
        result.id = resultId;
        result.sourceFile = fileName;
        result.projectId = req.params.id;

        if (saveToProject) {
          await storage.saveProjectResult(userId, req.params.id, resultId, result);
        }
        results.push({ resultId, fileName, overallScore: result.overallScore });

        // Include full result data for single-file analysis so frontend can display immediately
        const doneEvt = { type: 'batch_file_done', fileIndex: i, fileName, resultId, overallScore: result.overallScore };
        if (selectedNames.length === 1) doneEvt.resultData = result;
        send(doneEvt);
      } catch (err) {
        send({ type: 'batch_file_error', fileIndex: i, fileName, error: err.message });
      }
    }

    // Update project timestamp
    project.updatedAt = new Date().toISOString();
    await storage.saveProject(userId, req.params.id, project);

    send({ type: 'batch_complete', batchId, results, totalTime: 0 });
    res.end();
  } catch (err) {
    console.error('[POST /api/projects/:id/analyze]', err);
    if (!res.headersSent) res.status(500).json({ error: err.message });
  }
});

// ─── Google Drive Import (via service account) ─────────────────────────────

const { GoogleAuth } = require('google-auth-library');
const DRIVE_API = 'https://www.googleapis.com/drive/v3';

let driveAuth = null;

async function getDriveToken() {
  if (!driveAuth) {
    const opts = { scopes: ['https://www.googleapis.com/auth/drive.readonly'] };
    if (config.gcs.keyFile) opts.keyFilename = config.gcs.keyFile;
    driveAuth = new GoogleAuth(opts);
  }
  const client = await driveAuth.getClient();
  const token = await client.getAccessToken();
  return token.token || token;
}

function extractFolderId(input) {
  if (!input) return null;
  if (/^[a-zA-Z0-9_-]{10,}$/.test(input.trim())) return input.trim();
  const m = input.match(/folders\/([a-zA-Z0-9_-]+)/) || input.match(/id=([a-zA-Z0-9_-]+)/);
  return m ? m[1] : null;
}

function getServiceAccountEmail() {
  // From config, or try to read from key file
  if (config.google.serviceAccountEmail) return config.google.serviceAccountEmail;
  if (config.gcs.keyFile) {
    try {
      const key = require(require('path').resolve(config.gcs.keyFile));
      return key.client_email || '';
    } catch { return ''; }
  }
  return '';
}

/**
 * GET /api/projects/drive/info — Return service account email for sharing instructions.
 */
router.get('/drive/info', (req, res) => {
  const email = getServiceAccountEmail();
  res.json({
    serviceAccountEmail: email,
    instructions: email
      ? `Share your Google Drive folder with: ${email} (Viewer access)`
      : 'Google Drive import is not configured. Set GOOGLE_APPLICATION_CREDENTIALS or GCS_KEY_FILE.',
  });
});

/**
 * POST /api/projects/:id/drive/list — List files in a shared Google Drive folder.
 */
router.post('/:id/drive/list', async (req, res) => {
  try {
    const token = await getDriveToken();
    const folderId = extractFolderId(req.body.folderUrl);
    if (!folderId) return res.status(400).json({ error: 'Invalid Google Drive folder URL or ID.' });

    const query = `'${folderId}' in parents and trashed=false`;
    const fields = 'files(id,name,mimeType,size,modifiedTime)';
    const url = `${DRIVE_API}/files?q=${encodeURIComponent(query)}&fields=${encodeURIComponent(fields)}&pageSize=100`;

    const resp = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      const saEmail = getServiceAccountEmail();
      return res.status(resp.status).json({
        error: err.error?.message || 'Could not access folder.',
        hint: saEmail ? `Make sure the folder is shared with: ${saEmail}` : '',
      });
    }

    const data = await resp.json();
    const supportedTypes = [
      'text/plain', 'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.google-apps.document',
    ];

    const files = (data.files || [])
      .filter(f => supportedTypes.includes(f.mimeType))
      .map(f => ({
        id: f.id, name: f.name, mimeType: f.mimeType,
        size: parseInt(f.size, 10) || 0,
        sizeLabel: formatSize(parseInt(f.size, 10) || 0),
        isGoogleDoc: f.mimeType === 'application/vnd.google-apps.document',
      }));

    res.json({ folderId, files, totalFound: (data.files || []).length, supported: files.length });
  } catch (err) {
    console.error('[POST /drive/list]', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/projects/:id/drive/import — Import selected files from Google Drive.
 */
router.post('/:id/drive/import', async (req, res) => {
  try {
    const token = await getDriveToken();
    const userId = uid(req.user);
    const projectId = req.params.id;
    const project = await storage.getProject(userId, projectId);
    if (!project) return res.status(404).json({ error: 'Project not found' });

    const filesToImport = req.body.files || [];
    if (filesToImport.length === 0) return res.status(400).json({ error: 'No files selected.' });

    const imported = [];
    const errors = [];

    for (const f of filesToImport) {
      try {
        let buffer, filename, contentType;

        if (f.isGoogleDoc || f.mimeType === 'application/vnd.google-apps.document') {
          const exportUrl = `${DRIVE_API}/files/${f.id}/export?mimeType=application/vnd.openxmlformats-officedocument.wordprocessingml.document`;
          const resp = await fetch(exportUrl, { headers: { Authorization: `Bearer ${token}` } });
          if (!resp.ok) throw new Error('Export failed');
          buffer = Buffer.from(await resp.arrayBuffer());
          filename = f.name.replace(/\.[^.]*$/, '') + '.docx';
          contentType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
        } else {
          const dlUrl = `${DRIVE_API}/files/${f.id}?alt=media`;
          const resp = await fetch(dlUrl, { headers: { Authorization: `Bearer ${token}` } });
          if (!resp.ok) throw new Error('Download failed');
          buffer = Buffer.from(await resp.arrayBuffer());
          filename = f.name;
          contentType = f.mimeType;
        }

        await storage.saveProjectFile(userId, projectId, filename, buffer, contentType);
        imported.push({ name: filename, size: buffer.length, sizeLabel: formatSize(buffer.length) });
      } catch (err) {
        errors.push({ name: f.name, error: err.message });
      }
    }

    project.updatedAt = new Date().toISOString();
    await storage.saveProject(userId, projectId, project);

    res.json({ imported, errors, totalImported: imported.length, totalErrors: errors.length });
  } catch (err) {
    console.error('[POST /drive/import]', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
