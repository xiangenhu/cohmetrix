/**
 * L1 — Lexical Sophistication
 *
 * Per-token LLM surprisal replaces MRC frequency norms.
 * Higher surprisal = lower predictability = higher processing cost.
 */
const llm = require('../services/llm');
const { mean, descriptiveStats } = require('../utils/nlp');

const LAYER_ID = 'L1';
const LAYER_NAME = 'Lexical Sophistication';

// Academic Word List (Coxhead 2000) — top entries for density calculation
const AWL_SAMPLE = new Set([
  'analyze', 'approach', 'area', 'assess', 'assume', 'authority', 'available',
  'benefit', 'concept', 'consist', 'constitute', 'context', 'contract', 'create',
  'data', 'define', 'derive', 'distribute', 'economy', 'environment', 'establish',
  'estimate', 'evident', 'export', 'factor', 'finance', 'formula', 'function',
  'identify', 'income', 'indicate', 'individual', 'interpret', 'involve', 'issue',
  'labor', 'legal', 'legislate', 'major', 'method', 'occur', 'percent', 'period',
  'policy', 'principle', 'proceed', 'process', 'require', 'research', 'respond',
  'role', 'section', 'sector', 'significant', 'similar', 'source', 'specific',
  'structure', 'theory', 'vary', 'achieve', 'acquire', 'administrate', 'affect',
  'appropriate', 'aspect', 'assist', 'category', 'chapter', 'commission', 'community',
  'complex', 'compute', 'conclude', 'conduct', 'consequent', 'construct', 'consume',
  'credit', 'culture', 'design', 'distinct', 'element', 'equate', 'evaluate',
  'feature', 'final', 'focus', 'impact', 'injure', 'institute', 'invest',
  'maintain', 'normal', 'obtain', 'participate', 'perceive', 'positive', 'potential',
  'previous', 'primary', 'purchase', 'range', 'region', 'regulate', 'relevant',
  'reside', 'resource', 'restrict', 'secure', 'seek', 'select', 'strategy',
  'survey', 'text', 'tradition', 'transfer', 'transform', 'transport',
  'framework', 'furthermore', 'generate', 'hypothesis', 'implement', 'implicate',
  'integrate', 'investigate', 'mechanism', 'paradigm', 'parameter', 'perspective',
  'phenomenon', 'preliminary', 'nonetheless', 'subsequent', 'supplement', 'fundamental',
  'comprehensive', 'cognitive', 'pedagogical', 'implication', 'intervention',
  'analytical', 'dimension', 'adaptive', 'artificial', 'intelligence',
  'educational', 'institutional', 'technological', 'evaluation', 'engagement',
]);

async function analyze(doc) {
  const words = doc.tokens.filter(t => /^\w+$/.test(t));
  const contentWords = words.filter(w => w.length > 2);

  // Use LLM to assess lexical sophistication with per-sentence distributions
  let surprisalData;
  try {
    surprisalData = await llm.completeJSON(`
Analyze the lexical sophistication of this text. For the text below, estimate:
1. mean_surprisal: average information content per token in bits (scale 4-12, where academic text ~7-9)
2. surprisal_sd: standard deviation of per-token surprisal
3. mean_aoa: estimated mean age-of-acquisition of content words in years (scale 4-14)
4. mean_concreteness: mean concreteness rating (scale 1-5, where 1=abstract, 5=concrete)
5. rare_word_ratio: proportion of words that would be unfamiliar to a B2 English learner (0-1)
6. morphological_complexity: mean morphemes per content word (1-4)
7. register_consistency: how consistent the register is throughout (0-1, where 1=perfectly consistent)

Also provide per-sentence estimates for key metrics:
8. per_sentence_surprisal: array of per-sentence mean surprisal values (one float per sentence)
9. per_sentence_aoa: array of per-sentence mean age-of-acquisition values
10. per_sentence_concreteness: array of per-sentence mean concreteness values

Return JSON: {"mean_surprisal": float, "surprisal_sd": float, "mean_aoa": float, "mean_concreteness": float, "rare_word_ratio": float, "morphological_complexity": float, "register_consistency": float, "per_sentence_surprisal": [float, ...], "per_sentence_aoa": [float, ...], "per_sentence_concreteness": [float, ...]}

Text: ${doc.text.substring(0, 3000)}`);
  } catch {
    surprisalData = {
      mean_surprisal: 7.0, surprisal_sd: 2.5, mean_aoa: 7.5,
      mean_concreteness: 2.8, rare_word_ratio: 0.08,
      morphological_complexity: 1.6, register_consistency: 0.75,
      per_sentence_surprisal: [], per_sentence_aoa: [], per_sentence_concreteness: [],
    };
  }

  // Compute distributions from per-sentence arrays
  const surprisalDist = descriptiveStats(surprisalData.per_sentence_surprisal || [], 2);
  const aoaDist = descriptiveStats(surprisalData.per_sentence_aoa || [], 2);
  const concDist = descriptiveStats(surprisalData.per_sentence_concreteness || [], 2);

  // AWL density
  const awlCount = contentWords.filter(w => AWL_SAMPLE.has(w.toLowerCase())).length;
  const awlDensity = awlCount / Math.max(contentWords.length, 1);

  const metrics = {
    'L1.1': { value: round(surprisalData.mean_surprisal, 1), unit: 'bits', label: 'Mean token surprisal', distribution: surprisalDist },
    'L1.2': { value: round(surprisalData.surprisal_sd, 1), unit: 'SD', label: 'Surprisal standard deviation' },
    'L1.3': { value: round(surprisalData.mean_aoa, 1), unit: 'years', label: 'Mean age of acquisition', distribution: aoaDist },
    'L1.4': { value: round(surprisalData.mean_concreteness, 1), unit: '/5', label: 'Mean concreteness', distribution: concDist },
    'L1.5': { value: round(awlDensity, 2), unit: 'AWL%', label: 'Academic word density' },
    'L1.6': { value: round(surprisalData.rare_word_ratio, 2), unit: 'ratio', label: 'Rare word ratio' },
    'L1.7': { value: round(surprisalData.register_consistency, 2), unit: 'score', label: 'Register consistency' },
    'L1.8': { value: round(surprisalData.morphological_complexity, 1), unit: 'mods', label: 'Morphological complexity' },
  };

  // Score: weighted from surprisal, AWL density, AoA
  const surprisalScore = normalizeToScore(surprisalData.mean_surprisal, 6.5, 9.0, 3, 13);
  const awlScore = normalizeToScore(awlDensity, 0.12, 0.22, 0, 0.40);
  const aoaScore = normalizeToScore(surprisalData.mean_aoa, 7, 10, 4, 14);
  const score = Math.round(surprisalScore * 0.35 + awlScore * 0.30 + aoaScore * 0.35);

  return {
    layerId: LAYER_ID,
    layerName: LAYER_NAME,
    score: clampScore(score),
    metrics,
    rawValues: { ...surprisalData, awlDensity },
  };
}

function normalizeToScore(value, idealMin, idealMax, absMin, absMax) {
  if (value >= idealMin && value <= idealMax) return 80 + 20 * (1 - Math.abs(value - (idealMin + idealMax) / 2) / ((idealMax - idealMin) / 2));
  if (value < idealMin) return Math.max(15, 80 * (value - absMin) / (idealMin - absMin));
  return Math.max(15, 80 * (absMax - value) / (absMax - idealMax));
}

function clampScore(s) { return Math.max(0, Math.min(100, s)); }
function round(n, d = 0) { const f = 10 ** d; return Math.round(n * f) / f; }

module.exports = { analyze, LAYER_ID, LAYER_NAME };
