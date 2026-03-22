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

module.exports = {
  saveResult, loadResult, saveUpload, listResults, deleteResult,
  listDocuments, saveDocument, loadDocument, deleteDocument,
};
