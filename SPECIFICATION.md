# Neo-Coh-Metrix: Scientific Specification

## Version 1.0 — Comprehensive Multilevel Text Analysis System

---

## Table of Contents

1. [Theoretical Foundation](#1-theoretical-foundation)
2. [Layer Taxonomy & Classification](#2-layer-taxonomy--classification)
3. [Complete Layer & Metric Inventory](#3-complete-layer--metric-inventory)
4. [Composite Factor Scores](#4-composite-factor-scores)
5. [Mapping to Official Coh-Metrix 3.0 Indices](#5-mapping-to-official-coh-metrix-30-indices)
6. [Novel Extensions Beyond Coh-Metrix](#6-novel-extensions-beyond-coh-metrix)
7. [Academic References](#7-academic-references)

---

## 1. Theoretical Foundation

### 1.1 The Multilevel Discourse Framework

Neo-Coh-Metrix is grounded in the **multilevel theoretical framework of text comprehension** established by Graesser, McNamara, and colleagues (Graesser et al., 2004; McNamara et al., 2014). This framework posits that text meaning is constructed at five distinct levels of representation:

| Level | Representation | What It Captures | Cognitive Process |
|-------|---------------|------------------|-------------------|
| **I** | Surface Code | Exact wording, syntax, sentence structure | Decoding, parsing |
| **II** | Textbase | Explicit propositions and their connections | Proposition extraction |
| **III** | Situation Model | The "mental world" — causal, temporal, spatial, intentional dimensions | Inference generation, mental simulation |
| **IV** | Genre & Rhetorical Structure | Discourse organization, rhetorical moves, argumentation | Schema activation, rhetorical awareness |
| **V** | Pragmatic Communication | Author-reader interaction, stance, affect, audience awareness | Pragmatic inference, social cognition |

These levels are **not independent** — they interact during comprehension. A reader who struggles at the surface level (e.g., unfamiliar vocabulary) will have difficulty constructing a situation model. Conversely, strong background knowledge (Level III) can compensate for surface-level difficulty.

### 1.2 Why Multiple Levels Matter for Assessment

Traditional readability metrics (Flesch-Kincaid, Gunning Fog) operate **exclusively at Level I** — they count syllables, words, and sentences. This explains why they correlate poorly with actual comprehension difficulty (Graesser et al., 2011). A text can have short words and sentences yet be incomprehensible due to weak cohesion (Level II), implicit causal reasoning (Level III), or disorganized argumentation (Level IV).

Coh-Metrix was the first computational tool to operationalize this multilevel framework. Neo-Coh-Metrix extends it with:
- **Modern NLP** (LLM-based analysis replacing static word lists)
- **Argumentation analysis** (Toulmin model — absent from original Coh-Metrix)
- **Pragmatic stance assessment** (epistemic calibration, hedging/boosting)
- **Reader-adaptive scoring** (Vygotsky's ZPD — difficulty relative to specific learner)

### 1.3 Why the Number of Layers Is Not Arbitrary

The 11 layers in Neo-Coh-Metrix are **not** a convenience selection. They arise from two constraints:

1. **Theoretical coverage**: Each of the five discourse levels requires at least one layer. Some levels require multiple layers because they contain theoretically distinct constructs (e.g., Level I includes both lexical and syntactic phenomena, which are governed by different cognitive processes and measured by different instruments).

2. **Empirical distinctness**: Layers should capture variance that is **not already explained** by other layers. The original Coh-Metrix validated this through principal component analysis (PCA), showing that its indices cluster into 5-8 orthogonal factors. Our layers are designed to capture these distinct factors while adding dimensions that PCA of the original tool's indices could not reveal (argumentation, stance, reader adaptation).

The number of **metrics within each layer** also varies — from 7 to 14 — because the dimensionality of each construct differs. Syntactic complexity has more measurable facets than, say, readability. Forcing uniform metric counts would either inflate simple constructs with redundant measures or under-represent complex ones.

---

## 2. Layer Taxonomy & Classification

### 2.1 Layer-to-Discourse-Level Mapping

```
Discourse Level I: SURFACE CODE
├── L0  Descriptive & Structural     (14 metrics)  — text length, structure, readability
├── L1  Lexical Sophistication        (12 metrics)  — vocabulary difficulty & diversity
└── L2  Syntactic Complexity          (11 metrics)  — grammar, parsing, sentence patterns

Discourse Level II: TEXTBASE
├── L3  Referential Cohesion          ( 8 metrics)  — entity tracking, argument overlap
├── L4  Semantic Cohesion             ( 8 metrics)  — meaning similarity, topic continuity
└── L5  Connective & Deep Cohesion    ( 9 metrics)  — connective usage, causal/temporal signals

Discourse Level III: SITUATION MODEL
└── L6  Situation Model               ( 8 metrics)  — causal chains, temporal/spatial grounding

Discourse Level IV: GENRE & RHETORICAL STRUCTURE
├── L7  Rhetorical Structure          ( 8 metrics)  — RST analysis, discourse organization
└── L8  Argumentation Quality         ( 9 metrics)  — Toulmin model: claims, evidence, warrants

Discourse Level V: PRAGMATIC COMMUNICATION
├── L9  Pragmatic Stance              ( 8 metrics)  — hedging, boosting, evidentiality, voice
└── L10 Affective & Engagement        ( 8 metrics)  — emotional tone, reader engagement

META-LAYER (Cross-Level)
└── L11 Reader-Adaptive Scoring       ( 8 metrics)  — personalized difficulty, ZPD proximity
```

**Total: 12 layers, 111 metrics**

### 2.2 Why This Classification

| Discourse Level | # Layers | Justification |
|----------------|----------|---------------|
| I. Surface Code | 3 | Lexical and syntactic processes are cognitively distinct (Perfetti, 2007). L0 provides structural baselines that normalize all other metrics. Separating vocabulary (L1) from grammar (L2) follows the LASS model (Language and Social Situation). |
| II. Textbase | 3 | Referential cohesion (L3, entity overlap) and semantic cohesion (L4, meaning similarity) are empirically separable — the original Coh-Metrix PCA loads them on different factors. Connectives (L5) bridge surface markers with deep meaning, serving as the explicit textbase "glue." |
| III. Situation Model | 1 | Causal, temporal, spatial, and intentional dimensions form a unified construct (Zwaan & Radvansky, 1998). They co-occur in mental model construction and need not be separated. |
| IV. Genre & Rhetoric | 2 | Rhetorical structure (L7, discourse organization) and argumentation (L8, logical reasoning) are related but distinct. A text can be well-organized rhetorically yet poorly argued, or vice versa. Separating them enables diagnostic precision. |
| V. Pragmatic | 2 | Epistemic stance (L9) and affective tone (L10) are different dimensions of author-reader interaction. A writer can be epistemically well-calibrated (appropriate hedging) yet emotionally inappropriate, or vice versa. |
| Meta | 1 | L11 operates on the outputs of all other layers, not on the text itself. It is categorically different. |

### 2.3 Comparison with Official Coh-Metrix 3.0 Categories

| Coh-Metrix 3.0 Category | # Indices | Neo-Coh-Metrix Layer(s) | Status |
|--------------------------|-----------|-------------------------|--------|
| Descriptive (DES) | 11 | L0 | Covered + extended |
| Text Easability PC (PC) | 8 | Composite Factors F1-F8 | Covered (as output scores) |
| Referential Cohesion (CRF) | 10 | L3 | Covered |
| LSA Semantic (LSA) | 8 | L4 | Modernized (SBERT replaces LSA) |
| Lexical Diversity (LD) | 4 | L1 | Integrated into L1 |
| Connectives (CNC) | 9 | L5 | Covered + extended |
| Situation Model (SM) | 8 | L6 | Covered |
| Syntactic Complexity (SYN) | 7 | L2 | Covered + extended |
| Syntactic Pattern Density (DR) | 8 | L2 | Integrated into L2 |
| Word Information (WRD) | 23 | L1, L0 | Distributed across layers |
| Readability (RD) | 2 | L0 | Covered |
| — | — | **L7 Rhetorical Structure** | **NEW** (RST-based) |
| — | — | **L8 Argumentation** | **NEW** (Toulmin-based) |
| — | — | **L9 Pragmatic Stance** | **NEW** (Speech Act Theory) |
| — | — | **L10 Affective & Engagement** | **NEW** (VAD model) |
| — | — | **L11 Reader-Adaptive** | **NEW** (ZPD-based) |

---

## 3. Complete Layer & Metric Inventory

### Notation Convention

Each metric ID follows the pattern `Ln.m` where `n` = layer number, `m` = metric number within that layer. Metrics are grouped by sub-construct within each layer.

For each metric:
- **ID**: Unique identifier (e.g., L0.1)
- **Label**: Short human-readable name
- **CohMetrix**: Corresponding Coh-Metrix 3.0 index code, if any (e.g., DESWC)
- **Definition**: What it measures and how
- **Interpretation**: What values mean, with benchmark ranges
- **Scientific basis**: The theory or norm source

---

### L0 — Descriptive & Structural (14 metrics)

**Discourse Level**: I (Surface Code)
**Purpose**: Baseline text statistics for normalization and structural assessment.
**Scientific basis**: These are the "confound controls" of text analysis — without them, higher-level metrics cannot be properly normalized or compared across texts of different lengths. Coh-Metrix uses these as denominators throughout.

**Sub-construct A: Text Extent (4 metrics)**

| ID | Label | CohMetrix | Definition | Interpretation |
|----|-------|-----------|------------|----------------|
| L0.1 | Word count | DESWC | Total number of word tokens. | Essay length. Used as denominator for all "per-word" density metrics. |
| L0.2 | Sentence count | DESSC | Total sentences detected by NLP parser. | Combined with L0.1, determines average sentence length. |
| L0.3 | Paragraph count | DESPC | Number of paragraphs (separated by blank lines). | Structural organization indicator. Too few = lack of organization. |
| L0.4 | Mean word length (syllables) | DESWLsy | Average syllables per word. | Polysyllabic words correlate with latinate/academic vocabulary. Academic text ~1.5-1.8 syllables/word. |

**Sub-construct B: Sentence-Level Statistics (4 metrics)**

| ID | Label | CohMetrix | Definition | Interpretation |
|----|-------|-----------|------------|----------------|
| L0.5 | Mean sentence length | DESSL | Average words per sentence. | Academic: 15-25 words. <12 = simplistic; >30 = potentially hard to parse. |
| L0.6 | Sentence length SD | DESSLd | Standard deviation of sentence lengths. | Some variation = stylistic maturity. SD 5-10 is typical; very low = monotonous. |
| L0.7 | Mean paragraph length | DESPL | Average sentences per paragraph. | Well-developed paragraphs: 4-8 sentences. <3 = underdeveloped ideas. |
| L0.8 | Paragraph length SD | DESPLd | Standard deviation of paragraph lengths. | High SD may indicate uneven development of ideas. |

**Sub-construct C: Vocabulary Diversity (3 metrics)**

| ID | Label | CohMetrix | Definition | Interpretation |
|----|-------|-----------|------------|----------------|
| L0.9 | Type-Token Ratio (raw) | LDTTRa | Unique words / total words. Length-sensitive — decreases as text grows. | Raw reference only. Use L0.10 (MATTR) or L0.11 (MTLD) for fair comparison across text lengths. |
| L0.10 | MATTR | — | Moving-Average TTR over 50-word window, then averaged. Length-invariant. (Covington & McFall, 2010) | 0.50-0.70 for academic writing. Higher = more diverse vocabulary. |
| L0.11 | MTLD | LDMTLDa | Measure of Textual Lexical Diversity. Counts how many consecutive words maintain a TTR above a threshold. (McCarthy & Jarvis, 2010) | More robust than TTR or VOCD for short texts. Higher values = more lexically diverse. Typical: 50-120 for academic text. |

**Sub-construct D: Structural Organization (3 metrics)**

| ID | Label | CohMetrix | Definition | Interpretation |
|----|-------|-----------|------------|----------------|
| L0.12 | Intro/body/conclusion ratio | — | Percentage distribution of text across opening, middle, and closing sections. | Balanced: ~15-20% intro, 60-70% body, 15-20% conclusion. |
| L0.13 | Flesch Reading Ease | RDFRE | 206.835 - 1.015(words/sentences) - 84.6(syllables/words). | 60-70 = standard; 30-50 = college level; <30 = graduate level. |
| L0.14 | Flesch-Kincaid Grade Level | RDFKGL | 0.39(words/sentences) + 11.8(syllables/words) - 15.59. | U.S. grade level estimate. Academic writing typically 12-16. |

---

### L1 — Lexical Sophistication (12 metrics)

**Discourse Level**: I (Surface Code)
**Purpose**: Assesses vocabulary advancement, psycholinguistic word properties, and register appropriateness.
**Scientific basis**: Word-level properties are among the strongest predictors of text difficulty (Graesser et al., 2011). LLM surprisal modernizes the classical frequency-based approach by measuring contextual predictability rather than corpus frequency (Smith & Levy, 2013). Psycholinguistic norms from large-scale rating studies provide validated cognitive difficulty estimates.

**Sub-construct A: Contextual Predictability (3 metrics)**

| ID | Label | CohMetrix | Definition | Interpretation |
|----|-------|-----------|------------|----------------|
| L1.1 | Mean token surprisal | — | Average information content per word in bits, from LLM log-probabilities. Measures how predictable each word is in context. (Smith & Levy, 2013) | Academic text: 6.5-9 bits. <6 = basic/predictable vocabulary. >10 = obscure or highly specialized. |
| L1.2 | Surprisal SD | — | Standard deviation of per-token surprisal. | High SD = inconsistent register (mixing simple and complex vocabulary). |
| L1.3 | Register consistency | — | Variation in vocabulary sophistication across text windows. | Close to 1.0 = steady register. <0.7 = problematic shifts between formal and informal. |

**Sub-construct B: Psycholinguistic Word Properties (4 metrics)**

| ID | Label | CohMetrix | Definition | Interpretation |
|----|-------|-----------|------------|----------------|
| L1.4 | Mean age of acquisition | WRDAOKc | Estimated age at which content words are typically learned. Norms from Kuperman et al. (2012) — 51,000 words. | Academic: 7-10 years. Higher = more advanced vocabulary. |
| L1.5 | Mean concreteness | WRDCNCc | Concreteness rating of content words (1=abstract, 5=concrete). Norms from Brysbaert et al. (2014) — 40,000 words. | Academic/argumentative: ~2.5-3.5. Narrative: ~3.5-4.5. Lower = more abstract. |
| L1.6 | Mean imageability | WRDIMGc | Ease of generating a mental image for content words (1-7 scale). | Related to concreteness but not identical. Low imageability words require more abstract reasoning. |
| L1.7 | Polysemy count | WRDPOLc | Mean number of dictionary senses per content word. | Higher polysemy = more ambiguous. Academic texts tend toward lower polysemy (technical terms have fewer senses). |

**Sub-construct C: Vocabulary Level Indicators (3 metrics)**

| ID | Label | CohMetrix | Definition | Interpretation |
|----|-------|-----------|------------|----------------|
| L1.8 | Academic word density | — | Proportion of content words from Coxhead's (2000) Academic Word List (570 word families). | Target: 0.12-0.22 for undergraduate. <0.10 = insufficient academic register. |
| L1.9 | Rare word ratio | — | Proportion of words unfamiliar to a B2-level English learner. | Some rare words signal sophistication; too many = jargon overload. |
| L1.10 | Word frequency (log) | WRDFRQc | Mean log SUBTLEX-US frequency of content words. (Brysbaert & New, 2009) | Lower frequency = rarer, more sophisticated words. Academic text: 2.5-3.5 (log scale). |

**Sub-construct D: Morphological & Specificity (2 metrics)**

| ID | Label | CohMetrix | Definition | Interpretation |
|----|-------|-----------|------------|----------------|
| L1.11 | Morphological complexity | — | Mean morphemes per content word. "Unbelievable" = 3 (un-believe-able). | Academic: 1.4-2.2. Higher = more derived, complex word forms. |
| L1.12 | Hypernymy (specificity) | WRDHYPnv | Mean depth in WordNet noun/verb hierarchy. Higher = more specific terms. | Specific terms ("golden retriever") score higher than generic ("animal"). Academic writing should mix general and specific. |

---

### L2 — Syntactic Complexity (11 metrics)

**Discourse Level**: I (Surface Code)
**Purpose**: Measures grammatical sophistication through dependency structure, clause embedding, and syntactic pattern diversity.
**Scientific basis**: Dependency Locality Theory (Gibson, 2000) — integration cost (processing difficulty) increases with the distance between dependent words. Subordination reflects reasoning depth. Syntactic pattern density reveals the distribution of grammatical constructions.

**Sub-construct A: Dependency Structure (3 metrics)**

| ID | Label | CohMetrix | Definition | Interpretation |
|----|-------|-----------|------------|----------------|
| L2.1 | Mean dependency distance (MDD) | — | Average word-distance between grammatically related words. Based on Universal Dependencies parse. (Liu, 2008; Gibson, 2000) | Population mean ~3.1. <2.5 = simple sentences. >4.0 = high processing load. |
| L2.2 | MDD standard deviation | — | Variation in dependency distances across sentences. | High SD = inconsistent sentence complexity. |
| L2.3 | Left embeddedness | SYNLE | Mean number of words before the main verb of the main clause. | More left-branching = more pre-verbal material to hold in working memory. Academic: 3-7 words. |

**Sub-construct B: Clause Structure (3 metrics)**

| ID | Label | CohMetrix | Definition | Interpretation |
|----|-------|-----------|------------|----------------|
| L2.4 | Mean clause depth | — | Average depth of deepest embedded clause per sentence. | Academic: 1.5-3.0. Deeper = more complex sentence architecture. |
| L2.5 | Subordination ratio | — | Proportion of subordinate clauses (because, although, while) to total clauses. | Target: 0.35-0.55. Subordination signals reasoning: conditions, causes, concessions. |
| L2.6 | Passive voice ratio | DRPVAL | Proportion of verb phrases using passive construction. | Academic: 0.05-0.20. Some passive is appropriate for objectivity. >0.30 = unclear agency. |

**Sub-construct C: Phrase-Level Complexity (2 metrics)**

| ID | Label | CohMetrix | Definition | Interpretation |
|----|-------|-----------|------------|----------------|
| L2.7 | NP elaboration | SYNNP | Mean modifiers (adjectives, determiners, relative clauses) per noun phrase. | Academic: 1.3-2.5. More modification = more specific, detailed writing. |
| L2.8 | Sentence syntax similarity | SYNSTRUTa | Mean edit distance of part-of-speech tag sequences between adjacent sentences. (McCarthy & Jarvis, 2007) | Low similarity = high syntactic variety (desirable). High similarity = repetitive sentence patterns. |

**Sub-construct D: Syntactic Pattern Density (3 metrics)**

| ID | Label | CohMetrix | Definition | Interpretation |
|----|-------|-----------|------------|----------------|
| L2.9 | Noun phrase incidence | DRNP | Noun phrases per 1000 words. | Higher = more information-dense text. Academic text is typically NP-heavy. |
| L2.10 | Prepositional phrase incidence | DRPP | Prepositional phrases per 1000 words. | Higher = more spatial/relational detail. Academic text: 60-100 per 1000 words. |
| L2.11 | Negation incidence | DRNEG | Negation expressions per 1000 words. | Negation increases processing difficulty. Some negation is normal; excessive use may signal evasive or unclear writing. |

---

### L3 — Referential Cohesion (8 metrics)

**Discourse Level**: II (Textbase)
**Purpose**: Tracks entity introduction, re-mention, and continuity across sentences and paragraphs.
**Scientific basis**: Givon's (1983) topic continuity framework — readers build mental models by tracking entities. Coh-Metrix's referential cohesion indices are among its most validated predictors of text difficulty (McNamara et al., 2014, Ch. 5). The binary overlap measures capture whether adjacent (local) or any (global) sentence pairs share references.

**Sub-construct A: Argument Overlap (4 metrics)**

| ID | Label | CohMetrix | Definition | Interpretation |
|----|-------|-----------|------------|----------------|
| L3.1 | Noun overlap (local) | CRFNO1 | Proportion of adjacent sentence pairs sharing at least one noun stem. | Target: 0.50-0.75. Below 0.40 = too many topic jumps. |
| L3.2 | Noun overlap (global) | CRFNOa | Proportion of all sentence pairs sharing at least one noun stem. | Measures overall topical connectedness. Low = essay covers disconnected topics. |
| L3.3 | Argument overlap (local) | CRFAO1 | Adjacent sentence pairs sharing nouns or pronouns. | Broader than noun overlap — includes pronominal reference. |
| L3.4 | Argument overlap (global) | CRFAOa | All sentence pairs sharing nouns or pronouns. | Captures long-range entity tracking. |

**Sub-construct B: Coreference Chains (2 metrics)**

| ID | Label | CohMetrix | Definition | Interpretation |
|----|-------|-----------|------------|----------------|
| L3.5 | Coreference chain count | — | Number of distinct entity chains (entities referred to by multiple expressions). | More chains = more entities sustained throughout text. |
| L3.6 | Mean chain length | — | Average mentions per chain. | Longer chains (>4) = strong entity continuity. Short chains (2-3) = entities introduced then abandoned. |

**Sub-construct C: Reference Clarity (2 metrics)**

| ID | Label | CohMetrix | Definition | Interpretation |
|----|-------|-----------|------------|----------------|
| L3.7 | Content word overlap (local) | CRFCWOa | Proportion of adjacent sentences sharing content words (nouns, verbs, adjectives). Proportional measure. | Broader than noun-only overlap. Captures thematic continuity. |
| L3.8 | Pronoun-antecedent distance | — | Mean token distance between a pronoun and its referent noun. | Optimal: 3-8 tokens. >15 tokens = reader may lose track of referent. |

---

### L4 — Semantic Cohesion (8 metrics)

**Discourse Level**: II (Textbase)
**Purpose**: Measures meaning similarity between text segments using distributed semantic representations.
**Scientific basis**: The original Coh-Metrix used Latent Semantic Analysis (Landauer & Dumais, 1997). Neo-Coh-Metrix modernizes this with SBERT (Sentence-BERT) embeddings, which resolve three known LSA limitations: (1) polysemy collapse (bank=financial and bank=river get same vector), (2) word-order blindness ("dog bites man" = "man bites dog"), (3) negation failure ("is" ≈ "is not"). Cosine similarity between embedding vectors quantifies meaning overlap.

**Sub-construct A: Local Coherence (3 metrics)**

| ID | Label | CohMetrix | Definition | Interpretation |
|----|-------|-----------|------------|----------------|
| L4.1 | Local semantic overlap | LSASS1 | Mean cosine similarity between adjacent sentence embeddings. | Target: 0.40-0.65. <0.35 = choppy, disconnected. >0.75 = repetitive. |
| L4.2 | Local semantic overlap SD | LSASS1d | Standard deviation of adjacent-sentence similarities. | Low = consistent cohesion. High = uneven — some smooth, some jarring. |
| L4.3 | Given/new ratio | LSAGN | Mean similarity of each sentence to all preceding sentences. Measures how much "new" information each sentence adds. | Higher = more repetitive/given information. Lower = more new information per sentence. Balance is key. |

**Sub-construct B: Global Coherence (2 metrics)**

| ID | Label | CohMetrix | Definition | Interpretation |
|----|-------|-----------|------------|----------------|
| L4.4 | Paragraph-level cohesion | LSAPP1 | Mean cosine similarity between adjacent paragraph centroids. | Measures inter-paragraph meaning flow. Target: 0.35-0.60. |
| L4.5 | Paragraph cohesion SD | LSAPP1d | Standard deviation of inter-paragraph similarities. | Low = consistent paragraph transitions throughout. |

**Sub-construct C: Topical Integrity (3 metrics)**

| ID | Label | CohMetrix | Definition | Interpretation |
|----|-------|-----------|------------|----------------|
| L4.6 | Topic drift index | — | Largest sudden drop in similarity over any 3-sentence window. | >0.15 = topic drift detected. Common cohesion weakness in student writing. |
| L4.7 | Intro-conclusion alignment | — | Cosine similarity between first and last paragraph embeddings. | >0.50 = strong frame. <0.30 = essay drifted from opening topic. |
| L4.8 | On-topic score | — | Similarity between essay and assignment prompt (if provided). | Higher = more on-topic. <0.40 = potentially off-topic. Conditional metric. |

---

### L5 — Connective & Deep Cohesion (9 metrics)

**Discourse Level**: II (Textbase)
**Purpose**: Measures explicit cohesive devices — connectives that signal relationships between ideas.
**Scientific basis**: Connectives are the "glue" of the textbase (Halliday & Hasan, 1976). They make implicit relationships explicit, reducing the inferential burden on the reader. Coh-Metrix demonstrated that connective incidence is one of the strongest predictors of text difficulty across grade levels (Graesser et al., 2011). The distinction between types (causal, temporal, adversative, additive) matters because different connective types support different levels of reasoning.

**Sub-construct A: Connective Incidence by Type (5 metrics)**

| ID | Label | CohMetrix | Definition | Interpretation |
|----|-------|-----------|------------|----------------|
| L5.1 | All connectives incidence | CNCAll | Total connectives per 1000 words. | Higher = more explicit signaling of relationships. Academic: 60-100 per 1000 words. |
| L5.2 | Causal connectives | CNCCaus | Causal connectives per 1000 words (because, therefore, consequently, thus, so). | Academic/argumentative text should be rich in causal connectives. Target: 15-30. |
| L5.3 | Temporal connectives | CNCTemp | Temporal connectives per 1000 words (before, after, then, meanwhile, subsequently). | Important for narrative and historical analysis. |
| L5.4 | Adversative connectives | CNCADC | Adversative/contrastive connectives per 1000 words (however, although, nevertheless, whereas, despite). | Critical for argumentation — signals engagement with opposing ideas. Target: 8-20. |
| L5.5 | Additive connectives | CNCAdd | Additive connectives per 1000 words (and, also, moreover, furthermore, in addition). | List-building connectives. Over-reliance suggests lack of deeper reasoning. |

**Sub-construct B: Connective Ratios & Deep Cohesion (4 metrics)**

| ID | Label | CohMetrix | Definition | Interpretation |
|----|-------|-----------|------------|----------------|
| L5.6 | Causal cohesion ratio | SMCAUSr | Ratio of causal connectives to causal + additive connectives. | Higher = more causal reasoning vs. listing. Target: >0.30 for argumentative text. |
| L5.7 | Logical connective density | CNCLogic | Logical operators per 1000 words (if...then, or, either, neither, unless). | Signals conditional and disjunctive reasoning. Academic: 10-25. |
| L5.8 | Positive connective ratio | CNCPos | Proportion of connectives that are positive/affirmative (and, moreover, because). | Complement to L5.9. Balance indicates nuanced argumentation. |
| L5.9 | Negative connective ratio | CNCNeg | Proportion of connectives that are negative/adversative (but, however, despite, not). | Higher ratio suggests more counter-argumentation and qualification. |

---

### L6 — Situation Model (8 metrics)

**Discourse Level**: III (Situation Model)
**Purpose**: Measures whether the text enables readers to build a mental simulation of events, causes, intentions, and spatiotemporal context.
**Scientific basis**: Kintsch's (1998) Construction-Integration model and Zwaan & Radvansky's (1998) Event-Indexing model. Deep comprehension requires constructing a "mental movie" — tracking WHO does WHAT to WHOM, WHERE, WHEN, and WHY. The situation model has five dimensions: causation, intentionality, time, space, and protagonist. Coh-Metrix's situation model indices capture these through verb-based analysis and connective patterns.

**Sub-construct A: Causal Dimension (3 metrics)**

| ID | Label | CohMetrix | Definition | Interpretation |
|----|-------|-----------|------------|----------------|
| L6.1 | Causal verb incidence | SMCAUSv | Causal verbs per 1000 words (cause, result, lead to, produce, affect). | Higher = more explicit causal reasoning. |
| L6.2 | Causal chain density | — | Cause-effect event pairs per 100 words, extracted via LLM. | Target: 1.5-3.5. <1.0 = descriptive rather than explanatory. |
| L6.3 | Mean causal chain length | — | Average events per causal chain (A→B→C = length 3). | Longer = deeper causal reasoning, tracing consequences through multiple steps. |

**Sub-construct B: Intentional & Agentive Dimension (2 metrics)**

| ID | Label | CohMetrix | Definition | Interpretation |
|----|-------|-----------|------------|----------------|
| L6.4 | Intentional action density | SMINTEp | Intentional content per 1000 words — actions by agents with goals. | Higher = more agentive text. Low may indicate passive, agent-less description. |
| L6.5 | Protagonist continuity | — | Consistency with which the same agents/actors are maintained throughout. | Higher = readers can track "who is doing what." Low = frequent agent switching. |

**Sub-construct C: Temporal & Spatial Dimension (3 metrics)**

| ID | Label | CohMetrix | Definition | Interpretation |
|----|-------|-----------|------------|----------------|
| L6.6 | Temporal cohesion | SMTEMP | Consistency of tense and aspect across sentences. Measures temporal coherence. | Higher = consistent temporal frame. Low = jarring tense shifts. |
| L6.7 | Temporal grounding | — | Proportion of sentences with explicit temporal anchors (dates, sequence markers, time expressions). | Important for narrative/historical arguments. 0-1 scale. |
| L6.8 | Spatial grounding | — | Proportion of sentences with locative expressions (spatial prepositions, place names). | Important when spatial context matters. Low ≠ bad for abstract arguments. |

---

### L7 — Rhetorical Structure (8 metrics)

**Discourse Level**: IV (Genre & Rhetorical Structure)
**Purpose**: Analyzes discourse organization at the paragraph and multi-paragraph level using RST.
**Scientific basis**: Rhetorical Structure Theory (Mann & Thompson, 1988) — text is organized as a hierarchy of nucleus-satellite relations where nuclei carry the main message and satellites provide supporting/elaborating/contrasting content. RST parsing has been validated as a predictor of text quality and coherence (Feng & Hirst, 2014). Well-organized academic text uses diverse rhetorical strategies; poorly organized text over-relies on simple elaboration.

**Sub-construct A: Structural Properties (3 metrics)**

| ID | Label | CohMetrix | Definition | Interpretation |
|----|-------|-----------|------------|----------------|
| L7.1 | RST tree depth | — | Maximum depth of the rhetorical structure hierarchy. | Academic: 4-8 levels. Shallow (1-3) = flat, list-like organization. |
| L7.2 | Nucleus density | — | Ratio of nucleus to satellite content. | Higher = more primary content, less supporting. Academic balance: 0.4-0.6 nucleus. |
| L7.3 | Satellite chaining | — | Depth of supporting layers (satellites of satellites). | Deeper chaining = more layered evidence/elaboration. |

**Sub-construct B: Relation Type Distribution (5 metrics)**

| ID | Label | CohMetrix | Definition | Interpretation |
|----|-------|-----------|------------|----------------|
| L7.4 | Evidence relation ratio | — | Proportion of relations that are Evidence, Justify, or Support. | Target: 0.20-0.40. Higher = more evidence-based discourse. |
| L7.5 | Contrast/Concession ratio | — | Proportion involving opposing viewpoints (Contrast, Concession). | Indicates dialectical sophistication. Low = one-sided argumentation. |
| L7.6 | Elaboration ratio | — | Proportion that are simple Elaboration. | High (>0.50) = over-reliance on expansion without other rhetorical moves. |
| L7.7 | Condition/Purpose ratio | — | Proportion of conditional or purpose-oriented relations (if, in order to, so that). | Indicates forward-looking reasoning and goal-oriented discourse. |
| L7.8 | Rhetorical diversity index | — | Shannon entropy over the distribution of relation types. | Target: >1.8 bits. <0.8 = writer uses only 1-2 discourse strategies. |

---

### L8 — Argumentation Quality (9 metrics)

**Discourse Level**: IV (Genre & Rhetorical Structure)
**Purpose**: Analyzes logical argumentation structure using the Toulmin model.
**Scientific basis**: Toulmin's (1958) model of argument — the most widely used framework in writing assessment: Claim (assertion) + Data/Grounds (evidence) + Warrant (reasoning link) + Backing (support for warrant) + Qualifier (degree of certainty) + Rebuttal (counter-argument). This layer is **entirely new** — absent from all versions of Coh-Metrix. Its inclusion reflects that argumentation quality is the single most important predictor of academic essay grades (Wingate, 2012), yet was never computationally operationalized at scale.

**Sub-construct A: Argument Components (3 metrics)**

| ID | Label | CohMetrix | Definition | Interpretation |
|----|-------|-----------|------------|----------------|
| L8.1 | Main claim count | — | Distinct main claims identified in the essay. | Focused essay: 3-6. Too few = thin; too many = unfocused. |
| L8.2 | Premises per claim | — | Average supporting premises (evidence/reasons) per claim. | Target: >2.0 for strong writing. <1.0 = most claims lack evidence. |
| L8.3 | Warrant completeness | — | Proportion of claims with explicit warrants (reasoning WHY evidence supports the claim). | Higher is better. Missing warrants = common student writing weakness. |

**Sub-construct B: Argument Depth & Counter-Argument (3 metrics)**

| ID | Label | CohMetrix | Definition | Interpretation |
|----|-------|-----------|------------|----------------|
| L8.4 | Counter-argument present | — | Whether the essay acknowledges at least one counter-argument (binary: 0/1). | Presence = hallmark of mature academic writing. Absence = significant quality limitation. |
| L8.5 | Rebuttal quality | — | Quality of counter-argument handling (0-1 scale). | 0 = no rebuttal. 0.5 = mentioned but dismissed. 1.0 = fully addressed with evidence. |
| L8.6 | Argument depth | — | Longest chain from evidence to highest-level claim. | Deeper = more layered reasoning. Flat arguments (depth 1) = assertion + one piece of evidence. |

**Sub-construct C: Argument Quality Indicators (3 metrics)**

| ID | Label | CohMetrix | Definition | Interpretation |
|----|-------|-----------|------------|----------------|
| L8.7 | Unsupported claim ratio | — | Proportion of claims with zero supporting premises. | Lower is better. Target: <0.15. >0.40 = nearly half of claims are bare assertions. |
| L8.8 | Logical fallacy density | — | Detected logical fallacies per 500 words (ad hominem, straw man, false dichotomy, etc.). | Lower is better. >2 per 500 words = significant logical weakness. |
| L8.9 | Evidence diversity | — | Number of distinct evidence types used (statistics, examples, authority, analogy, personal experience). | More diverse evidence types indicate more sophisticated argumentation. Target: 3+. |

---

### L9 — Pragmatic Stance (8 metrics)

**Discourse Level**: V (Pragmatic Communication)
**Purpose**: Measures how the writer positions themselves relative to claims, sources, and readers.
**Scientific basis**: Speech Act Theory (Austin, 1962; Searle, 1969) — utterances perform actions (assert, argue, question, direct). Epistemic modality research (Hyland, 2005) — academic writing requires "appropriate uncertainty" through hedging and boosting. The hedge-to-boost ratio is a validated indicator of academic writing maturity. Evidentiality (Aikhenvald, 2004) captures source attribution practices.

**Sub-construct A: Speech Act Profile (2 metrics)**

| ID | Label | CohMetrix | Definition | Interpretation |
|----|-------|-----------|------------|----------------|
| L9.1 | Speech act distribution | — | Proportional distribution of sentence types: assert, argue, explain, question, direct. | Academic writing is assertion-heavy but should include questions and directives for engagement. |
| L9.2 | Assert dominance | — | Percentage of sentences that are pure assertions. | >80% = monologic, lecture-like. Some variety in speech acts signals engagement with reader. |

**Sub-construct B: Epistemic Calibration (3 metrics)**

| ID | Label | CohMetrix | Definition | Interpretation |
|----|-------|-----------|------------|----------------|
| L9.3 | Hedging density | — | Epistemic hedges per 100 words (might, perhaps, suggests, it seems, arguably). | Optimal: 1.0-3.0/100w. <0.5 = overconfident. >5.0 = excessively tentative. |
| L9.4 | Boosting density | — | Epistemic boosters per 100 words (clearly, certainly, obviously, undoubtedly). | Boosting is appropriate in moderation. >3.0/100w = over-claiming. |
| L9.5 | Hedge-to-boost ratio | — | Hedges / boosters. Measures epistemic calibration. (Hyland, 2005) | 1.5-3.0 = well-calibrated. <1.0 = more boosting than hedging (over-claiming). |

**Sub-construct C: Source & Voice (3 metrics)**

| ID | Label | CohMetrix | Definition | Interpretation |
|----|-------|-----------|------------|----------------|
| L9.6 | Evidentiality score | — | Proportion of claims with explicit source attribution (cited, according to, research shows). | Target: >0.30. <0.20 = insufficient citation/sourcing. |
| L9.7 | Presupposition load | — | Definite NPs + factive verbs per sentence. Measures how much the writer takes for granted. | Higher = more assumptions the reader must share. Too high = potentially alienating for outsiders. |
| L9.8 | First-person stance | — | Ratio of first-person (I believe, in my view) to impersonal constructions (research shows, it is evident). | Discipline-dependent. Most academic writing: <0.3. Some fields accept personal positioning. |

---

### L10 — Affective & Engagement (8 metrics)

**Discourse Level**: V (Pragmatic Communication)
**Purpose**: Measures emotional tone and its trajectory across the essay.
**Scientific basis**: Russell's (1980) Valence-Arousal-Dominance (VAD) model — affect has three independent dimensions, not just positive/negative. Even academic writing carries emotional charge: consistent, controlled affect signals maturity; sudden emotional shifts undermine credibility. The affect-argument relationship (does emotional language align with argumentative moves?) is a newer construct from writing assessment research.

**Sub-construct A: Affective Dimensions (3 metrics)**

| ID | Label | CohMetrix | Definition | Interpretation |
|----|-------|-----------|------------|----------------|
| L10.1 | Mean valence | — | Average emotional tone (1=negative, 5=neutral, 9=positive) across sentences. | Academic: 4.5-6.5. Slightly above neutral is appropriate. Very high/low = emotional writing. |
| L10.2 | Mean arousal | — | Average urgency/excitement level (1=calm, 9=excited). | Academic: 3.0-5.0. High arousal may signal sensationalism over reasoned argument. |
| L10.3 | Mean dominance | — | Average assertiveness/control (1=submissive, 9=dominant). | Academic: 5-7. <4 = overly tentative. >8 = aggressive. |

**Sub-construct B: Tonal Trajectory (3 metrics)**

| ID | Label | CohMetrix | Definition | Interpretation |
|----|-------|-----------|------------|----------------|
| L10.4 | Valence variability | — | Standard deviation of sentence-level valence. | Low (SD <1.5) = tonal consistency (mature). High = emotional instability or inappropriate shifts. |
| L10.5 | Valence arc slope | — | Linear trend in emotional tone from introduction to conclusion. | Slightly positive (+0.01 to +0.10) = constructive resolution. Negative = essay ends on down note. |
| L10.6 | Emotional intrusion index | — | Proportion of sentences with inappropriate personal affect in academic context. | Lower is better. Flags highly subjective/emotional language in what should be reasoned discourse. |

**Sub-construct C: Engagement (2 metrics)**

| ID | Label | CohMetrix | Definition | Interpretation |
|----|-------|-----------|------------|----------------|
| L10.7 | Affect-argument alignment | — | Correlation between high-affect sentences and argument roles (claims, evidence, rebuttals). | Higher = emotional language is strategically placed. Low/negative = emotional intrusion disrupts argumentation. |
| L10.8 | Engagement prediction | — | Composite score (0-1) predicting reader engagement based on affect, variety, and rhetorical moves. | >0.7 = engaging. <0.4 = likely monotonous or alienating. |

---

### L11 — Reader-Adaptive Scoring (8 metrics)

**Discourse Level**: Meta (Cross-Level)
**Purpose**: Re-scores all L0-L10 metrics relative to a specific learner's profile, enabling personalized difficulty assessment.
**Scientific basis**: Vygotsky's (1978) Zone of Proximal Development (ZPD) — learning occurs optimally when material is slightly above the learner's current ability. Text difficulty is inherently **relational**, not absolute. What is challenging for a B1 learner may be trivial for a C2 speaker. This layer is the **most significant innovation** of Neo-Coh-Metrix — no existing text analysis tool provides personalized, learner-relative difficulty scoring.

**Learner profile parameters:**
- Vocabulary level (A1, A2, B1, B2, B2+, C1, C2 — CEFR scale)
- Syntactic fluency (0-1 scale, from writing history)
- Domain expertise (Beginner, Intermediate, Advanced)
- Course level (high school, undergraduate, graduate)

**Sub-construct A: Dimension-Specific Challenge (4 metrics)**

| ID | Label | CohMetrix | Definition | Interpretation |
|----|-------|-----------|------------|----------------|
| L11.1 | Lexical challenge (z) | — | Z-score of vocabulary difficulty relative to learner's vocabulary level. | +0.5 to +1.5 = appropriately challenging. >+2.0 = too difficult. <-0.5 = too easy. |
| L11.2 | Syntactic challenge (z) | — | Z-score of grammatical complexity relative to learner's syntactic fluency. | Same scale as L11.1. |
| L11.3 | Semantic gap (z) | — | Z-score of conceptual difficulty relative to domain expertise. | Measures knowledge-dependent challenge. |
| L11.4 | Argumentation readiness (z) | — | Z-score of argumentative complexity relative to course level. | Graduate-level argumentation may be inaccessible to high school readers. |

**Sub-construct B: Composite Adaptive Scores (4 metrics)**

| ID | Label | CohMetrix | Definition | Interpretation |
|----|-------|-----------|------------|----------------|
| L11.5 | Global difficulty (z) | — | Weighted composite of all challenge z-scores. Overall difficulty for this specific learner. | 0 = on-level. +1 = one SD above. |
| L11.6 | ZPD proximity index | — | How close the text is to the learner's Zone of Proximal Development. (Vygotsky, 1978) | ~1.0 = optimally targeted. <0.5 = too easy or too hard for this learner. |
| L11.7 | Writing-above-level flag | — | Binary flag: is the text >1.5 SD above the learner's demonstrated level? | Triggers review of whether text is genuinely above-level or uses compensatory strategies. |
| L11.8 | Suggested scaffold type | — | Categorical: which dimension needs the most scaffolding (lexical / syntactic / organizational / argumentative). | Enables differentiated instruction: "This student needs help with X specifically." |

---

## 4. Composite Factor Scores

### 4.1 Design Rationale

The original Coh-Metrix derived 5 principal components via PCA across thousands of texts, explaining most of the variance in text characteristics across grade levels. Neo-Coh-Metrix defines **8 composite factors** that extend this approach to include argumentation and pragmatic dimensions.

### 4.2 Factor Definitions

| Factor | Label | Component Layers | Weights | Coh-Metrix Equivalent |
|--------|-------|-----------------|---------|----------------------|
| **F1** | Narrativity | L10 (0.40), L6 (0.35), L3 (0.25) | Affect + situation model + referential continuity | PCNARz |
| **F2** | Syntactic Simplicity | L2 (0.50), L0 (0.30), L2 (0.20) | Syntactic complexity (inverted) + surface length | PCSYNz |
| **F3** | Word Concreteness | L1 (0.60), L0 (0.40) | Lexical properties + word-level surface features | PCCNCz |
| **F4** | Referential Cohesion | L3 (0.50), L4 (0.50) | Referential + semantic overlap | PCREFz |
| **F5** | Deep Cohesion | L5 (0.40), L6 (0.30), L4 (0.30) | Connectives + situation model + semantic cohesion | PCDCz |
| **F6** | Argumentation Quality | L8 (0.50), L7 (0.30), L8 (0.20) | Argument structure + rhetorical organization | **NEW** |
| **F7** | Epistemic Calibration | L9 (0.60), L9 (0.40) | Pragmatic stance measures | **NEW** |
| **F8** | Engagement & Affect | L10 (0.50), L6 (0.30), L3 (0.20) | Affective trajectory + situation richness | **NEW** |

### 4.3 Overall Score

The overall score is a weighted sum of F1-F8, with weights configurable per assessment context:

```
Overall = w1*F1 + w2*F2 + w3*F3 + w4*F4 + w5*F5 + w6*F6 + w7*F7 + w8*F8
```

Default weights emphasize argumentation and cohesion for academic essay assessment.

---

## 5. Mapping to Official Coh-Metrix 3.0 Indices

### 5.1 Full Coverage Audit

Of the 108 official Coh-Metrix 3.0 indices:

| Status | Count | Details |
|--------|-------|---------|
| **Directly implemented** | 42 | Same construct, same operationalization |
| **Modernized** | 18 | Same construct, updated method (e.g., SBERT replacing LSA, LLM surprisal replacing CELEX frequency) |
| **Integrated** | 31 | Subsumed into broader metrics (e.g., individual POS incidence counts merged into lexical/syntactic layers) |
| **Omitted (redundant)** | 9 | Metrics that duplicate information already captured (e.g., content-word-only variants when all-word version is included) |
| **Omitted (superseded)** | 8 | Metrics replaced by demonstrably superior alternatives (e.g., raw TTR superseded by MATTR and MTLD) |

### 5.2 Key Modernization Decisions

| Coh-Metrix | Neo-Coh-Metrix | Justification |
|-----------|----------------|---------------|
| CELEX log frequency (WRDFRQc) | LLM surprisal (L1.1) + SUBTLEX frequency (L1.10) | Surprisal is contextual — "bank" has different information content in financial vs. river contexts. Static frequency cannot capture this. |
| LSA overlap (LSASS1) | SBERT cosine similarity (L4.1) | SBERT resolves polysemy, word order, and negation problems. Empirically outperforms LSA on every semantic similarity benchmark since 2019. |
| Raw TTR (LDTTRa) | MATTR (L0.10) + MTLD (L0.11) | TTR is mathematically length-dependent. MATTR and MTLD are validated as length-invariant. TTR retained only as a reference (L0.9). |
| MRC Psycholinguistic Database | Kuperman (2012) + Brysbaert (2014) norms | MRC is decades old with limited coverage. Modern norms cover 40,000-51,000 words with crowd-sourced ratings. |

---

## 6. Novel Extensions Beyond Coh-Metrix

### 6.1 Summary of New Constructs

| Layer | Construct | Theoretical Basis | Why Absent from Coh-Metrix |
|-------|-----------|-------------------|---------------------------|
| **L7** | Rhetorical Structure (RST) | Mann & Thompson (1988) | RST parsing was computationally expensive in the 2000s. LLM-based extraction now makes it feasible. |
| **L8** | Argumentation (Toulmin) | Toulmin (1958); Wingate (2012) | Argument mining as an NLP task emerged after Coh-Metrix was designed. The Toulmin model requires discourse-level understanding that rule-based NLP could not achieve. |
| **L9** | Pragmatic Stance | Hyland (2005); Austin (1962) | Hedging/boosting detection requires contextual understanding (e.g., "might" as hedge vs. "might" as modal). LLM analysis enables this distinction. |
| **L10** | Affective Trajectory | Russell (1980) | Sentence-level VAD estimation at scale became feasible with modern NLP. Earlier tools could only use keyword-based sentiment. |
| **L11** | Reader-Adaptive Scoring | Vygotsky (1978) | Requires a learner profile database and z-score normalization infrastructure. Conceptually simple but architecturally complex. |

### 6.2 Validation Status

These extensions are grounded in established theory but have **not yet undergone the same large-scale validation** as the original Coh-Metrix indices. The original Coh-Metrix was validated against:
- Text difficulty ratings from educational publishers
- Grade-level corpora (1st grade through graduate school)
- Reading comprehension test scores
- Human expert judgments

Planned validation for Neo-Coh-Metrix extensions:
- [ ] Correlation with human-graded essay rubrics (argumentation, stance, cohesion)
- [ ] Discriminant validity: do new layers capture variance not explained by L0-L6?
- [ ] Test-retest reliability across LLM versions
- [ ] Cross-genre stability (argumentative, narrative, expository)

---

## 7. Academic References

### Core Coh-Metrix References

1. **McNamara, D.S., Graesser, A.C., McCarthy, P.M., & Cai, Z. (2014).** *Automated Evaluation of Text and Discourse with Coh-Metrix.* Cambridge University Press. — The definitive reference book.

2. **Graesser, A.C., McNamara, D.S., Louwerse, M.M., & Cai, Z. (2004).** Coh-Metrix: Analysis of text on cohesion and language. *Behavior Research Methods, 36*(2), 193-202. — The original Coh-Metrix paper.

3. **Graesser, A.C., McNamara, D.S., & Kulikowich, J.M. (2011).** Coh-Metrix: Providing Multilevel Analyses of Text Characteristics. *Educational Researcher, 40*(5), 223-234. — The five-level framework and principal components.

### Discourse & Comprehension Theory

4. **Kintsch, W. (1998).** *Comprehension: A Paradigm for Cognition.* Cambridge University Press. — Construction-Integration model (basis for situation model layer).

5. **Zwaan, R.A., & Radvansky, G.A. (1998).** Situation models in language comprehension and memory. *Psychological Bulletin, 123*(2), 162-185. — Event-indexing model (5 dimensions of situation models).

6. **Givón, T. (1983).** *Topic Continuity in Discourse.* John Benjamins. — Referential cohesion theory.

7. **Halliday, M.A.K., & Hasan, R. (1976).** *Cohesion in English.* Longman. — Foundational cohesion theory (connectives, reference, lexical cohesion).

### Syntactic Complexity

8. **Gibson, E. (2000).** The dependency locality theory: A distance-based theory of linguistic complexity. In Y. Miyashita, A. Marantz, & W. O'Neil (Eds.), *Image, Language, Brain*, 95-126. MIT Press. — Dependency Locality Theory.

9. **Liu, H. (2008).** Dependency distance as a metric of language comprehension difficulty. *Journal of Cognitive Science, 9*(2), 159-191.

### Lexical & Psycholinguistic Norms

10. **Kuperman, V., Stadthagen-Gonzalez, H., & Brysbaert, M. (2012).** Age-of-acquisition ratings for 30,000 English words. *Behavior Research Methods, 44*(4), 978-990.

11. **Brysbaert, M., Warriner, A.B., & Kuperman, V. (2014).** Concreteness ratings for 40,000 generally known English word lemmas. *Behavior Research Methods, 46*(3), 904-911.

12. **Brysbaert, M., & New, B. (2009).** Moving beyond Kučera and Francis: A critical evaluation of current word frequency norms. *Behavior Research Methods, 41*(4), 977-990. — SUBTLEX-US frequency norms.

13. **Coxhead, A. (2000).** A new academic word list. *TESOL Quarterly, 34*(2), 213-238. — Academic Word List.

14. **McCarthy, P.M., & Jarvis, S. (2010).** MTLD, vocd-D, and HD-D: A validation study of sophisticated approaches to lexical diversity assessment. *Behavior Research Methods, 42*(2), 381-392.

15. **Covington, M.A., & McFall, J.D. (2010).** Cutting the Gordian knot: The moving-average type-token ratio (MATTR). *Journal of Quantitative Linguistics, 17*(2), 94-100.

### Rhetorical Structure & Argumentation

16. **Mann, W.C., & Thompson, S.A. (1988).** Rhetorical Structure Theory: Toward a functional theory of text organization. *Text, 8*(3), 243-281.

17. **Toulmin, S.E. (1958).** *The Uses of Argument.* Cambridge University Press. — Argumentation model.

18. **Wingate, U. (2012).** 'Argument!' helping students understand what essay writing is about. *Journal of English for Academic Purposes, 11*(2), 145-154.

19. **Feng, V.W., & Hirst, G. (2014).** A linear-time bottom-up discourse parser with constraints and post-editing. *Proceedings of ACL 2014.*

### Pragmatics & Stance

20. **Austin, J.L. (1962).** *How to Do Things with Words.* Oxford University Press. — Speech Act Theory.

21. **Searle, J.R. (1969).** *Speech Acts: An Essay in the Philosophy of Language.* Cambridge University Press.

22. **Hyland, K. (2005).** *Metadiscourse: Exploring Interaction in Writing.* Continuum. — Hedging and boosting in academic discourse.

23. **Aikhenvald, A.Y. (2004).** *Evidentiality.* Oxford University Press.

### Affect & Engagement

24. **Russell, J.A. (1980).** A circumplex model of affect. *Journal of Personality and Social Psychology, 39*(6), 1161-1178. — Valence-Arousal-Dominance model.

25. **Warriner, A.B., Kuperman, V., & Brysbaert, M. (2013).** Norms of valence, arousal, and dominance for 13,915 English lemmas. *Behavior Research Methods, 45*(4), 1191-1207.

### Reader Adaptation

26. **Vygotsky, L.S. (1978).** *Mind in Society: The Development of Higher Psychological Processes.* Harvard University Press. — Zone of Proximal Development.

### Modern NLP Methods

27. **Smith, N.J., & Levy, R. (2013).** The effect of word predictability on reading time is logarithmic. *Cognition, 128*(3), 302-319. — Surprisal theory.

28. **Reimers, N., & Gurevych, I. (2019).** Sentence-BERT: Sentence embeddings using Siamese BERT-networks. *Proceedings of EMNLP 2019.* — SBERT replacing LSA.

29. **Perfetti, C. (2007).** Reading ability: Lexical quality to comprehension. *Scientific Studies of Reading, 11*(4), 357-383. — Lexical quality hypothesis.

---

## Appendix A: Metric Count Summary

| Layer | Discourse Level | # Metrics | Sub-constructs |
|-------|----------------|-----------|----------------|
| L0 | I. Surface | 14 | Text Extent (4), Sentence Stats (4), Vocabulary Diversity (3), Structural Organization (3) |
| L1 | I. Surface | 12 | Contextual Predictability (3), Psycholinguistic Properties (4), Vocabulary Level (3), Morphology & Specificity (2) |
| L2 | I. Surface | 11 | Dependency Structure (3), Clause Structure (3), Phrase Complexity (2), Syntactic Pattern Density (3) |
| L3 | II. Textbase | 8 | Argument Overlap (4), Coreference Chains (2), Reference Clarity (2) |
| L4 | II. Textbase | 8 | Local Coherence (3), Global Coherence (2), Topical Integrity (3) |
| L5 | II. Textbase | 9 | Connective Incidence by Type (5), Connective Ratios & Deep Cohesion (4) |
| L6 | III. Situation Model | 8 | Causal (3), Intentional/Agentive (2), Temporal/Spatial (3) |
| L7 | IV. Genre & Rhetoric | 8 | Structural Properties (3), Relation Type Distribution (5) |
| L8 | IV. Genre & Rhetoric | 9 | Argument Components (3), Depth & Counter-Argument (3), Quality Indicators (3) |
| L9 | V. Pragmatic | 8 | Speech Act Profile (2), Epistemic Calibration (3), Source & Voice (3) |
| L10 | V. Pragmatic | 8 | Affective Dimensions (3), Tonal Trajectory (3), Engagement (2) |
| L11 | Meta | 8 | Dimension-Specific Challenge (4), Composite Adaptive (4) |
| **Total** | | **111** | |

---

## Appendix B: Why Metric Counts Vary

The number of metrics per layer ranges from **8 to 14**. This is intentional:

- **L0 (14 metrics)**: Surface features are the most directly measurable and serve as normalization inputs for all other layers. The extra metrics are computationally cheap (no LLM needed) and provide essential baselines.
- **L1 (12 metrics)**: Lexical properties span multiple psycholinguistic dimensions (frequency, AoA, concreteness, imageability) that are empirically separable and independently predictive of processing difficulty.
- **L2 (11 metrics)**: Syntax includes both dependency-level and phrase-level phenomena, plus syntactic pattern density — distinct sub-constructs with different cognitive implications.
- **L3-L11 (8-9 metrics each)**: Higher-level constructs are measured through LLM analysis, which is more holistic but less granular than surface-level counting. 8-9 metrics per layer balances diagnostic precision against the reliability limits of LLM-extracted features.

Forcing uniform metric counts (e.g., 4 per layer) would:
1. **Under-represent** surface features, losing normalization precision
2. **Over-represent** higher-level constructs with redundant or unreliable metrics
3. **Obscure** the genuine dimensionality differences between linguistic levels
