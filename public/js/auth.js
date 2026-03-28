/**
 * Auth — Handles authentication via oauth.xiangenhu.info gateway.
 * Supports both Google OAuth and email/password (SMTP) login.
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
      authConfig = { gatewayUrl: 'https://oauth.xiangenhu.info', provider: 'google' };
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
    // Redirect to landing page (unless processing OAuth callback)
    if (!window.location.search.includes('token=')) {
      window.location.replace('/landing.html');
    }
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
        <button class="logout-btn" id="logout-btn" data-i18n="d0527e4b3d658351">Logout</button>`;
      document.getElementById('logout-btn').addEventListener('click', logout);
    }

    // Init app modules
    App.init();
    Upload.init();
    Library.init();
    History.init();
    HelpChat.init();
    Rubric.init();
    Projects.init();
    if (typeof Admin !== 'undefined') Admin.init(currentUser);
    Quota.init();
    TokenFooter.init();
  }

  function login() {
    const appUrl = window.location.origin + '/app.html';
    window.location.href = `/api/auth/login?redirect_uri=${encodeURIComponent(appUrl)}`;
  }

  /**
   * Email/password login via SMTP proxy.
   */
  async function emailLogin(email, password) {
    const resp = await fetch('/api/auth/email-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const data = await resp.json();
    if (!resp.ok) throw new Error(data.error || 'Login failed');
    if (data.token) {
      setToken(data.token);
      const user = await verifyToken(data.token);
      if (user) {
        currentUser = user;
        return user;
      }
    }
    throw new Error(data.message || 'Login failed');
  }

  /**
   * Register new account via SMTP proxy.
   */
  async function register(email, password, name) {
    const resp = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, name }),
    });
    const data = await resp.json();
    if (!resp.ok) throw new Error(data.error || 'Registration failed');
    return data;
  }

  /**
   * Verify email with 6-digit code.
   */
  async function verifyEmail(email, code) {
    const resp = await fetch('/api/auth/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, code }),
    });
    const data = await resp.json();
    if (!resp.ok) throw new Error(data.error || 'Verification failed');
    if (data.token) {
      setToken(data.token);
      const user = await verifyToken(data.token);
      if (user) {
        currentUser = user;
        return { ...data, verified: true };
      }
    }
    return data;
  }

  /**
   * Resend verification code.
   */
  async function resendCode(email) {
    const resp = await fetch('/api/auth/resend-code', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    const data = await resp.json();
    if (!resp.ok) throw new Error(data.error || 'Failed to resend code');
    return data;
  }

  /**
   * Request password reset code.
   */
  async function forgotPassword(email) {
    const resp = await fetch('/api/auth/forgot-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    const data = await resp.json();
    if (!resp.ok) throw new Error(data.error || 'Failed to send reset code');
    return data;
  }

  /**
   * Verify reset code (returns resetToken).
   */
  async function verifyResetCode(email, code) {
    const resp = await fetch('/api/auth/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, code }),
    });
    const data = await resp.json();
    if (!resp.ok) throw new Error(data.error || 'Invalid code');
    return data;
  }

  /**
   * Set new password with reset token.
   */
  async function resetPassword(resetToken, newPassword) {
    const resp = await fetch('/api/auth/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ resetToken, newPassword }),
    });
    const data = await resp.json();
    if (!resp.ok) throw new Error(data.error || 'Failed to reset password');
    return data;
  }

  /**
   * Change password (logged-in user).
   */
  async function changePassword(currentPassword, newPassword) {
    const token = getToken();
    const resp = await fetch('/api/auth/change-password', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ currentPassword, newPassword }),
    });
    const data = await resp.json();
    if (!resp.ok) throw new Error(data.error || 'Failed to change password');
    return data;
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

    // Quota exceeded — show add-funds modal
    if (resp.status === 402) {
      try {
        const clone = resp.clone();
        const data = await clone.json();
        if (data.quota_exceeded && typeof Quota !== 'undefined') {
          Quota.handleQuotaExceeded(data);
        }
      } catch { /* ignore parse errors */ }
    }

    return resp;
  }

  function getUser() { return currentUser; }
  function isAuthenticated() { return !!getToken() && !!currentUser; }

  return {
    init, login, logout, getHeaders, apiFetch, getUser, isAuthenticated, getToken,
    // SMTP auth methods
    emailLogin, register, verifyEmail, resendCode,
    forgotPassword, verifyResetCode, resetPassword, changePassword,
    // For external use (landing page)
    setToken, showApp, verifyToken: verifyToken,
  };
})();
