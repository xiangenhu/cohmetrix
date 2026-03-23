const winkNLP = require('wink-nlp');
const model = require('wink-eng-lite-web-model');
const nlp = winkNLP(model);
const its = nlp.its;
const as = nlp.as;

/**
 * Parse text into a structured document with sentences, tokens, entities.
 */
function parseDocument(text) {
  const doc = nlp.readDoc(text);
  const sentences = doc.sentences().out();
  const tokens = doc.tokens().out();
  const tokenDetails = doc.tokens().out(its.type).map((type, i) => ({
    text: tokens[i],
    type,
    pos: doc.tokens().itemAt(i).out(its.pos),
    lemma: doc.tokens().itemAt(i).out(its.lemma) || tokens[i].toLowerCase(),
  }));

  const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim().length > 0);

  return {
    text,
    sentences,
    tokens,
    tokenDetails,
    paragraphs,
    wordCount: tokens.filter(t => /\w/.test(t)).length,
    sentenceCount: sentences.length,
    paragraphCount: paragraphs.length,
  };
}

/**
 * Split text into sentences.
 */
function sentenceTokenize(text) {
  const doc = nlp.readDoc(text);
  return doc.sentences().out();
}

/**
 * Get word tokens (no punctuation).
 */
function wordTokenize(text) {
  const doc = nlp.readDoc(text);
  return doc.tokens().filter(t => t.out(its.type) === 'word').out();
}

/**
 * Compute cosine similarity between two arrays.
 */
function cosineSimilarity(a, b) {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0, magA = 0, magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  magA = Math.sqrt(magA);
  magB = Math.sqrt(magB);
  return magA && magB ? dot / (magA * magB) : 0;
}

/**
 * Simple statistics helpers.
 */
function mean(arr) {
  if (!arr.length) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function stdev(arr) {
  if (arr.length < 2) return 0;
  const m = mean(arr);
  const variance = arr.reduce((sum, x) => sum + (x - m) ** 2, 0) / (arr.length - 1);
  return Math.sqrt(variance);
}

function median(arr) {
  if (!arr.length) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function skewness(arr) {
  if (arr.length < 3) return 0;
  const n = arr.length;
  const m = mean(arr);
  const s = stdev(arr);
  if (s === 0) return 0;
  const m3 = arr.reduce((sum, x) => sum + ((x - m) / s) ** 3, 0) / n;
  return (n * m3) / ((n - 1) * (n - 2) / n) || m3;
}

function kurtosis(arr) {
  if (arr.length < 4) return 0;
  const n = arr.length;
  const m = mean(arr);
  const s = stdev(arr);
  if (s === 0) return 0;
  const m4 = arr.reduce((sum, x) => sum + ((x - m) / s) ** 4, 0) / n;
  return m4 - 3; // excess kurtosis
}

/**
 * Compute full descriptive statistics for an array of numbers.
 * Returns null if array is empty.
 */
function descriptiveStats(arr, decimals = 2) {
  if (!arr || !arr.length) return null;
  const sorted = [...arr].sort((a, b) => a - b);
  const r = (v) => { const f = 10 ** decimals; return Math.round(v * f) / f; };
  const q1Idx = Math.floor(sorted.length * 0.25);
  const q3Idx = Math.floor(sorted.length * 0.75);
  return {
    n: arr.length,
    mean: r(mean(arr)),
    sd: r(stdev(arr)),
    min: r(sorted[0]),
    max: r(sorted[sorted.length - 1]),
    median: r(median(arr)),
    q1: r(sorted[q1Idx]),
    q3: r(sorted[q3Idx]),
    skewness: r(skewness(arr)),
    kurtosis: r(kurtosis(arr)),
  };
}

function shannonEntropy(counts) {
  const total = counts.reduce((a, b) => a + b, 0);
  if (total === 0) return 0;
  return -counts
    .filter(c => c > 0)
    .reduce((sum, c) => sum + (c / total) * Math.log2(c / total), 0);
}

module.exports = {
  nlp, its, as,
  parseDocument,
  sentenceTokenize,
  wordTokenize,
  cosineSimilarity,
  mean, stdev, median, skewness, kurtosis,
  descriptiveStats, shannonEntropy,
};
