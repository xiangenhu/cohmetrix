const express = require('express');
const config = require('../config');
const storage = require('../services/storage');

const router = express.Router();

const PAYPAL_BASE = config.paypal.mode === 'live'
  ? 'https://api-m.paypal.com'
  : 'https://api-m.sandbox.paypal.com';

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function getPayPalAccessToken() {
  const auth = Buffer.from(`${config.paypal.clientId}:${config.paypal.clientSecret}`).toString('base64');
  const resp = await fetch(`${PAYPAL_BASE}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });
  if (!resp.ok) throw new Error('PayPal auth failed');
  const data = await resp.json();
  return data.access_token;
}

// ─── GET /api/quota — Current user's balance ─────────────────────────────────

router.get('/', async (req, res) => {
  try {
    const userId = storage.getUserId(req.user);
    const quota = await storage.loadUserQuota(userId);
    const remaining = Math.max(0, quota.quota - quota.spent);
    res.json({
      quota: quota.quota,
      spent: +quota.spent.toFixed(6),
      remaining: +remaining.toFixed(6),
      deposits: quota.deposits || [],
    });
  } catch (err) {
    console.error('[GET /api/quota]', err);
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/quota/config — Public PayPal config for frontend ───────────────

router.get('/config', (req, res) => {
  res.json({
    paypalClientId: config.paypal.clientId,
    paypalMode: config.paypal.mode,
    defaultQuota: config.quota.defaultQuota,
  });
});

// ─── POST /api/quota/create-order — Create PayPal order ─────────────────────

router.post('/create-order', async (req, res) => {
  try {
    const { amount } = req.body;
    const usd = parseFloat(amount);
    if (!usd || usd < 0.50 || usd > 500) {
      return res.status(400).json({ error: 'Amount must be between $0.50 and $500' });
    }

    const token = await getPayPalAccessToken();
    const resp = await fetch(`${PAYPAL_BASE}/v2/checkout/orders`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        intent: 'CAPTURE',
        purchase_units: [{
          amount: {
            currency_code: 'USD',
            value: usd.toFixed(2),
          },
          description: `Neo-CohMetrix analysis credit — $${usd.toFixed(2)}`,
        }],
      }),
    });

    if (!resp.ok) {
      const err = await resp.text();
      console.error('[PayPal] Create order failed:', err);
      throw new Error('Failed to create PayPal order');
    }

    const order = await resp.json();
    res.json({ orderId: order.id });
  } catch (err) {
    console.error('[POST /api/quota/create-order]', err);
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/quota/capture-order — Capture PayPal payment and credit user ──

router.post('/capture-order', async (req, res) => {
  try {
    const { orderId } = req.body;
    if (!orderId) return res.status(400).json({ error: 'orderId required' });

    const token = await getPayPalAccessToken();
    const resp = await fetch(`${PAYPAL_BASE}/v2/checkout/orders/${orderId}/capture`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!resp.ok) {
      const err = await resp.text();
      console.error('[PayPal] Capture failed:', err);
      throw new Error('Payment capture failed');
    }

    const capture = await resp.json();
    if (capture.status !== 'COMPLETED') {
      return res.status(400).json({ error: `Payment not completed (status: ${capture.status})` });
    }

    // Extract captured amount
    const capturedAmount = parseFloat(
      capture.purchase_units?.[0]?.payments?.captures?.[0]?.amount?.value || '0'
    );
    if (capturedAmount <= 0) {
      return res.status(400).json({ error: 'Invalid capture amount' });
    }

    // Credit user quota
    const userId = storage.getUserId(req.user);
    const quota = await storage.loadUserQuota(userId);
    quota.quota = (quota.quota || 0) + capturedAmount;
    quota.deposits = quota.deposits || [];
    quota.deposits.push({
      amount: capturedAmount,
      method: 'paypal',
      ref: orderId,
      ts: new Date().toISOString(),
    });
    await storage.saveUserQuota(userId, quota);

    const remaining = Math.max(0, quota.quota - quota.spent);
    res.json({
      success: true,
      credited: capturedAmount,
      quota: quota.quota,
      spent: +quota.spent.toFixed(6),
      remaining: +remaining.toFixed(6),
    });
  } catch (err) {
    console.error('[POST /api/quota/capture-order]', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
