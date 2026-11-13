import type { Inline, Mark } from "../body/doc";
import {
	CODE_TEXT_EFFECTS,
	type CodeBlockAttrs,
	type CodeRule,
	type CodeTextEffect,
	codeOf,
	type LineEffect,
	lineStarts,
} from "./shape";

/**
 * A code fence's notation (doc 17, T79). Reading takes Shiki's notation (`// [!code ++]`, `--`, `highlight`/`hl`, `focus`, `error`, `warning`, counts
 * like `:3`, `word:`) and the old Monti comments (`// @line collapse {0-4} open`, `// @char bold {6-9}`, `// @document codeTip {re:/use\w+/g}
 * text="…"`) out of the code into the block. Writing puts the effects Shiki has back as Shiki's notation and the rest as Monti comments, so reading what
 * was written gives the same block.
 */

export type CommentSyntax = { prefix: string; postfix: string };

const LINE_COMMENT: CommentSyntax = { prefix: "//", postfix: "" };

/** Comment syntax per language and its aliases (the old code block's table); a language not listed uses `//`. */
const COMMENT_SYNTAX_GROUPS: { syntax: CommentSyntax; langs: string[] }[] = [
	{
		syntax: { prefix: "#", postfix: "" },
		langs: [
			...["python", "py", "yaml", "yml", "toml", "bash", "sh", "shell", "zsh", "fish", "shellscript"],
			...["dockerfile", "docker", "ruby", "rb", "perl", "r", "makefile", "make", "nginx"],
			...["dotenv", "env", "powershell", "ps1", "graphql", "gql", "ini", "conf"],
			...["elixir", "julia", "nim", "coffee", "tcl"],
		],
	},
	{ syntax: { prefix: "--", postfix: "" }, langs: ["sql", "lua", "haskell", "hs", "elm", "ada"] },
	{
		syntax: { prefix: "<!--", postfix: "-->" },
		langs: ["html", "xml", "svg", "vue", "svelte", "markdown", "md", "handlebars"],
	},
	// MDX 2 does not read HTML comments; its comment is a JS comment in an expression.
	{ syntax: { prefix: "{/*", postfix: "*/}" }, langs: ["mdx"] },
	{ syntax: { prefix: "/*", postfix: "*/" }, langs: ["css", "postcss", "scss", "less"] },
	{ syntax: { prefix: ";", postfix: "" }, langs: ["lisp", "clojure", "clj", "scheme", "elisp", "asm", "nasm"] },
	{ syntax: { prefix: "%", postfix: "" }, langs: ["latex", "tex", "erlang", "matlab"] },
	{ syntax: { prefix: "%%", postfix: "" }, langs: ["mermaid"] },
];

const SYNTAX_BY_LANG = new Map(
	COMMENT_SYNTAX_GROUPS.flatMap(({ syntax, langs }) => langs.map((lang) => [lang, syntax] as const)),
);

export const commentSyntax = (language: string | undefined): CommentSyntax =>
	SYNTAX_BY_LANG.get((language ?? "").trim().toLowerCase()) ?? LINE_COMMENT;

/** The syntaxes a reader accepts: the language's own, then `//`. */
const readSyntaxes = (language: string | undefined) => {
	const own = commentSyntax(language);
	return own === LINE_COMMENT ? [own] : [own, LINE_COMMENT];
};

const escapeRegex = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** The line effects Shiki's notation names, by its word. */
const SHIKI_EFFECTS: Record<string, string> = {
	"++": "plus",
	"--": "minus",
	highlight: "highlight",
	hl: "highlight",
	focus: "focus",
	error: "error",
	warning: "warning",
};
const SHIKI_WORDS: Record<string, string> = {
	plus: "++",
	minus: "--",
	highlight: "highlight",
	focus: "focus",
	error: "error",
	warning: "warning",
};

/** The old code block's names for text effects, read as today's. */
const OLD_NAMES: Record<string, CodeTextEffect> = {
	strong: "bold",
	em: "italic",
	del: "strike",
	u: "underline",
	fold: "codeFold",
	Tooltip: "codeTip",
	tooltip: "codeTip",
};
const textEffectName = (name: string): CodeTextEffect | null =>
	(CODE_TEXT_EFFECTS as readonly string[]).includes(name) ? (name as CodeTextEffect) : (OLD_NAMES[name] ?? null);

/** `open id="c1" text="…"` → `{ open: true, id: "c1", text: "…" }`; the old tooltip's `content` is `text`. */
function readAttrs(source: string): Record<string, string | true> {
	const out: Record<string, string | true> = {};
	for (const match of source.matchAll(/([A-Za-z][\w-]*)(?:=("(?:[^"\\]|\\.)*"))?/g)) {
		const name = match[1] === "content" ? "text" : match[1];
		if (match[2] === undefined) out[name] = true;
		else
			try {
				out[name] = JSON.parse(match[2]);
			} catch {
				out[name] = match[2].slice(1, -1);
			}
	}
	return out;
}

const writeAttrs = (attrs: Record<string, unknown> | undefined) =>
	Object.entries(attrs ?? {})
		.map(([name, value]) =>
			value === true ? name : typeof value === "string" ? `${name}=${JSON.stringify(value)}` : "",
		)
		.filter(Boolean)
		.join(" ");

const comment = (syntax: CommentSyntax, body: string) =>
	[syntax.prefix, body, syntax.postfix].filter(Boolean).join(" ");

/** `title="src/app.ts" showLineNumbers {1,3}` → the file name, line numbers, and the rest as it was. */
export function readMeta(meta: string | null | undefined): Pick<CodeBlockAttrs, "title" | "lineNumbers" | "meta"> {
	let rest = meta ?? "";
	const out: Pick<CodeBlockAttrs, "title" | "lineNumbers" | "meta"> = {};
	rest = rest.replace(/(?:^|\s)title=("(?:[^"\\]|\\.)*"|'[^']*')/, (_whole, value: string) => {
		out.title = value.startsWith('"') ? JSON.parse(value) : value.slice(1, -1);
		return "";
	});
	rest = rest.replace(/(?:^|\s)showLineNumbers(?=\s|$)/, () => {
		out.lineNumbers = true;
		return "";
	});
	if (rest.trim()) out.meta = rest.trim();
	return out;
}

export function writeMeta(attrs: Pick<CodeBlockAttrs, "title" | "lineNumbers" | "meta">): string {
	return [
		attrs.title ? `title=${JSON.stringify(attrs.title)}` : "",
		attrs.lineNumbers ? "showLineNumbers" : "",
		attrs.meta ?? "",
	]
		.filter(Boolean)
		.join(" ");
}

/** A code with text effects over ranges as text pieces with marks. */
export function contentOf(
	code: string,
	effects: { name: string; from: number; to: number; attrs?: Record<string, unknown> }[],
): Inline[] {
	if (code === "") return [];
	const cuts = new Set([0, code.length]);
	for (const effect of effects) {
		cuts.add(Math.max(0, Math.min(code.length, effect.from)));
		cuts.add(Math.max(0, Math.min(code.length, effect.to)));
	}
	const points = [...cuts].sort((a, b) => a - b);
	const out: Inline[] = [];
	for (let i = 0; i + 1 < points.length; i++) {
		const [from, to] = [points[i], points[i + 1]];
		if (to <= from) continue;
		const marks: Mark[] = effects
			.filter((effect) => effect.from <= from && effect.to >= to)
			.map((effect) => ({ type: effect.name, ...(effect.attrs ?? {}) }));
		const text = code.slice(from, to);
		const last = out[out.length - 1];
		if (last?.type === "text" && JSON.stringify(last.marks ?? []) === JSON.stringify(marks)) last.text += text;
		else out.push(marks.length ? { type: "text", text, marks } : { type: "text", text });
	}
	return out;
}

/** A fence's language, meta and text as a code block's attrs and content. */
export function readFence(fence: { lang?: string | null; meta?: string | null; value: string }): {
	attrs: CodeBlockAttrs;
	content: Inline[];
} {
	const language = fence.lang ?? undefined;
	const syntaxes = readSyntaxes(language);
	const monti = syntaxes.map(
		(syntax) =>
			new RegExp(
				`^\\s*${escapeRegex(syntax.prefix)}\\s*@(line|char|document)\\s+(\\S+)\\s+\\{([^}]*)\\}\\s*(.*?)\\s*${syntax.postfix ? escapeRegex(syntax.postfix) : ""}\\s*$`,
			),
	);
	const shiki = syntaxes.map(
		(syntax) =>
			new RegExp(
				`\\s*${escapeRegex(syntax.prefix)}\\s*((?:\\[!code [^\\]]+\\]\\s*)+)${syntax.postfix ? escapeRegex(syntax.postfix) : ""}\\s*$`,
			),
	);
	const kept: string[] = [];
	const lines: LineEffect[] = [];
	const rules: CodeRule[] = [];
	const chars: { line: number; name: string; from: number; to: number; attrs?: Record<string, unknown> }[] = [];
	/** What applies to the next kept line, from comments on lines of their own. */
	let pending: ((line: number) => void)[] = [];
	const keep = (text: string) => {
		const line = kept.length;
		kept.push(text);
		for (const apply of pending) apply(line);
		pending = [];
	};
	const regex = (body: string) => body.match(/^re:\/((?:\\.|[^/])*)\/([a-z]*)$/);
	for (const source of fence.value.split("\n")) {
		const own = monti.map((each) => source.match(each)).find(Boolean);
		if (own) {
			const [, scope, rawName, range, rest] = own;
			const attrs = readAttrs(rest);
			const found = regex(range);
			if (scope === "line" && !found) {
				const [a, b] = range.split("-").map(Number);
				const name = rawName;
				pending.push((line) =>
					lines.push({
						name,
						start: line + a,
						end: line + b + 1,
						...(Object.keys(attrs).length ? { attrs: attrs as LineEffect["attrs"] } : {}),
					}),
				);
				continue;
			}
			const name = textEffectName(rawName);
			if (name && found) {
				const rule: CodeRule = {
					scope: scope === "document" ? "document" : "line",
					name,
					pattern: found[1].replace(/\\\//g, "/"),
					flags: found[2],
					...(Object.keys(attrs).length ? { attrs: attrs as CodeRule["attrs"] } : {}),
				};
				if (rule.scope === "document") rules.push(rule);
				else pending.push((line) => rules.push({ ...rule, line }));
				continue;
			}
			if (name && scope === "char") {
				const [from, to] = range.split("-").map(Number);
				pending.push((line) => chars.push({ line, name, from, to, ...(Object.keys(attrs).length ? { attrs } : {}) }));
				continue;
			}
		}
		const notation = shiki.map((each) => source.match(each)).find(Boolean);
		const words = notation ? [...notation[1].matchAll(/\[!code (word:[^\]:]+|[^\]:\s]+)(?::(\d+))?\]/g)] : [];
		const known = words.every((word) => SHIKI_EFFECTS[word[1]] || word[1].startsWith("word:"));
		if (notation && words.length > 0 && known) {
			const text = source.slice(0, notation.index).replace(/\s+$/, "");
			// A word is for the whole code wherever it stands; a line effect is for this line, or the next when the notation is all the line holds.
			for (const word of words)
				if (word[1].startsWith("word:"))
					rules.push({ scope: "document", name: "bold", pattern: escapeRegex(word[1].slice(5)), flags: "g" });
			const apply = (line: number) => {
				for (const word of words)
					if (!word[1].startsWith("word:"))
						lines.push({ name: SHIKI_EFFECTS[word[1]], start: line, end: line + (word[2] ? Number(word[2]) : 1) });
			};
			// A notation on a line of its own is for the next line, as Shiki reads it; the line is taken out.
			if (text.trim() === "") pending.push(apply);
			else {
				keep(text);
				apply(kept.length - 1);
			}
			continue;
		}
		keep(source);
	}
	const code = kept.join("\n");
	const count = kept.length;
	const starts = lineStarts(code);
	const attrs: CodeBlockAttrs = {
		...(language ? { language } : {}),
		...readMeta(fence.meta),
	};
	const fitted = lines
		.map((effect) => ({ ...effect, end: Math.min(effect.end, count) }))
		.filter((effect) => effect.start < effect.end);
	if (fitted.length) attrs.lines = fitted;
	if (rules.length) attrs.rules = rules;
	const content = contentOf(
		code,
		chars.map(({ line, from, to, ...effect }) => ({
			...effect,
			from: (starts[line] ?? 0) + from,
			to: (starts[line] ?? 0) + to,
		})),
	);
	return { attrs, content };
}

/** A code block as a fence: its language, its meta and its text with the notation in it. */
export function writeFence(block: { attrs?: Record<string, unknown>; content?: Inline[] }): {
	lang: string;
	meta: string;
	value: string;
} {
	const attrs = (block.attrs ?? {}) as CodeBlockAttrs;
	const syntax = commentSyntax(attrs.language);
	const code = codeOf(block.content);
	const lines = code.split("\n");
	const starts = lineStarts(code);
	const effects = attrs.lines ?? [];
	const out: string[] = [];
	for (const rule of attrs.rules ?? [])
		if (rule.scope === "document") out.push(comment(syntax, ruleBody("document", rule)));
	// Text effects as ranges in their lines.
	const marks: { line: number; name: string; from: number; to: number; attrs: Record<string, unknown> }[] = [];
	let at = 0;
	for (const part of block.content ?? []) {
		const length = part.type === "text" ? part.text.length : part.type === "hardBreak" ? 1 : 0;
		if (part.type === "text")
			for (const { type, ...markAttrs } of part.marks ?? []) {
				// Split at line ends: a range is in one line.
				let from = at;
				const to = at + length;
				while (from < to) {
					let line = 0;
					while (line + 1 < starts.length && starts[line + 1] <= from) line++;
					const lineEnd = Math.min(to, starts[line] + lines[line].length);
					if (lineEnd > from) {
						const previous = marks.findLast(
							(each) => each.line === line && each.name === type && each.to === from - starts[line],
						);
						if (previous && JSON.stringify(previous.attrs) === JSON.stringify(markAttrs))
							previous.to = lineEnd - starts[line];
						else
							marks.push({ line, name: type, from: from - starts[line], to: lineEnd - starts[line], attrs: markAttrs });
					}
					from = starts[line + 1] ?? to + 1;
				}
			}
		at += length;
	}
	lines.forEach((text, index) => {
		const indent = text.match(/^[\t ]*/)?.[0] ?? "";
		const here = effects.filter((effect) => effect.start === index);
		// Shiki's notation sits at the end of the line; a line with no words would turn into a notation-only line, which Shiki reads as the next one's.
		const shikiHere = text.trim() === "" ? [] : here.filter((effect) => SHIKI_WORDS[effect.name] && !effect.attrs);
		for (const effect of here.filter((each) => !shikiHere.includes(each)))
			out.push(
				`${indent}${comment(syntax, [`@line ${effect.name} {0-${effect.end - effect.start - 1}}`, writeAttrs(effect.attrs)].filter(Boolean).join(" "))}`,
			);
		for (const rule of attrs.rules ?? [])
			if (rule.scope === "line" && rule.line === index) out.push(`${indent}${comment(syntax, ruleBody("char", rule))}`);
		for (const mark of marks.filter((each) => each.line === index))
			out.push(
				`${indent}${comment(syntax, [`@char ${mark.name} {${mark.from}-${mark.to}}`, writeAttrs(mark.attrs)].filter(Boolean).join(" "))}`,
			);
		const notation = shikiHere
			.map((effect) => {
				const count = effect.end - effect.start;
				return `[!code ${SHIKI_WORDS[effect.name]}${count > 1 ? `:${count}` : ""}]`;
			})
			.join(" ");
		out.push(notation ? `${text} ${comment(syntax, notation)}` : text);
	});
	return { lang: attrs.language ?? "", meta: writeMeta(attrs), value: out.join("\n") };
}

const ruleBody = (scope: "document" | "char", rule: CodeRule) =>
	[
		`@${scope} ${rule.name} {re:/${rule.pattern.replace(/\\.|\//g, (token) => (token === "/" ? "\\/" : token))}/${rule.flags}}`,
		writeAttrs(rule.attrs),
	]
		.filter(Boolean)
		.join(" ");
