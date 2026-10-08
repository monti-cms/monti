import { translate } from "./define.js";
export * from "./define.js";
/** Language used to pick the dictionary from an admin locale (leading part, e.g. `ko-KR` -> `ko`). */
export const languageOf = (locale) => locale.split("-")[0]?.toLowerCase() ?? "en";
/**
 * Translator for one dictionary in one language, preferring the text the site overrides with `admin.messages`. Nothing is read from a site config: the
 * language and the overrides are given. Code that runs with a site gets one from it (`site.createTranslator(bundle)`, `useTranslator(bundle)` in React).
 *
 * ```ts
 * const t = createTranslator(messages, "ko");
 * t("save"); t("deleted", { name });
 * ```
 */
export function createTranslator(bundle, language, overrides) {
    return (key, vars) => translate(bundle, language, key, vars, overrides);
}
/** The language of the admin UI of a site config. */
export function createI18n(config) {
    const ADMIN_LANGUAGE_TAG = config.admin?.locale ?? config.defaultLocale;
    const ADMIN_LANGUAGE = languageOf(ADMIN_LANGUAGE_TAG);
    return {
        ADMIN_LANGUAGE_TAG,
        ADMIN_LANGUAGE,
        createTranslator: (bundle) => createTranslator(bundle, ADMIN_LANGUAGE, config.admin?.messages),
    };
}
