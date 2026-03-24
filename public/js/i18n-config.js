/**
 * I18nConfig — Language detection, persistence, and RTL management.
 *
 * Detection priority: URL param > cookie > localStorage > browser > 'en'
 * Persists language choice to both cookie and localStorage.
 */
const I18nConfig = (() => {
  const STORAGE_KEY = 'ncm_i18n_lang';
  const COOKIE_KEY = 'ncm_i18n_lang';
  const RTL_LANGUAGES = new Set(['ar', 'he', 'fa', 'ur']);

  /**
   * Detect the preferred language using a priority chain.
   * URL param (?lang=xx) > cookie > localStorage > navigator.language > 'en'
   */
  function detectLanguage() {
    // 1. URL parameter — keep it in the URL so translated pages are shareable
    const params = new URLSearchParams(window.location.search);
    const urlLang = params.get('lang');
    if (urlLang) {
      setLanguage(urlLang);
      return urlLang;
    }

    // 2. Cookie
    const cookieLang = getCookie(COOKIE_KEY);
    if (cookieLang) return cookieLang;

    // 3. localStorage
    const storedLang = localStorage.getItem(STORAGE_KEY);
    if (storedLang) return storedLang;

    // 4. Browser language (first two chars, e.g., 'en-US' -> 'en')
    if (navigator.language) {
      return navigator.language.substring(0, 2).toLowerCase();
    }

    // 5. Fallback
    return 'en';
  }

  /**
   * Set the active language and persist to cookie + localStorage.
   * Also applies the correct text direction on the document root.
   */
  function setLanguage(lang) {
    lang = (lang || 'en').toLowerCase();
    localStorage.setItem(STORAGE_KEY, lang);
    setCookie(COOKIE_KEY, lang, 365);
    applyDirection(lang);
    return lang;
  }

  /**
   * Get the currently stored language (without full detection chain).
   */
  function getLanguage() {
    return localStorage.getItem(STORAGE_KEY) || detectLanguage();
  }

  /**
   * Check whether a language code is right-to-left.
   */
  function isRTL(lang) {
    return RTL_LANGUAGES.has((lang || '').toLowerCase());
  }

  /**
   * Apply dir="rtl" or dir="ltr" on <html> based on the language.
   */
  function applyDirection(lang) {
    const dir = isRTL(lang) ? 'rtl' : 'ltr';
    document.documentElement.setAttribute('dir', dir);
    document.documentElement.setAttribute('lang', lang);
  }

  // ── Cookie helpers ──

  function setCookie(name, value, days) {
    const expires = new Date(Date.now() + days * 864e5).toUTCString();
    document.cookie = name + '=' + encodeURIComponent(value) +
      ';expires=' + expires + ';path=/;SameSite=Lax';
  }

  function getCookie(name) {
    const match = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
    return match ? decodeURIComponent(match[1]) : null;
  }

  return { detectLanguage, setLanguage, getLanguage, isRTL, applyDirection };
})();
