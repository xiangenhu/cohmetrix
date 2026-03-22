const express = require('express');
const cors = require('cors');
const path = require('path');
const config = require('./config');

const app = express();

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static files
app.use(express.static(path.join(__dirname, '..', 'public')));

// API Routes
app.use('/api/analyze', require('./routes/analyze'));
app.use('/api/results', require('./routes/results'));
app.use('/api/interpret', require('./routes/interpret'));
app.use('/api/documents', require('./routes/documents'));

// Health check (Cloud Run)
app.get('/health', (req, res) => {
  const llm = require('./services/llm');
  res.json({ status: 'ok', version: '0.9.0', environment: config.nodeEnv, llm: llm.getProviderInfo() });
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
});

module.exports = app;
