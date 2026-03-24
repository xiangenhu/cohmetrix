# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Neo-CohMetrix is a Node.js/Express web application for deep text cohesion analysis and essay grading. It implements a 12-layer (L0-L11) analysis framework based on the multilevel discourse comprehension model (Graesser, McNamara et al.), producing 111 metrics across 8 composite scores.

## Commands

```bash
npm install          # Install dependencies
npm start            # Production server (node src/server.js, port 8080)
npm run dev          # Development with auto-reload (nodemon)
```

No test suite exists. No linter is configured.

## Environment Setup

Copy `.env.example` to `.env`. Required: `ANTHROPIC_API_KEY`. Optional: `GCS_BUCKET_NAME` (falls back to in-memory storage), OAuth settings. See `.env.example` for all options.

## Architecture

**Backend** (`src/`):
- `server.js` — Express entry point, middleware, route mounting, SPA fallback
- `config.js` — Centralized env var loader with defaults
- `layers/` — 12 analysis layers (L0-L11), each exports `{ analyze, LAYER_ID, LAYER_NAME }`
- `services/pipeline.js` — Orchestrates layer execution in 4 groups:
  - Group 1 (fast NLP-only): L0, L5
  - Group 2 (mixed NLP+LLM): L1, L2, L3, L4 in parallel
  - Group 3 (LLM-heavy): L6, L7, L8, L9, L10 in parallel
  - Group 4 (meta, depends on all): L11
- `services/llm.js` — Multi-provider LLM abstraction (Anthropic/OpenAI/Azure) with token tracking
- `services/storage.js` — GCS with in-memory Map fallback; paths: `results/{id}.json`, `documents/{name}`
- `services/genres.js` — 117-genre taxonomy across 16 categories
- `services/definitions.js` — Metric definitions and explanations
- `routes/` — 7 routers: analyze (SSE streaming), results, interpret, documents, help, rubric, auth
- `utils/nlp.js` — Statistical helpers (mean, stdev, descriptiveStats)
- `utils/fileParser.js` — PDF/DOCX/TXT text extraction

**Frontend** (`public/`):
- Vanilla JS SPA (no framework), modular files in `js/` and `css/`
- `app.js` — Main controller and screen navigation
- Uses Server-Sent Events (SSE) for real-time analysis progress
- Screens: Login → Upload → Processing → Results (three-panel: metrics, definitions, evidence)

**Analysis Output Structure:**
- Layer scores (0-100) with 7-14 metrics each
- 8 composite scores (F1-F8): PCA-analog factors combining layers (e.g., F1 Narrativity = L10+L6+L3)
- Overall weighted score, actionable feedback, token usage, evidence excerpts

## Key Patterns

- **Auth**: OAuth gateway at configurable URL, `requireAuth` middleware on analysis routes, token cached 5 min
- **LLM calls**: Use `llm.complete()` for text, `llm.completeJSON()` for structured responses (parses JSON from markdown code blocks), `llm.batchProcess()` for batched items
- **Layer contract**: Each layer in `layers/` must export `analyze(text, options)` returning `{ layerId, layerName, score, metrics: [...] }`
- **SSE streaming**: Analysis progress sent via `routes/analyze.js` with per-layer completion events
- **File support**: PDF (pdf-parse), DOCX (mammoth), TXT

## Reference

- `SPECIFICATION.md` — 56KB scientific specification with full layer taxonomy, metric definitions, and PCA models
