/**
 * llmGateway.js — thin `chat(messages, opts)` facade over the app's single LLM
 * abstraction (services/llm.js). The contextual-help route (and any future
 * chat-shaped caller) routes model calls through this ONE chokepoint so provider
 * choice, language, and token accounting stay centralized — never a provider SDK
 * directly. [llm-gateway invariant]
 *
 * llm.complete() is single-prompt (prompt + systemPrompt). The help route builds
 * a messages array [system, ...history, user] but ALSO embeds prior turns into the
 * final user message, so the last user message already carries full context. We
 * therefore map: system -> systemPrompt, last user message -> prompt.
 *
 * We intentionally do NOT forward a `language` option: the help route bakes the
 * "Respond in {language}" instruction into the system prompt (that is what puts
 * language into the server cache key by construction). Forwarding language here
 * would double the instruction.
 */
const llm = require('./llm');

async function chat(messages, opts = {}) {
  const list = Array.isArray(messages) ? messages.filter(Boolean) : [];
  const system = list.find((m) => m.role === 'system');
  const nonSystem = list.filter((m) => m.role !== 'system');

  const lastUser = [...nonSystem].reverse().find((m) => m.role === 'user');
  const prompt = lastUser
    ? String(lastUser.content || '')
    : nonSystem.map((m) => `${m.role}: ${m.content}`).join('\n\n');

  const providerOpts = {};
  if (system) providerOpts.systemPrompt = String(system.content || '');
  if (opts.maxTokens != null) providerOpts.maxTokens = opts.maxTokens;
  if (opts.temperature != null) providerOpts.temperature = opts.temperature;

  const text = await llm.complete(prompt, providerOpts);
  return String(text || '');
}

module.exports = { llmGateway: { chat } };
