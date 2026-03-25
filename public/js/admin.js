/**
 * Admin — Super admin panel for managing all users and their projects.
 * Only visible when the logged-in user's email matches SUPER_ADMIN_EMAIL.
 */
const Admin = (() => {
  let isAdmin = false;
  let users = [];
  let currentUserId = null;
  let currentProjects = [];
  let currentProjectDetail = null;

  function init(userInfo) {
    isAdmin = !!(userInfo && userInfo.isAdmin);
    if (isAdmin) showAdminButton();
  }

  function showAdminButton() {
    const userBar = document.getElementById('user-bar');
    if (!userBar) return;
    // Only add once
    if (document.getElementById('admin-nav-btn')) return;
    const btn = document.createElement('button');
    btn.id = 'admin-nav-btn';
    btn.className = 'nav-btn';
    btn.style.cssText = 'font-size:11px;color:var(--amber);border-color:var(--amber);margin-right:6px';
    btn.textContent = 'Admin';
    btn.addEventListener('click', () => openAdmin());
    userBar.insertBefore(btn, userBar.firstChild);
  }

  async function openAdmin() {
    App.showScreen('admin');
    renderUserList();
  }

  function screen() { return document.getElementById('s-admin'); }

  function esc(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }
  function escAttr(s) { return esc(s).replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }

  // ═══════════════════════════════════════════════════════════════════════
  // USER LIST
  // ═══════════════════════════════════════════════════════════════════════

  async function renderUserList() {
    const s = screen();
    s.innerHTML = `
      <div class="admin-header">
        <button class="proj-back-btn" id="admin-back">&larr; Home</button>
        <div class="admin-title">Admin Panel — All Users</div>
      </div>
      <div class="admin-body">
        <div style="color:var(--text-tertiary);font-size:12px;padding:16px">Loading users...</div>
      </div>`;
    s.querySelector('#admin-back').addEventListener('click', () => { App.showScreen('upload'); });

    try {
      const resp = await Auth.apiFetch('/api/admin/users');
      if (!resp.ok) throw new Error('Failed to load users');
      users = (await resp.json()).users || [];

      s.querySelector('.admin-body').innerHTML = users.length === 0
        ? '<div style="color:var(--text-tertiary);font-size:12px;padding:16px">No users found.</div>'
        : `<table class="admin-table">
            <thead>
              <tr>
                <th>User</th>
                <th>Projects</th>
                <th>Files</th>
                <th>Results</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              ${users.map(u => `<tr class="admin-row" data-uid="${escAttr(u.userId)}">
                <td class="admin-user-email">${esc(u.email)}</td>
                <td>${u.projectCount}</td>
                <td>${u.totalFiles}</td>
                <td>${u.totalResults}</td>
                <td><button class="proj-back-btn" style="font-size:10px;padding:3px 8px">View &rarr;</button></td>
              </tr>`).join('')}
            </tbody>
          </table>`;

      s.querySelectorAll('.admin-row').forEach(row => {
        row.addEventListener('click', () => {
          currentUserId = row.dataset.uid;
          renderUserProjects();
        });
      });
    } catch (err) {
      s.querySelector('.admin-body').innerHTML = `<div style="color:var(--coral);font-size:12px;padding:16px">${esc(err.message)}</div>`;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // USER'S PROJECTS
  // ═══════════════════════════════════════════════════════════════════════

  async function renderUserProjects() {
    const s = screen();
    const user = users.find(u => u.userId === currentUserId);
    const email = user ? user.email : currentUserId;

    s.innerHTML = `
      <div class="admin-header">
        <button class="proj-back-btn" id="admin-back">&larr; Users</button>
        <div class="admin-title">${esc(email)} — Projects</div>
      </div>
      <div class="admin-body">
        <div style="color:var(--text-tertiary);font-size:12px;padding:16px">Loading projects...</div>
      </div>`;
    s.querySelector('#admin-back').addEventListener('click', renderUserList);

    try {
      const resp = await Auth.apiFetch(`/api/admin/users/${encodeURIComponent(currentUserId)}/projects`);
      if (!resp.ok) throw new Error('Failed');
      currentProjects = (await resp.json()).projects || [];

      s.querySelector('.admin-body').innerHTML = currentProjects.length === 0
        ? '<div style="color:var(--text-tertiary);font-size:12px;padding:16px">No projects.</div>'
        : `<table class="admin-table">
            <thead>
              <tr>
                <th>Project</th>
                <th>Files</th>
                <th>Results</th>
                <th>Updated</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              ${currentProjects.map(p => `<tr class="admin-row" data-pid="${p.id}">
                <td class="admin-user-email">${esc(p.name)}</td>
                <td>${p.fileCount || 0}</td>
                <td>${p.resultCount || 0}</td>
                <td style="font-size:10px;color:var(--text-tertiary)">${p.updatedAt ? new Date(p.updatedAt).toLocaleDateString() : ''}</td>
                <td style="white-space:nowrap">
                  <button class="proj-back-btn admin-view-proj" style="font-size:10px;padding:3px 8px">View</button>
                  <button class="proj-file-del admin-del-proj" data-pdel="${p.id}" title="Delete project" style="color:var(--coral)">&#10005;</button>
                </td>
              </tr>`).join('')}
            </tbody>
          </table>`;

      s.querySelectorAll('.admin-view-proj').forEach(btn => {
        const row = btn.closest('.admin-row');
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          renderProjectDetail(row.dataset.pid);
        });
      });

      s.querySelectorAll('.admin-del-proj').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          e.stopPropagation();
          if (!confirm('Delete this project and all its files/results?')) return;
          await Auth.apiFetch(`/api/admin/users/${encodeURIComponent(currentUserId)}/projects/${btn.dataset.pdel}`, { method: 'DELETE' });
          renderUserProjects();
        });
      });
    } catch (err) {
      s.querySelector('.admin-body').innerHTML = `<div style="color:var(--coral);font-size:12px;padding:16px">${esc(err.message)}</div>`;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // PROJECT DETAIL
  // ═══════════════════════════════════════════════════════════════════════

  async function renderProjectDetail(projectId) {
    const s = screen();
    const user = users.find(u => u.userId === currentUserId);
    const email = user ? user.email : currentUserId;

    s.innerHTML = `
      <div class="admin-header">
        <button class="proj-back-btn" id="admin-back">&larr; ${esc(email)}</button>
        <div class="admin-title">Project Detail</div>
      </div>
      <div class="admin-body">
        <div style="color:var(--text-tertiary);font-size:12px;padding:16px">Loading...</div>
      </div>`;
    s.querySelector('#admin-back').addEventListener('click', renderUserProjects);

    try {
      const resp = await Auth.apiFetch(`/api/admin/users/${encodeURIComponent(currentUserId)}/projects/${projectId}`);
      if (!resp.ok) throw new Error('Failed');
      const data = await resp.json();
      currentProjectDetail = data;

      const body = s.querySelector('.admin-body');
      body.innerHTML = `
        <div style="padding:16px;max-width:700px">
          <div style="font-size:16px;font-weight:600;color:var(--text-primary);margin-bottom:4px">${esc(data.project.name)}</div>
          ${data.project.description ? `<div style="font-size:12px;color:var(--text-secondary);margin-bottom:12px">${esc(data.project.description)}</div>` : ''}

          <div style="font-size:13px;font-weight:600;color:var(--text-primary);margin-bottom:8px">Files (${data.files.length})</div>
          ${data.files.length > 0 ? `<table class="admin-table" style="margin-bottom:16px">
            <thead><tr><th>File</th><th>Size</th><th>Metadata</th><th></th></tr></thead>
            <tbody>
              ${data.files.map(f => {
                const mc = f.meta ? Object.values(f.meta).filter(v => v && String(v).trim()).length : 0;
                return `<tr>
                  <td>${esc(f.name)}</td>
                  <td style="font-size:10px;color:var(--text-tertiary)">${f.sizeLabel || ''}</td>
                  <td style="font-size:10px">${mc > 0 ? mc + ' fields' : 'None'}</td>
                  <td><button class="proj-back-btn admin-view-file" data-fname="${escAttr(f.name)}" style="font-size:10px;padding:3px 8px">View</button></td>
                </tr>`;
              }).join('')}
            </tbody>
          </table>` : '<div style="font-size:12px;color:var(--text-tertiary);margin-bottom:16px">No files.</div>'}

          <div style="font-size:13px;font-weight:600;color:var(--text-primary);margin-bottom:8px">Results (${data.results.length})</div>
          ${data.results.length > 0 ? `<table class="admin-table">
            <thead><tr><th>Result ID</th><th>Date</th><th></th></tr></thead>
            <tbody>
              ${data.results.map(r => `<tr>
                <td style="font-size:10px;font-family:var(--font-mono)">${r.id ? r.id.substring(0, 8) + '...' : ''}</td>
                <td style="font-size:10px;color:var(--text-tertiary)">${r.updated ? new Date(r.updated).toLocaleDateString() : ''}</td>
                <td style="white-space:nowrap">
                  <button class="proj-back-btn admin-view-result" data-rid="${r.id}" style="font-size:10px;padding:3px 8px">View</button>
                  <button class="proj-file-del admin-del-result" data-rdel="${r.id}" style="color:var(--coral)">&#10005;</button>
                </td>
              </tr>`).join('')}
            </tbody>
          </table>` : '<div style="font-size:12px;color:var(--text-tertiary)">No results.</div>'}
        </div>`;

      // View file
      body.querySelectorAll('.admin-view-file').forEach(btn => {
        btn.addEventListener('click', async () => {
          try {
            const resp = await Auth.apiFetch(`/api/admin/users/${encodeURIComponent(currentUserId)}/projects/${projectId}/files/${encodeURIComponent(btn.dataset.fname)}/content?extract=true`);
            if (!resp.ok) throw new Error('Failed');
            const d = await resp.json();
            alert(`${d.name} (${d.wordCount} words)\n\n${d.text.substring(0, 2000)}${d.text.length > 2000 ? '\n\n... (truncated)' : ''}`);
          } catch (err) { alert('Error: ' + err.message); }
        });
      });

      // View result
      body.querySelectorAll('.admin-view-result').forEach(btn => {
        btn.addEventListener('click', async () => {
          try {
            const resp = await Auth.apiFetch(`/api/admin/users/${encodeURIComponent(currentUserId)}/projects/${projectId}/results/${btn.dataset.rid}`);
            if (!resp.ok) throw new Error('Failed');
            const result = await resp.json();
            Results.show(result);
            App.showScreen('results');
            App.enableNav('btn-results');
          } catch (err) { alert('Error: ' + err.message); }
        });
      });

      // Delete result
      body.querySelectorAll('.admin-del-result').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          e.stopPropagation();
          if (!confirm('Delete this result?')) return;
          await Auth.apiFetch(`/api/admin/users/${encodeURIComponent(currentUserId)}/projects/${projectId}/results/${btn.dataset.rdel}`, { method: 'DELETE' });
          renderProjectDetail(projectId);
        });
      });
    } catch (err) {
      s.querySelector('.admin-body').innerHTML = `<div style="color:var(--coral);font-size:12px;padding:16px">${esc(err.message)}</div>`;
    }
  }

  return { init, openAdmin };
})();
