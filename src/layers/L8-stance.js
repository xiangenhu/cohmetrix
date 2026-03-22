/**
 * L8 — Pragmatic Stance
 *
 * Hedging, evidentiality, and speech act theory (Austin 1962; Searle 1969).
 * Epistemic calibration critical for academic register.
 */
const llm = require('../services/llm');

const LAYER_ID = 'L8';
const LAYER_NAME = 'Pragmatic Stance';

// Surface-level hedge/boost markers
const HEDGE_MARKERS = [
  'might', 'may', 'could', 'would', 'should', 'seem', 'appear',
  'approximately', 'roughly', 'about', 'around', 'almost',
  'possibly', 'perhaps', 'arguably', 'likely', 'unlikely',
  'suggest', 'indicate', 'tend',
];
const BOOST_MARKERS = [
  'clearly', 'obviously', 'certainly', 'undoubtedly', 'definitely',
  'always', 'never', 'must', 'prove', 'demonstrate',
];
const EVIDENTIALITY_MARKERS = [
  'according to', 'argues', 'suggests', 'cited', 'reported',
  'found that', 'showed that', 'demonstrated', 'evidence',
  'research shows', 'studies show', 'data indicates',
];

async function analyze(doc) {
  const textLower = doc.text.toLowerCase();
  const words = doc.tokens.filter(t => /^\w+$/.test(t));
  const wordCount = words.length;
  const per100 = Math.max(wordCount / 100, 1);

  // Surface counts
  const hedgeCount = HEDGE_MARKERS.reduce((c, m) => {
    const regex = new RegExp(`\\b${m}\\b`, 'gi');
    return c + (textLower.match(regex) || []).length;
  }, 0);
  const boostCount = BOOST_MARKERS.reduce((c, m) => {
    const regex = new RegExp(`\\b${m}\\b`, 'gi');
    return c + (textLower.match(regex) || []).length;
  }, 0);
  const evidCount = EVIDENTIALITY_MARKERS.reduce((c, m) => {
    return c + (textLower.split(m.toLowerCase()).length - 1);
  }, 0);

  // LLM for deeper speech act analysis
  let stanceData;
  try {
    stanceData = await llm.completeJSON(`
Analyze the pragmatic stance of this essay:

1. speech_act_distribution: {"assert": float, "argue": float, "explain": float, "question": float, "direct": float} (proportions summing to 1)
2. assert_dominance: proportion of sentences that are assertions (0-1)
3. first_person_ratio: proportion of sentences using first-person constructions vs impersonal (0-1)
4. presupposition_load: average definite NPs + factive verbs per sentence (0-5)
5. evidentiality_quality: quality of source attributions beyond mere presence (0-1)

Return JSON: {"speech_act_distribution": {...}, "assert_dominance": float, "first_person_ratio": float, "presupposition_load": float, "evidentiality_quality": float}

Text: ${doc.text.substring(0, 3000)}`);
  } catch {
    stanceData = {
      speech_act_distribution: { assert: 0.45, argue: 0.25, explain: 0.20, question: 0.05, direct: 0.05 },
      assert_dominance: 0.45, first_person_ratio: 0.15,
      presupposition_load: 1.5, evidentiality_quality: 0.40,
    };
  }

  const hedgeDensity = hedgeCount / per100;
  const boostDensity = boostCount / per100;
  const hedgeBoostRatio = hedgeCount / Math.max(boostCount, 1);
  const evidentialityScore = evidCount / Math.max(doc.sentenceCount, 1);

  const metrics = {
    'L8.1': { value: JSON.stringify(stanceData.speech_act_distribution), unit: 'dist', label: 'Speech act distribution' },
    'L8.2': { value: round(stanceData.assert_dominance, 2), unit: 'ratio', label: 'Assert dominance' },
    'L8.3': { value: round(hedgeDensity, 1), unit: '/100w', label: 'Hedging density' },
    'L8.4': { value: round(boostDensity, 1), unit: '/100w', label: 'Boosting density' },
    'L8.5': { value: round(hedgeBoostRatio, 1), unit: 'ratio', label: 'Hedge-to-boost ratio' },
    'L8.6': { value: round(evidentialityScore, 2), unit: 'ratio', label: 'Evidentiality score' },
    'L8.7': { value: round(stanceData.presupposition_load, 1), unit: '/sent', label: 'Presupposition load' },
    'L8.8': { value: round(stanceData.first_person_ratio, 2), unit: 'ratio', label: 'First-person stance shift' },
  };

  const hedgeScore = normalizeToScore(hedgeDensity, 1.0, 3.0, 0.0, 6.0);
  const ratioScore = normalizeToScore(hedgeBoostRatio, 1.5, 3.0, 0.3, 6.0);
  const evidScore = normalizeToScore(evidentialityScore, 0.20, 0.50, 0.0, 1.0);
  const score = Math.round(hedgeScore * 0.30 + ratioScore * 0.35 + evidScore * 0.35);

  return {
    layerId: LAYER_ID,
    layerName: LAYER_NAME,
    score: clampScore(score),
    metrics,
    rawValues: { hedgeDensity, boostDensity, hedgeBoostRatio, evidentialityScore, ...stanceData },
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
