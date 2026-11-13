import { z } from "zod";
import type { Block, Inline } from "../body/doc";

/**
 * A code block's stored shape (doc 17). The code is the block's text (`content`), lines split by `\n`; text effects inside it are marks. The rest is in
 * `attrs`: the language, the file name, whether the site shows line numbers, line effects over ranges of lines and regex rules.
 */

/** A line effect over lines `start` to `end - 1`, counted from 0 (the old code block's shape, `main`'s #50). */
export type LineEffect = { name: string; start: number; end: number; attrs?: { open?: true; id?: string } };

/** The effects a code block's text can carry (doc 17): bold, italic, strike, underline, a fold and a tooltip. */
export const CODE_TEXT_EFFECTS = ["bold", "italic", "strike", "underline", "codeFold", "codeTip"] as const;
export type CodeTextEffect = (typeof CODE_TEXT_EFFECTS)[number];

/** A rule finds text by a regular expression and gives it a text effect, in the whole code or one line; the code may change, the rule finds again. */
export type CodeRule = {
	scope: "document" | "line";
	line?: number;
	name: CodeTextEffect;
	pattern: string;
	flags: string;
	attrs?: { open?: true; text?: string };
};

/** A fold over lines: they collapse into their first line on the site. `open` starts it unfolded. */
export const COLLAPSE = "collapse";
/** A label on lines that a code link in the text names (`codeRef { block, anchor }`). */
export const ANCHOR = "anchor";

const LineEffectShape = z.object({
	name: z.string().regex(/^[a-z][a-z0-9-]*$/),
	start: z.number().int().min(0),
	end: z.number().int().min(1),
	attrs: z
		.object({ open: z.literal(true).optional(), id: z.string().min(1).optional() })
		.strict()
		.optional(),
});

const RuleShape = z.object({
	scope: z.enum(["document", "line"]),
	line: z.number().int().min(0).optional(),
	name: z.enum(CODE_TEXT_EFFECTS),
	pattern: z.string().min(1),
	flags: z.string().regex(/^[dgimsuy]*$/),
	attrs: z
		.object({ open: z.literal(true).optional(), text: z.string().optional() })
		.strict()
		.optional(),
});

export const CodeBlockAttrsShape = z.object({
	language: z.string().optional(),
	title: z.string().optional(),
	lineNumbers: z.literal(true).optional(),
	/** What an imported fence line held that Monti does not read (`{1,3} showLineNumbers=false`): kept and written back as it was. */
	meta: z.string().optional(),
	lines: z.array(LineEffectShape).optional(),
	rules: z.array(RuleShape).optional(),
});

export type CodeBlockAttrs = z.infer<typeof CodeBlockAttrsShape>;

/** The code of a block as one string. */
export const codeOf = (content: readonly Inline[] = []) =>
	content.map((part) => (part.type === "text" ? part.text : part.type === "hardBreak" ? "\n" : "")).join("");

export const lineCount = (code: string) => code.split("\n").length;

/** Where each line starts in the code. */
export const lineStarts = (code: string) => {
	const starts = [0];
	for (let at = code.indexOf("\n"); at !== -1; at = code.indexOf("\n", at + 1)) starts.push(at + 1);
	return starts;
};

export const effectsOf = (block: Pick<Block, "attrs">) => (block.attrs?.lines ?? []) as LineEffect[];
export const rulesOf = (block: Pick<Block, "attrs">) => (block.attrs?.rules ?? []) as CodeRule[];

/** The regex a rule finds with, always global; `null` when it does not read. */
export function ruleRegex(rule: Pick<CodeRule, "pattern" | "flags">): RegExp | null {
	try {
		const regex = new RegExp(rule.pattern, rule.flags.includes("g") ? rule.flags : `${rule.flags}g`);
		// A pattern that finds the empty string would find it everywhere and never move on.
		return regex.test("") ? null : regex;
	} catch {
		return null;
	}
}

/** The places in the code a rule finds: offsets in the whole code. A line rule looks in its line only. */
export function ruleRanges(rule: CodeRule, code: string): { from: number; to: number }[] {
	const regex = ruleRegex(rule);
	if (!regex) return [];
	const starts = lineStarts(code);
	const base = rule.scope === "line" ? (starts[rule.line ?? 0] ?? -1) : 0;
	if (base < 0) return [];
	const text = rule.scope === "line" ? code.slice(base, (starts[(rule.line ?? 0) + 1] ?? code.length + 1) - 1) : code;
	return [...text.matchAll(regex)].map((match) => ({
		from: base + (match.index ?? 0),
		to: base + (match.index ?? 0) + match[0].length,
	}));
}

/**
 * What a code block may not hold, beyond its attrs' shape: a range outside the code, two folds that cross, a label used twice, a rule that does not
 * read or names a line the code does not have, a mark that is not a text effect. The save names the first (`body.badCode`).
 */
export function codeProblems(block: Block): string | null {
	const code = codeOf(block.content);
	const count = lineCount(code);
	const effects = effectsOf(block);
	for (const effect of effects) {
		if (effect.end <= effect.start || effect.end > count) return `${effect.name} ${effect.start}-${effect.end}`;
		if (effect.name === ANCHOR && !effect.attrs?.id) return `${ANCHOR} ${effect.start}-${effect.end}`;
	}
	const folds = effects.filter((effect) => effect.name === COLLAPSE);
	for (const a of folds)
		for (const b of folds)
			if (a !== b && a.start < b.start && b.start < a.end && a.end < b.end) return `${COLLAPSE} ${b.start}-${b.end}`;
	const labels = effects.filter((effect) => effect.name === ANCHOR).map((effect) => effect.attrs?.id);
	if (new Set(labels).size !== labels.length) return ANCHOR;
	for (const rule of rulesOf(block)) {
		if (!ruleRegex(rule)) return `/${rule.pattern}/${rule.flags}`;
		if (rule.scope === "line" && (rule.line === undefined || rule.line >= count)) return `/${rule.pattern}/`;
	}
	for (const part of block.content ?? [])
		for (const mark of part.type === "text" ? (part.marks ?? []) : [])
			if (!(CODE_TEXT_EFFECTS as readonly string[]).includes(mark.type)) return mark.type;
	return null;
}

/**
 * Line effects after the code changed from `before` by putting `inserted` in place of `from`–`to` (doc 17, 17-2). A line keeps its effects as it moves;
 * an effect loses the lines taken out of it and spans the lines put in inside it; an effect whose lines are all gone is dropped. The editor and
 * `replaceText` both use it.
 */
export function moveLineEffects(
	effects: readonly LineEffect[],
	before: string,
	from: number,
	to: number,
	inserted: string,
): LineEffect[] {
	if (effects.length === 0) return [];
	const starts = lineStarts(before);
	const lineAt = (offset: number) => {
		let line = 0;
		while (line + 1 < starts.length && starts[line + 1] <= offset) line++;
		return line;
	};
	const first = lineAt(from);
	const last = lineAt(to);
	const added = (inserted.match(/\n/g) ?? []).length;
	const atLineStart = from === starts[first];
	/** Where an old line is now, or `null` when it was taken out. */
	const moved = (line: number): number | null => {
		if (line < first) return line;
		if (line === first) {
			// Lines put in at the very start of a line push it down; otherwise its beginning stays where it was.
			if (last === first) return atLineStart && added > 0 ? first + added : first;
			return atLineStart ? null : first;
		}
		if (line < last) return null;
		if (line === last) return first + added;
		return line + added - (last - first);
	};
	const out: LineEffect[] = [];
	for (const effect of effects) {
		const now: number[] = [];
		for (let line = effect.start; line < effect.end; line++) {
			const at = moved(line);
			if (at !== null) now.push(at);
		}
		if (now.length === 0) continue;
		out.push({ ...effect, start: Math.min(...now), end: Math.max(...now) + 1 });
	}
	// Two folds that met at a line can cross once the line between them goes (a joined line): the later one goes, so the body still saves.
	const folds: LineEffect[] = [];
	return out.filter((effect) => {
		if (effect.name !== COLLAPSE) return true;
		const clash = folds.some(
			(fold) =>
				fold.start === effect.start ||
				(fold.start < effect.start && effect.start < fold.end && fold.end < effect.end) ||
				(effect.start < fold.start && fold.start < effect.end && effect.end < fold.end),
		);
		if (!clash) folds.push(effect);
		return !clash;
	});
}

/** Line rules after the code changed as `moveLineEffects` reads it: a rule keeps its line as it moves, and goes with its line. */
export function moveLineRules(
	rules: readonly CodeRule[],
	before: string,
	from: number,
	to: number,
	inserted: string,
): CodeRule[] {
	const moved = moveLineEffects(
		rules.flatMap((rule, at) =>
			rule.scope === "line" ? [{ name: `rule-${at}`, start: rule.line ?? 0, end: (rule.line ?? 0) + 1 }] : [],
		),
		before,
		from,
		to,
		inserted,
	);
	return rules.flatMap((rule, at) => {
		if (rule.scope !== "line") return [rule];
		const now = moved.find((each) => each.name === `rule-${at}`);
		return now ? [{ ...rule, line: now.start }] : [];
	});
}
