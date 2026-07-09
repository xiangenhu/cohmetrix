/**
 * bugReportRoutes.js — bug-report Express routes (from bugfix-kit), adapted:
 *   - Fix-log is read from the SHARED store (bugFixLog, GCS-CAS + local fallback)
 *     via an injected async `getFixLog()` — not a per-instance local file — so the
 *     admin feed and the CLI stay in sync (team-bugfix project binding).
 *   - Reporter return shape matches this app's self-contained bugReporter
 *     (`{ reported, errorId }`).
 *
 * Mounted at /api/telemetry (server.js):
 *   POST /api/telemetry/bug-report   (public, optionalAuth) — client submit; 503 if unconfigured
 *   GET  /api/telemetry/bug-reports  (Admin only)          — dashboard feed
 *
 * Env read directly by the GET handler:
 *   BUG_LRS_ENDPOINT / _USERNAME / _PASSWORD  — LRS Basic auth
 *   BUG_APP_ID (default 'neocohmetrix')       — isolates this app's bugs in a shared LRS
 *   APP_URL                                   — xAPI extension IRI base (must match the writer)
 * Requires Node 18+ (global fetch).
 */
const express = require('express');

function createBugReportRoutes(deps = {}) {
  const {
    bugReporter,
    optionalAuth = (req, _res, next) => next(),
    requireAdmin = (req, res, next) => next(),
    getFixLog = async () => ({ fixed: {}, dismissed: {} }),
  } = deps;

  if (!bugReporter) {
    throw new Error('createBugReportRoutes: `bugReporter` service is required in deps');
  }

  const router = express.Router();

  // POST /bug-report — public (optionalAuth). Client errors captured even when
  // signed out; req.user.email (if present) is pseudonymized inside the reporter.
  router.post('/bug-report', optionalAuth, async (req, res) => {
    try {
      if (!bugReporter.isConfigured()) {
        return res.status(503).json({ error: 'Bug reporting not configured' });
      }
      const { message, stack, component, route, severity, context } = req.body || {};
      if (!message) {
        return res.status(400).json({ error: 'message is required' });
      }
      const result = await bugReporter.reportError({
        source: 'client',
        severity: severity || 'error',
        message, stack, component, route,
        userEmail: req.user && req.user.email,
        context,
      });
      res.json({ reported: !!(result && result.reported), errorId: result && result.errorId });
    } catch (err) {
      console.error('[Telemetry] Bug report failed:', err.message);
      res.status(500).json({ error: 'Failed to submit bug report' });
    }
  });

  // GET /bug-reports — Admin only. Fetches this app's `failed` statements from
  // BUG_LRS, dedups, and annotates each with open/fixed/dismissed from the shared
  // fix log. `requireAdmin` may be a single fn or a middleware array.
  const adminGuards = Array.isArray(requireAdmin) ? requireAdmin : [requireAdmin];
  router.get('/bug-reports', ...adminGuards, async (req, res) => {
    try {
      const endpoint = process.env.BUG_LRS_ENDPOINT;
      const username = process.env.BUG_LRS_USERNAME;
      const password = process.env.BUG_LRS_PASSWORD;
      if (!endpoint || !username || !password) {
        return res.json({ configured: false, bugs: [], summary: {} });
      }

      let since;
      const sinceParam = req.query.since || '7d';
      const match = String(sinceParam).match(/^(\d+)(h|d|w)$/);
      if (match) {
        const ms = { h: 3600000, d: 86400000, w: 604800000 }[match[2]];
        since = new Date(Date.now() - parseInt(match[1], 10) * ms).toISOString();
      } else {
        since = sinceParam;
      }

      const auth = Buffer.from(`${username}:${password}`).toString('base64');
      const extBase = process.env.APP_URL || 'https://neo-cohmetrix.example';
      const appId = process.env.BUG_APP_ID || 'neocohmetrix';

      const allStatements = [];
      let url = `${endpoint}/statements?limit=100&ascending=false&since=${since}`;
      while (url) {
        const response = await fetch(url, {
          headers: { 'Authorization': `Basic ${auth}`, 'X-Experience-API-Version': '1.0.3' },
        });
        if (!response.ok) {
          return res.status(502).json({ error: `LRS returned ${response.status}` });
        }
        const data = await response.json();
        allStatements.push(...(data.statements || []));
        url = data.more ? (data.more.startsWith('http') ? data.more : `${endpoint}${data.more}`) : null;
      }

      const appStatements = allStatements.filter((stmt) => {
        const ext = (stmt.context && stmt.context.extensions) || {};
        return ext[`${extBase}/appId`] === appId;
      });

      const bugs = appStatements.map((stmt) => {
        const ext = (stmt.context && stmt.context.extensions) || {};
        return {
          id: stmt.id,
          timestamp: stmt.timestamp,
          appId: ext[`${extBase}/appId`] || 'unknown',
          source: ext[`${extBase}/source`] || 'unknown',
          severity: ext[`${extBase}/severity`] || 'unknown',
          message: ext[`${extBase}/message`] || (stmt.object && stmt.object.definition && stmt.object.definition.description && stmt.object.definition.description['en-US']) || 'No message',
          stack: ext[`${extBase}/stack`] || null,
          route: ext[`${extBase}/route`] || null,
          method: ext[`${extBase}/method`] || null,
          statusCode: ext[`${extBase}/statusCode`] || null,
          userHash: ext[`${extBase}/userHash`] || null,
          component: ext[`${extBase}/component`] || null,
          nodeEnv: ext[`${extBase}/nodeEnv`] || null,
          hostname: ext[`${extBase}/hostname`] || null,
        };
      });

      const groups = new Map();
      for (const bug of bugs) {
        const key = `${bug.source}:${bug.message}:${bug.route || ''}:${bug.statusCode || ''}`;
        if (!groups.has(key)) {
          groups.set(key, { ...bug, occurrences: 1, firstSeen: bug.timestamp, lastSeen: bug.timestamp });
        } else {
          const existing = groups.get(key);
          existing.occurrences++;
          if (bug.timestamp < existing.firstSeen) existing.firstSeen = bug.timestamp;
          if (bug.timestamp > existing.lastSeen) existing.lastSeen = bug.timestamp;
        }
      }
      const deduped = Array.from(groups.values()).sort((a, b) => b.occurrences - a.occurrences);

      // Shared fix log (GCS-CAS or local fallback) — never a per-instance file.
      let fixLog = { fixed: {}, dismissed: {} };
      try { fixLog = (await getFixLog()) || fixLog; } catch { /* ignore */ }

      const annotated = deduped.map((bug) => {
        let status = 'open', fixNote = null;
        if (fixLog.fixed && fixLog.fixed[bug.id]) { status = 'fixed'; fixNote = fixLog.fixed[bug.id].note; }
        else if (fixLog.dismissed && fixLog.dismissed[bug.id]) { status = 'dismissed'; fixNote = fixLog.dismissed[bug.id].reason; }
        return { ...bug, status, fixNote };
      });

      const summary = {
        appId, total: appStatements.length, unique: deduped.length,
        open: annotated.filter((b) => b.status === 'open').length,
        fixed: annotated.filter((b) => b.status === 'fixed').length,
        dismissed: annotated.filter((b) => b.status === 'dismissed').length,
        bySeverity: {}, bySource: {},
      };
      for (const bug of annotated.filter((b) => b.status === 'open')) {
        summary.bySeverity[bug.severity] = (summary.bySeverity[bug.severity] || 0) + bug.occurrences;
        summary.bySource[bug.source] = (summary.bySource[bug.source] || 0) + bug.occurrences;
      }

      res.json({ configured: true, bugs: annotated, summary, since });
    } catch (err) {
      console.error('[Telemetry] Bug reports fetch failed:', err.message);
      res.status(500).json({ error: 'Failed to fetch bug reports' });
    }
  });

  return router;
}

module.exports = { createBugReportRoutes };
