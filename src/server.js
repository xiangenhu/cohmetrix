const express = require('express');
const cors = require('cors');
const path = require('path');
const config = require('./config');
const { requireAuth, optionalAuth, requireAdmin } = require('./services/auth');

const app = express();

// Bug-tracking pipeline: capture process-level errors + intercept console.error/warn
// → BUG_LRS (xAPI `failed`). No-ops silently unless BUG_LRS_* env is set (local dev).
const bugReporter = require('./services/bugReporter');
bugReporter.attachProcessHandlers();

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

// Static files — `extensions: ['html']` resolves extensionless requests
// (e.g. /teasers/about, /factsheet) to their .html file instead of falling
// through to the SPA catch-all (which would force an auth redirect).
app.use(express.static(path.join(__dirname, '..', 'public'), { extensions: ['html'] }));

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

// Measure profiles for genre→layer mapping (static, no auth needed)
app.get('/api/measure-profiles', (req, res) => {
  const { MEASURE_PROFILES, METRIC_APPLICABILITY, getRecommendedLayers, getApplicableMetrics } = require('./services/genres');
  const genreId = req.query.genre;
  if (genreId) {
    const layers = getRecommendedLayers(genreId);
    const metrics = getApplicableMetrics(genreId);
    return res.json({ ...layers, metricOverrides: metrics.metricOverrides });
  }
  res.json({ profiles: MEASURE_PROFILES, metricApplicability: METRIC_APPLICABILITY });
});

// LLM-powered explanation of why specific layers are recommended for a genre
app.post('/api/explain-layers', requireAuth, async (req, res) => {
  const llm = require('./services/llm');
  const { GENRE_EXPECTATIONS, MEASURE_PROFILES, getRecommendedLayers } = require('./services/genres');
  const { genre, fileName } = req.body;
  if (!genre) return res.status(400).json({ error: 'genre is required' });

  const rec = getRecommendedLayers(genre);
  const exp = GENRE_EXPECTATIONS[genre] || {};
  const enabledLayers = rec.layers || [];
  const allLayers = ['L0','L1','L2','L3','L4','L5','L6','L7','L8','L9','L10'];
  const skippedLayers = allLayers.filter(l => !enabledLayers.includes(l));
  const layerNames = {
    L0: 'Surface & Structural', L1: 'Lexical Sophistication', L2: 'Syntactic Complexity',
    L3: 'Referential Cohesion', L4: 'Semantic Cohesion', L5: 'Connective & Deep Cohesion',
    L6: 'Situation Model', L7: 'Rhetorical Structure', L8: 'Argumentation Quality',
    L9: 'Pragmatic Stance', L10: 'Affective & Engagement',
  };

  const prompt = `You are an expert in computational linguistics and text cohesion analysis (Graesser & McNamara's multilevel discourse framework).

A user is about to analyze a document classified as genre "${genre}" (type: ${exp.type || 'unknown'}, formality: ${exp.formality || 'unknown'}).
${fileName ? `File: "${fileName}"` : ''}

The system recommends these analysis layers:
${enabledLayers.map(l => `  ✓ ${l} — ${layerNames[l]}`).join('\n')}

${skippedLayers.length ? `And skips these layers:\n${skippedLayers.map(l => `  ✗ ${l} — ${layerNames[l]}`).join('\n')}` : 'All layers are enabled.'}

${rec.rationale ? `Static rationale hints:\n${Object.entries(rec.rationale).map(([k,v]) => `  ${k}: ${v}`).join('\n')}` : ''}

Write a brief, helpful explanation (3-5 short paragraphs, ~150 words total) for a non-expert user:
1. Why these specific layers are a good fit for this document type
2. What insights they will surface
3. Why any skipped layers are less relevant (if any are skipped)
4. One sentence on what the user might consider toggling on/off based on their goals

Use plain language. Be specific to this genre, not generic. Do not use bullet lists — write in flowing prose. Do not repeat layer IDs verbatim; refer to them by their descriptive names.`;

  try {
    const explanation = await llm.complete(prompt, {
      maxTokens: 400,
      temperature: 0.3,
      systemPrompt: 'You are a helpful writing analysis assistant. Be concise and informative.',
    });
    res.json({ explanation: explanation.trim() });
  } catch (err) {
    console.error('explain-layers error:', err.message);
    res.status(500).json({ error: 'Could not generate explanation' });
  }
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
  res.json({ status: 'ok', version: '0.9.0', environment: config.nodeEnv, llm: info, costMultiplier: config.quota.costMultiplier || 2.0 });
});

// ─── Public routes (no auth) ─────────────────────────────────────────────────
app.use('/api/i18n', require('./routes/i18n'));

// Contextual "?" help assistant. Mounted at /api and BEFORE the auth-gated
// /api/help and /api/admin routers so its public routes (GET /api/config/help-hover,
// POST /api/help/ask) and its self-gated admin route (GET /api/admin/help-analytics,
// which runs requireAuth+requireAdmin internally) resolve first; all other /api/*
// paths fall through to the routers below.
app.use('/api', require('./routes/contexthelp'));

// Bug-report API: POST /api/telemetry/bug-report (public, client submit) +
// GET /api/telemetry/bug-reports (Admin-only). Fix-log is the SHARED GCS store
// (bugFixLog) so this feed and scripts/bug-triage.js never diverge.
app.use('/api/telemetry', require('./routes/bugReportRoutes').createBugReportRoutes({
  bugReporter,
  optionalAuth,
  requireAdmin: [requireAuth, requireAdmin],
  getFixLog: require('./services/bugFixLog').load,
}));

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

// Express error middleware (4-arg) — MUST be last, after all routes. Reports the
// error to BUG_LRS (no-op without creds) then re-throws to Express's default handler.
app.use(bugReporter.bugReporterMiddleware);

// Start server
// ─── Initialize LLM audit logging ────────────────────────────────────────────
const llmService = require('./services/llm');
const storage = require('./services/storage');

llmService.setAuditCallback((entry) => {
  // 1. Buffer full interaction for admin audit log (fire-and-forget, flushed in batches)
  storage.saveAuditEntry(entry);

  // 2. Calculate cost for this LLM call (with service multiplier)
  const pricing = llmService.getPricing();
  const promptCost = ((entry.tokens?.prompt || 0) / 1_000_000) * pricing.promptPer1M;
  const completionCost = ((entry.tokens?.completion || 0) / 1_000_000) * pricing.completionPer1M;
  const rawCost = promptCost + completionCost;
  const cost = rawCost * (config.quota.costMultiplier || 2.0);

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
