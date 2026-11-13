import { reader } from "@/lib/monti";

/** The site's first page in a language, as the site's languages show it in an address. */
export function home(locale: string): string {
	const { source, prefix } = reader.locales();
	return prefix === "always" || (prefix === "exceptSource" && locale !== source) ? `/${locale}` : "/";
}
