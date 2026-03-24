/**
 * TokenFooter — Token usage tracking with cost estimation popup.
 *
 * Tracks three categories:
 * 1. Session total — cumulative across all LLM calls since page load / reset
 * 2. Analysis — tokens from the most recent analysis run
 * 3. Post-analysis — tokens from interpretation, help chat, rubric eval, etc.
 *
 * Shows estimated USD cost based on provider pricing fetched from /health.
 */
const TokenFooter = (() => {
  let analysisSnapshot = { calls: 0, promptTokens: 0, completionTokens: 0, totalTokens: 0 };
  let pricing = null; // { promptPer1M, completionPer1M, provider, model }

  const fmt = (n) => (n || 0).toLocaleString();

  function estimateCost(promptTokens, completionTokens) {
    if (!pricing) return 0;
    return (promptTokens / 1_000_000) * pricing.promptPer1M +
           (completionTokens / 1_000_000) * pricing.completionPer1M;
  }

  function fmtUsd(amount) {
    if (amount < 0.005) return '$0.00';
    if (amount < 0.10) return '$' + amount.toFixed(3);
    return '$' + amount.toFixed(2);
  }

  function update(sessionUsage, analysisUsage) {
    if (!sessionUsage) return;

    // Session totals
    setVal('tf-session-calls', sessionUsage.calls);
    setVal('tf-session-prompt', sessionUsage.promptTokens);
    setVal('tf-session-completion', sessionUsage.completionTokens);
    setVal('tf-session-total', sessionUsage.totalTokens);

    // Analysis totals
    if (analysisUsage) {
      analysisSnapshot = { ...analysisUsage };
    }
    setVal('tf-analysis-calls', analysisSnapshot.calls);
    setVal('tf-analysis-prompt', analysisSnapshot.promptTokens);
    setVal('tf-analysis-completion', analysisSnapshot.completionTokens);
    setVal('tf-analysis-total', analysisSnapshot.totalTokens);

    // Post-analysis = session - analysis
    const postCalls = Math.max(0, sessionUsage.calls - analysisSnapshot.calls);
    const postPrompt = Math.max(0, sessionUsage.promptTokens - analysisSnapshot.promptTokens);
    const postCompletion = Math.max(0, sessionUsage.completionTokens - analysisSnapshot.completionTokens);
    const postTotal = Math.max(0, sessionUsage.totalTokens - analysisSnapshot.totalTokens);
    setVal('tf-post-calls', postCalls);
    setVal('tf-post-total', postTotal);

    // Cost estimates
    const sessionCost = estimateCost(sessionUsage.promptTokens, sessionUsage.completionTokens);
    const analysisCost = estimateCost(analysisSnapshot.promptTokens, analysisSnapshot.completionTokens);
    const postCost = estimateCost(postPrompt, postCompletion);

    setCost('cost-total-usd', sessionCost);
    setCost('cost-session-usd', sessionCost);
    setCost('cost-analysis-usd', analysisCost);
    setCost('cost-post-usd', postCost);
  }

  function setVal(id, val) {
    const el = document.getElementById(id);
    if (!el) return;
    const newText = fmt(val);
    if (el.textContent !== newText) {
      el.textContent = newText;
      el.classList.remove('tf-updated');
      void el.offsetWidth;
      el.classList.add('tf-updated');
    }
  }

  function setCost(id, amount) {
    const el = document.getElementById(id);
    if (el) el.textContent = fmtUsd(amount);
  }

  function setAnalysisTokens(usage) {
    if (usage) analysisSnapshot = { ...usage };
  }

  function onApiResponse(data) {
    if (data && data.tokenUsage) update(data.tokenUsage);
  }

  async function refresh() {
    try {
      const resp = await Auth.apiFetch('/api/tokens');
      if (resp.ok) {
        const data = await resp.json();
        update(data.session, data.analysis);
      }
    } catch { /* ignore */ }
  }

  async function reset() {
    try {
      await Auth.apiFetch('/api/tokens/reset', { method: 'POST' });
      analysisSnapshot = { calls: 0, promptTokens: 0, completionTokens: 0, totalTokens: 0 };
      update(
        { calls: 0, promptTokens: 0, completionTokens: 0, totalTokens: 0 },
        analysisSnapshot
      );
    } catch { /* ignore */ }
  }

  function openModal() {
    refresh();
    document.getElementById('cost-overlay').classList.add('open');
  }

  function closeModal() {
    document.getElementById('cost-overlay').classList.remove('open');
  }

  async function loadPricing() {
    try {
      const resp = await Auth.apiFetch('/health');
      if (!resp.ok) return;
      const data = await resp.json();
      if (data.llm) {
        const el = document.getElementById('tf-provider');
        if (el) el.textContent = `${data.llm.name} \u00B7 ${data.llm.model}`;

        if (data.llm.pricing) {
          pricing = data.llm.pricing;
          const noteEl = document.getElementById('cost-note');
          if (noteEl) noteEl.textContent = `${data.llm.name} ${data.llm.model}: $${pricing.promptPer1M}/M input, $${pricing.completionPer1M}/M output`;
        }
      }
    } catch { /* ignore */ }
  }

  function init() {
    // Show topbar button
    const fab = document.getElementById('cost-fab');
    if (fab) {
      fab.style.display = 'inline-flex';
      fab.addEventListener('click', openModal);
    }

    // Modal close
    const closeBtn = document.getElementById('cost-close-btn');
    if (closeBtn) closeBtn.addEventListener('click', closeModal);
    const backdrop = document.getElementById('cost-backdrop');
    if (backdrop) backdrop.addEventListener('click', closeModal);

    // Reset button
    const resetBtn = document.getElementById('tf-reset-btn');
    if (resetBtn) resetBtn.addEventListener('click', reset);

    // Escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeModal();
    });

    // Load pricing and initial token counts
    loadPricing();
    refresh();
  }

  return { init, update, setAnalysisTokens, onApiResponse, refresh, reset };
})();
