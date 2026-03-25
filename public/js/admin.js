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

  let adminView = 'users'; // 'users' or 'projects'
  let allKnownUsers = []; // cached user list for owner assignment

  async function openAdmin() {
    App.showScreen('admin');
    if (adminView === 'projects') renderAllProjects();
    else if (adminView === 'audit') renderAuditLog();
    else if (adminView === 'usage') renderUsageOverview();
    else renderUserList();
  }

  function screen() { return document.getElementById('s-admin'); }

  function esc(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }
  function escAttr(s) { return esc(s).replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }

  // ═══════════════════════════════════════════════════════════════════════
  // USER LIST
  // ═══════════════════════════════════════════════════════════════════════

  function renderAdminTabs(s, active) {
    const tab = (id, label) => `<button class="admin-tab${active === id ? ' active' : ''}" id="admin-tab-${id}" style="padding:8px 20px;font-size:12px;font-weight:${active === id ? '600' : '400'};border:none;border-bottom:2px solid ${active === id ? 'var(--teal)' : 'transparent'};background:none;color:${active === id ? 'var(--text-primary)' : 'var(--text-tertiary)'};cursor:pointer">${label}</button>`;
    return `<div class="admin-tabs" style="display:flex;gap:0;margin-bottom:0">
      ${tab('users', 'Users')}${tab('projects', 'All Projects')}${tab('audit', 'Audit Log')}${tab('usage', 'Usage')}
    </div>`;
  }

  function bindAdminTabs(s) {
    s.querySelector('#admin-tab-users')?.addEventListener('click', () => { adminView = 'users'; renderUserList(); });
    s.querySelector('#admin-tab-projects')?.addEventListener('click', () => { adminView = 'projects'; renderAllProjects(); });
    s.querySelector('#admin-tab-audit')?.addEventListener('click', () => { adminView = 'audit'; renderAuditLog(); });
    s.querySelector('#admin-tab-usage')?.addEventListener('click', () => { adminView = 'usage'; renderUsageOverview(); });
  }

  async function renderUserList() {
    const s = screen();
    s.innerHTML = `
      <div class="admin-header">
        <button class="proj-back-btn" id="admin-back">&larr; Home</button>
        <div class="admin-title">Admin Panel</div>
        <button class="proj-back-btn" id="admin-migrate-btn" style="margin-left:auto;font-size:10px;padding:3px 10px;color:var(--amber);border-color:var(--amber)" title="Migrate old storage layout to new email/documents/analysis structure">Migrate Storage</button>
      </div>
      ${renderAdminTabs(s, 'users')}
      <div class="admin-body">
        <div style="color:var(--text-tertiary);font-size:12px;padding:16px">Loading users...</div>
      </div>`;
    s.querySelector('#admin-back').addEventListener('click', () => { App.showScreen('upload'); });
    s.querySelector('#admin-migrate-btn')?.addEventListener('click', async () => {
      if (!confirm('Migrate storage from old layout (sanitized IDs, files/, results/) to new layout (email, documents/, analysis/)?\n\nThis will move all GCS objects.')) return;
      const btn = s.querySelector('#admin-migrate-btn');
      btn.disabled = true; btn.textContent = 'Migrating...';
      try {
        const resp = await Auth.apiFetch('/api/admin/migrate', { method: 'POST' });
        const stats = await resp.json();
        alert(`Migration complete:\n- Migrated: ${stats.migrated}\n- Skipped: ${stats.skipped}\n- Errors: ${stats.errors}`);
        renderUserList();
      } catch (err) {
        alert('Migration failed: ' + err.message);
        btn.disabled = false; btn.textContent = 'Migrate Storage';
      }
    });
    bindAdminTabs(s);

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
  // ALL PROJECTS (across all users)
  // ═══════════════════════════════════════════════════════════════════════

  async function renderAllProjects() {
    const s = screen();
    s.innerHTML = `
      <div class="admin-header">
        <button class="proj-back-btn" id="admin-back">&larr; Home</button>
        <div class="admin-title">Admin Panel</div>
      </div>
      ${renderAdminTabs(s, 'projects')}
      <div class="admin-body">
        <div style="color:var(--text-tertiary);font-size:12px;padding:16px">Loading projects...</div>
      </div>`;
    s.querySelector('#admin-back').addEventListener('click', () => { App.showScreen('upload'); });
    bindAdminTabs(s);

    try {
      // Load projects and users in parallel
      const [projResp, userResp] = await Promise.all([
        Auth.apiFetch('/api/admin/projects'),
        Auth.apiFetch('/api/admin/users'),
      ]);
      if (!projResp.ok) throw new Error('Failed to load projects');
      const allProjects = (await projResp.json()).projects || [];
      if (userResp.ok) {
        allKnownUsers = (await userResp.json()).users || [];
        // Also merge into the users array for navigation
        for (const u of allKnownUsers) {
          if (!users.find(x => x.userId === u.userId)) users.push(u);
        }
      }

      s.querySelector('.admin-body').innerHTML = allProjects.length === 0
        ? '<div style="color:var(--text-tertiary);font-size:12px;padding:16px">No projects found.</div>'
        : `<table class="admin-table">
            <thead>
              <tr>
                <th>Project</th>
                <th>Owner</th>
                <th>Files</th>
                <th>Results</th>
                <th>Updated</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              ${allProjects.map(p => `<tr class="admin-row" data-pid="${p.id}" data-uid="${escAttr(p.userId)}">
                <td class="admin-user-email">${esc(p.name)}</td>
                <td style="font-size:11px;color:var(--text-secondary)">
                  <span class="admin-owner-label">${esc(p.ownerEmail)}</span>
                  <button class="admin-assign-btn" data-apid="${p.id}" data-auid="${escAttr(p.userId)}" title="Assign owner" style="margin-left:4px;background:none;border:none;color:var(--teal);cursor:pointer;font-size:10px;padding:1px 4px">&#9998;</button>
                </td>
                <td>${p.fileCount || 0}</td>
                <td>${p.resultCount || 0}</td>
                <td style="font-size:10px;color:var(--text-tertiary)">${p.updatedAt ? new Date(p.updatedAt).toLocaleDateString() : ''}</td>
                <td style="white-space:nowrap">
                  <button class="proj-back-btn admin-view-proj" style="font-size:10px;padding:3px 8px">View</button>
                  <button class="proj-file-del admin-del-proj" data-pdel="${p.id}" data-udel="${escAttr(p.userId)}" title="Delete project" style="color:var(--coral)">&#10005;</button>
                </td>
              </tr>`).join('')}
            </tbody>
          </table>`;

      // Assign owner buttons
      s.querySelectorAll('.admin-assign-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          showAssignOwnerDialog(btn.dataset.auid, btn.dataset.apid);
        });
      });

      s.querySelectorAll('.admin-view-proj').forEach(btn => {
        const row = btn.closest('.admin-row');
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          currentUserId = row.dataset.uid;
          const proj = allProjects.find(p => p.id === row.dataset.pid);
          if (proj && !users.find(u => u.userId === proj.userId)) {
            users.push({ userId: proj.userId, email: proj.ownerEmail });
          }
          renderProjectDetail(row.dataset.pid);
        });
      });

      s.querySelectorAll('.admin-del-proj').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          e.stopPropagation();
          if (!confirm('Delete this project and all its files/results?')) return;
          await Auth.apiFetch(`/api/admin/users/${encodeURIComponent(btn.dataset.udel)}/projects/${btn.dataset.pdel}`, { method: 'DELETE' });
          renderAllProjects();
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
    const goBack = adminView === 'projects' ? renderAllProjects : renderUserProjects;
    const backLabel = adminView === 'projects' ? 'All Projects' : email;

    s.innerHTML = `
      <div class="admin-header">
        <button class="proj-back-btn" id="admin-back">&larr; ${esc(backLabel)}</button>
        <div class="admin-title">Project Detail</div>
      </div>
      <div class="admin-body">
        <div style="color:var(--text-tertiary);font-size:12px;padding:16px">Loading...</div>
      </div>`;
    s.querySelector('#admin-back').addEventListener('click', goBack);

    try {
      const resp = await Auth.apiFetch(`/api/admin/users/${encodeURIComponent(currentUserId)}/projects/${projectId}`);
      if (!resp.ok) throw new Error('Failed');
      const data = await resp.json();
      currentProjectDetail = data;

      const body = s.querySelector('.admin-body');
      body.innerHTML = `
        <div style="padding:16px;max-width:700px">
          <div style="font-size:16px;font-weight:600;color:var(--text-primary);margin-bottom:4px">${esc(data.project.name)}</div>
          <div style="font-size:12px;color:var(--text-secondary);margin-bottom:4px">Owner: <strong>${esc(email)}</strong> <button class="admin-assign-detail-btn" style="background:none;border:none;color:var(--teal);cursor:pointer;font-size:11px;padding:1px 4px">&#9998; Reassign</button></div>
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

      // Reassign owner from detail view
      body.querySelector('.admin-assign-detail-btn')?.addEventListener('click', () => {
        showAssignOwnerDialog(currentUserId, projectId);
      });

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

  // ═══════════════════════════════════════════════════════════════════════
  // AUDIT LOG
  // ═══════════════════════════════════════════════════════════════════════

  async function renderAuditLog() {
    const s = screen();
    const now = new Date();
    const defaultMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    s.innerHTML = `
      <div class="admin-header">
        <button class="proj-back-btn" id="admin-back">&larr; Home</button>
        <div class="admin-title">Admin Panel</div>
      </div>
      ${renderAdminTabs(s, 'audit')}
      <div class="admin-body" style="padding:16px">
        <div style="display:flex;gap:8px;align-items:center;margin-bottom:12px">
          <label style="font-size:12px;color:var(--text-secondary)">Month:</label>
          <input type="month" id="audit-month" value="${defaultMonth}" style="padding:4px 8px;font-size:12px;border:0.5px solid var(--border-tertiary);border-radius:var(--radius-md);background:var(--bg-secondary);color:var(--text-primary)">
          <label style="font-size:12px;color:var(--text-secondary);margin-left:8px">User:</label>
          <input type="text" id="audit-user-filter" placeholder="email (optional)" style="padding:4px 8px;font-size:12px;border:0.5px solid var(--border-tertiary);border-radius:var(--radius-md);background:var(--bg-secondary);color:var(--text-primary);width:180px">
          <button class="proj-upload-btn" id="audit-load-btn" style="font-size:11px">Load</button>
        </div>
        <div id="audit-entries" style="color:var(--text-tertiary);font-size:12px">Click Load to browse audit entries.</div>
      </div>`;

    s.querySelector('#admin-back').addEventListener('click', () => { App.showScreen('upload'); });
    bindAdminTabs(s);

    s.querySelector('#audit-load-btn').addEventListener('click', async () => {
      const month = s.querySelector('#audit-month').value;
      const userId = s.querySelector('#audit-user-filter').value.trim() || undefined;
      const entriesEl = s.querySelector('#audit-entries');
      entriesEl.innerHTML = '<div style="color:var(--text-tertiary)">Loading...</div>';

      try {
        let url = `/api/admin/audit?month=${month}`;
        if (userId) url += `&userId=${encodeURIComponent(userId)}`;
        const resp = await Auth.apiFetch(url);
        if (!resp.ok) throw new Error('Failed');
        const data = await resp.json();

        if (data.entries.length === 0) {
          entriesEl.innerHTML = '<div style="color:var(--text-tertiary)">No audit entries found for this period.</div>';
          return;
        }

        entriesEl.innerHTML = `
          <div style="margin-bottom:8px;font-size:11px;color:var(--text-tertiary)">${data.count} entries</div>
          <table class="admin-table">
            <thead><tr><th>Time</th><th>User</th><th>Project</th><th>File</th><th>Action</th><th>Tokens</th><th></th></tr></thead>
            <tbody>
              ${data.entries.slice(0, 100).map(e => {
                // Extract info from path: admin/audit/YYYY-MM/user/project/timestamp.json
                const parts = e.path.split('/');
                const user = parts[3] || '';
                const project = parts[4] || '';
                return `<tr class="admin-row">
                  <td style="font-size:10px;color:var(--text-tertiary);white-space:nowrap">${e.updated ? new Date(e.updated).toLocaleString() : ''}</td>
                  <td style="font-size:10px">${esc(user)}</td>
                  <td style="font-size:10px;font-family:var(--font-mono)">${project === '_standalone' ? '' : project.substring(0, 8)}</td>
                  <td style="font-size:10px"></td>
                  <td style="font-size:10px"></td>
                  <td style="font-size:10px;font-family:var(--font-mono)">${e.size ? Math.round(e.size / 1024) + 'K' : ''}</td>
                  <td><button class="proj-back-btn audit-view-btn" data-apath="${escAttr(e.path)}" style="font-size:10px;padding:2px 6px">View</button></td>
                </tr>`;
              }).join('')}
            </tbody>
          </table>
          ${data.entries.length > 100 ? `<div style="font-size:11px;color:var(--text-tertiary);margin-top:8px">Showing first 100 of ${data.count} entries</div>` : ''}`;

        entriesEl.querySelectorAll('.audit-view-btn').forEach(btn => {
          btn.addEventListener('click', async () => {
            try {
              const resp = await Auth.apiFetch(`/api/admin/audit/entry?path=${encodeURIComponent(btn.dataset.apath)}`);
              if (!resp.ok) throw new Error('Failed');
              const entry = await resp.json();
              showAuditEntryModal(entry);
            } catch (err) { alert('Error: ' + err.message); }
          });
        });
      } catch (err) {
        entriesEl.innerHTML = `<div style="color:var(--coral)">${esc(err.message)}</div>`;
      }
    });
  }

  function showAuditEntryModal(entry) {
    document.getElementById('admin-audit-modal')?.remove();
    const overlay = document.createElement('div');
    overlay.id = 'admin-audit-modal';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:1000';
    overlay.innerHTML = `
      <div style="background:var(--bg-primary);border:1px solid var(--border-tertiary);border-radius:var(--radius-lg);padding:24px;width:90%;max-width:700px;max-height:85vh;overflow-y:auto">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
          <div style="font-size:14px;font-weight:600">Audit Entry</div>
          <button id="audit-modal-close" style="background:none;border:none;color:var(--text-tertiary);cursor:pointer;font-size:18px">&times;</button>
        </div>
        <div style="display:grid;grid-template-columns:auto 1fr;gap:4px 12px;font-size:12px;margin-bottom:16px">
          <span style="color:var(--text-tertiary)">Time</span><span>${esc(entry.timestamp || '')}</span>
          <span style="color:var(--text-tertiary)">User</span><span>${esc(entry.userId || 'anonymous')}</span>
          <span style="color:var(--text-tertiary)">Project</span><span style="font-family:var(--font-mono)">${esc(entry.projectId || 'standalone')}</span>
          <span style="color:var(--text-tertiary)">File</span><span>${esc(entry.fileName || '')}</span>
          <span style="color:var(--text-tertiary)">Action</span><span>${esc(entry.action || '')}</span>
          <span style="color:var(--text-tertiary)">Provider</span><span>${esc(entry.provider || '')} / ${esc(entry.model || '')}</span>
          <span style="color:var(--text-tertiary)">Tokens</span><span style="font-family:var(--font-mono)">${entry.tokens?.prompt || 0} in / ${entry.tokens?.completion || 0} out</span>
        </div>
        <div style="margin-bottom:12px">
          <div style="font-size:11px;font-weight:600;color:var(--text-secondary);margin-bottom:4px">System Prompt</div>
          <pre style="font-size:10px;background:var(--bg-secondary);padding:10px;border-radius:var(--radius-md);white-space:pre-wrap;max-height:150px;overflow-y:auto;color:var(--text-primary)">${esc(entry.systemPrompt || '')}</pre>
        </div>
        <div style="margin-bottom:12px">
          <div style="font-size:11px;font-weight:600;color:var(--text-secondary);margin-bottom:4px">User Prompt</div>
          <pre style="font-size:10px;background:var(--bg-secondary);padding:10px;border-radius:var(--radius-md);white-space:pre-wrap;max-height:200px;overflow-y:auto;color:var(--text-primary)">${esc(entry.userPrompt || '')}</pre>
        </div>
        <div>
          <div style="font-size:11px;font-weight:600;color:var(--text-secondary);margin-bottom:4px">Response</div>
          <pre style="font-size:10px;background:var(--bg-secondary);padding:10px;border-radius:var(--radius-md);white-space:pre-wrap;max-height:250px;overflow-y:auto;color:var(--text-primary)">${esc(entry.response || '')}</pre>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    overlay.querySelector('#audit-modal-close').addEventListener('click', () => overlay.remove());
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
  }

  // ═══════════════════════════════════════════════════════════════════════
  // USAGE OVERVIEW (all users)
  // ═══════════════════════════════════════════════════════════════════════

  async function renderUsageOverview() {
    const s = screen();
    s.innerHTML = `
      <div class="admin-header">
        <button class="proj-back-btn" id="admin-back">&larr; Home</button>
        <div class="admin-title">Admin Panel</div>
      </div>
      ${renderAdminTabs(s, 'usage')}
      <div class="admin-body">
        <div style="color:var(--text-tertiary);font-size:12px;padding:16px">Loading usage data...</div>
      </div>`;
    s.querySelector('#admin-back').addEventListener('click', () => { App.showScreen('upload'); });
    bindAdminTabs(s);

    try {
      // Load all users, then get usage + quota per user
      const usersResp = await Auth.apiFetch('/api/admin/users');
      if (!usersResp.ok) throw new Error('Failed to load users');
      const allUsers = (await usersResp.json()).users || [];

      const usageByUser = await Promise.all(allUsers.map(async (u) => {
        try {
          const [usageResp, quotaResp] = await Promise.all([
            Auth.apiFetch(`/api/admin/users/${encodeURIComponent(u.userId)}/usage`),
            Auth.apiFetch(`/api/admin/users/${encodeURIComponent(u.userId)}/quota`),
          ]);
          const usage = usageResp.ok ? await usageResp.json() : { projects: [], grandTotal: { promptTokens: 0, completionTokens: 0, totalTokens: 0, totalCost: 0, calls: 0 } };
          const quota = quotaResp.ok ? await quotaResp.json() : { quota: 0, spent: 0, remaining: 0 };
          return { ...u, ...usage, quota };
        } catch { return { ...u, projects: [], grandTotal: { promptTokens: 0, completionTokens: 0, totalTokens: 0, totalCost: 0, calls: 0 }, quota: { quota: 0, spent: 0, remaining: 0 } }; }
      }));

      const body = s.querySelector('.admin-body');
      const grandTotal = usageByUser.reduce((acc, u) => {
        acc.calls += u.grandTotal.calls; acc.totalTokens += u.grandTotal.totalTokens; acc.totalCost += u.grandTotal.totalCost;
        return acc;
      }, { calls: 0, totalTokens: 0, totalCost: 0 });

      const fmtUsd = (n) => n < 0.005 ? '$0.00' : n < 0.10 ? '$' + n.toFixed(3) : '$' + n.toFixed(2);

      body.innerHTML = `
        <div style="padding:16px">
          <div style="display:flex;gap:24px;margin-bottom:20px;padding:12px 16px;background:var(--bg-secondary);border-radius:var(--radius-md)">
            <div><span style="font-size:11px;color:var(--text-tertiary)">Total LLM Calls</span><div style="font-size:18px;font-weight:600;color:var(--text-primary);font-family:var(--font-mono)">${grandTotal.calls.toLocaleString()}</div></div>
            <div><span style="font-size:11px;color:var(--text-tertiary)">Total Tokens</span><div style="font-size:18px;font-weight:600;color:var(--teal);font-family:var(--font-mono)">${grandTotal.totalTokens.toLocaleString()}</div></div>
            <div><span style="font-size:11px;color:var(--text-tertiary)">Total Cost</span><div style="font-size:18px;font-weight:600;color:var(--amber);font-family:var(--font-mono)">${fmtUsd(grandTotal.totalCost)}</div></div>
          </div>
          <table class="admin-table">
            <thead><tr>
              <th>User</th>
              <th style="text-align:right">Calls</th>
              <th style="text-align:right">Tokens</th>
              <th style="text-align:right">Cost</th>
              <th style="text-align:right">Quota</th>
              <th style="text-align:right">Balance</th>
              <th style="text-align:center">Actions</th>
            </tr></thead>
            <tbody>
              ${usageByUser.map(u => `<tr class="admin-row">
                <td>${esc(u.email)}</td>
                <td style="text-align:right;font-family:var(--font-mono)">${u.grandTotal.calls}</td>
                <td style="text-align:right;font-family:var(--font-mono);color:var(--teal);font-size:11px">${u.grandTotal.totalTokens.toLocaleString()}</td>
                <td style="text-align:right;font-family:var(--font-mono);color:var(--amber)">${fmtUsd(u.grandTotal.totalCost)}</td>
                <td style="text-align:right;font-family:var(--font-mono)">${fmtUsd(u.quota.quota)}</td>
                <td style="text-align:right;font-family:var(--font-mono);color:${u.quota.remaining <= 0 ? 'var(--coral)' : 'var(--teal)'}">${fmtUsd(u.quota.remaining)}</td>
                <td style="text-align:center">
                  <button class="admin-quota-btn" data-uid="${esc(u.userId)}" title="Add quota">+$</button>
                  <button class="admin-reset-btn" data-uid="${esc(u.userId)}" title="Reset spending">Reset</button>
                </td>
              </tr>`).join('') || '<tr><td colspan="7" style="color:var(--text-tertiary)">No users found.</td></tr>'}
            </tbody>
          </table>
        </div>`;

      // Bind admin quota buttons
      body.querySelectorAll('.admin-quota-btn').forEach(btn => {
        btn.addEventListener('click', () => showAdminQuotaDialog(btn.dataset.uid));
      });
      body.querySelectorAll('.admin-reset-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
          if (!confirm(`Reset spending for ${btn.dataset.uid}? This sets their spent amount to $0.`)) return;
          try {
            const resp = await Auth.apiFetch(`/api/admin/users/${encodeURIComponent(btn.dataset.uid)}/reset-spending`, { method: 'POST' });
            if (resp.ok) renderUsageOverview();
            else alert('Failed to reset');
          } catch (e) { alert(e.message); }
        });
      });
    } catch (err) {
      s.querySelector('.admin-body').innerHTML = `<div style="color:var(--coral);font-size:12px;padding:16px">${esc(err.message)}</div>`;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // ADMIN QUOTA DIALOG
  // ═══════════════════════════════════════════════════════════════════════

  function showAdminQuotaDialog(userId) {
    document.getElementById('admin-quota-dialog')?.remove();

    const overlay = document.createElement('div');
    overlay.id = 'admin-quota-dialog';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:1000';

    overlay.innerHTML = `
      <div style="background:var(--bg-primary);border:1px solid var(--border-tertiary);border-radius:var(--radius-lg);padding:24px;min-width:340px;max-width:420px">
        <div style="font-size:14px;font-weight:600;color:var(--text-primary);margin-bottom:4px">Adjust Quota</div>
        <div style="font-size:12px;color:var(--text-tertiary);margin-bottom:16px">${esc(userId)}</div>
        <div style="font-size:12px;color:var(--text-secondary);margin-bottom:6px">Add amount (USD):</div>
        <input id="admin-quota-amount" type="number" min="0.01" step="0.01" value="5.00" style="width:100%;padding:8px 10px;font-size:13px;border:0.5px solid var(--border-tertiary);border-radius:var(--radius-md);background:var(--bg-secondary);color:var(--text-primary);margin-bottom:16px;font-family:var(--font-mono);box-sizing:border-box">
        <div style="display:flex;gap:8px;justify-content:flex-end">
          <button id="admin-quota-cancel" style="padding:6px 16px;font-size:12px;border:0.5px solid var(--border-tertiary);border-radius:var(--radius-md);background:var(--bg-secondary);color:var(--text-secondary);cursor:pointer">Cancel</button>
          <button id="admin-quota-confirm" style="padding:6px 16px;font-size:12px;border:none;border-radius:var(--radius-md);background:var(--teal);color:white;cursor:pointer;font-weight:500">Add Quota</button>
        </div>
      </div>`;

    document.body.appendChild(overlay);

    overlay.querySelector('#admin-quota-cancel').addEventListener('click', () => overlay.remove());
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
    overlay.querySelector('#admin-quota-confirm').addEventListener('click', async () => {
      const amount = parseFloat(overlay.querySelector('#admin-quota-amount').value);
      if (!amount || amount <= 0) return alert('Enter a valid amount');
      try {
        const resp = await Auth.apiFetch(`/api/admin/users/${encodeURIComponent(userId)}/quota`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ addAmount: amount }),
        });
        if (resp.ok) {
          overlay.remove();
          renderUsageOverview();
        } else {
          const err = await resp.json();
          alert(err.error || 'Failed');
        }
      } catch (e) { alert(e.message); }
    });
  }

  // ═══════════════════════════════════════════════════════════════════════
  // ASSIGN OWNER DIALOG
  // ═══════════════════════════════════════════════════════════════════════

  function showAssignOwnerDialog(currentOwnerId, projectId) {
    // Remove existing dialog if any
    document.getElementById('admin-assign-dialog')?.remove();

    const overlay = document.createElement('div');
    overlay.id = 'admin-assign-dialog';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:1000';

    const knownEmails = allKnownUsers.map(u => u.email).filter(Boolean);

    overlay.innerHTML = `
      <div style="background:var(--bg-primary);border:1px solid var(--border-tertiary);border-radius:var(--radius-lg);padding:24px;min-width:340px;max-width:420px">
        <div style="font-size:14px;font-weight:600;color:var(--text-primary);margin-bottom:16px">Assign Owner</div>
        ${knownEmails.length > 0 ? `
        <div style="font-size:12px;color:var(--text-secondary);margin-bottom:6px">Select a user:</div>
        <select id="admin-assign-select" style="width:100%;padding:8px 10px;font-size:12px;border:0.5px solid var(--border-tertiary);border-radius:var(--radius-md);background:var(--bg-secondary);color:var(--text-primary);margin-bottom:12px;font-family:var(--font-sans)">
          <option value="">-- Choose user --</option>
          ${knownEmails.map(e => `<option value="${escAttr(e)}">${esc(e)}</option>`).join('')}
        </select>
        <div style="font-size:11px;color:var(--text-tertiary);margin-bottom:6px">Or enter email:</div>
        ` : `
        <div style="font-size:12px;color:var(--text-secondary);margin-bottom:6px">Enter owner email:</div>
        `}
        <input id="admin-assign-email" type="email" placeholder="user@example.com" style="width:100%;padding:8px 10px;font-size:12px;border:0.5px solid var(--border-tertiary);border-radius:var(--radius-md);background:var(--bg-secondary);color:var(--text-primary);margin-bottom:16px;font-family:var(--font-sans);box-sizing:border-box">
        <div style="display:flex;gap:8px;justify-content:flex-end">
          <button id="admin-assign-cancel" style="padding:6px 16px;font-size:12px;border:0.5px solid var(--border-tertiary);border-radius:var(--radius-md);background:var(--bg-secondary);color:var(--text-secondary);cursor:pointer">Cancel</button>
          <button id="admin-assign-confirm" style="padding:6px 16px;font-size:12px;border:none;border-radius:var(--radius-md);background:var(--teal);color:white;cursor:pointer;font-weight:500">Assign</button>
        </div>
      </div>`;

    document.body.appendChild(overlay);

    const selectEl = overlay.querySelector('#admin-assign-select');
    const emailEl = overlay.querySelector('#admin-assign-email');

    // Sync select -> input
    if (selectEl) {
      selectEl.addEventListener('change', () => {
        if (selectEl.value) emailEl.value = selectEl.value;
      });
    }

    overlay.querySelector('#admin-assign-cancel').addEventListener('click', () => overlay.remove());
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });

    overlay.querySelector('#admin-assign-confirm').addEventListener('click', async () => {
      const email = emailEl.value.trim();
      if (!email) { emailEl.style.borderColor = 'var(--coral)'; return; }
      if (!confirm(`Transfer project to ${email}?`)) return;

      try {
        const resp = await Auth.apiFetch(`/api/admin/users/${encodeURIComponent(currentOwnerId)}/projects/${projectId}/owner`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ownerEmail: email }),
        });
        if (!resp.ok) {
          const err = await resp.json();
          alert('Failed: ' + (err.error || 'Unknown error'));
          return;
        }
        overlay.remove();
        // Refresh the current view
        if (adminView === 'projects') renderAllProjects();
        else renderUserProjects();
      } catch (err) {
        alert('Error: ' + err.message);
      }
    });
  }

  return { init, openAdmin };
})();
