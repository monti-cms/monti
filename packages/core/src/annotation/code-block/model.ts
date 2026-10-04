/**
 * 에디터 코드 블록의 효과 모델.
 *
 * - 글자 효과(굵게·기울임·취소선·밑줄·툴팁·글자 접기)는 코드 텍스트의 ProseMirror 마크다. 편집하면 마크가 글자를 따라간다.
 * - 줄 효과(정의 목록의 효과와 줄 접기·본문 연결 이름표)는 노드 속성 `lineEffects`의 줄 범위다. 정의는 `line-effects.ts`.
 * - 정규식 규칙(`{re:/.../}`)은 노드 속성 `rules`다. 찾은 위치가 아니라 규칙 그대로 저장한다.
 *
 * 저장 형식은 코드 펜스 주석 문법(이 폴더)이고, 에디터 변환은 관리자 패키지의 `editor/converters/code-block.ts`다.
 * 이 파일은 사이트 설정을 읽지 않는다. 사이트의 줄 효과 목록은 `active.ts`다.
 */

import { createActiveTranslator } from "../../i18n/active";
import { codeBlockMessages } from "./messages";

const t = createActiveTranslator(codeBlockMessages);

/** 글자 효과: 주석 이름 ↔ 에디터 마크. */
export const CODE_CHAR_EFFECTS = [
	{
		name: "strong",
		mark: "bold",
		get label() {
			return t("charEffect.strong");
		},
	},
	{
		name: "em",
		mark: "italic",
		get label() {
			return t("charEffect.em");
		},
	},
	{
		name: "del",
		mark: "strike",
		get label() {
			return t("charEffect.del");
		},
	},
	{
		name: "u",
		mark: "underline",
		get label() {
			return t("charEffect.u");
		},
	},
	{
		name: "Tooltip",
		mark: "codeTooltip",
		get label() {
			return t("charEffect.Tooltip");
		},
	},
	{
		name: "fold",
		mark: "codeFold",
		get label() {
			return t("charEffect.fold");
		},
	},
] as const;

export type CodeCharEffectName = (typeof CODE_CHAR_EFFECTS)[number]["name"];

/** 코드 블록 안에 둘 수 있는 마크. */
export const CODE_BLOCK_MARKS = CODE_CHAR_EFFECTS.map((effect) => effect.mark).join(" ");

export const charEffectByName = (name: string) => CODE_CHAR_EFFECTS.find((effect) => effect.name === name);
export const charEffectByMark = (mark: string) => CODE_CHAR_EFFECTS.find((effect) => effect.mark === mark);

/** 줄 효과 이름. 정의 목록(`CODE_LINE_EFFECTS`, 한 줄씩 켜고 끈다)의 이름과 `collapse`·`anchor`다. */
export type CodeLineEffectName = string;

export const COLLAPSE = "collapse";
/** 본문 `:code-ref`가 가리키는 줄 이름표(`attrs.id`). 줄 효과처럼 글자를 따라 옮겨진다. */
export const ANCHOR = "anchor";

/** 줄 효과 하나. `start`~`end`는 줄 번호(0부터, `end`는 포함하지 않는다). */
export interface CodeLineEffect {
	id: string;
	name: CodeLineEffectName;
	start: number;
	end: number;
	/** 알려진 속성(`open`)과 알 수 없는 속성을 그대로 들고 다닌다. */
	attrs: Record<string, unknown>;
}

/** 정규식 규칙 하나. `char`는 `line` 번째 줄에서만, `document`는 코드 전체에서 찾는다. */
export interface CodeRule {
	id: string;
	scope: "char" | "document";
	name: CodeCharEffectName;
	pattern: string;
	flags: string;
	line?: number;
	attrs: Record<string, unknown>;
}

/** 코드 텍스트 위의 글자 효과 범위(마크를 주석 이름으로 옮긴 것). */
export interface CodeSpan {
	name: CodeCharEffectName;
	from: number;
	to: number;
	attrs: Record<string, unknown>;
}

let idSeed = 0;
export const newEffectId = () => `e${Date.now().toString(36)}${(idSeed++).toString(36)}`;

/** 줄마다 시작 위치. 마지막 원소 다음 줄은 없다. */
export function lineStarts(text: string): number[] {
	const starts = [0];
	for (let index = text.indexOf("\n"); index !== -1; index = text.indexOf("\n", index + 1)) starts.push(index + 1);
	return starts;
}

/** `offset`이 들어 있는 줄 번호. */
export function lineAt(starts: readonly number[], offset: number): number {
	let low = 0;
	let high = starts.length - 1;
	while (low < high) {
		const mid = (low + high + 1) >> 1;
		if ((starts[mid] ?? 0) <= offset) low = mid;
		else high = mid - 1;
	}
	return low;
}

/** `line` 번째 줄의 [시작, 끝) — 끝은 줄바꿈 앞이다. */
export function lineRange(text: string, starts: readonly number[], line: number): { from: number; to: number } {
	const from = starts[line] ?? text.length;
	const next = starts[line + 1];
	return { from, to: next === undefined ? text.length : next - 1 };
}

const MAX_RULE_MATCHES = 500;

/** 정규식이 올바른지. 틀리면 이유를 돌려준다. */
export function checkPattern(pattern: string, flags: string): string | null {
	if (!pattern) return t("pattern.empty");
	if (/[\n\r]/.test(pattern)) return t("pattern.newline");
	if (!/^[dgimsuvy]*$/.test(flags)) return t("pattern.flags");
	try {
		new RegExp(pattern, flags);
		return null;
	} catch (error) {
		return error instanceof Error ? error.message : t("pattern.invalid");
	}
}

/** 규칙이 찾은 범위(코드 텍스트 기준 위치). 공개 화면과 같게 찾는다(빈 일치는 건너뛴다). */
export function ruleMatches(
	rule: CodeRule,
	text: string,
	starts = lineStarts(text),
): Array<{ from: number; to: number }> {
	if (checkPattern(rule.pattern, rule.flags)) return [];
	let base = 0;
	let target = text;
	if (rule.scope === "char") {
		if (rule.line === undefined || rule.line >= starts.length) return [];
		const range = lineRange(text, starts, rule.line);
		base = range.from;
		target = text.slice(range.from, range.to);
	}
	const flags = rule.flags.includes("g") ? rule.flags : `${rule.flags}g`;
	const matcher = new RegExp(rule.pattern, flags);
	const matches: Array<{ from: number; to: number }> = [];
	for (let match = matcher.exec(target); match && matches.length < MAX_RULE_MATCHES; match = matcher.exec(target)) {
		const length = match[0]?.length ?? 0;
		if (length > 0) matches.push({ from: base + match.index, to: base + match.index + length });
		else matcher.lastIndex += 1;
	}
	return matches;
}

/** 선택한 글자를 그대로 찾는 정규식. */
export const escapePattern = (text: string) => text.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");

/**
 * 한 가지 줄 효과(`name`)를 `start`~`end` 줄에 켜거나 끈다. 같은 효과의 범위는 합치고, 끄면 잘라 낸다.
 * 줄 접기는 `addCollapse`로 다룬다.
 */
export function setLineEffect(
	effects: readonly CodeLineEffect[],
	name: CodeLineEffectName,
	start: number,
	end: number,
	on: boolean,
): CodeLineEffect[] {
	const others = effects.filter((effect) => effect.name !== name);
	const same = effects.filter((effect) => effect.name === name);
	const covered = new Set<number>();
	for (const effect of same) for (let line = effect.start; line < effect.end; line += 1) covered.add(line);
	for (let line = start; line < end; line += 1) {
		if (on) covered.add(line);
		else covered.delete(line);
	}
	const lines = [...covered].sort((a, b) => a - b);
	const ranges: CodeLineEffect[] = [];
	for (const line of lines) {
		const last = ranges[ranges.length - 1];
		if (last && last.end === line) last.end = line + 1;
		else
			ranges.push({
				id: same.find((effect) => effect.start === line)?.id ?? newEffectId(),
				name,
				start: line,
				end: line + 1,
				attrs: {},
			});
	}
	return [...others, ...ranges].sort((a, b) => a.start - b.start || a.end - b.end);
}

/** 모든 줄이 이 효과를 가졌는지. */
export function hasLineEffect(effects: readonly CodeLineEffect[], name: string, start: number, end: number): boolean {
	for (let line = start; line < end; line += 1)
		if (!effects.some((effect) => effect.name === name && effect.start <= line && line < effect.end)) return false;
	return end > start;
}

/**
 * 줄 접기를 더할 수 있는지. 접기끼리는 겹치면 안 된다(완전히 안에 들어가거나 따로 떨어져야 한다).
 * 공개 화면이 접기를 `<details>`로 감싸기 때문이다.
 */
export function canAddCollapse(effects: readonly CodeLineEffect[], start: number, end: number): string | null {
	if (end - start < 2) return t("fold.minLines");
	for (const effect of effects) {
		if (effect.name !== COLLAPSE) continue;
		if (effect.start === start && effect.end === end) return t("fold.exists");
		const disjoint = effect.end <= start || end <= effect.start;
		const inside = start >= effect.start && end <= effect.end;
		const outside = effect.start >= start && effect.end <= end;
		if (!disjoint && !inside && !outside) return t("fold.overlaps");
	}
	return null;
}

/** 줄 수가 바뀐 뒤에도 범위가 코드 안에 있게 자른다. 빈 범위는 뺀다. */
export function clampLineEffects(effects: readonly CodeLineEffect[], lineCount: number): CodeLineEffect[] {
	return effects
		.map((effect) => ({ ...effect, start: Math.max(0, effect.start), end: Math.min(lineCount, effect.end) }))
		.filter((effect) => effect.end > effect.start);
}

/** 저장 결과를 좌우하는 모델 내용(아이디 제외). 불러온 뒤 바뀌지 않았으면 원문을 그대로 저장하는 데 쓴다. */
export function modelFingerprint(model: {
	language: string | null;
	text: string;
	spans: readonly CodeSpan[];
	lineEffects: readonly CodeLineEffect[];
	rules: readonly CodeRule[];
}): string {
	return JSON.stringify([
		model.language ?? "",
		model.text,
		[...model.spans]
			.sort((a, b) => a.from - b.from || a.to - b.to || a.name.localeCompare(b.name))
			.map((span) => [span.name, span.from, span.to, normalizeAttrs(span.attrs)]),
		// 줄 효과는 순서와 상관없이 같은 효과면 같다(메뉴에서 켰다 끄면 순서만 바뀔 수 있다).
		model.lineEffects
			.map((effect) => [effect.name, effect.start, effect.end, normalizeAttrs(effect.attrs)] as const)
			.sort((a, b) => a[1] - b[1] || a[2] - b[2] || a[0].localeCompare(b[0])),
		model.rules.map((rule) => [
			rule.scope,
			rule.name,
			rule.pattern,
			rule.flags,
			rule.line ?? null,
			normalizeAttrs(rule.attrs),
		]),
	]);
}

/** 거짓·빈 값 속성은 저장하지 않으므로(주석 문법) 비교에서도 뺀다. */
const normalizeAttrs = (attrs: Record<string, unknown>) =>
	Object.entries(attrs)
		.filter(([, value]) => value !== false && value !== null && value !== undefined)
		.sort(([a], [b]) => a.localeCompare(b));
