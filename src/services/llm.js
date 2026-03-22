/**
 * LLM Service — Multi-provider abstraction.
 *
 * Supports: anthropic, openai, azure
 * Controlled by LLM_PROVIDER env var.
 */
const config = require('../config');

// ─── Provider implementations ────────────────────────────────────────────────

const providers = {
  /**
   * Anthropic (Claude)
   */
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
        return response.content[0].text;
      },
    };
  })(),

  /**
   * OpenAI
   */
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
        return data.choices[0].message.content;
      },
    };
  })(),

  /**
   * Azure OpenAI
   */
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

/**
 * Send a prompt and get a text response from the active provider.
 */
async function complete(prompt, opts = {}) {
  return getProvider().complete(prompt, opts);
}

/**
 * Send a prompt and parse JSON response.
 */
async function completeJSON(prompt, opts = {}) {
  const text = await complete(prompt, opts);
  // Extract JSON from potential markdown code blocks
  const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, text];
  return JSON.parse(jsonMatch[1].trim());
}

/**
 * Process items in batches using LLM.
 */
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

/**
 * Get info about the active provider (for logging/health checks).
 */
function getProviderInfo() {
  const p = getProvider();
  return { provider: config.llm.provider, name: p.name, model: p.model() };
}

module.exports = { complete, completeJSON, batchProcess, getProviderInfo };
