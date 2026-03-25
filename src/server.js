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

// Disable caching in development
app.use((req, res, next) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  next();
});

// Static files
app.use(express.static(path.join(__dirname, '..', 'public')));

// ─── Public routes (no auth) ─────────────────────────────────────────────────
app.use('/api/auth', require('./routes/auth'));

// Genre taxonomy (static, no auth needed) — includes i18n hashes
app.get('/api/genres', (req, res) => {
  const crypto = require('crypto');
  const gh = (t) => crypto.createHash('sha256').update(t.trim()).digest('hex').substring(0, 16);
  const { GENRE_CATEGORIES } = require('./services/genres');
  const categories = GENRE_CATEGORIES.map(cat => ({
    ...cat,
    i18n: gh(cat.category),
    genres: cat.genres.map(g => ({ ...g, i18n: gh(g.name), descI18n: gh(g.description) })),
  }));
  res.json({ categories });
});

// App metadata for landing page (no auth needed)
app.get('/api/meta', (req, res) => {
  const { layers } = require('./layers');
  const { getCompositeDefinitions } = require('./services/pipeline');
  const { LAYER_DEFINITIONS, DISCOURSE_LEVELS } = require('./services/definitions');
  const { GENRE_CATEGORIES } = require('./services/genres');
  const genreCount = GENRE_CATEGORIES.reduce((s, c) => s + c.genres.length, 0);
  const categoryCount = GENRE_CATEGORIES.length;

  res.json({
    maxEssayWords: config.analysis.maxEssayWords,
    genres: { count: genreCount, categories: categoryCount },
    layers: layers.map(l => {
      const def = LAYER_DEFINITIONS[l.LAYER_ID] || {};
      return {
        id: l.LAYER_ID,
        name: l.LAYER_NAME,
        metricCount: def.metricCount || l.METRIC_COUNT || null,
        definition: def.definition || null,
        why: def.why || null,
      };
    }),
    compositeFactors: getCompositeDefinitions(),
    discourseLevels: Object.entries(DISCOURSE_LEVELS).map(([key, val]) => ({
      level: key === 'Meta' ? '+' : key,
      name: val.name,
      description: val.description,
      layers: val.layers,
    })),
  });
});

// Health check (Cloud Run)
app.get('/health', (req, res) => {
  const llm = require('./services/llm');
  const info = llm.getProviderInfo();
  // Attach pricing per 1M tokens for cost estimation
  info.pricing = llm.getPricing();
  res.json({ status: 'ok', version: '0.9.0', environment: config.nodeEnv, llm: info });
});

// ─── Public routes (no auth) ─────────────────────────────────────────────────
app.use('/api/i18n', require('./routes/i18n'));

// ─── Protected routes (require auth) ─────────────────────────────────────────
app.use('/api/analyze', requireAuth, require('./routes/analyze'));
app.use('/api/results', requireAuth, require('./routes/results'));
app.use('/api/interpret', requireAuth, require('./routes/interpret'));
app.use('/api/documents', requireAuth, require('./routes/documents'));
app.use('/api/help', requireAuth, require('./routes/help'));
app.use('/api/rubrics', requireAuth, require('./routes/rubric'));
app.use('/api/projects', requireAuth, require('./routes/projects'));
app.use('/api/quota', requireAuth, require('./routes/quota'));
app.use('/api/admin', requireAuth, require('./routes/admin'));

// ─── Session token usage endpoint ───────────────────────────────────────────
app.get('/api/tokens', requireAuth, (req, res) => {
  const llm = require('./services/llm');
  const session = llm.getSessionTracker().getSummary();
  const analysis = llm.getActiveTracker().getSummary();
  res.json({ session, analysis });
});

// Token reset removed for regular users — spending is cumulative.
// Super admin can reset via PUT /api/admin/users/:userId/reset-spending

// SPA fallback — serve app.html for unmatched routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'app.html'));
});

// Start server
// ─── Initialize LLM audit logging ────────────────────────────────────────────
const llmService = require('./services/llm');
const storage = require('./services/storage');

llmService.setAuditCallback((entry) => {
  // 1. Buffer full interaction for admin audit log (fire-and-forget, flushed in batches)
  storage.saveAuditEntry(entry);

  // 2. Calculate cost for this LLM call
  const pricing = llmService.getPricing();
  const promptCost = ((entry.tokens?.prompt || 0) / 1_000_000) * pricing.promptPer1M;
  const completionCost = ((entry.tokens?.completion || 0) / 1_000_000) * pricing.completionPer1M;
  const cost = promptCost + completionCost;

  // 3. Buffer usage summary for per-project usage log (flushed after debounce)
  if (entry.userId && entry.projectId) {
    storage.appendProjectUsage(entry.userId, entry.projectId, {
      timestamp: entry.timestamp,
      action: entry.action || 'llm_call',
      fileName: entry.fileName || null,
      model: entry.model,
      tokens: entry.tokens,
      cost,
    });
  }

  // 4. Record spending against user quota
  if (entry.userId && cost > 0) {
    storage.recordUserSpending(entry.userId, cost).catch(err => {
      console.error('[QUOTA] Failed to record spending:', err.message);
    });
  }
});

const PORT = config.port;
app.listen(PORT, '0.0.0.0', () => {
  const info = llmService.getProviderInfo();
  console.log(`[NeoCohMetrix] Server running on port ${PORT}`);
  console.log(`[NeoCohMetrix] Environment: ${config.nodeEnv}`);
  console.log(`[NeoCohMetrix] LLM provider: ${info.name} (${info.model})`);
  console.log(`[NeoCohMetrix] GCS bucket: ${config.gcs.bucketName}`);
  console.log(`[NeoCohMetrix] OAuth: ${config.oauth.provider} via ${config.oauth.gatewayUrl}`);
  console.log(`[NeoCohMetrix] Audit logging: enabled`);
});

// Flush audit & usage buffers on graceful shutdown
process.on('SIGTERM', async () => {
  console.log('[NeoCohMetrix] SIGTERM received, flushing buffers...');
  await Promise.allSettled([storage.flushAllUsage(), storage.flushAuditBuffer()]);
  process.exit(0);
});

module.exports = app;
