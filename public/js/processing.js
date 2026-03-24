/**
 * Processing — Manages the analysis progress screen with SSE streaming.
 */
const Processing = (() => {
  const LAYER_INFO = [
    { id: 'L0', name: 'Descriptive & structural', i18n: 'd65185a27b7eadb2' },
    { id: 'L1', name: 'Lexical sophistication', i18n: '05be96cf3ac8a0ce' },
    { id: 'L2', name: 'Syntactic complexity', i18n: '1bae7c87e95bb737' },
    { id: 'L3', name: 'Referential cohesion', i18n: '590f883ecfe077d3' },
    { id: 'L4', name: 'Semantic cohesion', i18n: '620b7c9d549daafd' },
    { id: 'L5', name: 'Connective & deep cohesion', i18n: '62457ca3735609aa' },
    { id: 'L6', name: 'Situation model (LLM)', i18n: '0fa50f453aceb1d3' },
    { id: 'L7', name: 'Rhetorical structure (LLM)', i18n: 'b66a7829a8e4ce39' },
    { id: 'L8', name: 'Argumentation (LLM)', i18n: '9fb0fac2bae8ec2c' },
    { id: 'L9', name: 'Pragmatic stance', i18n: '3e5b7c86df673d2c' },
    { id: 'L10', name: 'Affective & engagement', i18n: '02cff7d1b553035c' },
    { id: 'L11', name: 'Reader-adaptive', i18n: '150712a41bf9565c' },
  ];

  function initUI() {
    const container = document.getElementById('layer-rows');
    container.innerHTML = '';
    LAYER_INFO.forEach(l => {
      const row = document.createElement('div');
      row.className = 'layer-row';
      row.innerHTML = `
        <span class="lr-badge">${l.id}</span>
        <span class="lr-label" data-i18n="${l.i18n}">${l.name}</span>
        <div class="lr-bar-bg"><div class="lr-bar" id="bar-${l.id}"></div></div>
        <span class="lr-status" id="st-${l.id}">—</span>`;
      container.appendChild(row);
    });

    const procTitle = document.getElementById('proc-title');
    procTitle.textContent = 'Initializing NLP pipeline…';
    procTitle.setAttribute('data-i18n', '1396aada4a95a663');
    const procSub = document.getElementById('proc-sub');
    procSub.textContent = 'Preparing analysis modules';
    procSub.setAttribute('data-i18n', '1db4bfea9970ee04');
    document.getElementById('spinner').style.display = '';
    document.getElementById('proc-log').textContent = '';
  }

  function updateLayer(layerId, status, progress) {
    const bar = document.getElementById('bar-' + layerId);
    const st = document.getElementById('st-' + layerId);
    if (!bar || !st) return;

    if (status === 'active') {
      bar.className = 'lr-bar active';
      bar.style.width = (progress || 60) + '%';
      st.textContent = '⋯';
      st.className = 'lr-status active';
    } else if (status === 'done') {
      bar.className = 'lr-bar done';
      bar.style.width = '100%';
      st.textContent = 'done';
      st.setAttribute('data-i18n', 'a4c3ed04a95a3da1');
      st.className = 'lr-status done';
    } else if (status === 'error') {
      bar.style.width = '100%';
      bar.style.background = 'var(--coral)';
      st.textContent = 'err';
      st.style.color = 'var(--coral)';
    }
  }

  function addLog(message) {
    const logEl = document.getElementById('proc-log');
    logEl.textContent = message + '\n' + logEl.textContent;
  }

  function updateTokenDisplay(usage) {
    const el = (id, val) => {
      const e = document.getElementById(id);
      if (e) e.textContent = (val || 0).toLocaleString();
    };
    el('proc-prompt-tokens', usage.promptTokens);
    el('proc-completion-tokens', usage.completionTokens);
    el('proc-total-tokens', usage.totalTokens);
    el('proc-llm-calls', usage.calls);
  }

  async function start(formData) {
    initUI();

    try {
      // Submit analysis request (with auth token)
      const response = await Auth.apiFetch('/api/analyze', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Analysis failed');
      }

      const { analysisId } = await response.json();
      addLog(`Analysis started · ID: ${analysisId.substring(0, 8)}…`);

      // Connect to SSE stream for progress (token via query param since EventSource has no header support)
      const sseToken = Auth.getToken();
      const evtSource = new EventSource(`/api/analyze/${analysisId}/stream?token=${encodeURIComponent(sseToken)}`);

      evtSource.onmessage = (event) => {
        const data = JSON.parse(event.data);

        switch (data.type) {
          case 'init':
          case 'log':
            addLog(data.message);
            break;

          case 'layer_start': {
            const titleEl = document.getElementById('proc-title');
            titleEl.textContent = `Analyzing ${data.layerName}…`;
            titleEl.setAttribute('data-i18n', '89b633adede66a05');
            updateLayer(data.layerId, 'active');
            addLog(data.message);
            break;
          }

          case 'layer_done':
            updateLayer(data.layerId, 'done');
            addLog(data.message);
            if (data.tokenUsage) {
              updateTokenDisplay(data.tokenUsage);
              TokenFooter.refresh();
            }
            break;

          case 'layer_error':
            updateLayer(data.layerId, 'error');
            addLog(data.message);
            break;

          case 'complete': {
            evtSource.close();
            document.getElementById('spinner').style.display = 'none';
            const completeTitle = document.getElementById('proc-title');
            completeTitle.textContent = 'Analysis complete';
            completeTitle.setAttribute('data-i18n', '60ffb9b9006a07df');
            document.getElementById('proc-sub').textContent = data.message;
            addLog(data.message);
            if (data.tokenUsage) {
              updateTokenDisplay(data.tokenUsage);
              TokenFooter.setAnalysisTokens(data.tokenUsage);
              TokenFooter.refresh();
            }

            // Fetch results and show
            setTimeout(() => {
              App.enableNav('btn-results');
              fetchAndShowResults(analysisId);
            }, 600);
            break;
          }

          case 'error': {
            evtSource.close();
            document.getElementById('spinner').style.display = 'none';
            const failTitle = document.getElementById('proc-title');
            failTitle.textContent = 'Analysis failed';
            failTitle.setAttribute('data-i18n', '4d6ac1bfe5d253f3');
            document.getElementById('proc-sub').textContent = data.message;
            addLog('ERROR: ' + data.message);
            break;
          }
        }
      };

      evtSource.onerror = () => {
        evtSource.close();
        // Try to fetch results anyway (SSE may have just ended)
        setTimeout(() => fetchAndShowResults(analysisId), 1000);
      };

    } catch (err) {
      document.getElementById('spinner').style.display = 'none';
      const errTitle = document.getElementById('proc-title');
      errTitle.textContent = 'Error';
      errTitle.setAttribute('data-i18n', '54a0e8c17ebb21a1');
      document.getElementById('proc-sub').textContent = err.message;
      addLog('ERROR: ' + err.message);
    }
  }

  async function fetchAndShowResults(analysisId) {
    try {
      const resp = await Auth.apiFetch(`/api/results/${analysisId}`);
      if (!resp.ok) throw new Error('Failed to load results');
      const data = await resp.json();
      Results.show(data);
      App.showScreen('results');
      // Refresh history panel so new result appears
      History.refresh();
    } catch (err) {
      console.error('Failed to fetch results:', err);
    }
  }

  return { start, initUI, updateLayer, updateTokenDisplay, addLog };
})();
