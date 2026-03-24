# Team i18n Implementation

Execute internationalization using the **Hash-Based Three-Mode Translation** pattern.

## Target: $ARGUMENTS
Scope: specific files, "audit" for full compliance check, or "adopt" to add i18n to a new app

## Step 0: Discover Project i18n Files

Before any work, scan the codebase to locate the i18n implementation files. Search for:
- Files containing `data-i18n` attributes (HTML)
- Files containing `generateHash` or `i18n` in name (JS)
- Translation JSON files (`{lang}.json` with hash keys)
- Server routes handling `/translate` or `/i18n`
- Language selector / mode switcher UI components

Map what you find to these **roles** (the filenames will vary by project):

| Role | What to look for |
|------|-----------------|
| **Config/Init** | Language detection, `i18nConfig`, cookie/localStorage persistence |
| **Utils** | `generateHash()`, `addText()`, hash registry builder |
| **Translation Engine** | Display mode logic, caching, batch save, MutationObserver |
| **Language Selector UI** | Dropdown with mode switcher (Auto / Hover Replace / Hover Tooltip) |
| **Server API** | `/load`, `/translate`, `/batch-save` endpoints |
| **Translation Store** | JSON files: `{ "hash": "translatedText", ... }` |
| **Migration Scripts** | CLI tools for adding `data-i18n` attributes or generating hashes |

## Workflow Phases

### Phase 1: Audit (Parallel)
Launch simultaneously:
- **Internationalization Expert**: Hash-based i18n compliance audit
- **Code Standards Specialist**: CSS class usage, inline style detection

### Phase 2: Implementation (Sequential)
- **Fullstack Developer**: Implement i18n fixes and text wrapping

### Phase 3: Validation (Parallel)
Launch simultaneously:
- **QA Testing**: Verify translations and hash accuracy
- **Cross Platform Specialist**: Test across devices and browsers
- **Accessibility Compliance Checker**: Ensure RTL and language accessibility

---

## The Hash-Based Three-Mode Translation Pattern

This is a **generic i18n architecture** that any web app can adopt. It eliminates manual key management by deriving keys from the source text itself, and offers three user-facing translation display modes.

### Core Concept: Hash Keys

Instead of manually-assigned keys like `nav.home.title`, keys are **auto-generated**:

```
Key = SHA-256( englishText.trim() ).substring(0, 16)
```

**Why this is superior:**
- **No key collisions** — SHA-256 is collision-resistant
- **No key management** — key is deterministic from text
- **No stale keys** — if text changes, hash changes, triggering re-translation
- **Client/server parity** — same algorithm on both sides
- **Self-documenting** — the English text IS the fallback

**Client-side (Web Crypto API):**
```javascript
async function generateHash(text) {
  const data = new TextEncoder().encode(text.trim());
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').substring(0, 16);
}
```

**Server-side (Node.js):**
```javascript
function generateHash(text) {
  return require('crypto').createHash('sha256')
    .update(text.trim()).digest('hex').substring(0, 16);
}
```

**HTML markup:**
```html
<span data-i18n="a1b2c3d4e5f6g7h8">Hello World</span>
```

### Three Translation Display Modes

Users select a mode from the language selector. Switching modes resets all listeners and element state.

#### Mode 1: Auto (Default)
- All `[data-i18n]` elements translated **immediately** on page load
- Translated elements get `.i18n-translated` class
- **Click** toggles between original and translated text
- **MutationObserver** auto-translates dynamically loaded content

#### Mode 2: Hover Replace
- English text stays until user **hovers** — then **replaced in-place**
- Before hover: `.i18n-hover` class (dashed underline signals interactivity)
- While fetching: `.i18n-translating` class (opacity: 0.6)
- Translation **persists** after mouse leaves
- **Click** toggles back to English
- Fetched on **first hover only** (cached thereafter)

#### Mode 3: Hover Tooltip
- Original English text **never replaced**
- Translation shown as **browser tooltip** (`title` attribute) on hover
- Before hover: `.i18n-has-tooltip` class (dotted underline)
- **Click** converts to in-place replacement (promotes to replace behavior)

#### Required CSS Classes
```css
.i18n-translating { opacity: 0.6; }               /* Fetch in progress */
.i18n-translated  { cursor: pointer; }             /* Click to toggle */
.i18n-hover       { border-bottom: 1px dashed; }   /* Hover-replace target */
.i18n-has-tooltip  { border-bottom: 1px dotted; }   /* Tooltip available */
```

### Translation Data Flow

```
Page Load
  ├── detectLanguage()                ← URL param > cookie > localStorage > browser > default
  ├── preloadTranslations(lang)       ← GET /api/translate/load → full { hash: text } map
  ├── buildHashRegistry()             ← scan DOM for [data-i18n], map hash → English
  ├── initTranslationListeners()      ← attach mode-specific listeners
  └── observeDOM()                    ← MutationObserver for lazy-loaded content

User Interaction (cache miss)
  ├── POST /api/translate             ← single text → LLM translation
  ├── applyTranslation(el, text)      ← update DOM
  └── markDirty(hash, text)           ← add to dirtyBuffer

Background Flush (debounced / page hide)
  ├── POST /api/translate/batch-save  ← { lang, entries: { hash: text, ... } }
  └── Server: read-modify-write       ← merge into persistent store, invalidate cache
```

### Toggle Behavior (All Modes)
Every translated element stores the original HTML in `data-i18n-original`:
```javascript
// Before translating
el.setAttribute('data-i18n-original', el.innerHTML);
// On click: swap between original and translated
```

### Server API Pattern

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/translate/load?lang=zh` | GET | Preload all translations for a language |
| `/api/translate` | POST | Translate single text via LLM (cache in memory) |
| `/api/translate/batch-save` | POST | Persist accumulated new translations to store |

**Concurrency control:** Queue LLM calls with a concurrency cap (e.g., max 3) to avoid rate limits.

### Translation Store Format

Translations are flat JSON files keyed by hash:
```json
{
  "a1b2c3d4e5f6g7h8": "你好世界",
  "9f8e7d6c5b4a3210": "欢迎来到课程"
}
```

Storage can be any backend (GCS, S3, database, local filesystem). Organized by scope:
```
store/
├── i18n/                     # App-level translations
│   ├── zh.json
│   └── ja.json
└── {scope}/                  # Content-specific translations
    └── i18n/
        ├── zh.json
        └── ...
```

### Dynamic Content Wrapping

For text generated in JavaScript, use a helper that wraps and hashes:
```javascript
// addText() wraps dynamic text with the i18n span
const wrapped = await addText("Welcome");
element.innerHTML = wrapped;
// → <span data-i18n="31fbef162594de01">Welcome</span>
```

### RTL Support
- Detect RTL languages (ar, he, fa, ur) and set `dir="rtl"` on document root
- **No inline styles** — all styling via CSS classes so RTL overrides work cleanly

---

## Text Wrapping Rules
1. **ALL visible text** must be wrapped: `<span data-i18n="hash">Text</span>`
2. **Hash** = SHA-256 of trimmed English text, first 16 hex chars
3. **Emojis outside span**: `📚 <span data-i18n="hash">Curriculum</span>`
4. **No inline styles**: Use CSS classes only (blocks RTL and mode styling)
5. **`data-i18n-original`** preserved for toggle behavior

## Language Detection Priority
1. URL parameter: `?lang=zh`
2. Cookie: `preferredLanguage`
3. localStorage: `preferredLanguage`
4. Browser language
5. Default: `en`

---

## Audit Checklist

### HTML Files
- [ ] i18n scripts loaded in correct order (init → utils → engine)
- [ ] All visible text wrapped with `data-i18n`
- [ ] Hashes match English text (SHA-256, first 16 chars)
- [ ] Emojis outside spans
- [ ] No inline styles
- [ ] `data-i18n-original` preserved for toggle behavior

### JavaScript Files
- [ ] Dynamic text uses `addText()` or equivalent wrapper
- [ ] No hardcoded user-facing strings
- [ ] Language-aware URL building

### CSS Files
- [ ] No hardcoded text in CSS
- [ ] RTL support classes present
- [ ] i18n state classes defined (`.i18n-translating`, `.i18n-translated`, `.i18n-hover`, `.i18n-has-tooltip`)

---

## Output Format

```
## i18n Compliance Report

### Summary
- Files Audited: [count]
- Compliance Score: [%]
- Issues Found: [count]
- Auto-Fixable: [count]

### Coverage Status
| Category | Total | Compliant | Issues |
|----------|-------|-----------|--------|
| HTML Files | [n] | [n] | [n] |
| JS Files | [n] | [n] | [n] |
| Dynamic Content | [n] | [n] | [n] |

### Issues by Severity

#### Critical (Breaks i18n)
1. **Missing i18n Scripts**
   - File: [file]
   - Fix: Add script loading in correct order

2. **Inline Styles Blocking Translation**
   - File: [file:line]
   - Fix: Move to CSS class

#### Warnings (Should Fix)
1. **Unwrapped Text**
   - File: [file:line]
   - Text: "[text]"
   - Hash: [generated hash]
   - Fix: Wrap with `<span data-i18n="[hash]">[text]</span>`

2. **Hash Mismatch**
   - File: [file:line]
   - Current: [wrong hash]
   - Expected: [correct hash]
   - Text: "[text]"

3. **Emoji Inside Span**
   - File: [file:line]
   - Fix: Move emoji outside span

#### Info (Best Practice)
[Similar format]

### Manual Fixes Required
1. **[Issue]**
   - Location: [file:line]
   - Current: [code]
   - Should Be: [code]

### Hash Registry Updates
New hashes to register:
| Hash | English Text |
|------|-------------|
| [hash] | [text] |

### RTL Testing Required
Files with potential RTL issues:
- [file] - [reason]

### Next Steps
1. [action]
2. [action]
3. [action]
```

## Agent Prompts

### Internationalization Expert
```
You are an Internationalization Expert implementing the Hash-Based Three-Mode Translation pattern.

FIRST: Scan the codebase to discover i18n files (search for data-i18n, generateHash, i18n in filenames, translation JSON files, /translate routes). Map them to roles: Config/Init, Utils, Translation Engine, Language Selector, Server API, Translation Store.

This pattern uses:
- **Hash keys**: SHA-256(text.trim()).substring(0,16) — no manual key management
- **Three display modes**: Auto (translate on load), Hover Replace (translate on hover, persist), Hover Tooltip (show as title attribute)
- **Click-to-toggle**: All modes support clicking to swap original/translated text
- **Batch save**: New translations accumulate client-side, flush to server periodically

Audit for compliance:

1. **Script Loading** — init → utils → engine, in correct order
2. **Text Wrapping** — all visible text: `<span data-i18n="hash">text</span>`
3. **Hash Accuracy** — SHA-256 of trimmed text, first 16 hex chars, case-sensitive
4. **Emojis** — must be OUTSIDE spans
5. **No Inline Styles** — all styling via CSS classes (required for RTL + mode classes)
6. **Dynamic Content** — must use addText() or equivalent wrapper
7. **Mode Compatibility** — elements support all three modes (click handler, hover handler, CSS classes)
8. **Caching** — translations preloaded on page load, concurrency-limited API calls

Return specific file:line references. Generate correct hashes for unwrapped text.
```

### Code Standards Specialist (i18n Focus)
```
You are a Code Standards Specialist auditing for i18n compliance.

FIRST: Scan the codebase to discover i18n files and understand the project's implementation.

Focus on:
1. **Inline style detection** (style="...") — blocks RTL support and mode styling
2. **Embedded <style>/<script> tags** — should be externalized
3. **Hardcoded text in JavaScript** — should use addText() wrapper
4. **CSS class usage** for i18n states:
   - .i18n-translating (fetch in progress)
   - .i18n-translated (click to toggle)
   - .i18n-hover (hover-replace target, dashed underline)
   - .i18n-has-tooltip (tooltip available, dotted underline)
5. **RTL readiness** — dir="rtl" support, no layout assumptions

For each violation:
- Exact file:line
- Current code
- Recommended fix
- CSS class suggestion if applicable
```
