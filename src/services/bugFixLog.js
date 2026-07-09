/**
 * bugFixLog.js — shared fix-log for the bug-tracking pipeline.
 *
 * Project binding (team-bugfix): the "admin tab and CLI stay in sync" guarantee
 * only holds if the fix log is SHARED. A local file is per-instance and lost on
 * Cloud Run restart, so the canonical store is GCS (`cache/bugfix/log.json`) via
 * helpStore CAS (if-generation-match). When GCS is unconfigured (local dev) we
 * fall back to a local file so the CLI still works there. Both the admin GET
 * route and scripts/bug-triage.js read/write THIS module, so they never diverge.
 *
 * Shape: { fixed: { [errorId]: {fixedAt, note} }, dismissed: { [errorId]: {dismissedAt, reason} } }
 */
const fs = require('fs');
const path = require('path');
const storage = require('./storage');
const helpStore = require('./helpStore');

const GCS_KEY = 'cache/bugfix/log.json';
const LOCAL_PATH = path.resolve(__dirname, '..', '..', 'bug-fix-log.json');

const EMPTY = () => ({ fixed: {}, dismissed: {} });
function normalize(d) {
  d = (d && typeof d === 'object') ? d : {};
  return { fixed: d.fixed || {}, dismissed: d.dismissed || {} };
}

/** Read the fix log. Never throws — returns an empty log on any failure. */
async function load() {
  if (storage.isConfigured()) {
    const doc = await helpStore.get(GCS_KEY).catch(() => null);
    return normalize(doc);
  }
  try { return normalize(JSON.parse(fs.readFileSync(LOCAL_PATH, 'utf8'))); }
  catch (_) { return EMPTY(); }
}

/** Persist a whole fix-log object (used by the CLI's load-mutate-save flow). */
async function save(log) {
  const next = normalize(log);
  if (storage.isConfigured()) {
    // Whole-doc write under CAS (single operator; last-write-wins is acceptable).
    return helpStore.mutate(GCS_KEY, EMPTY(), () => next).catch(() => next);
  }
  try { fs.writeFileSync(LOCAL_PATH, JSON.stringify(next, null, 2)); } catch (_) {}
  return next;
}

/** CAS-safe single-key mutation (preferred for concurrent writers). */
async function mutate(fn) {
  if (storage.isConfigured()) {
    return helpStore.mutate(GCS_KEY, EMPTY(), (cur) => { const next = normalize(cur); fn(next); return next; })
      .catch(async () => { const cur = await load(); fn(cur); return cur; });
  }
  const cur = await load();
  fn(cur);
  return save(cur);
}

async function markFixed(errorId, note) {
  return mutate((l) => { l.fixed[errorId] = { fixedAt: new Date().toISOString(), note: (note || '').trim() }; });
}
async function dismissBug(errorId, reason) {
  return mutate((l) => { l.dismissed[errorId] = { dismissedAt: new Date().toISOString(), reason: (reason || '').trim() }; });
}
async function reset() {
  return save(EMPTY());
}

module.exports = { load, save, mutate, markFixed, dismissBug, reset, GCS_KEY, LOCAL_PATH };
