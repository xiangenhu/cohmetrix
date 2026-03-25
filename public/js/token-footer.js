/**
 * TokenFooter — Token usage tracking with cost estimation popup.
 *
 * Tracks current browser session tokens. Cumulative spending is tracked
 * server-side per user (no user reset — admin only).
 */
const TokenFooter = (() => {
  let analysisSnapshot = { calls: 0, promptTokens: 0, completionTokens: 0, totalTokens: 0 };
  let pricing = null;

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

    setVal('tf-session-calls', sessionUsage.calls);
    setVal('tf-session-prompt', sessionUsage.promptTokens);
    setVal('tf-session-completion', sessionUsage.completionTokens);
    setVal('tf-session-total', sessionUsage.totalTokens);

    if (analysisUsage) analysisSnapshot = { ...analysisUsage };

    const sessionCost = estimateCost(sessionUsage.promptTokens, sessionUsage.completionTokens);
    setCost('cost-session-usd', sessionCost);
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

  function openModal() {
    refresh();
    Quota.loadQuota();
    Quota.loadProjectUsage();
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
    const fab = document.getElementById('cost-fab');
    if (fab) {
      fab.style.display = 'inline-flex';
      fab.addEventListener('click', openModal);
    }

    const closeBtn = document.getElementById('cost-close-btn');
    if (closeBtn) closeBtn.addEventListener('click', closeModal);
    const backdrop = document.getElementById('cost-backdrop');
    if (backdrop) backdrop.addEventListener('click', closeModal);

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeModal();
    });

    loadPricing();
    refresh();
  }

  return { init, update, setAnalysisTokens, onApiResponse, refresh, openModal, closeModal };
})();
