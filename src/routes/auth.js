const express = require('express');
const config = require('../config');
const { verifyToken, isSuperAdmin, cacheToken } = require('../services/auth');

const router = express.Router();
const GATEWAY = config.oauth.gatewayUrl;
const PROVIDER = config.oauth.provider;

/**
 * GET /api/auth/login — Redirect to OAuth provider login.
 */
router.get('/login', (req, res) => {
  const redirectUri = req.query.redirect_uri || `${req.protocol}://${req.get('host')}/`;
  const loginUrl = `${GATEWAY}/auth/${PROVIDER}/login?redirect_uri=${encodeURIComponent(redirectUri)}`;
  res.redirect(loginUrl);
});

/**
 * GET /api/auth/me — Get current user info (validates token).
 */
router.get('/me', async (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '') || req.query.token;
  if (!token) {
    return res.status(401).json({ authenticated: false });
  }

  const user = await verifyToken(token);
  if (!user) {
    return res.status(401).json({ authenticated: false });
  }

  // Normalize: user object may be nested under .user or flat
  const email = user.email || user.user?.email;
  res.json({ authenticated: true, ...user, isAdmin: isSuperAdmin(user.user || user) });
});

/**
 * DELETE /api/auth/logout — Logout (revoke gateway token).
 */
router.delete('/logout', async (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) {
    return res.json({ message: 'Already logged out' });
  }

  try {
    await fetch(`${GATEWAY}/auth/logout`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` },
    });
  } catch {
    // Ignore gateway errors — clear locally regardless
  }

  res.json({ message: 'Logged out' });
});

/**
 * GET /api/auth/config — Public auth config for frontend.
 */
router.get('/config', (req, res) => {
  res.json({
    gatewayUrl: GATEWAY,
    provider: PROVIDER,
  });
});

// ═══════════════════════════════════════════════════════════
// SMTP Proxy — Email/Password Registration, Login, Password Reset
// All routes proxy to the oauth gateway's /user/* endpoints.
// Email/password tokens are cached server-side since the gateway's
// /auth/userinfo endpoint only works with OAuth tokens.
// ═══════════════════════════════════════════════════════════

/**
 * Helper: proxy a JSON POST to the gateway and relay the response.
 */
async function proxyPost(path, body, authHeader) {
  const headers = { 'Content-Type': 'application/json' };
  if (authHeader) headers['Authorization'] = authHeader;
  const resp = await fetch(`${GATEWAY}${path}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  const data = await resp.json();
  return { status: resp.status, data };
}

/**
 * POST /api/auth/register — Register with email + password.
 * Sends a 6-digit verification code to the email.
 */
router.post('/register', async (req, res) => {
  const { email, password, name } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }
  try {
    const { status, data } = await proxyPost('/user/register', { email, password, name });
    res.status(status).json(data);
  } catch (err) {
    console.error('[Auth] Register error:', err.message);
    res.status(502).json({ error: 'Authentication service unavailable.' });
  }
});

/**
 * POST /api/auth/verify — Verify email with 6-digit code.
 * On success, caches the token→user mapping server-side.
 */
router.post('/verify', async (req, res) => {
  const { email, code } = req.body;
  if (!email || !code) {
    return res.status(400).json({ error: 'Email and verification code are required.' });
  }
  try {
    const { status, data } = await proxyPost('/user/verify', { email, code });
    // Cache token if returned (registration verify)
    if (data.token && data.user) {
      const userInfo = normalizeUser(data.user, email);
      cacheToken(data.token, userInfo);
      console.log('[Auth] Cached email token for:', userInfo.user?.email || email);
    }
    res.status(status).json(data);
  } catch (err) {
    console.error('[Auth] Verify error:', err.message);
    res.status(502).json({ error: 'Authentication service unavailable.' });
  }
});

/**
 * POST /api/auth/resend-code — Resend verification code.
 */
router.post('/resend-code', async (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ error: 'Email is required.' });
  }
  try {
    const { status, data } = await proxyPost('/user/resend-code', { email });
    res.status(status).json(data);
  } catch (err) {
    console.error('[Auth] Resend-code error:', err.message);
    res.status(502).json({ error: 'Authentication service unavailable.' });
  }
});

/**
 * POST /api/auth/email-login — Login with email + password.
 * Caches the returned token→user mapping so verifyToken works.
 */
router.post('/email-login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }
  try {
    const { status, data } = await proxyPost('/user/login', { email, password });
    // Cache the token → user mapping so /api/auth/me can find it
    if (data.token && data.user) {
      const userInfo = normalizeUser(data.user, email);
      cacheToken(data.token, userInfo);
      console.log('[Auth] Cached email login token for:', userInfo.user?.email || email);
    }
    res.status(status).json(data);
  } catch (err) {
    console.error('[Auth] Email login error:', err.message);
    res.status(502).json({ error: 'Authentication service unavailable.' });
  }
});

/**
 * POST /api/auth/forgot-password — Send password reset code.
 */
router.post('/forgot-password', async (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ error: 'Email is required.' });
  }
  try {
    const { status, data } = await proxyPost('/user/forgot-password', { email });
    res.status(status).json(data);
  } catch (err) {
    console.error('[Auth] Forgot-password error:', err.message);
    res.status(502).json({ error: 'Authentication service unavailable.' });
  }
});

/**
 * POST /api/auth/reset-password — Set new password with reset token.
 */
router.post('/reset-password', async (req, res) => {
  const { resetToken, newPassword } = req.body;
  if (!resetToken || !newPassword) {
    return res.status(400).json({ error: 'Reset token and new password are required.' });
  }
  try {
    const { status, data } = await proxyPost('/user/reset-password', { resetToken, newPassword });
    res.status(status).json(data);
  } catch (err) {
    console.error('[Auth] Reset-password error:', err.message);
    res.status(502).json({ error: 'Authentication service unavailable.' });
  }
});

/**
 * POST /api/auth/change-password — Change password (requires auth).
 */
router.post('/change-password', async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const authHeader = req.headers.authorization;
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'Current and new password are required.' });
  }
  try {
    const { status, data } = await proxyPost('/user/change-password', { currentPassword, newPassword }, authHeader);
    res.status(status).json(data);
  } catch (err) {
    console.error('[Auth] Change-password error:', err.message);
    res.status(502).json({ error: 'Authentication service unavailable.' });
  }
});

/**
 * Normalize the user object from gateway /user/* responses to match
 * the format returned by /auth/userinfo (OAuth):
 *   { user: { email, name, picture, provider } }
 */
function normalizeUser(gatewayUser, fallbackEmail) {
  // Gateway may return flat { email, name } or nested { user: { email, name } }
  const u = gatewayUser.user || gatewayUser;
  return {
    user: {
      email: u.email || fallbackEmail,
      name: u.name || u.email || fallbackEmail,
      picture: u.picture || u.avatar || null,
      provider: u.provider || 'email',
    },
  };
}

module.exports = router;
