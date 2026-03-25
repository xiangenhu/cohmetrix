/**
 * LLM Service — Multi-provider abstraction with token usage tracking.
 *
 * Supports: anthropic, openai, azure
 * Controlled by LLM_PROVIDER env var.
 */
const config = require('../config');

// ─── Token usage tracker ─────────────────────────────────────────────────────

class TokenTracker {
  constructor() {
    this.reset();
  }
  reset() {
    this.calls = 0;
    this.promptTokens = 0;
    this.completionTokens = 0;
    this.totalTokens = 0;
    this.perCall = [];
  }
  record(prompt, completion) {
    this.calls++;
    this.promptTokens += prompt || 0;
    this.completionTokens += completion || 0;
    this.totalTokens += (prompt || 0) + (completion || 0);
    this.perCall.push({ prompt: prompt || 0, completion: completion || 0 });
  }
  getSummary() {
    return {
      calls: this.calls,
      promptTokens: this.promptTokens,
      completionTokens: this.completionTokens,
      totalTokens: this.totalTokens,
    };
  }
}

// Global tracker for current analysis run
let activeTracker = new TokenTracker();

// Session-level tracker: accumulates ALL token usage across every LLM call
// (analysis, interpretation, help chat, rubric evaluation, etc.)
const sessionTracker = new TokenTracker();

// ─── Audit context & logger ─────────────────────────────────────────────────
// Set before each LLM-calling action to tag interactions with user/project/file info.
let auditContext = { userId: null, projectId: null, fileName: null, action: null };
let auditCallback = null; // async (entry) => {} — set by server startup

function setAuditContext(ctx) {
  auditContext = { ...auditContext, ...ctx };
}

function getAuditContext() {
  return { ...auditContext };
}

function setAuditCallback(cb) {
  auditCallback = cb;
}

function emitAuditEntry(entry) {
  if (auditCallback) {
    try { auditCallback(entry); } catch (err) {
      console.error('[AUDIT] Failed to buffer audit entry:', err.message);
    }
  }
}

function createTracker() {
  const tracker = new TokenTracker();
  activeTracker = tracker;
  return tracker;
}

function getActiveTracker() {
  return activeTracker;
}

function getSessionTracker() {
  return sessionTracker;
}

function resetSessionTracker() {
  sessionTracker.reset();
}

// ─── Provider implementations ────────────────────────────────────────────────

const providers = {
  anthropic: (() => {
    let client = null;
    return {
      name: 'Anthropic',
      model: () => config.anthropic.model,
      async complete(prompt, { systemPrompt, maxTokens, temperature } = {}) {
        if (!client) {
          const Anthropic = require('@anthropic-ai/sdk');
          client = new Anthropic({ apiKey: config.anthropic.apiKey });
        }
        const response = await client.messages.create({
          model: config.anthropic.model,
          max_tokens: maxTokens || config.llm.maxTokens,
          temperature: temperature ?? config.llm.temperature,
          system: systemPrompt || 'You are an expert NLP analyst. Return only valid JSON unless instructed otherwise.',
          messages: [{ role: 'user', content: prompt }],
        });
        // Track tokens (both per-analysis and session-wide)
        const usage = response.usage || {};
        activeTracker.record(usage.input_tokens, usage.output_tokens);
        sessionTracker.record(usage.input_tokens, usage.output_tokens);
        const responseText = response.content[0].text;
        // Audit log
        emitAuditEntry({
          timestamp: new Date().toISOString(),
          provider: 'anthropic', model: config.anthropic.model,
          systemPrompt: systemPrompt || 'You are an expert NLP analyst. Return only valid JSON unless instructed otherwise.',
          userPrompt: prompt,
          response: responseText,
          tokens: { prompt: usage.input_tokens || 0, completion: usage.output_tokens || 0 },
          ...auditContext,
        });
        return responseText;
      },
    };
  })(),

  openai: (() => {
    return {
      name: 'OpenAI',
      model: () => config.openai.model,
      async complete(prompt, { systemPrompt, maxTokens, temperature } = {}) {
        const resp = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${config.openai.apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: config.openai.model,
            max_tokens: maxTokens || config.llm.maxTokens,
            temperature: temperature ?? config.llm.temperature,
            messages: [
              { role: 'system', content: systemPrompt || 'You are an expert NLP analyst. Return only valid JSON unless instructed otherwise.' },
              { role: 'user', content: prompt },
            ],
          }),
        });
        const data = await resp.json();
        if (data.error) throw new Error(`OpenAI: ${data.error.message}`);
        // Track tokens (both per-analysis and session-wide)
        const usage = data.usage || {};
        activeTracker.record(usage.prompt_tokens, usage.completion_tokens);
        sessionTracker.record(usage.prompt_tokens, usage.completion_tokens);
        const responseText = data.choices[0].message.content;
        emitAuditEntry({
          timestamp: new Date().toISOString(),
          provider: 'openai', model: config.openai.model,
          systemPrompt: systemPrompt || 'You are an expert NLP analyst. Return only valid JSON unless instructed otherwise.',
          userPrompt: prompt,
          response: responseText,
          tokens: { prompt: usage.prompt_tokens || 0, completion: usage.completion_tokens || 0 },
          ...auditContext,
        });
        return responseText;
      },
    };
  })(),

  azure: (() => {
    return {
      name: 'Azure OpenAI',
      model: () => config.azure.deployment,
      async complete(prompt, { systemPrompt, maxTokens, temperature } = {}) {
        const url = `${config.azure.endpoint}openai/deployments/${config.azure.deployment}/chat/completions?api-version=${config.azure.apiVersion}`;
        const resp = await fetch(url, {
          method: 'POST',
          headers: {
            'api-key': config.azure.apiKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            max_tokens: maxTokens || config.llm.maxTokens,
            temperature: temperature ?? config.llm.temperature,
            messages: [
              { role: 'system', content: systemPrompt || 'You are an expert NLP analyst. Return only valid JSON unless instructed otherwise.' },
              { role: 'user', content: prompt },
            ],
          }),
        });
        const data = await resp.json();
        if (data.error) throw new Error(`Azure: ${data.error.message}`);
        // Track tokens (both per-analysis and session-wide)
        const usage = data.usage || {};
        activeTracker.record(usage.prompt_tokens, usage.completion_tokens);
        sessionTracker.record(usage.prompt_tokens, usage.completion_tokens);
        const responseText = data.choices[0].message.content;
        emitAuditEntry({
          timestamp: new Date().toISOString(),
          provider: 'azure', model: config.azure.deployment,
          systemPrompt: systemPrompt || 'You are an expert NLP analyst. Return only valid JSON unless instructed otherwise.',
          userPrompt: prompt,
          response: responseText,
          tokens: { prompt: usage.prompt_tokens || 0, completion: usage.completion_tokens || 0 },
          ...auditContext,
        });
        return responseText;
      },
    };
  })(),
};

// ─── Language names (for LLM response language instructions) ─────────────────

const LANGUAGE_NAMES = {
  en: 'English', zh: 'Chinese', es: 'Spanish', fr: 'French', de: 'German',
  ja: 'Japanese', ko: 'Korean', ar: 'Arabic', pt: 'Portuguese', ru: 'Russian',
  hi: 'Hindi', vi: 'Vietnamese', th: 'Thai', he: 'Hebrew', fa: 'Persian',
};

/**
 * Build a language instruction to append to system prompts.
 * Returns empty string for English or unrecognized codes.
 */
function buildLanguageInstruction(lang) {
  if (!lang || lang === 'en') return '';
  const name = LANGUAGE_NAMES[lang] || lang;
  return `\n\nIMPORTANT: You MUST respond entirely in ${name}. All output text, explanations, labels, and descriptions must be in ${name}. Keep JSON keys, metric IDs, and technical identifiers in English, but all human-readable text must be in ${name}.`;
}

// ─── Public API ──────────────────────────────────────────────────────────────

function getProvider() {
  const name = config.llm.provider;
  const provider = providers[name];
  if (!provider) {
    throw new Error(`Unknown LLM provider: "${name}". Supported: ${Object.keys(providers).join(', ')}`);
  }
  return provider;
}

async function complete(prompt, opts = {}) {
  const { language, ...providerOpts } = opts;
  const langInstruction = buildLanguageInstruction(language);
  if (langInstruction) {
    providerOpts.systemPrompt = (providerOpts.systemPrompt || 'You are an expert NLP analyst.') + langInstruction;
  }
  return getProvider().complete(prompt, providerOpts);
}

async function completeJSON(prompt, opts = {}) {
  const text = await complete(prompt, opts);
  const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, text];
  return JSON.parse(jsonMatch[1].trim());
}

async function batchProcess(items, promptFn, { batchSize, language } = {}) {
  const size = batchSize || config.llm.batchSize;
  const results = [];
  for (let i = 0; i < items.length; i += size) {
    const batch = items.slice(i, i + size);
    const prompt = promptFn(batch);
    const result = await completeJSON(prompt, { language });
    results.push(...(Array.isArray(result) ? result : [result]));
  }
  return results;
}

function getProviderInfo() {
  const p = getProvider();
  return { provider: config.llm.provider, name: p.name, model: p.model() };
}

// Per-1M-token pricing for cost estimation (USD)
const MODEL_PRICING = {
  // Anthropic
  'claude-sonnet-4-20250514':       { promptPer1M: 3.00, completionPer1M: 15.00 },
  'claude-haiku-4-5-20251001':      { promptPer1M: 0.80, completionPer1M: 4.00 },
  'claude-opus-4-20250514':         { promptPer1M: 15.00, completionPer1M: 75.00 },
  // OpenAI
  'gpt-4o':                         { promptPer1M: 2.50, completionPer1M: 10.00 },
  'gpt-4o-mini':                    { promptPer1M: 0.15, completionPer1M: 0.60 },
  'gpt-4.1':                        { promptPer1M: 2.00, completionPer1M: 8.00 },
  'gpt-4.1-mini':                   { promptPer1M: 0.40, completionPer1M: 1.60 },
  'gpt-4.1-nano':                   { promptPer1M: 0.10, completionPer1M: 0.40 },
  'gpt-4-turbo':                    { promptPer1M: 10.00, completionPer1M: 30.00 },
  'o3':                             { promptPer1M: 2.00, completionPer1M: 8.00 },
  'o3-mini':                        { promptPer1M: 1.10, completionPer1M: 4.40 },
  'o4-mini':                        { promptPer1M: 1.10, completionPer1M: 4.40 },
};

function getPricing() {
  const model = getProvider().model();
  // Exact match
  if (MODEL_PRICING[model]) return MODEL_PRICING[model];
  // Prefix match (e.g. "claude-sonnet-4-20250514" matches "claude-sonnet-4")
  for (const [key, val] of Object.entries(MODEL_PRICING)) {
    if (model.startsWith(key) || key.startsWith(model)) return val;
  }
  // Default fallback
  return { promptPer1M: 3.00, completionPer1M: 15.00 };
}

/**
 * Extract preferred language from an Express request.
 * Priority: req.body.language > cookie 'ncm_i18n_lang' > 'en'
 */
function getRequestLanguage(req) {
  if (req.body && req.body.language) return req.body.language;
  if (req.query && req.query.language) return req.query.language;
  if (req.cookies && req.cookies.ncm_i18n_lang) return req.cookies.ncm_i18n_lang;
  // Parse cookie manually if cookie-parser not available
  const cookieHeader = req.headers && req.headers.cookie;
  if (cookieHeader) {
    const match = cookieHeader.match(/(?:^|;\s*)ncm_i18n_lang=([^;]*)/);
    if (match) return decodeURIComponent(match[1]);
  }
  return 'en';
}

module.exports = {
  complete, completeJSON, batchProcess, getProviderInfo, getPricing,
  createTracker, getActiveTracker, getSessionTracker, resetSessionTracker, TokenTracker,
  getRequestLanguage,
  setAuditContext, getAuditContext, setAuditCallback,
};
