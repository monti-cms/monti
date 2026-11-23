import { MontiError } from "./errors";

/** 설정 파일 글자에서 자른 조각 하나와 그 시작 위치. */
interface Token {
	text: string;
	index: number;
}

/** 주석, 문자열(이스케이프 포함), 이름, 그 밖의 기호 한 글자를 하나씩 자른다. */
const TOKEN = /\/\/[^\n]*|\/\*[\s\S]*?\*\/|"(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'|`(?:[^`\\]|\\.)*`|[\w$]+|\S/g;

/** 주석을 뺀 조각들. */
function tokensOf(text: string): Token[] {
	return [...text.matchAll(TOKEN)]
		.filter(([token]) => !token.startsWith("//") && !token.startsWith("/*"))
		.map((match) => ({ text: match[0], index: match.index }));
}

/** 괄호가 여는지(1), 닫는지(-1). */
const NESTING: Record<string, number> = { "{": 1, "[": 1, "(": 1, "}": -1, "]": -1, ")": -1 };

/** `export default` 뒤 첫 객체 리터럴을 여는 `{`의 위치(`defineConfig({ … })`처럼 감싸도 된다). 없으면 -1. */
function objectStart(tokens: Token[]): number {
	const exported = tokens.findIndex((token, i) => token.text === "export" && tokens[i + 1]?.text === "default");
	return exported < 0 ? -1 : tokens.findIndex((token, i) => i > exported && token.text === "{");
}

/** `i`의 조각이 객체 속성 `name:`의 키인지. */
function isNameKey(tokens: Token[], i: number): boolean {
	const key = tokens[i]?.text === "name";
	return key && tokens[i + 1]?.text === ":" && ["{", ","].includes(tokens[i - 1]?.text ?? "");
}

/** `i`의 조각이 큰따옴표·작은따옴표 문자열 하나로 끝나는 값이면 그 조각. */
function literalAt(tokens: Token[], i: number): Token | undefined {
	const value = tokens[i];
	const literal = value !== undefined && /^["']/.test(value.text);
	return literal && [",", "}"].includes(tokens[i + 1]?.text ?? "") ? value : undefined;
}

/** 기본 내보내기 객체의 최상위(깊이 1)에 있는 조각들의 위치. 객체가 없으면 빈 배열. */
function topLevelIndexes(tokens: Token[]): number[] {
	const start = objectStart(tokens);
	if (start < 0) return [];
	const found: number[] = [];
	let depth = 0;
	for (let i = start; i < tokens.length; i++) {
		depth += NESTING[tokens[i]?.text ?? ""] ?? 0;
		if (depth === 0) break;
		if (depth === 1) found.push(i);
	}
	return found;
}

/** 기본 내보내기 객체의 최상위 `name` 값 조각. 플러그인 객체처럼 안쪽에 있는 `name`은 건너뛴다. */
function siteNameValue(tokens: Token[]): Token | undefined {
	const key = topLevelIndexes(tokens).find((i) => isNameKey(tokens, i));
	return key === undefined ? undefined : literalAt(tokens, key + 2);
}

/**
 * 기본 내보내기 객체의 최상위에 펼침(`...`)이 있는지. 펼친 객체가 `name`을 덮어쓸 수 있어 글자만 바꿔서는 실행될 때의
 * 사이트 이름을 정할 수 없다. `...`는 `.` 세 조각이고, 최상위에서 `{`나 `,` 바로 뒤에 오는 `.`은 펼침뿐이다.
 */
function hasTopLevelSpread(tokens: Token[]): boolean {
	return topLevelIndexes(tokens).some((i) => tokens[i]?.text === "." && ["{", ","].includes(tokens[i - 1]?.text ?? ""));
}

/**
 * `monti.config.ts`의 글자에서 사이트 이름 자리만 `name`으로 바꾼 글자. 사이트 이름이 문자열 리터럴로 적혀 있지 않거나
 * 기본 내보내기 객체의 최상위에 펼침(`...`)이 있으면 바꿀 자리를 알 수 없으므로 `BAD_REQUEST`로 거절한다.
 */
export function configWithName(text: string, name: string): string {
	const tokens = tokensOf(text);
	if (hasTopLevelSpread(tokens)) {
		throw new MontiError("BAD_REQUEST", "설정 파일의 기본 내보내기 객체에 펼침(...)이 있어 사이트 이름을 바꿀 수 없다");
	}
	const value = siteNameValue(tokens);
	if (value === undefined) {
		throw new MontiError("BAD_REQUEST", "설정 파일에서 글자 그대로 적힌 사이트 이름을 찾을 수 없다");
	}
	return text.slice(0, value.index) + JSON.stringify(name) + text.slice(value.index + value.text.length);
}
