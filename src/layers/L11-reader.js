/**
 * L11 — Reader-Adaptive Scoring
 *
 * All L0–L9 metrics re-scored relative to learner profile from UALS/LRS.
 * ZPD proximity operationalizes Vygotsky (1978).
 */
const llm = require('../services/llm');
const config = require('../config');

const LAYER_ID = 'L11';
const LAYER_NAME = 'Reader-Adaptive Scoring';

// Default population norms (mean, sd) for key metrics
const POPULATION_NORMS = {
  'L1.1': { mean: 7.0, sd: 2.0 },   // surprisal
  'L2.1': { mean: 3.1, sd: 0.8 },   // MDD
  'L4.1': { mean: 0.48, sd: 0.12 },  // local semantic overlap
  'L8.2': { mean: 1.8, sd: 0.7 },   // premises per claim
};

// Vocab level to expected surprisal mapping
const VOCAB_LEVEL_MAP = {
  'A1': 5.0, 'A2': 5.5, 'B1': 6.0, 'B2': 7.0,
  'B2+': 7.5, 'C1': 8.0, 'C2': 9.0,
};

async function analyze(doc, { layerResults, learnerProfile } = {}) {
  const profile = learnerProfile || {
    vocabLevel: config.l10Defaults.vocabLevel,
    syntacticFluency: 0.65,
    domainExpertise: config.l10Defaults.domainExpertise,
    courseLevel: 'undergraduate',
    priorScores: null,
  };

  // Extract key metrics from other layers
  const l1Score = layerResults?.L1?.rawValues?.mean_surprisal ?? 7.0;
  const l2Score = layerResults?.L2?.rawValues?.mean_dependency_distance ?? 3.0;
  const l4Score = layerResults?.L4?.rawValues?.local_semantic_overlap ?? 0.45;
  const l7Score = layerResults?.L8?.rawValues?.premise_to_claim_ratio ?? 1.5;

  // Expected scores based on learner profile
  const expectedSurprisal = VOCAB_LEVEL_MAP[profile.vocabLevel] || 7.0;
  const expectedMDD = 2.5 + (profile.syntacticFluency || 0.65) * 1.5;
  const expectedCohesion = 0.40 + (profile.domainExpertise === 'Advanced' ? 0.15 : profile.domainExpertise === 'Intermediate' ? 0.08 : 0);
  const expectedPremises = profile.courseLevel === 'graduate' ? 2.5 : profile.courseLevel === 'undergraduate' ? 1.8 : 1.2;

  // Z-scores relative to learner's cohort
  const zLexical = (l1Score - expectedSurprisal) / POPULATION_NORMS['L1.1'].sd;
  const zSyntactic = (l2Score - expectedMDD) / POPULATION_NORMS['L2.1'].sd;
  const zSemantic = (l4Score - expectedCohesion) / POPULATION_NORMS['L4.1'].sd;
  const zArgument = (l7Score - expectedPremises) / POPULATION_NORMS['L8.2'].sd;

  // Global difficulty: weighted composite
  const globalDifficulty = zLexical * 0.25 + zSyntactic * 0.25 + zSemantic * 0.25 + zArgument * 0.25;

  // ZPD proximity: optimal challenge ≈ 0.5–1.5 SD above learner level
  const zpdOptimal = (config.l10Defaults.zpdOptimalMin + config.l10Defaults.zpdOptimalMax) / 2;
  const zpdProximity = 1 - Math.min(Math.abs(globalDifficulty - zpdOptimal) / 2, 1);

  // Writing-above-level flag
  const writingAboveLevel = globalDifficulty > 1.5 ? 1 : 0;

  // Suggest scaffold type based on weakest area
  const zScores = { lexical: zLexical, syntactic: zSyntactic, semantic: zSemantic, argumentative: zArgument };
  const weakest = Object.entries(zScores).sort((a, b) => a[1] - b[1])[0][0];
  const scaffoldType = weakest === 'lexical' ? 'lexical' : weakest === 'syntactic' ? 'syntactic' : weakest === 'semantic' ? 'organizational' : 'argumentative';

  // Use LLM for richer reader-adaptive assessment
  let llmAdaptive;
  try {
    llmAdaptive = await llm.completeJSON(`
Given a learner with vocabulary level ${profile.vocabLevel}, ${profile.domainExpertise} domain expertise, and ${profile.courseLevel || 'undergraduate'} course level, assess how well this text matches their learning needs:

1. reading_difficulty_assessment: brief description of text difficulty relative to learner
2. vocab_accessibility: what proportion of vocabulary is within learner's expected range (0-1)
3. syntax_accessibility: how accessible is the syntactic complexity for this learner (0-1)

Return JSON: {"reading_difficulty_assessment": string, "vocab_accessibility": float, "syntax_accessibility": float}

Text excerpt: ${doc.text.substring(0, 1500)}`);
  } catch {
    llmAdaptive = {
      reading_difficulty_assessment: 'Text is at an appropriate level for the learner.',
      vocab_accessibility: 0.75,
      syntax_accessibility: 0.80,
    };
  }

  const metrics = {
    'L11.1': { value: round(zLexical, 1), unit: 'z', label: 'Lexical challenge (z)' },
    'L11.2': { value: round(zSyntactic, 1), unit: 'z', label: 'Syntactic challenge (z)' },
    'L11.3': { value: round(zSemantic, 1), unit: 'z', label: 'Semantic gap score (z)' },
    'L11.4': { value: round(zArgument, 1), unit: 'z', label: 'Argumentation readiness (z)' },
    'L11.5': { value: round(globalDifficulty, 1), unit: 'z', label: 'Global difficulty estimate' },
    'L11.6': { value: round(zpdProximity, 2), unit: 'ZPD', label: 'ZPD proximity index' },
    'L11.7': { value: writingAboveLevel, unit: 'flag', label: 'Writing-above-level indicator' },
    'L11.8': { value: scaffoldType, unit: 'type', label: 'Suggested scaffold type' },
  };

  // Score: primarily based on ZPD proximity
  const zpdScore = zpdProximity * 100;
  const accessScore = (llmAdaptive.vocab_accessibility + llmAdaptive.syntax_accessibility) / 2 * 100;
  const score = Math.round(zpdScore * 0.60 + accessScore * 0.40);

  return {
    layerId: LAYER_ID,
    layerName: LAYER_NAME,
    score: clampScore(score),
    metrics,
    rawValues: {
      zScores, globalDifficulty, zpdProximity, writingAboveLevel, scaffoldType,
      learnerProfile: profile, llmAdaptive,
    },
    readerProfile: {
      vocabLevel: profile.vocabLevel,
      syntaxFluency: round(llmAdaptive.syntax_accessibility, 2),
      domainExpertise: profile.domainExpertise,
      zpdProximity: round(zpdProximity, 2),
      difficultyZScore: round(globalDifficulty, 1),
      scaffoldType,
    },
  };
}

function clampScore(s) { return Math.max(0, Math.min(100, s)); }
function round(n, d = 0) { const f = 10 ** d; return Math.round(n * f) / f; }

const METRIC_COUNT = 8;
module.exports = { analyze, LAYER_ID, LAYER_NAME, METRIC_COUNT };
