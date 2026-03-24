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

// Genre taxonomy (static, no auth needed)
app.get('/api/genres', (req, res) => {
  const { GENRE_CATEGORIES } = require('./services/genres');
  res.json({ categories: GENRE_CATEGORIES });
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

// ─── Protected routes (require auth) ─────────────────────────────────────────
app.use('/api/analyze', requireAuth, require('./routes/analyze'));
app.use('/api/results', requireAuth, require('./routes/results'));
app.use('/api/interpret', requireAuth, require('./routes/interpret'));
app.use('/api/documents', requireAuth, require('./routes/documents'));
app.use('/api/help', requireAuth, require('./routes/help'));
app.use('/api/rubrics', requireAuth, require('./routes/rubric'));
app.use('/api/projects', requireAuth, require('./routes/projects'));

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

// SPA fallback — serve app.html for unmatched routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'app.html'));
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
