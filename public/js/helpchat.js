/**
 * HelpChat — Context-sensitive help chat panel.
 * Opens when user clicks "?" next to a layer or metric.
 * Uses LLM to paraphrase definitions for the target audience.
 */
const HelpChat = (() => {
  let currentId = null;
  let history = [];
  let isLoading = false;

  function init() {
    // Close on backdrop click
    document.getElementById('help-backdrop').addEventListener('click', close);
    document.getElementById('help-close-btn').addEventListener('click', close);

    // Send on button click or Enter
    document.getElementById('help-send-btn').addEventListener('click', sendMessage);
    document.getElementById('help-input').addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    });
  }

  /**
   * Open the help chat for a specific layer or metric.
   * @param {string} id — Layer ID (e.g. "L4") or metric ID (e.g. "L4.1")
   * @param {object} context — Optional: { value, unit, layerScore } for metric-specific context
   */
  function open(id, context) {
    currentId = id;
    history = [];

    // Set header
    const isLayer = !id.includes('.');
    const title = isLayer ? `Layer ${id}` : `Metric ${id}`;
    document.getElementById('help-header-title').textContent = title;
    document.getElementById('help-header-sub').textContent = 'Loading explanation…';
    document.getElementById('help-header-sub').setAttribute('data-i18n', '2a00049c57ba2e6d');

    // Clear messages
    const msgArea = document.getElementById('help-messages');
    msgArea.innerHTML = '<div class="help-msg assistant loading" data-i18n="a02f1cea3c1d6c6e">Thinking…</div>';

    // Show panel
    document.getElementById('help-overlay').classList.add('open');
    document.getElementById('help-input').value = '';
    document.getElementById('help-input').focus();

    // Fetch explanation
    fetchExplanation(id, context);
  }

  function close() {
    document.getElementById('help-overlay').classList.remove('open');
    currentId = null;
    history = [];
  }

  async function fetchExplanation(id, context) {
    const msgArea = document.getElementById('help-messages');

    try {
      const resp = await Auth.apiFetch('/api/help/explain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, context }),
      });

      if (!resp.ok) throw new Error('Failed');
      const data = await resp.json();

      // Update header
      const label = data.definition?.label || data.definition?.name || id;
      document.getElementById('help-header-title').textContent = label;
      document.getElementById('help-header-sub').textContent = id;

      // Show two-part help: index explanation + score explanation
      msgArea.innerHTML = '';

      // Card 1: What is this index?
      const indexCard = document.createElement('div');
      indexCard.className = 'help-def-card';
      indexCard.innerHTML = `<div class="help-def-label" data-i18n="3165aaed14972b27">What does this measure?</div>${escapeHtml(data.indexExplanation || data.explanation || '')}`;
      msgArea.appendChild(indexCard);

      // Card 2: Best/worst cases from the literature (if available)
      if (data.benchmarks && (data.benchmarks.bestCase || data.benchmarks.worstCase)) {
        const benchCard = document.createElement('div');
        benchCard.className = 'help-def-card help-bench-card';
        let benchHtml = '<div class="help-def-label" data-i18n="e771521861a36aef">From the research</div>';
        if (data.benchmarks.bestCase) {
          benchHtml += `<div class="help-bench-row"><span class="help-bench-icon best">&#9650;</span> <strong data-i18n="6783a859cd419237">Best case:</strong> ${escapeHtml(data.benchmarks.bestCase)}</div>`;
        }
        if (data.benchmarks.worstCase) {
          benchHtml += `<div class="help-bench-row"><span class="help-bench-icon worst">&#9660;</span> <strong data-i18n="84a734ef134d67c0">Worst case:</strong> ${escapeHtml(data.benchmarks.worstCase)}</div>`;
        }
        benchCard.innerHTML = benchHtml;
        msgArea.appendChild(benchCard);
      }

      // Card 3: What does my score mean? (only if score data present)
      if (data.scoreExplanation) {
        const scoreCard = document.createElement('div');
        scoreCard.className = 'help-def-card help-score-card';
        const scoreDisplay = data.score
          ? `<span class="help-score-value">${data.score.value}${data.score.unit ? ' ' + data.score.unit : ''}</span>`
          : '';
        scoreCard.innerHTML = `<div class="help-def-label"><span data-i18n="5f49fcc8ddf7cde2">Your score</span> ${scoreDisplay}</div>${escapeHtml(data.scoreExplanation)}`;
        msgArea.appendChild(scoreCard);
      }

      // Seed conversation history with the combined explanation
      const combinedText = (data.indexExplanation || data.explanation || '') +
        (data.scoreExplanation ? '\n\n' + data.scoreExplanation : '');
      history.push({ role: 'assistant', text: combinedText });

      // Update token footer
      TokenFooter.onApiResponse(data);

    } catch (err) {
      msgArea.innerHTML = '';
      addMessage('assistant', `I couldn't load the explanation for ${id}. Try asking a question below.`);
    }
  }

  async function sendMessage() {
    if (isLoading) return;
    const input = document.getElementById('help-input');
    const question = input.value.trim();
    if (!question) return;

    input.value = '';
    addMessage('user', question);
    history.push({ role: 'user', text: question });

    // Show loading
    const loadingEl = addMessage('assistant', 'Thinking…', true, 'a02f1cea3c1d6c6e');
    isLoading = true;
    document.getElementById('help-send-btn').disabled = true;

    try {
      const resp = await Auth.apiFetch('/api/help/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: currentId,
          question,
          history: history.slice(-6), // last 6 messages for context
        }),
      });

      if (!resp.ok) throw new Error('Failed');
      const data = await resp.json();

      // Replace loading with answer
      loadingEl.textContent = data.answer;
      loadingEl.classList.remove('loading');
      history.push({ role: 'assistant', text: data.answer });

      // Update token footer
      TokenFooter.onApiResponse(data);

    } catch {
      loadingEl.textContent = 'Sorry, I couldn\'t generate a response. Please try again.';
      loadingEl.setAttribute('data-i18n', '2de1fc68d915a5e1');
      loadingEl.classList.remove('loading');
    }

    isLoading = false;
    document.getElementById('help-send-btn').disabled = false;
    document.getElementById('help-input').focus();
  }

  function addMessage(role, text, isLoading, i18nKey) {
    const msgArea = document.getElementById('help-messages');
    const msg = document.createElement('div');
    msg.className = `help-msg ${role}${isLoading ? ' loading' : ''}`;
    msg.textContent = text;
    if (i18nKey) msg.setAttribute('data-i18n', i18nKey);
    msgArea.appendChild(msg);
    msgArea.scrollTop = msgArea.scrollHeight;
    return msg;
  }

  function escapeHtml(s) {
    const div = document.createElement('div');
    div.textContent = s;
    return div.innerHTML;
  }

  return { init, open, close };
})();
