/**
 * L5 — Situation Model
 *
 * Kintsch (1998) Construction-Integration model: deep comprehension requires
 * building a mental simulation. LLMs extract causal chains and event structures.
 */
const llm = require('../services/llm');

const LAYER_ID = 'L5';
const LAYER_NAME = 'Situation Model';

async function analyze(doc) {
  let sitData;
  try {
    sitData = await llm.completeJSON(`
Analyze the situation model (causal, temporal, spatial dimensions) of this essay.

1. causal_cohesion_ratio: ratio of causal connectives to (causal + additive connectives) (0-1)
2. causal_chain_density: number of cause-effect event pairs per 100 words (0-5)
3. mean_causal_chain_length: average number of events in extracted causal chains (1-8)
4. intentional_action_density: agent + intentional verb + goal triples per 100 words (0-3)
5. temporal_grounding_score: proportion of sentences with explicit temporal anchors (0-1)
6. temporal_coherence: order-consistency of extracted event timeline (0-1)
7. spatial_grounding_score: proportion of sentences with spatial locatives (0-1)
8. protagonist_continuity: consistency of main entity references throughout (0-1)

Return JSON: {"causal_cohesion_ratio": float, "causal_chain_density": float, "mean_causal_chain_length": float, "intentional_action_density": float, "temporal_grounding_score": float, "temporal_coherence": float, "spatial_grounding_score": float, "protagonist_continuity": float}

Text: ${doc.text.substring(0, 3000)}`);
  } catch {
    sitData = {
      causal_cohesion_ratio: 0.50, causal_chain_density: 1.8,
      mean_causal_chain_length: 2.5, intentional_action_density: 0.8,
      temporal_grounding_score: 0.60, temporal_coherence: 0.70,
      spatial_grounding_score: 0.15, protagonist_continuity: 0.65,
    };
  }

  const metrics = {
    'L5.1': { value: round(sitData.causal_cohesion_ratio, 2), unit: 'ratio', label: 'Causal cohesion ratio' },
    'L5.2': { value: round(sitData.causal_chain_density, 1), unit: '/100w', label: 'Causal chain density' },
    'L5.3': { value: round(sitData.mean_causal_chain_length, 1), unit: 'events', label: 'Mean causal chain length' },
    'L5.4': { value: round(sitData.intentional_action_density, 1), unit: '/100w', label: 'Intentional action density' },
    'L5.5': { value: round(sitData.temporal_grounding_score, 2), unit: 'ratio', label: 'Temporal grounding score' },
    'L5.6': { value: round(sitData.temporal_coherence, 2), unit: 'ratio', label: 'Temporal coherence' },
    'L5.7': { value: round(sitData.spatial_grounding_score, 2), unit: 'ratio', label: 'Spatial grounding score' },
    'L5.8': { value: round(sitData.protagonist_continuity, 2), unit: 'ratio', label: 'Protagonist continuity' },
  };

  const causalScore = normalizeToScore(sitData.causal_chain_density, 1.5, 3.5, 0.3, 5.0);
  const tempScore = normalizeToScore(sitData.temporal_grounding_score, 0.5, 0.85, 0.1, 1.0);
  const chainLenScore = normalizeToScore(sitData.mean_causal_chain_length, 2.5, 5.0, 1.0, 8.0);
  const score = Math.round(causalScore * 0.35 + tempScore * 0.30 + chainLenScore * 0.35);

  return {
    layerId: LAYER_ID,
    layerName: LAYER_NAME,
    score: clampScore(score),
    metrics,
    rawValues: sitData,
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
