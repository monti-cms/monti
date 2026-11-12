/**
 * The language codes "+ Add a language" offers (doc 12, 2026-11-11): the two-letter codes of the languages sites are written in, and the script and
 * region forms that are languages of their own on the web (`zh-Hans`, `pt-BR`). The names are not kept here: the browser knows each language's own
 * name and its name in the admin's language (`Intl.DisplayNames`). A code that is not here is written into `monti.schema.ts` by the developer.
 */
const CODES = [
	"af",
	"am",
	"ar",
	"az",
	"be",
	"bg",
	"bn",
	"bs",
	"ca",
	"cs",
	"cy",
	"da",
	"de",
	"de-AT",
	"de-CH",
	"el",
	"en",
	"en-AU",
	"en-CA",
	"en-GB",
	"en-US",
	"eo",
	"es",
	"es-419",
	"es-ES",
	"es-MX",
	"et",
	"eu",
	"fa",
	"fi",
	"fil",
	"fr",
	"fr-CA",
	"fr-CH",
	"ga",
	"gl",
	"gu",
	"he",
	"hi",
	"hr",
	"hu",
	"hy",
	"id",
	"is",
	"it",
	"ja",
	"ka",
	"kk",
	"km",
	"kn",
	"ko",
	"ky",
	"lo",
	"lt",
	"lv",
	"mk",
	"ml",
	"mn",
	"mr",
	"ms",
	"my",
	"nb",
	"ne",
	"nl",
	"nl-BE",
	"pa",
	"pl",
	"pt",
	"pt-BR",
	"pt-PT",
	"ro",
	"ru",
	"si",
	"sk",
	"sl",
	"sq",
	"sr",
	"sr-Latn",
	"sv",
	"sw",
	"ta",
	"te",
	"th",
	"tr",
	"uk",
	"ur",
	"uz",
	"vi",
	"zh",
	"zh-Hans",
	"zh-Hant",
	"zh-HK",
	"zh-TW",
	"zu",
] as const;

/** A language to add: its code, its name written in itself (what the schema keeps) and its name in the admin's language. */
export type CatalogLanguage = { code: string; name: string; label: string };

/** A language's name in `language`, or its code where the browser knows none. */
export function languageName(code: string, language: string): string {
	try {
		return new Intl.DisplayNames([language], { type: "language" }).of(code) ?? code;
	} catch {
		return code;
	}
}

/**
 * The languages to offer for `query`, without the ones the site has: a code that starts with it comes first, then a name that holds it (in
 * itself or in the admin's language).
 */
export function findLanguages(query: string, language: string, taken: readonly string[]): CatalogLanguage[] {
	const words = query.trim().toLowerCase();
	const all = CODES.filter((code) => !taken.includes(code)).map((code) => ({
		code,
		name: languageName(code, code),
		label: languageName(code, language),
	}));
	if (!words) return all;
	const byCode = all.filter((each) => each.code.toLowerCase().startsWith(words));
	const byName = all.filter(
		(each) =>
			!byCode.includes(each) && (each.name.toLowerCase().includes(words) || each.label.toLowerCase().includes(words)),
	);
	return [...byCode, ...byName];
}
