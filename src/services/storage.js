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
  return (user.email || 'anonymous').replace(/@/g, '-at-').replace(/\./g, '-');
}

function projectPath(userId, projectId, ...parts) {
  return ['users', userId, 'projects', projectId, ...parts].join('/');
}

async function listProjects(userId) {
  initStorage();
  const prefix = `users/${userId}/projects/`;

  if (bucket) {
    const [files] = await bucket.getFiles({ prefix, matchGlob: '**/meta.json' });
    const projects = [];
    for (const f of files) {
      if (!f.name.endsWith('/meta.json')) continue;
      try {
        const [contents] = await f.download();
        projects.push(JSON.parse(contents.toString()));
      } catch { /* skip corrupt */ }
    }
    return projects.sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0));
  }

  // Memory fallback
  return Array.from(memoryStore.entries())
    .filter(([k]) => k.startsWith(`proj:${userId}:`) && k.endsWith(':meta'))
    .map(([, v]) => JSON.parse(v))
    .sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0));
}

async function getProject(userId, projectId) {
  initStorage();
  if (bucket) {
    const file = bucket.file(projectPath(userId, projectId, 'meta.json'));
    const [exists] = await file.exists();
    if (!exists) return null;
    const [contents] = await file.download();
    return JSON.parse(contents.toString());
  }
  const data = memoryStore.get(`proj:${userId}:${projectId}:meta`);
  return data ? JSON.parse(data) : null;
}

async function saveProject(userId, projectId, meta) {
  initStorage();
  const payload = JSON.stringify(meta);
  if (bucket) {
    await bucket.file(projectPath(userId, projectId, 'meta.json')).save(payload, { contentType: 'application/json' });
  } else {
    memoryStore.set(`proj:${userId}:${projectId}:meta`, payload);
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
  const prefix = projectPath(userId, projectId, 'files') + '/';
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
  const pfx = `proj:${userId}:${projectId}:file:`;
  return Array.from(memoryStore.entries())
    .filter(([k]) => k.startsWith(pfx))
    .map(([k, v]) => {
      const entry = typeof v === 'string' ? JSON.parse(v) : v;
      return { name: k.replace(pfx, ''), size: entry.buffer ? entry.buffer.length : 0, updated: entry.updated || new Date().toISOString(), contentType: entry.contentType || 'application/octet-stream' };
    });
}

async function saveProjectFile(userId, projectId, filename, buffer, contentType) {
  initStorage();
  const filePath = projectPath(userId, projectId, 'files', filename);
  if (bucket) {
    await bucket.file(filePath).save(buffer, { contentType: contentType || 'application/octet-stream' });
    return filePath;
  }
  memoryStore.set(`proj:${userId}:${projectId}:file:${filename}`, { buffer, contentType, updated: new Date().toISOString() });
  return filePath;
}

async function loadProjectFile(userId, projectId, filename) {
  initStorage();
  if (bucket) {
    const file = bucket.file(projectPath(userId, projectId, 'files', filename));
    const [exists] = await file.exists();
    if (!exists) return null;
    const [buffer] = await file.download();
    const [metadata] = await file.getMetadata();
    return { buffer, contentType: metadata.contentType, name: filename };
  }
  const entry = memoryStore.get(`proj:${userId}:${projectId}:file:${filename}`);
  if (!entry) return null;
  return { buffer: entry.buffer, contentType: entry.contentType, name: filename };
}

async function saveProjectFileMeta(userId, projectId, filename, meta) {
  initStorage();
  const payload = JSON.stringify(meta);
  const metaPath = projectPath(userId, projectId, 'files', filename + '.meta.json');
  if (bucket) {
    await bucket.file(metaPath).save(payload, { contentType: 'application/json' });
  } else {
    memoryStore.set(`proj:${userId}:${projectId}:filemeta:${filename}`, payload);
  }
}

async function loadProjectFileMeta(userId, projectId, filename) {
  initStorage();
  if (bucket) {
    const file = bucket.file(projectPath(userId, projectId, 'files', filename + '.meta.json'));
    const [exists] = await file.exists();
    if (!exists) return null;
    const [contents] = await file.download();
    return JSON.parse(contents.toString());
  }
  const data = memoryStore.get(`proj:${userId}:${projectId}:filemeta:${filename}`);
  return data ? JSON.parse(data) : null;
}

async function deleteProjectFile(userId, projectId, filename) {
  initStorage();
  // Also delete metadata file
  if (bucket) {
    const file = bucket.file(projectPath(userId, projectId, 'files', filename));
    const [exists] = await file.exists();
    if (!exists) return false;
    await file.delete();
    const metaFile = bucket.file(projectPath(userId, projectId, 'files', filename + '.meta.json'));
    const [metaExists] = await metaFile.exists();
    if (metaExists) await metaFile.delete();
    return true;
  }
  memoryStore.delete(`proj:${userId}:${projectId}:filemeta:${filename}`);
  return memoryStore.delete(`proj:${userId}:${projectId}:file:${filename}`);
}

async function listProjectResults(userId, projectId) {
  initStorage();
  const prefix = projectPath(userId, projectId, 'results') + '/';
  if (bucket) {
    const [files] = await bucket.getFiles({ prefix });
    return files.filter(f => f.name.endsWith('.json')).map(f => ({
      id: f.name.split('/').pop().replace('.json', ''),
      size: parseInt(f.metadata.size, 10) || 0,
      updated: f.metadata.updated || f.metadata.timeCreated,
    })).sort((a, b) => new Date(b.updated) - new Date(a.updated));
  }
  const pfx = `proj:${userId}:${projectId}:result:`;
  return Array.from(memoryStore.keys())
    .filter(k => k.startsWith(pfx))
    .map(k => ({ id: k.replace(pfx, ''), size: 0, updated: new Date().toISOString() }));
}

async function saveProjectResult(userId, projectId, resultId, data) {
  initStorage();
  const payload = JSON.stringify(data);
  if (bucket) {
    await bucket.file(projectPath(userId, projectId, 'results', `${resultId}.json`)).save(payload, { contentType: 'application/json' });
  } else {
    memoryStore.set(`proj:${userId}:${projectId}:result:${resultId}`, payload);
  }
}

async function loadProjectResult(userId, projectId, resultId) {
  initStorage();
  if (bucket) {
    const file = bucket.file(projectPath(userId, projectId, 'results', `${resultId}.json`));
    const [exists] = await file.exists();
    if (!exists) return null;
    const [contents] = await file.download();
    return JSON.parse(contents.toString());
  }
  const data = memoryStore.get(`proj:${userId}:${projectId}:result:${resultId}`);
  return data ? JSON.parse(data) : null;
}

async function deleteProjectResult(userId, projectId, resultId) {
  initStorage();
  if (bucket) {
    const file = bucket.file(projectPath(userId, projectId, 'results', `${resultId}.json`));
    const [exists] = await file.exists();
    if (!exists) return false;
    await file.delete();
    return true;
  }
  return memoryStore.delete(`proj:${userId}:${projectId}:result:${resultId}`);
}

/**
 * List all distinct user IDs (for admin).
 * Scans the users/ prefix in GCS or memory store.
 */
async function listAllUsers() {
  initStorage();
  if (bucket) {
    const [files] = await bucket.getFiles({ prefix: 'users/', delimiter: '/' });
    // With delimiter, apiResponse.prefixes has user folders
    // But GCS getFiles with delimiter doesn't return prefixes in files array.
    // Instead, list all meta.json files and extract user IDs.
    const [allFiles] = await bucket.getFiles({ prefix: 'users/', matchGlob: '**/meta.json' });
    const userIds = new Set();
    for (const f of allFiles) {
      // Path: users/{userId}/projects/{projectId}/meta.json
      const parts = f.name.split('/');
      if (parts.length >= 2 && parts[0] === 'users') {
        userIds.add(parts[1]);
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

module.exports = {
  saveResult, loadResult, saveUpload, listResults, deleteResult,
  listDocuments, saveDocument, loadDocument, deleteDocument,
  getUserId,
  listProjects, getProject, saveProject, deleteProject,
  listProjectFiles, saveProjectFile, loadProjectFile, deleteProjectFile,
  saveProjectFileMeta, loadProjectFileMeta,
  listProjectResults, saveProjectResult, loadProjectResult, deleteProjectResult,
  listAllUsers,
};
