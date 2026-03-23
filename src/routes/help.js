const express = require('express');
const llm = require('../services/llm');
const config = require('../config');
const { getDefinition, LAYER_DEFINITIONS, METRIC_DEFINITIONS } = require('../services/definitions');

const router = express.Router();

const AUDIENCE_PERSONA = {
  student: 'You are a friendly, encouraging writing tutor helping a university student. Use everyday language, give practical examples, and avoid all jargon. Be supportive.',
  teacher: 'You are a colleague explaining writing analysis tools to a fellow teacher or writing instructor. Use pedagogical language they\'d use in class. Be practical and insightful.',
  researcher: 'You are a fellow researcher discussing text analysis methodology. Use standard linguistics and psycholinguistics terminology. Be precise but collegial.',
  administrator: 'You are presenting to a school administrator. Use plain language, connect to student outcomes and program quality. Be concise and actionable.',
  general: 'You are explaining to someone with no specialized background. Use everyday language, analogies, and examples. Be clear and friendly.',
};

/**
 * POST /api/help/explain — Get an audience-appropriate explanation of a metric or layer.
 */
router.post('/explain', async (req, res) => {
  try {
    const { id, context } = req.body;
    const audience = req.body.audience || config.targetAudience;
    const def = getDefinition(id);

    if (!def) {
      return res.status(404).json({ error: `No definition found for "${id}".` });
    }

    const persona = AUDIENCE_PERSONA[audience] || AUDIENCE_PERSONA.general;
    const isLayer = !id.includes('.');
    const hasScore = context && context.value !== undefined && context.value !== null;

    // Part 1: Explain the index itself
    const indexPrompt = `${persona}

A ${audience} clicked the help button on "${def.label || def.name}" (${id}) in an essay analysis tool. Explain what this ${isLayer ? 'layer' : 'index'} measures and why it matters for writing quality.

Here is the correct technical definition:
${def.definition}

${def.why ? `Why it matters: ${def.why}` : ''}

Write a clear, ${audience === 'student' ? '3-4' : '2-3'} sentence explanation of what this ${isLayer ? 'layer' : 'index'} IS and what it captures about writing. ${audience === 'student' ? 'Use an analogy or example if helpful.' : ''} Do NOT use metric IDs or technical abbreviations. Do NOT start with "This metric..." — vary your openings.`;

    // Part 2: Explain the score (if we have one)
    let scoreExplanation = null;
    if (hasScore) {
      const scorePrompt = `${persona}

A ${audience} is looking at their essay analysis results. For the ${isLayer ? 'layer' : 'metric'} "${def.label || def.name}" (${id}), their essay scored: ${context.value} ${context.unit || ''}${context.layerScore !== undefined ? ` (layer score: ${context.layerScore}/100)` : ''}.

Technical definition: ${def.definition}
${def.interpretation ? `Interpretation guide: ${def.interpretation}` : ''}

Explain what this specific score means in practical terms. Is it high, low, or typical? What does it suggest about the writing? Give concrete, actionable insight.

Write 2-3 sentences. Be specific about THIS score — do not re-explain what the index is. ${audience === 'student' ? 'Be encouraging and constructive.' : ''} Do NOT use metric IDs or technical abbreviations.`;

      const [indexResult, scoreResult] = await Promise.all([
        llm.complete(indexPrompt, { systemPrompt: persona, maxTokens: 250 }),
        llm.complete(scorePrompt, { systemPrompt: persona, maxTokens: 250 }),
      ]);

      const session = llm.getSessionTracker().getSummary();
      res.json({
        id,
        indexExplanation: indexResult.trim(),
        scoreExplanation: scoreResult.trim(),
        explanation: indexResult.trim(), // backward compat
        definition: def,
        score: { value: context.value, unit: context.unit || '', layerScore: context.layerScore },
        tokenUsage: session,
      });
      return;
    }

    const indexExplanation = await llm.complete(indexPrompt, {
      systemPrompt: persona,
      maxTokens: 250,
    });

    const session = llm.getSessionTracker().getSummary();
    res.json({ id, indexExplanation: indexExplanation.trim(), explanation: indexExplanation.trim(), definition: def, tokenUsage: session });
  } catch (err) {
    console.error('[POST /api/help/explain]', err);
    res.status(500).json({ error: 'Failed to generate explanation.' });
  }
});

/**
 * POST /api/help/chat — Follow-up question about a metric or layer.
 */
router.post('/chat', async (req, res) => {
  try {
    const { id, question, history } = req.body;
    const audience = req.body.audience || config.targetAudience;
    const def = getDefinition(id);
    const persona = AUDIENCE_PERSONA[audience] || AUDIENCE_PERSONA.general;

    // Build conversation context
    const defContext = def
      ? `You are answering questions about "${def.label || def.name}" (${id}).\n\nCanonical definition: ${def.definition}\n${def.interpretation ? `Interpretation: ${def.interpretation}` : ''}\n${def.why ? `Why it matters: ${def.why}` : ''}`
      : `You are answering questions about essay analysis metric "${id}".`;

    // Include prior messages for multi-turn
    const priorMessages = (history || []).map(h => `${h.role === 'user' ? 'User' : 'Assistant'}: ${h.text}`).join('\n');

    const prompt = `${defContext}

${priorMessages ? `Previous conversation:\n${priorMessages}\n` : ''}
The ${audience} asks: "${question}"

Answer clearly and helpfully. Keep it concise (2-4 sentences). ${audience === 'student' ? 'Be encouraging.' : ''}`;

    const answer = await llm.complete(prompt, {
      systemPrompt: persona,
      maxTokens: 300,
    });

    const session = llm.getSessionTracker().getSummary();
    res.json({ answer: answer.trim(), tokenUsage: session });
  } catch (err) {
    console.error('[POST /api/help/chat]', err);
    res.status(500).json({ error: 'Failed to generate response.' });
  }
});

/**
 * GET /api/help/definition/:id — Get raw definition (no LLM).
 */
router.get('/definition/:id', (req, res) => {
  const def = getDefinition(req.params.id);
  if (!def) return res.status(404).json({ error: 'Not found' });
  res.json(def);
});

module.exports = router;
