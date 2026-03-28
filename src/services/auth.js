/**
 * Auth Service — OAuth & SMTP proxy gateway integration.
 *
 * Validates gateway tokens against oauth.xiangenhu.info
 * and provides Express middleware for route protection.
 * Supports both Google OAuth login and email/password (SMTP) login.
 */
const config = require('../config');

const GATEWAY = config.oauth.gatewayUrl;

// In-memory cache for token → userinfo (configurable TTL)
const tokenCache = new Map();
const CACHE_TTL = 5 * 60 * 1000;       // 5 min for gateway-verified tokens
const EMAIL_CACHE_TTL = 60 * 60 * 1000; // 1 hour for email/password tokens

function cleanCache() {
  const now = Date.now();
  for (const [key, entry] of tokenCache) {
    const ttl = entry.ttl || CACHE_TTL;
    if (now - entry.ts > ttl) tokenCache.delete(key);
  }
}
setInterval(cleanCache, 60000);

/**
 * Cache a token → user mapping (used by email-login route to pre-populate cache).
 */
function cacheToken(token, user) {
  tokenCache.set(token, { user, ts: Date.now(), ttl: EMAIL_CACHE_TTL });
}

/**
 * Verify a gateway token and return user info.
 * Tries cache first, then gateway /auth/userinfo (OAuth tokens),
 * with cache fallback for email/password tokens.
 */
async function verifyToken(token) {
  if (!token) return null;

  // Check cache first (works for both OAuth and email tokens)
  const cached = tokenCache.get(token);
  if (cached) {
    const ttl = cached.ttl || CACHE_TTL;
    if (Date.now() - cached.ts < ttl) {
      return cached.user;
    }
    tokenCache.delete(token);
  }

  // Try gateway /auth/userinfo (works for OAuth tokens)
  try {
    const resp = await fetch(`${GATEWAY}/auth/userinfo`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    if (resp.ok) {
      const data = await resp.json();
      tokenCache.set(token, { user: data, ts: Date.now(), ttl: CACHE_TTL });
      return data;
    }
  } catch (err) {
    console.error('[Auth] Gateway /auth/userinfo failed:', err.message);
  }

  return null;
}

/**
 * Extract token from request (Authorization header or query param).
 */
function extractToken(req) {
  // Authorization: Bearer <token>
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7);
  }
  // Query param fallback (for SSE connections)
  if (req.query && req.query.token) {
    return req.query.token;
  }
  return null;
}

/**
 * Express middleware: require authentication.
 * Attaches req.user on success, returns 401 on failure.
 */
function requireAuth(req, res, next) {
  const token = extractToken(req);
  if (!token) {
    return res.status(401).json({ error: 'Authentication required. Please log in.' });
  }

  verifyToken(token).then(user => {
    if (!user) {
      return res.status(401).json({ error: 'Invalid or expired token. Please log in again.' });
    }
    req.user = user;
    req.gatewayToken = token;
    next();
  }).catch(() => {
    res.status(500).json({ error: 'Authentication service unavailable.' });
  });
}

/**
 * Express middleware: optional auth — attaches user if token present, but doesn't block.
 */
function optionalAuth(req, res, next) {
  const token = extractToken(req);
  if (!token) return next();

  verifyToken(token).then(user => {
    if (user) {
      req.user = user;
      req.gatewayToken = token;
    }
    next();
  }).catch(() => next());
}

/**
 * Check if a user is the configured super admin.
 */
function isSuperAdmin(user) {
  const adminEmail = config.admin?.superAdminEmail;
  return !!(adminEmail && user?.email && user.email.toLowerCase() === adminEmail.toLowerCase());
}

/**
 * Express middleware: require super admin.
 * Must be used after requireAuth.
 */
function requireAdmin(req, res, next) {
  if (!isSuperAdmin(req.user)) {
    return res.status(403).json({ error: 'Admin access required.' });
  }
  next();
}

module.exports = { verifyToken, extractToken, requireAuth, optionalAuth, isSuperAdmin, requireAdmin, cacheToken };
