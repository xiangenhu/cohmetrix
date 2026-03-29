/**
 * I18nSelector — Language dropdown selector in the topbar.
 *
 * Always visible as a compact select-style dropdown showing current language.
 * Clicking opens a scrollable list of available languages.
 * Selecting a language sets ?lang= URL param and reloads.
 */
const I18nSelector = (() => {
  let currentLang = 'en';
  let languages = [];

  async function init() {
    currentLang = I18nConfig.detectLanguage();
    I18nConfig.setLanguage(currentLang);

    languages = await fetchLanguages();
    insertSelector();

    if (currentLang !== 'en') {
      await I18nEngine.init(currentLang, 'auto');
    }
  }

  function getCurrentLangName() {
    const lang = languages.find(l => l.code === currentLang);
    return lang ? lang.name : currentLang.toUpperCase();
  }

  function insertSelector() {
    const topbarRight = document.querySelector('.topbar-right');
    if (!topbarRight) return;

    const container = document.createElement('div');
    container.className = 'i18n-selector';

    // Trigger button — globe icon + language name + chevron
    const trigger = document.createElement('button');
    trigger.className = 'i18n-current';
    trigger.innerHTML =
      '<svg class="i18n-globe" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
        '<circle cx="12" cy="12" r="10"/>' +
        '<path d="M2 12h20"/>' +
        '<path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>' +
      '</svg>' +
      '<span class="i18n-current-label">' + getCurrentLangName() + '</span>' +
      '<svg class="i18n-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">' +
        '<polyline points="6 9 12 15 18 9"/>' +
      '</svg>';
    trigger.title = 'Select language';

    trigger.addEventListener('click', (e) => {
      e.stopPropagation();
      const dd = container.querySelector('.i18n-dropdown');
      if (dd) dd.classList.toggle('open');
    });

    // Dropdown panel
    const dropdown = document.createElement('div');
    dropdown.className = 'i18n-dropdown';

    // Language list
    const list = document.createElement('div');
    list.className = 'i18n-lang-list';

    languages.forEach(lang => {
      const item = document.createElement('a');
      const url = new URL(window.location.href);
      if (lang.code === 'en') {
        url.searchParams.delete('lang');
      } else {
        url.searchParams.set('lang', lang.code);
      }
      item.href = url.toString();
      item.className = 'i18n-lang-item' + (lang.code === currentLang ? ' active' : '');
      item.innerHTML =
        '<span class="i18n-lang-name">' + lang.name + '</span>' +
        '<span class="i18n-lang-code">' + lang.code.toUpperCase() + '</span>';
      list.appendChild(item);
    });

    dropdown.appendChild(list);

    // Mode switcher (only when non-English)
    if (currentLang !== 'en') {
      const modes = document.createElement('div');
      modes.className = 'i18n-mode-switcher';
      [
        { id: 'auto', label: 'Auto' },
        { id: 'hover-replace', label: 'Hover' },
        { id: 'hover-tooltip', label: 'Tooltip' },
      ].forEach(m => {
        const btn = document.createElement('button');
        btn.className = 'i18n-mode-btn' + (m.id === 'auto' ? ' active' : '');
        btn.textContent = m.label;
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          modes.querySelectorAll('.i18n-mode-btn').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          if (typeof I18nEngine !== 'undefined') I18nEngine.switchMode(m.id);
        });
        modes.appendChild(btn);
      });
      dropdown.appendChild(modes);
    }

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
        dropdown.classList.remove('open');
      }
    });
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
    if (code === 'en') {
      url.searchParams.delete('lang');
    } else {
      url.searchParams.set('lang', code);
    }
    window.location.href = url.toString();
  }

  return { init, getCurrentLang, switchLang };
})();
