/**
 * Evidence Service
 *
 * Post-processes layer results to add:
 * 1. Evidence excerpts — actual text spans from the document
 * 2. Plain-language descriptions — audience-appropriate explanations
 * 3. Accessible interpretation — no jargon
 */
const llm = require('./llm');
const config = require('../config');

const AUDIENCE_INSTRUCTIONS = {
  student: 'You are explaining writing feedback to a university student. Use encouraging, clear language. Avoid all technical terminology. Explain what each measure means for their writing improvement.',
  teacher: 'You are explaining essay analysis to a teacher or writing instructor. Use educational language they would use in class. Reference writing pedagogy concepts but avoid NLP jargon. Focus on actionable teaching insights.',
  researcher: 'You are presenting text analysis results to a linguistics or education researcher. You may use standard terminology (cohesion, coherence, hedging) but explain NLP-specific metrics. Focus on validity and interpretation.',
  administrator: 'You are presenting essay quality metrics to a school administrator. Use plain business language. Focus on what scores mean for program quality, benchmarks, and student outcomes. Avoid all technical terms.',
  general: 'You are explaining writing quality analysis to a general audience with no specialized background. Use everyday language. Give concrete examples of what each measure means in practice.',
};

/**
 * Generate evidence and plain descriptions for a single layer.
 */
async function generateLayerEvidence(layer, documentText, audience) {
  const audienceInstruction = AUDIENCE_INSTRUCTIONS[audience] || AUDIENCE_INSTRUCTIONS.general;

  // Build metric list for the prompt
  const metricList = Object.entries(layer.metrics)
    .filter(([, m]) => typeof m.value !== 'object')
    .map(([id, m]) => `${id}: ${m.label} = ${m.value} ${m.unit}`)
    .join('\n');

  const prompt = `${audienceInstruction}

You are analyzing an essay. Here are the metrics for the "${layer.layerName}" analysis layer (score: ${layer.score}/100):

${metricList}

The full essay text is below. For EACH metric listed above, provide:
1. "plain_description": A 1-sentence explanation of what this metric measures, written for ${audience}s. No jargon.
2. "evidence": An array of 1-3 SHORT direct quotes from the essay (max 15 words each) that best illustrate this metric's finding. Use "..." to truncate. If a metric is about absence (e.g., no counter-arguments), quote what's there instead and note the gap.
3. "verdict": One word: "strength", "adequate", or "needs_work"

Also provide:
- "layer_summary": A 2-3 sentence plain-language summary of this entire layer's findings, written for ${audience}s. Reference specific parts of the essay. No metric IDs or technical terms.

Return JSON:
{
  "metrics": {
    "<metric_id>": {
      "plain_description": "...",
      "evidence": ["quote1", "quote2"],
      "verdict": "strength|adequate|needs_work"
    }
  },
  "layer_summary": "..."
}

Essay text:
${documentText.substring(0, 4000)}`;

  try {
    return await llm.completeJSON(prompt, { maxTokens: 2000 });
  } catch (err) {
    console.error(`[Evidence] Failed for ${layer.layerId}:`, err.message);
    return null;
  }
}

/**
 * Enrich all layer results with evidence and plain descriptions.
 * Runs in parallel for efficiency.
 */
async function enrichWithEvidence(layers, documentText, audience) {
  const targetAudience = audience || config.targetAudience;

  const enrichmentPromises = layers.map(async (layer) => {
    const evidence = await generateLayerEvidence(layer, documentText, targetAudience);
    if (!evidence) return layer;

    // Merge evidence into each metric
    const enrichedMetrics = { ...layer.metrics };
    if (evidence.metrics) {
      for (const [metricId, data] of Object.entries(evidence.metrics)) {
        if (enrichedMetrics[metricId]) {
          enrichedMetrics[metricId] = {
            ...enrichedMetrics[metricId],
            plainDescription: data.plain_description || '',
            evidence: data.evidence || [],
            verdict: data.verdict || 'adequate',
          };
        }
      }
    }

    return {
      ...layer,
      metrics: enrichedMetrics,
      layerSummary: evidence.layer_summary || '',
    };
  });

  return Promise.all(enrichmentPromises);
}

module.exports = { enrichWithEvidence, generateLayerEvidence };
