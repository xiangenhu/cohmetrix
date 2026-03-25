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
        email: userId, // userId is now the raw email
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

// ─── List all projects across all users ────────────────────────────────────

router.get('/projects', async (req, res) => {
  try {
    const userIds = await storage.listAllUsers();
    const allProjects = [];
    await Promise.all(userIds.map(async (userId) => {
      const projects = await storage.listProjects(userId);
      await Promise.all(projects.map(async (p) => {
        const [files, results] = await Promise.all([
          storage.listProjectFiles(userId, p.id),
          storage.listProjectResults(userId, p.id),
        ]);
        allProjects.push({ ...p, userId, ownerEmail: userId, fileCount: files.length, resultCount: results.length });
      }));
    }));
    // Sort by most recently updated
    allProjects.sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0));
    res.json({ projects: allProjects });
  } catch (err) {
    console.error('[GET /api/admin/projects]', err);
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

// ─── Assign project to a different owner ───────────────────────────────────

router.put('/users/:userId/projects/:projectId/owner', async (req, res) => {
  try {
    const { ownerEmail } = req.body;
    if (!ownerEmail || !ownerEmail.trim()) return res.status(400).json({ error: 'ownerEmail is required' });
    const fromUserId = req.params.userId;
    const toUserId = ownerEmail.trim().toLowerCase();
    if (fromUserId === toUserId) return res.json({ message: 'Already owned by this user' });

    const project = await storage.getProject(fromUserId, req.params.projectId);
    if (!project) return res.status(404).json({ error: 'Project not found' });

    const transferred = await storage.transferProject(fromUserId, toUserId, req.params.projectId);
    if (!transferred) return res.status(500).json({ error: 'Transfer failed' });

    res.json({ message: `Project transferred to ${ownerEmail}`, newUserId: toUserId });
  } catch (err) {
    console.error('[PUT /api/admin/.../owner]', err);
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

// ─── Storage Migration ────────────────────────────────────────────────────

router.post('/migrate', async (req, res) => {
  try {
    const stats = await storage.migrateStorageLayout();
    console.log('[MIGRATION]', JSON.stringify(stats));
    res.json(stats);
  } catch (err) {
    console.error('[POST /api/admin/migrate]', err);
    res.status(500).json({ error: err.message });
  }
});

// ─── Audit Log Browsing ───────────────────────────────────────────────────

router.get('/audit', async (req, res) => {
  try {
    const { userId, projectId, month } = req.query;
    const entries = await storage.listAuditEntries({ userId, projectId, month });
    res.json({ entries, count: entries.length });
  } catch (err) {
    console.error('[GET /api/admin/audit]', err);
    res.status(500).json({ error: err.message });
  }
});

router.get('/audit/entry', async (req, res) => {
  try {
    const { path: auditPath } = req.query;
    if (!auditPath) return res.status(400).json({ error: 'path query param required' });
    const entry = await storage.loadAuditEntry(auditPath);
    if (!entry) return res.status(404).json({ error: 'Audit entry not found' });
    res.json(entry);
  } catch (err) {
    console.error('[GET /api/admin/audit/entry]', err);
    res.status(500).json({ error: err.message });
  }
});

// ─── Per-user usage overview (all projects) ───────────────────────────────

router.get('/users/:userId/usage', async (req, res) => {
  try {
    const projects = await storage.listProjects(req.params.userId);
    const usage = await Promise.all(projects.map(async (p) => {
      const u = await storage.loadProjectUsage(req.params.userId, p.id);
      return { projectId: p.id, projectName: p.name, ...u.totals };
    }));
    const grandTotal = usage.reduce((acc, u) => {
      acc.promptTokens += u.promptTokens; acc.completionTokens += u.completionTokens;
      acc.totalTokens += u.totalTokens; acc.totalCost += u.totalCost; acc.calls += u.calls;
      return acc;
    }, { promptTokens: 0, completionTokens: 0, totalTokens: 0, totalCost: 0, calls: 0 });
    res.json({ projects: usage, grandTotal });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Quota management (super admin) ──────────────────────────────────────────

router.get('/users/:userId/quota', async (req, res) => {
  try {
    const quota = await storage.loadUserQuota(req.params.userId);
    const remaining = Math.max(0, quota.quota - quota.spent);
    res.json({ ...quota, remaining });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/users/:userId/quota', async (req, res) => {
  try {
    const { quota: newQuota, addAmount } = req.body;
    const quotaData = await storage.loadUserQuota(req.params.userId);

    if (typeof newQuota === 'number' && newQuota >= 0) {
      quotaData.quota = newQuota;
    } else if (typeof addAmount === 'number' && addAmount > 0) {
      quotaData.quota = (quotaData.quota || 0) + addAmount;
    } else {
      return res.status(400).json({ error: 'Provide quota (absolute) or addAmount (increment)' });
    }

    quotaData.deposits = quotaData.deposits || [];
    quotaData.deposits.push({
      amount: typeof newQuota === 'number' ? newQuota - (quotaData.quota - (typeof addAmount === 'number' ? addAmount : 0)) : addAmount,
      method: 'admin',
      ref: `admin:${req.user?.user?.email || req.user?.email || 'unknown'}`,
      ts: new Date().toISOString(),
    });

    await storage.saveUserQuota(req.params.userId, quotaData);
    const remaining = Math.max(0, quotaData.quota - quotaData.spent);
    res.json({ success: true, quota: quotaData.quota, spent: +quotaData.spent.toFixed(6), remaining: +remaining.toFixed(6) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Reset user spending (super admin) ───────────────────────────────────────

router.post('/users/:userId/reset-spending', async (req, res) => {
  try {
    const quotaData = await storage.loadUserQuota(req.params.userId);
    quotaData.spent = 0;
    await storage.saveUserQuota(req.params.userId, quotaData);
    res.json({ success: true, quota: quotaData.quota, spent: 0, remaining: quotaData.quota });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
