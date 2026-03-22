const express = require('express');
const llm = require('../services/llm');
const config = require('../config');

const router = express.Router();

const AUDIENCE_TONE = {
  student: 'Use encouraging, clear language a university student would understand. Avoid all technical jargon.',
  teacher: 'Use educational language a writing instructor would use in class. Reference writing pedagogy, not NLP.',
  researcher: 'Use standard linguistics terminology but explain NLP-specific metrics.',
  administrator: 'Use plain business language. Focus on what scores mean for student outcomes.',
  general: 'Use everyday language with no specialized terms.',
};

/**
 * POST /api/interpret — Generate audience-appropriate interpretation for a layer
 */
router.post('/', async (req, res) => {
  try {
    const { layerId, layerName, score, metrics, targetAudience } = req.body;

    if (!layerId || !metrics) {
      return res.status(400).json({ error: 'Missing layerId or metrics' });
    }

    const audience = targetAudience || config.targetAudience;
    const tone = AUDIENCE_TONE[audience] || AUDIENCE_TONE.general;

    const metricsSummary = Object.entries(metrics)
      .filter(([, m]) => typeof m.value !== 'string' || !m.value.startsWith('{'))
      .map(([id, m]) => {
        const plain = m.plainDescription ? ` (${m.plainDescription})` : '';
        return `${id} (${m.label}): ${m.value} ${m.unit}${plain}`;
      })
      .join('\n');

    const prompt = `You are interpreting essay analysis results for the "${layerName}" layer (score: ${score}/100).

${tone}

Metrics:
${metricsSummary}

Write a 2-3 sentence interpretation. Mention specific findings. Highlight one strength and one area for improvement if applicable. Do NOT use bullet points, metric IDs, or technical abbreviations.

Return only the interpretation text.`;

    const interpretation = await llm.complete(prompt, {
      systemPrompt: `You are an expert writing assessment analyst providing feedback to a ${audience}. ${tone}`,
      maxTokens: 300,
    });

    res.json({ interpretation: interpretation.trim() });
  } catch (err) {
    console.error('[POST /api/interpret]', err);
    res.status(500).json({ error: 'Interpretation failed' });
  }
});

module.exports = router;
