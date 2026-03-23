const express = require('express');
const cors = require('cors');
const path = require('path');
const config = require('./config');
const { requireAuth } = require('./services/auth');

const app = express();

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static files
app.use(express.static(path.join(__dirname, '..', 'public')));

// ─── Public routes (no auth) ─────────────────────────────────────────────────
app.use('/api/auth', require('./routes/auth'));

// Health check (Cloud Run)
app.get('/health', (req, res) => {
  const llm = require('./services/llm');
  res.json({ status: 'ok', version: '0.9.0', environment: config.nodeEnv, llm: llm.getProviderInfo() });
});

// ─── Protected routes (require auth) ─────────────────────────────────────────
app.use('/api/analyze', requireAuth, require('./routes/analyze'));
app.use('/api/results', requireAuth, require('./routes/results'));
app.use('/api/interpret', requireAuth, require('./routes/interpret'));
app.use('/api/documents', requireAuth, require('./routes/documents'));
app.use('/api/help', requireAuth, require('./routes/help'));
app.use('/api/rubrics', requireAuth, require('./routes/rubric'));

// ─── Session token usage endpoint ───────────────────────────────────────────
app.get('/api/tokens', requireAuth, (req, res) => {
  const llm = require('./services/llm');
  const session = llm.getSessionTracker().getSummary();
  const analysis = llm.getActiveTracker().getSummary();
  res.json({ session, analysis });
});

app.post('/api/tokens/reset', requireAuth, (req, res) => {
  const llm = require('./services/llm');
  llm.resetSessionTracker();
  res.json({ ok: true });
});

// SPA fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

// Start server
const PORT = config.port;
app.listen(PORT, '0.0.0.0', () => {
  const llm = require('./services/llm');
  const info = llm.getProviderInfo();
  console.log(`[NeoCohMetrix] Server running on port ${PORT}`);
  console.log(`[NeoCohMetrix] Environment: ${config.nodeEnv}`);
  console.log(`[NeoCohMetrix] LLM provider: ${info.name} (${info.model})`);
  console.log(`[NeoCohMetrix] GCS bucket: ${config.gcs.bucketName}`);
  console.log(`[NeoCohMetrix] OAuth: ${config.oauth.provider} via ${config.oauth.gatewayUrl}`);
});

module.exports = app;
