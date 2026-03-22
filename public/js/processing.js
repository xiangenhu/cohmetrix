/**
 * Processing — Manages the analysis progress screen with SSE streaming.
 */
const Processing = (() => {
  const LAYER_INFO = [
    { id: 'L0', name: 'Surface & structural' },
    { id: 'L1', name: 'Lexical sophistication' },
    { id: 'L2', name: 'Syntactic complexity' },
    { id: 'L3', name: 'Referential cohesion' },
    { id: 'L4', name: 'Semantic cohesion' },
    { id: 'L5', name: 'Situation model (LLM)' },
    { id: 'L6', name: 'RST structure' },
    { id: 'L7', name: 'Argumentation (LLM)' },
    { id: 'L8', name: 'Pragmatic stance' },
    { id: 'L9', name: 'Affective trajectory' },
    { id: 'L10', name: 'Reader-adaptive' },
  ];

  function initUI() {
    const container = document.getElementById('layer-rows');
    container.innerHTML = '';
    LAYER_INFO.forEach(l => {
      const row = document.createElement('div');
      row.className = 'layer-row';
      row.innerHTML = `
        <span class="lr-badge">${l.id}</span>
        <span class="lr-label">${l.name}</span>
        <div class="lr-bar-bg"><div class="lr-bar" id="bar-${l.id}"></div></div>
        <span class="lr-status" id="st-${l.id}">—</span>`;
      container.appendChild(row);
    });

    document.getElementById('proc-title').textContent = 'Initializing NLP pipeline…';
    document.getElementById('proc-sub').textContent = 'Preparing analysis modules';
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

  async function start(formData) {
    initUI();

    try {
      // Submit analysis request
      const response = await fetch('/api/analyze', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Analysis failed');
      }

      const { analysisId } = await response.json();
      addLog(`Analysis started · ID: ${analysisId.substring(0, 8)}…`);

      // Connect to SSE stream for progress
      const evtSource = new EventSource(`/api/analyze/${analysisId}/stream`);

      evtSource.onmessage = (event) => {
        const data = JSON.parse(event.data);

        switch (data.type) {
          case 'init':
          case 'log':
            addLog(data.message);
            break;

          case 'layer_start':
            document.getElementById('proc-title').textContent = `Analyzing ${data.layerName}…`;
            updateLayer(data.layerId, 'active');
            addLog(data.message);
            break;

          case 'layer_done':
            updateLayer(data.layerId, 'done');
            addLog(data.message);
            break;

          case 'layer_error':
            updateLayer(data.layerId, 'error');
            addLog(data.message);
            break;

          case 'complete':
            evtSource.close();
            document.getElementById('spinner').style.display = 'none';
            document.getElementById('proc-title').textContent = 'Analysis complete';
            document.getElementById('proc-sub').textContent = data.message;
            addLog(data.message);

            // Fetch results and show
            setTimeout(() => {
              App.enableNav('btn-results');
              fetchAndShowResults(analysisId);
            }, 600);
            break;

          case 'error':
            evtSource.close();
            document.getElementById('spinner').style.display = 'none';
            document.getElementById('proc-title').textContent = 'Analysis failed';
            document.getElementById('proc-sub').textContent = data.message;
            addLog('ERROR: ' + data.message);
            break;
        }
      };

      evtSource.onerror = () => {
        evtSource.close();
        // Try to fetch results anyway (SSE may have just ended)
        setTimeout(() => fetchAndShowResults(analysisId), 1000);
      };

    } catch (err) {
      document.getElementById('spinner').style.display = 'none';
      document.getElementById('proc-title').textContent = 'Error';
      document.getElementById('proc-sub').textContent = err.message;
      addLog('ERROR: ' + err.message);
    }
  }

  async function fetchAndShowResults(analysisId) {
    try {
      const resp = await fetch(`/api/results/${analysisId}`);
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

  return { start };
})();
