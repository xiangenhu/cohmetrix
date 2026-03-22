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

    // Clear messages
    const msgArea = document.getElementById('help-messages');
    msgArea.innerHTML = '<div class="help-msg assistant loading">Thinking…</div>';

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

      // Show definition card + explanation
      msgArea.innerHTML = '';

      // Definition card
      const defCard = document.createElement('div');
      defCard.className = 'help-def-card';
      defCard.innerHTML = `<div class="help-def-label">Definition</div>${escapeHtml(data.definition?.definition || '')}`;
      msgArea.appendChild(defCard);

      // LLM explanation
      addMessage('assistant', data.explanation);
      history.push({ role: 'assistant', text: data.explanation });

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
    const loadingEl = addMessage('assistant', 'Thinking…', true);
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

    } catch {
      loadingEl.textContent = 'Sorry, I couldn\'t generate a response. Please try again.';
      loadingEl.classList.remove('loading');
    }

    isLoading = false;
    document.getElementById('help-send-btn').disabled = false;
    document.getElementById('help-input').focus();
  }

  function addMessage(role, text, isLoading) {
    const msgArea = document.getElementById('help-messages');
    const msg = document.createElement('div');
    msg.className = `help-msg ${role}${isLoading ? ' loading' : ''}`;
    msg.textContent = text;
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
