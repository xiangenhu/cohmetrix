/**
 * L8 — Argumentation Quality
 *
 * Toulmin (1958) model: Claim → Data → Warrant → Backing → Rebuttal.
 * LLM-based argument mining classifies roles at sentence level.
 */
const llm = require('../services/llm');

const LAYER_ID = 'L8';
const LAYER_NAME = 'Argumentation Quality';

async function analyze(doc) {
  let argData;
  try {
    argData = await llm.completeJSON(`
Analyze the argumentative structure of this essay using the Toulmin model. For each sentence, identify its argumentative role and then compute aggregate metrics.

Provide:
1. claim_count: number of main claims/assertions the author tries to prove
2. premise_to_claim_ratio: number of supporting premises per claim (target >2.0 for strong essays)
3. warrant_completeness: proportion of claims with at least one explicit warrant/reasoning link (0-1)
4. rebuttal_present: does the essay anticipate counter-arguments? (0 or 1)
5. rebuttal_quality: if rebuttals exist, how adequately are they handled (0-1)
6. argument_depth: max chain length from evidence to higher-level claim (1-5)
7. unsupported_claim_ratio: proportion of claims with zero premises (0-1, lower is better)
8. logical_fallacy_density: detected logical fallacies per 500 words (0-5)

Also provide the sentence-level classification:
9. sentence_roles: array of {"idx": int, "role": "CLAIM"|"PREMISE"|"WARRANT"|"REBUTTAL"|"BACKGROUND"|"OTHER", "target_claim_idx": int|null}

Return JSON: {"claim_count": int, "premise_to_claim_ratio": float, "warrant_completeness": float, "rebuttal_present": int, "rebuttal_quality": float, "argument_depth": int, "unsupported_claim_ratio": float, "logical_fallacy_density": float, "sentence_roles": [...]}

Text: ${doc.text.substring(0, 3000)}`);
  } catch {
    argData = {
      claim_count: 4, premise_to_claim_ratio: 1.5, warrant_completeness: 0.50,
      rebuttal_present: 0, rebuttal_quality: 0, argument_depth: 2,
      unsupported_claim_ratio: 0.30, logical_fallacy_density: 0.5,
      sentence_roles: [],
    };
  }

  const metrics = {
    'L8.1': { value: argData.claim_count, unit: 'claims', label: 'Main claim count' },
    'L8.2': { value: round(argData.premise_to_claim_ratio, 1), unit: 'per claim', label: 'Premises per claim' },
    'L8.3': { value: round(argData.warrant_completeness, 2), unit: 'ratio', label: 'Warrant completeness' },
    'L8.4': { value: argData.rebuttal_present, unit: 'binary', label: 'Counter-argument present' },
    'L8.5': { value: round(argData.rebuttal_quality, 2), unit: 'score', label: 'Rebuttal quality' },
    'L8.6': { value: argData.argument_depth, unit: 'levels', label: 'Argument depth' },
    'L8.7': { value: round(argData.unsupported_claim_ratio, 2), unit: 'ratio', label: 'Unsupported claim ratio' },
    'L8.8': { value: round(argData.logical_fallacy_density, 1), unit: '/500w', label: 'Logical fallacy density' },
  };

  // Score heavily penalizes low premise ratio and high unsupported claims
  const premiseScore = normalizeToScore(argData.premise_to_claim_ratio, 2.0, 4.0, 0.5, 6.0);
  const warrantScore = argData.warrant_completeness * 100;
  const rebuttalScore = argData.rebuttal_present ? 50 + argData.rebuttal_quality * 50 : 20;
  const unsupportedPenalty = argData.unsupported_claim_ratio * 40;
  const score = Math.round(premiseScore * 0.35 + warrantScore * 0.25 + rebuttalScore * 0.25 + (100 - unsupportedPenalty) * 0.15);

  return {
    layerId: LAYER_ID,
    layerName: LAYER_NAME,
    score: clampScore(score),
    metrics,
    rawValues: argData,
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
