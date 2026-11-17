// A language's name comes from here: `check:design` (`format-only`) keeps `Intl.DisplayNames` and upper-cased codes out of the screens.
import { useAdmin } from "../operations/admin-context";

/** A language's name in `language` ("en" reads "English" in English), or its code in capitals where the browser knows none. */
export function languageName(code: string, language: string): string {
	try {
		return new Intl.DisplayNames([language], { type: "language" }).of(code) ?? code.toUpperCase();
	} catch {
		return code.toUpperCase();
	}
}

/** A translation called by its source's title: the title and its language by name, "First post (Japanese)". */
export const titleInLanguage = (title: string, code: string, language: string): string =>
	`${title} (${languageName(code, language)})`;

/**
 * A language's name in the admin's language: what every screen calls a language (owner, 2026-11-16: the admin-language name everywhere, the tabs
 * of an entry's languages too). The one place that writes each language in itself is the picker of the admin's own language, which asks
 * {@link languageName} with the language as its own.
 */
export function useLanguageName() {
	const { language } = useAdmin();
	return (code: string) => languageName(code, language);
}
