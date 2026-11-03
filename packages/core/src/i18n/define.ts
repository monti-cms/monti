/**
 * UI message dictionaries. The core, admin and extensions use messages by name (key), with one dictionary per locale. It reads no site config,
 * so it can be used from the config file and the authoring API too (the language is picked by `./index`, from a site).
 *
 * - A value is a string or a function that fills `{name}` placeholders. Words that change by the preceding word, like Korean particles, are written as functions (`josa`).
 * - English (`en`) has every key. Keys missing in other locales show in English.
 */

export type MessageVars = Readonly<Record<string, string | number>>;
export type MessageValue = string | ((vars: MessageVars) => string);
export type MessageDict<K extends string = string> = Readonly<Record<K, MessageValue>>;

/** Dictionaries per locale for one group (namespace). `en` has every key. */
export interface MessageBundle<K extends string = string> {
	readonly namespace: string;
	readonly messages: { readonly en: MessageDict<K> } & Readonly<Record<string, Partial<MessageDict<K>>>>;
}

/** Creates a dictionary (only fits the types). Key names come from the `en` dictionary. */
export function defineMessages<const K extends string>(
	namespace: string,
	messages: { readonly en: MessageDict<K> } & Readonly<Record<string, Partial<MessageDict<K>>>>,
): MessageBundle<K> {
	return { namespace, messages };
}

/** Fills `{name}` placeholders. Unknown names are left as they are. */
export const fillVars = (text: string, vars: MessageVars = {}): string =>
	text.replace(/\{(\w+)\}/g, (whole, name: string) => (name in vars ? String(vars[name]) : whole));

/** Whether the last character of the word has a final consonant (batchim). Non-Hangul counts as having none. */
/** Digits read in Korean, by how their reading ends: 영, 일, 삼, 육, 칠, 팔 in a consonant, of which 일, 칠, 팔 in ㄹ. */
const DIGIT_ENDS: Readonly<Record<string, "none" | "final" | "rieul">> = {
	"0": "final",
	"1": "rieul",
	"2": "none",
	"3": "final",
	"4": "none",
	"5": "none",
	"6": "final",
	"7": "rieul",
	"8": "rieul",
	"9": "none",
};

/**
 * How the word, read in Korean, ends: in a vowel, in a consonant, or in ㄹ (which takes 로, not 으로). A Latin word is judged by how it ends
 * said aloud: l, r and "le" ("Google") end in ㄹ; m, n and "ng" ("octo-kim", "Notion") in another consonant; a vowel or most other letters
 * ("GitHub") in none. A digit is read as its Korean number.
 */
function ending(word: string): "none" | "final" | "rieul" {
	const trimmed = word.trim();
	const last = trimmed.slice(-1);
	const code = trimmed.charCodeAt(trimmed.length - 1) - 0xac00;
	if (code >= 0 && code <= 11171) return code % 28 === 0 ? "none" : code % 28 === 8 ? "rieul" : "final";
	if (last in DIGIT_ENDS) return DIGIT_ENDS[last] ?? "none";
	const latin = trimmed.toLowerCase().match(/[a-z]+$/)?.[0] ?? "";
	return /(?:[lr]|le)$/.test(latin) ? "rieul" : /(?:[mn]|ng)$/.test(latin) ? "final" : "none";
}

/**
 * Attaches a Korean particle that fits the word: for a word ending in a consonant it picks the first particle, otherwise the second; "으로"
 * after ㄹ is "로". Used by function messages in the Korean dictionaries (`@monti-cms/core/site`); not exported from the main entry.
 */
export const josa = (word: string, withFinal: string, withoutFinal: string): string => {
	const end = ending(word);
	const final = end === "final" || (end === "rieul" && withFinal !== "으로");
	return `${word}${final ? withFinal : withoutFinal}`;
};

/** Picks a message from the dictionary: site override -> that locale -> English -> key. */
export function translate<K extends string>(
	bundle: MessageBundle<K>,
	language: string,
	key: K,
	vars?: MessageVars,
	overrides?: Readonly<Record<string, Readonly<Record<string, MessageValue>>>>,
): string {
	const value =
		overrides?.[bundle.namespace]?.[key] ?? bundle.messages[language]?.[key] ?? bundle.messages.en[key] ?? key;
	return typeof value === "function" ? value(vars ?? {}) : fillVars(value, vars);
}
