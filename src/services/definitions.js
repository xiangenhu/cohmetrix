/**
 * Definitions Store
 *
 * Canonical definitions for all layers and metrics, drawn from the
 * Neo-Coh-Metrix specification. These are the "ground truth" descriptions
 * that the help chat paraphrases for the target audience.
 */

const LAYER_DEFINITIONS = {
  L0: {
    name: 'Surface & Structural',
    definition: 'Surface metrics measure basic text properties like word count, sentence length, and vocabulary diversity. They serve as normalization denominators for higher-level metrics and as simple readability proxies. MATTR (Moving-Average Type-Token Ratio) is preferred over raw TTR because TTR is length-sensitive — it decreases as text lengthens even if vocabulary diversity is constant.',
    why: 'These basic measurements help control for text length and establish baselines that all other layers build upon.',
  },
  L1: {
    name: 'Lexical Sophistication',
    definition: 'Lexical sophistication measures how advanced or demanding the vocabulary is. Modern NLP replaces static word-frequency lists with LLM surprisal — a measure of how predictable each word is in context. Higher surprisal means a word is less expected, requiring more processing effort from the reader. Age-of-acquisition (AoA) estimates when a typical person learns each word. Academic Word List (AWL) density measures the proportion of words from Coxhead\'s (2000) academic vocabulary list.',
    why: 'Vocabulary choice is one of the strongest predictors of text difficulty and writer sophistication. Appropriate lexical complexity signals academic register competence.',
  },
  L2: {
    name: 'Syntactic Complexity',
    definition: 'Syntactic complexity measures how grammatically complex the sentences are. Mean Dependency Distance (MDD) from Dependency Locality Theory (Gibson, 2000) measures the average distance between grammatically related words — longer distances create higher processing load. Subordination ratio measures how many clauses are embedded within other clauses. Passive voice and noun phrase elaboration indicate additional grammatical complexity.',
    why: 'Syntactic complexity reflects the writer\'s ability to construct nuanced arguments using varied sentence structures. Too little complexity suggests simplistic writing; too much can impede comprehension.',
  },
  L3: {
    name: 'Referential Cohesion',
    definition: 'Referential cohesion tracks how well the text re-introduces and maintains entities (people, concepts, things) across sentences. Local argument overlap measures whether adjacent sentences share noun references. Coreference chain analysis identifies when the same entity is referred to by different words (e.g., "AI systems... they... these tools"). Longer chains mean entities are sustained throughout the text, improving coherence.',
    why: 'When writers consistently refer back to established entities, readers can build a connected mental model of the text. Weak referential cohesion forces readers to guess what "it" or "this" refers to.',
  },
  L4: {
    name: 'Semantic Cohesion',
    definition: 'Semantic cohesion measures how well the meaning connects between sentences and paragraphs. Using sentence embeddings (vector representations of meaning), we compute cosine similarity between adjacent sentences (local overlap) and across the whole document (global overlap). Topic drift index detects where meaning suddenly shifts. Intro-conclusion alignment checks whether the essay\'s ending connects back to its beginning.',
    why: 'Semantic cohesion ensures the reader can follow the logical thread of the argument. Topic drift — a sudden meaning shift without transition — is one of the most common cohesion problems in student writing.',
  },
  L5: {
    name: 'Situation Model',
    definition: 'The situation model layer measures whether the text helps readers build a mental simulation of what is being described. Based on Kintsch\'s (1998) Construction-Integration theory, it examines causal chains (cause-effect relationships), temporal grounding (when events happen), spatial grounding (where events happen), and intentional actions (who does what and why). LLM analysis extracts these structures from the text.',
    why: 'Deep comprehension requires more than surface understanding — readers need to construct a "mental movie" of the events and relationships described. Stronger situation models lead to better retention and transfer.',
  },
  L6: {
    name: 'Rhetorical Structure',
    definition: 'Rhetorical structure analyzes how discourse segments relate to each other using Rhetorical Structure Theory (RST). Relations include Elaboration (expanding on a point), Evidence (supporting a claim), Contrast (opposing ideas), and Concession (acknowledging counter-points). Tree depth measures organizational complexity. Rhetorical diversity (Shannon entropy) measures the variety of relations used.',
    why: 'Well-organized essays use diverse rhetorical relations to build layered arguments. Over-reliance on simple elaboration suggests the writer isn\'t engaging with opposing perspectives or supporting claims with evidence.',
  },
  L7: {
    name: 'Argumentation',
    definition: 'Argumentation analysis uses the Toulmin (1958) model to identify: Claims (assertions the writer tries to prove), Premises (evidence or reasons supporting claims), Warrants (reasoning connecting evidence to claims), and Rebuttals (counter-arguments acknowledged). Key metrics include premises-per-claim ratio (how well-supported each claim is), unsupported claim ratio (claims with zero evidence), and whether counter-arguments are addressed.',
    why: 'Argumentation quality is the most direct measure of academic writing competence. Strong essays support claims with evidence and anticipate objections. This layer was entirely absent from the original Coh-Metrix.',
  },
  L8: {
    name: 'Pragmatic Stance',
    definition: 'Pragmatic stance measures how the writer positions themselves relative to their claims and readers. This includes hedging (words like "might," "perhaps," "suggests" that signal uncertainty), boosting (words like "clearly," "certainly" that signal confidence), evidentiality (citing sources or evidence), and the balance between personal ("I believe") and impersonal ("research shows") voice.',
    why: 'Academic writing requires epistemic calibration — neither over-claiming (too confident without evidence) nor under-asserting (too tentative). The hedge-to-boost ratio reveals whether the writer has learned to modulate certainty appropriately.',
  },
  L9: {
    name: 'Affective Trajectory',
    definition: 'Affective trajectory measures the emotional tone across the essay using the Valence-Arousal-Dominance (VAD) model. Valence measures positive vs. negative tone, arousal measures urgency/excitement, and dominance measures assertiveness/control. The valence arc (slope from beginning to end) shows whether the essay builds toward a more positive or negative conclusion. Emotional intrusion detects inappropriate personal affect in academic writing.',
    why: 'Even in academic writing, emotional tone matters. Tonal consistency signals mature writing. Sudden emotional shifts or personal affect intrusions can undermine credibility. A positive arc toward the conclusion often signals constructive argument resolution.',
  },
  L10: {
    name: 'Reader-Adaptive',
    definition: 'Reader-adaptive scoring is the most significant departure from original Coh-Metrix. All L0–L9 metrics are absolute — computed from the text alone. But difficulty is inherently relational: what\'s complex for a beginner may be routine for an expert. This layer re-scores every metric relative to a specific learner\'s profile (vocabulary level, syntactic fluency, domain expertise). The ZPD proximity index measures whether the text is in the learner\'s Zone of Proximal Development — optimally challenging.',
    why: 'A text that scores "complex" overall might be exactly right for an advanced student, or impossibly hard for a beginner. Personalized scoring enables targeted feedback: "This text is appropriate for YOUR level" rather than generic difficulty ratings.',
  },
};

const METRIC_DEFINITIONS = {
  // L0
  'L0.1': { label: 'Token count', definition: 'Total number of word tokens in the essay.', interpretation: 'Simply the essay length. Used as a denominator for density metrics.' },
  'L0.2': { label: 'Sentence count', definition: 'Total number of sentences detected by the NLP parser.', interpretation: 'Combined with word count, determines average sentence length.' },
  'L0.3': { label: 'Paragraph count', definition: 'Number of paragraphs (separated by blank lines).', interpretation: 'Indicates structural organization. Too few paragraphs may signal lack of organization.' },
  'L0.4': { label: 'Mean sentence length', definition: 'Average number of words per sentence. Computed as total tokens divided by number of sentences.', interpretation: 'Academic writing typically averages 15–25 words per sentence. Very short suggests simplistic writing; very long may impede readability.' },
  'L0.5': { label: 'Sentence length variance', definition: 'Standard deviation of sentence lengths across the essay.', interpretation: 'Some variation indicates stylistic range. Very low variance means monotonous rhythm; very high may signal inconsistent writing.' },
  'L0.6': { label: 'Type-Token Ratio', definition: 'Number of unique words divided by total words. Raw TTR is length-sensitive — longer texts naturally have lower TTR.', interpretation: 'A rough vocabulary diversity measure, but use MATTR (L0.7) instead for fair comparison across different essay lengths.' },
  'L0.7': { label: 'Moving-Average Type-Token Ratio', definition: 'TTR computed over a sliding window of 50 words, then averaged. Length-invariant measure of vocabulary diversity.', interpretation: 'Values around 0.50–0.70 are typical for academic writing. Higher means more diverse vocabulary; lower means more word repetition.' },
  'L0.8': { label: 'Mean paragraph length', definition: 'Average number of sentences per paragraph.', interpretation: 'Well-developed paragraphs typically have 4–8 sentences. Very short paragraphs may indicate underdeveloped ideas.' },
  'L0.9': { label: 'Intro/body/conclusion ratio', definition: 'Distribution of text across introduction, body, and conclusion sections as percentages.', interpretation: 'A balanced structure typically shows 15–20% intro, 60–70% body, and 15–20% conclusion.' },

  // L1
  'L1.1': { label: 'Mean token surprisal', definition: 'Average information content per word in bits, measured by how predictable each word is given its context. Based on LLM log-probabilities.', interpretation: 'Higher surprisal = more sophisticated/unexpected vocabulary. Academic text typically ranges 6.5–9 bits. Below 6 suggests basic vocabulary; above 10 may be overly obscure.' },
  'L1.2': { label: 'Surprisal standard deviation', definition: 'Variation in word-level surprisal across the essay.', interpretation: 'High variation may indicate inconsistent register — mixing very simple and very complex vocabulary.' },
  'L1.3': { label: 'Mean age of acquisition', definition: 'Average estimated age at which words in the essay are typically learned, based on Kuperman et al. (2012) norms for 51,000 words.', interpretation: 'Higher AoA means the essay uses words typically learned later in life, suggesting more advanced vocabulary. Academic writing typically averages 7–10 years.' },
  'L1.4': { label: 'Mean concreteness', definition: 'Average concreteness rating of content words on a 1–5 scale (1=abstract, 5=concrete), from Brysbaert et al. (2014) norms.', interpretation: 'Academic/argumentative writing tends toward abstract language (lower scores). Narrative writing uses more concrete language.' },
  'L1.5': { label: 'Academic word density', definition: 'Proportion of content words that appear in Coxhead\'s (2000) Academic Word List — 570 word families common across academic disciplines.', interpretation: 'Target range for undergraduate writing: 0.12–0.22. Below 0.10 suggests insufficient academic register; above 0.25 may indicate over-reliance on jargon.' },
  'L1.6': { label: 'Rare word ratio', definition: 'Proportion of words that would be unfamiliar to a B2-level English learner (approximately upper-intermediate).', interpretation: 'Some rare words signal sophistication, but too many may indicate unclear writing or jargon overload.' },
  'L1.7': { label: 'Register consistency', definition: 'How consistent the formality/register level is throughout the essay, measured by variation in vocabulary sophistication across text windows.', interpretation: 'High consistency (close to 1.0) means the writer maintains a steady register. Low consistency suggests shifts between formal and informal language.' },
  'L1.8': { label: 'Morphological complexity', definition: 'Average number of meaningful word parts (morphemes) per content word. "Unbelievable" has 3: un-believe-able.', interpretation: 'Higher values indicate use of longer, more derived words — a sign of vocabulary sophistication. Typical academic range: 1.4–2.2.' },

  // L2
  'L2.1': { label: 'Mean dependency distance', definition: 'Average word-distance between grammatically related words in a sentence, based on Universal Dependencies parse. From Gibson\'s (2000) Dependency Locality Theory.', interpretation: 'Higher MDD = more complex sentences requiring more working memory. Population mean ~3.1. Below 2.5 suggests simple sentences; above 4.0 may impede readability.' },
  'L2.2': { label: 'MDD standard deviation', definition: 'Variation in dependency distances across sentences.', interpretation: 'Some variation is normal. Very high variation suggests inconsistent sentence construction.' },
  'L2.3': { label: 'Mean clause depth', definition: 'Average depth of the deepest embedded clause in each sentence.', interpretation: 'Deeper embedding (more clauses within clauses) indicates more complex sentence architecture. Typical academic: 1.5–3.0.' },
  'L2.4': { label: 'Subordination ratio', definition: 'Proportion of subordinate clauses (because, although, while, etc.) to total clauses.', interpretation: 'Target for advanced academic writing: 0.35–0.55. Subordination signals reasoning depth — the writer is expressing conditions, causes, and concessions rather than just listing facts.' },
  'L2.5': { label: 'Passive voice ratio', definition: 'Proportion of verb phrases using passive construction (e.g., "was investigated" vs. "investigated").', interpretation: 'Some passive voice is appropriate in academic writing for objectivity. Typical range: 0.05–0.20. Excessive passive (>0.30) may signal unclear agency.' },
  'L2.6': { label: 'NP elaboration', definition: 'Average number of modifiers (adjectives, determiners, relative clauses) per noun phrase.', interpretation: 'More elaborated noun phrases indicate more specific, detailed writing. Academic writing typically averages 1.3–2.5 modifiers per NP.' },

  // L3
  'L3.1': { label: 'Local argument overlap', definition: 'Percentage of adjacent sentence pairs that share at least one noun reference (same word or coreference).', interpretation: 'Measures sentence-to-sentence cohesion. Target: 0.50–0.75. Below 0.50 means too many topic jumps between sentences.' },
  'L3.2': { label: 'Global argument overlap', definition: 'Percentage of all sentence pairs (not just adjacent) that share a noun reference.', interpretation: 'Measures how connected the text is overall. Low global overlap may indicate the essay covers too many unrelated topics.' },
  'L3.4': { label: 'Coreference chain count', definition: 'Number of distinct entity chains — entities that are referred to multiple times using different words (e.g., "AI" → "these systems" → "they").', interpretation: 'More chains indicate more entities being tracked and maintained throughout the text. A well-cohesive essay maintains key entities across paragraphs.' },
  'L3.5': { label: 'Mean chain length', definition: 'Average number of mentions per coreference chain — how many times each tracked entity is re-referenced.', interpretation: 'Longer chains mean entities are sustained throughout the text. Short chains (2–3 mentions) suggest entities are introduced but quickly abandoned.' },
  'L3.8': { label: 'Pronoun-antecedent distance', definition: 'Average token distance between a pronoun and the noun it refers to.', interpretation: 'Shorter distances (3–8 tokens) make references clear. Very long distances (>15 tokens) may confuse readers about what "it" or "they" refers to.' },

  // L4
  'L4.1': { label: 'Local semantic overlap', definition: 'Average meaning similarity between adjacent sentences, computed using sentence embeddings (vector representations of meaning). Cosine similarity ranges 0–1.', interpretation: 'Measures how smoothly meaning flows between sentences. Target: 0.40–0.65. Below 0.35 indicates choppy, disconnected writing.' },
  'L4.3': { label: 'Semantic coherence variance', definition: 'Standard deviation of local semantic overlap scores across the essay.', interpretation: 'Low variance means consistent cohesion throughout. High variance indicates some smooth sections and some jarring transitions.' },
  'L4.4': { label: 'Topic drift index', definition: 'Largest sudden drop in meaning similarity over any 3-sentence window. Detects where the topic shifts without transitional bridging.', interpretation: 'Values above 0.15 indicate topic drift — a section where the essay suddenly changes subject. This is often the primary cohesion weakness in student writing.' },
  'L4.7': { label: 'Intro-conclusion alignment', definition: 'Semantic similarity between the first and last paragraphs.', interpretation: 'High alignment (>0.50) means the conclusion connects back to the introduction, creating a cohesive frame. Low alignment may indicate the essay drifted from its original topic.' },
  'L4.8': { label: 'On-topic score', definition: 'Semantic similarity between the essay and the assignment prompt (if provided).', interpretation: 'Measures how well the essay addresses the assigned topic. Higher is better. Below 0.40 may indicate the essay is off-topic.' },

  // L5
  'L5.1': { label: 'Causal cohesion ratio', definition: 'Ratio of causal connectives (because, therefore, thus) to the total of causal + additive connectives (and, also, moreover).', interpretation: 'Higher ratio means the writer explains WHY things happen rather than just listing facts. Academic argumentative writing benefits from strong causal cohesion.' },
  'L5.2': { label: 'Causal chain density', definition: 'Number of cause-effect event pairs extracted per 100 words, using LLM analysis.', interpretation: 'More causal chains indicate deeper reasoning. Target: 1.5–3.5 per 100 words. Below 1.0 suggests the essay describes rather than explains.' },
  'L5.3': { label: 'Mean causal chain length', definition: 'Average number of events in each extracted causal chain (A causes B causes C = chain length 3).', interpretation: 'Longer chains show deeper causal reasoning — the writer traces consequences through multiple steps rather than stating simple cause-effect pairs.' },
  'L5.5': { label: 'Temporal grounding', definition: 'Proportion of sentences with explicit temporal anchors (dates, time expressions, sequence markers).', interpretation: 'Temporal grounding helps readers place events in time. Important for narrative and historical arguments. Range: 0–1.' },

  // L6
  'L6.1': { label: 'RST tree depth', definition: 'Maximum depth of the rhetorical structure hierarchy. Deeper trees indicate more layered discourse organization.', interpretation: 'Academic essays typically have depth 4–7. Shallow trees (1–3) suggest flat, list-like organization.' },
  'L6.4': { label: 'Evidence relation ratio', definition: 'Proportion of rhetorical relations that are Evidence, Justify, or Support (vs. other relation types).', interpretation: 'Higher ratio means more of the text is dedicated to supporting claims with evidence. Target: 0.20–0.40.' },
  'L6.5': { label: 'Contrast/Concession ratio', definition: 'Proportion of rhetorical relations involving opposing viewpoints (Contrast, Concession).', interpretation: 'Indicates dialectical sophistication — the writer engages with alternative perspectives. Low values suggest one-sided argumentation.' },
  'L6.8': { label: 'Rhetorical diversity index', definition: 'Shannon entropy over the distribution of rhetorical relation types. Higher entropy = more diverse use of rhetorical strategies.', interpretation: 'Target: >1.8 bits. Below 0.8 suggests the writer relies on only one or two discourse strategies (usually just elaboration).' },

  // L7
  'L7.1': { label: 'Main claim count', definition: 'Number of distinct main claims (assertions the writer tries to prove) identified in the essay.', interpretation: 'A focused essay typically has 3–6 main claims. Too few may indicate thin argumentation; too many may indicate the essay is unfocused.' },
  'L7.2': { label: 'Premises per claim', definition: 'Average number of supporting premises (evidence, reasons) per main claim.', interpretation: 'Target: >2.0 for strong academic writing. Below 1.0 means most claims lack evidence — the writer asserts without supporting.' },
  'L7.3': { label: 'Warrant completeness', definition: 'Proportion of claims that have at least one explicit warrant — a reasoning link explaining WHY the evidence supports the claim.', interpretation: 'Higher is better. Many student writers provide evidence but don\'t explain how it connects to their claim.' },
  'L7.4': { label: 'Counter-argument present', definition: 'Whether the essay acknowledges at least one counter-argument or opposing viewpoint (0 = no, 1 = yes).', interpretation: 'Engaging with counter-arguments is a hallmark of mature academic writing. Its absence significantly limits argumentative quality.' },
  'L7.7': { label: 'Unsupported claim ratio', definition: 'Proportion of claims that have zero supporting premises.', interpretation: 'Lower is better. Above 0.40 means nearly half of claims are unsupported assertions. Target: below 0.15.' },

  // L8
  'L8.3': { label: 'Hedging density', definition: 'Number of epistemic hedges (might, perhaps, suggests, it seems) per 100 words.', interpretation: 'Optimal range: 1.0–3.0 per 100 words. Too few hedges (<0.5) suggests overconfident claims; too many (>5.0) suggests excessive tentativeness.' },
  'L8.5': { label: 'Hedge-to-boost ratio', definition: 'Ratio of hedging expressions to boosting expressions (clearly, certainly, obviously).', interpretation: 'A ratio of 1.5–3.0 is typical for well-calibrated academic writing. Below 1.0 means more boosting than hedging — the writer may be over-claiming.' },
  'L8.6': { label: 'Evidentiality score', definition: 'Proportion of claims with explicit source attribution (cited, according to, research shows).', interpretation: 'Higher indicates the writer grounds claims in external evidence. Target: >0.30. Below 0.20 suggests insufficient citation of sources.' },
  'L8.8': { label: 'First-person stance shift', definition: 'Rate of first-person (I believe, in my view) vs. impersonal constructions (research shows, it is evident).', interpretation: 'Academic conventions vary, but generally lower first-person usage indicates more formal register. Some disciplines accept first-person for positioning.' },

  // L9
  'L9.1': { label: 'Mean valence', definition: 'Average emotional tone on a 1–9 scale (1=very negative, 5=neutral, 9=very positive), rated per sentence.', interpretation: 'Academic writing typically ranges 4.5–6.5. Slightly above neutral is appropriate for argumentative essays. Very high or low suggests emotional rather than reasoned writing.' },
  'L9.2': { label: 'Valence variability', definition: 'Standard deviation of sentence-level emotional tone across the essay.', interpretation: 'Low variability (SD <1.5) indicates tonal consistency — a sign of mature writing. High variability may signal emotional instability or inappropriate tone shifts.' },
  'L9.4': { label: 'Mean dominance', definition: 'Average assertiveness/control on a 1–9 scale. Higher = more authoritative, confident tone.', interpretation: 'Academic writing typically ranges 5–7. Below 4 suggests overly tentative writing; above 8 may come across as aggressive.' },
  'L9.5': { label: 'Valence arc slope', definition: 'Linear trend in emotional tone from introduction to conclusion. Positive slope = essay becomes more positive; negative = more negative.', interpretation: 'A slightly positive arc (+0.01 to +0.10) is ideal — suggesting the essay builds toward a constructive resolution.' },

  // L10
  'L10.1': { label: 'Lexical challenge (z)', definition: 'Z-score of vocabulary difficulty relative to what is expected for this learner\'s vocabulary level.', interpretation: '+0.5 to +1.5 means appropriately challenging. Above +2.0 means the text is too difficult; below -0.5 means it\'s too easy for this learner.' },
  'L10.2': { label: 'Syntactic challenge (z)', definition: 'Z-score of grammatical complexity relative to the learner\'s prior writing profile.', interpretation: 'Similar to L10.1 — positive means the text is more complex than the learner typically encounters.' },
  'L10.5': { label: 'Global difficulty (z)', definition: 'Weighted composite of all challenge z-scores. Represents overall text difficulty relative to this specific learner.', interpretation: '0 = on-level for this learner. +1 = one standard deviation above their level. The optimal "zone of proximal development" is +0.5 to +1.5.' },
  'L10.6': { label: 'ZPD proximity index', definition: 'How close the text\'s difficulty is to the learner\'s Zone of Proximal Development (Vygotsky, 1978) — the sweet spot where material is challenging but achievable.', interpretation: 'Values close to 1.0 mean the text is optimally targeted. Below 0.5 means it\'s either too easy or too hard for this specific learner.' },
};

/**
 * Get definition for a layer or metric.
 */
function getDefinition(id) {
  if (LAYER_DEFINITIONS[id]) return { type: 'layer', ...LAYER_DEFINITIONS[id] };
  if (METRIC_DEFINITIONS[id]) return { type: 'metric', ...METRIC_DEFINITIONS[id] };
  return null;
}

module.exports = { LAYER_DEFINITIONS, METRIC_DEFINITIONS, getDefinition };
