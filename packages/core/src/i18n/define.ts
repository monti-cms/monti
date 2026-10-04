/**
 * 화면 문구 사전(M15). 본체·관리자·확장이 문구를 이름(키)으로 쓰고, 언어마다 사전을 둔다. 사이트 설정(`cms.config.ts`)을
 * 읽지 않아 설정 파일·저작 API에서도 쓸 수 있다(언어 고르기는 `./index`가 한다).
 *
 * - 값은 글자이거나 `{이름}` 자리를 채우는 함수다. 한국어 조사처럼 낱말에 따라 바뀌는 말은 함수로 쓴다(`josa`).
 * - 영어(`en`)는 모든 키를 가진다. 다른 언어에 없는 키는 영어로 보인다.
 */

export type MessageVars = Readonly<Record<string, string | number>>;
export type MessageValue = string | ((vars: MessageVars) => string);
export type MessageDict<K extends string = string> = Readonly<Record<K, MessageValue>>;

/** 한 묶음(이름공간)의 언어별 사전. `en`은 모든 키를 가진다. */
export interface MessageBundle<K extends string = string> {
	readonly namespace: string;
	readonly messages: { readonly en: MessageDict<K> } & Readonly<Record<string, Partial<MessageDict<K>>>>;
}

/** 사전을 만든다(타입만 맞춘다). 키 이름은 `en` 사전에서 나온다. */
export function defineMessages<const K extends string>(
	namespace: string,
	messages: { readonly en: MessageDict<K> } & Readonly<Record<string, Partial<MessageDict<K>>>>,
): MessageBundle<K> {
	return { namespace, messages };
}

/** `{이름}` 자리를 채운다. 없는 이름은 그대로 둔다. */
export const fillVars = (text: string, vars: MessageVars = {}): string =>
	text.replace(/\{(\w+)\}/g, (whole, name: string) => (name in vars ? String(vars[name]) : whole));

/** 낱말 끝 글자에 받침이 있는지. 한글이 아니면 받침이 없다고 본다. */
function hasFinalConsonant(word: string): boolean {
	const trimmed = word.trim();
	const code = trimmed.charCodeAt(trimmed.length - 1) - 0xac00;
	return code >= 0 && code <= 11171 && code % 28 !== 0;
}

/** 한국어 조사를 낱말에 맞춰 붙인다. `josa("태그", "을", "를")` → `태그를`. 한국어 사전의 함수 문구가 쓴다. */
export const josa = (word: string, withFinal: string, withoutFinal: string): string =>
	`${word}${hasFinalConsonant(word) ? withFinal : withoutFinal}`;

/** 사전에서 문구를 고른다: 사이트가 덮어쓴 값 → 그 언어 → 영어 → 키. */
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
