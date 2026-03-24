/**
 * I18nEngine — Core translation engine with three display modes.
 *
 * Modes:
 *   'auto'           — translate all elements immediately, click to toggle
 *   'hover-replace'  — translate on hover, persist after mouseleave, click to toggle
 *   'hover-tooltip'  — show translation as tooltip on hover, click converts to replace
 *
 * Uses fetch() for /api/i18n/* endpoints (no auth required).
 * Manages a dirty buffer of new translations, flushed to the server periodically.
 */
const I18nEngine = (() => {
  let currentLang = 'en';
  let currentMode = 'auto';
  let translationCache = new Map(); // hash -> translated text
  let dirtyBuffer = new Map();      // hash -> { text, translation, lang }
  let flushTimer = null;
  let observer = null;
  let activeListeners = [];         // track listeners for cleanup

  // Concurrency control: max 3 simultaneous translate requests
  let activeRequests = 0;
  const MAX_CONCURRENT = 3;
  const requestQueue = [];

  /**
   * Initialize the translation engine.
   */
  async function init(lang, mode) {
    currentLang = lang || I18nConfig.getLanguage();
    currentMode = mode || 'auto';

    if (currentLang === 'en') return; // No translation needed for English

    // 1. Preload cached translations from server
    await preloadTranslations(currentLang);

    // 2. Build the hash registry
    I18nUtils.buildHashRegistry();

    // 3. Initialize the selected mode
    initMode(currentMode);

    // 4. Observe DOM for dynamic content
    observeDOM();

    // 5. Flush dirty buffer on page hide/unload
    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('beforeunload', onBeforeUnload);
  }

  /**
   * Fetch all cached translations for a language from the server.
   */
  async function preloadTranslations(lang) {
    try {
      const resp = await fetch('/api/i18n/load?lang=' + encodeURIComponent(lang));
      if (!resp.ok) return;
      const data = await resp.json();
      // data expected as { translations: { hash: translatedText, ... } }
      if (data && data.translations) {
        Object.entries(data.translations).forEach(([hash, text]) => {
          translationCache.set(hash, text);
        });
      }
    } catch {
      // Silently fail — translations will be fetched on demand
    }
  }

  /**
   * Translate a single [data-i18n] element.
   */
  async function translateElement(el) {
    const hash = el.getAttribute('data-i18n');
    if (!hash) return;

    // Store original text if not already saved
    if (!el.getAttribute('data-i18n-original')) {
      el.setAttribute('data-i18n-original', el.textContent);
    }

    // Check cache first
    if (translationCache.has(hash)) {
      applyTranslation(el, translationCache.get(hash));
      return;
    }

    // Queue the translation request
    return enqueueRequest(async () => {
      // Double-check cache (may have been filled while queued)
      if (translationCache.has(hash)) {
        applyTranslation(el, translationCache.get(hash));
        return;
      }

      try {
        const originalText = el.getAttribute('data-i18n-original') || el.textContent;
        const resp = await fetch('/api/i18n/translate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: originalText,
            lang: currentLang,
            hash: hash,
          }),
        });

        if (!resp.ok) return;
        const data = await resp.json();

        if (data && data.translation) {
          translationCache.set(hash, data.translation);
          applyTranslation(el, data.translation);

          // Add to dirty buffer for batch save
          dirtyBuffer.set(hash, {
            text: originalText,
            translation: data.translation,
            lang: currentLang,
          });
          scheduleFlush();
        }
      } catch {
        // Silently fail for individual translation errors
      }
    });
  }

  /**
   * Apply translated text to an element.
   */
  function applyTranslation(el, translatedText) {
    el.textContent = translatedText;
    el.classList.add('i18n-translated');
    el.setAttribute('data-i18n-state', 'translated');
  }

  // ── Mode implementations ──

  function initMode(mode) {
    cleanupMode();
    currentMode = mode;

    switch (mode) {
      case 'auto':
        initAutoMode();
        break;
      case 'hover-replace':
        initHoverReplaceMode();
        break;
      case 'hover-tooltip':
        initHoverTooltipMode();
        break;
    }
  }

  function initAutoMode() {
    const registry = I18nUtils.getRegistry();
    registry.forEach(({ element }) => {
      translateElement(element);
      addTrackedListener(element, 'click', () => toggleElement(element));
    });
  }

  function initHoverReplaceMode() {
    const registry = I18nUtils.getRegistry();
    registry.forEach(({ element }) => {
      element.classList.add('i18n-hover');

      const onEnter = () => {
        if (element.getAttribute('data-i18n-state') !== 'translated') {
          translateElement(element);
        }
      };
      const onClick = () => toggleElement(element);

      addTrackedListener(element, 'mouseenter', onEnter);
      addTrackedListener(element, 'click', onClick);
    });
  }

  function initHoverTooltipMode() {
    const registry = I18nUtils.getRegistry();
    registry.forEach(({ element }) => {
      element.classList.add('i18n-has-tooltip');

      const onEnter = async () => {
        const hash = element.getAttribute('data-i18n');
        if (translationCache.has(hash)) {
          element.title = translationCache.get(hash);
        } else {
          // Fetch translation for tooltip
          const originalText = element.getAttribute('data-i18n-original') || element.textContent;
          try {
            const resp = await fetch('/api/i18n/translate', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ text: originalText, lang: currentLang, hash }),
            });
            if (resp.ok) {
              const data = await resp.json();
              if (data && data.translation) {
                translationCache.set(hash, data.translation);
                element.title = data.translation;
              }
            }
          } catch { /* ignore */ }
        }
      };

      const onClick = () => {
        // Convert tooltip mode to replace for this element
        element.classList.remove('i18n-has-tooltip');
        element.title = '';
        const hash = element.getAttribute('data-i18n');
        if (translationCache.has(hash)) {
          if (!element.getAttribute('data-i18n-original')) {
            element.setAttribute('data-i18n-original', element.textContent);
          }
          applyTranslation(element, translationCache.get(hash));
        } else {
          translateElement(element);
        }
      };

      addTrackedListener(element, 'mouseenter', onEnter);
      addTrackedListener(element, 'click', onClick);
    });
  }

  /**
   * Switch to a different display mode.
   */
  function switchMode(newMode) {
    cleanupMode();
    I18nUtils.refreshRegistry();
    initMode(newMode);
  }

  /**
   * Switch to a different language. Clears cache and re-initializes.
   */
  async function switchLanguage(newLang) {
    // Flush any pending translations for the old language
    flushDirtyBuffer();

    // Reset state
    translationCache.clear();
    dirtyBuffer.clear();
    currentLang = newLang;
    I18nConfig.setLanguage(newLang);

    // Restore all elements to original text
    const registry = I18nUtils.getRegistry();
    registry.forEach(({ element }) => {
      const original = element.getAttribute('data-i18n-original');
      if (original) {
        element.textContent = original;
        element.classList.remove('i18n-translated');
        element.removeAttribute('data-i18n-state');
      }
    });

    if (newLang === 'en') {
      cleanupMode();
      return;
    }

    // Re-init with new language
    await preloadTranslations(newLang);
    I18nUtils.refreshRegistry();
    initMode(currentMode);
  }

  /**
   * Toggle an element between original and translated text.
   */
  function toggleElement(el) {
    const state = el.getAttribute('data-i18n-state');
    const original = el.getAttribute('data-i18n-original');
    const hash = el.getAttribute('data-i18n');

    if (state === 'translated' && original) {
      el.textContent = original;
      el.classList.remove('i18n-translated');
      el.setAttribute('data-i18n-state', 'original');
    } else if (state === 'original' && translationCache.has(hash)) {
      applyTranslation(el, translationCache.get(hash));
    }
  }

  // ── Dirty buffer / batch save ──

  function scheduleFlush() {
    if (flushTimer) return;
    flushTimer = setTimeout(() => {
      flushTimer = null;
      flushDirtyBuffer();
    }, 5000);
  }

  function flushDirtyBuffer() {
    if (dirtyBuffer.size === 0) return;

    const entries = [];
    dirtyBuffer.forEach((val, hash) => {
      entries.push({ hash, text: val.text, translation: val.translation, lang: val.lang });
    });
    dirtyBuffer.clear();

    // Fire and forget — use sendBeacon if available for unload, otherwise fetch
    const payload = JSON.stringify({ translations: entries });

    if (document.visibilityState === 'hidden' && navigator.sendBeacon) {
      navigator.sendBeacon('/api/i18n/batch-save',
        new Blob([payload], { type: 'application/json' }));
    } else {
      fetch('/api/i18n/batch-save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payload,
      }).catch(() => {});
    }
  }

  function onVisibilityChange() {
    if (document.visibilityState === 'hidden') flushDirtyBuffer();
  }

  function onBeforeUnload() {
    flushDirtyBuffer();
  }

  // ── Concurrency queue ──

  function enqueueRequest(fn) {
    return new Promise((resolve, reject) => {
      requestQueue.push({ fn, resolve, reject });
      processQueue();
    });
  }

  function processQueue() {
    while (activeRequests < MAX_CONCURRENT && requestQueue.length > 0) {
      const { fn, resolve, reject } = requestQueue.shift();
      activeRequests++;
      fn().then(resolve).catch(reject).finally(() => {
        activeRequests--;
        processQueue();
      });
    }
  }

  // ── DOM observer ──

  function observeDOM() {
    if (observer) observer.disconnect();

    observer = new MutationObserver(mutations => {
      let hasNew = false;
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (node.nodeType !== 1) continue; // Element nodes only
          if (node.hasAttribute && node.hasAttribute('data-i18n')) {
            hasNew = true;
            break;
          }
          if (node.querySelector && node.querySelector('[data-i18n]')) {
            hasNew = true;
            break;
          }
        }
        if (hasNew) break;
      }

      if (hasNew) {
        I18nUtils.refreshRegistry();
        // Translate new elements based on current mode
        if (currentMode === 'auto' && currentLang !== 'en') {
          const registry = I18nUtils.getRegistry();
          registry.forEach(({ element }) => {
            if (!element.getAttribute('data-i18n-state')) {
              translateElement(element);
              element.addEventListener('click', () => toggleElement(element));
            }
          });
        }
      }
    });

    observer.observe(document.body, { childList: true, subtree: true });
  }

  // ── Listener tracking for cleanup ──

  function addTrackedListener(el, event, handler) {
    el.addEventListener(event, handler);
    activeListeners.push({ el, event, handler });
  }

  function cleanupMode() {
    // Remove all tracked listeners
    activeListeners.forEach(({ el, event, handler }) => {
      el.removeEventListener(event, handler);
    });
    activeListeners = [];

    // Remove mode-specific classes
    document.querySelectorAll('.i18n-hover').forEach(el => el.classList.remove('i18n-hover'));
    document.querySelectorAll('.i18n-has-tooltip').forEach(el => {
      el.classList.remove('i18n-has-tooltip');
      el.title = '';
    });
  }

  return { init, switchLanguage, switchMode, translateElement };
})();
