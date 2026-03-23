/**
 * L5 — Connective & Deep Cohesion
 *
 * Connectives are the explicit "glue" of the textbase (Halliday & Hasan, 1976).
 * They signal causal, temporal, adversative, additive, and logical relations
 * between ideas, reducing the reader's inferential burden.
 *
 * Scientific basis:
 * - Halliday & Hasan (1976): cohesion taxonomy
 * - Graesser et al. (2011): connective incidence as difficulty predictor
 * - Coh-Metrix CNC indices (9 connective measures)
 */
const { mean } = require('../utils/nlp');

const LAYER_ID = 'L5';
const LAYER_NAME = 'Connective & Deep Cohesion';

// ── Connective word lists (from Coh-Metrix CNC categories) ────────────────

const CAUSAL_CONNECTIVES = new Set([
  'because', 'therefore', 'thus', 'consequently', 'hence', 'so',
  'since', 'as a result', 'due to', 'owing to', 'for this reason',
  'accordingly', 'thereby', 'leads to', 'causes', 'results in',
]);

const TEMPORAL_CONNECTIVES = new Set([
  'before', 'after', 'then', 'meanwhile', 'subsequently', 'previously',
  'next', 'finally', 'first', 'second', 'third', 'later', 'earlier',
  'eventually', 'simultaneously', 'during', 'while', 'until', 'when',
  'once', 'whenever', 'thereafter', 'henceforth',
]);

const ADVERSATIVE_CONNECTIVES = new Set([
  'however', 'although', 'nevertheless', 'whereas', 'despite',
  'but', 'yet', 'though', 'nonetheless', 'on the other hand',
  'in contrast', 'conversely', 'instead', 'rather', 'still',
  'notwithstanding', 'even though', 'on the contrary',
]);

const ADDITIVE_CONNECTIVES = new Set([
  'and', 'also', 'moreover', 'furthermore', 'in addition',
  'additionally', 'besides', 'likewise', 'similarly', 'equally',
  'too', 'as well', 'what is more', 'not only',
]);

const LOGICAL_CONNECTIVES = new Set([
  'if', 'unless', 'provided', 'assuming', 'or', 'either',
  'neither', 'whether', 'in case', 'so that', 'in order to',
  'such that', 'given that',
]);

// Positive = causal + additive + temporal (forward-building)
// Negative = adversative + negative logical
const POSITIVE_TYPES = ['causal', 'additive', 'temporal'];
const NEGATIVE_TYPES = ['adversative'];

/**
 * Count connective occurrences in text.
 * Handles both single-word and multi-word connectives.
 */
function countConnectives(textLower, connSet) {
  let count = 0;
  for (const conn of connSet) {
    if (conn.includes(' ')) {
      // Multi-word: count substring occurrences
      let idx = 0;
      while ((idx = textLower.indexOf(conn, idx)) !== -1) {
        count++;
        idx += conn.length;
      }
    } else {
      // Single-word: use word boundary matching
      const regex = new RegExp(`\\b${conn}\\b`, 'g');
      const matches = textLower.match(regex);
      if (matches) count += matches.length;
    }
  }
  return count;
}

async function analyze(doc) {
  const textLower = doc.text.toLowerCase();
  const words = doc.tokens.filter(t => /^\w+$/.test(t));
  const wordCount = Math.max(words.length, 1);
  const per1000 = wordCount / 1000;

  // Count connectives by type
  const causalCount = countConnectives(textLower, CAUSAL_CONNECTIVES);
  const temporalCount = countConnectives(textLower, TEMPORAL_CONNECTIVES);
  const adversativeCount = countConnectives(textLower, ADVERSATIVE_CONNECTIVES);
  const additiveCount = countConnectives(textLower, ADDITIVE_CONNECTIVES);
  const logicalCount = countConnectives(textLower, LOGICAL_CONNECTIVES);

  const totalCount = causalCount + temporalCount + adversativeCount + additiveCount + logicalCount;

  // Incidence rates per 1000 words
  const allIncidence = totalCount / per1000;
  const causalIncidence = causalCount / per1000;
  const temporalIncidence = temporalCount / per1000;
  const adversativeIncidence = adversativeCount / per1000;
  const additiveIncidence = additiveCount / per1000;

  // Causal cohesion ratio: causal / (causal + additive)
  const causalCohesionRatio = (causalCount + additiveCount) > 0
    ? causalCount / (causalCount + additiveCount)
    : 0;

  // Logical connective density per 1000
  const logicalDensity = logicalCount / per1000;

  // Positive vs. negative connective ratios
  const positiveCount = causalCount + additiveCount + temporalCount;
  const negativeCount = adversativeCount;
  const positiveRatio = totalCount > 0 ? positiveCount / totalCount : 0.5;
  const negativeRatio = totalCount > 0 ? negativeCount / totalCount : 0.5;

  const metrics = {
    'L5.1': { value: round(allIncidence, 1),           unit: '/1000w', label: 'All connectives incidence' },
    'L5.2': { value: round(causalIncidence, 1),         unit: '/1000w', label: 'Causal connectives' },
    'L5.3': { value: round(temporalIncidence, 1),       unit: '/1000w', label: 'Temporal connectives' },
    'L5.4': { value: round(adversativeIncidence, 1),    unit: '/1000w', label: 'Adversative connectives' },
    'L5.5': { value: round(additiveIncidence, 1),       unit: '/1000w', label: 'Additive connectives' },
    'L5.6': { value: round(causalCohesionRatio, 2),     unit: 'ratio',  label: 'Causal cohesion ratio' },
    'L5.7': { value: round(logicalDensity, 1),          unit: '/1000w', label: 'Logical connective density' },
    'L5.8': { value: round(positiveRatio, 2),           unit: 'ratio',  label: 'Positive connective ratio' },
    'L5.9': { value: round(negativeRatio, 2),           unit: 'ratio',  label: 'Negative connective ratio' },
  };

  // Score: balance of connective types, appropriate density, causal reasoning
  const densityScore = normalizeToScore(allIncidence, 60, 100, 20, 160);
  const causalScore = normalizeToScore(causalCohesionRatio, 0.30, 0.55, 0.05, 0.80);
  const adversativeScore = normalizeToScore(adversativeIncidence, 8, 20, 0, 40);
  const logicalScore = normalizeToScore(logicalDensity, 10, 25, 0, 50);
  const score = Math.round(
    densityScore * 0.25 +
    causalScore * 0.30 +
    adversativeScore * 0.25 +
    logicalScore * 0.20
  );

  return {
    layerId: LAYER_ID,
    layerName: LAYER_NAME,
    score: clampScore(score),
    metrics,
    rawValues: {
      totalCount, causalCount, temporalCount, adversativeCount,
      additiveCount, logicalCount, causalCohesionRatio,
      positiveRatio, negativeRatio,
    },
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
