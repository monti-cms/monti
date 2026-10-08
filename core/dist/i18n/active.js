import { translate } from "./define.js";
let language = "en";
let overrides;
/** Runs `read` with the labels of definitions picked in `nextLanguage` (and `nextOverrides` text), then restores what was set before. Synchronous only. */
export function withActiveLocale(nextLanguage, nextOverrides, read) {
    const previous = { language, overrides };
    language = nextLanguage;
    overrides = nextOverrides;
    try {
        return read();
    }
    finally {
        ({ language, overrides } = previous);
    }
}
/** Current language of definition labels (leading part, e.g. `ko`). English outside `withActiveLocale`. */
export const activeLanguage = () => language;
/**
 * Translator for one dictionary, for the getters of definitions. Picks the language set by `withActiveLocale` on every call. Used in modules the config file reads;
 * code that runs with a site uses `site.createTranslator(bundle)`.
 */
export function createActiveTranslator(bundle) {
    return (key, vars) => translate(bundle, language, key, vars, overrides);
}
/**
 * Copies `value` with every getter read (the text of labels in the active language) and nothing else changed: plain objects and arrays are copied,
 * functions and other values are kept as they are.
 */
export function resolveLabels(value) {
    if (Array.isArray(value))
        return value.map(resolveLabels);
    if (value === null || typeof value !== "object")
        return value;
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null)
        return value;
    const copy = {};
    for (const key of Object.keys(value))
        copy[key] = resolveLabels(value[key]);
    return copy;
}
