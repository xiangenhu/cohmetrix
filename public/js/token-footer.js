/**
 * TokenFooter — Persistent token usage accounting across ALL interactions.
 *
 * Tracks three categories:
 * 1. Session total — cumulative across all LLM calls since page load / reset
 * 2. Analysis — tokens from the most recent analysis run
 * 3. Post-analysis — tokens from interpretation, help chat, rubric eval, etc.
 */
const TokenFooter = (() => {
  // Local snapshot of last-known analysis totals
  let analysisSnapshot = { calls: 0, promptTokens: 0, completionTokens: 0, totalTokens: 0 };

  const fmt = (n) => (n || 0).toLocaleString();

  function update(sessionUsage, analysisUsage) {
    if (!sessionUsage) return;

    // Session totals
    setVal('tf-session-calls', sessionUsage.calls);
    setVal('tf-session-prompt', sessionUsage.promptTokens);
    setVal('tf-session-completion', sessionUsage.completionTokens);
    setVal('tf-session-total', sessionUsage.totalTokens);

    // Analysis totals (use provided or snapshot)
    if (analysisUsage) {
      analysisSnapshot = { ...analysisUsage };
    }
    setVal('tf-analysis-calls', analysisSnapshot.calls);
    setVal('tf-analysis-prompt', analysisSnapshot.promptTokens);
    setVal('tf-analysis-completion', analysisSnapshot.completionTokens);
    setVal('tf-analysis-total', analysisSnapshot.totalTokens);

    // Post-analysis = session - analysis
    const postCalls = sessionUsage.calls - analysisSnapshot.calls;
    const postTotal = sessionUsage.totalTokens - analysisSnapshot.totalTokens;
    setVal('tf-post-calls', Math.max(0, postCalls));
    setVal('tf-post-total', Math.max(0, postTotal));
  }

  function setVal(id, val) {
    const el = document.getElementById(id);
    if (!el) return;
    const newText = fmt(val);
    if (el.textContent !== newText) {
      el.textContent = newText;
      // Pulse animation on change
      el.classList.remove('tf-updated');
      void el.offsetWidth; // force reflow
      el.classList.add('tf-updated');
    }
  }

  /**
   * Record analysis completion — snapshot the analysis token counts.
   */
  function setAnalysisTokens(usage) {
    if (usage) {
      analysisSnapshot = { ...usage };
    }
  }

  /**
   * Call after any API response that includes tokenUsage to keep footer current.
   */
  function onApiResponse(data) {
    if (data && data.tokenUsage) {
      update(data.tokenUsage);
    }
  }

  /**
   * Fetch current totals from server and refresh display.
   */
  async function refresh() {
    try {
      const resp = await Auth.apiFetch('/api/tokens');
      if (resp.ok) {
        const data = await resp.json();
        update(data.session, data.analysis);
      }
    } catch { /* ignore */ }
  }

  /**
   * Reset session counters.
   */
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

  function init() {
    // Bind reset button
    const resetBtn = document.getElementById('tf-reset-btn');
    if (resetBtn) {
      resetBtn.addEventListener('click', reset);
    }

    // Set provider info
    Auth.apiFetch('/health').then(r => r.json()).then(data => {
      if (data.llm) {
        const el = document.getElementById('tf-provider');
        if (el) el.textContent = `${data.llm.name} · ${data.llm.model}`;
      }
    }).catch(() => {});

    // Initial refresh
    refresh();
  }

  return { init, update, setAnalysisTokens, onApiResponse, refresh, reset };
})();
