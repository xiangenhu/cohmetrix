require('dotenv').config();

module.exports = {
  port: parseInt(process.env.PORT, 10) || 8080,
  nodeEnv: process.env.NODE_ENV || 'development',

  llm: {
    provider: process.env.LLM_PROVIDER || 'anthropic',
    maxTokens: parseInt(process.env.LLM_MAX_TOKENS, 10) || 4096,
    temperature: parseFloat(process.env.LLM_TEMPERATURE) || 0.1,
    batchSize: parseInt(process.env.LLM_BATCH_SIZE, 10) || 10,
  },

  anthropic: {
    apiKey: process.env.ANTHROPIC_API_KEY,
    model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-20250514',
  },

  openai: {
    apiKey: process.env.OPENAI_API_KEY,
    model: process.env.OPENAI_MODEL || 'gpt-4.1-mini',
  },

  azure: {
    apiKey: process.env.AZURE_OPENAI_API_KEY,
    endpoint: process.env.AZURE_OPENAI_ENDPOINT,
    deployment: process.env.AZURE_OPENAI_DEPLOYMENT || 'gpt-4.1-mini',
    apiVersion: process.env.AZURE_OPENAI_API_VERSION || '2024-08-01-preview',
  },

  gcs: {
    bucketName: process.env.GCS_BUCKET_NAME || 'neo-cohmetrix-results',
    projectId: process.env.GCS_PROJECT_ID,
    keyFile: process.env.GCS_KEY_FILE,
  },

  oauth: {
    gatewayUrl: process.env.OAUTH_GATEWAY_URL || 'https://oauth.skoonline.org',
    provider: process.env.OAUTH_PROVIDER || 'google',
  },

  targetAudience: process.env.TARGET_AUDIENCE || 'teacher',

  analysis: {
    maxEssayWords: parseInt(process.env.MAX_ESSAY_WORDS, 10) || 50000,
    maxFileSizeMB: parseInt(process.env.MAX_FILE_SIZE_MB, 10) || 10,
    timeoutMs: parseInt(process.env.ANALYSIS_TIMEOUT_MS, 10) || 120000,
  },

  weights: {
    f1Narrativity: parseFloat(process.env.WEIGHT_F1_NARRATIVITY) || 0.10,
    f2Syntax: parseFloat(process.env.WEIGHT_F2_SYNTAX) || 0.10,
    f3Lexical: parseFloat(process.env.WEIGHT_F3_LEXICAL) || 0.10,
    f4ReferentialCohesion: parseFloat(process.env.WEIGHT_F4_REFERENTIAL_COHESION) || 0.15,
    f5DeepCohesion: parseFloat(process.env.WEIGHT_F5_DEEP_COHESION) || 0.15,
    f6Argument: parseFloat(process.env.WEIGHT_F6_ARGUMENT) || 0.20,
    f7Stance: parseFloat(process.env.WEIGHT_F7_STANCE) || 0.10,
    f8Engagement: parseFloat(process.env.WEIGHT_F8_ENGAGEMENT) || 0.10,
    // Backward compat aliases (used by pipeline.js fallback)
    f4DeepCohesion: parseFloat(process.env.WEIGHT_F4_DEEP_COHESION) || 0.15,
    f5Argument: parseFloat(process.env.WEIGHT_F5_ARGUMENT) || 0.20,
    f6Stance: parseFloat(process.env.WEIGHT_F6_STANCE) || 0.10,
  },

  llmLayerWeight: parseFloat(process.env.LLM_LAYER_WEIGHT) || 0.7,

  l10Defaults: {
    vocabLevel: process.env.L11_DEFAULT_VOCAB_LEVEL || process.env.L10_DEFAULT_VOCAB_LEVEL || 'B2',
    domainExpertise: process.env.L11_DEFAULT_DOMAIN_EXPERTISE || process.env.L10_DEFAULT_DOMAIN_EXPERTISE || 'Intermediate',
    zpdOptimalMin: parseFloat(process.env.L11_ZPD_OPTIMAL_MIN || process.env.L10_ZPD_OPTIMAL_MIN) || 0.5,
    zpdOptimalMax: parseFloat(process.env.L11_ZPD_OPTIMAL_MAX || process.env.L10_ZPD_OPTIMAL_MAX) || 1.5,
  },

  thresholds: {
    high: parseInt(process.env.THRESHOLD_HIGH, 10) || 75,
    mid: parseInt(process.env.THRESHOLD_MID, 10) || 60,
  },
};
