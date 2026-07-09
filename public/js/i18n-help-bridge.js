/**
 * i18n-help-bridge.js — exposes `window.I18n` for contextual-help.js, backed by
 * this app's hash-based i18n engine (I18nConfig / I18nUtils / I18nEngine).
 *
 * contextual-help.js is app-agnostic: it reads `window.I18n.lang`, calls
 * `window.I18n.t(src)` for dynamic strings, and calls `window.I18n.applyTo(el)`
 * after building its chip/card so the host app can translate the chrome. This
 * bridge maps those hooks onto the app's engine:
 *
 *   - lang        -> I18nConfig.getLanguage()
 *   - t(src)      -> identity (English source is authoritative; visible chrome is
 *                    translated via data-i18n, so t() must NOT pre-translate —
 *                    that is the "echo-of-source guard" in CONTEXT_HELP.md §4.8)
 *   - applyTo(el) -> translate BOTH:
 *                      • [data-i18n]      textContent (SHA-256/16 hash of the
 *                        English source) via I18nEngine.translateElement()
 *                      • [data-i18n-attr] attributes (title / placeholder / aria-
 *                        label) via the public /api/i18n/translate route — the app
 *                        engine only handles textContent, so the bridge fills the
 *                        attribute gap so tooltips + input placeholder localize too.
 *
 * The chip/card carry bare `data-i18n` attributes (English text as content); we
 * hash on demand with the same scheme as I18nUtils.generateHash / the /api/genres
 * endpoint, so the app's translation cache is shared with the rest of the UI.
 *
 * Language changes in this app are a full page reload (?lang= links), so the widget
 * simply re-boots in the new language; the en-restore paths below are belt-and-
 * suspenders for any future in-place switch.
 *
 * Load this BEFORE contextual-help.js and AFTER the i18n-*.js engine files.
 */
(function () {
  'use strict';
  if (window.I18n) return; // don't clobber a real i18n facade if one appears

  function ready() {
    return window.I18nConfig && window.I18nUtils && window.I18nEngine;
  }

  // Session cache for attribute translations: "lang|hash" -> translated string.
  var attrCache = Object.create(null);

  async function translateText(el) {
    if (!el || !el.getAttribute) return;
    let hash = el.getAttribute('data-i18n');
    if (!hash) {
      const text = (el.getAttribute('data-i18n-original') || el.textContent || '').trim();
      if (!text) return;
      try { hash = await window.I18nUtils.generateHash(text); } catch (_) { return; }
      el.setAttribute('data-i18n', hash);
    }
    if (!el.getAttribute('data-i18n-original')) {
      el.setAttribute('data-i18n-original', el.textContent);
    }
    try { await window.I18nEngine.translateElement(el); } catch (_) { /* best-effort */ }
  }

  function restoreText(el) {
    if (!el || !el.getAttribute) return;
    const o = el.getAttribute('data-i18n-original');
    if (o != null) { el.textContent = o; el.removeAttribute('data-i18n-state'); }
  }

  async function translateAttr(el, lang) {
    if (!el || !el.getAttribute) return;
    const attr = el.getAttribute('data-i18n-attr');
    if (!attr) return;
    let src = el.getAttribute('data-i18n-attr-original');
    if (src == null) { src = el.getAttribute(attr) || ''; el.setAttribute('data-i18n-attr-original', src); }
    src = String(src).trim();
    if (!src) return;
    try {
      const hash = await window.I18nUtils.generateHash(src);
      const ck = lang + '|' + hash;
      if (attrCache[ck]) { el.setAttribute(attr, attrCache[ck]); return; }
      const r = await fetch('/api/i18n/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: src, lang: lang, hash: hash }),
      });
      if (!r.ok) return;
      const d = await r.json();
      if (d && d.translation) {
        attrCache[ck] = d.translation;
        if (I18n.lang === lang) el.setAttribute(attr, d.translation); // still same lang
      }
    } catch (_) { /* best-effort */ }
  }

  function restoreAttr(el) {
    if (!el || !el.getAttribute) return;
    const attr = el.getAttribute('data-i18n-attr');
    const o = el.getAttribute('data-i18n-attr-original');
    if (attr && o != null) el.setAttribute(attr, o);
  }

  function collect(root, selector) {
    const out = [];
    if (root.getAttribute && root.hasAttribute && root.hasAttribute(selector.attr)) out.push(root);
    if (root.querySelectorAll) root.querySelectorAll(selector.css).forEach(function (el) { out.push(el); });
    return out;
  }

  var I18n = {
    get lang() {
      try { return (window.I18nConfig.getLanguage() || 'en').toLowerCase(); }
      catch (_) { return 'en'; }
    },
    // Identity by design — see echo-of-source guard above.
    t: function (src) { return src; },
    applyTo: function (root) {
      if (!ready() || !root) return;
      const lang = I18n.lang;
      const restore = (!lang || lang === 'en'); // English is the source

      collect(root, { attr: 'data-i18n', css: '[data-i18n]' })
        .forEach(function (el) { restore ? restoreText(el) : translateText(el); });

      collect(root, { attr: 'data-i18n-attr', css: '[data-i18n-attr]' })
        .forEach(function (el) { restore ? restoreAttr(el) : translateAttr(el, lang); });
    },
  };

  window.I18n = I18n;
})();
