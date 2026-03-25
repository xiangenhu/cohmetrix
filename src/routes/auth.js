const express = require('express');
const config = require('../config');
const { verifyToken, isSuperAdmin } = require('../services/auth');

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

  res.json({ authenticated: true, ...user, isAdmin: isSuperAdmin(user) });
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

module.exports = router;
