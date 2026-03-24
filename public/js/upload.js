/**
 * Upload — Home / workspace entry point.
 * Shows quick-start cards and project list.
 * All file management, configuration, and analysis happens inside projects.
 */
const Upload = (() => {
  function init() {
    // Populate genre dropdown (used by projects workflow)
    populateGenres();
    // Auto-load projects list
    Projects.loadProjects();
    // Bind quick-start cards
    bindQuickStart();
  }

  async function populateGenres() {
    const select = document.getElementById('genre-select');
    if (!select) return;
    try {
      const resp = await fetch('/api/genres');
      if (!resp.ok) return;
      const data = await resp.json();
      (data.categories || []).forEach(cat => {
        const group = document.createElement('optgroup');
        group.label = cat.category;
        cat.genres.forEach(g => {
          const opt = document.createElement('option');
          opt.value = g.id; opt.textContent = g.name; opt.title = g.description;
          group.appendChild(opt);
        });
        select.appendChild(group);
      });
    } catch {}
  }

  function bindQuickStart() {
    // New Project — focus the create input
    const qsNew = document.getElementById('home-qs-new');
    if (qsNew) qsNew.addEventListener('click', () => {
      const input = document.getElementById('proj-create-input');
      if (input) { input.scrollIntoView({ behavior: 'smooth', block: 'center' }); input.focus(); }
    });

    // Upload Files — if a project exists, open first one; else prompt to create
    const qsUpload = document.getElementById('home-qs-upload');
    if (qsUpload) qsUpload.addEventListener('click', () => {
      openFirstProjectOrPrompt();
    });

    // Google Drive — open first project then trigger drive panel
    const qsDrive = document.getElementById('home-qs-drive');
    if (qsDrive) qsDrive.addEventListener('click', () => {
      openFirstProjectOrPrompt('drive');
    });

    // Batch Analyze — open first project
    const qsBatch = document.getElementById('home-qs-batch');
    if (qsBatch) qsBatch.addEventListener('click', () => {
      openFirstProjectOrPrompt();
    });
  }

  function openFirstProjectOrPrompt(action) {
    // Delegate to Projects module — it knows the project list
    if (typeof Projects !== 'undefined' && Projects.openFirstOrPrompt) {
      Projects.openFirstOrPrompt(action);
    } else {
      const input = document.getElementById('proj-create-input');
      if (input) { input.scrollIntoView({ behavior: 'smooth', block: 'center' }); input.focus(); }
    }
  }

  function showBrowseState() {
    App.showScreen('upload');
  }

  return { init, showBrowseState };
})();
