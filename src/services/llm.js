const Anthropic = require('@anthropic-ai/sdk');
const config = require('../config');

let client = null;

function getClient() {
  if (!client) {
    client = new Anthropic({ apiKey: config.anthropic.apiKey });
  }
  return client;
}

/**
 * Send a prompt to Claude and get a text response.
 */
async function complete(prompt, { systemPrompt, maxTokens, temperature } = {}) {
  const anthropic = getClient();
  const response = await anthropic.messages.create({
    model: config.anthropic.model,
    max_tokens: maxTokens || config.anthropic.maxTokens,
    temperature: temperature ?? config.anthropic.temperature,
    system: systemPrompt || 'You are an expert NLP analyst. Return only valid JSON unless instructed otherwise.',
    messages: [{ role: 'user', content: prompt }],
  });
  return response.content[0].text;
}

/**
 * Send a prompt and parse JSON response.
 */
async function completeJSON(prompt, { systemPrompt, maxTokens } = {}) {
  const text = await complete(prompt, { systemPrompt, maxTokens });
  // Extract JSON from potential markdown code blocks
  const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, text];
  return JSON.parse(jsonMatch[1].trim());
}

/**
 * Process items in batches using LLM.
 */
async function batchProcess(items, promptFn, { batchSize } = {}) {
  const size = batchSize || config.anthropic.batchSize;
  const results = [];
  for (let i = 0; i < items.length; i += size) {
    const batch = items.slice(i, i + size);
    const prompt = promptFn(batch);
    const result = await completeJSON(prompt);
    results.push(...(Array.isArray(result) ? result : [result]));
  }
  return results;
}

module.exports = { complete, completeJSON, batchProcess };
