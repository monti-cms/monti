import type { Block } from "../body/doc";
import { coreMessages, formatMessage } from "../messages";
import type { CodeColors, CodeToken } from "./highlight";
import {
	ANCHOR,
	COLLAPSE,
	type CodeRule,
	codeOf,
	effectsOf,
	type LineEffect,
	lineStarts,
	ruleRanges,
	rulesOf,
} from "./shape";

type H<Node> = (type: unknown, props: Record<string, unknown> | null, ...children: unknown[]) => Node;

/** The words of the copy button, in the entry's language (doc 17): Korean for a Korean entry, English otherwise. */
const copyWords = (locale: string | undefined) => {
	const language = locale?.startsWith("ko") ? "ko" : "en";
	return [
		formatMessage([coreMessages], language, { key: "code.copy" }),
		formatMessage([coreMessages], language, { key: "code.copied" }),
	];
};

/** The element id of a code link's lines: `code-<block>-<label>`. */
export const codeLineId = (block: string, anchor: string) => `code-${block}-${anchor}`;

type Effect = { name: string; attrs: Record<string, unknown>; from: number; to: number; order: number };

/** The text effects of a code block over the whole code: its marks, then what its rules find (a rule's effect wraps outside a mark's). */
function textEffects(block: Block, code: string): Effect[] {
	const effects: Effect[] = [];
	let at = 0;
	let order = 0;
	for (const part of block.content ?? []) {
		const length = part.type === "text" ? part.text.length : part.type === "hardBreak" ? 1 : 0;
		if (part.type === "text")
			for (const { type, ...attrs } of part.marks ?? []) {
				// Two pieces side by side with the same mark are one span of it.
				const last = effects.findLast((each) => each.name === type && each.to === at);
				if (last && JSON.stringify(last.attrs) === JSON.stringify(attrs)) last.to = at + length;
				else effects.push({ name: type, attrs, from: at, to: at + length, order: order++ });
			}
		at += length;
	}
	rulesOf(block).forEach((rule: CodeRule) => {
		for (const range of ruleRanges(rule, code))
			effects.push({ name: rule.name, attrs: rule.attrs ?? {}, ...range, order: -1 });
	});
	return effects;
}

const STYLE_TAGS: Record<string, string> = { bold: "strong", italic: "em", strike: "s", underline: "u" };

/**
 * A code block as the site draws it (doc 17): a figure with the file name, the copy button and the code, each line a `span.line` with its number
 * and its effects (`data-effect`, the site's classes), each piece in its two theme colours (`--shiki-light`, `--shiki-dark`). Folds are `details`,
 * folded words open on a press, tooltips show on pointing or focus and as a numbered list where there is no pointer (`render.css`). The pressing
 * (copy, code links) is `CodeTools` of `@monti-cms/next`.
 */
export function drawCodeBlock<Node>(
	h: H<Node>,
	block: Block,
	options: { colors?: CodeColors; locale?: string; lineClasses?: Readonly<Record<string, string>> },
): Node {
	const attrs = block.attrs ?? {};
	const language = typeof attrs.language === "string" ? attrs.language : undefined;
	const code = codeOf(block.content);
	const starts = lineStarts(code);
	const lines = options.colors ? options.colors.lines(code, language) : code.split("\n").map((text) => [{ text }]);
	const effects = effectsOf(block);
	const text = textEffects(block, code);
	const notes: { text: string; number: number }[] = [];
	const [copy, copied] = copyWords(options.locale);

	const lineNode = (index: number): Node => {
		const tokens: CodeToken[] = lines[index] ?? [];
		const base = starts[index] ?? 0;
		const end = base + tokens.reduce((sum, token) => sum + token.text.length, 0);
		// Cut the line where a colour or a text effect starts or ends.
		const cuts = new Set<number>([base, end]);
		let at = base;
		for (const token of tokens) {
			cuts.add(at);
			at += token.text.length;
		}
		const here = text.filter((effect) => effect.from < end && effect.to > base);
		for (const effect of here) {
			cuts.add(Math.max(base, effect.from));
			cuts.add(Math.min(end, effect.to));
		}
		const points = [...cuts].sort((a, b) => a - b);
		const colorAt = (offset: number) => {
			let from = base;
			for (const token of tokens) {
				if (offset < from + token.text.length) return token;
				from += token.text.length;
			}
			return undefined;
		};
		type Piece = { text: string; token?: CodeToken; on: Effect[] };
		const pieces: Piece[] = [];
		for (let i = 0; i + 1 < points.length; i++) {
			const from = points[i];
			const to = points[i + 1];
			if (to <= from) continue;
			pieces.push({
				text: code.slice(from, to),
				token: colorAt(from),
				on: here.filter((effect) => effect.from <= from && effect.to >= to),
			});
		}
		const colored = (piece: Piece, key: number) => {
			const style =
				piece.token?.light || piece.token?.dark
					? { "--shiki-light": piece.token.light, "--shiki-dark": piece.token.dark }
					: undefined;
			let node: unknown = style ? h("span", { key, style }, piece.text) : piece.text;
			for (const effect of piece.on) {
				const tag = STYLE_TAGS[effect.name];
				if (tag) node = h(tag, { key }, node);
			}
			return node;
		};
		// Folds and tooltips wrap runs of pieces: one element for the words they cover, a tooltip inside a fold.
		const group = (list: Piece[], kind: "codeFold" | "codeTip", offset: number): unknown[] => {
			const out: unknown[] = [];
			let i = 0;
			while (i < list.length) {
				const outer = list[i].on.find((effect) => effect.name === kind);
				if (!outer) {
					const start = i;
					while (i < list.length && !list[i].on.some((effect) => effect.name === kind)) i++;
					const rest = list.slice(start, i);
					out.push(
						...(kind === "codeFold"
							? group(rest, "codeTip", offset + start)
							: rest.map((piece, at) => colored(piece, offset + start + at))),
					);
					continue;
				}
				const start = i;
				while (i < list.length && list[i].on.includes(outer)) i++;
				const run = list.slice(start, i);
				if (kind === "codeFold")
					out.push(
						h(
							"span",
							{ key: `f${offset + start}`, "data-code-fold": "", "data-open": outer.attrs.open ? "" : undefined },
							h("button", { type: "button", "data-code-ui": "", "aria-label": "…" }, "…"),
							h("span", { "data-code-folded": "" }, ...group(run, "codeTip", offset + start)),
						),
					);
				else {
					const note = { text: String(outer.attrs.text ?? ""), number: notes.length + 1 };
					notes.push(note);
					out.push(
						h(
							"span",
							{ key: `t${offset + start}`, "data-code-tip": note.text, "data-note": note.number, tabIndex: 0 },
							...run.map((piece, at) => colored(piece, offset + start + at)),
						),
					);
				}
			}
			return out;
		};
		const out = group(pieces, "codeFold", 0);
		const on = effects.filter((effect) => effect.name !== COLLAPSE && effect.start <= index && index < effect.end);
		const names = on.filter((effect) => effect.name !== ANCHOR).map((effect) => effect.name);
		const labels = on.filter((effect) => effect.name === ANCHOR).map((effect) => String(effect.attrs?.id));
		const first = on.find((effect) => effect.name === ANCHOR && effect.start === index);
		const classes = names.map((name) => options.lineClasses?.[name]).filter(Boolean);
		return h(
			"span",
			{
				key: index,
				className: ["line", ...classes].join(" "),
				"data-line": index + 1,
				"data-effect": names.length ? names.join(" ") : undefined,
				"data-anchor": labels.length ? labels.join(" ") : undefined,
				id: first ? codeLineId(block.id, String(first.attrs?.id)) : undefined,
			},
			...out,
		);
	};

	// Lines with a newline after each but the last, so the code copies as it is; folds over lines are `details` whose summary is their first line.
	const folds = effects.filter((effect) => effect.name === COLLAPSE).sort((a, b) => a.start - b.start || b.end - a.end);
	const range = (from: number, to: number): unknown[] => {
		const out: unknown[] = [];
		let line = from;
		while (line < to) {
			const fold: LineEffect | undefined = folds.find(
				(each) => each.start === line && each.end <= to && each.end - each.start > 1,
			);
			// The inner range starts after the fold's first line, so a fold over the whole range is drawn too (the whole code, or an outer fold's rest).
			if (fold) {
				out.push(
					h(
						"details",
						{ key: `c${line}`, "data-code-collapse": "", open: fold.attrs?.open ? true : undefined },
						// No newline after the summary or after the fold: each is a block, which ends its line by itself; one more would draw an
						// empty line in the code (a selection still copies one, at the block's edge).
						h("summary", null, lineNode(line)),
						...range(line + 1, fold.end),
					),
				);
				line = fold.end;
				continue;
			}
			out.push(lineNode(line));
			if (line + 1 < to) out.push("\n");
			line++;
		}
		return out;
	};
	const children: unknown[] = [];
	if (typeof attrs.title === "string" && attrs.title) children.push(h("figcaption", { key: "title" }, attrs.title));
	children.push(
		h("button", { key: "copy", type: "button", "data-code-copy": "", "data-copied": copied }, copy),
		h(
			"pre",
			{
				key: "pre",
				"data-language": language,
				"data-line-numbers": attrs.lineNumbers ? "" : undefined,
			},
			h("code", null, ...range(0, starts.length)),
		),
	);
	if (notes.length)
		children.push(
			h(
				"ol",
				{ key: "notes", "data-code-notes": "" },
				...notes.map((note) => h("li", { key: note.number, "data-note": note.number }, note.text)),
			),
		);
	return h("figure", { key: block.id, "data-code": "", "data-block": block.id }, ...children);
}
