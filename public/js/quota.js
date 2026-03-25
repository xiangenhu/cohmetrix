/**
 * Quota — User balance display, per-project usage, PayPal top-up.
 *
 * - Shows balance in topbar ($ button)
 * - Loads per-project usage breakdown in cost modal
 * - Handles quota_exceeded errors by showing PayPal payment modal
 * - PayPal SDK loaded on-demand when user opens add-funds modal
 */
const Quota = (() => {
  let quotaData = { quota: 0, spent: 0, remaining: 0 };
  let paypalConfig = null;
  let paypalLoaded = false;
  let selectedAmount = 5;

  function fmtUsd(n) {
    if (n < 0.005) return '$0.00';
    if (n < 0.10) return '$' + n.toFixed(3);
    return '$' + n.toFixed(2);
  }

  // ─── Load quota from server ──────────────────────────────────────────────

  async function loadQuota() {
    try {
      const resp = await Auth.apiFetch('/api/quota');
      if (!resp.ok) return;
      quotaData = await resp.json();
      updateBalanceDisplay();
    } catch { /* ignore */ }
  }

  function updateBalanceDisplay() {
    // Topbar $ button — show balance
    const fab = document.getElementById('cost-fab');
    if (fab) fab.textContent = fmtUsd(quotaData.remaining);

    // Cost modal balance row
    const elRemaining = document.getElementById('quota-remaining');
    const elTotal = document.getElementById('quota-total');
    const elSpent = document.getElementById('quota-spent');
    if (elRemaining) elRemaining.textContent = fmtUsd(quotaData.remaining);
    if (elTotal) elTotal.textContent = fmtUsd(quotaData.quota);
    if (elSpent) elSpent.textContent = fmtUsd(quotaData.spent);

    // Quota modal balance
    const elModalBal = document.getElementById('quota-modal-balance');
    if (elModalBal) elModalBal.textContent = fmtUsd(quotaData.remaining);

    // Color code the topbar button
    if (fab) {
      fab.classList.remove('quota-low', 'quota-ok');
      fab.classList.add(quotaData.remaining <= 0.05 ? 'quota-low' : 'quota-ok');
    }
  }

  // ─── Per-project usage breakdown ─────────────────────────────────────────

  async function loadProjectUsage() {
    const container = document.getElementById('cost-projects-table');
    if (!container) return;
    container.innerHTML = '<div class="cost-projects-loading">Loading...</div>';

    try {
      const resp = await Auth.apiFetch('/api/projects');
      if (!resp.ok) throw new Error('Failed');
      const { projects } = await resp.json();
      if (!projects || projects.length === 0) {
        container.innerHTML = '<div class="cost-projects-empty">No projects yet</div>';
        return;
      }

      // Load usage for each project
      const usageData = await Promise.all(projects.map(async (p) => {
        try {
          const r = await Auth.apiFetch(`/api/projects/${p.id}/usage`);
          if (!r.ok) return { id: p.id, name: p.name, calls: 0, tokens: 0, cost: 0, resultCount: p.resultCount || 0 };
          const u = await r.json();
          return {
            id: p.id,
            name: p.name,
            calls: u.totals?.calls || 0,
            tokens: u.totals?.totalTokens || 0,
            cost: u.totals?.totalCost || 0,
            resultCount: p.resultCount || 0,
          };
        } catch { return { id: p.id, name: p.name, calls: 0, tokens: 0, cost: 0, resultCount: 0 }; }
      }));

      const totalCalls = usageData.reduce((s, u) => s + u.calls, 0);
      const totalTokens = usageData.reduce((s, u) => s + u.tokens, 0);
      const totalCost = usageData.reduce((s, u) => s + u.cost, 0);

      container.innerHTML = `
        <table class="cost-proj-tbl">
          <thead><tr><th>Project</th><th>Calls</th><th>Tokens</th><th>Cost</th><th>Results</th></tr></thead>
          <tbody>
            ${usageData.filter(u => u.calls > 0).map(u => `
              <tr data-project-id="${u.id}" title="Click to open project">
                <td>${esc(u.name)}</td>
                <td>${u.calls.toLocaleString()}</td>
                <td>${u.tokens.toLocaleString()}</td>
                <td>${fmtUsd(u.cost)}</td>
                <td>${u.resultCount}</td>
              </tr>
            `).join('') || '<tr><td colspan="5" class="cost-projects-empty">No usage recorded</td></tr>'}
          </tbody>
          <tfoot><tr class="cost-proj-total">
            <td><strong>Total</strong></td>
            <td><strong>${totalCalls.toLocaleString()}</strong></td>
            <td><strong>${totalTokens.toLocaleString()}</strong></td>
            <td><strong>${fmtUsd(totalCost)}</strong></td>
            <td></td>
          </tr></tfoot>
        </table>`;

      // Make project rows clickable — navigate to that project
      container.querySelectorAll('tr[data-project-id]').forEach(row => {
        row.addEventListener('click', () => {
          TokenFooter.closeModal();
          if (typeof Projects !== 'undefined' && Projects.openProject) {
            Projects.openProject(row.dataset.projectId);
          }
        });
      });
    } catch {
      container.innerHTML = '<div class="cost-projects-empty">Failed to load usage</div>';
    }
  }

  // ─── Helper: escape HTML ─────────────────────────────────────────────────

  function esc(s) {
    const d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
  }

  // ─── PayPal integration ──────────────────────────────────────────────────

  async function loadPayPalConfig() {
    if (paypalConfig) return paypalConfig;
    try {
      const resp = await Auth.apiFetch('/api/quota/config');
      if (resp.ok) paypalConfig = await resp.json();
    } catch { /* ignore */ }
    return paypalConfig;
  }

  async function loadPayPalSDK() {
    if (paypalLoaded) return true;
    const cfg = await loadPayPalConfig();
    if (!cfg || !cfg.paypalClientId) {
      showStatus('PayPal is not configured. Contact administrator.', 'error');
      return false;
    }
    return new Promise((resolve) => {
      const script = document.createElement('script');
      script.src = `https://www.paypal.com/sdk/js?client-id=${cfg.paypalClientId}&currency=USD`;
      script.onload = () => { paypalLoaded = true; resolve(true); };
      script.onerror = () => { showStatus('Failed to load PayPal SDK', 'error'); resolve(false); };
      document.head.appendChild(script);
    });
  }

  function renderPayPalButtons() {
    const container = document.getElementById('quota-paypal-container');
    if (!container || !window.paypal) return;
    container.innerHTML = '';

    window.paypal.Buttons({
      style: { layout: 'vertical', color: 'gold', shape: 'rect', label: 'pay', height: 40 },

      createOrder: async () => {
        showStatus('Creating order...', 'info');
        const resp = await Auth.apiFetch('/api/quota/create-order', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ amount: selectedAmount }),
        });
        if (!resp.ok) {
          const err = await resp.json();
          throw new Error(err.error || 'Failed to create order');
        }
        const data = await resp.json();
        showStatus('', '');
        return data.orderId;
      },

      onApprove: async (data) => {
        showStatus('Processing payment...', 'info');
        const resp = await Auth.apiFetch('/api/quota/capture-order', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ orderId: data.orderID }),
        });
        if (!resp.ok) {
          const err = await resp.json();
          showStatus(err.error || 'Payment failed', 'error');
          return;
        }
        const result = await resp.json();
        quotaData.quota = result.quota;
        quotaData.spent = result.spent;
        quotaData.remaining = result.remaining;
        updateBalanceDisplay();
        showStatus(`$${result.credited.toFixed(2)} added successfully!`, 'success');
        setTimeout(() => closeQuotaModal(), 2000);
      },

      onError: (err) => {
        console.error('[PayPal]', err);
        showStatus('Payment error. Please try again.', 'error');
      },

      onCancel: () => {
        showStatus('Payment cancelled.', 'info');
      },
    }).render(container);
  }

  function showStatus(msg, type) {
    const el = document.getElementById('quota-status');
    if (!el) return;
    el.textContent = msg;
    el.className = 'quota-status' + (type ? ` quota-status-${type}` : '');
  }

  // ─── Modals ──────────────────────────────────────────────────────────────

  async function openQuotaModal() {
    await loadQuota();
    document.getElementById('quota-overlay').classList.add('open');
    const loaded = await loadPayPalSDK();
    if (loaded) renderPayPalButtons();
  }

  function closeQuotaModal() {
    document.getElementById('quota-overlay').classList.remove('open');
  }

  /**
   * Called by apiFetch when a 402 quota_exceeded response is detected.
   */
  function handleQuotaExceeded(data) {
    if (data) {
      quotaData.quota = data.quota || quotaData.quota;
      quotaData.spent = data.spent || quotaData.spent;
      quotaData.remaining = data.remaining || 0;
      updateBalanceDisplay();
    }
    const msgEl = document.getElementById('quota-message');
    if (msgEl) msgEl.textContent = 'Your balance has been exhausted. Please add funds to continue.';
    openQuotaModal();
  }

  // ─── Init ────────────────────────────────────────────────────────────────

  function init() {
    loadQuota();

    // Add funds button in cost modal
    const topupBtn = document.getElementById('cost-topup-btn');
    if (topupBtn) topupBtn.addEventListener('click', () => {
      TokenFooter.closeModal();
      openQuotaModal();
    });

    // Quota modal close
    const closeBtn = document.getElementById('quota-close-btn');
    if (closeBtn) closeBtn.addEventListener('click', closeQuotaModal);
    const backdrop = document.getElementById('quota-backdrop');
    if (backdrop) backdrop.addEventListener('click', closeQuotaModal);
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeQuotaModal();
    });

    // Amount selector buttons
    document.querySelectorAll('.quota-amount-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.quota-amount-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        selectedAmount = parseFloat(btn.dataset.amount);
        // Re-render PayPal buttons with new amount
        if (paypalLoaded) renderPayPalButtons();
      });
    });
  }

  return { init, loadQuota, updateBalanceDisplay, handleQuotaExceeded, openQuotaModal, closeQuotaModal, loadProjectUsage, getQuota: () => quotaData };
})();
