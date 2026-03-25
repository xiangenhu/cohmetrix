# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Neo-CohMetrix is a Node.js/Express web application for deep text cohesion analysis and essay grading. It implements a 12-layer (L0-L11) analysis framework based on the multilevel discourse comprehension model (Graesser, McNamara et al.), producing 111 metrics across 8 composite scores. Supports multilingual analysis — the document's language metadata determines how LLM prompts are issued.

## Commands

```bash
npm install          # Install dependencies
npm start            # Production server (node src/server.js, port 8080)
npm run dev          # Development with auto-reload (nodemon)
```

No test suite exists. No linter is configured.

## Environment Setup

Copy `.env.example` to `.env`. Required: `ANTHROPIC_API_KEY`. Optional: `GCS_BUCKET_NAME` (falls back to in-memory storage), `SUPER_ADMIN_EMAIL` (grants admin panel access), OAuth settings. See `.env.example` for all options.

## Architecture

### Backend (`src/`)

- `server.js` — Express entry point, middleware, route mounting, SPA fallback (`public/app.html`)
- `config.js` — Centralized env var loader with defaults (LLM, GCS, OAuth, admin, weights, thresholds)
- `layers/` — 12 analysis layers (L0-L11), each exports `{ analyze, LAYER_ID, LAYER_NAME }`
- `services/pipeline.js` — Orchestrates layer execution in 4 parallel groups:
  - Group 1 (fast NLP-only): L0, L5
  - Group 2 (mixed NLP+LLM): L1, L2, L3, L4 in parallel
  - Group 3 (LLM-heavy): L6, L7, L8, L9, L10 in parallel
  - Group 4 (meta, depends on all): L11
- `services/llm.js` — Multi-provider LLM abstraction (Anthropic/OpenAI/Azure) with token tracking and `getRequestLanguage()` for i18n-aware prompts
- `services/storage.js` — GCS with in-memory Map fallback; user-scoped paths (`users/{userId}/projects/{projectId}/...`), plus `listAllUsers()` for admin
- `services/auth.js` — OAuth gateway token verification, `requireAuth` middleware, `isSuperAdmin()`/`requireAdmin` for admin routes
- `services/evidence.js` — Post-analysis LLM enrichment: plain descriptions, evidence excerpts, verdicts per metric, audience-aware
- `services/rubric.js` — Rubric-based essay evaluation
- `utils/fileParser.js` — PDF/DOCX/TXT text extraction + `convertDocxToHtml()` for in-browser DOCX preview

### Routes (`src/routes/`)

- `analyze.js` — Single-file analysis with SSE streaming progress
- `projects.js` — Project CRUD, file management, file metadata, batch analysis (SSE), cost estimation, Google Drive import, project summary, file content viewing (`?extract=true` for text, `?format=html` for rendered preview)
- `admin.js` — Super admin routes (browse all users/projects/files/results, delete); protected by `requireAdmin`
- `results.js`, `documents.js`, `interpret.js`, `help.js`, `rubric.js`, `auth.js`, `i18n.js`

### Frontend (`public/`)

- Vanilla JS SPA (no framework), modular files in `js/` and `css/`
- SPA entry: `public/app.html` (not `index.html` — `index.html` is an older version)
- `app.js` — Screen navigation: upload, project, process, results, review, admin
- `projects.js` — Project workflow UI (file table, metadata editor modal, document viewer modal with PDF/DOCX/TXT native rendering, summary view, auto-detect-all, workflow help banner)
- `admin.js` — Admin panel UI (users → projects → files/results drill-down); shown only when `isAdmin` flag is true
- `results.js` — Three-panel results view (layers sidebar, metrics center, evidence right)
- `auth.js` — OAuth login/logout, token management, `apiFetch()` wrapper for authenticated requests
- `i18n-*.js` — Internationalization: engine, config, selector (with `switchLang()`/`getCurrentLang()`)
- Uses Server-Sent Events (SSE) for real-time analysis progress

### Storage Path Hierarchy (GCS / in-memory)

```
users/{email}/projects/{projectId}/config.json           # project configuration
users/{email}/projects/{projectId}/documents/{filename}   # uploaded documents
users/{email}/projects/{projectId}/documents/{filename}.meta.json
users/{email}/projects/{projectId}/analysis/{resultId}.json  # analysis results
results/{analysisId}.json          # standalone (non-project) results
documents/{filename}               # shared document library
```

## Key Patterns

- **Auth**: OAuth gateway at configurable URL, `requireAuth` middleware on protected routes, token cached 5 min. Super admin check via `SUPER_ADMIN_EMAIL` env var.
- **LLM calls**: Use `llm.complete()` for text, `llm.completeJSON()` for structured responses (parses JSON from markdown code blocks), `llm.batchProcess()` for batched items. All accept `{ language }` option for multilingual output.
- **Layer contract**: Each layer in `layers/` must export `analyze(text, options)` returning `{ layerId, layerName, score, metrics: [...] }`
- **SSE streaming**: Single-file via `routes/analyze.js` with layer events; batch via `routes/projects.js` with file-level events
- **File metadata**: Per-file metadata (language, genre, readingLevel, assignmentType, promptText, authorLevel, etc.) stored as `.meta.json` alongside files. Language field determines analysis language. AI auto-detect fills metadata via LLM.
- **Document viewing**: PDF served raw (browser renders natively), DOCX converted to HTML via mammoth, TXT wrapped in HTML. Viewer modal supports maximize for high-res screens.
- **Non-English support**: File names use `escAttr()` for safe HTML attribute encoding; `Content-Disposition` uses RFC 5987 `filename*=UTF-8''...` for download headers. Language detection triggers UI switch suggestion.
- **Composite scores**: F1-F8 weighted PCA-analog factors. Overall score = weighted sum (configurable via env vars).

## Reference

- `SPECIFICATION.md` — 56KB scientific specification with full layer taxonomy, metric definitions, and PCA models
