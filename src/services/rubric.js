/**
 * Rubric Evaluation Service
 *
 * Maps Neo-Coh-Metrix L0–L10 metrics to rubric criteria and generates
 * structured reviews using LLM, grounded in actual metric evidence.
 *
 * Flow:
 * 1. Parse rubric into criteria
 * 2. For each criterion, identify which metrics are relevant
 * 3. LLM generates a review per criterion, citing metric evidence
 * 4. Produce an overall rubric score and narrative review
 */
const llm = require('./llm');
const config = require('../config');

// ─── Metric-to-rubric mapping hints ──────────────────────────────────────────
// These help the LLM know which metrics are relevant to common rubric dimensions.
const METRIC_MAPPING_HINTS = {
  'content': ['L4.1', 'L4.4', 'L4.7', 'L4.8', 'L5.1', 'L5.2', 'L7.1', 'L7.2'],
  'argument': ['L7.1', 'L7.2', 'L7.3', 'L7.4', 'L7.7', 'L6.4', 'L6.5'],
  'organization': ['L0.8', 'L0.9', 'L4.4', 'L4.6', 'L4.7', 'L6.1', 'L6.8'],
  'structure': ['L0.8', 'L0.9', 'L4.6', 'L6.1', 'L6.8'],
  'coherence': ['L3.1', 'L3.5', 'L4.1', 'L4.3', 'L4.4', 'L4.6'],
  'cohesion': ['L3.1', 'L3.4', 'L3.5', 'L3.8', 'L4.1', 'L4.3'],
  'vocabulary': ['L1.1', 'L1.3', 'L1.5', 'L1.6', 'L0.7'],
  'language': ['L1.1', 'L1.5', 'L2.1', 'L2.4', 'L8.3', 'L8.5'],
  'grammar': ['L2.1', 'L2.4', 'L2.5', 'L2.6'],
  'syntax': ['L2.1', 'L2.2', 'L2.3', 'L2.4', 'L2.6'],
  'evidence': ['L7.2', 'L7.3', 'L7.7', 'L6.4', 'L8.6'],
  'critical thinking': ['L7.1', 'L7.2', 'L7.4', 'L7.5', 'L6.5', 'L5.2'],
  'analysis': ['L5.2', 'L5.3', 'L7.2', 'L7.6', 'L6.4'],
  'voice': ['L8.3', 'L8.5', 'L8.8', 'L9.1', 'L9.4'],
  'tone': ['L9.1', 'L9.2', 'L9.4', 'L9.5', 'L8.3'],
  'engagement': ['L9.1', 'L9.5', 'L9.8', 'L1.1'],
  'mechanics': ['L0.4', 'L0.5', 'L0.7'],
  'citation': ['L8.6', 'L7.2', 'L7.3'],
  'complexity': ['L2.1', 'L2.4', 'L2.3', 'L1.1', 'L1.3'],
  'readability': ['L0.4', 'L0.5', 'L0.7', 'L2.1', 'L10.6'],
};

/**
 * Evaluate an essay against a rubric using layer results.
 *
 * @param {string} rubricText - The rubric text (criteria + descriptions + scales)
 * @param {Array} layers - Array of layer results from the analysis pipeline
 * @param {object} document - { text, wordCount, sentenceCount, paragraphCount }
 * @param {object} options - { overallScore, compositeScores, targetAudience }
 * @returns {object} Structured rubric evaluation
 */
async function evaluateWithRubric(rubricText, layers, document, options = {}) {
  const { overallScore, compositeScores, targetAudience } = options;
  const audience = targetAudience || config.targetAudience;

  // Build a summary of all metrics with values
  const metricsSummary = layers.map(l => {
    const metricLines = Object.entries(l.metrics)
      .filter(([, m]) => typeof m.value !== 'object' && (typeof m.value !== 'string' || !m.value.startsWith('{')))
      .map(([id, m]) => `  ${id} (${m.label}): ${m.value} ${m.unit}${m.verdict ? ` [${m.verdict}]` : ''}${m.evidence?.length ? ` — evidence: "${m.evidence[0]}"` : ''}`)
      .join('\n');
    return `${l.layerId} ${l.layerName} (score: ${l.score}/100):\n${metricLines}`;
  }).join('\n\n');

  // Step 1: Parse rubric and evaluate each criterion
  const prompt = `You are an expert essay grader. You have two inputs:

1. A RUBRIC provided by the instructor
2. DETAILED METRIC ANALYSIS of a student essay (from an 11-layer NLP analysis system)

Your task: For each criterion in the rubric, produce a structured evaluation that maps the relevant metrics to that criterion and provides a justified score.

═══ RUBRIC ═══
${rubricText}

═══ ESSAY METRICS ═══
Overall cohesion score: ${overallScore || 'N/A'}/100
Word count: ${document.wordCount}, Sentences: ${document.sentenceCount}, Paragraphs: ${document.paragraphCount}
${compositeScores ? `Composite factors: ${Object.values(compositeScores).map(f => `${f.label}: ${f.score}`).join(', ')}` : ''}

${metricsSummary}

═══ ESSAY EXCERPT (first 1500 chars) ═══
${document.text.substring(0, 1500)}

═══ INSTRUCTIONS ═══
For each rubric criterion, return:
- criterion_name: the name from the rubric
- max_score: the maximum points for this criterion (from the rubric scale)
- awarded_score: your score (justified by metrics)
- relevant_metrics: array of metric IDs that informed this judgment
- strengths: 1-2 specific strengths (cite metric evidence or essay quotes)
- improvements: 1-2 specific improvements needed (cite metric evidence)
- narrative: A 2-3 sentence review of this criterion written for a ${audience}. No metric IDs or jargon.

Also provide:
- overall_narrative: A paragraph-length holistic review (for a ${audience}), referencing the strongest and weakest rubric criteria
- total_score: sum of awarded scores
- total_max: sum of max scores

Return JSON:
{
  "criteria": [
    {
      "criterion_name": "...",
      "max_score": number,
      "awarded_score": number,
      "relevant_metrics": ["L4.1", ...],
      "strengths": ["..."],
      "improvements": ["..."],
      "narrative": "..."
    }
  ],
  "overall_narrative": "...",
  "total_score": number,
  "total_max": number
}`;

  try {
    const result = await llm.completeJSON(prompt, { maxTokens: 3000 });
    return {
      success: true,
      rubricText,
      evaluation: result,
    };
  } catch (err) {
    console.error('[Rubric] Evaluation failed:', err.message);
    return {
      success: false,
      error: err.message,
    };
  }
}

module.exports = { evaluateWithRubric, METRIC_MAPPING_HINTS };
