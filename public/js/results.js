/**
 * Results — Renders analysis results in the three-panel layout.
 * Includes evidence excerpts and plain-language descriptions.
 */
const Results = (() => {
  let analysisData = null;
  let activeLayerIdx = 0;

  // Theoretical basis descriptions (shown under "Technical details" toggle)
  const LAYER_BASIS = {
    L0: 'Baseline text statistics for normalization and structural assessment. MATTR and MTLD preferred over raw TTR for length-invariant vocabulary diversity (Covington & McFall 2010; McCarthy & Jarvis 2010). Flesch-Kincaid provides traditional readability.',
    L1: 'Per-token LLM surprisal replaces MRC frequency norms. Higher surprisal = lower predictability = higher processing cost (Smith & Levy 2013). Psycholinguistic norms from Kuperman (2012; AoA) and Brysbaert (2014; concreteness).',
    L2: 'Dependency Locality Theory (Gibson 2000): integration cost grows with distance between dependent and head. Universal Dependencies provides cross-lingual, validated syntactic representation. Syntactic pattern density (Biber 1988).',
    L3: 'Tracks entity re-introduction across sentences (Givón 1983 topic continuity). Coh-Metrix CRF binary overlap measures for local and global argument/noun overlap. Coreference chain analysis for entity tracking.',
    L4: 'SBERT contextual embeddings replace LSA (Reimers & Gurevych 2019). Resolves polysemy collapse, word-order blindness, and negation failures. Given/new ratio measures information progression.',
    L5: 'Connectives are the explicit "glue" of the textbase (Halliday & Hasan 1976). Causal, temporal, adversative, additive, and logical connective incidence per 1000 words. Coh-Metrix CNC indices.',
    L6: 'Kintsch (1998) Construction-Integration model: deep comprehension requires building a mental simulation. Zwaan & Radvansky (1998) event-indexing: causation, intentionality, time, space, protagonist.',
    L7: 'RST (Mann & Thompson 1988) captures intentional discourse organization. Evidence, contrast/concession, and elaboration relation ratios. Rhetorical diversity via Shannon entropy.',
    L8: 'Toulmin (1958) model: Claim → Data → Warrant → Backing → Rebuttal. LLM-based argument mining classifies roles at sentence level. Evidence diversity and logical fallacy detection.',
    L9: 'Hedging, evidentiality, and speech act theory (Austin 1962; Searle 1969). Epistemic calibration via hedge-to-boost ratio (Hyland 2005). Critical for academic register.',
    L10: 'Valence-Arousal-Dominance model (Russell 1980). VAD arc across the essay reveals tonal consistency and emotional engagement. Affect-argument alignment measures strategic emotional placement.',
    L11: 'All L0–L10 metrics re-scored relative to learner profile. ZPD proximity operationalizes Vygotsky (1978) — optimal challenge ≈ 0.5–1.5 SD above learner baseline.',
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

    // Token usage
    const tu = analysisData.tokenUsage;
    if (tu) {
      document.getElementById('st-prompt-tokens').textContent = tu.promptTokens.toLocaleString();
      document.getElementById('st-completion-tokens').textContent = tu.completionTokens.toLocaleString();
      document.getElementById('st-total-tokens').textContent = tu.totalTokens.toLocaleString();
    }

    // LLM provider
    const provider = analysisData.llmProvider;
    if (provider) {
      document.getElementById('st-llm-provider').textContent = `${provider.name} · ${provider.model}`;
    }
  }

  function renderSidebar() {
    const list = document.getElementById('layer-list');
    list.innerHTML = '';
    analysisData.layers.forEach((l, i) => {
      const item = document.createElement('div');
      item.className = 'layer-item' + (i === activeLayerIdx ? ' active' : '');
      item.innerHTML = `
        <span class="li-badge">${l.layerId}</span>
        <span class="li-name">${l.layerName}</span>
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
    summaryBtn.innerHTML = '<span class="sidebar-summary-icon">&#9670;</span> Analysis Summary & FAQs';
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

  async function showSummary() {
    // Deselect layers, highlight summary button
    document.querySelectorAll('.layer-item').forEach(el => el.classList.remove('active'));
    const summaryBtn = document.querySelector('.sidebar-summary-btn');
    if (summaryBtn) summaryBtn.classList.add('active');

    const cp = document.getElementById('center-panel');

    // Show loading state
    cp.innerHTML = `
      <div class="cp-header">
        <div class="cp-layer-name">Analysis Summary</div>
        <div class="cp-layer-tag">all dimensions</div>
      </div>
      <div class="summary-loading">Generating dimensional summary and FAQs...</div>`;

    // Use cache if available
    if (cachedSummary) {
      renderSummaryContent(cp, cachedSummary);
      return;
    }

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
          <div class="cp-layer-name">Analysis Summary</div>
          <div class="cp-layer-tag">all dimensions</div>
        </div>
        <div class="summary-error">Failed to generate summary. Please try again.</div>`;
    }
  }

  function renderSummaryContent(cp, data) {
    // Build dimension cards from the layers
    const dimensions = [
      { label: 'Surface & Vocabulary', layers: ['L0', 'L1'], color: '#0D9488' },
      { label: 'Syntactic Complexity', layers: ['L2'], color: '#2563EB' },
      { label: 'Cohesion & Coherence', layers: ['L3', 'L4', 'L5'], color: '#7C3AED' },
      { label: 'Situation Model', layers: ['L6'], color: '#D97706' },
      { label: 'Rhetoric & Argumentation', layers: ['L7', 'L8'], color: '#DC2626' },
      { label: 'Stance & Tone', layers: ['L9', 'L10'], color: '#059669' },
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
            <span class="dim-card-title">${dim.label}</span>
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

    cp.innerHTML = `
      <div class="cp-header">
        <div class="cp-layer-name">Analysis Summary</div>
        <div class="cp-layer-tag">overall: <strong>${analysisData.overallScore}/100</strong></div>
      </div>
      <div class="summary-dimensions">${dimCardsHtml}</div>
      <div class="summary-section">
        <div class="summary-section-title">Dimensional Summary</div>
        <div class="summary-text">${summaryHtml}</div>
      </div>
      <div class="summary-section">
        <div class="summary-section-title">Frequently Asked Questions</div>
        <div class="faq-list">${faqsHtml || '<div class="summary-text">No FAQs generated.</div>'}</div>
      </div>`;
  }

  // ─── Distribution rendering helper ──────────────────────────────────────

  function renderDistribution(id, dist) {
    if (!dist || !dist.n || dist.n < 2) return '';
    const uid = `dist-${id.replace('.', '-')}`;
    const noteHtml = dist.note ? `<div class="mc-dist-note">${escapeHtml(dist.note)}</div>` : '';
    return `
      <button class="mc-dist-toggle" onclick="this.classList.toggle('open');document.getElementById('${uid}').classList.toggle('open')">
        <span class="chevron">&#9654;</span> Distribution (n=${dist.n})
      </button>
      <div class="mc-dist-panel" id="${uid}">
        ${noteHtml}
        <div class="mc-dist-grid">
          <div class="mc-dist-cell"><span class="mc-dist-cell-label">n</span><span class="mc-dist-cell-val">${dist.n}</span></div>
          <div class="mc-dist-cell"><span class="mc-dist-cell-label">Mean</span><span class="mc-dist-cell-val">${dist.mean}</span></div>
          <div class="mc-dist-cell"><span class="mc-dist-cell-label">SD</span><span class="mc-dist-cell-val">${dist.sd}</span></div>
          <div class="mc-dist-cell"><span class="mc-dist-cell-label">Min</span><span class="mc-dist-cell-val">${dist.min}</span></div>
          <div class="mc-dist-cell"><span class="mc-dist-cell-label">Max</span><span class="mc-dist-cell-val">${dist.max}</span></div>
        </div>
        <div class="mc-dist-row2">
          <div class="mc-dist-cell"><span class="mc-dist-cell-label">Median</span><span class="mc-dist-cell-val">${dist.median}</span></div>
          <div class="mc-dist-cell"><span class="mc-dist-cell-label">Q1</span><span class="mc-dist-cell-val">${dist.q1}</span></div>
          <div class="mc-dist-cell"><span class="mc-dist-cell-label">Q3</span><span class="mc-dist-cell-val">${dist.q3}</span></div>
          <div class="mc-dist-cell"><span class="mc-dist-cell-label">Skew</span><span class="mc-dist-cell-val">${dist.skewness}</span></div>
        </div>
      </div>`;
  }

  // ─── Center panel rendering with evidence ───────────────────────────────

  function renderCenter(i) {
    const l = analysisData.layers[i];
    if (!l) return;

    const cp = document.getElementById('center-panel');
    const technicalBasis = LAYER_BASIS[l.layerId] || '';
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
            <span class="chevron">&#9654;</span> Show evidence (${m.evidence.length})
          </button>
          <div class="mc-evidence-list" id="${uid}">${quotes}</div>`;
      }

      // Distribution statistics section
      const distHtml = renderDistribution(id, m.distribution);

      return `<div class="metric-card">
        <div class="mc-id">${id}<button class="help-btn" data-help-id="${id}" title="What is ${m.label}?">?</button>${verdictHtml}</div>
        <div class="mc-val">${m.value}<span style="font-size:11px;color:var(--text-tertiary);font-weight:400"> ${m.unit}</span></div>
        <div class="mc-label">${m.label}</div>
        ${hasPlain ? `<div class="mc-plain">${escapeHtml(m.plainDescription)}</div>` : ''}
        <div class="mc-bar-bg"><div class="mc-bar" style="width:${pct}%;background:${color}"></div></div>
        ${distHtml}
        ${evidenceHtml}
      </div>`;
    }).join('');

    // Layer summary (plain language) + collapsible technical basis
    const summaryHtml = hasLayerSummary
      ? `<div class="cp-summary">${escapeHtml(l.layerSummary)}</div>`
      : `<div class="cp-summary" id="cp-summary-placeholder" style="color:var(--text-tertiary);font-style:italic">Generating plain-language summary…</div>`;

    const basisHtml = technicalBasis
      ? `<button class="cp-basis-toggle" onclick="document.getElementById('tech-basis').classList.toggle('open');this.textContent=document.getElementById('tech-basis').classList.contains('open')?'Hide technical details ▴':'Show technical details ▾'">Show technical details ▾</button>
         <div class="cp-basis-technical" id="tech-basis">${escapeHtml(technicalBasis)}</div>`
      : '';

    cp.innerHTML = `
      <div class="cp-header">
        <div class="cp-layer-name">${l.layerId} — ${l.layerName}</div>
        <div class="cp-layer-tag">score: <strong>${l.score}/100</strong></div>
      </div>
      ${summaryHtml}
      ${basisHtml}
      <div class="metrics-grid">${metricsHtml}</div>
      <div class="chart-wrap"><canvas id="layer-chart"></canvas></div>
      <div class="interp-box">
        <div class="interp-label">Interpretation</div>
        <div class="interp-text" id="interp-text">${hasLayerSummary ? escapeHtml(l.layerSummary) : 'Generating interpretation…'}</div>
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

  function renderRightPanel() {
    setTimeout(() => Charts.renderRadarChart(analysisData.compositeScores), 100);
    document.getElementById('overall-score-num').textContent = analysisData.overallScore;

    const rp = analysisData.readerProfile;
    const readerCard = document.getElementById('reader-profile-card');
    if (rp) {
      readerCard.innerHTML = `
        <div class="reader-row"><span class="reader-label">Vocab level</span><span class="reader-val" style="color:var(--teal)">${rp.vocabLevel}</span></div>
        <div class="reader-row"><span class="reader-label">Syntax fluency</span><span class="reader-val">${rp.syntaxFluency}</span></div>
        <div class="reader-row"><span class="reader-label">Domain expertise</span><span class="reader-val">${rp.domainExpertise}</span></div>
        <div class="reader-row"><span class="reader-label">ZPD proximity</span><span class="reader-val" style="color:${rp.zpdProximity > 0.5 ? '#059669' : 'var(--amber)'}">${rp.zpdProximity} ${rp.zpdProximity > 0.5 ? '✓' : ''}</span></div>
        <div class="reader-row"><span class="reader-label">Difficulty z-score</span><span class="reader-val">${rp.difficultyZScore > 0 ? '+' : ''}${rp.difficultyZScore}</span></div>
        <div class="reader-row"><span class="reader-label">Scaffold type</span><span class="reader-val" style="color:var(--amber)">${rp.scaffoldType}</span></div>`;
    } else {
      readerCard.innerHTML = '<div class="reader-row"><span class="reader-label">L11 not enabled</span></div>';
    }

    const fbBox = document.getElementById('feedback-items');
    const feedback = analysisData.feedback || [];
    fbBox.innerHTML = feedback.map(f => `
      <div class="fb-item"><div class="fb-dot"></div><div>${f}</div></div>
    `).join('') || '<div class="fb-item"><div class="fb-dot"></div><div>No feedback generated.</div></div>';
    document.getElementById('feedback-count').textContent = `AI Tutor · ${feedback.length} points`;
  }

  return { show };
})();
