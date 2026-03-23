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

    // Build benchmark card data (best/worst cases from the literature)
    const benchmarks = {};
    if (def.bestCase) benchmarks.bestCase = def.bestCase;
    if (def.worstCase) benchmarks.worstCase = def.worstCase;

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
        benchmarks: Object.keys(benchmarks).length > 0 ? benchmarks : undefined,
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
    res.json({ id, indexExplanation: indexExplanation.trim(), explanation: indexExplanation.trim(), definition: def, benchmarks: Object.keys(benchmarks).length > 0 ? benchmarks : undefined, tokenUsage: session });
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
 * POST /api/help/summary — Generate a full-analysis dimensional summary + FAQs about the document.
 */
router.post('/summary', async (req, res) => {
  try {
    const { layers, overallScore, compositeScores, feedback, document: doc } = req.body;
    const audience = req.body.audience || config.targetAudience;
    const persona = AUDIENCE_PERSONA[audience] || AUDIENCE_PERSONA.general;

    if (!layers || !layers.length) {
      return res.status(400).json({ error: 'Missing layers data.' });
    }

    // Build a compact snapshot of every layer
    const layerSnapshot = layers.map(l => {
      const topMetrics = Object.entries(l.metrics || {})
        .filter(([, m]) => typeof m.value !== 'string' || !m.value.startsWith('{'))
        .slice(0, 6)
        .map(([id, m]) => `${id} ${m.label}: ${m.value} ${m.unit}`)
        .join('; ');
      return `${l.layerId} ${l.layerName} (score ${l.score}/100): ${topMetrics}`;
    }).join('\n');

    const feedbackStr = (feedback || []).join(' ');

    // Part 1: Dimensional summary
    const summaryPrompt = `${persona}

You are summarizing a complete essay analysis for a ${audience}. The essay has ${doc?.wordCount || '?'} words, ${doc?.sentenceCount || '?'} sentences, and ${doc?.paragraphCount || '?'} paragraphs. Overall cohesion score: ${overallScore}/100.

Layer-by-layer results:
${layerSnapshot}

${feedbackStr ? `AI tutor feedback: ${feedbackStr}` : ''}

Write a dimensional summary of this analysis. For each major dimension, write 1-2 sentences covering:
1. Surface & Vocabulary (L0-L1): readability, vocabulary sophistication
2. Syntax (L2): sentence complexity and variety
3. Cohesion & Coherence (L3-L5): how well ideas connect
4. Deeper Meaning (L6): situation model / mental simulation
5. Rhetoric & Argumentation (L7-L8): organization and argument quality
6. Stance & Tone (L9-L10): voice, hedging, emotional control

End with 1-2 sentences of overall assessment.

Use plain language. Do NOT use metric IDs or abbreviations. Do NOT use bullet points — write flowing prose with clear paragraph breaks between dimensions. Keep each dimension to 2-3 sentences max.`;

    // Part 2: FAQs about the document
    const faqPrompt = `${persona}

You are generating frequently asked questions a ${audience} might have about this specific essay, based on its analysis results.

Essay stats: ${doc?.wordCount || '?'} words, overall score ${overallScore}/100.

Layer results:
${layerSnapshot}

${feedbackStr ? `AI tutor feedback: ${feedbackStr}` : ''}

Generate exactly 5 questions and answers that a ${audience} would likely ask about THIS specific document. Questions should be practical and actionable, like:
- "Why is my cohesion score low?"
- "How can I improve my argumentation?"
- "Is my vocabulary appropriate for this level?"

Format each as:
Q: [question]
A: [2-3 sentence answer referencing specific findings from the analysis]

Make questions specific to the actual scores and findings — not generic.`;

    const [summaryResult, faqResult] = await Promise.all([
      llm.complete(summaryPrompt, { systemPrompt: persona, maxTokens: 600 }),
      llm.complete(faqPrompt, { systemPrompt: persona, maxTokens: 700 }),
    ]);

    // Parse FAQs into structured format
    const faqs = [];
    const faqLines = faqResult.trim().split('\n');
    let currentQ = null;
    for (const line of faqLines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('Q:')) {
        currentQ = trimmed.substring(2).trim();
      } else if (trimmed.startsWith('A:') && currentQ) {
        faqs.push({ question: currentQ, answer: trimmed.substring(2).trim() });
        currentQ = null;
      }
    }

    const session = llm.getSessionTracker().getSummary();
    res.json({
      summary: summaryResult.trim(),
      faqs,
      tokenUsage: session,
    });
  } catch (err) {
    console.error('[POST /api/help/summary]', err);
    res.status(500).json({ error: 'Failed to generate summary.' });
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
