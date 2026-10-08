import type { CmsConfig, LocalePrefixMode } from "../config/define.js";
/** A content locale code (`locales` in the site config). */
export type Locale = string;
/** Locale prefix rule that does not read the config. `code` must be a known locale. */
export declare function localePrefixFor(code: string, mode: LocalePrefixMode, defaultLocale: string): string;
/** Path rewriting that does not read the config. Adds the prefix to a default-locale path (`/posts/a`) (`/` becomes `/{code}`). */
export declare function localizePathWith(prefix: string, path: string): string;
/** The content locales of one site and the URL rules that follow them. */
export type SiteLocales = ReturnType<typeof createLocales>;
/** The locale rules of a site config (`locales`, `defaultLocale` and `site.localePrefix`). */
export declare function createLocales(config: Pick<CmsConfig, "locales" | "defaultLocale" | "site">): {
    LOCALES: readonly string[];
    DEFAULT_LOCALE: string;
    isLocale: (value: unknown) => value is Locale;
    PREFIXED_LOCALES: readonly string[];
    localeName: (code: string) => string;
    localeLabel: (code: string) => string;
    LOCALE_PREFIX_MODE: LocalePrefixMode;
    localePrefix: (code: string) => string;
    localizePath: (code: string, path: string) => string;
};
