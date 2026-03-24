/**
 * I18nUtils — Hashing, span wrapping, and DOM registry for translatable text.
 *
 * Uses Web Crypto API (SHA-256) to produce deterministic hashes of source text.
 * Maintains a live registry of all [data-i18n] elements in the DOM.
 */
const I18nUtils = (() => {
  let registry = new Map(); // hash -> { element, originalText }

  /**
   * Generate a short hash for a text string.
   * SHA-256 of trimmed text, first 16 hex characters.
   */
  async function generateHash(text) {
    const data = new TextEncoder().encode(text.trim());
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return hex.substring(0, 16);
  }

  /**
   * Wrap dynamic text in a translatable <span>.
   * Returns the HTML string: <span data-i18n="hash">text</span>
   *
   * Usage in JS when inserting dynamic content:
   *   el.innerHTML = await I18nUtils.addText('Hello world');
   */
  async function addText(text) {
    const hash = await generateHash(text);
    return '<span data-i18n="' + hash + '">' + escapeHtml(text) + '</span>';
  }

  /**
   * Scan the entire DOM for [data-i18n] elements and build the registry.
   * Returns a Map of hash -> { element, originalText }.
   */
  function buildHashRegistry() {
    registry = new Map();
    const elements = document.querySelectorAll('[data-i18n]');
    elements.forEach(el => {
      const hash = el.getAttribute('data-i18n');
      if (hash) {
        registry.set(hash, {
          element: el,
          originalText: el.getAttribute('data-i18n-original') || el.textContent,
        });
      }
    });
    return registry;
  }

  /**
   * Rebuild the registry after DOM changes (e.g., new screens, dynamic content).
   */
  function refreshRegistry() {
    return buildHashRegistry();
  }

  /**
   * Get the current registry (read-only access for other modules).
   */
  function getRegistry() {
    return registry;
  }

  /**
   * Cache of text -> hash (populated by precomputeHashes or generateHash).
   * Enables synchronous lookups after first async computation.
   */
  const hashCache = new Map();

  /**
   * Synchronous hash lookup from cache.
   * Returns the hash if previously computed, or '' if not cached.
   */
  function hash(text) {
    return hashCache.get(text.trim()) || '';
  }

  /**
   * Synchronous text wrapping using cached hashes.
   * Returns: <span data-i18n="hash">escaped text</span>
   * Falls back to unwrapped text if hash not yet cached.
   */
  function wrapText(text) {
    const h = hash(text);
    if (!h) return escapeHtml(text);
    return '<span data-i18n="' + h + '">' + escapeHtml(text) + '</span>';
  }

  /**
   * Pre-compute and cache hashes for an array of strings.
   * Call this once after fetching server data (genres, metrics, etc.)
   */
  async function precomputeHashes(texts) {
    const results = {};
    await Promise.all(texts.map(async (t) => {
      const trimmed = t.trim();
      if (!hashCache.has(trimmed)) {
        const h = await generateHash(trimmed);
        hashCache.set(trimmed, h);
        results[trimmed] = h;
      } else {
        results[trimmed] = hashCache.get(trimmed);
      }
    }));
    return results;
  }

  /**
   * Import hashes computed server-side.
   * Expects: { text: hash, text2: hash2, ... }
   */
  function importHashes(map) {
    for (const [text, h] of Object.entries(map)) {
      hashCache.set(text.trim(), h);
    }
  }

  /**
   * Resolve all [data-i18n-dynamic] elements in the DOM.
   * Computes SHA-256 hashes async and sets data-i18n attributes.
   * Call after rendering dynamic server content (metrics, genres, etc.)
   */
  async function resolveDynamic(root) {
    const els = (root || document).querySelectorAll('[data-i18n-dynamic]');
    await Promise.all(Array.from(els).map(async (el) => {
      const text = el.textContent.trim();
      if (!text) return;
      const h = await generateHash(text);
      el.setAttribute('data-i18n', h);
      el.removeAttribute('data-i18n-dynamic');
      hashCache.set(text, h);
    }));
  }

  // ── Helpers ──

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  return { generateHash, addText, buildHashRegistry, refreshRegistry, getRegistry, wrapText, hash, precomputeHashes, importHashes, resolveDynamic };
})();
