/**
 * UI message dictionaries. The core, admin and extensions use messages by name (key), with one dictionary per locale. It reads no site config,
 * so it can be used from the config file and the authoring API too (the language is picked by `./index`, from a site).
 *
 * - A value is a string or a function that fills `{name}` placeholders. Words that change by the preceding word, like Korean particles, are written as functions (`josa`).
 * - English (`en`) has every key. Keys missing in other locales show in English.
 */
/** Creates a dictionary (only fits the types). Key names come from the `en` dictionary. */
export function defineMessages(namespace, messages) {
    return { namespace, messages };
}
/** Fills `{name}` placeholders. Unknown names are left as they are. */
export const fillVars = (text, vars = {}) => text.replace(/\{(\w+)\}/g, (whole, name) => (name in vars ? String(vars[name]) : whole));
/** Whether the last character of the word has a final consonant (batchim). Non-Hangul counts as having none. */
function hasFinalConsonant(word) {
    const trimmed = word.trim();
    const code = trimmed.charCodeAt(trimmed.length - 1) - 0xac00;
    return code >= 0 && code <= 11171 && code % 28 !== 0;
}
/** Attaches a Korean particle that fits the word. `josa("태그", "을", "를")` -> `태그를`. Used by function messages in the Korean dictionaries (`@monti-cms/core/client`); not exported from the main entry. */
export const josa = (word, withFinal, withoutFinal) => `${word}${hasFinalConsonant(word) ? withFinal : withoutFinal}`;
/** Picks a message from the dictionary: site override -> that locale -> English -> key. */
export function translate(bundle, language, key, vars, overrides) {
    const value = overrides?.[bundle.namespace]?.[key] ?? bundle.messages[language]?.[key] ?? bundle.messages.en[key] ?? key;
    return typeof value === "function" ? value(vars ?? {}) : fillVars(value, vars);
}
