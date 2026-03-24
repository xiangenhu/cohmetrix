/**
 * L2 — Syntactic Complexity
 *
 * Dependency Locality Theory (Gibson 2000): integration cost grows with
 * distance between dependent and head. UD provides cross-lingual representation.
 */
const llm = require('../services/llm');
const { mean, descriptiveStats } = require('../utils/nlp');

const LAYER_ID = 'L2';
const LAYER_NAME = 'Syntactic Complexity';

async function analyze(doc) {
  // Use LLM for syntactic analysis since we don't have spaCy in Node
  let syntaxData;
  try {
    syntaxData = await llm.completeJSON(`
Analyze the syntactic complexity of this text. Provide:
1. mean_dependency_distance: average distance between dependent and head words (typical range 2-5 tokens)
2. mdd_sd: standard deviation of dependency distances
3. mean_clause_depth: average depth of deepest embedded clause per sentence (1-5)
4. subordination_ratio: proportion of subordinate clauses to total clauses (0-1)
5. passive_voice_ratio: proportion of passive constructions (0-1)
6. np_elaboration: mean number of modifiers per noun phrase (0-4)
7. left_branching_ratio: proportion of left-branching dependency arcs (0-1)

Also provide per-sentence estimates:
8. per_sentence_mdd: array of per-sentence mean dependency distances (one float per sentence)
9. per_sentence_clause_depth: array of per-sentence max clause depth values

Return JSON: {"mean_dependency_distance": float, "mdd_sd": float, "mean_clause_depth": float, "subordination_ratio": float, "passive_voice_ratio": float, "np_elaboration": float, "left_branching_ratio": float, "per_sentence_mdd": [float, ...], "per_sentence_clause_depth": [float, ...]}

Text: ${doc.text.substring(0, 3000)}`);
  } catch {
    syntaxData = {
      mean_dependency_distance: 3.0, mdd_sd: 1.5, mean_clause_depth: 2.0,
      subordination_ratio: 0.35, passive_voice_ratio: 0.10,
      np_elaboration: 1.5, left_branching_ratio: 0.25,
      per_sentence_mdd: [], per_sentence_clause_depth: [],
    };
  }

  const mddDist = descriptiveStats(syntaxData.per_sentence_mdd || [], 2);
  const depthDist = descriptiveStats(syntaxData.per_sentence_clause_depth || [], 2);

  const metrics = {
    'L2.1': { value: round(syntaxData.mean_dependency_distance, 2), unit: 'tokens', label: 'Mean dependency distance', distribution: mddDist },
    'L2.2': { value: round(syntaxData.mdd_sd, 2), unit: 'SD', label: 'MDD standard deviation' },
    'L2.3': { value: round(syntaxData.mean_clause_depth, 1), unit: 'levels', label: 'Mean clause depth', distribution: depthDist },
    'L2.4': { value: round(syntaxData.subordination_ratio, 2), unit: 'ratio', label: 'Subordination ratio' },
    'L2.5': { value: round(syntaxData.passive_voice_ratio, 2), unit: 'ratio', label: 'Passive voice ratio' },
    'L2.6': { value: round(syntaxData.np_elaboration, 1), unit: 'mods', label: 'NP elaboration (modifiers)' },
    'L2.7': { value: round(syntaxData.left_branching_ratio, 2), unit: 'ratio', label: 'Left-branching ratio' },
  };

  const mddScore = normalizeToScore(syntaxData.mean_dependency_distance, 2.5, 4.0, 1.5, 6.0);
  const subScore = normalizeToScore(syntaxData.subordination_ratio, 0.35, 0.55, 0.1, 0.8);
  const depthScore = normalizeToScore(syntaxData.mean_clause_depth, 1.5, 3.0, 1.0, 5.0);
  const score = Math.round(mddScore * 0.35 + subScore * 0.35 + depthScore * 0.30);

  return {
    layerId: LAYER_ID,
    layerName: LAYER_NAME,
    score: clampScore(score),
    metrics,
    rawValues: syntaxData,
  };
}

function normalizeToScore(value, idealMin, idealMax, absMin, absMax) {
  if (value >= idealMin && value <= idealMax) return 80 + 20 * (1 - Math.abs(value - (idealMin + idealMax) / 2) / ((idealMax - idealMin) / 2));
  if (value < idealMin) return Math.max(15, 80 * (value - absMin) / (idealMin - absMin));
  return Math.max(15, 80 * (absMax - value) / (absMax - idealMax));
}

function clampScore(s) { return Math.max(0, Math.min(100, s)); }
function round(n, d = 0) { const f = 10 ** d; return Math.round(n * f) / f; }

const METRIC_COUNT = 7;
module.exports = { analyze, LAYER_ID, LAYER_NAME, METRIC_COUNT };
