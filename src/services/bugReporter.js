'use strict';
/**
 * bugReporter.js — self-contained server-side error capture → BUG_LRS (xAPI).
 * Installed from bugfix-kit and bound to this project's invariants:
 *   - Actor is PSEUDONYMIZED (a reporter identity, not the end-user).
 *   - Learner PII (emails/phones) is REDACTED from message/stack/context, and any
 *     captured userEmail is stored only as a salted-less one-way hash pseudonym —
 *     a minor's email/data must never land in BUG_LRS (team-privacy).
 *   - BUG_LRS is SEPARATE from the learning LRS; the `failed` verb lives only here.
 *   - NEVER crashes the app: every send is wrapped; failures are silent.
 *   - Console intercept skips '[BugReporter]'-prefixed logs (no infinite loop).
 *   - Silent no-op when BUG_LRS_* env is missing (local dev).
 *   - Long text -> context.extensions, never result.response (xAPI size rule).
 * Requires Node 18+ (global fetch, crypto).
 */
const os = require('os');
const crypto = require('crypto');

function config() {
  return {
    appUrl: process.env.APP_URL || 'https://neo-cohmetrix.example',
    nodeEnv: process.env.NODE_ENV || 'development',
    bugLrs: {
      endpoint: process.env.BUG_LRS_ENDPOINT || '',
      username: process.env.BUG_LRS_USERNAME || '',
      password: process.env.BUG_LRS_PASSWORD || '',
      appId: process.env.BUG_APP_ID || 'neocohmetrix',
    },
  };
}

const PREFIX = '[BugReporter]';
const dedup = new Map(); // key -> expiresAt (1-min TTL)
const DEDUP_TTL = 60 * 1000;

setInterval(() => {
  const now = Date.now();
  for (const [k, exp] of dedup) if (exp <= now) dedup.delete(k);
}, DEDUP_TTL).unref?.();

function configured() {
  const b = config().bugLrs;
  return !!(b.endpoint && b.username && b.password);
}
function uuid() { return crypto.randomUUID(); }

// ── PII redaction (team-privacy) ─────────────────────────────────────────────
// Telemetry text is untrusted and may carry a learner's email/phone. Scrub before
// the statement is built (so nothing PII-bearing reaches BUG_LRS or the actor).
function redactPII(text) {
  if (text == null) return text;
  let out = String(text);
  out = out.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[email]');
  out = out.replace(/(?:\+?\d[\d\s().-]{6,}\d)/g, (m) =>
    (m.replace(/\D/g, '').length >= 7 ? '[phone]' : m));
  return out;
}
// A stable, non-reversible pseudonym for grouping without storing the address.
function pseudonymize(email) {
  if (!email) return null;
  return 'user:' + crypto.createHash('sha256').update(String(email).toLowerCase()).digest('hex').slice(0, 12);
}

function buildStatement({ message, stack, source = 'server', severity = 'error', route, method, statusCode, userEmail, component, context }) {
  const c = config();
  const APP = c.appUrl;
  const appId = c.bugLrs.appId;
  const errorId = uuid();

  // Redact before anything is persisted/sent.
  const safeMessage = redactPII(message);
  const safeStack = stack ? redactPII(stack) : null;
  const safeContext = context ? redactPII(JSON.stringify(context)) : null;
  const actorPseudo = pseudonymize(userEmail);

  const ext = (k, v) => (v == null || v === '' ? null : [`${APP}/${k}`, v]);
  const extensions = Object.fromEntries([
    ext('appId', appId), ext('errorId', errorId), ext('source', source), ext('severity', severity),
    ext('message', String(safeMessage).slice(0, 8000)), ext('stack', safeStack ? String(safeStack).slice(0, 4000) : null),
    ext('route', route), ext('method', method), ext('statusCode', statusCode),
    ext('userHash', actorPseudo), ext('component', component), ext('nodeEnv', c.nodeEnv),
    ext('hostname', os.hostname()), ext('context', safeContext ? safeContext.slice(0, 2000) : null),
  ].filter(Boolean));

  return {
    id: errorId, timestamp: new Date().toISOString(),
    actor: { objectType: 'Agent', name: `System Error Reporter [${appId}]`,
             mbox: `mailto:bug-reporter-${appId}@${os.hostname()}` },
    verb: { id: 'http://adlnet.gov/expapi/verbs/failed', display: { 'en-US': 'reported error' } },
    object: { objectType: 'Activity', id: `${APP}/errors/${appId}/${source}/${errorId}`,
      definition: { name: { 'en-US': `[${appId}][${severity}] ${String(safeMessage).slice(0, 200)}` },
        description: { 'en-US': String(safeMessage) }, type: 'http://adlnet.gov/expapi/activities/interaction' } },
    result: { success: false, completion: true }, // NOTE: no result.response by design
    context: { extensions },
  };
}

async function reportError(report = {}) {
  try {
    if (!configured()) return { reported: false, errorId: null };
    if (!report.message) return { reported: false, errorId: null };
    const key = `${report.source || 'server'}:${report.message}:${report.route || report.component || ''}`;
    const now = Date.now();
    if (dedup.has(key) && dedup.get(key) > now) return { reported: false, errorId: null };
    dedup.set(key, now + DEDUP_TTL);
    const stmt = buildStatement(report);
    const b = config().bugLrs;
    const auth = Buffer.from(`${b.username}:${b.password}`).toString('base64');
    const resp = await fetch(`${b.endpoint}/statements`, { method: 'POST',
      headers: { Authorization: `Basic ${auth}`, 'X-Experience-API-Version': '1.0.3', 'Content-Type': 'application/json' },
      body: JSON.stringify(stmt) });
    if (resp && resp.ok === false) { console.error(`${PREFIX} LRS POST failed: ${resp.status}`); return { reported: false, errorId: null }; }
    return { reported: true, errorId: stmt.id };
  } catch (_) { return { reported: false, errorId: null }; } // never throw
}

function bugReporterMiddleware(err, req, res, next) {
  const status = (err && err.status) || 500;
  reportError({ source: 'server', severity: status >= 500 ? 'error' : 'warning',
    message: (err && err.message) || 'Unknown server error',
    stack: err && err.stack, route: (req.originalUrl || req.path), method: req.method,
    statusCode: status, userEmail: req.user && req.user.email,
    context: { query: req.query, params: req.params } }).catch(() => {});
  next(err);
}

function describe(args) {
  let stack;
  const message = args.map((a) => {
    if (a instanceof Error) { stack = stack || a.stack; return a.message; }
    if (a && typeof a === 'object') { try { return JSON.stringify(a); } catch (_) { return String(a); } }
    return String(a);
  }).join(' ');
  if (!stack) { const e = args.find((a) => a instanceof Error); stack = e && e.stack; }
  return { message, stack };
}

function attachProcessHandlers() {
  if (!configured()) return; // no-op in local dev
  process.on('uncaughtException', (e) => { reportError({ source: 'server', severity: 'fatal', message: e.message, stack: e.stack, context: { type: 'uncaughtException' } }).catch(() => {}); });
  process.on('unhandledRejection', (e) => { reportError({ source: 'server', severity: 'error', message: `Unhandled Rejection: ${(e && e.message) || String(e)}`, stack: e && e.stack, context: { type: 'unhandledRejection' } }).catch(() => {}); });
  for (const level of ['error', 'warn']) {
    const orig = console[level].bind(console);
    console[level] = (...args) => {
      orig(...args);
      try {
        const firstStr = typeof args[0] === 'string' ? args[0] : '';
        if (firstStr.startsWith(PREFIX)) return; // loop guard
        const { message, stack } = describe(args);
        if (message) reportError({ source: 'server', severity: level === 'warn' ? 'warning' : 'error', message: message.slice(0, 1000), stack, context: { type: `console.${level}` } }).catch(() => {});
      } catch (_) {}
    };
  }
}

module.exports = { reportError, bugReporterMiddleware, attachProcessHandlers, buildStatement, configured, isConfigured: configured, redactPII, pseudonymize };
