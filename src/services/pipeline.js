/**
 * Analysis Pipeline Orchestrator
 *
 * Runs all 12 layers in optimal order. L0-L10 run in parallel groups,
 * L11 (Reader-Adaptive) depends on all others. Emits progress events via callback.
 *
 * Execution groups:
 *   Group 1 — NLP-only (fast):          L0 (Surface), L5 (Connectives)
 *   Group 2 — Mixed NLP + LLM:          L1, L2, L3, L4
 *   Group 3 — LLM-heavy (parallel):     L6, L7, L8, L9, L10
 *   Group 4 — Meta (depends on all):    L11
 */
const { layers, layerMap } = require('../layers');
const { parseDocument } = require('../utils/nlp');
const config = require('../config');
const llm = require('./llm');
const { enrichWithEvidence } = require('./evidence');

// Layer execution groups for parallel processing
const EXECUTION_PLAN = [
  { group: 1, layerIds: ['L0', 'L5'] },                       // fast, NLP-only
  { group: 2, layerIds: ['L1', 'L2', 'L3', 'L4'] },          // mixed NLP + LLM
  { group: 3, layerIds: ['L6', 'L7', 'L8', 'L9', 'L10'] },   // LLM-heavy
  { group: 4, layerIds: ['L11'] },                              // depends on all
];

// All layer IDs for default enablement
const ALL_LAYER_IDS = ['L0', 'L1', 'L2', 'L3', 'L4', 'L5', 'L6', 'L7', 'L8', 'L9', 'L10', 'L11'];

/**
 * Run full analysis pipeline.
 * @param {string} text - Essay text
 * @param {object} options - { promptText, learnerId, genre, enabledLayers, onProgress }
 * @returns {object} Full analysis result
 */
async function runAnalysis(text, options = {}) {
  const {
    promptText = '',
    learnerId = '',
    genre = '',
    language = 'en',
    enabledLayers = ALL_LAYER_IDS,
    onProgress = () => {},
  } = options;

  const startTime = Date.now();
  const tokenTracker = llm.createTracker();
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
        } else if (layerId === 'L11') {
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

        const tokenSnapshot = tokenTracker.getSummary();
        onProgress({
          type: 'layer_done',
          layerId,
          layerName: layer.LAYER_NAME,
          score: result.score,
          elapsed,
          tokenUsage: tokenSnapshot,
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

  // Enrich with evidence excerpts and plain-language descriptions
  onProgress({ type: 'log', message: 'Generating evidence and plain-language descriptions…' });
  let enrichedLayers;
  try {
    enrichedLayers = await enrichWithEvidence(Object.values(layerResults), doc.text, null, language);
    // Update layerResults with enriched data
    enrichedLayers.forEach(l => { layerResults[l.layerId] = l; });
  } catch (err) {
    console.error('[Pipeline] Evidence enrichment failed:', err.message);
    enrichedLayers = Object.values(layerResults);
  }

  // Compute composite scores (PCA analog: F1-F8)
  const compositeScores = computeCompositeScores(layerResults);

  // Compute overall score
  const overallScore = computeOverallScore(compositeScores);

  // Generate feedback via LLM
  let feedback = [];
  try {
    feedback = await generateFeedback(layerResults, doc, language);
  } catch (err) {
    console.error('[Pipeline] Feedback generation failed:', err.message);
  }

  const totalTime = (Date.now() - startTime) / 1000;
  const tokenUsage = tokenTracker.getSummary();
  onProgress({
    type: 'log',
    message: `Analysis complete · ${totalTime.toFixed(1)}s total · ${tokenUsage.totalTokens.toLocaleString()} tokens`,
    tokenUsage,
  });

  return {
    id: null, // assigned by caller
    timestamp: new Date().toISOString(),
    analysisTime: totalTime,
    targetAudience: config.targetAudience,
    language,
    document: {
      wordCount: doc.wordCount,
      sentenceCount: doc.sentenceCount,
      paragraphCount: doc.paragraphCount,
      text: doc.text,
      promptText,
      genre,
    },
    tokenUsage,
    llmProvider: llm.getProviderInfo(),
    layers: enrichedLayers,
    compositeScores,
    overallScore,
    feedback,
    readerProfile: layerResults.L11?.readerProfile || null,
    layerTimings,
  };
}

/**
 * Composite score dimensions (analogous to Coh-Metrix PC1-PC5, extended to F1-F8).
 *
 * F1 Narrativity:         L10 (Affect) + L6 (Situation) + L3 (Referential)
 * F2 Syntactic Simplicity: L2 (Syntax) + L0 (Surface)
 * F3 Word Concreteness:   L1 (Lexical) + L0 (Surface)
 * F4 Referential Cohesion: L3 (Referential) + L4 (Semantic)
 * F5 Deep Cohesion:       L5 (Connective) + L6 (Situation) + L4 (Semantic)
 * F6 Argumentation:       L8 (Argumentation) + L7 (Rhetorical)
 * F7 Epistemic Calibration: L9 (Stance)
 * F8 Engagement & Affect: L10 (Affect) + L6 (Situation) + L3 (Referential)
 */
function computeCompositeScores(results) {
  const get = (id) => results[id]?.score || 50;

  return {
    F1_Narrativity: {
      label: 'F1 Narrativity',
      score: Math.round(get('L10') * 0.40 + get('L6') * 0.35 + get('L3') * 0.25),
      primaryMetrics: ['L10.1', 'L6.2', 'L3.1'],
    },
    F2_Syntax: {
      label: 'F2 Syntactic Simplicity',
      score: Math.round(get('L2') * 0.60 + get('L0') * 0.40),
      primaryMetrics: ['L2.1', 'L2.5', 'L0.5'],
    },
    F3_Lexical: {
      label: 'F3 Word Concreteness',
      score: Math.round(get('L1') * 0.60 + get('L0') * 0.40),
      primaryMetrics: ['L1.1', 'L1.4', 'L1.8'],
    },
    F4_ReferentialCohesion: {
      label: 'F4 Referential Cohesion',
      score: Math.round(get('L3') * 0.50 + get('L4') * 0.50),
      primaryMetrics: ['L3.1', 'L3.2', 'L4.1'],
    },
    F5_DeepCohesion: {
      label: 'F5 Deep Cohesion',
      score: Math.round(get('L5') * 0.40 + get('L6') * 0.30 + get('L4') * 0.30),
      primaryMetrics: ['L5.2', 'L5.6', 'L6.2'],
    },
    F6_Argument: {
      label: 'F6 Argumentation Quality',
      score: Math.round(get('L8') * 0.50 + get('L7') * 0.30 + get('L8') * 0.20),
      primaryMetrics: ['L8.2', 'L8.3', 'L7.5'],
    },
    F7_Stance: {
      label: 'F7 Epistemic Calibration',
      score: Math.round(get('L9') * 0.60 + get('L9') * 0.40),
      primaryMetrics: ['L9.3', 'L9.5', 'L9.6'],
    },
    F8_Engagement: {
      label: 'F8 Engagement & Affect',
      score: Math.round(get('L10') * 0.50 + get('L6') * 0.30 + get('L3') * 0.20),
      primaryMetrics: ['L10.8', 'L10.5', 'L6.5'],
    },
  };
}

/**
 * Weighted overall cohesion score 0-100.
 */
function computeOverallScore(compositeScores) {
  const w = config.weights;
  return Math.round(
    compositeScores.F1_Narrativity.score * (w.f1Narrativity || 0.10) +
    compositeScores.F2_Syntax.score * (w.f2Syntax || 0.10) +
    compositeScores.F3_Lexical.score * (w.f3Lexical || 0.10) +
    compositeScores.F4_ReferentialCohesion.score * (w.f4ReferentialCohesion || w.f4DeepCohesion || 0.15) +
    compositeScores.F5_DeepCohesion.score * (w.f5DeepCohesion || w.f4DeepCohesion || 0.15) +
    compositeScores.F6_Argument.score * (w.f6Argument || w.f5Argument || 0.20) +
    compositeScores.F7_Stance.score * (w.f7Stance || w.f6Stance || 0.10) +
    compositeScores.F8_Engagement.score * (w.f8Engagement || 0.10)
  );
}

/**
 * Generate 3-point actionable feedback via LLM.
 */
async function generateFeedback(layerResults, doc, language) {
  const get = (layer, metric) => {
    const r = layerResults[layer];
    return r?.metrics?.[metric]?.value ?? 'N/A';
  };

  const prompt = `You are an expert writing tutor. A student submitted an essay. You have access to detailed cohesion analysis scores:

  Lexical Sophistication (L1): surprisal=${get('L1', 'L1.1')} bits, AWL density=${get('L1', 'L1.8')}
  Syntactic Complexity (L2): MDD=${get('L2', 'L2.1')}, subordination ratio=${get('L2', 'L2.5')}
  Connective Cohesion (L5): causal connectives=${get('L5', 'L5.2')}/1000w, adversative=${get('L5', 'L5.4')}/1000w
  Semantic Cohesion (L4): local overlap=${get('L4', 'L4.1')}, topic drift=${get('L4', 'L4.6')}
  Argument Quality (L8): premises/claim=${get('L8', 'L8.2')}, unsupported=${get('L8', 'L8.7')}
  Pragmatic Stance (L9): hedge density=${get('L9', 'L9.3')}/100w, evidentiality=${get('L9', 'L9.6')}

Write 3 specific, actionable feedback points. Do NOT mention metric names or numbers. Focus on: (1) highest-need area, (2) argumentation strength/gap, (3) one strength to maintain.

Return JSON array: [{"point": "feedback text here"}, ...]`;

  try {
    const result = await llm.completeJSON(prompt, { language });
    return Array.isArray(result) ? result.map(r => r.point || r.text || JSON.stringify(r)) : [];
  } catch {
    return [
      'Consider strengthening your argument by providing more specific evidence for each claim.',
      'Your vocabulary and writing style are well-suited for academic discourse — maintain this level.',
      'Check for topic coherence between paragraphs, especially in the middle section of your essay.',
    ];
  }
}

/**
 * Return composite factor definitions (for landing page metadata).
 */
function getCompositeDefinitions() {
  return [
    { id: 'F1', label: 'Narrativity', layers: ['L10', 'L6', 'L3'],
      description: 'Measures how story-like and character-driven the text is. High narrativity means concrete events, characters with intentions, and emotional engagement. Based on Graesser et al. (2011) — narrative texts are easier to process because they mirror everyday experience.',
      scoring: '40% Affect (L10) + 35% Situation Model (L6) + 25% Referential Cohesion (L3)' },
    { id: 'F2', label: 'Syntactic Simplicity', layers: ['L2', 'L0'],
      description: 'Captures how accessible the grammar is. Higher scores mean shorter sentences, simpler dependency structures, and lower subordination — easier for readers to parse. Based on Dependency Locality Theory (Gibson, 2000).',
      scoring: '60% Syntactic Complexity (L2) + 40% Surface Metrics (L0)' },
    { id: 'F3', label: 'Word Concreteness', layers: ['L1', 'L0'],
      description: 'Measures vocabulary specificity and imageability. Concrete, familiar words are processed faster (dual-coding theory, Paivio 1986). High concreteness aids comprehension; low concreteness signals abstraction, common in academic prose.',
      scoring: '60% Lexical Sophistication (L1) + 40% Surface Metrics (L0)' },
    { id: 'F4', label: 'Referential Cohesion', layers: ['L3', 'L4'],
      description: 'Tracks how consistently the text refers back to established entities and ideas. High referential cohesion means readers can follow who and what is being discussed without guessing. Based on Givón\'s (1983) topic continuity and Coh-Metrix CRF indices.',
      scoring: '50% Referential Cohesion (L3) + 50% Semantic Cohesion (L4)' },
    { id: 'F5', label: 'Deep Cohesion', layers: ['L5', 'L6', 'L4'],
      description: 'Measures the explicit logical "glue" — causal, temporal, and adversative connectives that make relationships between ideas clear. High deep cohesion reduces the inferential burden on readers. Based on Halliday & Hasan (1976) and Coh-Metrix CNC indices.',
      scoring: '40% Connective Cohesion (L5) + 30% Situation Model (L6) + 30% Semantic Cohesion (L4)' },
    { id: 'F6', label: 'Argumentation Quality', layers: ['L8', 'L7'],
      description: 'Evaluates logical reasoning structure using the Toulmin (1958) model. Measures whether claims are supported by evidence, warrants connect data to claims, and counter-arguments are addressed. The single strongest predictor of academic essay grades (Wingate, 2012).',
      scoring: '70% Argumentation (L8) + 30% Rhetorical Structure (L7)' },
    { id: 'F7', label: 'Epistemic Calibration', layers: ['L9'],
      description: 'Measures how appropriately the writer modulates certainty through hedging ("may suggest") and boosting ("clearly demonstrates"). Mature academic writing calibrates confidence to evidence strength. Based on Hyland\'s (2005) metadiscourse framework.',
      scoring: '100% Pragmatic Stance (L9)' },
    { id: 'F8', label: 'Engagement & Affect', layers: ['L10', 'L6', 'L3'],
      description: 'Captures emotional tone and reader engagement — valence, arousal, and whether affect is strategically placed or random. Even academic writing carries emotional charge; consistent, controlled affect signals maturity. Based on Russell\'s (1980) VAD model.',
      scoring: '50% Affect (L10) + 30% Situation Model (L6) + 20% Referential Cohesion (L3)' },
  ];
}

module.exports = { runAnalysis, getCompositeDefinitions };
