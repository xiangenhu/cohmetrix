/**
 * Landing — Fetches app metadata from /api/meta and populates the landing page dynamically.
 */
const Landing = (() => {
  async function init() {
    try {
      const resp = await fetch('/api/meta');
      if (!resp.ok) return;
      const meta = await resp.json();
      render(meta);
    } catch {
      // Landing page stays with placeholder content
    }
  }

  function render({ layers, compositeFactors, discourseLevels, genres, maxEssayWords }) {
    const totalMetrics = layers.reduce((sum, l) => sum + (l.metricCount || 0), 0);
    const discourseCount = discourseLevels.filter(d => d.level !== '+').length;

    // Hero subtitle
    setText('hero-subtitle',
      `${layers.length}-layer deep text analysis grounded in discourse science. ` +
      `From surface features to argumentation quality \u2014 ${totalMetrics} metrics ` +
      `that reveal how writing truly works.`);

    // Stats (inside "What it is" section)
    const statsEl = document.getElementById('landing-stats');
    if (statsEl) {
      statsEl.innerHTML = [
        { num: totalMetrics, label: 'Metrics' },
        { num: layers.length, label: 'Layers' },
        { num: compositeFactors.length, label: 'Factors' },
        { num: discourseCount, label: 'Discourse levels' },
      ].map(s => `
        <div class="landing-stat">
          <div class="landing-stat-num">${s.num}</div>
          <div class="landing-stat-label">${s.label}</div>
        </div>
      `).join('');
    }

    // Discourse model
    const discourseEl = document.getElementById('landing-discourse');
    if (discourseEl) {
      discourseEl.innerHTML = discourseLevels.map(d => `
        <div class="discourse-level">
          <span class="discourse-roman"${d.level === '+' ? ' style="background:linear-gradient(135deg,var(--accent-amber),var(--accent-rose))"' : ''}>${d.level}</span>
          <span class="discourse-name">${d.name}</span>
          <div class="discourse-layers">
            ${d.layers.map(lid => `<span class="discourse-layer-tag">${lid} ${layerName(layers, lid)}</span>`).join('')}
          </div>
        </div>
      `).join('');
    }

    // Genre feature card
    if (genres) {
      setText('genre-feature-title', `${genres.count}-genre scoring `);
      const titleEl = document.getElementById('genre-feature-title');
      if (titleEl && !titleEl.querySelector('.coming-soon-tag')) {
        titleEl.insertAdjacentHTML('beforeend', '<span class="coming-soon-tag">Coming soon</span>');
      }
      setText('genre-feature-desc',
        `Analysis adapts across ${genres.categories} genre categories. A narrative essay is evaluated differently from a lab report or opinion piece.`);
    }

    // CTA subtitle
    setText('landing-cta-sub',
      `Upload an essay and get the full ${layers.length}-layer breakdown in minutes.`);

    // App tagline (authenticated area)
    setText('app-tagline',
      `${layers.length}-layer deep text analysis for essay grading \u00B7 ${layers[0].id} \u2013 ${layers[layers.length - 1].id}`);

    // Layer cards grid
    const gridEl = document.getElementById('landing-layers-grid');
    if (gridEl) {
      gridEl.innerHTML = layers.map(l => {
        const desc = l.definition ? l.definition.split('. ').slice(0, 2).join('. ') + '.' : '';
        return `
          <div class="layer-card">
            <div class="layer-card-id">${l.id}</div>
            <div class="layer-card-name">${l.name}</div>
            ${desc ? `<div class="layer-card-desc">${desc}</div>` : ''}
            ${l.metricCount ? `<div class="layer-card-metrics">${l.metricCount} metrics</div>` : ''}
          </div>
        `;
      }).join('');
    }
  }

  function setText(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  }

  function layerName(layers, id) {
    const l = layers.find(x => x.id === id);
    return l ? l.name : id;
  }

  return { init };
})();

document.addEventListener('DOMContentLoaded', () => {
  Landing.init();

  // Scroll-triggered fade-in animations
  const scrollRoot = document.getElementById('s-login');
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      }
    });
  }, { root: scrollRoot, threshold: 0.05, rootMargin: '0px 0px -20px 0px' });

  document.querySelectorAll('.fade-in-section').forEach(el => observer.observe(el));
});
