import { cmsConfig } from "../config/resolved.js";
/** Content locales (`locales` in `cms.config.ts`). Separate from the language of the admin screen itself. */
export const LOCALES = cmsConfig.locales.map((locale) => locale.code);
/** Default locale. The source locale of translations; with the default URL style (`except-default`) its URLs get no locale prefix. */
export const DEFAULT_LOCALE = cmsConfig.defaultLocale;
export const isLocale = (value) => typeof value === "string" && LOCALES.includes(value);
/** Locales other than the default (translation locales). The name is kept from before. Whether URLs get a prefix is decided by `localePrefix`. */
export const PREFIXED_LOCALES = LOCALES.filter((locale) => locale !== DEFAULT_LOCALE);
/** The language name written in that language. Unknown codes are returned as is. */
export const localeName = (code) => cmsConfig.locales.find((locale) => locale.code === code)?.name ?? code;
/** The language name shown in the admin screen. Unknown codes are returned as is. */
export const localeLabel = (code) => {
    const locale = cmsConfig.locales.find((entry) => entry.code === code);
    return locale ? (locale.label ?? locale.name) : code;
};
/** How the locale is added to public URLs (`site.localePrefix`, default `except-default`). */
export const LOCALE_PREFIX_MODE = cmsConfig.site?.localePrefix ?? "except-default";
/** Locale prefix rule that does not read the config. `code` must be a known locale. */
export function localePrefixFor(code, mode, defaultLocale) {
    if (mode === "never")
        return "";
    if (mode === "except-default" && code === defaultLocale)
        return "";
    return `/${code}`;
}
/** Path rewriting that does not read the config. Adds the prefix to a default-locale path (`/posts/a`) (`/` becomes `/{code}`). */
export function localizePathWith(prefix, path) {
    if (!prefix)
        return path;
    return path === "/" ? prefix : `${prefix}${path}`;
}
/** Locale prefix of public URLs (follows `site.localePrefix`). Empty string if there is no prefix or the locale is unknown. */
export const localePrefix = (code) => isLocale(code) ? localePrefixFor(code, LOCALE_PREFIX_MODE, DEFAULT_LOCALE) : "";
/** Converts a default-locale path (`/posts/a`) to that locale's path (follows `site.localePrefix`). */
export const localizePath = (code, path) => localizePathWith(localePrefix(code), path);
