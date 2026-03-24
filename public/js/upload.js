/**
 * Upload — Project-only entry point.
 * The upload screen now just shows the project list.
 * All file management, configuration, and analysis happens inside projects.
 */
const Upload = (() => {
  function init() {
    // Populate genre dropdown (used by projects workflow)
    populateGenres();
    // Auto-load projects list
    Projects.loadProjects();
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

  function showBrowseState() {
    App.showScreen('upload');
  }

  return { init, showBrowseState };
})();
