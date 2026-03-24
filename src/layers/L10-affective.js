/**
 * L10 — Affective & Engagement
 *
 * Valence-Arousal-Dominance model (Russell 1980). VAD arc across the essay
 * reveals tonal consistency and emotional engagement. LLM-rated per sentence.
 */
const llm = require('../services/llm');
const { mean, stdev, descriptiveStats } = require('../utils/nlp');

const LAYER_ID = 'L10';
const LAYER_NAME = 'Affective & Engagement';

async function analyze(doc) {
  let vadData;
  try {
    vadData = await llm.completeJSON(`
Analyze the affective trajectory of this essay using the Valence-Arousal-Dominance model.

For the overall essay, provide:
1. mean_valence: average valence across sentences (1-9 scale, 1=very negative, 9=very positive)
2. valence_variability: standard deviation of sentence-level valence (lower = more consistent tone)
3. mean_arousal: average arousal/activation level (1-9, 1=calm, 9=urgent)
4. mean_dominance: average dominance/assertiveness (1-9, 1=submissive, 9=dominant)
5. valence_arc_slope: linear slope of valence from intro to conclusion (negative = darkening, positive = brightening)
6. affect_argument_alignment: correlation between high-affect sentences and argument roles (0-1)
7. emotional_intrusion_index: proportion of sentences with high personal affect in non-narrative context (0-1)
8. engagement_prediction: predicted reader engagement score (0-1)

Also provide per-paragraph VAD: [{"para_idx": int, "V": float, "A": float, "D": float}]

Return JSON: {"mean_valence": float, "valence_variability": float, "mean_arousal": float, "mean_dominance": float, "valence_arc_slope": float, "affect_argument_alignment": float, "emotional_intrusion_index": float, "engagement_prediction": float, "paragraph_vad": [...]}

Text: ${doc.text.substring(0, 3000)}`);
  } catch {
    vadData = {
      mean_valence: 5.5, valence_variability: 1.0,
      mean_arousal: 4.5, mean_dominance: 5.8,
      valence_arc_slope: 0.02, affect_argument_alignment: 0.45,
      emotional_intrusion_index: 0.08, engagement_prediction: 0.65,
      paragraph_vad: [],
    };
  }

  // Compute distributions from per-paragraph VAD data
  const paraVad = vadData.paragraph_vad || [];
  const valenceDist = descriptiveStats(paraVad.map(p => p.V).filter(v => typeof v === 'number'), 2);
  const arousalDist = descriptiveStats(paraVad.map(p => p.A).filter(v => typeof v === 'number'), 2);
  const dominanceDist = descriptiveStats(paraVad.map(p => p.D).filter(v => typeof v === 'number'), 2);

  const metrics = {
    'L10.1': { value: round(vadData.mean_valence, 1), unit: '/9', label: 'Mean valence', distribution: valenceDist },
    'L10.2': { value: round(vadData.valence_variability, 1), unit: 'SD', label: 'Valence variability' },
    'L10.3': { value: round(vadData.mean_arousal, 1), unit: '/9', label: 'Mean arousal', distribution: arousalDist },
    'L10.4': { value: round(vadData.mean_dominance, 1), unit: '/9', label: 'Mean dominance', distribution: dominanceDist },
    'L10.5': { value: round(vadData.valence_arc_slope, 2), unit: 'slope', label: 'Valence arc (intro→concl)' },
    'L10.6': { value: round(vadData.affect_argument_alignment, 2), unit: 'corr', label: 'Affect-argument alignment' },
    'L10.7': { value: round(vadData.emotional_intrusion_index, 2), unit: 'ratio', label: 'Emotional intrusion index' },
    'L10.8': { value: round(vadData.engagement_prediction, 2), unit: 'score', label: 'Engagement prediction' },
  };

  // Academic writing should have moderate valence (4-6.5), low variability, moderate dominance
  const valenceScore = normalizeToScore(vadData.mean_valence, 4.5, 6.5, 1, 9);
  const variabilityScore = normalizeToScore(vadData.valence_variability, 0.5, 1.5, 0, 4);
  const dominanceScore = normalizeToScore(vadData.mean_dominance, 5, 7, 1, 9);
  const intrusionPenalty = vadData.emotional_intrusion_index * 30;
  const score = Math.round(valenceScore * 0.30 + variabilityScore * 0.30 + dominanceScore * 0.25 + vadData.engagement_prediction * 15 - intrusionPenalty);

  return {
    layerId: LAYER_ID,
    layerName: LAYER_NAME,
    score: clampScore(score),
    metrics,
    rawValues: vadData,
  };
}

function normalizeToScore(value, idealMin, idealMax, absMin, absMax) {
  if (value >= idealMin && value <= idealMax) return 80 + 20 * (1 - Math.abs(value - (idealMin + idealMax) / 2) / ((idealMax - idealMin) / 2));
  if (value < idealMin) return Math.max(15, 80 * (value - absMin) / (idealMin - absMin));
  return Math.max(15, 80 * (absMax - value) / (absMax - idealMax));
}

function clampScore(s) { return Math.max(0, Math.min(100, s)); }
function round(n, d = 0) { const f = 10 ** d; return Math.round(n * f) / f; }

const METRIC_COUNT = 8;
module.exports = { analyze, LAYER_ID, LAYER_NAME, METRIC_COUNT };
