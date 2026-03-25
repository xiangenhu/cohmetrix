/**
 * Projects — Project-based file management with step-by-step workflow.
 *
 * Workflow (one step at a time, full screen each):
 *   Step 0: Project Home — Choose "New Analysis" or "Open Existing"
 *   Step 1: Select files
 *   Step 2: Configure layers & options
 *   Step 3: Review & estimate cost → confirm to run
 *   Step 4: Processing (uses existing processing screen)
 *   Step 5: Done — link to results
 *
 *   Alt path: Browse past results → open one
 */
const Projects = (() => {
  let projects = [];
  let currentProject = null;
  let currentFiles = [];
  let currentResults = [];

  // Wizard state
  let selectedFiles = [];
  let wizardConfig = {};

  // Background batch analysis state
  // { projectId, files: [name,...], progress: { name: { status, pct, score, error } }, totalFiles, doneCount }
  let batchState = null;

  function init() {
    loadProjects();
  }

  // ═══════════════════════════════════════════════════════════════════════
  // PROJECT LIST (accordion in upload screen)
  // ═══════════════════════════════════════════════════════════════════════

  async function loadProjects() {
    try {
      const resp = await Auth.apiFetch('/api/projects');
      if (!resp.ok) return;
      projects = (await resp.json()).projects || [];
      renderProjectList();
    } catch {}
  }

  function renderProjectList() {
    const body = document.getElementById('projects-body');
    if (!body) return;
    const badge = document.getElementById('projects-badge');
    if (badge) badge.textContent = projects.length;

    body.innerHTML = projects.map(p => `
      <div class="proj-item" data-id="${p.id}">
        <span class="proj-item-icon">&#128194;</span>
        <div class="proj-item-info">
          <div class="proj-item-name">${esc(p.name)}</div>
          <div class="proj-item-meta">${p.fileCount||0} files · ${p.resultCount||0} results</div>
        </div>
        <button class="proj-item-del" data-del="${p.id}" title="Delete">&#10005;</button>
      </div>
    `).join('') + `
      <div class="proj-create-row">
        <input class="proj-create-input" id="proj-create-input" placeholder="New project name…" data-i18n-placeholder="6c6a959bab27ef7a">
        <button class="proj-create-btn" id="proj-create-btn" data-i18n="4759498ac2a719c6">Create</button>
      </div>`;

    body.querySelectorAll('.proj-item').forEach(el => {
      el.addEventListener('click', (e) => {
        if (e.target.closest('.proj-item-del')) return;
        openProject(el.dataset.id);
      });
    });
    body.querySelectorAll('[data-del]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (confirm('Delete this project and all its files/results?')) deleteProject(btn.dataset.del);
      });
    });
    const cb = document.getElementById('proj-create-btn');
    const ci = document.getElementById('proj-create-input');
    if (cb) cb.addEventListener('click', createProject);
    if (ci) ci.addEventListener('keydown', (e) => { if (e.key === 'Enter') createProject(); });
  }

  async function createProject() {
    const input = document.getElementById('proj-create-input');
    const name = input ? input.value.trim() : '';
    if (!name) return;
    try {
      const resp = await Auth.apiFetch('/api/projects', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      if (resp.ok) { input.value = ''; await loadProjects(); openProject((await resp.json()).project?.id); }
    } catch {}
  }

  async function deleteProject(id) {
    try { await Auth.apiFetch(`/api/projects/${id}`, { method: 'DELETE' }); loadProjects(); } catch {}
  }

  // ═══════════════════════════════════════════════════════════════════════
  // OPEN PROJECT → loads data, shows Step 0
  // ═══════════════════════════════════════════════════════════════════════

  async function openProject(id) {
    if (!id) return;
    try {
      const resp = await Auth.apiFetch(`/api/projects/${id}`);
      if (!resp.ok) return;
      const data = await resp.json();
      currentProject = data.project;
      currentFiles = data.files || [];
      currentResults = data.results || [];
      selectedFiles = [];
      wizardConfig = { ...(currentProject.config || {}) };
      App.showScreen('project');
      renderStep0();
    } catch {}
  }

  async function refreshProject() {
    if (!currentProject) return;
    try {
      const resp = await Auth.apiFetch(`/api/projects/${currentProject.id}`);
      if (!resp.ok) return;
      const d = await resp.json();
      currentProject = d.project;
      currentFiles = d.files || [];
      currentResults = d.results || [];
    } catch {}
  }

  // ═══════════════════════════════════════════════════════════════════════
  // STEP 0: Project Home — two choices
  // ═══════════════════════════════════════════════════════════════════════

  function fileExt(name) { return name.split('.').pop().toUpperCase(); }

  function latestResultForFile(fileName) {
    return currentResults.find(r => r.sourceFile === fileName) || null;
  }

  function metaStatus(meta) {
    const mc = countMetaFields(meta);
    if (mc.filled === 0) return { label: '<span data-i18n="ec4f5d68e5c68d2e">No metadata</span>', cls: 'status-none', icon: '\u25cb' };
    if (mc.filled < 4) return { label: `${mc.filled}/${mc.total}`, cls: 'status-partial', icon: '\u25d4' };
    if (mc.filled < 8) return { label: `${mc.filled}/${mc.total}`, cls: 'status-good', icon: '\u25d4' };
    return { label: `${mc.filled}/${mc.total}`, cls: 'status-ready', icon: '\u25cf' };
  }

  function configStatus() {
    const cfg = currentProject?.config || {};
    const has = (v) => v && v.length > 0;
    const layers = (cfg.enabledLayers || []).length;
    if (layers === 0) return { ready: false, label: '<span data-i18n="f92519230b09a0d8">No layers selected</span>' };
    return { ready: true, label: `${layers} <span data-i18n="3d7db37d08f9140f">layers</span>` + (has(cfg.genre) ? ', <span data-i18n="ea33992457c4a2c1">genre set</span>' : '') + (has(cfg.promptText) ? ', <span data-i18n="b9ff9ed1c6cb3d29">prompt set</span>' : '') };
  }

  function renderStep0() {
    const s = screen();
    const readyFiles = currentFiles.filter(f => countMetaFields(f.meta).filled >= 4);
    const noMetaFiles = currentFiles.filter(f => countMetaFields(f.meta).filled === 0);
    const cfgSt = configStatus();
    const batchRunning = batchState && batchState.projectId === currentProject.id;
    const canAnalyze = readyFiles.length > 0 && cfgSt.ready && !batchRunning;

    s.innerHTML = `
      ${header('&larr; <span data-i18n="193a6d1722fc259d">Projects</span>', currentProject.name)}
      <div class="proj-step-body">

        <!-- ═══ WORKFLOW HELP BANNER ═══ -->
        ${!localStorage.getItem('proj-help-dismissed') ? `
        <div class="proj-help-banner" id="proj-help-banner">
          <div style="display:flex;align-items:flex-start;gap:10px">
            <span style="font-size:16px;line-height:1">&#128161;</span>
            <div style="flex:1;font-size:12px;line-height:1.6;color:var(--text-secondary)">
              <strong style="color:var(--text-primary)">Getting started:</strong>
              <span style="color:var(--teal)">&#10102;</span> Upload files using <strong>+ Upload</strong> or <strong>Drive</strong>
              &rarr; <span style="color:var(--teal)">&#10103;</span> Click a file's <strong>Metadata</strong> cell to add context (or use <strong>Auto-detect All</strong> to fill automatically)
              &rarr; <span style="color:var(--teal)">&#10104;</span> Select files with checkboxes
              &rarr; <span style="color:var(--teal)">&#10105;</span> Click <strong>Analyze</strong>
            </div>
            <button id="proj-help-dismiss" style="background:none;border:none;color:var(--text-tertiary);cursor:pointer;font-size:14px;padding:0;line-height:1" title="Dismiss">&times;</button>
          </div>
        </div>` : ''}

        <!-- ═══ FILES TABLE with selection ═══ -->
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
          <div style="font-size:15px;font-weight:600;color:var(--text-primary)" data-i18n="abc7e9892806b047">Files</div>
          <span style="font-size:11px;color:var(--text-tertiary)">${currentFiles.length} <span data-i18n="e8353a02697faf99">total,</span> ${readyFiles.length} <span data-i18n="d72b47966b9e026b">ready</span></span>
          <div style="margin-left:auto;display:flex;gap:6px">
            ${noMetaFiles.length > 0 ? `<button class="proj-upload-btn" id="proj-autodetect-all" style="background:var(--bg-primary);color:var(--amber);border:0.5px solid var(--amber);font-size:11px" title="Auto-detect metadata for all files without metadata">&#9733; Auto-detect All</button>` : ''}
            <button class="proj-upload-btn" id="proj-upload-trigger"><span data-i18n="51d77b5cf7a49bdc">+ Upload</span></button>
            <button class="proj-upload-btn" id="proj-drive-trigger" style="background:var(--bg-primary);color:var(--text-secondary);border:0.5px solid var(--border-secondary)">&#9729; <span data-i18n="6312b4b9baf12770">Drive</span></button>
          </div>
          <input type="file" id="proj-file-input" accept=".txt,.docx,.pdf" multiple hidden>
        </div>

        ${currentFiles.length > 0 ? `
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
          <label style="font-size:11px;color:var(--text-secondary);cursor:pointer">
            <input type="checkbox" id="proj-sel-all" ${readyFiles.length > 0 && readyFiles.length === currentFiles.length ? '' : ''}> <span data-i18n="cdaf59212fc41a98">Select all ready</span>
          </label>
          <span style="font-size:11px;color:var(--text-tertiary)" id="proj-sel-count">0 <span data-i18n="d7cbbb688b2e506c">selected</span></span>
        </div>
        <table class="proj-file-table">
          <thead>
            <tr>
              <th style="width:28px"></th>
              <th data-i18n="50009ce1da4d15e1">File</th>
              <th data-i18n="baaddf70fb5d432b">Type</th>
              <th data-i18n="1af851907331c0ed">Size</th>
              <th>Lang</th>
              <th data-i18n="9eddf573cb509f1f">Metadata</th>
              <th>Score</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            ${currentFiles.map(f => {
              const mc = countMetaFields(f.meta);
              const isReady = mc.filled >= 4;
              const ms = metaStatus(f.meta);
              const metaHint = mc.filled === 0 ? '<span style="font-size:9px;color:var(--amber);margin-left:4px">Click to set up</span>' : '';
              return `<tr class="proj-file-table-row${!isReady ? ' proj-file-row-disabled' : ''}" data-editname="${escAttr(f.name)}">
                <td><input type="checkbox" class="proj-file-check" data-name="${escAttr(f.name)}" ${!isReady ? 'disabled title="Complete metadata first (min 4 fields)" data-i18n-title="408fb158f6c52c70"' : ''}></td>
                <td class="proj-ft-name">${esc(f.name)}</td>
                <td class="proj-ft-type">${fileExt(f.name)}</td>
                <td class="proj-ft-size">${f.sizeLabel || ''}</td>
                <td style="font-size:10px;font-weight:600;color:var(--text-secondary);text-transform:uppercase">${(f.meta && f.meta.language) || 'en'}</td>
                <td class="proj-ft-meta ${ms.cls}" title="Click to edit metadata"><span class="proj-ft-meta-icon">${ms.icon}</span> ${ms.label}${metaHint}</td>
                <td style="text-align:center">${(() => { const lr = latestResultForFile(f.name); return lr && lr.overallScore != null ? `<span class="proj-file-score" data-rid="${lr.id}" title="Click to view result" style="cursor:pointer;font-weight:600;font-family:var(--font-mono);font-size:12px;color:${scoreColor(lr.overallScore)}">${lr.overallScore}</span>` : '<span style="font-size:10px;color:var(--text-tertiary)">\u2014</span>'; })()}</td>
                <td style="white-space:nowrap">
                  <button class="proj-file-view" data-vname="${escAttr(f.name)}" title="View document" style="background:none;border:none;color:var(--text-tertiary);cursor:pointer;font-size:13px;padding:2px 4px">&#128065;</button>
                  <button class="proj-file-del" data-fname="${escAttr(f.name)}" title="Delete">&#10005;</button>
                </td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
        ` : `<div class="proj-empty" style="text-align:center;padding:24px 16px">
          <div style="font-size:32px;margin-bottom:8px">&#128196;</div>
          <div style="font-size:14px;font-weight:500;margin-bottom:6px" data-i18n="8507a9389fcfc601">No files yet</div>
          <div style="font-size:12px;color:var(--text-tertiary);line-height:1.6">
            Click <strong>+ Upload</strong> to add PDF, DOCX, or TXT files<br>
            or use <strong>Drive</strong> to import from Google Drive
          </div>
        </div>`}

        <!-- File metadata editor (hidden) -->
        <div id="proj-file-meta-panel" style="display:none"></div>

        <!-- Document viewer (hidden) -->
        <div id="proj-doc-viewer" style="display:none"></div>

        <!-- Google Drive import (hidden) -->
        <div id="proj-drive-panel" style="display:none">
          <div class="upload-card" style="padding:16px">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
              <div class="field-label" style="margin:0" data-i18n="8a692a48f71e6e9c">Import from Google Drive</div>
              <button id="proj-drive-close" style="background:none;border:none;color:var(--text-tertiary);cursor:pointer;font-size:16px">&times;</button>
            </div>
            <div id="proj-drive-instructions" style="font-size:12px;color:var(--text-secondary);margin-bottom:10px" data-i18n="ba3bbbe10d8bef66">Loading…</div>
            <div style="display:flex;gap:8px">
              <input type="text" id="proj-drive-url" placeholder="https://drive.google.com/drive/folders/..." style="flex:1;padding:8px 12px;border:0.5px solid var(--border-tertiary);border-radius:var(--radius-md);font-size:12px;font-family:var(--font-sans);background:var(--bg-secondary);color:var(--text-primary)">
              <button class="proj-upload-btn" id="proj-drive-list-btn" data-i18n="e700817c9d5ece14">List files</button>
            </div>
            <div id="proj-drive-files" style="margin-top:12px"></div>
          </div>
        </div>

        <!-- ═══ CONFIGURATION ═══ -->
        <div style="display:flex;align-items:center;gap:8px;margin-top:20px;margin-bottom:8px">
          <div style="font-size:15px;font-weight:600;color:var(--text-primary)" data-i18n="b332c3492d5eb10a">Configuration</div>
          <span style="font-size:11px;color:${cfgSt.ready ? 'var(--teal)' : 'var(--coral)'}">${cfgSt.label}</span>
          <button class="nav-btn" id="proj-edit-config" style="margin-left:auto;font-size:11px" data-i18n="464c4ffd019e1e96">Edit</button>
        </div>
        <div class="proj-config-preview">
          ${renderConfigPreview()}
        </div>

        <!-- ═══ ACTIONS ═══ -->
        <div style="display:flex;gap:10px;margin-top:16px;align-items:center;flex-wrap:wrap">
          <button class="run-btn" id="proj-analyze-selected" disabled style="padding:10px 28px;font-size:13px;opacity:0.5">
            &#9654; <span data-i18n="a2f94cd82e1fc10f">Analyze Selected</span>
          </button>
          ${currentFiles.length > 0 ? `
          <button class="nav-btn" id="proj-go-summary" style="font-size:12px">
            &#128202; Project Summary
          </button>` : ''}
        </div>

        <!-- ═══ ACTIVE ANALYSIS PROGRESS ═══ -->
        ${batchState && batchState.projectId === currentProject.id ? `
        <div style="margin-top:24px">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
            <div style="font-size:15px;font-weight:600;color:var(--text-primary)">Analysis In Progress</div>
          </div>
          <div id="proj-batch-progress" class="proj-batch-panel"></div>
        </div>` : ''}

        <!-- ═══ PAST RESULTS SECTION ═══ -->
        ${currentResults.length > 0 ? `
        <div style="margin-top:24px">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
            <div style="font-size:15px;font-weight:600;color:var(--text-primary)" data-i18n="04f2e6324046f8f1">Past Results</div>
            <span style="font-size:11px;color:var(--text-tertiary)">${currentResults.length} result${currentResults.length !== 1 ? 's' : ''}</span>
            <button class="nav-btn" id="proj-go-results" style="margin-left:auto;font-size:11px">View All</button>
          </div>
          <div id="proj-results-preview">
            ${currentResults.slice(0, 5).map(r => `
            <div class="proj-result-row" data-rid="${r.id}" style="cursor:pointer">
              <span class="proj-result-file">${esc(r.sourceFile || r.id)}</span>
              <span class="proj-result-score" style="color:${scoreColor(r.overallScore)}">${r.overallScore != null ? r.overallScore : '\u2014'}</span>
              <span style="font-size:10px;color:var(--text-tertiary);font-family:var(--font-mono)">${r.wordCount ? r.wordCount + 'w' : ''}</span>
              <span class="proj-result-date">${r.timestamp ? new Date(r.timestamp).toLocaleDateString() : ''}</span>
            </div>`).join('')}
            ${currentResults.length > 5 ? `<div style="text-align:center;font-size:11px;color:var(--text-tertiary);padding:6px">+${currentResults.length - 5} more</div>` : ''}
          </div>
        </div>` : ''}

        <!-- ═══ USAGE / COST ═══ -->
        <div style="margin-top:24px">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
            <div style="font-size:15px;font-weight:600;color:var(--text-primary)">LLM Usage</div>
          </div>
          <div id="proj-usage-panel" style="font-size:12px;color:var(--text-tertiary)">Loading usage data...</div>
        </div>
      </div>`;

    // Bindings
    s.querySelector('#proj-go-results')?.addEventListener('click', () => { if (currentResults.length > 0) renderResultsList(); });
    s.querySelector('#proj-go-summary')?.addEventListener('click', () => renderSummaryView());
    s.querySelector('.proj-detail-header .proj-back-btn')?.addEventListener('click', () => { App.showScreen('upload'); loadProjects(); });
    s.querySelector('#proj-edit-config')?.addEventListener('click', () => renderConfigEditor());
    s.querySelector('#proj-help-dismiss')?.addEventListener('click', () => {
      localStorage.setItem('proj-help-dismissed', '1');
      s.querySelector('#proj-help-banner')?.remove();
    });
    bindUpload(() => refreshProject().then(renderStep0));
    bindDriveImport(s);

    // If batch is active, populate progress panel
    if (batchState && batchState.projectId === currentProject.id) {
      updateBatchProgressUI();
    }

    // Result preview rows — click to open result
    s.querySelectorAll('#proj-results-preview .proj-result-row').forEach(row => {
      row.addEventListener('click', async () => {
        try {
          const resp = await Auth.apiFetch(`/api/projects/${currentProject.id}/results/${row.dataset.rid}`);
          if (!resp.ok) return;
          Results.show(await resp.json());
          App.showScreen('results');
          App.enableNav('btn-results');
        } catch {}
      });
    });

    // View document buttons
    s.querySelectorAll('.proj-file-view').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        openDocumentViewer(s, btn.dataset.vname);
      });
    });

    // Score cells — click to open result
    s.querySelectorAll('.proj-file-score').forEach(el => {
      el.addEventListener('click', async (e) => {
        e.stopPropagation();
        try {
          const resp = await Auth.apiFetch(`/api/projects/${currentProject.id}/results/${el.dataset.rid}`);
          if (!resp.ok) return;
          Results.show(await resp.json());
          App.showScreen('results');
          App.enableNav('btn-results');
        } catch {}
      });
    });

    // Auto-detect all metadata
    s.querySelector('#proj-autodetect-all')?.addEventListener('click', () => runAutoDetectAll(s));

    // Checkbox selection logic
    const analyzeBtn = s.querySelector('#proj-analyze-selected');
    const selAllCb = s.querySelector('#proj-sel-all');
    const selCountEl = s.querySelector('#proj-sel-count');

    function updateSelectionState() {
      const allChecks = s.querySelectorAll('.proj-file-check:not(:disabled)');
      const checkedChecks = s.querySelectorAll('.proj-file-check:checked');
      const count = checkedChecks.length;
      if (selCountEl) selCountEl.innerHTML = `${count} <span data-i18n="d7cbbb688b2e506c">selected</span>`;
      if (analyzeBtn) {
        analyzeBtn.disabled = count === 0 || !cfgSt.ready;
        analyzeBtn.style.opacity = (count === 0 || !cfgSt.ready) ? '0.5' : '1';
        analyzeBtn.innerHTML = count > 0 ? `\u25b6 <span data-i18n="9ad615491016a591">Analyze</span> ${count} file${count>1?'s':''}` : '\u25b6 <span data-i18n="a2f94cd82e1fc10f">Analyze Selected</span>';
      }
      if (selAllCb) {
        selAllCb.checked = allChecks.length > 0 && count === allChecks.length;
        selAllCb.indeterminate = count > 0 && count < allChecks.length;
      }
    }

    s.querySelectorAll('.proj-file-check').forEach(cb => cb.addEventListener('change', updateSelectionState));
    if (selAllCb) selAllCb.addEventListener('change', (e) => {
      s.querySelectorAll('.proj-file-check:not(:disabled)').forEach(cb => cb.checked = e.target.checked);
      updateSelectionState();
    });

    if (analyzeBtn) analyzeBtn.addEventListener('click', () => {
      selectedFiles = Array.from(s.querySelectorAll('.proj-file-check:checked')).map(c => c.dataset.name);
      if (selectedFiles.length === 0) return;
      wizardConfig = { ...(currentProject.config || {}) };
      renderStep3();
    });

    updateSelectionState();

    // Metadata cell clicks — edit metadata
    s.querySelectorAll('[data-editname] .proj-ft-meta').forEach(cell => {
      cell.style.cursor = 'pointer';
      cell.addEventListener('click', (e) => {
        e.stopPropagation();
        const row = cell.closest('[data-editname]');
        const file = currentFiles.find(f => f.name === row.dataset.editname);
        openFileMetaEditor(s, row.dataset.editname, file?.meta || {});
      });
    });

    // File delete
    s.querySelectorAll('.proj-file-del').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        await Auth.apiFetch(`/api/projects/${currentProject.id}/files/${encodeURIComponent(btn.dataset.fname)}`, { method: 'DELETE' });
        await refreshProject(); renderStep0();
      });
    });

    // Load usage data asynchronously
    loadProjectUsage(s);
  }

  async function loadProjectUsage(s) {
    const panel = s.querySelector('#proj-usage-panel');
    if (!panel || !currentProject) return;
    try {
      const resp = await Auth.apiFetch(`/api/projects/${currentProject.id}/usage`);
      if (!resp.ok) { panel.textContent = 'Unable to load usage data.'; return; }
      const usage = await resp.json();
      const t = usage.totals;
      if (t.calls === 0) {
        panel.innerHTML = '<span style="color:var(--text-tertiary)">No LLM usage yet.</span>';
        return;
      }
      panel.innerHTML = `
        <div style="display:flex;gap:16px;flex-wrap:wrap;padding:10px 12px;background:var(--bg-primary);border:0.5px solid var(--border-tertiary);border-radius:var(--radius-md)">
          <div><span style="color:var(--text-tertiary)">LLM Calls</span><div style="font-size:14px;font-weight:600;color:var(--text-primary);font-family:var(--font-mono)">${t.calls}</div></div>
          <div><span style="color:var(--text-tertiary)">Prompt Tokens</span><div style="font-size:14px;font-weight:600;color:var(--text-primary);font-family:var(--font-mono)">${t.promptTokens.toLocaleString()}</div></div>
          <div><span style="color:var(--text-tertiary)">Completion Tokens</span><div style="font-size:14px;font-weight:600;color:var(--text-primary);font-family:var(--font-mono)">${t.completionTokens.toLocaleString()}</div></div>
          <div><span style="color:var(--text-tertiary)">Total Tokens</span><div style="font-size:14px;font-weight:600;color:var(--teal);font-family:var(--font-mono)">${t.totalTokens.toLocaleString()}</div></div>
          <div><span style="color:var(--text-tertiary)">Est. Cost</span><div style="font-size:14px;font-weight:600;color:var(--amber);font-family:var(--font-mono)">$${t.totalCost.toFixed(4)}</div></div>
        </div>
        ${usage.entries.length > 0 ? `<div style="margin-top:8px;font-size:10px;color:var(--text-tertiary)">${usage.entries.length} LLM call${usage.entries.length !== 1 ? 's' : ''} recorded · Last: ${new Date(usage.entries[usage.entries.length - 1].timestamp).toLocaleString()}</div>` : ''}
      `;
    } catch { panel.textContent = ''; }
  }

  function renderConfigPreview() {
    const cfg = currentProject?.config || {};
    const layers = cfg.enabledLayers || [];
    return `
      <div class="proj-cfg-preview-row"><span data-i18n="0bcd66e677f4ee72">Layers</span><strong>${layers.length > 0 ? layers.join(', ') : '<span style="color:var(--coral)" data-i18n="557832355c8534ab">None selected</span>'}</strong></div>
      ${cfg.genre ? `<div class="proj-cfg-preview-row"><span data-i18n="6da795a8664f37f6">Genre</span><strong>${cfg.genre}</strong></div>` : ''}
      ${cfg.promptText ? `<div class="proj-cfg-preview-row"><span data-i18n="5c39123805ffb4e2">Prompt</span><strong>${esc(cfg.promptText).substring(0, 80)}${cfg.promptText.length > 80 ? '…' : ''}</strong></div>` : ''}
      ${cfg.learnerId ? `<div class="proj-cfg-preview-row"><span data-i18n="5b32ac8d29a125c8">Learner ID</span><strong>${esc(cfg.learnerId)}</strong></div>` : ''}
    `;
  }

  // ═══════════════════════════════════════════════════════════════════════
  // CONFIGURATION EDITOR (full screen step)
  // ═══════════════════════════════════════════════════════════════════════

  function renderConfigEditor() {
    const s = screen();
    const cfg = currentProject.config || {};
    const allLayers = ['L0','L1','L2','L3','L4','L5','L6','L7','L8','L9','L10','L11'];
    const enabled = new Set(cfg.enabledLayers || allLayers.slice(0, 11));

    s.innerHTML = `
      ${header('&larr; Back', '<span data-i18n="0a397326a036f57a">Edit Configuration</span>')}
      <div class="proj-step-body">
        <div class="proj-step-label" data-i18n="81a9da18293b1f13">Project-level settings applied to all files during analysis</div>
        <div class="proj-config-form">
          <div>
            <div class="field-label" data-i18n="160ae9e27ab03126">Analysis layers</div>
            <div class="options-row" style="flex-wrap:wrap;gap:6px">
              ${allLayers.map(l => `<div class="opt-chip${enabled.has(l)?' on':''}" data-layer="${l}"><div class="opt-dot"></div>${l}</div>`).join('')}
            </div>
          </div>
          <div>
            <div class="field-label"><span data-i18n="7b21cc479361d27c">Default genre</span> <span style="font-weight:400;color:var(--text-tertiary)" data-i18n="9d8ed46998db471f">(overridden by per-file metadata)</span></div>
            <select id="proj-cfg-genre" class="proj-input"><option value="" data-i18n="285bb526e02fedf1">Select genre…</option></select>
          </div>
          <div>
            <div class="field-label"><span data-i18n="d304dc136ef83f86">Default prompt</span> <span style="font-weight:400;color:var(--text-tertiary)" data-i18n="9d8ed46998db471f">(overridden by per-file metadata)</span></div>
            <textarea id="proj-cfg-prompt" class="proj-input" style="height:60px;resize:vertical" placeholder="e.g. Discuss the impact of AI on higher education…">${esc(cfg.promptText||'')}</textarea>
          </div>
          <div>
            <div class="field-label"><span data-i18n="5b32ac8d29a125c8">Learner ID</span> <span style="font-weight:400;color:var(--text-tertiary)" data-i18n="d8cb4271c3930e15">(for L11 reader-adaptive)</span></div>
            <input type="text" id="proj-cfg-learner" class="proj-input" value="${esc(cfg.learnerId||'')}" placeholder="student_4821">
          </div>
          <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:8px">
            <button class="nav-btn" id="proj-cfg-cancel" data-i18n="19766ed6ccb2f4a3">Cancel</button>
            <button class="proj-upload-btn" id="proj-cfg-save" style="padding:8px 24px" data-i18n="b2b158f2ea6f2698">Save configuration</button>
          </div>
        </div>
      </div>`;

    // Populate genres
    fetch('/api/genres').then(r=>r.json()).then(data => {
      const sel = s.querySelector('#proj-cfg-genre');
      (data.categories||[]).forEach(cat => {
        const grp = document.createElement('optgroup');
        grp.label = cat.category;
        if (cat.i18n) grp.setAttribute('data-i18n-label', cat.i18n);
        cat.genres.forEach(g => {
          const opt = document.createElement('option');
          opt.value = g.id; opt.textContent = g.name;
          if (g.i18n) opt.setAttribute('data-i18n', g.i18n);
          if (g.id === cfg.genre) opt.selected = true;
          grp.appendChild(opt);
        });
        sel.appendChild(grp);
      });
    }).catch(()=>{});

    // Layer toggles
    s.querySelectorAll('.opt-chip').forEach(chip => chip.addEventListener('click', () => chip.classList.toggle('on')));

    // Cancel
    s.querySelector('#proj-cfg-cancel').addEventListener('click', renderStep0);
    s.querySelector('.proj-back-btn').addEventListener('click', renderStep0);

    // Save
    s.querySelector('#proj-cfg-save').addEventListener('click', async () => {
      const layers = [];
      s.querySelectorAll('.opt-chip.on').forEach(c => layers.push(c.dataset.layer));
      const newCfg = {
        enabledLayers: layers,
        promptText: (s.querySelector('#proj-cfg-prompt')?.value || '').trim(),
        genre: s.querySelector('#proj-cfg-genre')?.value || '',
        learnerId: (s.querySelector('#proj-cfg-learner')?.value || '').trim(),
      };
      const btn = s.querySelector('#proj-cfg-save');
      btn.textContent = 'Saving…'; btn.setAttribute('data-i18n', '23e39291d6135814'); btn.disabled = true;
      try {
        await Auth.apiFetch(`/api/projects/${currentProject.id}`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ config: newCfg }),
        });
        currentProject.config = newCfg;
        renderStep0();
      } catch { btn.textContent = 'Save configuration'; btn.setAttribute('data-i18n', 'b2b158f2ea6f2698'); btn.disabled = false; }
    });
  }

  function openFileMetaEditor(s, filename, meta) {
    // Create modal overlay
    const overlay = document.createElement('div');
    overlay.className = 'proj-modal-overlay';
    overlay.innerHTML = `
      <div class="proj-modal-backdrop"></div>
      <div class="proj-modal" style="width:620px">
        <div class="proj-modal-header">
          <div class="proj-modal-header-title">&#128221; ${esc(filename)}</div>
          <button class="proj-modal-close">&times;</button>
        </div>
        <div class="proj-modal-body" id="proj-meta-modal-body"></div>
      </div>`;
    document.body.appendChild(overlay);
    const panel = overlay.querySelector('#proj-meta-modal-body');
    const closeModal = () => { overlay.remove(); };
    overlay.querySelector('.proj-modal-backdrop').addEventListener('click', closeModal);
    overlay.querySelector('.proj-modal-close').addEventListener('click', closeModal);

    const languages = [
      { value: 'en', label: 'English' },
      { value: 'es', label: 'Spanish / Español' },
      { value: 'fr', label: 'French / Français' },
      { value: 'de', label: 'German / Deutsch' },
      { value: 'it', label: 'Italian / Italiano' },
      { value: 'pt', label: 'Portuguese / Português' },
      { value: 'nl', label: 'Dutch / Nederlands' },
      { value: 'ru', label: 'Russian / Русский' },
      { value: 'zh', label: 'Chinese / 中文' },
      { value: 'ja', label: 'Japanese / 日本語' },
      { value: 'ko', label: 'Korean / 한국어' },
      { value: 'ar', label: 'Arabic / العربية' },
      { value: 'hi', label: 'Hindi / हिन्दी' },
      { value: 'th', label: 'Thai / ไทย' },
      { value: 'vi', label: 'Vietnamese / Tiếng Việt' },
      { value: 'id', label: 'Indonesian / Bahasa Indonesia' },
      { value: 'ms', label: 'Malay / Bahasa Melayu' },
      { value: 'tr', label: 'Turkish / Türkçe' },
      { value: 'pl', label: 'Polish / Polski' },
      { value: 'uk', label: 'Ukrainian / Українська' },
      { value: 'sv', label: 'Swedish / Svenska' },
      { value: 'da', label: 'Danish / Dansk' },
      { value: 'no', label: 'Norwegian / Norsk' },
      { value: 'fi', label: 'Finnish / Suomi' },
      { value: 'el', label: 'Greek / Ελληνικά' },
      { value: 'he', label: 'Hebrew / עברית' },
      { value: 'cs', label: 'Czech / Čeština' },
      { value: 'ro', label: 'Romanian / Română' },
      { value: 'hu', label: 'Hungarian / Magyar' },
      { value: 'other', label: 'Other' },
    ];

    const readingLevels = [
      { value: '', label: 'Not specified', hash: 'dc12bec5d71f167b' },
      { value: 'elementary', label: 'Elementary (grades 3-5)', hash: '81c542659470d711' },
      { value: 'middle-school', label: 'Middle School (grades 6-8)', hash: '60497a5dde764449' },
      { value: 'high-school', label: 'High School (grades 9-12)', hash: '64baba6677bf740f' },
      { value: 'college', label: 'College (undergraduate)', hash: '32f3644b25f831b9' },
      { value: 'graduate', label: 'Graduate / Professional', hash: 'e4350f7a95b355f6' },
    ];

    const assignmentTypes = [
      { value: '', label: 'Not specified', hash: 'dc12bec5d71f167b' },
      { value: 'argumentative', label: 'Argumentative essay', hash: '610a8151589e433f' },
      { value: 'expository', label: 'Expository / informational', hash: 'ca84a5500b88ca9d' },
      { value: 'narrative', label: 'Narrative / personal', hash: 'd77602c97be1d90f' },
      { value: 'analytical', label: 'Analytical / critical', hash: '8cd148ed60b00fdb' },
      { value: 'compare-contrast', label: 'Compare & contrast', hash: '04aee6d586c94e27' },
      { value: 'research-paper', label: 'Research paper', hash: 'e6fc3b22955a9628' },
      { value: 'lab-report', label: 'Lab / technical report', hash: 'd7b46c21b3964d79' },
      { value: 'reflection', label: 'Reflection / journal', hash: 'a70632a07490736c' },
      { value: 'creative', label: 'Creative writing', hash: 'f919aefdb9688dca' },
      { value: 'summary', label: 'Summary / review', hash: '751429f420d43651' },
      { value: 'other', label: 'Other', hash: 'f97e9da0e3b879f0' },
    ];

    const authorLevels = [
      { value: '', label: 'Not specified', hash: 'dc12bec5d71f167b' },
      { value: 'esl-beginner', label: 'ESL — Beginner (A1-A2)', hash: 'c75f9ea8e7cd7864' },
      { value: 'esl-intermediate', label: 'ESL — Intermediate (B1-B2)', hash: 'f31d53b6d00a32e5' },
      { value: 'esl-advanced', label: 'ESL — Advanced (C1-C2)', hash: '2a33d49a10cf9e7f' },
      { value: 'native-k5', label: 'Native — Elementary (K-5)', hash: '4dae73ce56a02d96' },
      { value: 'native-middle', label: 'Native — Middle school (6-8)', hash: '364cfdf612ea1876' },
      { value: 'native-high', label: 'Native — High school (9-12)', hash: 'ca904f41e05c8f47' },
      { value: 'college-freshman', label: 'College — Freshman/Sophomore', hash: 'f40706f2da13368a' },
      { value: 'college-upper', label: 'College — Junior/Senior', hash: '2953c9946199ccd5' },
      { value: 'graduate', label: 'Graduate student', hash: 'f352b6f7c6b11b04' },
      { value: 'professional', label: 'Professional / faculty', hash: '25dd88cf7ecf5711' },
    ];

    const metaComplete = countMetaFields(meta);

    panel.innerHTML = `
        <div style="font-size:11px;color:var(--text-tertiary);margin-bottom:4px" data-i18n="c96b478ed71a1ffc">
          The more complete the metadata, the better the analysis. Each field gives the LLM context that improves accuracy and reduces wasted tokens.
        </div>
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:14px">
          <span style="font-size:11px;color:var(--teal);font-weight:500" class="proj-meta-completeness"><span data-i18n="76d93f2ec651c176">Completeness:</span> ${metaComplete.filled} / ${metaComplete.total}</span>
          <button class="proj-upload-btn" id="proj-meta-autodetect" style="margin-left:auto;font-size:11px;padding:5px 14px">
            &#9733; <span data-i18n="59f030eb6fd7296d">Auto-detect with AI</span>
          </button>
        </div>

        <div style="display:flex;flex-direction:column;gap:12px">
          <!-- Document context -->
          <div style="font-size:11px;font-weight:600;color:var(--text-tertiary);text-transform:uppercase;letter-spacing:0.5px;padding-top:4px" data-i18n="e2b5bca76104eebf">Document context</div>
          <div>
            <div class="field-label" style="display:flex;align-items:center;gap:6px">
              <span>&#127760; Language</span>
              <span style="font-weight:400;color:var(--amber);font-size:10px">(determines analysis language)</span>
            </div>
            <select id="proj-meta-language" class="proj-input" style="border-color:var(--amber);font-weight:500">
              ${languages.map(l => `<option value="${l.value}"${l.value === (meta.language||'en') ? ' selected' : ''}>${l.label}</option>`).join('')}
            </select>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
            <div>
              <div class="field-label" data-i18n="6da795a8664f37f6">Genre</div>
              <select id="proj-meta-genre" class="proj-input"><option value="" data-i18n="285bb526e02fedf1">Select genre…</option></select>
            </div>
            <div>
              <div class="field-label" data-i18n="1e45784760449cf3">Target reading level</div>
              <select id="proj-meta-level" class="proj-input">
                ${readingLevels.map(l => `<option value="${l.value}"${l.value === (meta.readingLevel||'') ? ' selected' : ''} data-i18n="${l.hash}">${l.label}</option>`).join('')}
              </select>
            </div>
          </div>

          <!-- Assignment context -->
          <div style="font-size:11px;font-weight:600;color:var(--text-tertiary);text-transform:uppercase;letter-spacing:0.5px;padding-top:4px;border-top:0.5px solid var(--border-tertiary)" data-i18n="51e719fc193d0cb4">Assignment context</div>
          <div>
            <div class="field-label" data-i18n="c77c8ce006c4dce5">Assignment type</div>
            <select id="proj-meta-assignment" class="proj-input">
              ${assignmentTypes.map(a => `<option value="${a.value}"${a.value === (meta.assignmentType||'') ? ' selected' : ''} data-i18n="${a.hash}">${a.label}</option>`).join('')}
            </select>
          </div>
          <div>
            <div class="field-label"><span data-i18n="6a72b0aeff61b579">Assignment prompt</span> <span style="font-weight:400;color:var(--text-tertiary)" data-i18n="5880ee8adb4e85fa">(the writing task given to the student)</span></div>
            <textarea id="proj-meta-prompt" class="proj-input" style="height:50px;resize:vertical" placeholder="e.g. Compare two theories of language acquisition. Discuss strengths and weaknesses of each, using at least 3 peer-reviewed sources. 1000-1500 words.">${esc(meta.promptText||'')}</textarea>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
            <div>
              <div class="field-label" data-i18n="5d53d7277043ce0d">Expected word count</div>
              <input type="text" id="proj-meta-wordcount" class="proj-input" value="${esc(meta.expectedWordCount||'')}" placeholder="e.g. 800-1000">
            </div>
            <div>
              <div class="field-label" data-i18n="82d124c089137468">Course / class</div>
              <input type="text" id="proj-meta-course" class="proj-input" value="${esc(meta.course||'')}" placeholder="e.g. ENG 101, Fall 2026">
            </div>
          </div>
          <div>
            <div class="field-label"><span data-i18n="540b8535a0d9b587">Rubric criteria</span> <span style="font-weight:400;color:var(--text-tertiary)" data-i18n="4d445c37e50c8dcb">(key grading dimensions)</span></div>
            <textarea id="proj-meta-rubric" class="proj-input" style="height:50px;resize:vertical" placeholder="e.g. Thesis clarity (20%), Evidence use (25%), Organization (20%), Language (20%), Mechanics (15%)">${esc(meta.rubricNotes||'')}</textarea>
          </div>

          <!-- Author context -->
          <div style="font-size:11px;font-weight:600;color:var(--text-tertiary);text-transform:uppercase;letter-spacing:0.5px;padding-top:4px;border-top:0.5px solid var(--border-tertiary)" data-i18n="84846c9917914882">Author context</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
            <div>
              <div class="field-label" data-i18n="03b79d335575a3b8">Author / Student ID</div>
              <input type="text" id="proj-meta-author" class="proj-input" value="${esc(meta.author||'')}" placeholder="e.g. student_4821">
            </div>
            <div>
              <div class="field-label" data-i18n="6b7419d40d47aa50">Author level</div>
              <select id="proj-meta-authorlevel" class="proj-input">
                ${authorLevels.map(a => `<option value="${a.value}"${a.value === (meta.authorLevel||'') ? ' selected' : ''} data-i18n="${a.hash}">${a.label}</option>`).join('')}
              </select>
            </div>
          </div>

          <!-- Analysis hints -->
          <div style="font-size:11px;font-weight:600;color:var(--text-tertiary);text-transform:uppercase;letter-spacing:0.5px;padding-top:4px;border-top:0.5px solid var(--border-tertiary)" data-i18n="148c622fd67aa826">Analysis hints</div>
          <div>
            <div class="field-label"><span data-i18n="c9c89e30117d5f60">Focus areas</span> <span style="font-weight:400;color:var(--text-tertiary)" data-i18n="94072f33e4892ee1">(what to pay special attention to)</span></div>
            <input type="text" id="proj-meta-focus" class="proj-input" value="${esc(meta.focusAreas||'')}" placeholder="e.g. argumentation quality, use of evidence, paragraph transitions">
          </div>
          <div>
            <div class="field-label"><span data-i18n="9e06846ba2df2bb2">Known issues</span> <span style="font-weight:400;color:var(--text-tertiary)" data-i18n="b7b26ff974fad33e">(pre-identified concerns)</span></div>
            <input type="text" id="proj-meta-issues" class="proj-input" value="${esc(meta.knownIssues||'')}" placeholder="e.g. weak thesis, repetitive vocabulary, off-topic in section 3">
          </div>
          <div>
            <div class="field-label" data-i18n="5871e1abaa639712">Additional notes</div>
            <textarea id="proj-meta-notes" class="proj-input" style="height:50px;resize:vertical" placeholder="Any other context that helps interpretation…">${esc(meta.notes||'')}</textarea>
          </div>

          <div style="display:flex;gap:8px;justify-content:flex-end;padding-top:8px;border-top:0.5px solid var(--border-tertiary)">
            <button class="nav-btn" id="proj-meta-cancel" data-i18n="19766ed6ccb2f4a3">Cancel</button>
            <button class="proj-upload-btn" id="proj-meta-save" data-i18n="06d1ae6bcb25c522">Save metadata</button>
          </div>
        </div>`;

    // Populate genres
    fetch('/api/genres').then(r => r.json()).then(data => {
      const sel = panel.querySelector('#proj-meta-genre');
      (data.categories || []).forEach(cat => {
        const grp = document.createElement('optgroup');
        grp.label = cat.category;
        if (cat.i18n) grp.setAttribute('data-i18n-label', cat.i18n);
        cat.genres.forEach(g => {
          const opt = document.createElement('option');
          opt.value = g.id; opt.textContent = g.name;
          if (g.i18n) opt.setAttribute('data-i18n', g.i18n);
          if (g.id === (meta.genre || '')) opt.selected = true;
          grp.appendChild(opt);
        });
        sel.appendChild(grp);
      });
    }).catch(() => {});

    // Close
    panel.querySelector('#proj-meta-cancel').addEventListener('click', closeModal);

    // Auto-detect with AI
    panel.querySelector('#proj-meta-autodetect').addEventListener('click', async () => {
      const btn = panel.querySelector('#proj-meta-autodetect');
      btn.textContent = 'Analyzing file…'; btn.setAttribute('data-i18n', '30690de26f8dc7c4'); btn.disabled = true;
      try {
        const resp = await Auth.apiFetch(`/api/projects/${currentProject.id}/files/${encodeURIComponent(filename)}/auto-meta`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
        });
        if (!resp.ok) { const e = await resp.json(); alert(e.error || 'Failed'); return; }
        const data = await resp.json();
        const s = data.suggested || {};
        if (typeof TokenFooter !== 'undefined') TokenFooter.onApiResponse(data);

        // Fill in empty fields only (don't overwrite user's existing values)
        const setIfEmpty = (id, val) => {
          const el = panel.querySelector(id);
          if (el && !el.value && val) el.value = val;
        };
        const selectIfEmpty = (id, val) => {
          const el = panel.querySelector(id);
          if (el && !el.value && val) {
            // Try exact match first
            for (const opt of el.options) { if (opt.value === val) { el.value = val; return; } }
            // Try partial match
            for (const opt of el.options) { if (opt.value && val.includes(opt.value)) { el.value = opt.value; return; } }
          }
        };

        selectIfEmpty('#proj-meta-language', s.language);
        selectIfEmpty('#proj-meta-genre', s.genre);
        selectIfEmpty('#proj-meta-level', s.readingLevel);
        selectIfEmpty('#proj-meta-assignment', s.assignmentType);
        setIfEmpty('#proj-meta-prompt', s.promptText);
        setIfEmpty('#proj-meta-wordcount', s.expectedWordCount);
        selectIfEmpty('#proj-meta-authorlevel', s.authorLevel);
        setIfEmpty('#proj-meta-focus', s.focusAreas);
        setIfEmpty('#proj-meta-issues', s.knownIssues);

        // If detected language differs from current UI language, suggest switching
        if (s.language && s.language !== 'en') {
          const langEl = panel.querySelector('#proj-meta-language');
          const langLabel = langEl ? langEl.options[langEl.selectedIndex]?.text : s.language;
          showLanguageSuggestion(panel, s.language, langLabel);
        }

        // Auto-save after populating
        btn.textContent = 'Saving…'; btn.setAttribute('data-i18n', '23e39291d6135814');
        const autoMeta = {
          language: panel.querySelector('#proj-meta-language').value,
          genre: panel.querySelector('#proj-meta-genre').value,
          readingLevel: panel.querySelector('#proj-meta-level').value,
          assignmentType: panel.querySelector('#proj-meta-assignment').value,
          promptText: panel.querySelector('#proj-meta-prompt').value.trim(),
          expectedWordCount: panel.querySelector('#proj-meta-wordcount').value.trim(),
          course: panel.querySelector('#proj-meta-course').value.trim(),
          rubricNotes: panel.querySelector('#proj-meta-rubric').value.trim(),
          author: panel.querySelector('#proj-meta-author').value.trim(),
          authorLevel: panel.querySelector('#proj-meta-authorlevel').value,
          focusAreas: panel.querySelector('#proj-meta-focus').value.trim(),
          knownIssues: panel.querySelector('#proj-meta-issues').value.trim(),
          notes: panel.querySelector('#proj-meta-notes').value.trim(),
        };
        await Auth.apiFetch(`/api/projects/${currentProject.id}/files/${encodeURIComponent(filename)}/meta`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(autoMeta),
        });
        // Update local data immediately
        const localFile = currentFiles.find(f => f.name === filename);
        if (localFile) localFile.meta = autoMeta;

        btn.textContent = 'Detected & saved!'; btn.setAttribute('data-i18n', 'f7ef4b0eca2139cb');
        btn.style.background = 'var(--teal-light)';
        btn.style.color = '#065F46';
        // Update completeness display
        const mc = countMetaFields(autoMeta);
        const compEl = panel.querySelector('.proj-meta-completeness');
        if (compEl) compEl.innerHTML = `<span data-i18n="76d93f2ec651c176">Completeness:</span> ${mc.filled} / ${mc.total}`;

        setTimeout(() => {
          btn.textContent = '\u2733 Auto-detect with AI'; btn.setAttribute('data-i18n', '59f030eb6fd7296d');
          btn.style.background = ''; btn.style.color = '';
          btn.disabled = false;
        }, 2000);
      } catch (err) {
        alert('Auto-detect failed: ' + err.message);
        btn.textContent = '\u2733 Auto-detect with AI'; btn.setAttribute('data-i18n', '59f030eb6fd7296d'); btn.disabled = false;
      }
    });

    // Save
    panel.querySelector('#proj-meta-save').addEventListener('click', async () => {
      const newMeta = {
        language: panel.querySelector('#proj-meta-language').value,
        genre: panel.querySelector('#proj-meta-genre').value,
        readingLevel: panel.querySelector('#proj-meta-level').value,
        assignmentType: panel.querySelector('#proj-meta-assignment').value,
        promptText: panel.querySelector('#proj-meta-prompt').value.trim(),
        expectedWordCount: panel.querySelector('#proj-meta-wordcount').value.trim(),
        course: panel.querySelector('#proj-meta-course').value.trim(),
        rubricNotes: panel.querySelector('#proj-meta-rubric').value.trim(),
        author: panel.querySelector('#proj-meta-author').value.trim(),
        authorLevel: panel.querySelector('#proj-meta-authorlevel').value,
        focusAreas: panel.querySelector('#proj-meta-focus').value.trim(),
        knownIssues: panel.querySelector('#proj-meta-issues').value.trim(),
        notes: panel.querySelector('#proj-meta-notes').value.trim(),
      };
      const saveBtn = panel.querySelector('#proj-meta-save');
      saveBtn.textContent = 'Saving…'; saveBtn.setAttribute('data-i18n', '23e39291d6135814'); saveBtn.disabled = true;
      try {
        await Auth.apiFetch(`/api/projects/${currentProject.id}/files/${encodeURIComponent(filename)}/meta`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newMeta),
        });
        // Update local data immediately
        const localFile = currentFiles.find(f => f.name === filename);
        if (localFile) localFile.meta = newMeta;
        saveBtn.textContent = 'Saved!'; saveBtn.setAttribute('data-i18n', 'ed9b760289e614c9');
        setTimeout(() => {
          closeModal();
          renderStep0();
        }, 500);
      } catch {
        saveBtn.textContent = 'Save metadata'; saveBtn.setAttribute('data-i18n', '06d1ae6bcb25c522'); saveBtn.disabled = false;
      }
    });
  }

  // ═══════════════════════════════════════════════════════════════════════
  // STEP 1: Select files
  // ═══════════════════════════════════════════════════════════════════════

  function renderStep1() {
    const s = screen();
    const readyFiles = currentFiles.filter(f => countMetaFields(f.meta).filled >= 4);
    const notReady = currentFiles.filter(f => countMetaFields(f.meta).filled < 4);
    if (selectedFiles.length === 0) selectedFiles = readyFiles.map(f => f.name);

    s.innerHTML = `
      ${header('&larr; Back', '<span data-i18n="5e573109207e2470">Step 1 of 2: Select Files</span>')}
      <div class="proj-step-body">
        <div class="proj-step-label">${readyFiles.length} of ${currentFiles.length} files ready for analysis</div>
        ${readyFiles.length > 0 ? `
        <div style="margin-bottom:8px">
          <label style="font-size:12px;color:var(--text-secondary);cursor:pointer">
            <input type="checkbox" id="proj-sel-all" ${selectedFiles.length===readyFiles.length?'checked':''}> <span data-i18n="cdaf59212fc41a98">Select all ready</span> (${readyFiles.length})
          </label>
        </div>` : ''}
        <div class="proj-file-list">
          ${currentFiles.map(f => {
            const mc = countMetaFields(f.meta);
            const isReady = mc.filled >= 4;
            const ms = metaStatus(f.meta);
            return `<div class="proj-file-row${!isReady ? ' proj-file-row-disabled' : ''}">
              <input type="checkbox" class="proj-file-check" data-name="${escAttr(f.name)}" ${isReady && selectedFiles.includes(f.name) ? 'checked' : ''} ${!isReady ? 'disabled' : ''}>
              <span class="proj-file-name">${esc(f.name)}</span>
              <span class="proj-ft-meta ${ms.cls}" style="font-size:10px"><span class="proj-ft-meta-icon">${ms.icon}</span> ${ms.label}</span>
              <span class="proj-file-size">${f.sizeLabel||''}</span>
            </div>`;
          }).join('')}
        </div>
        ${notReady.length > 0 ? `
        <div style="margin-top:8px;font-size:11px;color:var(--amber)">
          ${notReady.length} file${notReady.length>1?'s':''} <span data-i18n="6612dc85d7dbb8ec">need more metadata (min 4 fields). Go back to fill in.</span>
        </div>` : ''}
        <div class="proj-step-nav">
          <div></div>
          <button class="proj-next-btn" id="proj-next1" ${readyFiles.length===0?'disabled':''}><span data-i18n="9594e1f9746f7826">Next: Review &amp; Estimate</span> &rarr;</button>
        </div>
      </div>`;

    s.querySelector('.proj-back-btn').addEventListener('click', renderStep0);
    s.querySelector('#proj-sel-all').addEventListener('change', (e) => {
      s.querySelectorAll('.proj-file-check').forEach(c => c.checked = e.target.checked);
    });
    s.querySelector('#proj-next1')?.addEventListener('click', () => {
      selectedFiles = Array.from(s.querySelectorAll('.proj-file-check:checked')).map(c => c.dataset.name);
      if (selectedFiles.length === 0) { alert('Select at least one file.'); return; }
      wizardConfig = { ...(currentProject.config || {}) };
      renderStep3();
    });
  }

  // ═══════════════════════════════════════════════════════════════════════
  // STEP 2: Configure
  // ═══════════════════════════════════════════════════════════════════════

  function renderStep2() {
    const s = screen();
    const cfg = wizardConfig;
    const allLayers = ['L0','L1','L2','L3','L4','L5','L6','L7','L8','L9','L10','L11'];
    const enabled = new Set(cfg.enabledLayers || allLayers.slice(0, 11));

    s.innerHTML = `
      ${header('&larr; Back', '<span data-i18n="c456c2494bf2182e">Step 2 of 3: Configure</span>')}
      <div class="proj-step-body">
        <div class="proj-step-label">${selectedFiles.length} file${selectedFiles.length>1?'s':''} <span data-i18n="d7cbbb688b2e506c">selected</span></div>
        <div class="proj-config-form">
          <div>
            <div class="field-label" data-i18n="160ae9e27ab03126">Analysis layers</div>
            <div class="options-row" style="flex-wrap:wrap;gap:6px">
              ${allLayers.map(l => `<div class="opt-chip${enabled.has(l)?' on':''}" data-layer="${l}"><div class="opt-dot"></div>${l}</div>`).join('')}
            </div>
          </div>
          <div>
            <div class="field-label"><span data-i18n="6a72b0aeff61b579">Assignment prompt</span> <span style="font-weight:400;color:var(--text-tertiary)" data-i18n="0059798b7f7023e4">(optional)</span></div>
            <input type="text" id="proj-cfg-prompt" value="${esc(cfg.promptText||'')}" placeholder="e.g. Discuss the impact of AI…" class="proj-input">
          </div>
          <div>
            <div class="field-label"><span data-i18n="6da795a8664f37f6">Genre</span> <span style="font-weight:400;color:var(--text-tertiary)" data-i18n="0059798b7f7023e4">(optional)</span></div>
            <select id="proj-cfg-genre" class="proj-input"><option value="" data-i18n="285bb526e02fedf1">Select genre…</option></select>
          </div>
          <div>
            <div class="field-label"><span data-i18n="5b32ac8d29a125c8">Learner ID</span> <span style="font-weight:400;color:var(--text-tertiary)" data-i18n="2b9079c02d741dc0">(for L11)</span></div>
            <input type="text" id="proj-cfg-learner" value="${esc(cfg.learnerId||'')}" placeholder="student_4821" class="proj-input">
          </div>
        </div>
        <div class="proj-step-nav">
          <div></div>
          <button class="proj-next-btn" id="proj-next2"><span data-i18n="9594e1f9746f7826">Next: Review &amp; Estimate</span> &rarr;</button>
        </div>
      </div>`;

    // Populate genres
    fetch('/api/genres').then(r=>r.json()).then(data => {
      const sel = s.querySelector('#proj-cfg-genre');
      (data.categories||[]).forEach(cat => {
        const grp = document.createElement('optgroup');
        grp.label = cat.category;
        if (cat.i18n) grp.setAttribute('data-i18n-label', cat.i18n);
        cat.genres.forEach(g => {
          const opt = document.createElement('option');
          opt.value = g.id; opt.textContent = g.name;
          if (g.i18n) opt.setAttribute('data-i18n', g.i18n);
          if (g.id === cfg.genre) opt.selected = true;
          grp.appendChild(opt);
        });
        sel.appendChild(grp);
      });
    }).catch(()=>{});

    s.querySelectorAll('.opt-chip').forEach(chip => chip.addEventListener('click', () => chip.classList.toggle('on')));
    s.querySelector('.proj-back-btn').addEventListener('click', renderStep1);
    s.querySelector('#proj-next2').addEventListener('click', () => {
      gatherConfig(s);
      renderStep3();
    });
  }

  function gatherConfig(s) {
    const layers = [];
    s.querySelectorAll('.opt-chip.on').forEach(c => layers.push(c.dataset.layer));
    wizardConfig = {
      enabledLayers: layers,
      promptText: (s.querySelector('#proj-cfg-prompt')?.value || '').trim(),
      genre: s.querySelector('#proj-cfg-genre')?.value || '',
      learnerId: (s.querySelector('#proj-cfg-learner')?.value || '').trim(),
    };
  }

  // ═══════════════════════════════════════════════════════════════════════
  // STEP 3: Review & Estimate Cost
  // ═══════════════════════════════════════════════════════════════════════

  async function renderStep3() {
    const s = screen();

    s.innerHTML = `
      ${header('&larr; Back', '<span data-i18n="0f38605c24042fbd">Review &amp; Run</span>')}
      <div class="proj-step-body">
        <div class="proj-step-label" data-i18n="f8a2bb74b1147f29">Review your analysis setup</div>

        <div class="proj-review-card">
          <div class="proj-review-row"><span data-i18n="abc7e9892806b047">Files</span><strong>${selectedFiles.length}</strong></div>
          <div class="proj-review-files">${selectedFiles.map(f => `<span class="proj-file-chip">${esc(f)}</span>`).join('')}</div>
          <div class="proj-review-row"><span data-i18n="0bcd66e677f4ee72">Layers</span><strong>${(wizardConfig.enabledLayers||[]).join(', ')}</strong></div>
          ${wizardConfig.promptText ? `<div class="proj-review-row"><span data-i18n="5c39123805ffb4e2">Prompt</span><strong>${esc(wizardConfig.promptText)}</strong></div>` : ''}
          ${wizardConfig.genre ? `<div class="proj-review-row"><span data-i18n="6da795a8664f37f6">Genre</span><strong>${wizardConfig.genre}</strong></div>` : ''}
        </div>

        <div id="proj-cost-area" class="proj-cost-loading" data-i18n="f183716b2574a335">Estimating cost…</div>

        <div class="proj-step-nav">
          <div></div>
          <button class="proj-next-btn proj-run-btn-big" id="proj-run" disabled data-i18n="7197f99f7ef7c7b1">Waiting for estimate…</button>
        </div>
      </div>`;

    s.querySelector('.proj-back-btn').addEventListener('click', renderStep0);

    // Save config & fetch estimate
    await Auth.apiFetch(`/api/projects/${currentProject.id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ config: wizardConfig }),
    });

    try {
      const resp = await Auth.apiFetch(`/api/projects/${currentProject.id}/estimate`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileNames: selectedFiles }),
      });
      const data = await resp.json();
      const costArea = s.querySelector('#proj-cost-area');
      costArea.className = 'proj-cost-summary';
      costArea.innerHTML = `
        <div class="proj-cost-total"><span data-i18n="85f4ef04044749e5">Estimated cost:</span> ~$${data.estimatedCost.toFixed(3)}</div>
        <div class="proj-cost-row"><span data-i18n="25c55ce79c23be69">Total words</span><strong>${data.totalWords.toLocaleString()}</strong></div>
        <div class="proj-cost-row"><span data-i18n="4db7759dca08e87d">Estimated tokens</span><strong>${data.totalEstimatedTokens.toLocaleString()}</strong></div>
        <div class="proj-cost-row"><span data-i18n="a852520d7d5f55f0">LLM calls per file</span><strong>${data.llmCallsPerFile}</strong></div>
        <div style="margin-top:8px;font-size:10px;color:var(--text-tertiary)">
          ${data.pricing.promptPer1M ? `$${data.pricing.promptPer1M}/M input · $${data.pricing.completionPer1M}/M output` : ''}
        </div>`;

      const runBtn = s.querySelector('#proj-run');
      runBtn.disabled = false;
      runBtn.textContent = `Run Analysis ($${data.estimatedCost.toFixed(3)}) \u2192`; runBtn.setAttribute('data-i18n', '658e795fe0ec9ce0');
      runBtn.addEventListener('click', () => runBatchAnalysis());
    } catch (err) {
      s.querySelector('#proj-cost-area').textContent = 'Could not estimate cost.'; s.querySelector('#proj-cost-area').setAttribute('data-i18n', 'd9cf2c38576b179b');
      const runBtn = s.querySelector('#proj-run');
      runBtn.disabled = false;
      runBtn.textContent = 'Run Analysis \u2192'; runBtn.setAttribute('data-i18n', '658e795fe0ec9ce0');
      runBtn.addEventListener('click', () => runBatchAnalysis());
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // STEP 4: Run (processing screen)
  // ═══════════════════════════════════════════════════════════════════════

  async function runBatchAnalysis() {
    const isSingle = selectedFiles.length === 1;
    let singleResult = null;

    if (isSingle) {
      // Single file: use the full processing screen with layer progress bars
      App.showScreen('process');
      App.enableNav('btn-process');
      Processing.initUI();
      document.getElementById('proc-title').innerHTML = `<span data-i18n="70e435752ac235c3">Analyzing:</span> ${esc(selectedFiles[0])}`;
      document.getElementById('proc-sub').textContent = 'Preparing analysis modules'; document.getElementById('proc-sub').setAttribute('data-i18n', '1db4bfea9970ee04');
    } else {
      // Multi-file: init background batch state and stay on project screen
      const progress = {};
      for (const f of selectedFiles) progress[f] = { status: 'pending', pct: 0, score: null, error: null };
      batchState = { projectId: currentProject.id, files: [...selectedFiles], progress, totalFiles: selectedFiles.length, doneCount: 0 };
      renderStep0(); // re-render to show progress section
    }

    try {
      const resp = await Auth.apiFetch(`/api/projects/${currentProject.id}/analyze`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileNames: selectedFiles, saveToProject: !isSingle }),
      });

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop();
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const evt = JSON.parse(line.slice(6));
            if (isSingle) {
              handleSingleEvent(evt);
              if (evt.type === 'batch_file_done' && evt.resultData) {
                singleResult = evt.resultData;
              }
            } else {
              handleBackgroundBatchEvent(evt);
            }
          } catch {}
        }
      }

      // Single file: go straight to results view
      if (isSingle && singleResult) {
        setTimeout(() => {
          Results.show(singleResult);
          App.showScreen('results');
          App.enableNav('btn-results');
        }, 600);
      }
    } catch (err) {
      if (isSingle) {
        document.getElementById('spinner').style.display = 'none';
        const errTitle = document.getElementById('proc-title'); errTitle.textContent = 'Analysis failed'; errTitle.setAttribute('data-i18n', '4d6ac1bfe5d253f3');
        document.getElementById('proc-sub').textContent = err.message;
      } else if (batchState) {
        // Mark all pending files as error
        for (const f of batchState.files) {
          if (batchState.progress[f].status !== 'done') {
            batchState.progress[f].status = 'error';
            batchState.progress[f].error = err.message;
          }
        }
        updateBatchProgressUI();
      }
    }
  }

  /** Handle SSE events for background multi-file analysis */
  function handleBackgroundBatchEvent(evt) {
    if (!batchState) return;
    const p = batchState.progress;

    switch (evt.type) {
      case 'batch_file_start':
        if (p[evt.fileName]) {
          p[evt.fileName].status = 'analyzing';
          p[evt.fileName].pct = 0;
        }
        break;
      case 'layer_start':
        if (evt.fileName && p[evt.fileName]) {
          p[evt.fileName].currentLayer = evt.layerName || evt.layerId;
        }
        break;
      case 'layer_done':
        if (evt.fileName && p[evt.fileName]) {
          const totalLayers = (wizardConfig.enabledLayers || []).length || 11;
          // +1 for evidence enrichment pass
          if (!p[evt.fileName]._layersDone) p[evt.fileName]._layersDone = 0;
          p[evt.fileName]._layersDone++;
          p[evt.fileName].pct = Math.min(95, Math.round((p[evt.fileName]._layersDone / (totalLayers + 1)) * 95));
        }
        break;
      case 'batch_file_done':
        if (p[evt.fileName]) {
          p[evt.fileName].status = 'done';
          p[evt.fileName].pct = 100;
          p[evt.fileName].score = evt.overallScore;
          p[evt.fileName].resultId = evt.resultId;
        }
        batchState.doneCount++;
        break;
      case 'batch_file_error':
        if (p[evt.fileName]) {
          p[evt.fileName].status = 'error';
          p[evt.fileName].pct = 0;
          p[evt.fileName].error = evt.error;
        }
        batchState.doneCount++;
        break;
      case 'batch_complete':
        // All done — refresh project data and clear batch state
        refreshProject().then(() => {
          batchState = null;
          renderStep0();
        });
        return;
    }
    updateBatchProgressUI();
  }

  /** Re-render the batch progress panel in the project home screen */
  function updateBatchProgressUI() {
    const container = document.getElementById('proj-batch-progress');
    if (!container || !batchState) return;

    const pct = batchState.totalFiles > 0
      ? Math.round((batchState.doneCount / batchState.totalFiles) * 100)
      : 0;

    container.innerHTML = `
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">
        <div class="proj-batch-spinner"></div>
        <span style="font-size:13px;font-weight:600;color:var(--text-primary)">
          Analyzing ${batchState.doneCount}/${batchState.totalFiles} files (${pct}%)
        </span>
      </div>
      <div style="width:100%;height:4px;background:var(--bg-secondary);border-radius:2px;margin-bottom:10px;overflow:hidden">
        <div style="width:${pct}%;height:100%;background:var(--teal);border-radius:2px;transition:width 0.3s"></div>
      </div>
      ${batchState.files.map(f => {
        const s = batchState.progress[f];
        let icon, label, color;
        if (s.status === 'done') {
          icon = '\u2713'; color = 'var(--teal)';
          label = `<span style="font-weight:600;font-family:var(--font-mono);color:${scoreColor(s.score)}">${s.score}</span>`;
        } else if (s.status === 'error') {
          icon = '\u2717'; color = 'var(--coral)';
          label = `<span style="color:var(--coral)">${esc(s.error || 'Failed')}</span>`;
        } else if (s.status === 'analyzing') {
          icon = '\u25b6'; color = 'var(--amber)';
          label = `<span style="color:var(--amber)">${s.pct}%${s.currentLayer ? ' \u2014 ' + esc(s.currentLayer) : ''}</span>`;
        } else {
          icon = '\u25cb'; color = 'var(--text-tertiary)';
          label = '<span style="color:var(--text-tertiary)">Queued</span>';
        }
        return `<div style="display:flex;align-items:center;gap:8px;padding:4px 0;font-size:12px">
          <span style="color:${color};width:14px;text-align:center">${icon}</span>
          <span style="flex:1;color:var(--text-primary)">${esc(f)}</span>
          ${label}
        </div>`;
      }).join('')}
    `;

    // Also update score cells in the file table for completed files
    for (const f of batchState.files) {
      const s = batchState.progress[f];
      // Find the score cell for this file in the file table
      const scoreEls = document.querySelectorAll(`.proj-file-table-row[data-editname="${CSS.escape(f)}"] td`);
      // Score column is the 7th td (index 6)
      if (scoreEls.length >= 7) {
        const scoreCell = scoreEls[6];
        if (s.status === 'done' && s.score != null) {
          scoreCell.innerHTML = `<span style="font-weight:600;font-family:var(--font-mono);font-size:12px;color:${scoreColor(s.score)}">${s.score}</span>`;
        } else if (s.status === 'analyzing') {
          scoreCell.innerHTML = `<span style="font-size:10px;color:var(--amber)">${s.pct}%</span>`;
        } else if (s.status === 'error') {
          scoreCell.innerHTML = `<span style="font-size:10px;color:var(--coral)">\u2717</span>`;
        }
      }
    }
  }

  /** Single-file: use the full layer-progress UI (same as non-project analysis) */
  function handleSingleEvent(evt) {
    const procTitle = document.getElementById('proc-title');
    const procSub = document.getElementById('proc-sub');

    switch (evt.type) {
      case 'layer_start':
        if (procTitle) procTitle.innerHTML = `<span data-i18n="0141ee9533e133b3">Analyzing</span> ${esc(evt.layerName || evt.layerId)}…`;
        Processing.updateLayer(evt.layerId, 'active');
        Processing.addLog(evt.message || '');
        break;
      case 'layer_done':
        Processing.updateLayer(evt.layerId, 'done');
        Processing.addLog(evt.message || `${evt.layerName || evt.layerId} done`);
        if (evt.tokenUsage) Processing.updateTokenDisplay(evt.tokenUsage);
        break;
      case 'layer_error':
        Processing.updateLayer(evt.layerId, 'error');
        Processing.addLog(evt.message || `${evt.layerId} error`);
        break;
      case 'init': case 'log':
        if (procSub) procSub.textContent = evt.message || '';
        Processing.addLog(evt.message || '');
        break;
      case 'batch_file_done':
        document.getElementById('spinner').style.display = 'none';
        if (procTitle) { procTitle.textContent = 'Analysis complete'; procTitle.setAttribute('data-i18n', '60ffb9b9006a07df'); }
        if (procSub) procSub.innerHTML = `<span data-i18n="9689a814f3584ec9">Score:</span> ${evt.overallScore}/100`;
        if (evt.tokenUsage) {
          Processing.updateTokenDisplay(evt.tokenUsage);
        }
        break;
      case 'batch_file_error':
        document.getElementById('spinner').style.display = 'none';
        if (procTitle) { procTitle.textContent = 'Analysis failed'; procTitle.setAttribute('data-i18n', '4d6ac1bfe5d253f3'); }
        if (procSub) procSub.textContent = evt.error;
        break;
    }
  }


  // ═══════════════════════════════════════════════════════════════════════
  // RESULTS LIST
  // ═══════════════════════════════════════════════════════════════════════

  function renderResultsList() {
    const s = screen();
    // Group results by sourceFile for clarity
    const grouped = {};
    for (const r of currentResults) {
      const key = r.sourceFile || 'Unknown';
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(r);
    }

    s.innerHTML = `
      ${header('&larr; ' + esc(currentProject.name), '<span data-i18n="04f2e6324046f8f1">Past Results</span> (' + currentResults.length + ')')}
      <div class="proj-step-body">
        ${currentResults.length === 0
          ? '<div class="proj-empty" data-i18n="b04754ee48e64b1e">No results yet. Run a New Analysis first.</div>'
          : `<table class="proj-results-table">
              <thead>
                <tr>
                  <th style="text-align:left">File</th>
                  <th style="text-align:center;width:70px">Score</th>
                  <th style="text-align:right;width:70px">Words</th>
                  <th style="text-align:center;width:50px">Lang</th>
                  <th style="text-align:right;width:120px">Date</th>
                  <th style="width:32px"></th>
                </tr>
              </thead>
              <tbody>
                ${currentResults.map(r => `
                <tr class="proj-result-row" data-rid="${r.id}">
                  <td class="proj-result-file">${esc(r.sourceFile || r.id)}</td>
                  <td style="text-align:center"><span class="proj-result-score" style="color:${scoreColor(r.overallScore)}">${r.overallScore != null ? r.overallScore : '\u2014'}</span></td>
                  <td style="text-align:right;font-size:11px;color:var(--text-secondary);font-family:var(--font-mono)">${r.wordCount || '\u2014'}</td>
                  <td style="text-align:center;font-size:10px;color:var(--text-secondary);text-transform:uppercase">${r.language || '\u2014'}</td>
                  <td style="text-align:right;font-size:11px;color:var(--text-tertiary)">${r.timestamp ? new Date(r.timestamp).toLocaleString() : (r.updated ? new Date(r.updated).toLocaleDateString() : '')}</td>
                  <td><button class="proj-result-del" data-rdel="${r.id}" title="Delete">&#10005;</button></td>
                </tr>`).join('')}
              </tbody>
            </table>`
        }
      </div>`;

    s.querySelector('.proj-back-btn').addEventListener('click', renderStep0);

    s.querySelectorAll('.proj-result-row').forEach(row => {
      row.addEventListener('click', async (e) => {
        if (e.target.closest('.proj-result-del')) return;
        try {
          const resp = await Auth.apiFetch(`/api/projects/${currentProject.id}/results/${row.dataset.rid}`);
          if (!resp.ok) return;
          Results.show(await resp.json());
          App.showScreen('results');
          App.enableNav('btn-results');
        } catch {}
      });
    });

    s.querySelectorAll('.proj-result-del').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        if (!confirm('Delete this result?')) return;
        await Auth.apiFetch(`/api/projects/${currentProject.id}/results/${btn.dataset.rdel}`, { method: 'DELETE' });
        await refreshProject();
        renderResultsList();
      });
    });
  }

  // ═══════════════════════════════════════════════════════════════════════
  // GOOGLE DRIVE IMPORT
  // ═══════════════════════════════════════════════════════════════════════

  function bindDriveImport(s) {
    const driveBtn = s.querySelector('#proj-drive-trigger');
    const drivePanel = s.querySelector('#proj-drive-panel');
    const driveClose = s.querySelector('#proj-drive-close');
    const driveListBtn = s.querySelector('#proj-drive-list-btn');
    const instrEl = s.querySelector('#proj-drive-instructions');

    if (driveBtn && drivePanel) {
      driveBtn.addEventListener('click', () => {
        const showing = drivePanel.style.display !== 'none';
        drivePanel.style.display = showing ? 'none' : '';
        if (!showing) loadDriveInfo(instrEl);
      });
    }
    if (driveClose) driveClose.addEventListener('click', () => { drivePanel.style.display = 'none'; });
    if (driveListBtn) driveListBtn.addEventListener('click', () => listDriveFiles(s));
  }

  async function loadDriveInfo(instrEl) {
    if (!instrEl) return;
    try {
      const resp = await Auth.apiFetch('/api/projects/drive/info');
      const data = await resp.json();
      if (data.serviceAccountEmail) {
        instrEl.innerHTML = `
          <div style="margin-bottom:8px" data-i18n="9d44183f27b4b342">Share your Google Drive folder with this service account:</div>
          <div style="display:flex;align-items:center;gap:8px;padding:8px 12px;background:var(--bg-secondary);border:0.5px solid var(--border-tertiary);border-radius:var(--radius-md);margin-bottom:8px">
            <code style="flex:1;font-size:12px;color:var(--teal);word-break:break-all">${esc(data.serviceAccountEmail)}</code>
            <button onclick="navigator.clipboard.writeText('${data.serviceAccountEmail}');this.textContent='Copied!';this.setAttribute('data-i18n','e21f935f11d7e966');setTimeout(()=>{this.textContent='Copy';this.setAttribute('data-i18n','9fd7135e16f19b7b')},1500)" style="font-size:10px;padding:3px 10px;border:0.5px solid var(--border-tertiary);border-radius:4px;background:var(--bg-primary);color:var(--text-secondary);cursor:pointer" data-i18n="9fd7135e16f19b7b">Copy</button>
          </div>
          <div style="font-size:11px;color:var(--text-tertiary);line-height:1.6">
            <strong data-i18n="678bfa6af48b17cd">How:</strong> <span data-i18n="ad389aa4c08e3d7c">In Google Drive, right-click your folder → Share → Add the email above as</span> <strong data-i18n="853740a142602f9c">Viewer</strong>.<br>
            <strong data-i18n="d04a682c542b1ad1">Why:</strong> <span data-i18n="fab6b1289e300db1">This gives NeoCohMetrix read-only access to copy files into your project. Your files stay on Google Drive — we only copy what you select.</span><br>
            <strong data-i18n="ed3ee834d6ae59ce">After import:</strong> <span data-i18n="bcc649cfdb8cc557">You can remove sharing access from the service account. Once files are copied to your project, the Drive link is no longer needed.</span>
          </div>`;
      } else {
        instrEl.textContent = data.instructions || 'Google Drive import is not configured.'; instrEl.setAttribute('data-i18n', '04e2a9728af75840');
      }
    } catch {
      instrEl.textContent = 'Could not load sharing instructions.'; instrEl.setAttribute('data-i18n', '113b8e2f4761d74c');
    }
  }

  async function listDriveFiles(s) {
    const urlInput = s.querySelector('#proj-drive-url');
    const filesDiv = s.querySelector('#proj-drive-files');
    const listBtn = s.querySelector('#proj-drive-list-btn');
    if (!urlInput || !filesDiv) return;

    const folderUrl = urlInput.value.trim();
    if (!folderUrl) { alert('Paste a Google Drive folder link.'); return; }

    listBtn.textContent = 'Loading…'; listBtn.setAttribute('data-i18n', 'ba3bbbe10d8bef66'); listBtn.disabled = true;
    filesDiv.innerHTML = '<div style="font-size:12px;color:var(--text-tertiary);padding:8px 0" data-i18n="f4d7711c7b81cc02">Scanning folder…</div>';

    try {
      const resp = await Auth.apiFetch(`/api/projects/${currentProject.id}/drive/list`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folderUrl }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        filesDiv.innerHTML = `<div style="font-size:12px;color:var(--coral);padding:8px 0">${esc(data.error)}${data.hint ? '<br><span style="color:var(--text-tertiary)">' + esc(data.hint) + '</span>' : ''}</div>`;
        return;
      }

      if (data.files.length === 0) {
        filesDiv.innerHTML = '<div style="font-size:12px;color:var(--text-tertiary);padding:8px 0" data-i18n="9bf7112076f3400c">No supported files found (.txt, .docx, .pdf, Google Docs).</div>';
        return;
      }

      filesDiv.innerHTML = `
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
          <span style="font-size:11px;color:var(--text-tertiary)">${data.supported} file${data.supported!==1?'s':''} <span data-i18n="1fc9a387654d410f">found</span></span>
          <label style="font-size:11px;color:var(--text-secondary);cursor:pointer;margin-left:auto">
            <input type="checkbox" id="proj-drive-sel-all" checked> <span data-i18n="f12310620d6f87e7">Select all</span>
          </label>
        </div>
        <div style="display:flex;flex-direction:column;gap:4px">
          ${data.files.map(f => `
            <div class="proj-file-row">
              <input type="checkbox" class="proj-drive-check" data-id="${f.id}" data-name="${escAttr(f.name)}" data-mime="${f.mimeType}" data-gdoc="${f.isGoogleDoc}" checked>
              <span class="proj-file-name">${esc(f.name)}${f.isGoogleDoc ? ' <span style="font-size:9px;color:var(--text-tertiary)">(Google Doc &rarr; .docx)</span>' : ''}</span>
              <span class="proj-file-size">${f.sizeLabel}</span>
            </div>
          `).join('')}
        </div>
        <div style="margin-top:10px;text-align:right">
          <button class="proj-upload-btn" id="proj-drive-import-btn" data-i18n="f9cebc0f35fe930f">Import selected</button>
        </div>
      `;

      // Select all toggle
      const selAll = filesDiv.querySelector('#proj-drive-sel-all');
      if (selAll) {
        selAll.addEventListener('change', (e) => {
          filesDiv.querySelectorAll('.proj-drive-check').forEach(c => c.checked = e.target.checked);
        });
        // Update select-all when individual checkboxes change
        filesDiv.querySelectorAll('.proj-drive-check').forEach(c => {
          c.addEventListener('change', () => {
            const all = filesDiv.querySelectorAll('.proj-drive-check');
            const checked = filesDiv.querySelectorAll('.proj-drive-check:checked');
            selAll.checked = checked.length === all.length;
            selAll.indeterminate = checked.length > 0 && checked.length < all.length;
          });
        });
      }

      // Import button
      filesDiv.querySelector('#proj-drive-import-btn')?.addEventListener('click', () => importDriveFiles(filesDiv));

    } catch (err) {
      filesDiv.innerHTML = `<div style="font-size:12px;color:var(--coral);padding:8px 0">${esc(err.message)}</div>`;
    } finally {
      listBtn.textContent = 'List files'; listBtn.setAttribute('data-i18n', 'e700817c9d5ece14'); listBtn.disabled = false;
    }
  }

  async function importDriveFiles(filesDiv) {
    const checks = filesDiv.querySelectorAll('.proj-drive-check:checked');
    if (checks.length === 0) { alert('Select files to import.'); return; }

    const files = Array.from(checks).map(c => ({
      id: c.dataset.id,
      name: c.dataset.name,
      mimeType: c.dataset.mime,
      isGoogleDoc: c.dataset.gdoc === 'true',
    }));

    const importBtn = filesDiv.querySelector('#proj-drive-import-btn');
    importBtn.innerHTML = `<span data-i18n="d252fffacbf03707">Importing</span> ${files.length}…`; importBtn.disabled = true;

    try {
      const resp = await Auth.apiFetch(`/api/projects/${currentProject.id}/drive/import`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ files }),
      });
      const data = await resp.json();
      if (!resp.ok) { alert(data.error); return; }

      let msg = `Imported ${data.totalImported} file${data.totalImported!==1?'s':''}`;
      if (data.totalErrors > 0) msg += `, ${data.totalErrors} failed`;
      msg += '\n\nYou can now remove sharing access from the service account in Google Drive — the files have been copied to your project.';
      alert(msg);

      await refreshProject();
      renderStep0();
    } catch (err) {
      alert('Import failed: ' + err.message);
    } finally {
      importBtn.textContent = 'Import selected'; importBtn.setAttribute('data-i18n', 'f9cebc0f35fe930f'); importBtn.disabled = false;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // DOCUMENT VIEWER
  // ═══════════════════════════════════════════════════════════════════════

  async function openDocumentViewer(s, filename) {
    const ext = filename.split('.').pop().toLowerCase();
    const token = Auth.getToken ? Auth.getToken() : '';
    const baseUrl = `/api/projects/${currentProject.id}/files/${encodeURIComponent(filename)}/content`;
    // Build authenticated URL for iframe src
    const authParam = token ? `token=${encodeURIComponent(token)}` : '';

    // Determine which view modes are available
    const isPdf = ext === 'pdf';
    const isDocx = ext === 'docx';
    const isTxt = ext === 'txt';

    // Create modal overlay
    const overlay = document.createElement('div');
    overlay.className = 'proj-modal-overlay';
    overlay.innerHTML = `
      <div class="proj-modal-backdrop"></div>
      <div class="proj-modal proj-doc-modal" style="width:750px;height:80vh">
        <div class="proj-modal-header">
          <div class="proj-modal-header-title">&#128065; ${esc(filename)}</div>
          <div style="display:flex;gap:4px">
            <button class="proj-doc-tab active" data-tab="original">${isPdf ? 'PDF' : isDocx ? 'Document' : 'Original'}</button>
            <button class="proj-doc-tab" data-tab="text">Plain Text</button>
          </div>
          <button class="proj-doc-maximize" title="Maximize" style="background:none;border:none;color:var(--text-tertiary);cursor:pointer;font-size:16px;padding:2px 4px">&#9723;</button>
          <button class="proj-modal-close">&times;</button>
        </div>
        <div class="proj-modal-body" style="padding:0;flex:1;display:flex;flex-direction:column">
          <div id="proj-doc-original" style="flex:1;display:flex;flex-direction:column">
            <div style="font-size:12px;color:var(--text-tertiary);padding:16px;text-align:center">Loading...</div>
          </div>
          <div id="proj-doc-text" style="flex:1;display:none;flex-direction:column;overflow:hidden">
            <div style="font-size:12px;color:var(--text-tertiary);padding:16px;text-align:center">Loading...</div>
          </div>
        </div>
      </div>`;
    document.body.appendChild(overlay);

    const closeModal = () => overlay.remove();
    overlay.querySelector('.proj-modal-backdrop').addEventListener('click', closeModal);
    overlay.querySelector('.proj-modal-close').addEventListener('click', closeModal);

    // Maximize toggle
    const modal = overlay.querySelector('.proj-doc-modal');
    const maxBtn = overlay.querySelector('.proj-doc-maximize');
    maxBtn.addEventListener('click', () => {
      modal.classList.toggle('maximized');
      maxBtn.innerHTML = modal.classList.contains('maximized') ? '&#9724;' : '&#9723;';
      maxBtn.title = modal.classList.contains('maximized') ? 'Restore' : 'Maximize';
    });

    // Tab switching
    const tabs = overlay.querySelectorAll('.proj-doc-tab');
    const origPanel = overlay.querySelector('#proj-doc-original');
    const textPanel = overlay.querySelector('#proj-doc-text');
    tabs.forEach(tab => tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      if (tab.dataset.tab === 'original') {
        origPanel.style.display = 'flex'; textPanel.style.display = 'none';
      } else {
        origPanel.style.display = 'none'; textPanel.style.display = 'flex';
      }
    }));

    // Load original view (iframe)
    if (isPdf) {
      // PDF: serve raw, browser renders natively
      origPanel.innerHTML = `<iframe src="${baseUrl}?${authParam}" style="flex:1;border:none;background:#fff"></iframe>`;
    } else if (isDocx) {
      // DOCX: convert to HTML via server
      origPanel.innerHTML = `<iframe src="${baseUrl}?format=html&${authParam}" style="flex:1;border:none;background:#fff"></iframe>`;
    } else {
      // TXT: HTML-wrapped for nice display
      origPanel.innerHTML = `<iframe src="${baseUrl}?format=html&${authParam}" style="flex:1;border:none;background:#fff"></iframe>`;
    }

    // Load plain text view (lazy, on first tab switch or immediately if text tab clicked)
    let textLoaded = false;
    async function loadText() {
      if (textLoaded) return;
      textLoaded = true;
      try {
        const resp = await Auth.apiFetch(`${baseUrl}?extract=true`);
        if (!resp.ok) throw new Error('Failed');
        const data = await resp.json();
        textPanel.innerHTML = `
          <div style="font-size:11px;color:var(--text-tertiary);padding:8px 16px;border-bottom:0.5px solid var(--border-tertiary)">${data.wordCount.toLocaleString()} words</div>
          <pre style="flex:1;overflow-y:auto;padding:16px;margin:0;font-size:12px;font-family:var(--font-sans);color:var(--text-primary);white-space:pre-wrap;word-wrap:break-word;line-height:1.6">${esc(data.text)}</pre>`;
      } catch (err) {
        textPanel.innerHTML = `<div style="color:var(--coral);font-size:12px;padding:16px">${esc(err.message)}</div>`;
      }
    }

    // Preload text in background
    loadText();
  }

  // ═══════════════════════════════════════════════════════════════════════
  // PROJECT SUMMARY VIEW
  // ═══════════════════════════════════════════════════════════════════════

  async function renderSummaryView() {
    const s = screen();
    s.innerHTML = `
      ${header('&larr; ' + esc(currentProject.name), '&#128202; Project Summary')}
      <div class="proj-step-body">
        <div style="font-size:12px;color:var(--text-tertiary);padding:16px 0">Loading summary...</div>
      </div>`;
    s.querySelector('.proj-back-btn').addEventListener('click', renderStep0);

    try {
      const resp = await Auth.apiFetch(`/api/projects/${currentProject.id}/summary`);
      if (!resp.ok) throw new Error('Failed to load summary');
      const data = await resp.json();
      const agg = data.aggregates;

      const genreList = Object.entries(agg.genreBreakdown || {}).map(([g, c]) => `<span style="background:var(--bg-secondary);padding:2px 8px;border-radius:10px;font-size:10px">${esc(g)} (${c})</span>`).join(' ');

      s.innerHTML = `
        ${header('&larr; ' + esc(currentProject.name), '&#128202; Project Summary')}
        <div class="proj-step-body">
          <!-- Stats cards -->
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:10px;margin-bottom:16px">
            <div class="proj-summary-stat">
              <div class="proj-summary-stat-val">${data.fileCount}</div>
              <div class="proj-summary-stat-label">Files</div>
            </div>
            <div class="proj-summary-stat">
              <div class="proj-summary-stat-val">${agg.totalWords.toLocaleString()}</div>
              <div class="proj-summary-stat-label">Total Words</div>
            </div>
            <div class="proj-summary-stat">
              <div class="proj-summary-stat-val" style="color:${agg.avgScore != null ? scoreColor(agg.avgScore) : 'var(--text-tertiary)'}">${agg.avgScore != null ? agg.avgScore : '\u2014'}</div>
              <div class="proj-summary-stat-label">Avg Score</div>
            </div>
            <div class="proj-summary-stat">
              <div class="proj-summary-stat-val">${agg.metaCompleteness}</div>
              <div class="proj-summary-stat-label">Metadata</div>
            </div>
            <div class="proj-summary-stat">
              <div class="proj-summary-stat-val">${data.resultCount}</div>
              <div class="proj-summary-stat-label">Results</div>
            </div>
            ${agg.minScore != null ? `<div class="proj-summary-stat">
              <div class="proj-summary-stat-val">${agg.minScore} – ${agg.maxScore}</div>
              <div class="proj-summary-stat-label">Score Range</div>
            </div>` : ''}
          </div>

          ${genreList ? `<div style="margin-bottom:14px"><div style="font-size:11px;font-weight:600;color:var(--text-tertiary);margin-bottom:4px">GENRES</div><div style="display:flex;flex-wrap:wrap;gap:4px">${genreList}</div></div>` : ''}

          <!-- Per-file table -->
          <table class="proj-file-table">
            <thead>
              <tr>
                <th>File</th>
                <th>Lang</th>
                <th>Words</th>
                <th>Genre</th>
                <th>Level</th>
                <th>Metadata</th>
                <th>Score</th>
              </tr>
            </thead>
            <tbody>
              ${data.files.map(f => `<tr class="proj-file-table-row">
                <td class="proj-ft-name">${esc(f.name)}</td>
                <td style="font-size:10px;font-weight:600;text-transform:uppercase">${f.language || 'en'}</td>
                <td style="font-size:11px">${f.wordCount > 0 ? f.wordCount.toLocaleString() : '\u2014'}</td>
                <td style="font-size:11px">${f.genre ? esc(f.genre) : '\u2014'}</td>
                <td style="font-size:11px">${f.readingLevel || '\u2014'}</td>
                <td style="font-size:11px">${f.metaFilled}/${f.metaTotal}</td>
                <td style="font-size:11px;font-weight:600;color:${scoreColor(f.score)}">${f.score != null ? f.score : '\u2014'}</td>
              </tr>`).join('')}
            </tbody>
          </table>
        </div>`;
      s.querySelector('.proj-back-btn').addEventListener('click', renderStep0);
    } catch (err) {
      s.querySelector('.proj-step-body').innerHTML = `<div style="color:var(--coral);font-size:12px">Error: ${esc(err.message)}</div>`;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // AUTO-DETECT ALL METADATA
  // ═══════════════════════════════════════════════════════════════════════

  async function runAutoDetectAll(s) {
    const noMetaFiles = currentFiles.filter(f => countMetaFields(f.meta).filled === 0);
    if (noMetaFiles.length === 0) return;

    const btn = s.querySelector('#proj-autodetect-all');
    if (!btn) return;
    const origText = btn.innerHTML;
    btn.disabled = true;
    let done = 0;

    for (const f of noMetaFiles) {
      btn.innerHTML = `&#9733; Detecting ${++done}/${noMetaFiles.length}...`;
      try {
        const resp = await Auth.apiFetch(`/api/projects/${currentProject.id}/files/${encodeURIComponent(f.name)}/auto-meta`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
        });
        if (!resp.ok) continue;
        const data = await resp.json();
        const suggested = data.suggested || {};
        if (typeof TokenFooter !== 'undefined') TokenFooter.onApiResponse(data);

        // Build metadata from suggestions
        const meta = {
          genre: suggested.genre || '', readingLevel: suggested.readingLevel || '',
          language: suggested.language || 'en', promptText: suggested.promptText || '',
          assignmentType: suggested.assignmentType || '', expectedWordCount: suggested.expectedWordCount || '',
          rubricNotes: '', author: '', authorLevel: suggested.authorLevel || '',
          course: '', focusAreas: suggested.focusAreas || '', knownIssues: suggested.knownIssues || '',
          notes: '', updatedAt: new Date().toISOString(),
        };
        await Auth.apiFetch(`/api/projects/${currentProject.id}/files/${encodeURIComponent(f.name)}/meta`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(meta),
        });
        f.meta = meta;
      } catch {}
    }

    btn.innerHTML = '&#10003; Done!';
    btn.style.color = 'var(--teal)';
    btn.style.borderColor = 'var(--teal)';
    await refreshProject();
    setTimeout(() => renderStep0(), 800);
  }

  // ═══════════════════════════════════════════════════════════════════════
  // HELPERS
  // ═══════════════════════════════════════════════════════════════════════

  function screen() { return document.getElementById('s-project'); }

  function header(backLabel, title) {
    return `<div class="proj-detail-header">
      <button class="proj-back-btn">${backLabel}</button>
      <div class="proj-detail-name">${title}</div>
    </div>`;
  }

  function bindUpload(onDone) {
    const trigger = document.getElementById('proj-upload-trigger');
    const input = document.getElementById('proj-file-input');
    if (!trigger || !input) return;
    trigger.addEventListener('click', () => input.click());
    input.addEventListener('change', async () => {
      if (!input.files.length) return;
      const fd = new FormData();
      for (const f of input.files) fd.append('files', f);
      trigger.textContent = 'Uploading…'; trigger.setAttribute('data-i18n', '5ce44dd77dae789f'); trigger.disabled = true;
      try { await Auth.apiFetch(`/api/projects/${currentProject.id}/files`, { method: 'POST', body: fd }); } catch {}
      trigger.textContent = '+ Upload files'; trigger.setAttribute('data-i18n', '62b8e6f34264bfb2'); trigger.disabled = false;
      input.value = '';
      if (onDone) onDone();
    });
  }

  function scoreColor(s) {
    if (s == null) return 'var(--text-tertiary)';
    return s >= 70 ? 'var(--teal)' : s >= 50 ? 'var(--amber)' : 'var(--coral)';
  }

  function countMetaFields(meta) {
    if (!meta) return { filled: 0, total: 13 };
    const fields = ['language','genre','readingLevel','assignmentType','promptText','expectedWordCount','course','rubricNotes','author','authorLevel','focusAreas','knownIssues','notes'];
    const filled = fields.filter(f => meta[f] && meta[f].length > 0).length;
    return { filled, total: fields.length };
  }

  function esc(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }
  /** Escape for use inside HTML attribute values (handles quotes + all Unicode) */
  function escAttr(s) { return esc(s).replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }

  /**
   * Show a suggestion banner when document language differs from UI language.
   */
  function showLanguageSuggestion(container, langCode, langLabel) {
    // Don't show if already dismissed for this language
    if (localStorage.getItem('lang-suggest-dismissed-' + langCode)) return;
    // Check if current UI language matches
    const currentLang = (typeof I18nSelector !== 'undefined' && I18nSelector.getCurrentLang) ? I18nSelector.getCurrentLang() : 'en';
    if (currentLang === langCode) return;

    const existing = container.querySelector('.proj-lang-suggestion');
    if (existing) existing.remove();

    const banner = document.createElement('div');
    banner.className = 'proj-lang-suggestion';
    banner.innerHTML = `
      <span style="font-size:14px">&#127760;</span>
      <div style="flex:1;font-size:12px;line-height:1.5">
        <strong>Document language detected: ${esc(langLabel)}</strong><br>
        <span style="color:var(--text-tertiary)">Would you like to switch the app interface to match?</span>
      </div>
      <button class="proj-upload-btn proj-lang-switch" style="font-size:11px;padding:5px 14px">Switch to ${esc(langLabel.split('/')[0].trim())}</button>
      <button class="proj-lang-dismiss" style="background:none;border:none;color:var(--text-tertiary);cursor:pointer;font-size:14px;padding:2px 4px" title="Dismiss">&times;</button>`;
    container.insertBefore(banner, container.firstChild);

    banner.querySelector('.proj-lang-switch').addEventListener('click', () => {
      if (typeof I18nSelector !== 'undefined' && I18nSelector.switchLang) {
        I18nSelector.switchLang(langCode);
      } else {
        // Fallback: set URL param and reload
        const url = new URL(window.location.href);
        url.searchParams.set('lang', langCode);
        window.location.href = url.toString();
      }
    });

    banner.querySelector('.proj-lang-dismiss').addEventListener('click', () => {
      localStorage.setItem('lang-suggest-dismissed-' + langCode, '1');
      banner.remove();
    });
  }

  /**
   * Quick-start helper: open first project or prompt to create one.
   * @param {string} action - optional: 'drive' to auto-open drive panel after opening project
   */
  function openFirstOrPrompt(action) {
    if (projects.length > 0) {
      openProject(projects[0].id).then(() => {
        if (action === 'drive') {
          const driveBtn = document.getElementById('proj-drive-trigger');
          if (driveBtn) setTimeout(() => driveBtn.click(), 200);
        }
      });
    } else {
      const input = document.getElementById('proj-create-input');
      if (input) { input.scrollIntoView({ behavior: 'smooth', block: 'center' }); input.focus(); }
    }
  }

  return { init, loadProjects, openProject, openFirstOrPrompt };
})();
