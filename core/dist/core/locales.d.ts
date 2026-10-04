import type { LocalePrefixMode } from "../config/define.js";
import { cmsConfig } from "../config/resolved.js";
/** Content locales (`locales` in `cms.config.ts`). Separate from the language of the admin screen itself. */
export declare const LOCALES: string[];
export type Locale = (typeof cmsConfig.locales)[number]["code"];
/** Default locale. The source locale of translations; with the default URL style (`except-default`) its URLs get no locale prefix. */
export declare const DEFAULT_LOCALE: Locale;
export declare const isLocale: (value: unknown) => value is Locale;
/** Locales other than the default (translation locales). The name is kept from before. Whether URLs get a prefix is decided by `localePrefix`. */
export declare const PREFIXED_LOCALES: string[];
/** The language name written in that language. Unknown codes are returned as is. */
export declare const localeName: (code: string) => string;
/** The language name shown in the admin screen. Unknown codes are returned as is. */
export declare const localeLabel: (code: string) => string;
/** How the locale is added to public URLs (`site.localePrefix`, default `except-default`). */
export declare const LOCALE_PREFIX_MODE: LocalePrefixMode;
/** Locale prefix rule that does not read the config. `code` must be a known locale. */
export declare function localePrefixFor(code: string, mode: LocalePrefixMode, defaultLocale: string): string;
/** Path rewriting that does not read the config. Adds the prefix to a default-locale path (`/posts/a`) (`/` becomes `/{code}`). */
export declare function localizePathWith(prefix: string, path: string): string;
/** Locale prefix of public URLs (follows `site.localePrefix`). Empty string if there is no prefix or the locale is unknown. */
export declare const localePrefix: (code: string) => string;
/** Converts a default-locale path (`/posts/a`) to that locale's path (follows `site.localePrefix`). */
export declare const localizePath: (code: string, path: string) => string;
