/**
 * Auth — Handles OAuth authentication via oauth.skoonline.org gateway.
 * Stores gateway token in sessionStorage (cleared on tab close).
 */
const Auth = (() => {
  const TOKEN_KEY = 'ncm_gateway_token';
  let currentUser = null;
  let authConfig = null;

  function getToken() {
    return sessionStorage.getItem(TOKEN_KEY);
  }

  function setToken(token) {
    sessionStorage.setItem(TOKEN_KEY, token);
  }

  function clearToken() {
    sessionStorage.removeItem(TOKEN_KEY);
  }

  /**
   * Check URL for OAuth callback token.
   */
  function handleCallback() {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    const success = params.get('success');

    if (token && success) {
      setToken(token);
      // Clean URL
      window.history.replaceState({}, '', window.location.pathname);
      return true;
    }
    return false;
  }

  /**
   * Initialize auth: check for callback, verify existing token, show login or app.
   */
  async function init() {
    // Load auth config
    try {
      const resp = await fetch('/api/auth/config');
      authConfig = await resp.json();
    } catch {
      authConfig = { gatewayUrl: 'https://oauth.skoonline.org', provider: 'google' };
    }

    // Check for OAuth callback
    handleCallback();

    // Verify existing token
    const token = getToken();
    if (token) {
      const user = await verifyToken(token);
      if (user) {
        currentUser = user;
        showApp();
        return;
      }
      clearToken();
    }

    showLogin();
  }

  async function verifyToken(token) {
    try {
      const resp = await fetch('/api/auth/me', {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (!resp.ok) return null;
      const data = await resp.json();
      return data.authenticated ? data : null;
    } catch {
      return null;
    }
  }

  function showLogin() {
    document.getElementById('s-login').style.display = 'flex';
    document.getElementById('app-content').style.display = 'none';
    document.getElementById('user-bar').style.display = 'none';
    const fab = document.getElementById('cost-fab');
    if (fab) fab.style.display = 'none';
  }

  function showApp() {
    document.getElementById('s-login').style.display = 'none';
    document.getElementById('app-content').style.display = 'flex';

    // Show user info in topbar
    const userBar = document.getElementById('user-bar');
    if (currentUser && currentUser.user) {
      const u = currentUser.user;
      userBar.style.display = 'flex';
      userBar.innerHTML = `
        ${u.picture ? `<img class="user-avatar" src="${u.picture}" alt="">` : ''}
        <span class="user-name">${u.name || u.email}</span>
        <button class="logout-btn" id="logout-btn">Logout</button>`;
      document.getElementById('logout-btn').addEventListener('click', logout);
    }

    // Init app modules
    App.init();
    Upload.init();
    Library.init();
    History.init();
    HelpChat.init();
    Rubric.init();
    TokenFooter.init();
  }

  function login() {
    const currentUrl = window.location.origin + window.location.pathname;
    window.location.href = `/api/auth/login?redirect_uri=${encodeURIComponent(currentUrl)}`;
  }

  async function logout() {
    const token = getToken();
    if (token) {
      try {
        await fetch('/api/auth/logout', {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${token}` },
        });
      } catch { /* ignore */ }
    }
    clearToken();
    currentUser = null;
    showLogin();
  }

  /**
   * Get auth headers for API calls.
   */
  function getHeaders() {
    const token = getToken();
    return token ? { 'Authorization': `Bearer ${token}` } : {};
  }

  /**
   * Authenticated fetch wrapper.
   */
  async function apiFetch(url, options = {}) {
    const token = getToken();
    if (!token) {
      showLogin();
      throw new Error('Not authenticated');
    }

    const headers = { ...options.headers, 'Authorization': `Bearer ${token}` };
    const resp = await fetch(url, { ...options, headers });

    if (resp.status === 401) {
      clearToken();
      currentUser = null;
      showLogin();
      throw new Error('Session expired. Please log in again.');
    }

    return resp;
  }

  function getUser() { return currentUser; }
  function isAuthenticated() { return !!getToken() && !!currentUser; }

  return { init, login, logout, getHeaders, apiFetch, getUser, isAuthenticated, getToken };
})();
