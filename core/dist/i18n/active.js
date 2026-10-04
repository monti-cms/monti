import { translate } from "./define.js";
let language = "en";
let overrides;
/** Sets the UI locale and the overridden text (`./index` calls it with the site config). */
export function setActiveLocale(next, nextOverrides) {
    language = next;
    overrides = nextOverrides;
}
/** Current UI locale (leading part, e.g. `ko`). */
export const activeLanguage = () => language;
/**
 * Translator for one dictionary. Picks the current UI locale on every call. Used in modules the config file reads (elsewhere use `createTranslator`).
 */
export function createActiveTranslator(bundle) {
    return (key, vars) => translate(bundle, language, key, vars, overrides);
}
