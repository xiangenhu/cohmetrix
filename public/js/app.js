/**
 * App — Main application controller.
 * Manages screen navigation and global state.
 */
const App = (() => {
  let currentScreen = 'upload';

  function showScreen(name) {
    currentScreen = name;
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById('s-' + name).classList.add('active');
    document.querySelectorAll('.nav-btn').forEach((b, i) => {
      const n = ['upload', 'process', 'results'][i];
      b.classList.toggle('active', n === name);
    });
  }

  function enableNav(id) {
    const btn = document.getElementById(id);
    if (btn) {
      btn.style.opacity = '1';
      btn.style.pointerEvents = 'auto';
    }
  }

  function disableNav(id) {
    const btn = document.getElementById(id);
    if (btn) {
      btn.style.opacity = '0.4';
      btn.style.pointerEvents = 'none';
    }
  }

  function resetNavigation() {
    disableNav('btn-process');
    disableNav('btn-results');
  }

  function init() {
    // Bind nav buttons
    document.querySelectorAll('.nav-btn').forEach((btn, i) => {
      const screens = ['upload', 'process', 'results'];
      btn.addEventListener('click', () => showScreen(screens[i]));
    });
    resetNavigation();
  }

  return { init, showScreen, enableNav, disableNav, resetNavigation };
})();

document.addEventListener('DOMContentLoaded', () => {
  App.init();
  Upload.init();
});
