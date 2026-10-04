/**
 * Effect model of the editor code block.
 *
 * - Text effects (bold, italic, strikethrough, underline, tooltip, text folding) are ProseMirror marks on the code text. When edited, marks follow the text.
 * - Line effects (effects in the definition list plus line folding and the body-link label) are line ranges in the node attribute `lineEffects`. Definitions are in `line-effects.ts`.
 * - Regex rules (`{re:/.../}`) are the node attribute `rules`. Stored as the rule itself, not as the found positions.
 *
 * The storage format is the code fence comment syntax (this folder), and the editor conversion is `editor/converters/code-block.ts` in the admin package.
 * This file does not read the site config. The site's line effect list is in `active.ts`.
 */

import { createActiveTranslator } from "../../i18n/active";
import { codeBlockMessages } from "./messages";

const t = createActiveTranslator(codeBlockMessages);

/** Text effects: comment name ↔ editor mark. */
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

/** Marks allowed inside a code block. */
export const CODE_BLOCK_MARKS = CODE_CHAR_EFFECTS.map((effect) => effect.mark).join(" ");

export const charEffectByName = (name: string) => CODE_CHAR_EFFECTS.find((effect) => effect.name === name);
export const charEffectByMark = (mark: string) => CODE_CHAR_EFFECTS.find((effect) => effect.mark === mark);

/** Line effect names. The names in the definition list (`CODE_LINE_EFFECTS`, toggled one line at a time), plus `collapse` and `anchor`. */
export type CodeLineEffectName = string;

export const COLLAPSE = "collapse";
/** Line label that the body's `:code-ref` points to (`attrs.id`). Moves along with the text, like line effects. */
export const ANCHOR = "anchor";

/** One line effect. `start`~`end` are line numbers (0-based, `end` exclusive). */
export interface CodeLineEffect {
	id: string;
	name: CodeLineEffectName;
	start: number;
	end: number;
	/** Carries known attributes (`open`) and unknown attributes through unchanged. */
	attrs: Record<string, unknown>;
}

/** One regex rule. `char` finds only on line `line`; `document` finds across the whole code. */
export interface CodeRule {
	id: string;
	scope: "char" | "document";
	name: CodeCharEffectName;
	pattern: string;
	flags: string;
	line?: number;
	attrs: Record<string, unknown>;
}

/** Range of a text effect over the code text (marks converted to comment names). */
export interface CodeSpan {
	name: CodeCharEffectName;
	from: number;
	to: number;
	attrs: Record<string, unknown>;
}

let idSeed = 0;
export const newEffectId = () => `e${Date.now().toString(36)}${(idSeed++).toString(36)}`;

/** Start offset of each line. There is no line after the last element. */
export function lineStarts(text: string): number[] {
	const starts = [0];
	for (let index = text.indexOf("\n"); index !== -1; index = text.indexOf("\n", index + 1)) starts.push(index + 1);
	return starts;
}

/** Line number containing `offset`. */
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

/** [start, end) of line `line` — end is before the line break. */
export function lineRange(text: string, starts: readonly number[], line: number): { from: number; to: number } {
	const from = starts[line] ?? text.length;
	const next = starts[line + 1];
	return { from, to: next === undefined ? text.length : next - 1 };
}

const MAX_RULE_MATCHES = 500;

/** Whether the regex is valid. Returns the reason if not. */
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

/** The range a rule found (positions in code text). Found the same way as the public view (empty matches are skipped). */
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

/** A regex that matches the selected text literally. */
export const escapePattern = (text: string) => text.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");

/**
 * Turns one line effect (`name`) on or off for lines `start`~`end`. Ranges of the same effect merge, and turning off cuts them out.
 * Line folding is handled by `addCollapse`.
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

/** Whether every line has this effect. */
export function hasLineEffect(effects: readonly CodeLineEffect[], name: string, start: number, end: number): boolean {
	for (let line = start; line < end; line += 1)
		if (!effects.some((effect) => effect.name === name && effect.start <= line && line < effect.end)) return false;
	return end > start;
}

/**
 * Whether a line fold can be added. Folds must not overlap each other (one must be fully inside the other, or they must be separate).
 * This is because the public view wraps folds in `<details>`.
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

/** Clips ranges to stay within the code after the line count changes. Drops empty ranges. */
export function clampLineEffects(effects: readonly CodeLineEffect[], lineCount: number): CodeLineEffect[] {
	return effects
		.map((effect) => ({ ...effect, start: Math.max(0, effect.start), end: Math.min(lineCount, effect.end) }))
		.filter((effect) => effect.end > effect.start);
}

/** Model content that determines the saved result (excluding IDs). Used to save the source as is if nothing changed after loading. */
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
		// Line effects are equal if they are the same effect regardless of order (toggling in the menu on and off may change only the order).
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

/** Falsy and empty-valued attributes are not stored (comment syntax), so they are excluded from comparison too. */
const normalizeAttrs = (attrs: Record<string, unknown>) =>
	Object.entries(attrs)
		.filter(([, value]) => value !== false && value !== null && value !== undefined)
		.sort(([a], [b]) => a.localeCompare(b));
