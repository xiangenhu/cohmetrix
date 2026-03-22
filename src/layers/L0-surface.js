/**
 * L0 — Surface & Structural
 *
 * Theoretical basis: Surface metrics as confound controls and normalization
 * denominators. MATTR preferred over raw TTR for length-invariant diversity.
 */
const { mean, stdev } = require('../utils/nlp');

const LAYER_ID = 'L0';
const LAYER_NAME = 'Surface & Structural';

/**
 * Compute MATTR (Moving-Average Type-Token Ratio) with window size W.
 */
function computeMATTR(words, window = 50) {
  if (words.length <= window) {
    const unique = new Set(words.map(w => w.toLowerCase()));
    return unique.size / words.length;
  }
  const ratios = [];
  for (let i = 0; i <= words.length - window; i++) {
    const windowWords = words.slice(i, i + window).map(w => w.toLowerCase());
    const unique = new Set(windowWords);
    ratios.push(unique.size / window);
  }
  return mean(ratios);
}

/**
 * Compute intro/body/conclusion ratio.
 */
function introBodyConclusionRatio(paragraphs) {
  if (paragraphs.length < 3) return { intro: 0.33, body: 0.34, conclusion: 0.33 };
  const totalLen = paragraphs.reduce((s, p) => s + p.length, 0);
  const intro = paragraphs[0].length / totalLen;
  const conclusion = paragraphs[paragraphs.length - 1].length / totalLen;
  return { intro, body: 1 - intro - conclusion, conclusion };
}

async function analyze(doc) {
  const words = doc.tokens.filter(t => /^\w+$/.test(t));
  const sentLengths = doc.sentences.map(s => s.split(/\s+/).filter(w => w.length > 0).length);
  const msl = mean(sentLengths);
  const mslSD = stdev(sentLengths);
  const ttr = new Set(words.map(w => w.toLowerCase())).size / Math.max(words.length, 1);
  const mattr = computeMATTR(words);
  const meanParaLen = doc.sentenceCount / Math.max(doc.paragraphCount, 1);
  const ibcRatio = introBodyConclusionRatio(doc.paragraphs);

  const metrics = {
    'L0.1': { value: doc.wordCount, unit: 'tokens', label: 'Token count' },
    'L0.2': { value: doc.sentenceCount, unit: 'sents', label: 'Sentence count' },
    'L0.3': { value: doc.paragraphCount, unit: 'paras', label: 'Paragraph count' },
    'L0.4': { value: round(msl, 1), unit: 'tokens', label: 'Mean sentence length' },
    'L0.5': { value: round(mslSD, 1), unit: 'SD', label: 'Sentence length variance' },
    'L0.6': { value: round(ttr, 2), unit: 'TTR', label: 'Type-Token Ratio' },
    'L0.7': { value: round(mattr, 2), unit: 'MATTR', label: 'Moving-avg type-token ratio' },
    'L0.8': { value: round(meanParaLen, 1), unit: 'sents', label: 'Mean paragraph length' },
    'L0.9': { value: `${round(ibcRatio.intro * 100)}/${round(ibcRatio.body * 100)}/${round(ibcRatio.conclusion * 100)}`, unit: '%', label: 'Intro/body/conclusion ratio' },
  };

  // Score: weighted combination of normalized metrics
  const mslScore = normalizeToScore(msl, 15, 25, 10, 35);
  const mattrScore = normalizeToScore(mattr, 0.5, 0.7, 0.3, 0.9);
  const varScore = normalizeToScore(mslSD, 5, 10, 2, 20);
  const paraScore = normalizeToScore(meanParaLen, 4, 8, 2, 15);
  const score = Math.round(mslScore * 0.3 + mattrScore * 0.3 + varScore * 0.2 + paraScore * 0.2);

  return {
    layerId: LAYER_ID,
    layerName: LAYER_NAME,
    score: clampScore(score),
    metrics,
    rawValues: {
      msl, mslSD, ttr, mattr, meanParaLen,
      wordCount: doc.wordCount,
      sentenceCount: doc.sentenceCount,
      paragraphCount: doc.paragraphCount,
    },
  };
}

function normalizeToScore(value, idealMin, idealMax, absMin, absMax) {
  if (value >= idealMin && value <= idealMax) return 85 + 15 * (1 - Math.abs(value - (idealMin + idealMax) / 2) / ((idealMax - idealMin) / 2));
  if (value < idealMin) return Math.max(20, 85 * (value - absMin) / (idealMin - absMin));
  return Math.max(20, 85 * (absMax - value) / (absMax - idealMax));
}

function clampScore(s) { return Math.max(0, Math.min(100, s)); }
function round(n, d = 0) { const f = 10 ** d; return Math.round(n * f) / f; }

module.exports = { analyze, LAYER_ID, LAYER_NAME };
