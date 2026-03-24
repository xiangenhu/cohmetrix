/**
 * App — Main application controller.
 * Manages screen navigation and global state.
 */
const App = (() => {
  const SCREENS = ['upload', 'project', 'process', 'results', 'review'];
  let currentScreen = 'upload';

  function showScreen(name) {
    currentScreen = name;
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    const el = document.getElementById('s-' + name);
    if (el) el.classList.add('active');

    // Update nav button active states (skip user-bar which is also in topbar-right)
    const navBtns = document.querySelectorAll('.topbar-right .nav-btn');
    navBtns.forEach((b, i) => {
      if (i < SCREENS.length) {
        b.classList.toggle('active', SCREENS[i] === name);
      }
    });
  }

  function enableNav(id) {
    const btn = document.getElementById(id);
    if (btn) { btn.style.opacity = '1'; btn.style.pointerEvents = 'auto'; }
  }

  function disableNav(id) {
    const btn = document.getElementById(id);
    if (btn) { btn.style.opacity = '0.4'; btn.style.pointerEvents = 'none'; }
  }

  function resetNavigation() {
    disableNav('btn-process');
    disableNav('btn-results');
    disableNav('btn-review');
  }

  function init() {
    // Bind nav buttons
    const navBtns = document.querySelectorAll('.topbar-right .nav-btn');
    navBtns.forEach((btn, i) => {
      if (i < SCREENS.length) {
        btn.addEventListener('click', () => showScreen(SCREENS[i]));
      }
    });
    resetNavigation();
  }

  return { init, showScreen, enableNav, disableNav, resetNavigation };
})();

document.addEventListener('DOMContentLoaded', () => {
  Auth.init();
});
