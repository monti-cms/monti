// A language's name comes from here: `check:design` (`format-only`) keeps `Intl.DisplayNames` and upper-cased codes out of the screens.
import { useAdmin } from "../operations/admin-context";

/** A language's name in `language`, or its code where the browser knows none. */
export function languageName(code: string, language: string): string {
	try {
		return new Intl.DisplayNames([language], { type: "language" }).of(code) ?? code;
	} catch {
		return code;
	}
}

/**
 * A language's name in the admin's language ("en" reads "English" in English and its Korean name in Korean), its code in capitals when the browser
 * has no name for it.
 */
export function useLanguageName() {
	const { language } = useAdmin();
	const names = new Intl.DisplayNames([language], { type: "language" });
	return (code: string) => {
		try {
			return names.of(code) ?? code.toUpperCase();
		} catch {
			return code.toUpperCase();
		}
	};
}
