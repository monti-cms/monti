import { LOCALE_CODE } from "@monti-cms/core/site";
import type { Locale } from "./schema-model";

/** The language names Intl knows, for a code that can be picked from the list. Region and script variants are named so a writer can tell them apart. */
export const KNOWN_LOCALE_CODES: readonly string[] = [
	"ar",
	"bn",
	"cs",
	"da",
	"de",
	"el",
	"en",
	"en-GB",
	"en-US",
	"es",
	"es-419",
	"es-MX",
	"fa",
	"fi",
	"fr",
	"fr-CA",
	"he",
	"hi",
	"hu",
	"id",
	"it",
	"ja",
	"ko",
	"ms",
	"nl",
	"no",
	"pl",
	"pt",
	"pt-BR",
	"pt-PT",
	"ro",
	"ru",
	"sv",
	"th",
	"tr",
	"uk",
	"vi",
	"zh-Hans",
	"zh-Hant",
	"zh-HK",
];

/** A code as a site writes it: the language in lower case, the rest as given, joined with `-` (`ZH_Hans` gives `zh-Hans`). */
export function normalizeLocaleCode(value: string): string {
	const [language = "", ...rest] = value.trim().split(/[-_]/);
	return [language.toLowerCase(), ...rest].join("-");
}

/** Whether the text is a language code a site can use. */
export const isLocaleCode = (value: string): boolean => LOCALE_CODE.test(value);

/** The name of `code` written in `inLanguage` (`ja` in `ko` gives the Korean word for Japanese), or `undefined` when the runtime does not know the code. */
export function localeName(code: string, inLanguage: string): string | undefined {
	try {
		const name = new Intl.DisplayNames([inLanguage], { type: "language" }).of(code);
		return name && name !== code ? name : undefined;
	} catch {
		return undefined;
	}
}

/**
 * The language row for a code picked from the list: its name in itself and, when the admin language writes it differently, the display name. Names are never
 * typed, they come from the code. `undefined` when the runtime knows no name for the code.
 */
export function localeFromCode(code: string, adminLanguage: string): Locale | undefined {
	const name = localeName(code, code);
	if (!name) return undefined;
	const label = localeName(code, adminLanguage);
	return label && label !== name ? { code, name, label } : { code, name };
}

/** The codes of `known` that the search finds (in the code or in either name), minus the codes already listed. An empty search finds all of them. */
export function findLocaleCodes(
	search: string,
	taken: readonly string[],
	adminLanguage: string,
	known: readonly string[] = KNOWN_LOCALE_CODES,
): string[] {
	const needle = search.trim().toLowerCase();
	return known.filter((code) => {
		if (taken.includes(code)) return false;
		if (needle === "") return true;
		return [code, localeName(code, code), localeName(code, adminLanguage)].some((text) =>
			text?.toLowerCase().includes(needle),
		);
	});
}

/**
 * The code to offer under "type it yourself" for a search: the search itself when it is a usable code that is neither listed nor taken. A search that finds
 * its own code in the list needs no such row.
 */
export function customLocaleCode(
	search: string,
	taken: readonly string[],
	listed: readonly string[],
): string | undefined {
	const code = normalizeLocaleCode(search);
	if (code === "" || !isLocaleCode(code) || taken.includes(code) || listed.includes(code)) return undefined;
	return code;
}

/** The list with `code` moved to the top (the source language comes first). */
export function sourceFirst(locales: readonly Locale[], code: string): Locale[] {
	const source = locales.find((locale) => locale.code === code);
	return source ? [source, ...locales.filter((locale) => locale.code !== code)] : [...locales];
}
