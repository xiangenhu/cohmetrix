/**
 * Analysis Pipeline Orchestrator
 *
 * Runs all 11 layers in optimal order (L0-L9 can run in parallel groups,
 * L10 depends on all others). Emits progress events via callback.
 */
const { layers, layerMap } = require('../layers');
const { parseDocument } = require('../utils/nlp');
const config = require('../config');
const llm = require('./llm');

// Layer execution groups for parallel processing
// Group 1: NLP-only layers (fast)
// Group 2: LLM-dependent layers (parallel API calls)
// Group 3: L10 depends on all others
const EXECUTION_PLAN = [
  { group: 1, layerIds: ['L0'] },                        // fast, no LLM
  { group: 2, layerIds: ['L1', 'L2', 'L3', 'L4'] },     // mixed NLP + LLM
  { group: 3, layerIds: ['L5', 'L6', 'L7', 'L8', 'L9'] }, // LLM-heavy
  { group: 4, layerIds: ['L10'] },                         // depends on all
];

/**
 * Run full analysis pipeline.
 * @param {string} text - Essay text
 * @param {object} options - { promptText, learnerId, enabledLayers, onProgress }
 * @returns {object} Full analysis result
 */
async function runAnalysis(text, options = {}) {
  const {
    promptText = '',
    learnerId = '',
    enabledLayers = ['L0', 'L1', 'L2', 'L3', 'L4', 'L5', 'L6', 'L7', 'L8', 'L9', 'L10'],
    onProgress = () => {},
  } = options;

  const startTime = Date.now();
  onProgress({ type: 'init', message: 'Initializing NLP pipeline…' });

  // Parse document
  const doc = parseDocument(text);
  onProgress({ type: 'log', message: `Tokenized ${doc.wordCount} tokens, ${doc.sentenceCount} sentences` });

  const layerResults = {};
  const layerTimings = {};

  // Execute layers by group
  for (const group of EXECUTION_PLAN) {
    const groupLayers = group.layerIds.filter(id => enabledLayers.includes(id));
    if (groupLayers.length === 0) continue;

    // Run all layers in this group in parallel
    const promises = groupLayers.map(async (layerId) => {
      const layer = layerMap[layerId];
      if (!layer) return;

      const layerStart = Date.now();
      onProgress({
        type: 'layer_start',
        layerId,
        layerName: layer.LAYER_NAME,
        message: `Analyzing ${layer.LAYER_NAME}…`,
      });

      try {
        let result;
        if (layerId === 'L4') {
          result = await layer.analyze(doc, { promptText });
        } else if (layerId === 'L10') {
          result = await layer.analyze(doc, {
            layerResults,
            learnerProfile: learnerId ? { vocabLevel: 'B2', syntacticFluency: 0.65, domainExpertise: 'Intermediate', courseLevel: 'undergraduate' } : undefined,
          });
        } else {
          result = await layer.analyze(doc);
        }

        const elapsed = Date.now() - layerStart;
        layerTimings[layerId] = elapsed;
        layerResults[layerId] = result;

        onProgress({
          type: 'layer_done',
          layerId,
          layerName: layer.LAYER_NAME,
          score: result.score,
          elapsed,
          message: `${layer.LAYER_NAME} complete (${(elapsed / 1000).toFixed(1)}s)`,
        });
      } catch (err) {
        console.error(`[Pipeline] Layer ${layerId} failed:`, err.message);
        layerTimings[layerId] = Date.now() - layerStart;
        onProgress({
          type: 'layer_error',
          layerId,
          message: `${layer.LAYER_NAME} failed: ${err.message}`,
        });
      }
    });

    await Promise.all(promises);
  }

  // Compute composite scores (PCA analog: F1-F6)
  const compositeScores = computeCompositeScores(layerResults);

  // Compute overall score
  const overallScore = computeOverallScore(compositeScores);

  // Generate feedback via LLM
  let feedback = [];
  try {
    feedback = await generateFeedback(layerResults, doc);
  } catch (err) {
    console.error('[Pipeline] Feedback generation failed:', err.message);
  }

  const totalTime = (Date.now() - startTime) / 1000;
  onProgress({
    type: 'complete',
    message: `Analysis complete · ${totalTime.toFixed(1)}s total`,
  });

  return {
    id: null, // assigned by caller
    timestamp: new Date().toISOString(),
    analysisTime: totalTime,
    document: {
      wordCount: doc.wordCount,
      sentenceCount: doc.sentenceCount,
      paragraphCount: doc.paragraphCount,
      text: doc.text,
      promptText,
    },
    layers: Object.values(layerResults),
    compositeScores,
    overallScore,
    feedback,
    readerProfile: layerResults.L10?.readerProfile || null,
    layerTimings,
  };
}

/**
 * Composite score dimensions (analogous to Coh-Metrix PC1-PC5).
 */
function computeCompositeScores(results) {
  const get = (id) => results[id]?.score || 50;

  return {
    F1_Narrativity: {
      label: 'F1 Narrativity',
      score: Math.round(get('L9') * 0.4 + get('L5') * 0.35 + get('L3') * 0.25),
      primaryMetrics: ['L9.1', 'L5.1', 'L3.1'],
    },
    F2_Syntax: {
      label: 'F2 Syntax',
      score: Math.round(get('L2') * 0.5 + get('L0') * 0.3 + get('L2') * 0.2),
      primaryMetrics: ['L2.1', 'L2.4', 'L2.6'],
    },
    F3_Lexical: {
      label: 'F3 Lexical',
      score: Math.round(get('L1') * 0.6 + get('L0') * 0.4),
      primaryMetrics: ['L1.1', 'L1.3', 'L1.5'],
    },
    F4_DeepCohesion: {
      label: 'F4 Deep cohesion',
      score: Math.round(get('L4') * 0.4 + get('L5') * 0.3 + get('L6') * 0.3),
      primaryMetrics: ['L4.1', 'L5.2', 'L6.4'],
    },
    F5_Argument: {
      label: 'F5 Argument',
      score: Math.round(get('L7') * 0.5 + get('L6') * 0.3 + get('L7') * 0.2),
      primaryMetrics: ['L7.2', 'L7.3', 'L6.5'],
    },
    F6_Stance: {
      label: 'F6 Stance',
      score: Math.round(get('L8') * 0.6 + get('L8') * 0.4),
      primaryMetrics: ['L8.3', 'L8.6', 'L8.5'],
    },
  };
}

/**
 * Weighted overall cohesion score 0-100.
 */
function computeOverallScore(compositeScores) {
  const w = config.weights;
  return Math.round(
    compositeScores.F1_Narrativity.score * w.f1Narrativity +
    compositeScores.F2_Syntax.score * w.f2Syntax +
    compositeScores.F3_Lexical.score * w.f3Lexical +
    compositeScores.F4_DeepCohesion.score * w.f4DeepCohesion +
    compositeScores.F5_Argument.score * w.f5Argument +
    compositeScores.F6_Stance.score * w.f6Stance
  );
}

/**
 * Generate 3-point actionable feedback via LLM.
 */
async function generateFeedback(layerResults, doc) {
  const get = (layer, metric) => {
    const r = layerResults[layer];
    return r?.metrics?.[metric]?.value ?? 'N/A';
  };

  const prompt = `You are an expert writing tutor. A student submitted an essay. You have access to detailed cohesion analysis scores:

  Lexical Sophistication (L1): surprisal=${get('L1', 'L1.1')} bits, AWL density=${get('L1', 'L1.5')}
  Syntactic Complexity (L2): MDD=${get('L2', 'L2.1')}, subordination ratio=${get('L2', 'L2.4')}
  Semantic Cohesion (L4): local overlap=${get('L4', 'L4.1')}, topic drift=${get('L4', 'L4.4')}
  Argument Quality (L7): premises/claim=${get('L7', 'L7.2')}, unsupported=${get('L7', 'L7.7')}
  Hedging (L8): hedge density=${get('L8', 'L8.3')}/100w, evidentiality=${get('L8', 'L8.6')}

Write 3 specific, actionable feedback points. Do NOT mention metric names or numbers. Focus on: (1) highest-need area, (2) argumentation strength/gap, (3) one strength to maintain.

Return JSON array: [{"point": "feedback text here"}, ...]`;

  try {
    const result = await llm.completeJSON(prompt);
    return Array.isArray(result) ? result.map(r => r.point || r.text || JSON.stringify(r)) : [];
  } catch {
    return [
      'Consider strengthening your argument by providing more specific evidence for each claim.',
      'Your vocabulary and writing style are well-suited for academic discourse — maintain this level.',
      'Check for topic coherence between paragraphs, especially in the middle section of your essay.',
    ];
  }
}

module.exports = { runAnalysis };
