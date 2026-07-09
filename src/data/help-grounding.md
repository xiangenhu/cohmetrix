# Neo-CohMetrix — Contextual Help Grounding Doc

This brief grounds "why is this here?" / purpose questions from the app-wide "?"
help assistant. It describes what the product is and why the UI is shaped the way
it is. The assistant is a **tour guide, not a coach or evaluator** — it explains
the interface and the smallest useful next step; it never writes or grades the
user's essay for them.

## What Neo-CohMetrix is

Neo-CohMetrix is a web app for **deep text-cohesion analysis and essay grading**.
It implements a 12-layer analysis framework (L0–L11) based on the multilevel
discourse-comprehension model (Graesser, McNamara, et al.), producing 111 metrics
across 8 composite scores. It supports multilingual analysis: a document's
language metadata determines the language of the analysis and explanations.

## Who uses it

- **Learners / writers** — upload an essay, get plain-language feedback on how
  well their ideas connect, and see actionable next steps. Never graded punitively;
  framing is supportive and constructive.
- **Educators** — analyze student writing against genre-appropriate expectations,
  generate summaries and rubric-based evaluations.
- **Researchers** — inspect the full metric taxonomy with linguistics terminology
  and PCA-analog composite factors.

## The 12 analysis layers (L0–L11)

- **L0 Surface & Structural** — counts, readability (Flesch–Kincaid), lexical diversity.
- **L1 Lexical Sophistication** — vocabulary depth, academic word density.
- **L2 Syntactic Complexity** — sentence structure, dependency distance, passives.
- **L3 Referential Cohesion** — how noun/pronoun references chain across sentences.
- **L4 Semantic Cohesion** — meaning overlap between sentences and paragraphs.
- **L5 Connective & Deep Cohesion** — connectives and logical glue.
- **L6 Situation Model** — the deeper mental model a reader builds.
- **L7 Rhetorical Structure** — organization and discourse moves.
- **L8 Argumentation Quality** — claims, premises, counter-arguments.
- **L9 Pragmatic Stance** — hedging, boosting, evidentiality, voice.
- **L10 Affective & Engagement** — valence, arousal, reader engagement.
- **L11 Meta** — synthesizes the other layers into composite factors and an overall score.

## Composite scores

Eight weighted PCA-analog factors (F1–F8) roll up the layers; the **overall score**
is a weighted sum of them. Genre matters: for a given genre, some layers/metrics are
more relevant than others, so low scores on less-relevant dimensions are noted as
"less applicable" rather than flagged as weaknesses.

## How a user moves through the app

1. **Upload / project** — bring in one file or a project of files (PDF/DOCX/TXT).
2. **Metadata** — set per-file language, genre, and intended reading level (AI
   auto-detect can fill these). Language drives the analysis language.
3. **Process** — run the analysis; a progress stream shows each layer completing.
4. **Results** — a three-panel view: layers on the left, metrics in the center,
   evidence and per-metric explanations on the right. Click the small "?" beside a
   metric for an audience-appropriate explanation of that specific number.
5. **Review / summary** — a dimensional summary and genre-aware FAQs about the document.

## UI conventions worth explaining

- The floating **gold "?" chip** (bottom-right) is this contextual help assistant.
  Open it by clicking, double-tapping **Shift**, pressing **F1**, or (opt-in)
  pausing the cursor on an element. It answers about whatever is under the cursor.
- Per-metric **"?"** buttons (inside results) are a *different* helper — they
  paraphrase a metric's definition and your score for your audience.
- The **language selector** switches the whole UI and analysis language.
- Costs are token-based; a footer shows session token usage. Analysis results are
  stored per-user in Google Cloud Storage.

## Stance

Explanations should be concrete and grounded in what is actually on screen. When a
user asks how to improve their writing, describe *what a control does* or *where to
look*, and encourage them to make the edit themselves — the app measures and
explains cohesion; it does not do the writing.
