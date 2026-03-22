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
  mean, stdev, shannonEntropy,
};
