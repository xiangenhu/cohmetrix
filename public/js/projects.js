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
        <input class="proj-create-input" id="proj-create-input" placeholder="New project name…">
        <button class="proj-create-btn" id="proj-create-btn">Create</button>
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
      await enrichResults();
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
      await enrichResults();
    } catch {}
  }

  async function enrichResults() {
    for (const r of currentResults) {
      if (!r.sourceFile) {
        try {
          const resp = await Auth.apiFetch(`/api/projects/${currentProject.id}/results/${r.id}`);
          if (resp.ok) { const d = await resp.json(); r.sourceFile = d.sourceFile; r.overallScore = d.overallScore; }
        } catch {}
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // STEP 0: Project Home — two choices
  // ═══════════════════════════════════════════════════════════════════════

  function fileExt(name) { return name.split('.').pop().toUpperCase(); }

  function metaStatus(meta) {
    const mc = countMetaFields(meta);
    if (mc.filled === 0) return { label: 'No metadata', cls: 'status-none', icon: '\u25cb' };
    if (mc.filled < 4) return { label: `${mc.filled}/${mc.total}`, cls: 'status-partial', icon: '\u25d4' };
    if (mc.filled < 8) return { label: `${mc.filled}/${mc.total}`, cls: 'status-good', icon: '\u25d4' };
    return { label: `${mc.filled}/${mc.total}`, cls: 'status-ready', icon: '\u25cf' };
  }

  function configStatus() {
    const cfg = currentProject?.config || {};
    const has = (v) => v && v.length > 0;
    const layers = (cfg.enabledLayers || []).length;
    if (layers === 0) return { ready: false, label: 'No layers selected' };
    return { ready: true, label: `${layers} layers` + (has(cfg.genre) ? ', genre set' : '') + (has(cfg.promptText) ? ', prompt set' : '') };
  }

  function renderStep0() {
    const s = screen();
    const readyFiles = currentFiles.filter(f => countMetaFields(f.meta).filled >= 4);
    const cfgSt = configStatus();
    const canAnalyze = readyFiles.length > 0 && cfgSt.ready;

    s.innerHTML = `
      ${header('&larr; Projects', currentProject.name)}
      <div class="proj-step-body">

        <!-- ═══ FILES TABLE with selection ═══ -->
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
          <div style="font-size:15px;font-weight:600;color:var(--text-primary)">Files</div>
          <span style="font-size:11px;color:var(--text-tertiary)">${currentFiles.length} total, ${readyFiles.length} ready</span>
          <div style="margin-left:auto;display:flex;gap:6px">
            <button class="proj-upload-btn" id="proj-upload-trigger">+ Upload</button>
            <button class="proj-upload-btn" id="proj-drive-trigger" style="background:var(--bg-primary);color:var(--text-secondary);border:0.5px solid var(--border-secondary)">&#9729; Drive</button>
          </div>
          <input type="file" id="proj-file-input" accept=".txt,.docx,.pdf" multiple hidden>
        </div>

        ${currentFiles.length > 0 ? `
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
          <label style="font-size:11px;color:var(--text-secondary);cursor:pointer">
            <input type="checkbox" id="proj-sel-all" ${readyFiles.length > 0 && readyFiles.length === currentFiles.length ? '' : ''}> Select all ready
          </label>
          <span style="font-size:11px;color:var(--text-tertiary)" id="proj-sel-count">0 selected</span>
        </div>
        <table class="proj-file-table">
          <thead>
            <tr>
              <th style="width:28px"></th>
              <th>File</th>
              <th>Type</th>
              <th>Size</th>
              <th>Metadata</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            ${currentFiles.map(f => {
              const mc = countMetaFields(f.meta);
              const isReady = mc.filled >= 4;
              const ms = metaStatus(f.meta);
              return `<tr class="proj-file-table-row${!isReady ? ' proj-file-row-disabled' : ''}" data-editname="${esc(f.name)}">
                <td><input type="checkbox" class="proj-file-check" data-name="${esc(f.name)}" ${!isReady ? 'disabled title="Complete metadata first (min 4 fields)"' : ''}></td>
                <td class="proj-ft-name">${esc(f.name)}</td>
                <td class="proj-ft-type">${fileExt(f.name)}</td>
                <td class="proj-ft-size">${f.sizeLabel || ''}</td>
                <td class="proj-ft-meta ${ms.cls}"><span class="proj-ft-meta-icon">${ms.icon}</span> ${ms.label}</td>
                <td><button class="proj-file-del" data-fname="${esc(f.name)}" title="Delete">&#10005;</button></td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
        ` : '<div class="proj-empty">No files yet. Upload documents or import from Google Drive.</div>'}

        <!-- File metadata editor (hidden) -->
        <div id="proj-file-meta-panel" style="display:none"></div>

        <!-- Google Drive import (hidden) -->
        <div id="proj-drive-panel" style="display:none">
          <div class="upload-card" style="padding:16px">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
              <div class="field-label" style="margin:0">Import from Google Drive</div>
              <button id="proj-drive-close" style="background:none;border:none;color:var(--text-tertiary);cursor:pointer;font-size:16px">&times;</button>
            </div>
            <div id="proj-drive-instructions" style="font-size:12px;color:var(--text-secondary);margin-bottom:10px">Loading…</div>
            <div style="display:flex;gap:8px">
              <input type="text" id="proj-drive-url" placeholder="https://drive.google.com/drive/folders/..." style="flex:1;padding:8px 12px;border:0.5px solid var(--border-tertiary);border-radius:var(--radius-md);font-size:12px;font-family:var(--font-sans);background:var(--bg-secondary);color:var(--text-primary)">
              <button class="proj-upload-btn" id="proj-drive-list-btn">List files</button>
            </div>
            <div id="proj-drive-files" style="margin-top:12px"></div>
          </div>
        </div>

        <!-- ═══ CONFIGURATION ═══ -->
        <div style="display:flex;align-items:center;gap:8px;margin-top:20px;margin-bottom:8px">
          <div style="font-size:15px;font-weight:600;color:var(--text-primary)">Configuration</div>
          <span style="font-size:11px;color:${cfgSt.ready ? 'var(--teal)' : 'var(--coral)'}">${cfgSt.label}</span>
          <button class="nav-btn" id="proj-edit-config" style="margin-left:auto;font-size:11px">Edit</button>
        </div>
        <div class="proj-config-preview">
          ${renderConfigPreview()}
        </div>

        <!-- ═══ ACTIONS ═══ -->
        <div style="display:flex;gap:10px;margin-top:16px;align-items:center">
          <button class="run-btn" id="proj-analyze-selected" disabled style="padding:10px 28px;font-size:13px;opacity:0.5">
            &#9654; Analyze Selected
          </button>
          ${currentResults.length > 0 ? `
          <button class="nav-btn" id="proj-go-results" style="font-size:12px">
            &#128202; Past Results (${currentResults.length})
          </button>` : ''}
        </div>
      </div>`;

    // Bindings
    s.querySelector('#proj-go-results')?.addEventListener('click', () => { if (currentResults.length > 0) renderResultsList(); });
    s.querySelector('.proj-detail-header .proj-back-btn')?.addEventListener('click', () => { App.showScreen('upload'); loadProjects(); });
    s.querySelector('#proj-edit-config')?.addEventListener('click', () => renderConfigEditor());
    bindUpload(() => refreshProject().then(renderStep0));
    bindDriveImport(s);

    // Checkbox selection logic
    const analyzeBtn = s.querySelector('#proj-analyze-selected');
    const selAllCb = s.querySelector('#proj-sel-all');
    const selCountEl = s.querySelector('#proj-sel-count');

    function updateSelectionState() {
      const allChecks = s.querySelectorAll('.proj-file-check:not(:disabled)');
      const checkedChecks = s.querySelectorAll('.proj-file-check:checked');
      const count = checkedChecks.length;
      if (selCountEl) selCountEl.textContent = `${count} selected`;
      if (analyzeBtn) {
        analyzeBtn.disabled = count === 0 || !cfgSt.ready;
        analyzeBtn.style.opacity = (count === 0 || !cfgSt.ready) ? '0.5' : '1';
        analyzeBtn.textContent = count > 0 ? `\u25b6 Analyze ${count} file${count>1?'s':''}` : '\u25b6 Analyze Selected';
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
  }

  function renderConfigPreview() {
    const cfg = currentProject?.config || {};
    const layers = cfg.enabledLayers || [];
    return `
      <div class="proj-cfg-preview-row"><span>Layers</span><strong>${layers.length > 0 ? layers.join(', ') : '<span style="color:var(--coral)">None selected</span>'}</strong></div>
      ${cfg.genre ? `<div class="proj-cfg-preview-row"><span>Genre</span><strong>${cfg.genre}</strong></div>` : ''}
      ${cfg.promptText ? `<div class="proj-cfg-preview-row"><span>Prompt</span><strong>${esc(cfg.promptText).substring(0, 80)}${cfg.promptText.length > 80 ? '…' : ''}</strong></div>` : ''}
      ${cfg.learnerId ? `<div class="proj-cfg-preview-row"><span>Learner ID</span><strong>${esc(cfg.learnerId)}</strong></div>` : ''}
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
      ${header('&larr; Back', 'Edit Configuration')}
      <div class="proj-step-body">
        <div class="proj-step-label">Project-level settings applied to all files during analysis</div>
        <div class="proj-config-form">
          <div>
            <div class="field-label">Analysis layers</div>
            <div class="options-row" style="flex-wrap:wrap;gap:6px">
              ${allLayers.map(l => `<div class="opt-chip${enabled.has(l)?' on':''}" data-layer="${l}"><div class="opt-dot"></div>${l}</div>`).join('')}
            </div>
          </div>
          <div>
            <div class="field-label">Default genre <span style="font-weight:400;color:var(--text-tertiary)">(overridden by per-file metadata)</span></div>
            <select id="proj-cfg-genre" class="proj-input"><option value="">Select genre…</option></select>
          </div>
          <div>
            <div class="field-label">Default prompt <span style="font-weight:400;color:var(--text-tertiary)">(overridden by per-file metadata)</span></div>
            <textarea id="proj-cfg-prompt" class="proj-input" style="height:60px;resize:vertical" placeholder="e.g. Discuss the impact of AI on higher education…">${esc(cfg.promptText||'')}</textarea>
          </div>
          <div>
            <div class="field-label">Learner ID <span style="font-weight:400;color:var(--text-tertiary)">(for L11 reader-adaptive)</span></div>
            <input type="text" id="proj-cfg-learner" class="proj-input" value="${esc(cfg.learnerId||'')}" placeholder="student_4821">
          </div>
          <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:8px">
            <button class="nav-btn" id="proj-cfg-cancel">Cancel</button>
            <button class="proj-upload-btn" id="proj-cfg-save" style="padding:8px 24px">Save configuration</button>
          </div>
        </div>
      </div>`;

    // Populate genres
    fetch('/api/genres').then(r=>r.json()).then(data => {
      const sel = s.querySelector('#proj-cfg-genre');
      (data.categories||[]).forEach(cat => {
        const grp = document.createElement('optgroup');
        grp.label = cat.category;
        cat.genres.forEach(g => {
          const opt = document.createElement('option');
          opt.value = g.id; opt.textContent = g.name;
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
      btn.textContent = 'Saving…'; btn.disabled = true;
      try {
        await Auth.apiFetch(`/api/projects/${currentProject.id}`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ config: newCfg }),
        });
        currentProject.config = newCfg;
        renderStep0();
      } catch { btn.textContent = 'Save configuration'; btn.disabled = false; }
    });
  }

  function openFileMetaEditor(s, filename, meta) {
    const panel = s.querySelector('#proj-file-meta-panel');
    if (!panel) return;
    panel.style.display = '';

    const readingLevels = [
      { value: '', label: 'Not specified' },
      { value: 'elementary', label: 'Elementary (grades 3-5)' },
      { value: 'middle-school', label: 'Middle School (grades 6-8)' },
      { value: 'high-school', label: 'High School (grades 9-12)' },
      { value: 'college', label: 'College (undergraduate)' },
      { value: 'graduate', label: 'Graduate / Professional' },
    ];

    const assignmentTypes = [
      { value: '', label: 'Not specified' },
      { value: 'argumentative', label: 'Argumentative essay' },
      { value: 'expository', label: 'Expository / informational' },
      { value: 'narrative', label: 'Narrative / personal' },
      { value: 'analytical', label: 'Analytical / critical' },
      { value: 'compare-contrast', label: 'Compare & contrast' },
      { value: 'research-paper', label: 'Research paper' },
      { value: 'lab-report', label: 'Lab / technical report' },
      { value: 'reflection', label: 'Reflection / journal' },
      { value: 'creative', label: 'Creative writing' },
      { value: 'summary', label: 'Summary / review' },
      { value: 'other', label: 'Other' },
    ];

    const authorLevels = [
      { value: '', label: 'Not specified' },
      { value: 'esl-beginner', label: 'ESL — Beginner (A1-A2)' },
      { value: 'esl-intermediate', label: 'ESL — Intermediate (B1-B2)' },
      { value: 'esl-advanced', label: 'ESL — Advanced (C1-C2)' },
      { value: 'native-k5', label: 'Native — Elementary (K-5)' },
      { value: 'native-middle', label: 'Native — Middle school (6-8)' },
      { value: 'native-high', label: 'Native — High school (9-12)' },
      { value: 'college-freshman', label: 'College — Freshman/Sophomore' },
      { value: 'college-upper', label: 'College — Junior/Senior' },
      { value: 'graduate', label: 'Graduate student' },
      { value: 'professional', label: 'Professional / faculty' },
    ];

    const metaComplete = countMetaFields(meta);

    panel.innerHTML = `
      <div class="upload-card" style="padding:16px;max-height:70vh;overflow-y:auto">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
          <div class="field-label" style="margin:0;font-size:14px">File: ${esc(filename)}</div>
          <button id="proj-meta-close" style="background:none;border:none;color:var(--text-tertiary);cursor:pointer;font-size:16px">&times;</button>
        </div>
        <div style="font-size:11px;color:var(--text-tertiary);margin-bottom:4px">
          The more complete the metadata, the better the analysis. Each field gives the LLM context that improves accuracy and reduces wasted tokens.
        </div>
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:14px">
          <span style="font-size:11px;color:var(--teal);font-weight:500" class="proj-meta-completeness">Completeness: ${metaComplete.filled} / ${metaComplete.total}</span>
          <button class="proj-upload-btn" id="proj-meta-autodetect" style="margin-left:auto;font-size:11px;padding:5px 14px">
            &#9733; Auto-detect with AI
          </button>
        </div>

        <div style="display:flex;flex-direction:column;gap:12px">
          <!-- Document context -->
          <div style="font-size:11px;font-weight:600;color:var(--text-tertiary);text-transform:uppercase;letter-spacing:0.5px;padding-top:4px">Document context</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
            <div>
              <div class="field-label">Genre</div>
              <select id="proj-meta-genre" class="proj-input"><option value="">Select genre…</option></select>
            </div>
            <div>
              <div class="field-label">Target reading level</div>
              <select id="proj-meta-level" class="proj-input">
                ${readingLevels.map(l => `<option value="${l.value}"${l.value === (meta.readingLevel||'') ? ' selected' : ''}>${l.label}</option>`).join('')}
              </select>
            </div>
          </div>

          <!-- Assignment context -->
          <div style="font-size:11px;font-weight:600;color:var(--text-tertiary);text-transform:uppercase;letter-spacing:0.5px;padding-top:4px;border-top:0.5px solid var(--border-tertiary)">Assignment context</div>
          <div>
            <div class="field-label">Assignment type</div>
            <select id="proj-meta-assignment" class="proj-input">
              ${assignmentTypes.map(a => `<option value="${a.value}"${a.value === (meta.assignmentType||'') ? ' selected' : ''}>${a.label}</option>`).join('')}
            </select>
          </div>
          <div>
            <div class="field-label">Assignment prompt <span style="font-weight:400;color:var(--text-tertiary)">(the writing task given to the student)</span></div>
            <textarea id="proj-meta-prompt" class="proj-input" style="height:50px;resize:vertical" placeholder="e.g. Compare two theories of language acquisition. Discuss strengths and weaknesses of each, using at least 3 peer-reviewed sources. 1000-1500 words.">${esc(meta.promptText||'')}</textarea>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
            <div>
              <div class="field-label">Expected word count</div>
              <input type="text" id="proj-meta-wordcount" class="proj-input" value="${esc(meta.expectedWordCount||'')}" placeholder="e.g. 800-1000">
            </div>
            <div>
              <div class="field-label">Course / class</div>
              <input type="text" id="proj-meta-course" class="proj-input" value="${esc(meta.course||'')}" placeholder="e.g. ENG 101, Fall 2026">
            </div>
          </div>
          <div>
            <div class="field-label">Rubric criteria <span style="font-weight:400;color:var(--text-tertiary)">(key grading dimensions)</span></div>
            <textarea id="proj-meta-rubric" class="proj-input" style="height:50px;resize:vertical" placeholder="e.g. Thesis clarity (20%), Evidence use (25%), Organization (20%), Language (20%), Mechanics (15%)">${esc(meta.rubricNotes||'')}</textarea>
          </div>

          <!-- Author context -->
          <div style="font-size:11px;font-weight:600;color:var(--text-tertiary);text-transform:uppercase;letter-spacing:0.5px;padding-top:4px;border-top:0.5px solid var(--border-tertiary)">Author context</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
            <div>
              <div class="field-label">Author / Student ID</div>
              <input type="text" id="proj-meta-author" class="proj-input" value="${esc(meta.author||'')}" placeholder="e.g. student_4821">
            </div>
            <div>
              <div class="field-label">Author level</div>
              <select id="proj-meta-authorlevel" class="proj-input">
                ${authorLevels.map(a => `<option value="${a.value}"${a.value === (meta.authorLevel||'') ? ' selected' : ''}>${a.label}</option>`).join('')}
              </select>
            </div>
          </div>

          <!-- Analysis hints -->
          <div style="font-size:11px;font-weight:600;color:var(--text-tertiary);text-transform:uppercase;letter-spacing:0.5px;padding-top:4px;border-top:0.5px solid var(--border-tertiary)">Analysis hints</div>
          <div>
            <div class="field-label">Focus areas <span style="font-weight:400;color:var(--text-tertiary)">(what to pay special attention to)</span></div>
            <input type="text" id="proj-meta-focus" class="proj-input" value="${esc(meta.focusAreas||'')}" placeholder="e.g. argumentation quality, use of evidence, paragraph transitions">
          </div>
          <div>
            <div class="field-label">Known issues <span style="font-weight:400;color:var(--text-tertiary)">(pre-identified concerns)</span></div>
            <input type="text" id="proj-meta-issues" class="proj-input" value="${esc(meta.knownIssues||'')}" placeholder="e.g. weak thesis, repetitive vocabulary, off-topic in section 3">
          </div>
          <div>
            <div class="field-label">Additional notes</div>
            <textarea id="proj-meta-notes" class="proj-input" style="height:50px;resize:vertical" placeholder="Any other context that helps interpretation…">${esc(meta.notes||'')}</textarea>
          </div>

          <div style="display:flex;gap:8px;justify-content:flex-end;padding-top:8px;border-top:0.5px solid var(--border-tertiary)">
            <button class="nav-btn" id="proj-meta-cancel">Cancel</button>
            <button class="proj-upload-btn" id="proj-meta-save">Save metadata</button>
          </div>
        </div>
      </div>`;

    // Populate genres
    fetch('/api/genres').then(r => r.json()).then(data => {
      const sel = panel.querySelector('#proj-meta-genre');
      (data.categories || []).forEach(cat => {
        const grp = document.createElement('optgroup');
        grp.label = cat.category;
        cat.genres.forEach(g => {
          const opt = document.createElement('option');
          opt.value = g.id; opt.textContent = g.name;
          if (g.id === (meta.genre || '')) opt.selected = true;
          grp.appendChild(opt);
        });
        sel.appendChild(grp);
      });
    }).catch(() => {});

    // Close
    panel.querySelector('#proj-meta-close').addEventListener('click', () => { panel.style.display = 'none'; });
    panel.querySelector('#proj-meta-cancel').addEventListener('click', () => { panel.style.display = 'none'; });

    // Auto-detect with AI
    panel.querySelector('#proj-meta-autodetect').addEventListener('click', async () => {
      const btn = panel.querySelector('#proj-meta-autodetect');
      btn.textContent = 'Analyzing file…'; btn.disabled = true;
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

        selectIfEmpty('#proj-meta-genre', s.genre);
        selectIfEmpty('#proj-meta-level', s.readingLevel);
        selectIfEmpty('#proj-meta-assignment', s.assignmentType);
        setIfEmpty('#proj-meta-prompt', s.promptText);
        setIfEmpty('#proj-meta-wordcount', s.expectedWordCount);
        selectIfEmpty('#proj-meta-authorlevel', s.authorLevel);
        setIfEmpty('#proj-meta-focus', s.focusAreas);
        setIfEmpty('#proj-meta-issues', s.knownIssues);

        // Auto-save after populating
        btn.textContent = 'Saving…';
        const autoMeta = {
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

        btn.textContent = 'Detected & saved!';
        btn.style.background = 'var(--teal-light)';
        btn.style.color = '#065F46';
        // Update completeness display
        const mc = countMetaFields(autoMeta);
        const compEl = panel.querySelector('.proj-meta-completeness');
        if (compEl) compEl.textContent = `Completeness: ${mc.filled} / ${mc.total}`;

        setTimeout(() => {
          btn.textContent = '\u2733 Auto-detect with AI';
          btn.style.background = ''; btn.style.color = '';
          btn.disabled = false;
        }, 2000);
      } catch (err) {
        alert('Auto-detect failed: ' + err.message);
        btn.textContent = '\u2733 Auto-detect with AI'; btn.disabled = false;
      }
    });

    // Save
    panel.querySelector('#proj-meta-save').addEventListener('click', async () => {
      const newMeta = {
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
      saveBtn.textContent = 'Saving…'; saveBtn.disabled = true;
      try {
        await Auth.apiFetch(`/api/projects/${currentProject.id}/files/${encodeURIComponent(filename)}/meta`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newMeta),
        });
        // Update local data immediately
        const localFile = currentFiles.find(f => f.name === filename);
        if (localFile) localFile.meta = newMeta;
        saveBtn.textContent = 'Saved!';
        setTimeout(() => {
          panel.style.display = 'none';
          renderStep0();
        }, 500);
      } catch {
        saveBtn.textContent = 'Save metadata'; saveBtn.disabled = false;
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
      ${header('&larr; Back', 'Step 1 of 2: Select Files')}
      <div class="proj-step-body">
        <div class="proj-step-label">${readyFiles.length} of ${currentFiles.length} files ready for analysis</div>
        ${readyFiles.length > 0 ? `
        <div style="margin-bottom:8px">
          <label style="font-size:12px;color:var(--text-secondary);cursor:pointer">
            <input type="checkbox" id="proj-sel-all" ${selectedFiles.length===readyFiles.length?'checked':''}> Select all ready (${readyFiles.length})
          </label>
        </div>` : ''}
        <div class="proj-file-list">
          ${currentFiles.map(f => {
            const mc = countMetaFields(f.meta);
            const isReady = mc.filled >= 4;
            const ms = metaStatus(f.meta);
            return `<div class="proj-file-row${!isReady ? ' proj-file-row-disabled' : ''}">
              <input type="checkbox" class="proj-file-check" data-name="${esc(f.name)}" ${isReady && selectedFiles.includes(f.name) ? 'checked' : ''} ${!isReady ? 'disabled' : ''}>
              <span class="proj-file-name">${esc(f.name)}</span>
              <span class="proj-ft-meta ${ms.cls}" style="font-size:10px"><span class="proj-ft-meta-icon">${ms.icon}</span> ${ms.label}</span>
              <span class="proj-file-size">${f.sizeLabel||''}</span>
            </div>`;
          }).join('')}
        </div>
        ${notReady.length > 0 ? `
        <div style="margin-top:8px;font-size:11px;color:var(--amber)">
          ${notReady.length} file${notReady.length>1?'s':''} need more metadata (min 4 fields). Go back to fill in.
        </div>` : ''}
        <div class="proj-step-nav">
          <div></div>
          <button class="proj-next-btn" id="proj-next1" ${readyFiles.length===0?'disabled':''}>Next: Review &amp; Estimate &rarr;</button>
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
      ${header('&larr; Back', 'Step 2 of 3: Configure')}
      <div class="proj-step-body">
        <div class="proj-step-label">${selectedFiles.length} file${selectedFiles.length>1?'s':''} selected</div>
        <div class="proj-config-form">
          <div>
            <div class="field-label">Analysis layers</div>
            <div class="options-row" style="flex-wrap:wrap;gap:6px">
              ${allLayers.map(l => `<div class="opt-chip${enabled.has(l)?' on':''}" data-layer="${l}"><div class="opt-dot"></div>${l}</div>`).join('')}
            </div>
          </div>
          <div>
            <div class="field-label">Assignment prompt <span style="font-weight:400;color:var(--text-tertiary)">(optional)</span></div>
            <input type="text" id="proj-cfg-prompt" value="${esc(cfg.promptText||'')}" placeholder="e.g. Discuss the impact of AI…" class="proj-input">
          </div>
          <div>
            <div class="field-label">Genre <span style="font-weight:400;color:var(--text-tertiary)">(optional)</span></div>
            <select id="proj-cfg-genre" class="proj-input"><option value="">Select genre…</option></select>
          </div>
          <div>
            <div class="field-label">Learner ID <span style="font-weight:400;color:var(--text-tertiary)">(for L11)</span></div>
            <input type="text" id="proj-cfg-learner" value="${esc(cfg.learnerId||'')}" placeholder="student_4821" class="proj-input">
          </div>
        </div>
        <div class="proj-step-nav">
          <div></div>
          <button class="proj-next-btn" id="proj-next2">Next: Review &amp; Estimate &rarr;</button>
        </div>
      </div>`;

    // Populate genres
    fetch('/api/genres').then(r=>r.json()).then(data => {
      const sel = s.querySelector('#proj-cfg-genre');
      (data.categories||[]).forEach(cat => {
        const grp = document.createElement('optgroup');
        grp.label = cat.category;
        cat.genres.forEach(g => {
          const opt = document.createElement('option');
          opt.value = g.id; opt.textContent = g.name;
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
      ${header('&larr; Back', 'Review &amp; Run')}
      <div class="proj-step-body">
        <div class="proj-step-label">Review your analysis setup</div>

        <div class="proj-review-card">
          <div class="proj-review-row"><span>Files</span><strong>${selectedFiles.length}</strong></div>
          <div class="proj-review-files">${selectedFiles.map(f => `<span class="proj-file-chip">${esc(f)}</span>`).join('')}</div>
          <div class="proj-review-row"><span>Layers</span><strong>${(wizardConfig.enabledLayers||[]).join(', ')}</strong></div>
          ${wizardConfig.promptText ? `<div class="proj-review-row"><span>Prompt</span><strong>${esc(wizardConfig.promptText)}</strong></div>` : ''}
          ${wizardConfig.genre ? `<div class="proj-review-row"><span>Genre</span><strong>${wizardConfig.genre}</strong></div>` : ''}
        </div>

        <div id="proj-cost-area" class="proj-cost-loading">Estimating cost…</div>

        <div class="proj-step-nav">
          <div></div>
          <button class="proj-next-btn proj-run-btn-big" id="proj-run" disabled>Waiting for estimate…</button>
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
        <div class="proj-cost-total">Estimated cost: ~$${data.estimatedCost.toFixed(3)}</div>
        <div class="proj-cost-row"><span>Total words</span><strong>${data.totalWords.toLocaleString()}</strong></div>
        <div class="proj-cost-row"><span>Estimated tokens</span><strong>${data.totalEstimatedTokens.toLocaleString()}</strong></div>
        <div class="proj-cost-row"><span>LLM calls per file</span><strong>${data.llmCallsPerFile}</strong></div>
        <div style="margin-top:8px;font-size:10px;color:var(--text-tertiary)">
          ${data.pricing.promptPer1M ? `$${data.pricing.promptPer1M}/M input · $${data.pricing.completionPer1M}/M output` : ''}
        </div>`;

      const runBtn = s.querySelector('#proj-run');
      runBtn.disabled = false;
      runBtn.textContent = `Run Analysis ($${data.estimatedCost.toFixed(3)}) \u2192`;
      runBtn.addEventListener('click', () => runBatchAnalysis());
    } catch (err) {
      s.querySelector('#proj-cost-area').textContent = 'Could not estimate cost.';
      const runBtn = s.querySelector('#proj-run');
      runBtn.disabled = false;
      runBtn.textContent = 'Run Analysis \u2192';
      runBtn.addEventListener('click', () => runBatchAnalysis());
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // STEP 4: Run (processing screen)
  // ═══════════════════════════════════════════════════════════════════════

  async function runBatchAnalysis() {
    const isSingle = selectedFiles.length === 1;
    let singleResult = null;

    App.showScreen('process');
    App.enableNav('btn-process');

    if (isSingle) {
      // Use the nice processing UI with layer progress bars
      Processing.initUI();
      document.getElementById('proc-title').textContent = `Analyzing: ${selectedFiles[0]}`;
      document.getElementById('proc-sub').textContent = 'Preparing analysis modules';
    } else {
      const procTitle = document.getElementById('proc-title');
      const procSub = document.getElementById('proc-sub');
      const procLog = document.getElementById('proc-log');
      if (procTitle) procTitle.textContent = `Analyzing ${selectedFiles.length} files`;
      if (procSub) procSub.textContent = 'Results will be saved to the project\u2019s Past Results when complete.';
      if (procLog) procLog.innerHTML = '';
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
              handleBatchEvent(evt);
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
      document.getElementById('spinner').style.display = 'none';
      document.getElementById('proc-title').textContent = isSingle ? 'Analysis failed' : 'Failed';
      document.getElementById('proc-sub').textContent = err.message;
    }
  }

  /** Single-file: use the full layer-progress UI (same as non-project analysis) */
  function handleSingleEvent(evt) {
    const procTitle = document.getElementById('proc-title');
    const procSub = document.getElementById('proc-sub');

    switch (evt.type) {
      case 'layer_start':
        if (procTitle) procTitle.textContent = `Analyzing ${evt.layerName || evt.layerId}…`;
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
        if (procTitle) procTitle.textContent = 'Analysis complete';
        if (procSub) procSub.textContent = `Score: ${evt.overallScore}/100`;
        if (evt.tokenUsage) {
          Processing.updateTokenDisplay(evt.tokenUsage);
        }
        break;
      case 'batch_file_error':
        document.getElementById('spinner').style.display = 'none';
        if (procTitle) procTitle.textContent = 'Analysis failed';
        if (procSub) procSub.textContent = evt.error;
        break;
    }
  }

  /** Multi-file: simple text log */
  function handleBatchEvent(evt) {
    const procTitle = document.getElementById('proc-title');
    const procSub = document.getElementById('proc-sub');
    const procLog = document.getElementById('proc-log');

    switch (evt.type) {
      case 'batch_file_start':
        if (procTitle) procTitle.textContent = `File ${evt.fileIndex+1} of ${evt.totalFiles}: ${evt.fileName}`;
        if (procSub) procSub.textContent = 'Initializing…';
        break;
      case 'init': case 'log':
        if (procSub) procSub.textContent = evt.message || '';
        addLog(procLog, `[${evt.fileName||''}] ${evt.message||''}`, 'var(--text-tertiary)');
        break;
      case 'layer_done':
        if (procSub) procSub.textContent = `${evt.layerName||evt.layerId} done (${evt.score}/100)`;
        break;
      case 'batch_file_done':
        addLog(procLog, `\u2713 ${evt.fileName}: score ${evt.overallScore}`, 'var(--teal)', true);
        break;
      case 'batch_file_error':
        addLog(procLog, `\u2717 ${evt.fileName}: ${evt.error}`, 'var(--coral)', true);
        break;
      case 'batch_complete':
        if (procTitle) procTitle.textContent = 'Analysis complete';
        if (procSub) procSub.textContent = `${(evt.results||[]).length} file${(evt.results||[]).length!==1?'s':''} analyzed`;
        if (procLog) {
          const div = document.createElement('div');
          div.style.cssText = 'margin-top:16px;display:flex;gap:8px';
          const btn = document.createElement('button');
          btn.textContent = '\u2190 View results in project';
          btn.className = 'run-btn';
          btn.style.cssText = 'font-size:13px;padding:10px 24px';
          btn.addEventListener('click', async () => {
            await refreshProject();
            App.showScreen('project');
            renderResultsList();
          });
          div.appendChild(btn);
          procLog.appendChild(div);
        }
        break;
    }
  }

  function addLog(el, text, color, bold) {
    if (!el) return;
    const d = document.createElement('div');
    d.textContent = text;
    d.style.cssText = `font-size:${bold?'11':'10'}px;color:${color};${bold?'font-weight:500':''}`;
    el.appendChild(d); el.scrollTop = el.scrollHeight;
  }

  // ═══════════════════════════════════════════════════════════════════════
  // RESULTS LIST
  // ═══════════════════════════════════════════════════════════════════════

  function renderResultsList() {
    const s = screen();
    s.innerHTML = `
      ${header('&larr; ' + esc(currentProject.name), 'Past Results')}
      <div class="proj-step-body">
        ${currentResults.length === 0
          ? '<div class="proj-empty">No results yet. Run a New Analysis first.</div>'
          : currentResults.map(r => `
            <div class="proj-result-row" data-rid="${r.id}">
              <span class="proj-result-file">${esc(r.sourceFile||r.id)}</span>
              <span class="proj-result-score" style="color:${scoreColor(r.overallScore)}">${r.overallScore!=null?r.overallScore:'\u2014'}</span>
              <span class="proj-result-date">${r.updated ? new Date(r.updated).toLocaleDateString() : ''}</span>
              <button class="proj-result-del" data-rdel="${r.id}" title="Delete">&#10005;</button>
            </div>`).join('')
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
          <div style="margin-bottom:8px">Share your Google Drive folder with this service account:</div>
          <div style="display:flex;align-items:center;gap:8px;padding:8px 12px;background:var(--bg-secondary);border:0.5px solid var(--border-tertiary);border-radius:var(--radius-md);margin-bottom:8px">
            <code style="flex:1;font-size:12px;color:var(--teal);word-break:break-all">${esc(data.serviceAccountEmail)}</code>
            <button onclick="navigator.clipboard.writeText('${data.serviceAccountEmail}');this.textContent='Copied!';setTimeout(()=>this.textContent='Copy',1500)" style="font-size:10px;padding:3px 10px;border:0.5px solid var(--border-tertiary);border-radius:4px;background:var(--bg-primary);color:var(--text-secondary);cursor:pointer">Copy</button>
          </div>
          <div style="font-size:11px;color:var(--text-tertiary);line-height:1.6">
            <strong>How:</strong> In Google Drive, right-click your folder → Share → Add the email above as <strong>Viewer</strong>.<br>
            <strong>Why:</strong> This gives NeoCohMetrix read-only access to copy files into your project. Your files stay on Google Drive — we only copy what you select.<br>
            <strong>After import:</strong> You can remove sharing access from the service account. Once files are copied to your project, the Drive link is no longer needed.
          </div>`;
      } else {
        instrEl.textContent = data.instructions || 'Google Drive import is not configured.';
      }
    } catch {
      instrEl.textContent = 'Could not load sharing instructions.';
    }
  }

  async function listDriveFiles(s) {
    const urlInput = s.querySelector('#proj-drive-url');
    const filesDiv = s.querySelector('#proj-drive-files');
    const listBtn = s.querySelector('#proj-drive-list-btn');
    if (!urlInput || !filesDiv) return;

    const folderUrl = urlInput.value.trim();
    if (!folderUrl) { alert('Paste a Google Drive folder link.'); return; }

    listBtn.textContent = 'Loading…'; listBtn.disabled = true;
    filesDiv.innerHTML = '<div style="font-size:12px;color:var(--text-tertiary);padding:8px 0">Scanning folder…</div>';

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
        filesDiv.innerHTML = '<div style="font-size:12px;color:var(--text-tertiary);padding:8px 0">No supported files found (.txt, .docx, .pdf, Google Docs).</div>';
        return;
      }

      filesDiv.innerHTML = `
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
          <span style="font-size:11px;color:var(--text-tertiary)">${data.supported} file${data.supported!==1?'s':''} found</span>
          <label style="font-size:11px;color:var(--text-secondary);cursor:pointer;margin-left:auto">
            <input type="checkbox" id="proj-drive-sel-all" checked> Select all
          </label>
        </div>
        <div style="display:flex;flex-direction:column;gap:4px">
          ${data.files.map(f => `
            <div class="proj-file-row">
              <input type="checkbox" class="proj-drive-check" data-id="${f.id}" data-name="${esc(f.name)}" data-mime="${f.mimeType}" data-gdoc="${f.isGoogleDoc}" checked>
              <span class="proj-file-name">${esc(f.name)}${f.isGoogleDoc ? ' <span style="font-size:9px;color:var(--text-tertiary)">(Google Doc &rarr; .docx)</span>' : ''}</span>
              <span class="proj-file-size">${f.sizeLabel}</span>
            </div>
          `).join('')}
        </div>
        <div style="margin-top:10px;text-align:right">
          <button class="proj-upload-btn" id="proj-drive-import-btn">Import selected</button>
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
      listBtn.textContent = 'List files'; listBtn.disabled = false;
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
    importBtn.textContent = `Importing ${files.length}…`; importBtn.disabled = true;

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
      importBtn.textContent = 'Import selected'; importBtn.disabled = false;
    }
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
      trigger.textContent = 'Uploading…'; trigger.disabled = true;
      try { await Auth.apiFetch(`/api/projects/${currentProject.id}/files`, { method: 'POST', body: fd }); } catch {}
      trigger.textContent = '+ Upload files'; trigger.disabled = false;
      input.value = '';
      if (onDone) onDone();
    });
  }

  function scoreColor(s) {
    if (s == null) return 'var(--text-tertiary)';
    return s >= 70 ? 'var(--teal)' : s >= 50 ? 'var(--amber)' : 'var(--coral)';
  }

  function countMetaFields(meta) {
    if (!meta) return { filled: 0, total: 12 };
    const fields = ['genre','readingLevel','assignmentType','promptText','expectedWordCount','course','rubricNotes','author','authorLevel','focusAreas','knownIssues','notes'];
    const filled = fields.filter(f => meta[f] && meta[f].length > 0).length;
    return { filled, total: fields.length };
  }

  function esc(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }

  return { init, loadProjects, openProject };
})();
