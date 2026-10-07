import type { CmsConfig, LocalePrefixMode } from "../config/define";

/** A content locale code (`locales` in the site config). */
export type Locale = string;

/** Locale prefix rule that does not read the config. `code` must be a known locale. */
export function localePrefixFor(code: string, mode: LocalePrefixMode, defaultLocale: string): string {
	if (mode === "never") return "";
	if (mode === "except-default" && code === defaultLocale) return "";
	return `/${code}`;
}

/** Path rewriting that does not read the config. Adds the prefix to a default-locale path (`/posts/a`) (`/` becomes `/{code}`). */
export function localizePathWith(prefix: string, path: string): string {
	if (!prefix) return path;
	return path === "/" ? prefix : `${prefix}${path}`;
}

/** The content locales of one site and the URL rules that follow them. */
export type SiteLocales = ReturnType<typeof createLocales>;

/** The locale rules of a site config (`locales`, `defaultLocale` and `site.localePrefix`). */
export function createLocales(config: Pick<CmsConfig, "locales" | "defaultLocale" | "site">) {
	/** Content locales (`locales` in `cms.config.ts`). Separate from the language of the admin screen itself. */
	const LOCALES: readonly Locale[] = config.locales.map((locale) => locale.code);

	/** Default locale. The source locale of translations; with the default URL style (`except-default`) its URLs get no locale prefix. */
	const DEFAULT_LOCALE: Locale = config.defaultLocale;

	const isLocale = (value: unknown): value is Locale => typeof value === "string" && LOCALES.includes(value);

	/** Locales other than the default (translation locales). The name is kept from before. Whether URLs get a prefix is decided by `localePrefix`. */
	const PREFIXED_LOCALES: readonly Locale[] = LOCALES.filter((locale) => locale !== DEFAULT_LOCALE);

	/** The language name written in that language. Unknown codes are returned as is. */
	const localeName = (code: string): string => config.locales.find((locale) => locale.code === code)?.name ?? code;

	/** The language name shown in the admin screen. Unknown codes are returned as is. */
	const localeLabel = (code: string): string => {
		const locale = config.locales.find((entry) => entry.code === code);
		return locale ? (locale.label ?? locale.name) : code;
	};

	/** How the locale is added to public URLs (`site.localePrefix`, default `except-default`). */
	const LOCALE_PREFIX_MODE: LocalePrefixMode = config.site?.localePrefix ?? "except-default";

	/** Locale prefix of public URLs (follows `site.localePrefix`). Empty string if there is no prefix or the locale is unknown. */
	const localePrefix = (code: string): string =>
		isLocale(code) ? localePrefixFor(code, LOCALE_PREFIX_MODE, DEFAULT_LOCALE) : "";

	/** Converts a default-locale path (`/posts/a`) to that locale's path (follows `site.localePrefix`). */
	const localizePath = (code: string, path: string): string => localizePathWith(localePrefix(code), path);

	return {
		LOCALES,
		DEFAULT_LOCALE,
		isLocale,
		PREFIXED_LOCALES,
		localeName,
		localeLabel,
		LOCALE_PREFIX_MODE,
		localePrefix,
		localizePath,
	};
}
