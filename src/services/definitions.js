/**
 * Definitions Store
 *
 * Canonical definitions for all layers and metrics, drawn from the
 * Neo-Coh-Metrix specification (SPECIFICATION.md). These are the "ground truth"
 * descriptions that the help chat paraphrases for the target audience.
 *
 * Structure: 12 layers (L0-L11) mapped to 5 discourse levels + 1 meta-layer.
 * Total: 111 metrics with scientifically grounded, variable counts per layer.
 *
 * Discourse Level I  — Surface Code:       L0 (14), L1 (12), L2 (11)
 * Discourse Level II — Textbase:           L3 (8),  L4 (8),  L5 (9)
 * Discourse Level III — Situation Model:   L6 (8)
 * Discourse Level IV — Genre & Rhetoric:   L7 (8),  L8 (9)
 * Discourse Level V  — Pragmatic:          L9 (8),  L10 (8)
 * Meta (Cross-Level):                      L11 (8)
 */

// ── Discourse level taxonomy ──────────────────────────────────────────────────
const DISCOURSE_LEVELS = {
  I:    { name: 'Surface Code',             layers: ['L0', 'L1', 'L2'],   description: 'Exact wording, syntax, sentence structure — decoding and parsing.' },
  II:   { name: 'Textbase',                 layers: ['L3', 'L4', 'L5'],   description: 'Explicit propositions and their connections — proposition extraction.' },
  III:  { name: 'Situation Model',          layers: ['L6'],                description: 'The "mental world" — causal, temporal, spatial, intentional dimensions.' },
  IV:   { name: 'Genre & Rhetorical Structure', layers: ['L7', 'L8'],     description: 'Discourse organization, rhetorical moves, argumentation.' },
  V:    { name: 'Pragmatic Communication',  layers: ['L9', 'L10'],        description: 'Author-reader interaction, stance, affect, audience awareness.' },
  Meta: { name: 'Cross-Level',             layers: ['L11'],               description: 'Reader-relative scoring across all discourse levels.' },
};

// ── Layer definitions ─────────────────────────────────────────────────────────
const LAYER_DEFINITIONS = {
  L0: {
    name: 'Descriptive & Structural',
    discourseLevel: 'I',
    metricCount: 14,
    definition: 'Baseline text statistics for normalization and structural assessment. Surface metrics measure word count, sentence length, vocabulary diversity, paragraph structure, and traditional readability indices. They serve as normalization denominators for all higher-level metrics. MATTR and MTLD are preferred over raw TTR because TTR is mathematically length-sensitive (Covington & McFall, 2010; McCarthy & Jarvis, 2010). Flesch-Kincaid and Flesch Reading Ease provide traditional readability benchmarks, though they capture only Level I surface features.',
    why: 'These basic measurements control for text length, establish baselines that all other layers build upon, and provide backward-compatible readability scores.',
    subConstructs: ['Text Extent', 'Sentence-Level Statistics', 'Vocabulary Diversity', 'Structural Organization'],
    cohMetrixMapping: ['DES (11 indices)', 'LD (partial)', 'RD (2 indices)'],
  },
  L1: {
    name: 'Lexical Sophistication',
    discourseLevel: 'I',
    metricCount: 12,
    definition: 'Assesses vocabulary advancement, psycholinguistic word properties, and register appropriateness. LLM surprisal modernizes the classical frequency-based approach by measuring contextual predictability — how expected each word is given its surrounding context (Smith & Levy, 2013). Psycholinguistic norms from Kuperman et al. (2012; age of acquisition), Brysbaert et al. (2014; concreteness), and SUBTLEX-US (Brysbaert & New, 2009; word frequency) provide validated cognitive difficulty estimates. Academic Word List density (Coxhead, 2000) measures academic register use.',
    why: 'Word-level properties are among the strongest predictors of text difficulty (Graesser et al., 2011). Vocabulary choice signals academic register competence and influences processing cost at every higher level.',
    subConstructs: ['Contextual Predictability', 'Psycholinguistic Word Properties', 'Vocabulary Level Indicators', 'Morphological & Specificity'],
    cohMetrixMapping: ['WRD (23 indices)', 'LD (partial)'],
  },
  L2: {
    name: 'Syntactic Complexity',
    discourseLevel: 'I',
    metricCount: 11,
    definition: 'Measures grammatical sophistication through dependency structure, clause embedding, phrase-level complexity, and syntactic pattern diversity. Mean Dependency Distance from Dependency Locality Theory (Gibson, 2000) measures processing load from word-distance between grammatically related words. Subordination ratio indicates reasoning depth — subordinate clauses express conditions, causes, and concessions rather than listing facts. Syntactic pattern density (Biber, 1988) captures the distribution of grammatical constructions.',
    why: 'Syntactic complexity reflects the ability to construct nuanced arguments. Too little = simplistic; too much = impedes comprehension. Syntactic variety (not just complexity) distinguishes skilled from unskilled writers.',
    subConstructs: ['Dependency Structure', 'Clause Structure', 'Phrase-Level Complexity', 'Syntactic Pattern Density'],
    cohMetrixMapping: ['SYN (7 indices)', 'DR (8 indices)'],
  },
  L3: {
    name: 'Referential Cohesion',
    discourseLevel: 'II',
    metricCount: 8,
    definition: 'Tracks entity introduction, re-mention, and continuity across sentences and paragraphs. Based on Givón\'s (1983) topic continuity framework — readers build mental models by tracking entities. Binary overlap measures (Coh-Metrix CRF indices) capture whether adjacent (local) or any (global) sentence pairs share noun, argument, or content word references. Coreference chain analysis extends this to track entities referred to by different expressions ("AI systems... they... these tools").',
    why: 'When writers consistently refer back to established entities, readers can build a connected mental model. Weak referential cohesion forces readers to guess antecedents, increasing cognitive load and comprehension failure.',
    subConstructs: ['Argument Overlap', 'Coreference Chains', 'Reference Clarity'],
    cohMetrixMapping: ['CRF (10 indices)'],
  },
  L4: {
    name: 'Semantic Cohesion',
    discourseLevel: 'II',
    metricCount: 8,
    definition: 'Measures meaning similarity between text segments using distributed semantic representations. Modernizes the original Coh-Metrix LSA-based approach (Landauer & Dumais, 1997) with SBERT embeddings (Reimers & Gurevych, 2019), resolving three known LSA limitations: polysemy collapse, word-order blindness, and negation failure. Cosine similarity between sentence/paragraph embeddings quantifies local coherence, global coherence, and topical integrity.',
    why: 'Semantic cohesion ensures readers can follow the logical thread. Topic drift — a sudden meaning shift without transition — is one of the most common cohesion problems in student writing.',
    subConstructs: ['Local Coherence', 'Global Coherence', 'Topical Integrity'],
    cohMetrixMapping: ['LSA (8 indices)'],
  },
  L5: {
    name: 'Connective & Deep Cohesion',
    discourseLevel: 'II',
    metricCount: 9,
    definition: 'Measures explicit cohesive devices — connectives that signal relationships between ideas. Connectives are the "glue" of the textbase (Halliday & Hasan, 1976), making implicit relationships explicit and reducing the inferential burden on readers. The distinction between types (causal, temporal, adversative, additive, logical) matters because different connective types support different levels of reasoning. The causal cohesion ratio captures the balance between explanatory and additive connections.',
    why: 'Connective incidence is one of the strongest predictors of text difficulty across grade levels (Graesser et al., 2011). Academic/argumentative text should be rich in causal and adversative connectives, not just additive ones.',
    subConstructs: ['Connective Incidence by Type', 'Connective Ratios & Deep Cohesion'],
    cohMetrixMapping: ['CNC (9 indices)', 'SM (partial — causal ratio)'],
  },
  L6: {
    name: 'Situation Model',
    discourseLevel: 'III',
    metricCount: 8,
    definition: 'Measures whether the text enables readers to build a mental simulation of events, causes, intentions, and spatiotemporal context. Based on Kintsch\'s (1998) Construction-Integration model and Zwaan & Radvansky\'s (1998) Event-Indexing model. The situation model has five dimensions: causation (why events happen), intentionality (who acts with what goal), temporality (when events occur), spatiality (where), and protagonist tracking (who). LLM analysis extracts causal chains, intentional actions, and grounding markers.',
    why: 'Deep comprehension requires mental simulation — readers construct a "mental movie." Stronger situation models lead to better retention and transfer. Causal chain depth indicates reasoning maturity.',
    subConstructs: ['Causal Dimension', 'Intentional & Agentive Dimension', 'Temporal & Spatial Dimension'],
    cohMetrixMapping: ['SM (8 indices)'],
  },
  L7: {
    name: 'Rhetorical Structure',
    discourseLevel: 'IV',
    metricCount: 8,
    definition: 'Analyzes discourse organization at the paragraph and multi-paragraph level using Rhetorical Structure Theory (Mann & Thompson, 1988). Text is organized as a hierarchy of nucleus-satellite relations where nuclei carry the main message and satellites provide supporting/elaborating/contrasting content. RST parsing reveals organizational depth, evidence density, dialectical engagement (contrast/concession), and rhetorical diversity. ENTIRELY NEW — not present in any version of Coh-Metrix.',
    why: 'Well-organized academic text uses diverse rhetorical strategies. Over-reliance on simple elaboration suggests the writer isn\'t engaging with opposing perspectives or supporting claims with evidence. RST parsing was too computationally expensive for the original Coh-Metrix; LLMs make it feasible.',
    subConstructs: ['Structural Properties', 'Relation Type Distribution'],
    cohMetrixMapping: ['None — novel extension'],
  },
  L8: {
    name: 'Argumentation Quality',
    discourseLevel: 'IV',
    metricCount: 9,
    definition: 'Analyzes logical argumentation structure using the Toulmin (1958) model: Claim (assertion) + Data/Grounds (evidence) + Warrant (reasoning link) + Backing (support for warrant) + Qualifier (degree of certainty) + Rebuttal (counter-argument). Key metrics: premises-per-claim ratio, warrant completeness, unsupported claim ratio, counter-argument handling, and logical fallacy detection. ENTIRELY NEW — argumentation quality is the single most important predictor of academic essay grades (Wingate, 2012), yet was never computationally operationalized in Coh-Metrix.',
    why: 'Strong essays support claims with evidence, provide explicit reasoning warrants, and anticipate objections. Argument mining as an NLP task emerged after Coh-Metrix was designed; LLM-based analysis enables Toulmin-level extraction at scale.',
    subConstructs: ['Argument Components', 'Argument Depth & Counter-Argument', 'Argument Quality Indicators'],
    cohMetrixMapping: ['None — novel extension'],
  },
  L9: {
    name: 'Pragmatic Stance',
    discourseLevel: 'V',
    metricCount: 8,
    definition: 'Measures how the writer positions themselves relative to claims, sources, and readers. Based on Speech Act Theory (Austin, 1962; Searle, 1969) and Hyland\'s (2005) metadiscourse framework. Key constructs: speech act distribution, epistemic calibration (hedging vs. boosting), evidentiality (source attribution), and voice (personal vs. impersonal). The hedge-to-boost ratio is a validated indicator of academic writing maturity.',
    why: 'Academic writing requires epistemic calibration — neither over-claiming (overconfident) nor under-asserting (too tentative). The hedge-to-boost ratio reveals whether the writer has learned to modulate certainty appropriately. Contextual distinction of hedges/boosters requires LLM analysis.',
    subConstructs: ['Speech Act Profile', 'Epistemic Calibration', 'Source & Voice'],
    cohMetrixMapping: ['None — novel extension'],
  },
  L10: {
    name: 'Affective & Engagement',
    discourseLevel: 'V',
    metricCount: 8,
    definition: 'Measures emotional tone and its trajectory across the essay using Russell\'s (1980) Valence-Arousal-Dominance (VAD) model. Valence = positive/negative; arousal = urgency/calm; dominance = assertive/submissive. The valence arc (slope from intro to conclusion) reveals emotional trajectory. Affect-argument alignment measures whether emotional language is strategically placed or intrusive.',
    why: 'Even academic writing carries emotional charge. Consistent, controlled affect signals maturity; sudden emotional shifts undermine credibility. Sentence-level VAD estimation at scale became feasible with modern NLP — earlier tools could only use keyword-based sentiment.',
    subConstructs: ['Affective Dimensions', 'Tonal Trajectory', 'Engagement'],
    cohMetrixMapping: ['None — novel extension'],
  },
  L11: {
    name: 'Reader-Adaptive Scoring',
    discourseLevel: 'Meta',
    metricCount: 8,
    definition: 'Re-scores all L0-L10 metrics relative to a specific learner\'s profile (vocabulary level, syntactic fluency, domain expertise, course level). Text difficulty is inherently relational — what\'s complex for a beginner may be routine for an expert. The ZPD proximity index measures whether the text is in the learner\'s Zone of Proximal Development (Vygotsky, 1978) — optimally challenging. This is the MOST SIGNIFICANT INNOVATION of Neo-Coh-Metrix — no existing text analysis tool provides learner-relative difficulty scoring.',
    why: 'A text that scores "complex" overall might be exactly right for an advanced student or impossibly hard for a beginner. Personalized scoring enables "This text is appropriate for YOUR level" rather than generic difficulty ratings. Supports differentiated instruction.',
    subConstructs: ['Dimension-Specific Challenge', 'Composite Adaptive Scores'],
    cohMetrixMapping: ['None — novel extension'],
    learnerProfileParams: ['Vocabulary level (A1-C2, CEFR)', 'Syntactic fluency (0-1)', 'Domain expertise (Beginner/Intermediate/Advanced)', 'Course level (high school/undergraduate/graduate)'],
  },
};

// ── Metric definitions ────────────────────────────────────────────────────────
const METRIC_DEFINITIONS = {

  // ═══════════════════════════════════════════════════════════════════════════
  // L0 — Descriptive & Structural (14 metrics)
  // Discourse Level I: Surface Code
  // ═══════════════════════════════════════════════════════════════════════════

  // Sub-construct A: Text Extent
  'L0.1':  { label: 'Word count',                   cohMetrix: 'DESWC',    definition: 'Total number of word tokens in the essay.',                                              interpretation: 'Essay length. Used as denominator for all "per-word" density metrics.' },
  'L0.2':  { label: 'Sentence count',               cohMetrix: 'DESSC',    definition: 'Total sentences detected by NLP parser.',                                                  interpretation: 'Combined with word count, determines average sentence length.' },
  'L0.3':  { label: 'Paragraph count',              cohMetrix: 'DESPC',    definition: 'Number of paragraphs (separated by blank lines).',                                         interpretation: 'Structural organization indicator. Too few may signal lack of organization.' },
  'L0.4':  { label: 'Mean word length (syllables)',  cohMetrix: 'DESWLsy', definition: 'Average syllables per word.',                                                               interpretation: 'Polysyllabic words correlate with Latinate/academic vocabulary. Academic: ~1.5-1.8.' },

  // Sub-construct B: Sentence-Level Statistics
  'L0.5':  { label: 'Mean sentence length',          cohMetrix: 'DESSL',   definition: 'Average words per sentence.',                                                               interpretation: 'Academic: 15-25 words. <12 = simplistic; >30 = potentially hard to parse.' },
  'L0.6':  { label: 'Sentence length SD',            cohMetrix: 'DESSLd',  definition: 'Standard deviation of sentence lengths across the essay.',                                  interpretation: 'Some variation = stylistic maturity. SD 5-10 typical; very low = monotonous.' },
  'L0.7':  { label: 'Mean paragraph length',         cohMetrix: 'DESPL',   definition: 'Average sentences per paragraph.',                                                          interpretation: 'Well-developed paragraphs: 4-8 sentences. <3 = underdeveloped ideas.' },
  'L0.8':  { label: 'Paragraph length SD',           cohMetrix: 'DESPLd',  definition: 'Standard deviation of paragraph lengths in sentences.',                                     interpretation: 'High SD may indicate uneven development of ideas across sections.' },

  // Sub-construct C: Vocabulary Diversity
  'L0.9':  { label: 'Type-Token Ratio (raw)',        cohMetrix: 'LDTTRa',  definition: 'Unique words / total words. Length-sensitive — decreases as text grows even if diversity is constant.', interpretation: 'Raw reference only. Use MATTR (L0.10) or MTLD (L0.11) for fair cross-text comparison.' },
  'L0.10': { label: 'MATTR',                         cohMetrix: null,      definition: 'Moving-Average Type-Token Ratio over 50-word sliding window, then averaged. Length-invariant vocabulary diversity (Covington & McFall, 2010).', interpretation: 'Academic: 0.50-0.70. Higher = more diverse vocabulary; lower = more word repetition.' },
  'L0.11': { label: 'MTLD',                          cohMetrix: 'LDMTLDa', definition: 'Measure of Textual Lexical Diversity. Counts consecutive words maintaining TTR above threshold (McCarthy & Jarvis, 2010).', interpretation: 'More robust than TTR for short texts. Academic: 50-120. Higher = more diverse.' },

  // Sub-construct D: Structural Organization
  'L0.12': { label: 'Intro/body/conclusion ratio',   cohMetrix: null,      definition: 'Percentage distribution of text across opening, middle, and closing sections.',              interpretation: 'Balanced: ~15-20% intro, 60-70% body, 15-20% conclusion.' },
  'L0.13': { label: 'Flesch Reading Ease',           cohMetrix: 'RDFRE',   definition: '206.835 - 1.015(words/sentences) - 84.6(syllables/words). Traditional readability index.',   interpretation: '60-70 = standard; 30-50 = college level; <30 = graduate level.' },
  'L0.14': { label: 'Flesch-Kincaid Grade Level',   cohMetrix: 'RDFKGL',  definition: '0.39(words/sentences) + 11.8(syllables/words) - 15.59. U.S. grade level estimate.',          interpretation: 'Academic writing typically scores 12-16.' },

  // ═══════════════════════════════════════════════════════════════════════════
  // L1 — Lexical Sophistication (12 metrics)
  // Discourse Level I: Surface Code
  // ═══════════════════════════════════════════════════════════════════════════

  // Sub-construct A: Contextual Predictability
  'L1.1':  { label: 'Mean token surprisal',         cohMetrix: null,       definition: 'Average information content per word in bits, from LLM log-probabilities. Measures contextual predictability (Smith & Levy, 2013).', interpretation: 'Academic: 6.5-9 bits. <6 = basic/predictable vocabulary. >10 = obscure/specialized.' },
  'L1.2':  { label: 'Surprisal SD',                  cohMetrix: null,       definition: 'Standard deviation of per-token surprisal across the essay.',                               interpretation: 'High SD = inconsistent register — mixing simple and complex vocabulary.' },
  'L1.3':  { label: 'Register consistency',          cohMetrix: null,       definition: 'Variation in vocabulary sophistication across text windows. Measures formality stability.',  interpretation: 'Close to 1.0 = steady register. <0.7 = problematic formal/informal shifts.' },

  // Sub-construct B: Psycholinguistic Word Properties
  'L1.4':  { label: 'Mean age of acquisition',       cohMetrix: 'WRDAOKc', definition: 'Average estimated age at which content words are typically learned. Norms: Kuperman et al. (2012), 51,000 words.', interpretation: 'Academic: 7-10 years. Higher = more advanced vocabulary.' },
  'L1.5':  { label: 'Mean concreteness',             cohMetrix: 'WRDCNCc', definition: 'Average concreteness of content words (1=abstract, 5=concrete). Norms: Brysbaert et al. (2014), 40,000 words.', interpretation: 'Academic/argumentative: ~2.5-3.5. Narrative: ~3.5-4.5.' },
  'L1.6':  { label: 'Mean imageability',             cohMetrix: 'WRDIMGc', definition: 'Ease of generating a mental image for content words (1-7 scale).',                          interpretation: 'Related to concreteness. Low imageability requires more abstract reasoning.' },
  'L1.7':  { label: 'Polysemy count',                cohMetrix: 'WRDPOLc', definition: 'Mean number of dictionary senses per content word.',                                        interpretation: 'Higher polysemy = more ambiguous. Academic texts tend toward lower polysemy.' },

  // Sub-construct C: Vocabulary Level Indicators
  'L1.8':  { label: 'Academic word density',          cohMetrix: null,      definition: 'Proportion of content words from Coxhead\'s (2000) Academic Word List (570 word families).', interpretation: 'Target: 0.12-0.22 for undergraduate. <0.10 = insufficient academic register.' },
  'L1.9':  { label: 'Rare word ratio',               cohMetrix: null,       definition: 'Proportion of words unfamiliar to a B2-level English learner.',                             interpretation: 'Some rare words = sophistication. Too many = jargon overload.' },
  'L1.10': { label: 'Word frequency (log)',           cohMetrix: 'WRDFRQc', definition: 'Mean log SUBTLEX-US frequency of content words (Brysbaert & New, 2009).',                  interpretation: 'Lower frequency = rarer, more sophisticated. Academic: 2.5-3.5 (log).' },

  // Sub-construct D: Morphological & Specificity
  'L1.11': { label: 'Morphological complexity',      cohMetrix: null,       definition: 'Mean morphemes per content word. "Unbelievable" = 3 (un-believe-able).',                   interpretation: 'Academic: 1.4-2.2. Higher = more derived, complex word forms.' },
  'L1.12': { label: 'Hypernymy (specificity)',       cohMetrix: 'WRDHYPnv', definition: 'Mean depth in WordNet noun/verb hierarchy. Higher = more specific terms.',                 interpretation: 'Academic writing should mix general and specific terms.' },

  // ═══════════════════════════════════════════════════════════════════════════
  // L2 — Syntactic Complexity (11 metrics)
  // Discourse Level I: Surface Code
  // ═══════════════════════════════════════════════════════════════════════════

  // Sub-construct A: Dependency Structure
  'L2.1':  { label: 'Mean dependency distance',      cohMetrix: null,       definition: 'Average word-distance between grammatically related words. Based on UD parse (Gibson, 2000; Liu, 2008).', interpretation: 'Population mean ~3.1. <2.5 = simple sentences. >4.0 = high processing load.' },
  'L2.2':  { label: 'MDD standard deviation',        cohMetrix: null,       definition: 'Variation in dependency distances across sentences.',                                       interpretation: 'High SD = inconsistent sentence complexity.' },
  'L2.3':  { label: 'Left embeddedness',             cohMetrix: 'SYNLE',    definition: 'Mean number of words before the main verb of the main clause.',                             interpretation: 'More left-branching = more pre-verbal working memory load. Academic: 3-7 words.' },

  // Sub-construct B: Clause Structure
  'L2.4':  { label: 'Mean clause depth',             cohMetrix: null,       definition: 'Average depth of deepest embedded clause per sentence.',                                    interpretation: 'Academic: 1.5-3.0. Deeper = more complex architecture.' },
  'L2.5':  { label: 'Subordination ratio',           cohMetrix: null,       definition: 'Proportion of subordinate clauses (because, although, while) to total clauses.',             interpretation: 'Target: 0.35-0.55. Subordination signals reasoning: conditions, causes, concessions.' },
  'L2.6':  { label: 'Passive voice ratio',           cohMetrix: 'DRPVAL',   definition: 'Proportion of verb phrases using passive construction.',                                    interpretation: 'Academic: 0.05-0.20. Some passive appropriate for objectivity. >0.30 = unclear agency.' },

  // Sub-construct C: Phrase-Level Complexity
  'L2.7':  { label: 'NP elaboration',                cohMetrix: 'SYNNP',    definition: 'Mean modifiers (adjectives, determiners, relative clauses) per noun phrase.',               interpretation: 'Academic: 1.3-2.5. More modification = more specific writing.' },
  'L2.8':  { label: 'Sentence syntax similarity',    cohMetrix: 'SYNSTRUTa', definition: 'Mean edit distance of POS tag sequences between adjacent sentences (McCarthy & Jarvis, 2007).', interpretation: 'Low similarity = high syntactic variety (desirable). High = repetitive patterns.' },

  // Sub-construct D: Syntactic Pattern Density
  'L2.9':  { label: 'Noun phrase incidence',         cohMetrix: 'DRNP',     definition: 'Noun phrases per 1000 words.',                                                              interpretation: 'Higher = more information-dense. Academic text is typically NP-heavy.' },
  'L2.10': { label: 'Prepositional phrase incidence', cohMetrix: 'DRPP',    definition: 'Prepositional phrases per 1000 words.',                                                     interpretation: 'Higher = more spatial/relational detail. Academic: 60-100 per 1000 words.' },
  'L2.11': { label: 'Negation incidence',            cohMetrix: 'DRNEG',    definition: 'Negation expressions per 1000 words.',                                                      interpretation: 'Negation increases processing difficulty. Excessive use may signal evasive writing.' },

  // ═══════════════════════════════════════════════════════════════════════════
  // L3 — Referential Cohesion (8 metrics)
  // Discourse Level II: Textbase
  // ═══════════════════════════════════════════════════════════════════════════

  // Sub-construct A: Argument Overlap
  'L3.1':  { label: 'Noun overlap (local)',           cohMetrix: 'CRFNO1',  definition: 'Proportion of adjacent sentence pairs sharing at least one noun stem.',                     interpretation: 'Target: 0.50-0.75. Below 0.40 = too many topic jumps.' },
  'L3.2':  { label: 'Noun overlap (global)',          cohMetrix: 'CRFNOa',  definition: 'Proportion of all sentence pairs sharing at least one noun stem.',                          interpretation: 'Measures overall topical connectedness. Low = disconnected topics.' },
  'L3.3':  { label: 'Argument overlap (local)',       cohMetrix: 'CRFAO1',  definition: 'Adjacent sentence pairs sharing nouns or pronouns.',                                        interpretation: 'Broader than noun overlap — includes pronominal reference.' },
  'L3.4':  { label: 'Argument overlap (global)',      cohMetrix: 'CRFAOa',  definition: 'All sentence pairs sharing nouns or pronouns.',                                              interpretation: 'Captures long-range entity tracking across the full text.' },

  // Sub-construct B: Coreference Chains
  'L3.5':  { label: 'Coreference chain count',       cohMetrix: null,       definition: 'Number of distinct entity chains — entities referred to by multiple expressions.',          interpretation: 'More chains = more entities sustained throughout text.' },
  'L3.6':  { label: 'Mean chain length',             cohMetrix: null,       definition: 'Average mentions per coreference chain.',                                                    interpretation: 'Longer chains (>4) = strong entity continuity. Short (2-3) = entities abandoned.' },

  // Sub-construct C: Reference Clarity
  'L3.7':  { label: 'Content word overlap (local)',   cohMetrix: 'CRFCWOa', definition: 'Proportion of adjacent sentences sharing content words (nouns, verbs, adjectives). Proportional.', interpretation: 'Broader than noun-only overlap. Captures thematic continuity.' },
  'L3.8':  { label: 'Pronoun-antecedent distance',   cohMetrix: null,       definition: 'Mean token distance between a pronoun and its referent noun.',                              interpretation: 'Optimal: 3-8 tokens. >15 tokens = reader may lose track of referent.' },

  // ═══════════════════════════════════════════════════════════════════════════
  // L4 — Semantic Cohesion (8 metrics)
  // Discourse Level II: Textbase
  // ═══════════════════════════════════════════════════════════════════════════

  // Sub-construct A: Local Coherence
  'L4.1':  { label: 'Local semantic overlap',         cohMetrix: 'LSASS1',  definition: 'Mean cosine similarity between adjacent sentence embeddings (SBERT replaces LSA).',         interpretation: 'Target: 0.40-0.65. <0.35 = choppy. >0.75 = repetitive.' },
  'L4.2':  { label: 'Local semantic overlap SD',      cohMetrix: 'LSASS1d', definition: 'Standard deviation of adjacent-sentence similarities.',                                     interpretation: 'Low = consistent cohesion. High = uneven transitions.' },
  'L4.3':  { label: 'Given/new ratio',                cohMetrix: 'LSAGN',   definition: 'Mean similarity of each sentence to all preceding sentences. How much "new" info each sentence adds.', interpretation: 'Higher = more repetitive. Lower = more new info per sentence. Balance is key.' },

  // Sub-construct B: Global Coherence
  'L4.4':  { label: 'Paragraph-level cohesion',       cohMetrix: 'LSAPP1',  definition: 'Mean cosine similarity between adjacent paragraph centroids.',                              interpretation: 'Measures inter-paragraph meaning flow. Target: 0.35-0.60.' },
  'L4.5':  { label: 'Paragraph cohesion SD',          cohMetrix: 'LSAPP1d', definition: 'Standard deviation of inter-paragraph similarities.',                                       interpretation: 'Low = consistent paragraph transitions throughout.' },

  // Sub-construct C: Topical Integrity
  'L4.6':  { label: 'Topic drift index',              cohMetrix: null,       definition: 'Largest sudden drop in similarity over any 3-sentence window.',                            interpretation: '>0.15 = topic drift detected. Common student writing weakness.' },
  'L4.7':  { label: 'Intro-conclusion alignment',     cohMetrix: null,       definition: 'Cosine similarity between first and last paragraph embeddings.',                           interpretation: '>0.50 = strong frame. <0.30 = essay drifted from opening topic.' },
  'L4.8':  { label: 'On-topic score',                 cohMetrix: null,       definition: 'Similarity between essay and assignment prompt (if provided).',                             interpretation: 'Higher = more on-topic. <0.40 = potentially off-topic. Conditional metric.' },

  // ═══════════════════════════════════════════════════════════════════════════
  // L5 — Connective & Deep Cohesion (9 metrics)
  // Discourse Level II: Textbase
  // ═══════════════════════════════════════════════════════════════════════════

  // Sub-construct A: Connective Incidence by Type
  'L5.1':  { label: 'All connectives incidence',      cohMetrix: 'CNCAll',   definition: 'Total connectives per 1000 words.',                                                       interpretation: 'Higher = more explicit relationship signaling. Academic: 60-100 per 1000.' },
  'L5.2':  { label: 'Causal connectives',             cohMetrix: 'CNCCaus',  definition: 'Causal connectives per 1000 words (because, therefore, consequently, thus, so).',          interpretation: 'Academic/argumentative should be rich in causal connectives. Target: 15-30.' },
  'L5.3':  { label: 'Temporal connectives',           cohMetrix: 'CNCTemp',  definition: 'Temporal connectives per 1000 words (before, after, then, meanwhile, subsequently).',      interpretation: 'Important for narrative and historical analysis.' },
  'L5.4':  { label: 'Adversative connectives',        cohMetrix: 'CNCADC',   definition: 'Adversative/contrastive connectives per 1000 words (however, although, nevertheless, whereas, despite).', interpretation: 'Critical for argumentation — signals engagement with opposing ideas. Target: 8-20.' },
  'L5.5':  { label: 'Additive connectives',           cohMetrix: 'CNCAdd',   definition: 'Additive connectives per 1000 words (and, also, moreover, furthermore, in addition).',     interpretation: 'List-building. Over-reliance suggests lack of deeper reasoning.' },

  // Sub-construct B: Connective Ratios & Deep Cohesion
  'L5.6':  { label: 'Causal cohesion ratio',          cohMetrix: 'SMCAUSr',  definition: 'Ratio of causal to causal + additive connectives.',                                        interpretation: 'Higher = more causal reasoning vs. listing. Target: >0.30 for argumentative text.' },
  'L5.7':  { label: 'Logical connective density',     cohMetrix: 'CNCLogic', definition: 'Logical operators per 1000 words (if...then, or, either, neither, unless).',               interpretation: 'Signals conditional/disjunctive reasoning. Academic: 10-25.' },
  'L5.8':  { label: 'Positive connective ratio',      cohMetrix: 'CNCPos',   definition: 'Proportion of connectives that are positive/affirmative (and, moreover, because).',         interpretation: 'Balance with L5.9 indicates nuanced argumentation.' },
  'L5.9':  { label: 'Negative connective ratio',      cohMetrix: 'CNCNeg',   definition: 'Proportion of connectives that are negative/adversative (but, however, despite, not).',     interpretation: 'Higher = more counter-argumentation and qualification.' },

  // ═══════════════════════════════════════════════════════════════════════════
  // L6 — Situation Model (8 metrics)
  // Discourse Level III: Situation Model
  // ═══════════════════════════════════════════════════════════════════════════

  // Sub-construct A: Causal Dimension
  'L6.1':  { label: 'Causal verb incidence',          cohMetrix: 'SMCAUSv',  definition: 'Causal verbs per 1000 words (cause, result, lead to, produce, affect).',                   interpretation: 'Higher = more explicit causal reasoning in the text.' },
  'L6.2':  { label: 'Causal chain density',           cohMetrix: null,       definition: 'Cause-effect event pairs per 100 words, extracted via LLM.',                               interpretation: 'Target: 1.5-3.5. <1.0 = descriptive rather than explanatory.' },
  'L6.3':  { label: 'Mean causal chain length',       cohMetrix: null,       definition: 'Average events per causal chain (A→B→C = length 3).',                                     interpretation: 'Longer = deeper causal reasoning tracing consequences through multiple steps.' },

  // Sub-construct B: Intentional & Agentive Dimension
  'L6.4':  { label: 'Intentional action density',     cohMetrix: 'SMINTEp',  definition: 'Intentional content per 1000 words — actions by agents with goals.',                       interpretation: 'Higher = more agentive text. Low may indicate passive, agent-less description.' },
  'L6.5':  { label: 'Protagonist continuity',         cohMetrix: null,       definition: 'Consistency of agent/actor maintenance throughout text.',                                   interpretation: 'Higher = readers can track "who is doing what." Low = frequent agent switching.' },

  // Sub-construct C: Temporal & Spatial Dimension
  'L6.6':  { label: 'Temporal cohesion',              cohMetrix: 'SMTEMP',   definition: 'Consistency of tense and aspect across sentences.',                                        interpretation: 'Higher = consistent temporal frame. Low = jarring tense shifts.' },
  'L6.7':  { label: 'Temporal grounding',             cohMetrix: null,       definition: 'Proportion of sentences with explicit temporal anchors (dates, sequence markers).',          interpretation: 'Important for narrative/historical arguments. 0-1 scale.' },
  'L6.8':  { label: 'Spatial grounding',              cohMetrix: null,       definition: 'Proportion of sentences with locative expressions (spatial prepositions, place names).',     interpretation: 'Important when spatial context matters. Low ≠ bad for abstract arguments.' },

  // ═══════════════════════════════════════════════════════════════════════════
  // L7 — Rhetorical Structure (8 metrics) — NOVEL
  // Discourse Level IV: Genre & Rhetorical Structure
  // ═══════════════════════════════════════════════════════════════════════════

  // Sub-construct A: Structural Properties
  'L7.1':  { label: 'RST tree depth',                cohMetrix: null,       definition: 'Maximum depth of the rhetorical structure hierarchy (Mann & Thompson, 1988).',               interpretation: 'Academic: 4-8 levels. Shallow (1-3) = flat, list-like organization.' },
  'L7.2':  { label: 'Nucleus density',               cohMetrix: null,       definition: 'Ratio of nucleus to satellite content.',                                                     interpretation: 'Higher = more primary content, less supporting. Academic balance: 0.4-0.6.' },
  'L7.3':  { label: 'Satellite chaining',            cohMetrix: null,       definition: 'Depth of supporting layers (satellites of satellites).',                                     interpretation: 'Deeper = more layered evidence/elaboration.' },

  // Sub-construct B: Relation Type Distribution
  'L7.4':  { label: 'Evidence relation ratio',        cohMetrix: null,       definition: 'Proportion of relations that are Evidence, Justify, or Support.',                           interpretation: 'Target: 0.20-0.40. Higher = more evidence-based discourse.' },
  'L7.5':  { label: 'Contrast/Concession ratio',     cohMetrix: null,       definition: 'Proportion involving opposing viewpoints (Contrast, Concession).',                          interpretation: 'Indicates dialectical sophistication. Low = one-sided argumentation.' },
  'L7.6':  { label: 'Elaboration ratio',             cohMetrix: null,       definition: 'Proportion that are simple Elaboration.',                                                    interpretation: 'High (>0.50) = over-reliance on expansion without other rhetorical moves.' },
  'L7.7':  { label: 'Condition/Purpose ratio',       cohMetrix: null,       definition: 'Proportion of conditional or purpose-oriented relations (if, in order to, so that).',        interpretation: 'Indicates forward-looking reasoning and goal-oriented discourse.' },
  'L7.8':  { label: 'Rhetorical diversity index',    cohMetrix: null,       definition: 'Shannon entropy over distribution of relation types.',                                       interpretation: 'Target: >1.8 bits. <0.8 = writer uses only 1-2 discourse strategies.' },

  // ═══════════════════════════════════════════════════════════════════════════
  // L8 — Argumentation Quality (9 metrics) — NOVEL
  // Discourse Level IV: Genre & Rhetorical Structure
  // ═══════════════════════════════════════════════════════════════════════════

  // Sub-construct A: Argument Components
  'L8.1':  { label: 'Main claim count',              cohMetrix: null,       definition: 'Distinct main claims (assertions the writer tries to prove). Toulmin (1958) model.',         interpretation: 'Focused essay: 3-6. Too few = thin; too many = unfocused.' },
  'L8.2':  { label: 'Premises per claim',            cohMetrix: null,       definition: 'Average supporting premises (evidence/reasons) per main claim.',                             interpretation: 'Target: >2.0 for strong writing. <1.0 = most claims lack evidence.' },
  'L8.3':  { label: 'Warrant completeness',          cohMetrix: null,       definition: 'Proportion of claims with explicit warrants (reasoning WHY evidence supports the claim).',    interpretation: 'Higher is better. Missing warrants = common student weakness.' },

  // Sub-construct B: Argument Depth & Counter-Argument
  'L8.4':  { label: 'Counter-argument present',      cohMetrix: null,       definition: 'Whether the essay acknowledges at least one counter-argument (binary: 0/1).',                interpretation: 'Presence = hallmark of mature academic writing.' },
  'L8.5':  { label: 'Rebuttal quality',              cohMetrix: null,       definition: 'Quality of counter-argument handling (0-1 scale).',                                          interpretation: '0 = no rebuttal. 0.5 = mentioned but dismissed. 1.0 = fully addressed.' },
  'L8.6':  { label: 'Argument depth',                cohMetrix: null,       definition: 'Longest chain from evidence to highest-level claim.',                                        interpretation: 'Deeper = more layered reasoning. Depth 1 = assertion + one piece of evidence.' },

  // Sub-construct C: Argument Quality Indicators
  'L8.7':  { label: 'Unsupported claim ratio',       cohMetrix: null,       definition: 'Proportion of claims with zero supporting premises.',                                        interpretation: 'Lower is better. Target: <0.15. >0.40 = nearly half are bare assertions.' },
  'L8.8':  { label: 'Logical fallacy density',       cohMetrix: null,       definition: 'Detected logical fallacies per 500 words (ad hominem, straw man, false dichotomy, etc.).',   interpretation: 'Lower is better. >2 per 500 words = significant logical weakness.' },
  'L8.9':  { label: 'Evidence diversity',            cohMetrix: null,       definition: 'Number of distinct evidence types used (statistics, examples, authority, analogy, personal).', interpretation: 'More diverse evidence = more sophisticated argumentation. Target: 3+.' },

  // ═══════════════════════════════════════════════════════════════════════════
  // L9 — Pragmatic Stance (8 metrics) — NOVEL
  // Discourse Level V: Pragmatic Communication
  // ═══════════════════════════════════════════════════════════════════════════

  // Sub-construct A: Speech Act Profile
  'L9.1':  { label: 'Speech act distribution',       cohMetrix: null,       definition: 'Proportional distribution of sentence types: assert, argue, explain, question, direct.',     interpretation: 'Academic = assertion-heavy but should include variety for engagement.' },
  'L9.2':  { label: 'Assert dominance',              cohMetrix: null,       definition: 'Percentage of sentences that are pure assertions.',                                          interpretation: '>80% = monologic. Some variety in speech acts signals reader engagement.' },

  // Sub-construct B: Epistemic Calibration
  'L9.3':  { label: 'Hedging density',               cohMetrix: null,       definition: 'Epistemic hedges per 100 words (might, perhaps, suggests, it seems, arguably).',             interpretation: 'Optimal: 1.0-3.0/100w. <0.5 = overconfident. >5.0 = too tentative.' },
  'L9.4':  { label: 'Boosting density',              cohMetrix: null,       definition: 'Epistemic boosters per 100 words (clearly, certainly, obviously, undoubtedly).',              interpretation: 'Moderate boosting is appropriate. >3.0/100w = over-claiming.' },
  'L9.5':  { label: 'Hedge-to-boost ratio',          cohMetrix: null,       definition: 'Hedges / boosters. Measures epistemic calibration (Hyland, 2005).',                          interpretation: '1.5-3.0 = well-calibrated. <1.0 = more boosting than hedging (over-claiming).' },

  // Sub-construct C: Source & Voice
  'L9.6':  { label: 'Evidentiality score',           cohMetrix: null,       definition: 'Proportion of claims with explicit source attribution (cited, according to, research shows).', interpretation: 'Target: >0.30. <0.20 = insufficient citation/sourcing.' },
  'L9.7':  { label: 'Presupposition load',           cohMetrix: null,       definition: 'Definite NPs + factive verbs per sentence. Measures how much the writer takes for granted.', interpretation: 'Higher = more assumptions reader must share. Too high = alienating for outsiders.' },
  'L9.8':  { label: 'First-person stance',           cohMetrix: null,       definition: 'Ratio of first-person (I believe) to impersonal constructions (research shows).',            interpretation: 'Discipline-dependent. Most academic: <0.3. Some fields accept personal voice.' },

  // ═══════════════════════════════════════════════════════════════════════════
  // L10 — Affective & Engagement (8 metrics) — NOVEL
  // Discourse Level V: Pragmatic Communication
  // ═══════════════════════════════════════════════════════════════════════════

  // Sub-construct A: Affective Dimensions
  'L10.1': { label: 'Mean valence',                  cohMetrix: null,       definition: 'Average emotional tone (1=negative, 5=neutral, 9=positive). VAD model (Russell, 1980).',     interpretation: 'Academic: 4.5-6.5. Slightly above neutral is appropriate.' },
  'L10.2': { label: 'Mean arousal',                  cohMetrix: null,       definition: 'Average urgency/excitement (1=calm, 9=excited).',                                            interpretation: 'Academic: 3.0-5.0. High arousal may signal sensationalism.' },
  'L10.3': { label: 'Mean dominance',                cohMetrix: null,       definition: 'Average assertiveness/control (1=submissive, 9=dominant).',                                   interpretation: 'Academic: 5-7. <4 = overly tentative. >8 = aggressive.' },

  // Sub-construct B: Tonal Trajectory
  'L10.4': { label: 'Valence variability',           cohMetrix: null,       definition: 'Standard deviation of sentence-level valence.',                                               interpretation: 'Low (SD <1.5) = tonal consistency (mature). High = emotional instability.' },
  'L10.5': { label: 'Valence arc slope',             cohMetrix: null,       definition: 'Linear trend in emotional tone from introduction to conclusion.',                             interpretation: 'Slightly positive (+0.01 to +0.10) = constructive resolution.' },
  'L10.6': { label: 'Emotional intrusion index',     cohMetrix: null,       definition: 'Proportion of sentences with inappropriate personal affect in academic context.',              interpretation: 'Lower is better. Flags highly subjective language in reasoned discourse.' },

  // Sub-construct C: Engagement
  'L10.7': { label: 'Affect-argument alignment',     cohMetrix: null,       definition: 'Correlation between high-affect sentences and argument roles.',                               interpretation: 'Higher = emotional language strategically placed. Low = disruptive intrusion.' },
  'L10.8': { label: 'Engagement prediction',         cohMetrix: null,       definition: 'Composite reader engagement score (0-1) from affect, variety, and rhetorical moves.',         interpretation: '>0.7 = engaging. <0.4 = likely monotonous or alienating.' },

  // ═══════════════════════════════════════════════════════════════════════════
  // L11 — Reader-Adaptive Scoring (8 metrics) — NOVEL
  // Meta (Cross-Level)
  // ═══════════════════════════════════════════════════════════════════════════

  // Sub-construct A: Dimension-Specific Challenge
  'L11.1': { label: 'Lexical challenge (z)',          cohMetrix: null,       definition: 'Z-score of vocabulary difficulty relative to learner\'s vocabulary level.',                  interpretation: '+0.5 to +1.5 = appropriately challenging. >+2.0 = too difficult.' },
  'L11.2': { label: 'Syntactic challenge (z)',        cohMetrix: null,       definition: 'Z-score of grammatical complexity relative to learner\'s syntactic fluency.',                interpretation: 'Same scale as L11.1.' },
  'L11.3': { label: 'Semantic gap (z)',               cohMetrix: null,       definition: 'Z-score of conceptual difficulty relative to domain expertise.',                             interpretation: 'Measures knowledge-dependent challenge.' },
  'L11.4': { label: 'Argumentation readiness (z)',    cohMetrix: null,       definition: 'Z-score of argumentative complexity relative to course level.',                              interpretation: 'Graduate-level argumentation may be inaccessible to high school readers.' },

  // Sub-construct B: Composite Adaptive Scores
  'L11.5': { label: 'Global difficulty (z)',          cohMetrix: null,       definition: 'Weighted composite of all challenge z-scores. Overall difficulty for this specific learner.', interpretation: '0 = on-level. +1 = one SD above. Optimal ZPD: +0.5 to +1.5.' },
  'L11.6': { label: 'ZPD proximity index',           cohMetrix: null,       definition: 'Closeness to Zone of Proximal Development (Vygotsky, 1978).',                                interpretation: '~1.0 = optimally targeted. <0.5 = too easy or too hard.' },
  'L11.7': { label: 'Writing-above-level flag',      cohMetrix: null,       definition: 'Binary: is text >1.5 SD above the learner\'s demonstrated level?',                          interpretation: 'Triggers review of whether genuinely above-level or compensatory.' },
  'L11.8': { label: 'Suggested scaffold type',       cohMetrix: null,       definition: 'Categorical: which dimension needs most scaffolding (lexical/syntactic/organizational/argumentative).', interpretation: 'Enables differentiated instruction for this specific learner.' },
};

/**
 * Get definition for a layer, metric, or discourse level.
 */
function getDefinition(id) {
  if (LAYER_DEFINITIONS[id]) return { type: 'layer', ...LAYER_DEFINITIONS[id] };
  if (METRIC_DEFINITIONS[id]) return { type: 'metric', ...METRIC_DEFINITIONS[id] };
  if (DISCOURSE_LEVELS[id]) return { type: 'discourseLevel', ...DISCOURSE_LEVELS[id] };
  return null;
}

/**
 * Get all metrics for a given layer.
 */
function getLayerMetrics(layerId) {
  const prefix = layerId + '.';
  return Object.entries(METRIC_DEFINITIONS)
    .filter(([key]) => key.startsWith(prefix))
    .map(([key, val]) => ({ id: key, ...val }));
}

/**
 * Get metric count summary.
 */
function getMetricSummary() {
  const summary = {};
  for (const [id, layer] of Object.entries(LAYER_DEFINITIONS)) {
    const metrics = getLayerMetrics(id);
    summary[id] = {
      name: layer.name,
      discourseLevel: layer.discourseLevel,
      expected: layer.metricCount,
      defined: metrics.length,
      subConstructs: layer.subConstructs,
    };
  }
  return summary;
}

module.exports = {
  DISCOURSE_LEVELS,
  LAYER_DEFINITIONS,
  METRIC_DEFINITIONS,
  getDefinition,
  getLayerMetrics,
  getMetricSummary,
};
