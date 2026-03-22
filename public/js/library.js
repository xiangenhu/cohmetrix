/**
 * Library — Document library panel backed by GCS.
 * Allows browsing, selecting, uploading, and deleting documents.
 */
const Library = (() => {
  let documents = [];
  let selectedDoc = null;
  let isOpen = false;
  let isLoaded = false;

  const FILE_ICONS = {
    '.txt': '&#128196;',
    '.docx': '&#128195;',
    '.pdf': '&#128213;',
  };

  function init() {
    const header = document.getElementById('library-header');
    if (header) {
      header.addEventListener('click', toggle);
    }

    const uploadBtn = document.getElementById('lib-upload-btn');
    if (uploadBtn) {
      uploadBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        document.getElementById('lib-file-input').click();
      });
    }

    const fileInput = document.getElementById('lib-file-input');
    if (fileInput) {
      fileInput.addEventListener('change', () => {
        if (fileInput.files.length) uploadFile(fileInput.files[0]);
        fileInput.value = '';
      });
    }

    const refreshBtn = document.getElementById('lib-refresh-btn');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        loadDocuments();
      });
    }
  }

  function toggle() {
    isOpen = !isOpen;
    const panel = document.getElementById('library-panel');
    panel.classList.toggle('open', isOpen);
    if (isOpen && !isLoaded) {
      loadDocuments();
    }
  }

  async function loadDocuments() {
    const body = document.getElementById('library-body');
    const badge = document.getElementById('library-badge');
    body.innerHTML = '<div class="library-loading">Loading documents…</div>';

    try {
      const resp = await fetch('/api/documents');
      if (!resp.ok) throw new Error('Failed to load');
      const data = await resp.json();
      documents = data.documents || [];
      isLoaded = true;
      badge.textContent = documents.length;
      renderList();
    } catch (err) {
      body.innerHTML = `<div class="library-empty">Failed to load documents</div>`;
      console.error('Library load error:', err);
    }
  }

  function renderList() {
    const body = document.getElementById('library-body');

    if (documents.length === 0) {
      body.innerHTML = `
        <div class="library-toolbar">
          <button class="lib-upload-btn" id="lib-upload-btn-inner">
            <span>&#8593;</span> Upload to library
          </button>
          <button class="lib-refresh-btn" id="lib-refresh-btn-inner">&#8635; Refresh</button>
        </div>
        <div class="library-empty">No documents yet. Upload a file to get started.</div>`;
      bindToolbarInner();
      return;
    }

    const items = documents.map((doc, i) => {
      const icon = FILE_ICONS[doc.ext] || '&#128196;';
      const date = doc.updated ? formatDate(doc.updated) : '';
      const isSelected = selectedDoc && selectedDoc.path === doc.path;
      return `
        <div class="lib-file${isSelected ? ' selected' : ''}" data-idx="${i}">
          <div class="lib-file-icon">${icon}</div>
          <div class="lib-file-info">
            <div class="lib-file-name">${escapeHtml(doc.name)}</div>
            <div class="lib-file-meta">${doc.sizeLabel} · ${date}</div>
          </div>
          <div class="lib-file-actions">
            <button class="lib-action-btn delete" data-idx="${i}" title="Delete">&#10005;</button>
          </div>
        </div>`;
    }).join('');

    body.innerHTML = `
      <div class="library-toolbar">
        <button class="lib-upload-btn" id="lib-upload-btn-inner">
          <span>&#8593;</span> Upload to library
        </button>
        <button class="lib-refresh-btn" id="lib-refresh-btn-inner">&#8635; Refresh</button>
      </div>
      ${items}`;

    // Bind click handlers
    body.querySelectorAll('.lib-file').forEach(el => {
      el.addEventListener('click', (e) => {
        if (e.target.closest('.lib-action-btn')) return;
        selectDocument(parseInt(el.dataset.idx, 10));
      });
    });

    body.querySelectorAll('.lib-action-btn.delete').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        deleteDocument(parseInt(btn.dataset.idx, 10));
      });
    });

    bindToolbarInner();
  }

  function bindToolbarInner() {
    const uploadBtn = document.getElementById('lib-upload-btn-inner');
    if (uploadBtn) {
      uploadBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        document.getElementById('lib-file-input').click();
      });
    }
    const refreshBtn = document.getElementById('lib-refresh-btn-inner');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        loadDocuments();
      });
    }
  }

  async function selectDocument(idx) {
    const doc = documents[idx];
    if (!doc) return;

    selectedDoc = doc;
    renderList();

    // Extract text from the selected document
    const textarea = document.getElementById('essay-text');
    const dropTitle = document.getElementById('drop-title');
    const dropSub = document.getElementById('drop-sub');

    dropTitle.textContent = doc.name;
    dropSub.textContent = `${doc.sizeLabel} · Loading text…`;
    textarea.value = '';
    textarea.placeholder = 'Loading document text…';

    try {
      const resp = await fetch(`/api/documents/content/${encodeURIComponent(doc.name)}?extract=true`);
      if (!resp.ok) throw new Error('Extract failed');
      const data = await resp.json();
      textarea.value = data.text;
      textarea.placeholder = 'Paste essay content here...';
      dropSub.textContent = `${doc.sizeLabel} · Text loaded from library`;
    } catch (err) {
      dropSub.textContent = `${doc.sizeLabel} · Failed to extract text`;
      console.error('Extract error:', err);
    }
  }

  async function uploadFile(file) {
    const ext = '.' + file.name.split('.').pop().toLowerCase();
    if (!['.txt', '.docx', '.pdf'].includes(ext)) {
      alert('Unsupported format. Use .txt, .docx, or .pdf');
      return;
    }

    const formData = new FormData();
    formData.append('file', file);

    try {
      const resp = await fetch('/api/documents', {
        method: 'POST',
        body: formData,
      });
      if (!resp.ok) {
        const err = await resp.json();
        throw new Error(err.error || 'Upload failed');
      }
      await loadDocuments();
    } catch (err) {
      alert('Upload failed: ' + err.message);
    }
  }

  async function deleteDocument(idx) {
    const doc = documents[idx];
    if (!doc) return;
    if (!confirm(`Delete "${doc.name}"?`)) return;

    try {
      const resp = await fetch(`/api/documents/${encodeURIComponent(doc.name)}`, { method: 'DELETE' });
      if (!resp.ok) throw new Error('Delete failed');
      if (selectedDoc && selectedDoc.path === doc.path) {
        selectedDoc = null;
      }
      await loadDocuments();
    } catch (err) {
      alert('Delete failed: ' + err.message);
    }
  }

  /**
   * Save a file to the library (called after upload+analyze if "save to library" is checked).
   */
  async function saveFileToLibrary(file) {
    const formData = new FormData();
    formData.append('file', file);
    try {
      await fetch('/api/documents', { method: 'POST', body: formData });
      if (isLoaded) loadDocuments();
    } catch (err) {
      console.error('Save to library failed:', err);
    }
  }

  function getSelected() { return selectedDoc; }

  function formatDate(str) {
    try {
      const d = new Date(str);
      return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) +
        ' ' + d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
    } catch { return ''; }
  }

  function escapeHtml(s) {
    const div = document.createElement('div');
    div.textContent = s;
    return div.innerHTML;
  }

  return { init, loadDocuments, getSelected, saveFileToLibrary };
})();
