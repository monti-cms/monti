import { LOCALE_CODE, languageName } from "../config/rules";
/** Reading languages out of file and folder names (`hello.ko.mdx`, `ko/hello.mdx`), for `monti init` (which languages the site has). */

/**
 * Whether a name is the code of a real language, as a file or folder name writes it: two letters (`ko`, `pt-BR`). Three-letter codes are left out on purpose, because
 * too many of them are also ordinary words in a file name (`min`, `dev`, `ref`).
 */
export function isLanguageCode(value: string): boolean {
	const code = normalizeLanguageCode(value);
	// Two letters for the language; the whole code must be one a site can use (the shape `config/rules` holds).
	if (!/^[a-z]{2}(-|$)/.test(code) || !LOCALE_CODE.test(code)) return false;
	try {
		const primary = code.slice(0, 2);
		const name = new Intl.DisplayNames(["en"], { type: "language" }).of(primary);
		return name !== undefined && name.toLowerCase() !== primary;
	} catch {
		return false;
	}
}

/** A language code the way a site writes it: the language in lower case, the rest as given, joined with `-` (`pt_BR` -> `pt-BR`). */
export function normalizeLanguageCode(value: string): string {
	const [primary = "", ...rest] = value.split(/[-_]/);
	return [primary.toLowerCase(), ...rest].join("-");
}

/** A language found in the content files. */
export interface DetectedLocale {
	readonly code: string;
	/** Files in this language. */
	readonly files: number;
	/** Files that have no counterpart in another language. */
	readonly unpaired: number;
}

/**
 * Puts the default language first: the one whose files have no pair (a blog written in one language with some posts translated has its originals there), the
 * one with the most such files when several have; with no unpaired files, or a tie, the first one. The rest keep their order.
 */
export function defaultFirst(locales: readonly DetectedLocale[]): DetectedLocale[] {
	let best = locales[0];
	for (const locale of locales) if (best && locale.unpaired > best.unpaired) best = locale;
	return best ? [best, ...locales.filter((locale) => locale !== best)] : [];
}

const SUFFIXED = /^(.+)\.([A-Za-z]{2}(?:[-_][A-Za-z0-9]{2,8})*)\.(?:md|mdx)$/i;
const PLAIN = /^(.+)\.(?:md|mdx)$/i;

/**
 * The languages named by the suffixes of the files of one folder (`hello.ko.mdx` and `hello.en.mdx`), default first, or `undefined` when fewer than two files carry one
 * (a lone `notes.it.md` is more likely a name than a language).
 */
export function localesFromFileNames(names: readonly string[]): DetectedLocale[] | undefined {
	const groups = new Map<string, Set<string>>();
	let suffixed = 0;
	for (const name of [...names].sort()) {
		const match = SUFFIXED.exec(name);
		const code = match?.[2];
		if (match && code && isLanguageCode(code)) {
			suffixed++;
			const base = match[1] ?? name;
			groups.set(base, (groups.get(base) ?? new Set()).add(normalizeLanguageCode(code)));
		} else {
			// A file with no suffix is the post in the language of the site; it pairs with a suffixed file of the same name.
			const base = PLAIN.exec(name)?.[1];
			if (base) groups.set(base, (groups.get(base) ?? new Set()).add(""));
		}
	}
	if (suffixed < 2) return undefined;
	const tally = new Map<string, { files: number; unpaired: number }>();
	for (const members of groups.values()) {
		for (const code of members) {
			if (code === "") continue;
			const entry = tally.get(code) ?? { files: 0, unpaired: 0 };
			entry.files++;
			if (members.size === 1) entry.unpaired++;
			tally.set(code, entry);
		}
	}
	return defaultFirst([...tally].map(([code, counts]) => ({ code, ...counts })));
}

/** The languages `monti init` offers in its picker, by their own names. */
export const COMMON_LOCALES: readonly { readonly code: string; readonly name: string }[] = [
	{ code: "ko", name: "한국어" }, // cms-allow-korean: a language is named in its own script
	{ code: "en", name: "English" },
	{ code: "ja", name: "日本語" },
	{ code: "zh", name: "中文" },
	{ code: "es", name: "Español" },
	{ code: "fr", name: "Français" },
	{ code: "de", name: "Deutsch" },
	{ code: "pt", name: "Português" },
	{ code: "it", name: "Italiano" },
	{ code: "ru", name: "Русский" },
	{ code: "ar", name: "العربية" },
	{ code: "hi", name: "हिन्दी" },
	{ code: "id", name: "Bahasa Indonesia" },
	{ code: "vi", name: "Tiếng Việt" },
	{ code: "th", name: "ไทย" },
	{ code: "tr", name: "Türkçe" },
	{ code: "nl", name: "Nederlands" },
	{ code: "pl", name: "Polski" },
];

/** The name of a language in that language, from the table or the runtime's data; the code itself when neither knows it. */
export function languageLabel(code: string): string {
	const common = COMMON_LOCALES.find((locale) => locale.code === code);
	if (common) return common.name;
	return languageName(code);
}
