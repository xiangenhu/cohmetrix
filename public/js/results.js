/**
 * Results — Renders analysis results in the three-panel layout.
 * Includes evidence excerpts and plain-language descriptions.
 */
const Results = (() => {
  let analysisData = null;
  let activeLayerIdx = 0;

  // Theoretical basis descriptions (shown under "Technical details" toggle)
  const LAYER_BASIS = {
    L0: { text: 'Baseline text statistics for normalization and structural assessment. MATTR and MTLD preferred over raw TTR for length-invariant vocabulary diversity (Covington & McFall 2010; McCarthy & Jarvis 2010). Flesch-Kincaid provides traditional readability.', i18n: '60dd0c19e1ec6952' },
    L1: { text: 'Per-token LLM surprisal replaces MRC frequency norms. Higher surprisal = lower predictability = higher processing cost (Smith & Levy 2013). Psycholinguistic norms from Kuperman (2012; AoA) and Brysbaert (2014; concreteness).', i18n: 'cc5ec90702536d57' },
    L2: { text: 'Dependency Locality Theory (Gibson 2000): integration cost grows with distance between dependent and head. Universal Dependencies provides cross-lingual, validated syntactic representation. Syntactic pattern density (Biber 1988).', i18n: '363929211137d110' },
    L3: { text: 'Tracks entity re-introduction across sentences (Givón 1983 topic continuity). Coh-Metrix CRF binary overlap measures for local and global argument/noun overlap. Coreference chain analysis for entity tracking.', i18n: '2a0329bc3817950d' },
    L4: { text: 'SBERT contextual embeddings replace LSA (Reimers & Gurevych 2019). Resolves polysemy collapse, word-order blindness, and negation failures. Given/new ratio measures information progression.', i18n: 'a0ca82eb2691a15d' },
    L5: { text: 'Connectives are the explicit "glue" of the textbase (Halliday & Hasan 1976). Causal, temporal, adversative, additive, and logical connective incidence per 1000 words. Coh-Metrix CNC indices.', i18n: '68177fb15c23735d' },
    L6: { text: 'Kintsch (1998) Construction-Integration model: deep comprehension requires building a mental simulation. Zwaan & Radvansky (1998) event-indexing: causation, intentionality, time, space, protagonist.', i18n: '5498a870a3e7a0bc' },
    L7: { text: 'RST (Mann & Thompson 1988) captures intentional discourse organization. Evidence, contrast/concession, and elaboration relation ratios. Rhetorical diversity via Shannon entropy.', i18n: 'b470306a280dc044' },
    L8: { text: 'Toulmin (1958) model: Claim → Data → Warrant → Backing → Rebuttal. LLM-based argument mining classifies roles at sentence level. Evidence diversity and logical fallacy detection.', i18n: '2e7d0f20ca085d70' },
    L9: { text: 'Hedging, evidentiality, and speech act theory (Austin 1962; Searle 1969). Epistemic calibration via hedge-to-boost ratio (Hyland 2005). Critical for academic register.', i18n: 'bc3991188139b78c' },
    L10: { text: 'Valence-Arousal-Dominance model (Russell 1980). VAD arc across the essay reveals tonal consistency and emotional engagement. Affect-argument alignment measures strategic emotional placement.', i18n: 'a5fd4a0d629ae8f6' },
    L11: { text: 'All L0–L10 metrics re-scored relative to learner profile. ZPD proximity operationalizes Vygotsky (1978) — optimal challenge ≈ 0.5–1.5 SD above learner baseline.', i18n: '9ab9e2a062502034' },
  };

  function scoreCls(s) {
    return s >= 75 ? 'score-hi' : s >= 60 ? 'score-mid' : 'score-lo';
  }

  function metricPct(metric) {
    const v = parseFloat(metric.value);
    if (isNaN(v)) return 50;
    switch (metric.unit) {
      case 'ratio': case 'cos': case 'score': case 'ZPD': return Math.min(v * 100, 100);
      case 'bits': return Math.min(v / 12 * 100, 100);
      case '/9': return v / 9 * 100;
      case '/5': return v / 5 * 100;
      case 'tokens': return Math.min(v / 5 * 100, 100);
      case 'SD': return Math.min(v / 3 * 100, 100);
      case '%': case 'sents': case 'paras': case 'claims': case 'chains':
      case 'mentions': case 'levels': case 'events': case '/100w': case '/para':
      case '/500w': case '/sent': case 'mods': case 'years':
        return Math.min(v * 10, 100);
      default: return 50;
    }
  }

  function metricColor(pct) {
    if (pct >= 60) return '#0D9488';
    if (pct >= 35) return '#D97706';
    return '#BE3A4A';
  }

  function escapeHtml(s) {
    const div = document.createElement('div');
    div.textContent = s;
    return div.innerHTML;
  }

  function show(data) {
    analysisData = data;
    activeLayerIdx = 0;
    cachedSummary = null;
    confirmedGenre = null;
    confirmedLevel = null;
    renderStatsBar();
    renderSidebar();
    renderCenter(0);
    renderRightPanel();
    // Setup rubric review tab
    Rubric.setupForResults(data.id, data);
    // Snapshot analysis tokens into footer
    if (data.tokenUsage) {
      TokenFooter.setAnalysisTokens(data.tokenUsage);
      TokenFooter.refresh();
    }
    // Resolve i18n hashes for dynamic server content
    if (typeof I18nUtils !== 'undefined') I18nUtils.resolveDynamic();
  }

  function renderStatsBar() {
    const d = analysisData.document;
    const l0 = analysisData.layers.find(l => l.layerId === 'L0');
    document.getElementById('st-words').textContent = d.wordCount;
    document.getElementById('st-sents').textContent = d.sentenceCount;
    document.getElementById('st-paras').textContent = d.paragraphCount;
    document.getElementById('st-msl').textContent = l0?.metrics?.['L0.4']?.value || '—';
    document.getElementById('st-ttr').textContent = l0?.metrics?.['L0.7']?.value || '—';
    document.getElementById('st-awl').textContent = analysisData.layers.find(l => l.layerId === 'L1')?.metrics?.['L1.5']?.value || '—';
    document.getElementById('st-time').textContent = analysisData.analysisTime.toFixed(1) + 's';

    // Token usage — now shown in cost modal via TokenFooter
  }

  function renderSidebar() {
    const list = document.getElementById('layer-list');
    list.innerHTML = '';
    analysisData.layers.forEach((l, i) => {
      const item = document.createElement('div');
      item.className = 'layer-item' + (i === activeLayerIdx ? ' active' : '');
      item.innerHTML = `
        <span class="li-badge">${l.layerId}</span>
        <span class="li-name" data-i18n-dynamic>${l.layerName}</span>
        <span class="li-score ${scoreCls(l.score)}">${l.score}</span>
        <button class="help-btn" data-help-id="${l.layerId}" title="What is ${l.layerName}?">?</button>`;
      item.addEventListener('click', (e) => {
        if (e.target.closest('.help-btn')) return;
        selectLayer(i);
      });
      // Bind help button
      item.querySelector('.help-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        HelpChat.open(l.layerId, { layerScore: l.score });
      });
      list.appendChild(item);
    });

    // Summary button below layer list
    const summaryBtn = document.createElement('div');
    summaryBtn.className = 'sidebar-summary-btn';
    summaryBtn.innerHTML = '<span class="sidebar-summary-icon">&#9670;</span> <span data-i18n="87cb3121bd0d55b5">Analysis Summary &amp; FAQs</span>';
    summaryBtn.addEventListener('click', () => showSummary());
    list.appendChild(summaryBtn);
  }

  function selectLayer(i) {
    activeLayerIdx = i;
    document.querySelectorAll('.layer-item').forEach((el, j) => {
      el.classList.toggle('active', j === i);
    });
    const summaryBtn = document.querySelector('.sidebar-summary-btn');
    if (summaryBtn) summaryBtn.classList.remove('active');
    renderCenter(i);
  }

  // ─── Analysis Summary & FAQs ─────────────────────────────────────────

  let cachedSummary = null;
  let confirmedGenre = null;
  let confirmedLevel = null;

  async function showSummary() {
    // Deselect layers, highlight summary button
    document.querySelectorAll('.layer-item').forEach(el => el.classList.remove('active'));
    const summaryBtn = document.querySelector('.sidebar-summary-btn');
    if (summaryBtn) summaryBtn.classList.add('active');

    const cp = document.getElementById('center-panel');

    // If already confirmed and cached, show directly
    if (cachedSummary && confirmedGenre && confirmedLevel) {
      renderSummaryContent(cp, cachedSummary);
      return;
    }

    // Step 1: Detect genre and reading level
    cp.innerHTML = `
      <div class="cp-header">
        <div class="cp-layer-name"><span data-i18n="fe7750bb0e61b4f1">Analysis Summary</span></div>
        <div class="cp-layer-tag"><span data-i18n="ecedb42419edce37">all dimensions</span></div>
      </div>
      <div class="summary-loading"><span data-i18n="702011e1565bdf7e">Detecting genre and reading level...</span></div>`;

    try {
      // Fetch genres and detect in parallel
      const [, resp] = await Promise.all([
        ensureGenreCache(),
        Auth.apiFetch('/api/help/detect', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            layers: analysisData.layers,
            document: analysisData.document,
          }),
        }),
      ]);

      if (!resp.ok) throw new Error('Detection failed');
      const detected = await resp.json();
      TokenFooter.onApiResponse(detected);

      renderDetectStep(cp, detected);
    } catch (err) {
      await ensureGenreCache();
      // Fallback: show configure step without suggestions
      renderDetectStep(cp, {});
    }
  }

  function renderDetectStep(cp, detected) {
    // Clear the center panel while modal is open
    cp.innerHTML = `
      <div class="cp-header">
        <div class="cp-layer-name"><span data-i18n="fe7750bb0e61b4f1">Analysis Summary</span></div>
        <div class="cp-layer-tag"><span data-i18n="036b52eca2213499">configure genre &amp; reading level</span></div>
      </div>`;

    const genreOptions = buildGenreOptions(detected.suggestedGenre || '');
    const levelOptions = [
      { value: 'elementary', label: 'Elementary (grades 3-5)', i18n: '81c542659470d711' },
      { value: 'middle-school', label: 'Middle School (grades 6-8)', i18n: '60497a5dde764449' },
      { value: 'high-school', label: 'High School (grades 9-12)', i18n: '64baba6677bf740f' },
      { value: 'college', label: 'College (undergraduate)', i18n: '32f3644b25f831b9' },
      { value: 'graduate', label: 'Graduate / Professional', i18n: 'e4350f7a95b355f6' },
    ].map(o => `<option value="${o.value}" data-i18n="${o.i18n}"${o.value === (detected.suggestedLevel || '') ? ' selected' : ''}>${o.label}</option>`).join('');

    const fkDisplay = detected.fkGrade != null ? detected.fkGrade.toFixed(1) : '—';
    const freDisplay = detected.fleschReadingEase != null ? detected.fleschReadingEase.toFixed(1) : '—';
    const suggestedGenreLabel = detected.suggestedGenreLabel || '';
    const suggestedGenreCat = detected.suggestedGenreCategory || '';
    const suggestedLevelLabel = detected.suggestedLevelLabel || '';

    // Build the suggestion block
    const hasSuggestion = suggestedGenreLabel || suggestedLevelLabel;
    const suggestionHtml = hasSuggestion ? `
      <div class="modal-suggest">
        <div class="modal-suggest-header"><span data-i18n="3d8423b00b2b7ead">Based on my reading, I suggest:</span></div>
        <div class="modal-suggest-row">
          <div class="modal-suggest-item">
            <span class="modal-suggest-label"><span data-i18n="6da795a8664f37f6">Genre</span></span>
            <span class="modal-suggest-value">${escapeHtml(suggestedGenreLabel)}${suggestedGenreCat ? ` <span class="modal-suggest-cat">${escapeHtml(suggestedGenreCat)}</span>` : ''}</span>
          </div>
          <div class="modal-suggest-item">
            <span class="modal-suggest-label"><span data-i18n="fda6294684f67cb2">Reading Level</span></span>
            <span class="modal-suggest-value">${escapeHtml(suggestedLevelLabel)}</span>
          </div>
        </div>
        ${detected.genreReason ? `<div class="modal-suggest-reason">${escapeHtml(detected.genreReason)}</div>` : ''}
        <div class="modal-suggest-metrics">
          <span class="detect-metric">FK Grade: <strong>${fkDisplay}</strong></span>
          <span class="detect-metric">Flesch RE: <strong>${freDisplay}</strong></span>
        </div>
      </div>` : '';

    // Create modal overlay
    const overlay = document.createElement('div');
    overlay.id = 'summary-modal-overlay';
    overlay.className = 'summary-modal-overlay';
    overlay.innerHTML = `
      <div class="summary-modal">
        <div class="summary-modal-header">
          <div class="summary-modal-title"><span data-i18n="7e6ef166d84ccb62">Configure Summary</span></div>
          <button class="summary-modal-close" id="summary-modal-close">&times;</button>
        </div>
        ${suggestionHtml}
        <div class="summary-modal-body">
          <div class="modal-field">
            <label class="modal-field-label" for="summary-genre" data-i18n="6da795a8664f37f6">Genre</label>
            <select id="summary-genre" class="detect-select">${genreOptions}</select>
          </div>
          <div class="modal-field">
            <label class="modal-field-label" for="summary-level" data-i18n="c3463bf330757667">Intended Reading Level</label>
            <select id="summary-level" class="detect-select">${levelOptions}</select>
          </div>
        </div>
        <div class="summary-modal-footer">
          <button class="summary-modal-cancel" id="summary-modal-cancel" data-i18n="19766ed6ccb2f4a3">Cancel</button>
          <button class="run-btn summary-modal-generate" id="generate-summary-btn" data-i18n="2e77dacd17f00b96">Generate Summary</button>
        </div>
      </div>`;

    document.body.appendChild(overlay);

    // Force reflow for animation
    requestAnimationFrame(() => overlay.classList.add('open'));

    // Close handlers
    const closeModal = () => {
      overlay.classList.remove('open');
      setTimeout(() => overlay.remove(), 200);
    };

    document.getElementById('summary-modal-close').addEventListener('click', closeModal);
    document.getElementById('summary-modal-cancel').addEventListener('click', closeModal);
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeModal();
    });

    document.getElementById('generate-summary-btn').addEventListener('click', () => {
      confirmedGenre = document.getElementById('summary-genre').value;
      confirmedLevel = document.getElementById('summary-level').value;
      cachedSummary = null;
      closeModal();
      generateSummary();
    });
  }

  // Pre-fetch genres on first load
  function ensureGenreCache() {
    if (window._genreCache) return Promise.resolve();
    return fetch('/api/genres').then(r => r.json()).then(data => {
      window._genreCache = data.categories || [];
    }).catch(() => { window._genreCache = []; });
  }

  function buildGenreOptions(selectedId) {
    if (window._genreCache) return buildGenreOptHtml(window._genreCache, selectedId);
    return `<option value="" data-i18n="7fc67431c61ddafc">Select genre...</option>` +
      (selectedId ? `<option value="${selectedId}" selected>${selectedId.replace(/-/g, ' ')}</option>` : '');
  }

  function buildGenreOptHtml(categories, selectedId) {
    let html = '<option value="" data-i18n="7fc67431c61ddafc">Select genre...</option>';
    (categories || []).forEach(cat => {
      html += `<optgroup label="${escapeHtml(cat.category)}"${cat.i18n ? ` data-i18n-label="${cat.i18n}"` : ''}>`;
      cat.genres.forEach(g => {
        html += `<option value="${g.id}"${g.id === selectedId ? ' selected' : ''}${g.i18n ? ` data-i18n="${g.i18n}"` : ''}>${escapeHtml(g.name)}</option>`;
      });
      html += '</optgroup>';
    });
    return html;
  }

  async function generateSummary() {
    const cp = document.getElementById('center-panel');

    cp.innerHTML = `
      <div class="cp-header">
        <div class="cp-layer-name"><span data-i18n="fe7750bb0e61b4f1">Analysis Summary</span></div>
        <div class="cp-layer-tag"><span data-i18n="e18012c3a0fad257">generating...</span></div>
      </div>
      <div class="summary-loading"><span data-i18n="f04e04b4fedd3c8c">Generating genre-aware dimensional summary and FAQs...</span></div>`;

    try {
      const resp = await Auth.apiFetch('/api/help/summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          layers: analysisData.layers,
          overallScore: analysisData.overallScore,
          compositeScores: analysisData.compositeScores,
          feedback: analysisData.feedback,
          document: analysisData.document,
          genre: confirmedGenre,
          readingLevel: confirmedLevel,
        }),
      });

      if (!resp.ok) throw new Error('Failed to generate summary');
      const data = await resp.json();
      cachedSummary = data;

      TokenFooter.onApiResponse(data);
      renderSummaryContent(cp, data);
    } catch (err) {
      cp.innerHTML = `
        <div class="cp-header">
          <div class="cp-layer-name"><span data-i18n="fe7750bb0e61b4f1">Analysis Summary</span></div>
          <div class="cp-layer-tag"><span data-i18n="ca00fccfb408989e">error</span></div>
        </div>
        <div class="summary-error"><span data-i18n="39fce99720b23aa9">Failed to generate summary. Please try again.</span></div>`;
    }
  }

  function renderSummaryContent(cp, data) {
    // Build dimension cards from the layers
    const dimensions = [
      { label: 'Surface & Vocabulary', layers: ['L0', 'L1'], color: '#0D9488', i18n: '3348f1b68914f06a' },
      { label: 'Syntactic Complexity', layers: ['L2'], color: '#2563EB', i18n: '97d42b1dc4ff9563' },
      { label: 'Cohesion & Coherence', layers: ['L3', 'L4', 'L5'], color: '#7C3AED', i18n: 'c894c6e6db8bd0c5' },
      { label: 'Situation Model', layers: ['L6'], color: '#D97706', i18n: '5357ff59d718be10' },
      { label: 'Rhetoric & Argumentation', layers: ['L7', 'L8'], color: '#DC2626', i18n: '162a3ca6d6de2dce' },
      { label: 'Stance & Tone', layers: ['L9', 'L10'], color: '#059669', i18n: '0b5ce2076b2c3f87' },
    ];

    const dimCardsHtml = dimensions.map(dim => {
      const dimLayers = analysisData.layers.filter(l => dim.layers.includes(l.layerId));
      const avgScore = dimLayers.length > 0
        ? Math.round(dimLayers.reduce((sum, l) => sum + l.score, 0) / dimLayers.length)
        : null;
      const layerBadges = dimLayers.map(l =>
        `<span class="dim-layer-badge ${scoreCls(l.score)}">${l.layerId}: ${l.score}</span>`
      ).join('');
      return `
        <div class="dim-card" style="border-left-color:${dim.color}">
          <div class="dim-card-header">
            <span class="dim-card-title"><span data-i18n="${dim.i18n}">${dim.label}</span></span>
            ${avgScore !== null ? `<span class="dim-card-score ${scoreCls(avgScore)}">${avgScore}</span>` : ''}
          </div>
          <div class="dim-layer-badges">${layerBadges}</div>
        </div>`;
    }).join('');

    // Build FAQ accordion
    const faqsHtml = (data.faqs || []).map((faq, i) => `
      <div class="faq-item">
        <button class="faq-question" onclick="this.classList.toggle('open');this.nextElementSibling.classList.toggle('open')">
          <span class="faq-q-icon">Q</span>
          <span class="faq-q-text">${escapeHtml(faq.question)}</span>
          <span class="faq-chevron">&#9654;</span>
        </button>
        <div class="faq-answer">${escapeHtml(faq.answer)}</div>
      </div>
    `).join('');

    // Split summary into paragraphs
    const summaryParas = (data.summary || '').split(/\n\n+/).filter(p => p.trim());
    const summaryHtml = summaryParas.map(p => `<p class="summary-para">${escapeHtml(p.trim())}</p>`).join('');

    const genreBadge = confirmedGenre
      ? `<span class="summary-genre-badge">${escapeHtml(confirmedGenre.replace(/-/g, ' '))}</span>`
      : '';
    const levelBadge = confirmedLevel
      ? `<span class="summary-level-badge">${escapeHtml(confirmedLevel.replace(/-/g, ' '))}</span>`
      : '';

    cp.innerHTML = `
      <div class="cp-header">
        <div class="cp-layer-name"><span data-i18n="fe7750bb0e61b4f1">Analysis Summary</span> ${genreBadge}${levelBadge}</div>
        <div class="cp-layer-tag">overall: <strong>${analysisData.overallScore}/100</strong></div>
      </div>
      <div class="summary-dimensions">${dimCardsHtml}</div>
      <div class="summary-section">
        <div class="summary-section-title"><span data-i18n="a835518aa5844ab4">Dimensional Summary</span></div>
        <div class="summary-text">${summaryHtml}</div>
      </div>
      <div class="summary-section">
        <div class="summary-section-title"><span data-i18n="a3d458e1bd1eda06">Frequently Asked Questions</span></div>
        <div class="faq-list">${faqsHtml || '<div class="summary-text"><span data-i18n="9bf01da8703a4d29">No FAQs generated.</span></div>'}</div>
      </div>`;
  }

  // ─── Distribution rendering helper ──────────────────────────────────────

  function renderDistribution(id, dist) {
    if (!dist || !dist.n || dist.n < 2) return '';
    const uid = `dist-${id.replace('.', '-')}`;
    const noteHtml = dist.note ? `<div class="mc-dist-note">${escapeHtml(dist.note)}</div>` : '';
    return `
      <button class="mc-dist-toggle" onclick="this.classList.toggle('open');document.getElementById('${uid}').classList.toggle('open')">
        <span class="chevron">&#9654;</span> <span data-i18n="72a23e549d099bbd">Distribution</span> (n=${dist.n})
      </button>
      <div class="mc-dist-panel" id="${uid}">
        ${noteHtml}
        <div class="mc-dist-grid">
          <div class="mc-dist-cell"><span class="mc-dist-cell-label">n</span><span class="mc-dist-cell-val">${dist.n}</span></div>
          <div class="mc-dist-cell"><span class="mc-dist-cell-label"><span data-i18n="727a7d114f4d518e">Mean</span></span><span class="mc-dist-cell-val">${dist.mean}</span></div>
          <div class="mc-dist-cell"><span class="mc-dist-cell-label"><span data-i18n="495496f0156b1a6c">SD</span></span><span class="mc-dist-cell-val">${dist.sd}</span></div>
          <div class="mc-dist-cell"><span class="mc-dist-cell-label"><span data-i18n="dea79332147ffe1f">Min</span></span><span class="mc-dist-cell-val">${dist.min}</span></div>
          <div class="mc-dist-cell"><span class="mc-dist-cell-label"><span data-i18n="a1a5936d3b0f8a69">Max</span></span><span class="mc-dist-cell-val">${dist.max}</span></div>
        </div>
        <div class="mc-dist-row2">
          <div class="mc-dist-cell"><span class="mc-dist-cell-label"><span data-i18n="daab7c435134742a">Median</span></span><span class="mc-dist-cell-val">${dist.median}</span></div>
          <div class="mc-dist-cell"><span class="mc-dist-cell-label"><span data-i18n="32d833f348ce377c">Q1</span></span><span class="mc-dist-cell-val">${dist.q1}</span></div>
          <div class="mc-dist-cell"><span class="mc-dist-cell-label"><span data-i18n="9fc58f1abf0d4f13">Q3</span></span><span class="mc-dist-cell-val">${dist.q3}</span></div>
          <div class="mc-dist-cell"><span class="mc-dist-cell-label"><span data-i18n="06598d480e8203e1">Skew</span></span><span class="mc-dist-cell-val">${dist.skewness}</span></div>
        </div>
      </div>`;
  }

  // ─── Center panel rendering with evidence ───────────────────────────────

  function renderCenter(i) {
    const l = analysisData.layers[i];
    if (!l) return;

    const cp = document.getElementById('center-panel');
    const basisEntry = LAYER_BASIS[l.layerId];
    const technicalBasis = basisEntry ? basisEntry.text : '';
    const hasLayerSummary = l.layerSummary && l.layerSummary.length > 0;

    // Filter displayable metrics (show all for researchers)
    const displayMetrics = Object.entries(l.metrics)
      .filter(([, m]) => typeof m.value !== 'string' || !m.value.startsWith('{'));

    const metricsHtml = displayMetrics.map(([id, m]) => {
      const pct = metricPct(m);
      const color = metricColor(pct);
      const hasEvidence = m.evidence && m.evidence.length > 0;
      const hasPlain = m.plainDescription && m.plainDescription.length > 0;
      const verdict = m.verdict || '';
      const verdictHtml = verdict ? `<span class="mc-verdict ${verdict}">${verdict.replace('_', ' ')}</span>` : '';

      // Evidence section
      let evidenceHtml = '';
      if (hasEvidence) {
        const uid = `ev-${id.replace('.', '-')}`;
        const quotes = m.evidence.map(q =>
          `<div class="mc-evidence-item"><span class="mc-evidence-quote">${escapeHtml(q)}</span></div>`
        ).join('');
        evidenceHtml = `
          <button class="mc-evidence-toggle" onclick="this.classList.toggle('open');document.getElementById('${uid}').classList.toggle('open')">
            <span class="chevron">&#9654;</span> <span data-i18n="f5bb18ac38942c72">Show evidence</span> (${m.evidence.length})
          </button>
          <div class="mc-evidence-list" id="${uid}">${quotes}</div>`;
      }

      // Distribution statistics section
      const distHtml = renderDistribution(id, m.distribution);

      return `<div class="metric-card">
        <div class="mc-id">${id}<button class="help-btn" data-help-id="${id}" title="What is ${m.label}?">?</button>${verdictHtml}</div>
        <div class="mc-val">${m.value}<span style="font-size:11px;color:var(--text-tertiary);font-weight:400"> ${m.unit}</span></div>
        <div class="mc-label" data-i18n-dynamic>${m.label}</div>
        ${hasPlain ? `<div class="mc-plain" data-i18n-dynamic>${escapeHtml(m.plainDescription)}</div>` : ''}
        <div class="mc-bar-bg"><div class="mc-bar" style="width:${pct}%;background:${color}"></div></div>
        ${distHtml}
        ${evidenceHtml}
      </div>`;
    }).join('');

    // Layer summary (plain language) + collapsible technical basis
    const summaryHtml = hasLayerSummary
      ? `<div class="cp-summary">${escapeHtml(l.layerSummary)}</div>`
      : `<div class="cp-summary" id="cp-summary-placeholder" style="color:var(--text-tertiary);font-style:italic"><span data-i18n="5e41541c1bd67cef">Generating plain-language summary…</span></div>`;

    const basisHtml = technicalBasis
      ? `<button class="cp-basis-toggle" onclick="document.getElementById('tech-basis').classList.toggle('open');this.textContent=document.getElementById('tech-basis').classList.contains('open')?'Hide technical details ▴':'Show technical details ▾'"><span data-i18n="f8b2dc749d1c5cb3">Show technical details ▾</span></button>
         <div class="cp-basis-technical" id="tech-basis"><span data-i18n="${basisEntry.i18n}">${escapeHtml(technicalBasis)}</span></div>`
      : '';

    cp.innerHTML = `
      <div class="cp-header">
        <div class="cp-layer-name">${l.layerId} — <span data-i18n-dynamic>${l.layerName}</span></div>
        <div class="cp-layer-tag">score: <strong>${l.score}/100</strong></div>
      </div>
      ${summaryHtml}
      ${basisHtml}
      <div class="metrics-grid">${metricsHtml}</div>
      <div class="chart-wrap"><canvas id="layer-chart"></canvas></div>
      <div class="interp-box">
        <div class="interp-label"><span data-i18n="d5da114b5fac7b65">Interpretation</span></div>
        <div class="interp-text" id="interp-text">${hasLayerSummary ? escapeHtml(l.layerSummary) : '<span data-i18n="2fa874c796dde032">Generating interpretation…</span>'}</div>
      </div>`;

    // Bind help buttons on metric cards
    cp.querySelectorAll('.help-btn[data-help-id]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const metricId = btn.dataset.helpId;
        const metric = l.metrics[metricId];
        HelpChat.open(metricId, metric ? { value: metric.value, unit: metric.unit, layerScore: l.score } : {});
      });
    });

    // Render bar chart
    setTimeout(() => Charts.renderLayerChart(l), 50);

    // If no pre-generated summary, request one from the server
    if (!hasLayerSummary) {
      renderInterpretation(l);
    }
  }

  async function renderInterpretation(layer) {
    const interpEl = document.getElementById('interp-text');
    const summaryEl = document.getElementById('cp-summary-placeholder');
    if (!interpEl) return;

    // Fallback text from metrics
    const metrics = Object.entries(layer.metrics)
      .filter(([, m]) => typeof m.value !== 'string' || !m.value.startsWith('{'))
      .map(([id, m]) => `${id} ${m.label}: ${m.value} ${m.unit}`)
      .join(', ');
    interpEl.textContent = `${layer.layerName} score: ${layer.score}/100. Key metrics — ${metrics}.`;

    try {
      const resp = await Auth.apiFetch('/api/interpret', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          layerId: layer.layerId,
          layerName: layer.layerName,
          score: layer.score,
          metrics: layer.metrics,
          targetAudience: analysisData.targetAudience || 'teacher',
        }),
      });
      if (resp.ok) {
        const data = await resp.json();
        if (data.interpretation) {
          interpEl.textContent = data.interpretation;
          if (summaryEl) {
            summaryEl.textContent = data.interpretation;
            summaryEl.style.color = '';
            summaryEl.style.fontStyle = '';
          }
        }
        TokenFooter.onApiResponse(data);
      }
    } catch {
      // keep fallback
    }
  }

  // ─── Right panel ───────────────────────────────────────────────────────

  function scoreColor(s) {
    if (s >= 75) return 'var(--teal)';
    if (s >= 50) return 'var(--amber)';
    return 'var(--coral)';
  }

  function renderRightPanel() {
    setTimeout(() => Charts.renderRadarChart(analysisData.compositeScores), 100);
    document.getElementById('overall-score-num').textContent = analysisData.overallScore;

    // Factor score breakdown
    const factorBox = document.getElementById('factor-scores');
    if (factorBox && analysisData.compositeScores) {
      const factors = Object.values(analysisData.compositeScores);
      factorBox.innerHTML = factors.map(f => {
        const color = scoreColor(f.score);
        const fId = f.label.split(' ')[0]; // "F1", "F2", etc.
        return `<div class="factor-row">
          <span class="factor-label">${f.label}</span>
          <button class="info-btn" data-info="factor:${fId}">?</button>
          <div class="factor-bar-track">
            <div class="factor-bar-fill" style="width:${f.score}%;background:${color}"></div>
          </div>
          <span class="factor-val" style="color:${color}">${f.score}</span>
        </div>`;
      }).join('');
    }

    const rp = analysisData.readerProfile;
    const readerCard = document.getElementById('reader-profile-card');
    if (rp) {
      readerCard.innerHTML = `
        <div class="reader-row"><span class="reader-label"><span data-i18n="1d8fc7f827a94c7f">Vocab level</span></span><span class="reader-val" style="color:var(--teal)">${rp.vocabLevel}</span></div>
        <div class="reader-row"><span class="reader-label"><span data-i18n="00a0f0aaee5fe9a9">Syntax fluency</span></span><span class="reader-val">${rp.syntaxFluency}</span></div>
        <div class="reader-row"><span class="reader-label"><span data-i18n="0e92a373ef5bda1b">Domain expertise</span></span><span class="reader-val">${rp.domainExpertise}</span></div>
        <div class="reader-row"><span class="reader-label"><span data-i18n="77307e05be07173f">ZPD proximity</span></span><span class="reader-val" style="color:${rp.zpdProximity > 0.5 ? '#059669' : 'var(--amber)'}">${rp.zpdProximity} ${rp.zpdProximity > 0.5 ? '✓' : ''}</span></div>
        <div class="reader-row"><span class="reader-label"><span data-i18n="6a47ca863a47bc4a">Difficulty z-score</span></span><span class="reader-val">${rp.difficultyZScore > 0 ? '+' : ''}${rp.difficultyZScore}</span></div>
        <div class="reader-row"><span class="reader-label"><span data-i18n="5a8a7f792a2b5e6d">Scaffold type</span></span><span class="reader-val" style="color:var(--amber)">${rp.scaffoldType}</span></div>`;
    } else {
      readerCard.innerHTML = '<div class="reader-row"><span class="reader-label"><span data-i18n="25cb8e76f21c98c6">L11 not enabled</span></span></div>';
    }

    const fbBox = document.getElementById('feedback-items');
    const feedback = analysisData.feedback || [];
    fbBox.innerHTML = feedback.map(f => `
      <div class="fb-item"><div class="fb-dot"></div><div>${f}</div></div>
    `).join('') || '<div class="fb-item"><div class="fb-dot"></div><div><span data-i18n="9724127893ee1b90">No feedback generated.</span></div></div>';
    const feedbackCountEl = document.getElementById('feedback-count');
    feedbackCountEl.innerHTML = `<span data-i18n="64da958601b1300b">AI Tutor</span> · ${feedback.length} points`;
  }

  return { show };
})();
