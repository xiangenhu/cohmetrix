const express = require('express');
const llm = require('../services/llm');

const router = express.Router();

/**
 * POST /api/interpret — Generate interpretation for a layer
 */
router.post('/', async (req, res) => {
  try {
    const { layerId, layerName, score, metrics } = req.body;

    if (!layerId || !metrics) {
      return res.status(400).json({ error: 'Missing layerId or metrics' });
    }

    const metricsSummary = Object.entries(metrics)
      .filter(([, m]) => typeof m.value !== 'string' || !m.value.startsWith('{'))
      .map(([id, m]) => `${id} (${m.label}): ${m.value} ${m.unit}`)
      .join('\n');

    const prompt = `You are analyzing essay cohesion metrics for the ${layerName} (${layerId}) layer, which scored ${score}/100.

Metrics:
${metricsSummary}

Write a concise 2-3 sentence interpretation of these results. Reference specific metric values. Note strengths and weaknesses. Use academic but accessible language. Do NOT use bullet points.

Return only the interpretation text, no JSON.`;

    const interpretation = await llm.complete(prompt, {
      systemPrompt: 'You are an expert writing assessment analyst. Provide concise, insightful interpretations of text cohesion metrics.',
      maxTokens: 300,
    });

    res.json({ interpretation: interpretation.trim() });
  } catch (err) {
    console.error('[POST /api/interpret]', err);
    res.status(500).json({ error: 'Interpretation failed' });
  }
});

module.exports = router;
