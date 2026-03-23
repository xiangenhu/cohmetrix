const express = require('express');
const llm = require('../services/llm');
const config = require('../config');
const { getDefinition, LAYER_DEFINITIONS, METRIC_DEFINITIONS } = require('../services/definitions');
const { getGenreContext, getGenre } = require('../services/genres');

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
 * POST /api/help/detect — Detect genre and reading level from analysis metrics.
 * Returns suggestions the user can confirm or override before generating summary.
 */
router.post('/detect', async (req, res) => {
  try {
    const { layers, document: doc } = req.body;
    const audience = req.body.audience || config.targetAudience;
    const persona = AUDIENCE_PERSONA[audience] || AUDIENCE_PERSONA.general;

    if (!layers || !layers.length) {
      return res.status(400).json({ error: 'Missing layers data.' });
    }

    // Extract key metrics for genre/level detection
    const l0 = layers.find(l => l.layerId === 'L0') || {};
    const l1 = layers.find(l => l.layerId === 'L1') || {};
    const l2 = layers.find(l => l.layerId === 'L2') || {};
    const l8 = layers.find(l => l.layerId === 'L8') || {};
    const l9 = layers.find(l => l.layerId === 'L9') || {};
    const l10 = layers.find(l => l.layerId === 'L10') || {};

    const m = (layer, id) => layer.metrics?.[id]?.value ?? '?';

    // Compute reading level from Flesch-Kincaid
    const fkGrade = parseFloat(m(l0, 'L0.14'));
    const fre = parseFloat(m(l0, 'L0.13'));
    let suggestedLevel = 'college';
    let suggestedLevelLabel = 'College (undergraduate)';
    if (!isNaN(fkGrade)) {
      if (fkGrade <= 5) { suggestedLevel = 'elementary'; suggestedLevelLabel = 'Elementary (grades 3-5)'; }
      else if (fkGrade <= 8) { suggestedLevel = 'middle-school'; suggestedLevelLabel = 'Middle School (grades 6-8)'; }
      else if (fkGrade <= 12) { suggestedLevel = 'high-school'; suggestedLevelLabel = 'High School (grades 9-12)'; }
      else if (fkGrade <= 16) { suggestedLevel = 'college'; suggestedLevelLabel = 'College (undergraduate)'; }
      else { suggestedLevel = 'graduate'; suggestedLevelLabel = 'Graduate / Professional'; }
    }

    // Build a compact metric profile for LLM genre detection
    const metricProfile = [
      `Words: ${m(l0, 'L0.1')}, Sentences: ${m(l0, 'L0.2')}, Paragraphs: ${m(l0, 'L0.3')}`,
      `Mean sentence length: ${m(l0, 'L0.5')} words, Flesch-Kincaid: ${m(l0, 'L0.14')}, Flesch RE: ${m(l0, 'L0.13')}`,
      `MATTR: ${m(l0, 'L0.10')}, Academic word density: ${m(l1, 'L1.8')}`,
      `Mean dependency distance: ${m(l2, 'L2.1')}, Subordination ratio: ${m(l2, 'L2.5')}, Passive voice: ${m(l2, 'L2.6')}`,
      `Main claims: ${m(l8, 'L8.1')}, Premises/claim: ${m(l8, 'L8.2')}, Counter-argument: ${m(l8, 'L8.4')}`,
      `Hedging: ${m(l9, 'L9.3')}, Boosting: ${m(l9, 'L9.4')}, Evidentiality: ${m(l9, 'L9.6')}`,
      `Valence: ${m(l10, 'L10.1')}, Arousal: ${m(l10, 'L10.2')}, Engagement: ${m(l10, 'L10.8')}`,
    ].join('\n');

    // First 200 chars of text for context
    const textSnippet = (doc?.text || '').substring(0, 300).replace(/\n/g, ' ');

    // Get available genre categories for the prompt
    const { GENRE_CATEGORIES } = require('../services/genres');
    const genreList = GENRE_CATEGORIES.map(c =>
      `${c.category}: ${c.genres.map(g => g.id).join(', ')}`
    ).join('\n');

    const detectPrompt = `Analyze this text's metrics and opening passage to determine its most likely genre.

Text opening: "${textSnippet}..."

Metric profile:
${metricProfile}

Available genres (pick ONE genre ID from this list):
${genreList}

Respond with EXACTLY two lines:
GENRE: [genre-id]
REASON: [one sentence explaining why]

Do not add any other text.`;

    const result = await llm.complete(detectPrompt, {
      systemPrompt: 'You are a text classification expert. Respond with exactly the format requested.',
      maxTokens: 100,
    });

    // Parse response
    let suggestedGenre = '';
    let genreReason = '';
    const lines = result.trim().split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('GENRE:')) suggestedGenre = trimmed.substring(6).trim();
      if (trimmed.startsWith('REASON:')) genreReason = trimmed.substring(7).trim();
    }

    // Validate genre ID exists
    const genreInfo = suggestedGenre ? getGenre(suggestedGenre) : null;
    if (!genreInfo) suggestedGenre = '';

    const session = llm.getSessionTracker().getSummary();
    res.json({
      suggestedGenre,
      suggestedGenreLabel: genreInfo ? genreInfo.name : '',
      suggestedGenreCategory: genreInfo ? genreInfo.category : '',
      genreReason,
      suggestedLevel,
      suggestedLevelLabel,
      fkGrade: isNaN(fkGrade) ? null : fkGrade,
      fleschReadingEase: isNaN(fre) ? null : fre,
      tokenUsage: session,
    });
  } catch (err) {
    console.error('[POST /api/help/detect]', err);
    res.status(500).json({ error: 'Failed to detect genre/level.' });
  }
});

/**
 * POST /api/help/summary — Generate a full-analysis dimensional summary + FAQs about the document.
 */
router.post('/summary', async (req, res) => {
  try {
    const { layers, overallScore, compositeScores, feedback, document: doc, readingLevel } = req.body;
    const audience = req.body.audience || config.targetAudience;
    const persona = AUDIENCE_PERSONA[audience] || AUDIENCE_PERSONA.general;

    if (!layers || !layers.length) {
      return res.status(400).json({ error: 'Missing layers data.' });
    }

    // Genre-aware context (use override from user, fall back to document)
    const genreId = req.body.genre || doc?.genre || '';
    const genreInfo = genreId ? getGenre(genreId) : null;
    const genreContext = genreId ? getGenreContext(genreId) : '';
    const genreLabel = genreInfo ? genreInfo.name : 'general academic essay';

    // Reading level context
    const LEVEL_LABELS = {
      'elementary': 'Elementary (grades 3-5)',
      'middle-school': 'Middle School (grades 6-8)',
      'high-school': 'High School (grades 9-12)',
      'college': 'College (undergraduate)',
      'graduate': 'Graduate / Professional',
    };
    const levelLabel = LEVEL_LABELS[readingLevel] || readingLevel || '';
    const readingLevelContext = levelLabel
      ? `The INTENDED reading level is: ${levelLabel}. Evaluate whether this text is appropriate for that audience — is it too simple, too complex, or well-matched? Comment on readability relative to this target level.`
      : '';

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

You are summarizing a complete text analysis for a ${audience}. The document is a **${genreLabel}**. It has ${doc?.wordCount || '?'} words, ${doc?.sentenceCount || '?'} sentences, and ${doc?.paragraphCount || '?'} paragraphs. Overall cohesion score: ${overallScore}/100.

${genreContext ? `GENRE-SPECIFIC EVALUATION CRITERIA:\n${genreContext}\n` : ''}
${readingLevelContext ? `READING LEVEL TARGET:\n${readingLevelContext}\n` : ''}
Layer-by-layer results:
${layerSnapshot}

${feedbackStr ? `AI tutor feedback: ${feedbackStr}` : ''}

Write a dimensional summary of this analysis, EVALUATED AGAINST THE EXPECTATIONS OF THE ${genreLabel.toUpperCase()} GENRE. For each major dimension, write 1-2 sentences covering:
1. Surface & Vocabulary (L0-L1): readability, vocabulary sophistication — appropriate for this genre?
2. Syntax (L2): sentence complexity and variety — matching genre expectations?
3. Cohesion & Coherence (L3-L5): how well ideas connect — genre-appropriate level?
4. Deeper Meaning (L6): situation model — relevant for this genre?
5. Rhetoric & Argumentation (L7-L8): organization and argument quality — expected in this genre?
6. Stance & Tone (L9-L10): voice, hedging, emotional control — matching genre norms?

For dimensions NOT relevant to this genre (per the genre criteria above), briefly note that they are less applicable rather than flagging low scores as weaknesses.

End with 1-2 sentences of overall assessment for a ${genreLabel}.${levelLabel ? ` Include whether the text is well-matched to the ${levelLabel} reading level.` : ''}

Use plain language. Do NOT use metric IDs or abbreviations. Do NOT use bullet points — write flowing prose with clear paragraph breaks between dimensions. Keep each dimension to 2-3 sentences max.`;

    // Part 2: FAQs about the document
    const faqPrompt = `${persona}

You are generating frequently asked questions a ${audience} might have about this specific ${genreLabel}, based on its analysis results.

${genreContext ? `GENRE CONTEXT:\n${genreContext}\n` : ''}
${readingLevelContext ? `READING LEVEL:\n${readingLevelContext}\n` : ''}
Document stats: ${doc?.wordCount || '?'} words, overall score ${overallScore}/100.

Layer results:
${layerSnapshot}

${feedbackStr ? `AI tutor feedback: ${feedbackStr}` : ''}

Generate exactly 5 questions and answers that a ${audience} would likely ask about THIS specific ${genreLabel}. Questions should be practical, actionable, and GENRE-AWARE. For example:
${genreInfo ? `- "Is my ${genreLabel.toLowerCase()} meeting genre conventions?"` : ''}
- "What are the strongest aspects of this writing?"
- "What should I prioritize improving?"
- "How does this compare to typical ${genreLabel.toLowerCase()} quality?"

Format each as:
Q: [question]
A: [2-3 sentence answer referencing specific findings from the analysis, interpreted through the lens of ${genreLabel} conventions]

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
