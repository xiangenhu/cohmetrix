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
        return response.content[0].text;
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
        return data.choices[0].message.content;
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
        return data.choices[0].message.content;
      },
    };
  })(),
};

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
  return getProvider().complete(prompt, opts);
}

async function completeJSON(prompt, opts = {}) {
  const text = await complete(prompt, opts);
  const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, text];
  return JSON.parse(jsonMatch[1].trim());
}

async function batchProcess(items, promptFn, { batchSize } = {}) {
  const size = batchSize || config.llm.batchSize;
  const results = [];
  for (let i = 0; i < items.length; i += size) {
    const batch = items.slice(i, i + size);
    const prompt = promptFn(batch);
    const result = await completeJSON(prompt);
    results.push(...(Array.isArray(result) ? result : [result]));
  }
  return results;
}

function getProviderInfo() {
  const p = getProvider();
  return { provider: config.llm.provider, name: p.name, model: p.model() };
}

module.exports = {
  complete, completeJSON, batchProcess, getProviderInfo,
  createTracker, getActiveTracker, getSessionTracker, resetSessionTracker, TokenTracker,
};
