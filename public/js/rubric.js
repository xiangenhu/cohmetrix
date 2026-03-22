/**
 * Rubric — Rubric Library + full Review tab.
 *
 * The rubric library and rubric input live on the Review screen (not Upload).
 * After analysis completes, the Review tab is enabled. User selects/pastes
 * a rubric there, clicks Evaluate, and gets a full rubric-based review.
 */
const Rubric = (() => {
  let savedRubrics = [];
  let selectedRubric = null;
  let currentAnalysisId = null;
  let currentAnalysisData = null;
  let currentEvaluation = null;
  let activeCriterionIdx = 0;
  let libLoaded = false;

  // ─── Init ──────────────────────────────────────────────────────────────────

  function init() {
    // Review screen nav
    const btnResults = document.getElementById('rv-btn-results');
    if (btnResults) btnResults.addEventListener('click', () => App.showScreen('results'));
    const btnNew = document.getElementById('rv-btn-new');
    if (btnNew) btnNew.addEventListener('click', () => { App.showScreen('upload'); App.resetNavigation(); });

    // Evaluate button
    const evalBtn = document.getElementById('rubric-evaluate-btn');
    if (evalBtn) evalBtn.addEventListener('click', runEvaluation);

    // Library upload/refresh
    bindLibraryToolbar();
  }

  function bindLibraryToolbar() {
    const uploadBtn = document.getElementById('rubric-lib-upload-btn');
    const fileInput = document.getElementById('rubric-lib-file-input');
    if (uploadBtn && fileInput) {
      uploadBtn.addEventListener('click', () => fileInput.click());
      fileInput.addEventListener('change', () => {
        if (fileInput.files.length) uploadRubric(fileInput.files[0]);
        fileInput.value = '';
      });
    }
    const refreshBtn = document.getElementById('rubric-lib-refresh-btn');
    if (refreshBtn) refreshBtn.addEventListener('click', loadRubrics);
  }

  // ─── Rubric Library ────────────────────────────────────────────────────────

  async function loadRubrics() {
    const listEl = document.getElementById('rv-rubric-list');
    if (!listEl) return;
    listEl.innerHTML = '<div class="library-loading">Loading…</div>';

    try {
      const resp = await Auth.apiFetch('/api/rubrics');
      if (!resp.ok) throw new Error('Failed');
      const data = await resp.json();
      savedRubrics = data.rubrics || [];
      libLoaded = true;
      renderLibraryList();
    } catch {
      listEl.innerHTML = '<div class="library-empty" style="padding:12px">No rubrics yet</div>';
    }
  }

  function renderLibraryList() {
    const listEl = document.getElementById('rv-rubric-list');
    if (!listEl) return;

    if (savedRubrics.length === 0) {
      listEl.innerHTML = '<div class="library-empty" style="padding:12px;font-size:11px">No rubrics saved. Upload or paste one.</div>';
      return;
    }

    listEl.innerHTML = savedRubrics.map((r, i) => {
      const isSelected = selectedRubric && selectedRubric.id === r.id;
      return `
        <div class="layer-item${isSelected ? ' active' : ''}" data-idx="${i}" style="cursor:pointer">
          <span class="li-badge" style="font-size:12px">&#128209;</span>
          <span class="li-name">${escapeHtml(r.name)}</span>
          <button class="lib-action-btn delete" data-idx="${i}" title="Delete" style="opacity:0">&#10005;</button>
        </div>`;
    }).join('');

    listEl.querySelectorAll('.layer-item').forEach(el => {
      el.addEventListener('click', (e) => {
        if (e.target.closest('.lib-action-btn')) return;
        selectRubric(parseInt(el.dataset.idx, 10));
      });
      el.addEventListener('mouseenter', () => { const d = el.querySelector('.delete'); if (d) d.style.opacity = '1'; });
      el.addEventListener('mouseleave', () => { const d = el.querySelector('.delete'); if (d) d.style.opacity = '0'; });
    });

    listEl.querySelectorAll('.lib-action-btn.delete').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        deleteRubric(parseInt(btn.dataset.idx, 10));
      });
    });
  }

  async function selectRubric(idx) {
    const r = savedRubrics[idx];
    if (!r) return;
    try {
      const resp = await Auth.apiFetch(`/api/rubrics/${r.id}`);
      if (!resp.ok) throw new Error('Failed');
      const rubric = await resp.json();
      selectedRubric = { id: rubric.id, name: rubric.name, text: rubric.text };
      document.getElementById('rubric-text').value = rubric.text;
      document.getElementById('rubric-selected-name').textContent = rubric.name;
      renderLibraryList();
    } catch (err) {
      console.error('Failed to load rubric:', err);
    }
  }

  async function uploadRubric(file) {
    const formData = new FormData();
    formData.append('file', file);
    try {
      const resp = await Auth.apiFetch('/api/rubrics', { method: 'POST', body: formData });
      if (!resp.ok) throw new Error('Upload failed');
      const data = await resp.json();
      await loadRubrics();
      const found = savedRubrics.findIndex(r => r.id === data.id);
      if (found >= 0) selectRubric(found);
    } catch (err) {
      alert('Upload failed: ' + err.message);
    }
  }

  async function deleteRubric(idx) {
    const r = savedRubrics[idx];
    if (!r || !confirm(`Delete rubric "${r.name}"?`)) return;
    try {
      await Auth.apiFetch(`/api/rubrics/${r.id}`, { method: 'DELETE' });
      if (selectedRubric?.id === r.id) {
        selectedRubric = null;
        document.getElementById('rubric-text').value = '';
        document.getElementById('rubric-selected-name').textContent = '';
      }
      await loadRubrics();
    } catch (err) {
      alert('Delete failed: ' + err.message);
    }
  }

  function getRubricText() {
    return document.getElementById('rubric-text')?.value?.trim() || '';
  }

  // ─── Setup for results ─────────────────────────────────────────────────────

  function setupForResults(analysisId, analysisData) {
    currentAnalysisId = analysisId;
    currentAnalysisData = analysisData;

    // Always enable Review tab when we have results
    App.enableNav('btn-review');

    // Load rubric library
    if (!libLoaded) loadRubrics();

    // If already has rubric evaluation, render it
    if (analysisData?.rubricEvaluation?.success) {
      currentEvaluation = analysisData.rubricEvaluation.evaluation;
      renderReviewResults();
    }
  }

  // ─── Evaluation ────────────────────────────────────────────────────────────

  function triggerEvaluate() { runEvaluation(); }

  async function runEvaluation() {
    const rubricText = getRubricText();
    if (!rubricText) {
      alert('Please select a rubric from the library or paste rubric criteria first.');
      return;
    }
    if (!currentAnalysisId) {
      alert('No analysis results available. Run an analysis first.');
      return;
    }

    const evalBtn = document.getElementById('rubric-evaluate-btn');
    const status = document.getElementById('rubric-evaluate-status');
    if (evalBtn) evalBtn.disabled = true;
    if (status) status.textContent = 'Evaluating…';

    // Show loading in center panel
    const cp = document.getElementById('rv-center-panel');
    const inputArea = document.getElementById('rv-rubric-input-area');
    if (inputArea) inputArea.style.display = 'none';
    cp.innerHTML = `
      <div style="text-align:center;padding:60px;color:var(--text-tertiary)">
        <div class="proc-spinner" style="margin:0 auto 16px;width:24px;height:24px;border:2px solid var(--teal-light);border-top-color:var(--teal)"></div>
        <div style="font-size:14px">Evaluating essay against rubric…</div>
        <div style="font-size:11px;margin-top:4px">This may take 10–20 seconds</div>
      </div>`;

    try {
      const resp = await Auth.apiFetch('/api/rubrics/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ analysisId: currentAnalysisId, rubricText }),
      });

      if (!resp.ok) throw new Error((await resp.json()).error || 'Evaluation failed');
      const result = await resp.json();

      if (result.success) {
        currentEvaluation = result.evaluation;
        renderReviewResults();
        if (status) status.textContent = '';
        if (evalBtn) evalBtn.textContent = 'Re-evaluate';
      } else {
        throw new Error(result.error);
      }
    } catch (err) {
      if (status) status.textContent = 'Failed: ' + err.message;
      // Restore input area
      if (inputArea) inputArea.style.display = '';
      cp.innerHTML = '';
      cp.appendChild(inputArea);
    }

    if (evalBtn) evalBtn.disabled = false;
  }

  // ─── Render review results ─────────────────────────────────────────────────

  function renderReviewResults() {
    if (!currentEvaluation) return;
    const ev = currentEvaluation;
    activeCriterionIdx = 0;

    const pctTotal = ev.total_max > 0 ? Math.round(ev.total_score / ev.total_max * 100) : 0;
    const totalColor = pctTotal >= 75 ? '#059669' : pctTotal >= 60 ? '#D97706' : '#BE3A4A';

    // Stats bar
    document.getElementById('rv-total-score').textContent = `${ev.total_score}/${ev.total_max} (${pctTotal}%)`;
    document.getElementById('rv-total-score').style.color = totalColor;
    document.getElementById('rv-criteria-count').textContent = ev.criteria?.length || 0;
    document.getElementById('rv-cohesion-score').textContent = currentAnalysisData?.overallScore ?? '—';
    document.getElementById('rv-words').textContent = currentAnalysisData?.document?.wordCount ?? '—';
    document.getElementById('rv-time').textContent = currentAnalysisData?.analysisTime ? currentAnalysisData.analysisTime.toFixed(1) + 's' : '—';

    // Right: big score
    document.getElementById('rv-score-big').textContent = pctTotal;
    document.getElementById('rv-score-big').style.color = totalColor;
    document.getElementById('rv-score-sub').textContent = `${ev.total_score} / ${ev.total_max}`;

    // Right: score bars
    document.getElementById('rv-score-bars').innerHTML = (ev.criteria || []).map(c => {
      const pct = c.max_score > 0 ? Math.round(c.awarded_score / c.max_score * 100) : 0;
      const color = pct >= 75 ? '#059669' : pct >= 60 ? '#D97706' : '#BE3A4A';
      return `<div style="margin-bottom:8px">
        <div style="display:flex;justify-content:space-between;font-size:10px;margin-bottom:2px">
          <span style="color:var(--text-secondary)">${escapeHtml(c.criterion_name)}</span>
          <span style="font-family:var(--font-mono);font-weight:500;color:${color}">${c.awarded_score}/${c.max_score}</span>
        </div>
        <div style="height:4px;border-radius:2px;background:var(--border-tertiary);overflow:hidden">
          <div style="height:100%;width:${pct}%;background:${color};border-radius:2px;transition:width 0.4s"></div>
        </div>
      </div>`;
    }).join('');

    // Right: narrative
    document.getElementById('rv-narrative-text').textContent = ev.overall_narrative || 'No overall assessment generated.';

    // Sidebar: criteria list
    renderCriteriaList();

    // Center: first criterion detail
    renderCriterionDetail(0);
  }

  function renderCriteriaList() {
    const list = document.getElementById('rv-criteria-list');
    if (!currentEvaluation) return;

    list.innerHTML = (currentEvaluation.criteria || []).map((c, i) => {
      const pct = c.max_score > 0 ? Math.round(c.awarded_score / c.max_score * 100) : 0;
      const cls = pct >= 75 ? 'score-hi' : pct >= 60 ? 'score-mid' : 'score-lo';
      return `
        <div class="layer-item${i === activeCriterionIdx ? ' active' : ''}" data-idx="${i}">
          <span class="li-badge" style="font-size:11px">${i + 1}</span>
          <span class="li-name">${escapeHtml(c.criterion_name)}</span>
          <span class="li-score ${cls}">${c.awarded_score}/${c.max_score}</span>
        </div>`;
    }).join('');

    list.querySelectorAll('.layer-item').forEach(el => {
      el.addEventListener('click', () => {
        const idx = parseInt(el.dataset.idx, 10);
        activeCriterionIdx = idx;
        list.querySelectorAll('.layer-item').forEach((e, j) => e.classList.toggle('active', j === idx));
        renderCriterionDetail(idx);
      });
    });
  }

  function renderCriterionDetail(idx) {
    const c = currentEvaluation?.criteria?.[idx];
    if (!c) return;

    const cp = document.getElementById('rv-center-panel');
    const pct = c.max_score > 0 ? Math.round(c.awarded_score / c.max_score * 100) : 0;
    const color = pct >= 75 ? '#059669' : pct >= 60 ? '#D97706' : '#BE3A4A';

    const strengthsHtml = (c.strengths || []).map(s =>
      `<div class="fb-item"><div class="fb-dot" style="background:#059669"></div><div>${escapeHtml(s)}</div></div>`
    ).join('') || '<div style="font-size:11px;color:var(--text-tertiary)">None noted</div>';

    const improvementsHtml = (c.improvements || []).map(s =>
      `<div class="fb-item"><div class="fb-dot" style="background:var(--amber)"></div><div>${escapeHtml(s)}</div></div>`
    ).join('') || '<div style="font-size:11px;color:var(--text-tertiary)">None noted</div>';

    const metricsHtml = (c.relevant_metrics || []).map(m =>
      `<span class="criterion-metric-tag">${m}</span>`
    ).join('');

    cp.innerHTML = `
      <div class="cp-header">
        <div class="cp-layer-name">${escapeHtml(c.criterion_name)}</div>
        <div class="cp-layer-tag">score: <strong style="color:${color}">${c.awarded_score}/${c.max_score}</strong> (${pct}%)</div>
      </div>
      <div class="criterion-score-bar" style="height:6px;margin-bottom:16px">
        <div class="criterion-score-fill" style="width:${pct}%;background:${color}"></div>
      </div>
      <div class="cp-summary">${escapeHtml(c.narrative || '')}</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-top:4px">
        <div>
          <div style="font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:0.4px;color:#059669;margin-bottom:8px">Strengths</div>
          <div class="feedback-box" style="background:rgba(5,150,105,0.06);border:none">${strengthsHtml}</div>
        </div>
        <div>
          <div style="font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:0.4px;color:var(--amber);margin-bottom:8px">Areas for Improvement</div>
          <div class="feedback-box" style="background:rgba(217,119,6,0.06);border:none">${improvementsHtml}</div>
        </div>
      </div>
      ${metricsHtml ? `<div style="margin-top:12px">
        <div style="font-size:10px;font-weight:500;color:var(--text-tertiary);text-transform:uppercase;letter-spacing:0.4px;margin-bottom:6px">Supporting Metrics</div>
        <div class="criterion-metrics">${metricsHtml}</div>
      </div>` : ''}
      <div style="margin-top:16px;text-align:center">
        <button class="rubric-evaluate-btn" style="font-size:11px;padding:6px 12px" onclick="Rubric.triggerEvaluate()">Re-evaluate with Different Rubric</button>
      </div>`;
  }

  // ─── Helpers ───────────────────────────────────────────────────────────────

  function escapeHtml(s) {
    if (!s) return '';
    const div = document.createElement('div');
    div.textContent = s;
    return div.innerHTML;
  }

  return { init, getRubricText, setupForResults, loadRubrics, triggerEvaluate };
})();
