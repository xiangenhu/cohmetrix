/**
 * language.js — canonical UI language code -> English name map.
 *
 * Kept in sync with services/llm.js LANGUAGE_NAMES and the i18n route's
 * SUPPORTED_LANGUAGES. The contextual-help route uses this to build the
 * "Respond in {name}" system-prompt line, which is what puts language into the
 * help cache key by construction (a zh reader can never be served an en answer).
 */
const LANGUAGE_NAMES = {
  en: 'English', zh: 'Chinese', es: 'Spanish', fr: 'French', de: 'German',
  ja: 'Japanese', ko: 'Korean', ar: 'Arabic', pt: 'Portuguese', ru: 'Russian',
  hi: 'Hindi', vi: 'Vietnamese', th: 'Thai', he: 'Hebrew', fa: 'Persian',
};

module.exports = { LANGUAGE_NAMES };
