/**
 * Admin Routes — Super admin management of all users and projects.
 * Protected by requireAdmin middleware.
 */
const express = require('express');
const path = require('path');
const storage = require('../services/storage');
const { requireAdmin } = require('../services/auth');
const { extractText } = require('../utils/fileParser');

const router = express.Router();

// All admin routes require super admin
router.use(requireAdmin);

function formatSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

// ─── List all users ────────────────────────────────────────────────────────

router.get('/users', async (req, res) => {
  try {
    const userIds = await storage.listAllUsers();
    // Enrich with project counts
    const users = await Promise.all(userIds.map(async (userId) => {
      const projects = await storage.listProjects(userId);
      let totalFiles = 0;
      let totalResults = 0;
      for (const p of projects) {
        const [files, results] = await Promise.all([
          storage.listProjectFiles(userId, p.id),
          storage.listProjectResults(userId, p.id),
        ]);
        totalFiles += files.length;
        totalResults += results.length;
      }
      return {
        userId,
        email: userId.replace(/-at-/g, '@').replace(/-/g, '.'),
        projectCount: projects.length,
        totalFiles,
        totalResults,
      };
    }));
    res.json({ users });
  } catch (err) {
    console.error('[GET /api/admin/users]', err);
    res.status(500).json({ error: err.message });
  }
});

// ─── List a user's projects ────────────────────────────────────────────────

router.get('/users/:userId/projects', async (req, res) => {
  try {
    const projects = await storage.listProjects(req.params.userId);
    const enriched = await Promise.all(projects.map(async (p) => {
      const [files, results] = await Promise.all([
        storage.listProjectFiles(req.params.userId, p.id),
        storage.listProjectResults(req.params.userId, p.id),
      ]);
      return { ...p, fileCount: files.length, resultCount: results.length };
    }));
    res.json({ projects: enriched });
  } catch (err) {
    console.error('[GET /api/admin/users/:userId/projects]', err);
    res.status(500).json({ error: err.message });
  }
});

// ─── Get project detail ────────────────────────────────────────────────────

router.get('/users/:userId/projects/:projectId', async (req, res) => {
  try {
    const { userId, projectId } = req.params;
    const project = await storage.getProject(userId, projectId);
    if (!project) return res.status(404).json({ error: 'Project not found' });
    const [rawFiles, results] = await Promise.all([
      storage.listProjectFiles(userId, projectId),
      storage.listProjectResults(userId, projectId),
    ]);
    const files = await Promise.all(rawFiles.map(async (f) => {
      const meta = await storage.loadProjectFileMeta(userId, projectId, f.name);
      return { ...f, sizeLabel: formatSize(f.size), ext: path.extname(f.name).toLowerCase(), meta: meta || null };
    }));
    res.json({ project, files, results });
  } catch (err) {
    console.error('[GET /api/admin/users/:userId/projects/:projectId]', err);
    res.status(500).json({ error: err.message });
  }
});

// ─── Delete a user's project ───────────────────────────────────────────────

router.delete('/users/:userId/projects/:projectId', async (req, res) => {
  try {
    const deleted = await storage.deleteProject(req.params.userId, req.params.projectId);
    if (!deleted) return res.status(404).json({ error: 'Project not found' });
    res.json({ message: 'Project deleted' });
  } catch (err) {
    console.error('[DELETE /api/admin/users/:userId/projects/:projectId]', err);
    res.status(500).json({ error: err.message });
  }
});

// ─── List project files ────────────────────────────────────────────────────

router.get('/users/:userId/projects/:projectId/files', async (req, res) => {
  try {
    const files = await storage.listProjectFiles(req.params.userId, req.params.projectId);
    const enriched = await Promise.all(files.map(async (f) => {
      const meta = await storage.loadProjectFileMeta(req.params.userId, req.params.projectId, f.name);
      return { ...f, sizeLabel: formatSize(f.size), meta: meta || null };
    }));
    res.json({ files: enriched });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── View file content ─────────────────────────────────────────────────────

router.get('/users/:userId/projects/:projectId/files/:filename/content', async (req, res) => {
  try {
    const doc = await storage.loadProjectFile(req.params.userId, req.params.projectId, req.params.filename);
    if (!doc) return res.status(404).json({ error: 'File not found' });

    if (req.query.extract === 'true') {
      const text = await extractText(doc.buffer, doc.name);
      const wordCount = text.split(/\s+/).filter(w => w.length > 0).length;
      return res.json({ name: doc.name, text, wordCount });
    }

    res.set('Content-Type', doc.contentType || 'application/octet-stream');
    const basename = path.basename(doc.name);
    res.set('Content-Disposition', `inline; filename="${encodeURIComponent(basename)}"; filename*=UTF-8''${encodeURIComponent(basename)}`);
    res.send(doc.buffer);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── List project results ──────────────────────────────────────────────────

router.get('/users/:userId/projects/:projectId/results', async (req, res) => {
  try {
    const results = await storage.listProjectResults(req.params.userId, req.params.projectId);
    res.json({ results });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── View a result ─────────────────────────────────────────────────────────

router.get('/users/:userId/projects/:projectId/results/:resultId', async (req, res) => {
  try {
    const result = await storage.loadProjectResult(req.params.userId, req.params.projectId, req.params.resultId);
    if (!result) return res.status(404).json({ error: 'Result not found' });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Delete a result ───────────────────────────────────────────────────────

router.delete('/users/:userId/projects/:projectId/results/:resultId', async (req, res) => {
  try {
    const deleted = await storage.deleteProjectResult(req.params.userId, req.params.projectId, req.params.resultId);
    if (!deleted) return res.status(404).json({ error: 'Result not found' });
    res.json({ message: 'Result deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
