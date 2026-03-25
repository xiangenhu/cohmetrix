const { Storage } = require('@google-cloud/storage');
const config = require('../config');

let storage = null;
let bucket = null;

// In-memory fallback for development without GCS
const memoryStore = new Map();

function initStorage() {
  if (storage !== null) return; // already attempted
  // Only init GCS if project ID and bucket are configured
  if (!config.gcs.projectId && !config.gcs.keyFile && !process.env.GOOGLE_APPLICATION_CREDENTIALS && !process.env.K_SERVICE) {
    console.log('[GCS] No credentials configured, using in-memory store');
    storage = 'memory';
    return;
  }
  try {
    const opts = {};
    if (config.gcs.projectId) opts.projectId = config.gcs.projectId;
    if (config.gcs.keyFile) opts.keyFilename = config.gcs.keyFile;
    const gcs = new Storage(opts);
    bucket = gcs.bucket(config.gcs.bucketName);
    storage = gcs;
    console.log(`[GCS] Connected to bucket: ${config.gcs.bucketName}`);
  } catch (err) {
    console.warn('[GCS] Failed to initialize, using in-memory store:', err.message);
    storage = 'memory';
  }
}

/**
 * Save analysis result to GCS (or memory fallback).
 */
async function saveResult(analysisId, data) {
  initStorage();
  const payload = JSON.stringify(data);

  if (bucket) {
    const file = bucket.file(`results/${analysisId}.json`);
    await file.save(payload, { contentType: 'application/json' });
    return `gs://${config.gcs.bucketName}/results/${analysisId}.json`;
  }

  // Memory fallback
  memoryStore.set(analysisId, payload);
  return `memory://${analysisId}`;
}

/**
 * Load analysis result from GCS (or memory fallback).
 */
async function loadResult(analysisId) {
  initStorage();

  if (bucket) {
    const file = bucket.file(`results/${analysisId}.json`);
    const [exists] = await file.exists();
    if (!exists) return null;
    const [contents] = await file.download();
    return JSON.parse(contents.toString());
  }

  // Memory fallback
  const data = memoryStore.get(analysisId);
  return data ? JSON.parse(data) : null;
}

/**
 * Save uploaded file to GCS (or memory fallback).
 */
async function saveUpload(analysisId, filename, buffer) {
  initStorage();

  if (bucket) {
    const file = bucket.file(`uploads/${analysisId}/${filename}`);
    await file.save(buffer);
    return `gs://${config.gcs.bucketName}/uploads/${analysisId}/${filename}`;
  }

  memoryStore.set(`upload:${analysisId}`, { filename, buffer });
  return `memory://upload/${analysisId}`;
}

/**
 * List all analysis results with summary metadata.
 * Returns: [{ id, size, updated }]
 */
async function listResults() {
  initStorage();

  if (bucket) {
    const [files] = await bucket.getFiles({ prefix: 'results/' });
    return files
      .filter(f => f.name.endsWith('.json'))
      .map(f => ({
        id: f.name.replace('results/', '').replace('.json', ''),
        path: f.name,
        size: parseInt(f.metadata.size, 10) || 0,
        updated: f.metadata.updated || f.metadata.timeCreated,
      }))
      .sort((a, b) => new Date(b.updated) - new Date(a.updated));
  }

  return Array.from(memoryStore.keys())
    .filter(k => !k.startsWith('upload:') && !k.startsWith('doc:'))
    .map(k => ({ id: k, path: k, size: 0, updated: new Date().toISOString() }));
}

/**
 * Delete an analysis result.
 */
async function deleteResult(analysisId) {
  initStorage();

  if (bucket) {
    const file = bucket.file(`results/${analysisId}.json`);
    const [exists] = await file.exists();
    if (!exists) return false;
    await file.delete();
    return true;
  }

  return memoryStore.delete(analysisId);
}

// ─── Document Library ────────────────────────────────────────────────────────

const DOC_PREFIX = 'documents/';

/**
 * List all documents in the library.
 * Returns: [{ name, path, size, updated, contentType }]
 */
async function listDocuments(folder = '') {
  initStorage();
  const prefix = DOC_PREFIX + folder;

  if (bucket) {
    const [files] = await bucket.getFiles({ prefix });
    return files
      .filter(f => !f.name.endsWith('/')) // skip "folder" markers
      .map(f => ({
        name: f.name.replace(DOC_PREFIX, ''),
        path: f.name,
        size: parseInt(f.metadata.size, 10) || 0,
        updated: f.metadata.updated || f.metadata.timeCreated,
        contentType: f.metadata.contentType || 'application/octet-stream',
      }));
  }

  // Memory fallback
  return Array.from(memoryStore.entries())
    .filter(([k]) => k.startsWith('doc:'))
    .map(([k, v]) => ({
      name: k.replace('doc:', ''),
      path: k,
      size: v.buffer ? v.buffer.length : 0,
      updated: v.updated || new Date().toISOString(),
      contentType: v.contentType || 'application/octet-stream',
    }));
}

/**
 * Save a document to the library.
 */
async function saveDocument(filename, buffer, contentType) {
  initStorage();
  const filePath = DOC_PREFIX + filename;

  if (bucket) {
    const file = bucket.file(filePath);
    await file.save(buffer, { contentType: contentType || 'application/octet-stream' });
    return { path: filePath, uri: `gs://${config.gcs.bucketName}/${filePath}` };
  }

  memoryStore.set(`doc:${filename}`, { buffer, contentType, updated: new Date().toISOString() });
  return { path: `doc:${filename}`, uri: `memory://doc/${filename}` };
}

/**
 * Download a document from the library. Returns { buffer, contentType }.
 */
async function loadDocument(filePath) {
  initStorage();

  if (bucket) {
    const file = bucket.file(filePath);
    const [exists] = await file.exists();
    if (!exists) return null;
    const [buffer] = await file.download();
    const [metadata] = await file.getMetadata();
    return { buffer, contentType: metadata.contentType, name: filePath.replace(DOC_PREFIX, '') };
  }

  const key = filePath.startsWith('doc:') ? filePath : `doc:${filePath.replace(DOC_PREFIX, '')}`;
  const entry = memoryStore.get(key);
  if (!entry) return null;
  return { buffer: entry.buffer, contentType: entry.contentType, name: key.replace('doc:', '') };
}

/**
 * Delete a document from the library.
 */
async function deleteDocument(filePath) {
  initStorage();

  if (bucket) {
    const file = bucket.file(filePath);
    const [exists] = await file.exists();
    if (!exists) return false;
    await file.delete();
    return true;
  }

  const key = filePath.startsWith('doc:') ? filePath : `doc:${filePath.replace(DOC_PREFIX, '')}`;
  return memoryStore.delete(key);
}

// ─── Project-scoped Storage ─────────────────────────────────────────────────

function getUserId(user) {
  return (user.email || 'anonymous').toLowerCase();
}

function projectPath(userId, projectId, ...parts) {
  return ['users', userId, 'projects', projectId, ...parts].join('/');
}


async function listProjects(userId) {
  initStorage();
  const prefix = `users/${userId}/projects/`;

  if (bucket) {
    const [files] = await bucket.getFiles({ prefix, matchGlob: '**/config.json' });
    const projects = [];
    for (const f of files) {
      if (!f.name.endsWith('/config.json')) continue;
      try {
        const [contents] = await f.download();
        projects.push(JSON.parse(contents.toString()));
      } catch { /* skip corrupt */ }
    }
    return projects.sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0));
  }

  // Memory fallback
  return Array.from(memoryStore.entries())
    .filter(([k]) => k.startsWith(`proj:${userId}:`) && k.endsWith(':config'))
    .map(([, v]) => JSON.parse(v))
    .sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0));
}

async function getProject(userId, projectId) {
  initStorage();
  if (bucket) {
    const file = bucket.file(projectPath(userId, projectId, 'config.json'));
    const [exists] = await file.exists();
    if (!exists) return null;
    const [contents] = await file.download();
    return JSON.parse(contents.toString());
  }
  const data = memoryStore.get(`proj:${userId}:${projectId}:config`);
  return data ? JSON.parse(data) : null;
}

async function saveProject(userId, projectId, meta) {
  initStorage();
  const payload = JSON.stringify(meta);
  if (bucket) {
    await bucket.file(projectPath(userId, projectId, 'config.json')).save(payload, { contentType: 'application/json' });
  } else {
    memoryStore.set(`proj:${userId}:${projectId}:config`, payload);
  }
}

async function deleteProject(userId, projectId) {
  initStorage();
  if (bucket) {
    const prefix = projectPath(userId, projectId) + '/';
    const [files] = await bucket.getFiles({ prefix });
    if (files.length === 0) return false;
    await Promise.all(files.map(f => f.delete()));
    return true;
  }
  const prefix = `proj:${userId}:${projectId}:`;
  const keys = Array.from(memoryStore.keys()).filter(k => k.startsWith(prefix));
  keys.forEach(k => memoryStore.delete(k));
  return keys.length > 0;
}

async function listProjectFiles(userId, projectId) {
  initStorage();
  const prefix = projectPath(userId, projectId, 'documents') + '/';
  if (bucket) {
    const [files] = await bucket.getFiles({ prefix });
    return files.filter(f => !f.name.endsWith('/') && !f.name.endsWith('.meta.json')).map(f => ({
      name: f.name.split('/').pop(),
      path: f.name,
      size: parseInt(f.metadata.size, 10) || 0,
      updated: f.metadata.updated || f.metadata.timeCreated,
      contentType: f.metadata.contentType || 'application/octet-stream',
    }));
  }
  const pfx = `proj:${userId}:${projectId}:doc:`;
  return Array.from(memoryStore.entries())
    .filter(([k]) => k.startsWith(pfx))
    .map(([k, v]) => {
      const entry = typeof v === 'string' ? JSON.parse(v) : v;
      return { name: k.replace(pfx, ''), size: entry.buffer ? entry.buffer.length : 0, updated: entry.updated || new Date().toISOString(), contentType: entry.contentType || 'application/octet-stream' };
    });
}

async function saveProjectFile(userId, projectId, filename, buffer, contentType) {
  initStorage();
  const filePath = projectPath(userId, projectId, 'documents', filename);
  if (bucket) {
    await bucket.file(filePath).save(buffer, { contentType: contentType || 'application/octet-stream' });
    return filePath;
  }
  memoryStore.set(`proj:${userId}:${projectId}:doc:${filename}`, { buffer, contentType, updated: new Date().toISOString() });
  return filePath;
}

async function loadProjectFile(userId, projectId, filename) {
  initStorage();
  if (bucket) {
    const file = bucket.file(projectPath(userId, projectId, 'documents', filename));
    const [exists] = await file.exists();
    if (!exists) return null;
    const [buffer] = await file.download();
    const [metadata] = await file.getMetadata();
    return { buffer, contentType: metadata.contentType, name: filename };
  }
  const entry = memoryStore.get(`proj:${userId}:${projectId}:doc:${filename}`);
  if (!entry) return null;
  return { buffer: entry.buffer, contentType: entry.contentType, name: filename };
}

async function saveProjectFileMeta(userId, projectId, filename, meta) {
  initStorage();
  const payload = JSON.stringify(meta);
  const metaPath = projectPath(userId, projectId, 'documents', filename + '.meta.json');
  if (bucket) {
    await bucket.file(metaPath).save(payload, { contentType: 'application/json' });
  } else {
    memoryStore.set(`proj:${userId}:${projectId}:docmeta:${filename}`, payload);
  }
}

async function loadProjectFileMeta(userId, projectId, filename) {
  initStorage();
  if (bucket) {
    const file = bucket.file(projectPath(userId, projectId, 'documents', filename + '.meta.json'));
    const [exists] = await file.exists();
    if (!exists) return null;
    const [contents] = await file.download();
    return JSON.parse(contents.toString());
  }
  const data = memoryStore.get(`proj:${userId}:${projectId}:docmeta:${filename}`);
  return data ? JSON.parse(data) : null;
}

async function deleteProjectFile(userId, projectId, filename) {
  initStorage();
  // Also delete metadata file
  if (bucket) {
    const file = bucket.file(projectPath(userId, projectId, 'documents', filename));
    const [exists] = await file.exists();
    if (!exists) return false;
    await file.delete();
    const metaFile = bucket.file(projectPath(userId, projectId, 'documents', filename + '.meta.json'));
    const [metaExists] = await metaFile.exists();
    if (metaExists) await metaFile.delete();
    return true;
  }
  memoryStore.delete(`proj:${userId}:${projectId}:docmeta:${filename}`);
  return memoryStore.delete(`proj:${userId}:${projectId}:doc:${filename}`);
}

async function listProjectResults(userId, projectId) {
  initStorage();
  const prefix = projectPath(userId, projectId, 'analysis') + '/';
  if (bucket) {
    const [files] = await bucket.getFiles({ prefix });
    return files.filter(f => f.name.endsWith('.json')).map(f => ({
      id: f.name.split('/').pop().replace('.json', ''),
      size: parseInt(f.metadata.size, 10) || 0,
      updated: f.metadata.updated || f.metadata.timeCreated,
    })).sort((a, b) => new Date(b.updated) - new Date(a.updated));
  }
  const pfx = `proj:${userId}:${projectId}:analysis:`;
  return Array.from(memoryStore.keys())
    .filter(k => k.startsWith(pfx))
    .map(k => ({ id: k.replace(pfx, ''), size: 0, updated: new Date().toISOString() }));
}

async function saveProjectResult(userId, projectId, resultId, data) {
  initStorage();
  const payload = JSON.stringify(data);
  if (bucket) {
    await bucket.file(projectPath(userId, projectId, 'analysis', `${resultId}.json`)).save(payload, { contentType: 'application/json' });
  } else {
    memoryStore.set(`proj:${userId}:${projectId}:analysis:${resultId}`, payload);
  }
}

async function loadProjectResult(userId, projectId, resultId) {
  initStorage();
  if (bucket) {
    const file = bucket.file(projectPath(userId, projectId, 'analysis', `${resultId}.json`));
    const [exists] = await file.exists();
    if (!exists) return null;
    const [contents] = await file.download();
    return JSON.parse(contents.toString());
  }
  const data = memoryStore.get(`proj:${userId}:${projectId}:analysis:${resultId}`);
  return data ? JSON.parse(data) : null;
}

async function deleteProjectResult(userId, projectId, resultId) {
  initStorage();
  if (bucket) {
    const file = bucket.file(projectPath(userId, projectId, 'analysis', `${resultId}.json`));
    const [exists] = await file.exists();
    if (!exists) return false;
    await file.delete();
    return true;
  }
  return memoryStore.delete(`proj:${userId}:${projectId}:analysis:${resultId}`);
}

/**
 * List all distinct user IDs (for admin).
 * Scans the users/ prefix in GCS or memory store.
 */
async function listAllUsers() {
  initStorage();
  if (bucket) {
    // List all config.json files and extract user emails from path
    // Path: users/{email}/projects/{projectId}/config.json
    const [allFiles] = await bucket.getFiles({ prefix: 'users/', matchGlob: '**/config.json' });
    const userIds = new Set();
    for (const f of allFiles) {
      const parts = f.name.split('/');
      if (parts.length >= 2 && parts[0] === 'users') {
        // Email may contain dots/@ so reconstruct from path
        // Path structure: users/{email}/projects/{projectId}/config.json
        // The email is everything between 'users/' and '/projects/'
        const match = f.name.match(/^users\/(.+?)\/projects\//);
        if (match) userIds.add(match[1]);
      }
    }
    return Array.from(userIds).sort();
  }

  // Memory fallback
  const userIds = new Set();
  for (const key of memoryStore.keys()) {
    if (key.startsWith('proj:')) {
      const parts = key.split(':');
      if (parts.length >= 2) userIds.add(parts[1]);
    }
  }
  return Array.from(userIds).sort();
}

/**
 * Transfer a project from one user to another.
 * Copies all files under the old user path to the new user path, then deletes the old ones.
 */
async function transferProject(fromUserId, toUserId, projectId) {
  initStorage();
  if (fromUserId === toUserId) return true;

  if (bucket) {
    const oldPrefix = projectPath(fromUserId, projectId) + '/';
    const newPrefix = projectPath(toUserId, projectId) + '/';
    const [files] = await bucket.getFiles({ prefix: oldPrefix });
    if (files.length === 0) return false;
    // Copy all files to new path
    await Promise.all(files.map(async (f) => {
      const newName = f.name.replace(oldPrefix, newPrefix);
      await f.copy(newName);
    }));
    // Delete old files
    await Promise.all(files.map(f => f.delete()));
    return true;
  }

  // Memory fallback: re-key all entries
  const oldPrefix = `proj:${fromUserId}:${projectId}:`;
  const newPrefix = `proj:${toUserId}:${projectId}:`;
  const keys = Array.from(memoryStore.keys()).filter(k => k.startsWith(oldPrefix));
  if (keys.length === 0) return false;
  for (const k of keys) {
    const val = memoryStore.get(k);
    memoryStore.set(k.replace(oldPrefix, newPrefix), val);
    memoryStore.delete(k);
  }
  return true;
}

/**
 * Migrate existing GCS data from old layout to new layout.
 * Old: users/{sanitized-id}/projects/{id}/meta.json, .../files/..., .../results/...
 * New: users/{email}/projects/{id}/config.json, .../documents/..., .../analysis/...
 * Returns { migrated, skipped, errors }
 */
async function migrateStorageLayout() {
  initStorage();
  if (!bucket) return { migrated: 0, skipped: 0, errors: 0, message: 'No GCS bucket — in-memory store needs no migration' };

  const stats = { migrated: 0, skipped: 0, errors: 0, details: [] };

  // Find all files under users/ with old layout markers
  const [allFiles] = await bucket.getFiles({ prefix: 'users/' });

  for (const f of allFiles) {
    let newName = f.name;
    let needsMove = false;

    // 1. Convert sanitized userId (contains -at- and -) back to email
    const userMatch = f.name.match(/^users\/([^/]+)\//);
    if (userMatch) {
      const userId = userMatch[1];
      if (userId.includes('-at-')) {
        const email = userId.replace(/-at-/g, '@').replace(/-/g, '.');
        newName = newName.replace(`users/${userId}/`, `users/${email}/`);
        needsMove = true;
      }
    }

    // 2. Rename folder segments
    if (newName.includes('/files/')) {
      newName = newName.replace('/files/', '/documents/');
      needsMove = true;
    }
    if (newName.includes('/results/')) {
      newName = newName.replace('/results/', '/analysis/');
      needsMove = true;
    }
    // 3. Rename project config file (only the project-level meta.json, not file .meta.json)
    if (newName.endsWith('/meta.json') && !newName.includes('/documents/') && !newName.includes('/files/')) {
      newName = newName.replace(/\/meta\.json$/, '/config.json');
      needsMove = true;
    }

    if (!needsMove) {
      stats.skipped++;
      continue;
    }

    try {
      await f.copy(newName);
      await f.delete();
      stats.migrated++;
      stats.details.push(`${f.name} → ${newName}`);
    } catch (err) {
      stats.errors++;
      stats.details.push(`ERROR ${f.name}: ${err.message}`);
    }
  }

  return stats;
}

// ─── Per-project usage log ───────────────────────────────────────────────────
// Stored at: users/{email}/projects/{projectId}/usage.json
// Structure: { entries: [{ timestamp, action, fileName, tokens: {prompt,completion}, cost, model }], totals: { ... } }
//
// Usage entries are buffered in memory and flushed to GCS in a single write
// to avoid hitting GCS per-object mutation rate limits (~1/sec).

const EMPTY_USAGE = () => ({ entries: [], totals: { promptTokens: 0, completionTokens: 0, totalTokens: 0, totalCost: 0, calls: 0 } });

// In-memory buffer: key = "userId:projectId", value = [entry, ...]
const usageBuffer = new Map();
const usageFlushTimers = new Map();
const USAGE_FLUSH_DELAY_MS = 5000; // flush 5s after last write

async function loadProjectUsage(userId, projectId) {
  initStorage();
  let usage;
  if (bucket) {
    const file = bucket.file(projectPath(userId, projectId, 'usage.json'));
    const [exists] = await file.exists();
    if (!exists) usage = EMPTY_USAGE();
    else { const [contents] = await file.download(); usage = JSON.parse(contents.toString()); }
  } else {
    const data = memoryStore.get(`proj:${userId}:${projectId}:usage`);
    usage = data ? JSON.parse(data) : EMPTY_USAGE();
  }
  // Merge any buffered entries not yet flushed
  const bufKey = `${userId}:${projectId}`;
  const pending = usageBuffer.get(bufKey);
  if (pending && pending.length > 0) {
    for (const entry of pending) {
      usage.entries.push(entry);
      usage.totals.promptTokens += entry.tokens?.prompt || 0;
      usage.totals.completionTokens += entry.tokens?.completion || 0;
      usage.totals.totalTokens += (entry.tokens?.prompt || 0) + (entry.tokens?.completion || 0);
      usage.totals.totalCost += entry.cost || 0;
      usage.totals.calls++;
    }
  }
  return usage;
}

function appendProjectUsage(userId, projectId, entry) {
  const bufKey = `${userId}:${projectId}`;
  if (!usageBuffer.has(bufKey)) usageBuffer.set(bufKey, []);
  usageBuffer.get(bufKey).push(entry);

  // Debounce: reset the flush timer so we batch writes
  if (usageFlushTimers.has(bufKey)) clearTimeout(usageFlushTimers.get(bufKey));
  usageFlushTimers.set(bufKey, setTimeout(() => flushProjectUsage(userId, projectId), USAGE_FLUSH_DELAY_MS));
}

async function flushProjectUsage(userId, projectId) {
  const bufKey = `${userId}:${projectId}`;
  const pending = usageBuffer.get(bufKey);
  if (!pending || pending.length === 0) return;
  usageBuffer.delete(bufKey);
  usageFlushTimers.delete(bufKey);

  try {
    initStorage();
    // Load existing usage from storage (not from loadProjectUsage to avoid re-merging buffer)
    let usage;
    if (bucket) {
      const file = bucket.file(projectPath(userId, projectId, 'usage.json'));
      const [exists] = await file.exists();
      if (!exists) usage = EMPTY_USAGE();
      else { const [contents] = await file.download(); usage = JSON.parse(contents.toString()); }
    } else {
      const data = memoryStore.get(`proj:${userId}:${projectId}:usage`);
      usage = data ? JSON.parse(data) : EMPTY_USAGE();
    }

    // Merge buffered entries
    for (const entry of pending) {
      usage.entries.push(entry);
      usage.totals.promptTokens += entry.tokens?.prompt || 0;
      usage.totals.completionTokens += entry.tokens?.completion || 0;
      usage.totals.totalTokens += (entry.tokens?.prompt || 0) + (entry.tokens?.completion || 0);
      usage.totals.totalCost += entry.cost || 0;
      usage.totals.calls++;
    }

    const payload = JSON.stringify(usage);
    if (bucket) {
      await bucket.file(projectPath(userId, projectId, 'usage.json')).save(payload, { contentType: 'application/json' });
    } else {
      memoryStore.set(`proj:${userId}:${projectId}:usage`, payload);
    }
    console.log(`[USAGE] Flushed ${pending.length} entries for ${userId}/${projectId}`);
  } catch (err) {
    console.error(`[USAGE] Flush failed for ${userId}/${projectId}:`, err.message);
    // Re-buffer entries for next attempt
    const existing = usageBuffer.get(bufKey) || [];
    usageBuffer.set(bufKey, [...pending, ...existing]);
    usageFlushTimers.set(bufKey, setTimeout(() => flushProjectUsage(userId, projectId), USAGE_FLUSH_DELAY_MS * 2));
  }
}

/** Flush all pending usage buffers immediately (e.g. on shutdown) */
async function flushAllUsage() {
  const promises = [];
  for (const [bufKey] of usageBuffer) {
    const [userId, projectId] = bufKey.split(':');
    promises.push(flushProjectUsage(userId, projectId));
  }
  await Promise.allSettled(promises);
}

// ─── Admin audit log ─────────────────────────────────────────────────────────
// Stored at: admin/audit/{YYYY-MM}/{userId}/{projectId}/{timestamp}-{seq}.json
// Contains full LLM interactions: system prompt, user prompt, response, tokens, context
//
// Audit entries are buffered and flushed in batches to avoid overwhelming GCS.

const auditBuffer = [];
let auditFlushTimer = null;
const AUDIT_FLUSH_DELAY_MS = 3000;
const AUDIT_FLUSH_MAX = 50; // flush if buffer reaches this size

function saveAuditEntry(entry) {
  auditBuffer.push(entry);
  // Flush immediately if buffer is large, otherwise debounce
  if (auditBuffer.length >= AUDIT_FLUSH_MAX) {
    flushAuditBuffer();
  } else if (!auditFlushTimer) {
    auditFlushTimer = setTimeout(flushAuditBuffer, AUDIT_FLUSH_DELAY_MS);
  }
}

async function flushAuditBuffer() {
  if (auditFlushTimer) { clearTimeout(auditFlushTimer); auditFlushTimer = null; }
  if (auditBuffer.length === 0) return;
  const batch = auditBuffer.splice(0);
  initStorage();

  let saved = 0;
  // Write each entry to its own file (different paths, no rate limit issue)
  await Promise.allSettled(batch.map(async (entry) => {
    try {
      const date = new Date(entry.timestamp || Date.now());
      const month = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const userId = entry.userId || 'anonymous';
      const projectId = entry.projectId || '_standalone';
      const ts = date.toISOString().replace(/[:.]/g, '-');
      const seq = String(Math.random()).slice(2, 8);
      const auditPath = `admin/audit/${month}/${userId}/${projectId}/${ts}-${seq}.json`;
      const payload = JSON.stringify(entry);
      if (bucket) {
        await bucket.file(auditPath).save(payload, { contentType: 'application/json' });
      } else {
        memoryStore.set(`audit:${auditPath}`, payload);
      }
      saved++;
    } catch (err) {
      console.error('[AUDIT] Failed to save entry:', err.message);
    }
  }));
  if (saved > 0) console.log(`[AUDIT] Flushed ${saved}/${batch.length} entries`);
}

async function listAuditEntries({ userId, projectId, month } = {}) {
  initStorage();
  let prefix = 'admin/audit/';
  if (month) prefix += `${month}/`;
  if (month && userId) prefix += `${userId}/`;
  if (month && userId && projectId) prefix += `${projectId}/`;

  if (bucket) {
    const [files] = await bucket.getFiles({ prefix });
    return files
      .filter(f => f.name.endsWith('.json'))
      .map(f => ({
        path: f.name,
        size: parseInt(f.metadata.size, 10) || 0,
        updated: f.metadata.updated || f.metadata.timeCreated,
      }))
      .sort((a, b) => new Date(b.updated) - new Date(a.updated));
  }
  return Array.from(memoryStore.keys())
    .filter(k => k.startsWith(`audit:${prefix}`))
    .map(k => ({ path: k.replace('audit:', ''), size: 0, updated: new Date().toISOString() }));
}

async function loadAuditEntry(auditPath) {
  initStorage();
  if (bucket) {
    const file = bucket.file(auditPath);
    const [exists] = await file.exists();
    if (!exists) return null;
    const [contents] = await file.download();
    return JSON.parse(contents.toString());
  }
  const data = memoryStore.get(`audit:${auditPath}`);
  return data ? JSON.parse(data) : null;
}

module.exports = {
  saveResult, loadResult, saveUpload, listResults, deleteResult,
  listDocuments, saveDocument, loadDocument, deleteDocument,
  getUserId,
  listProjects, getProject, saveProject, deleteProject,
  listProjectFiles, saveProjectFile, loadProjectFile, deleteProjectFile,
  saveProjectFileMeta, loadProjectFileMeta,
  listProjectResults, saveProjectResult, loadProjectResult, deleteProjectResult,
  listAllUsers, transferProject, migrateStorageLayout,
  loadProjectUsage, appendProjectUsage, flushProjectUsage, flushAllUsage,
  saveAuditEntry, listAuditEntries, loadAuditEntry, flushAuditBuffer,
};
