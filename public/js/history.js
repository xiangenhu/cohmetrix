/**
 * History — Results history panel backed by GCS.
 * Browse, load, and delete past analysis results.
 */
const History = (() => {
  let results = [];
  let isOpen = false;
  let isLoaded = false;

  function init() {
    const header = document.getElementById('history-header');
    if (header) {
      header.addEventListener('click', toggle);
    }
  }

  function toggle() {
    isOpen = !isOpen;
    const panel = document.getElementById('history-panel');
    panel.classList.toggle('open', isOpen);
    if (isOpen && !isLoaded) {
      loadResults();
    }
  }

  async function loadResults() {
    const body = document.getElementById('history-body');
    const badge = document.getElementById('history-badge');
    body.innerHTML = '<div class="history-loading">Loading past analyses…</div>';

    try {
      const resp = await fetch('/api/results?full=true');
      if (!resp.ok) throw new Error('Failed to load');
      const data = await resp.json();
      results = data.results || [];
      isLoaded = true;
      badge.textContent = results.length;
      renderList();
    } catch (err) {
      body.innerHTML = '<div class="history-empty">Failed to load results</div>';
      console.error('History load error:', err);
    }
  }

  function scoreCls(s) {
    if (s == null) return 'mid';
    return s >= 75 ? 'hi' : s >= 60 ? 'mid' : 'lo';
  }

  function renderList() {
    const body = document.getElementById('history-body');

    const toolbar = `
      <div class="history-toolbar">
        <span class="history-sort-label">Recent analyses</span>
        <button class="history-refresh-btn" id="history-refresh-btn">&#8635; Refresh</button>
      </div>`;

    if (results.length === 0) {
      body.innerHTML = toolbar + '<div class="history-empty">No analyses yet. Run an analysis to see results here.</div>';
      bindToolbar();
      return;
    }

    const items = results.map((r, i) => {
      const s = r.summary;
      const score = s?.overallScore ?? '—';
      const cls = scoreCls(s?.overallScore);
      const title = s?.promptText || `Analysis ${r.id.substring(0, 8)}`;
      const date = r.updated ? formatDate(r.updated) : s?.timestamp ? formatDate(s.timestamp) : '';
      const wordCount = s?.wordCount ? `${s.wordCount}w` : '';
      const layers = s?.layerCount ? `${s.layerCount}L` : '';
      const time = s?.analysisTime ? `${s.analysisTime.toFixed(1)}s` : '';

      return `
        <div class="hist-item" data-idx="${i}">
          <div class="hist-score ${cls}">${score}</div>
          <div class="hist-info">
            <div class="hist-title">${escapeHtml(title)}</div>
            <div class="hist-meta">
              <span class="hist-meta-item">${date}</span>
              ${wordCount ? `<span class="hist-meta-item">${wordCount}</span>` : ''}
              ${layers ? `<span class="hist-layers">${layers}</span>` : ''}
              ${time ? `<span class="hist-meta-item">${time}</span>` : ''}
            </div>
          </div>
          <div class="hist-actions">
            <button class="hist-action-btn delete" data-idx="${i}" title="Delete">&#10005;</button>
          </div>
        </div>`;
    }).join('');

    body.innerHTML = toolbar + items;

    // Bind click handlers
    body.querySelectorAll('.hist-item').forEach(el => {
      el.addEventListener('click', (e) => {
        if (e.target.closest('.hist-action-btn')) return;
        openResult(parseInt(el.dataset.idx, 10));
      });
    });

    body.querySelectorAll('.hist-action-btn.delete').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        deleteResult(parseInt(btn.dataset.idx, 10));
      });
    });

    bindToolbar();
  }

  function bindToolbar() {
    const refreshBtn = document.getElementById('history-refresh-btn');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        loadResults();
      });
    }
  }

  async function openResult(idx) {
    const r = results[idx];
    if (!r) return;

    try {
      const resp = await fetch(`/api/results/${r.id}`);
      if (!resp.ok) throw new Error('Failed to load result');
      const data = await resp.json();

      // Show the results screen with this data
      App.enableNav('btn-results');
      Results.show(data);
      App.showScreen('results');
    } catch (err) {
      alert('Failed to load result: ' + err.message);
    }
  }

  async function deleteResult(idx) {
    const r = results[idx];
    if (!r) return;
    if (!confirm(`Delete analysis ${r.id.substring(0, 8)}…?`)) return;

    try {
      const resp = await fetch(`/api/results/${r.id}`, { method: 'DELETE' });
      if (!resp.ok) throw new Error('Delete failed');
      await loadResults();
    } catch (err) {
      alert('Delete failed: ' + err.message);
    }
  }

  /** Refresh the list (called externally after a new analysis completes). */
  function refresh() {
    if (isLoaded) loadResults();
  }

  function formatDate(str) {
    try {
      const d = new Date(str);
      return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) +
        ' ' + d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
    } catch { return ''; }
  }

  function escapeHtml(s) {
    const div = document.createElement('div');
    div.textContent = s;
    return div.innerHTML;
  }

  return { init, loadResults, refresh };
})();
