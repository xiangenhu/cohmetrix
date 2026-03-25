/**
 * I18nSelector — URL-based language switching with a compact topbar indicator.
 *
 * Language is set via URL parameter: ?lang=zh (or &lang=zh)
 * When a non-English language is active, shows a small indicator in the topbar
 * with the current language code and a link to switch back to English.
 *
 * On init: detects language from URL/cookie/localStorage, initializes the engine.
 */
const I18nSelector = (() => {
  let currentLang = 'en';

  /**
   * Initialize: detect language, start engine if non-English, show indicator.
   */
  async function init() {
    currentLang = I18nConfig.detectLanguage();
    I18nConfig.setLanguage(currentLang);

    // Build indicator in topbar
    insertIndicator();

    // If non-English, start the translation engine
    if (currentLang !== 'en') {
      await I18nEngine.init(currentLang, 'auto');
    }
  }

  /**
   * Build and insert the language indicator into the topbar.
   * Shows current language code with a dropdown of available languages.
   */
  function insertIndicator() {
    const topbarRight = document.querySelector('.topbar-right');
    if (!topbarRight) return;

    const container = document.createElement('div');
    container.className = 'i18n-selector';
    container.style.cssText = 'position:relative;display:inline-flex;align-items:center;';

    // Trigger button
    const trigger = document.createElement('button');
    trigger.className = 'i18n-trigger';
    trigger.textContent = currentLang.toUpperCase();
    trigger.title = currentLang === 'en' ? 'Translate: add ?lang=zh to URL' : 'Current language: ' + currentLang;
    trigger.style.cssText =
      'background:' + (currentLang === 'en' ? 'transparent' : 'var(--teal, #2dd4bf)') + ';' +
      'color:' + (currentLang === 'en' ? 'var(--text-tertiary, #888)' : 'var(--bg-primary, #0f1117)') + ';' +
      'border:1px solid ' + (currentLang === 'en' ? 'var(--border-secondary, #333)' : 'var(--teal, #2dd4bf)') + ';' +
      'border-radius:var(--radius-md, 6px);' +
      'padding:3px 7px;' +
      'font-size:11px;font-weight:600;cursor:pointer;letter-spacing:0.5px;line-height:1;' +
      'font-family:var(--font-mono, monospace);transition:all 0.15s;';

    trigger.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleDropdown(container);
    });

    // Dropdown
    const dropdown = document.createElement('div');
    dropdown.className = 'i18n-dropdown';
    dropdown.style.cssText =
      'display:none;position:absolute;top:calc(100% + 6px);right:0;' +
      'min-width:160px;max-height:280px;overflow-y:auto;' +
      'background:var(--bg-secondary, #1a1b26);border:1px solid var(--border-primary, #333);' +
      'border-radius:var(--radius-md, 8px);box-shadow:0 8px 24px rgba(0,0,0,0.4);' +
      'z-index:1000;padding:4px 0;';

    // Fetch languages and build list
    fetchLanguages().then(languages => {
      languages.forEach(lang => {
        const item = document.createElement('a');
        const url = new URL(window.location.href);
        if (lang.code === 'en') {
          url.searchParams.delete('lang');
        } else {
          url.searchParams.set('lang', lang.code);
        }
        item.href = url.toString();
        item.className = 'i18n-lang-item';
        item.style.cssText =
          'display:block;padding:6px 12px;font-size:13px;text-decoration:none;' +
          'color:var(--text-primary, #cdd6f4);transition:background 0.1s;' +
          (lang.code === currentLang
            ? 'background:var(--teal, #2dd4bf);color:var(--bg-primary, #0f1117);font-weight:600;'
            : '');
        item.textContent = lang.name;
        item.addEventListener('mouseenter', () => {
          if (lang.code !== currentLang) item.style.background = 'rgba(45,212,191,0.15)';
        });
        item.addEventListener('mouseleave', () => {
          if (lang.code !== currentLang) item.style.background = 'transparent';
        });
        dropdown.appendChild(item);
      });
    });

    container.appendChild(trigger);
    container.appendChild(dropdown);

    // Insert before user-bar if present
    const userBar = document.getElementById('user-bar');
    if (userBar) {
      topbarRight.insertBefore(container, userBar);
    } else {
      topbarRight.appendChild(container);
    }

    // Close on outside click
    document.addEventListener('click', (e) => {
      if (!container.contains(e.target)) {
        dropdown.style.display = 'none';
      }
    });
  }

  function toggleDropdown(container) {
    const dd = container.querySelector('.i18n-dropdown');
    if (dd) dd.style.display = dd.style.display === 'none' ? 'block' : 'none';
  }

  async function fetchLanguages() {
    try {
      const resp = await fetch('/api/i18n/languages');
      if (resp.ok) {
        const data = await resp.json();
        return [{ code: 'en', name: 'English' }, ...(data.languages || [])];
      }
    } catch {}
    return [
      { code: 'en', name: 'English' },
      { code: 'zh', name: '中文' },
      { code: 'es', name: 'Español' },
      { code: 'fr', name: 'Français' },
      { code: 'de', name: 'Deutsch' },
      { code: 'ja', name: '日本語' },
      { code: 'ko', name: '한국어' },
      { code: 'ar', name: 'العربية' },
      { code: 'pt', name: 'Português' },
      { code: 'ru', name: 'Русский' },
    ];
  }

  function getCurrentLang() { return currentLang; }

  function switchLang(code) {
    const url = new URL(window.location.href);
    url.searchParams.set('lang', code);
    window.location.href = url.toString();
  }

  return { init, getCurrentLang, switchLang };
})();
