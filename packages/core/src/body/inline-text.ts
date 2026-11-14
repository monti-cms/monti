import { CheckError } from "../errors";
import { sameJson } from "../json";
import type { Inline, Mark } from "./doc";

/**
 * A block's text with its marks as tags, for the model (doc 03, "agent"): what `body.read` shows of a text block and what `setText` takes back.
 * Each mark is a tag named by its type, so a plugin's marks (`defineMark`) are written like the core's: `<bold>`, `<link href="…">`,
 * `<codeRef block="b_1" anchor="setup">`. A mark's attrs are the tag's attributes: a string as `name="…"`, any other value as JSON in braces
 * (`level={2}`). A footnote reference is `<footnoteRef id="…"/>`, a hard break a new line. `&`, `<` and `>` in the words are written `&amp;`,
 * `&lt;` and `&gt;`, and `"` in an attribute `&quot;`.
 */

const FOOTNOTE = "footnoteRef";

const escapeText = (text: string) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const escapeAttr = (text: string) => escapeText(text).replace(/"/g, "&quot;");

/** A tag's name: a mark type, as `defineMark` takes one. */
const TAG = /[A-Za-z][\w-]*/y;
/** An attribute's name: any key but one with a letter that ends or quotes an attribute in it. */
const ATTR = /[^\s=/>"'<{}]+/y;

const attrsOf = (mark: Mark) =>
	Object.entries(mark)
		.filter(([key, value]) => key !== "type" && value !== undefined)
		.map(([key, value]) => {
			// A key the tags cannot read back is not written as one that reads differently.
			if (!new RegExp(`^${ATTR.source}$`).test(key))
				throw new Error(`The ${mark.type} mark's attribute "${key}" cannot be written as a tag's attribute.`);
			return typeof value === "string" ? ` ${key}="${escapeAttr(value)}"` : ` ${key}={${JSON.stringify(value)}}`;
		})
		.join("");

const sameMark = (a: Mark, b: Mark) => sameJson(a, b);
const has = (marks: readonly Mark[], mark: Mark) => marks.some((each) => sameMark(each, mark));

/** A block's inline content as text with tags. Marks that go on past the current run of words are opened first, so they are closed least. */
export function inlineToText(content: readonly Inline[]): string {
	let out = "";
	const open: Mark[] = [];
	const texts = content.filter((inline) => inline.type === "text");
	/** How many runs of words in a row, from the `at`th, carry the mark. */
	const reach = (at: number, mark: Mark) => {
		let count = 0;
		while (at + count < texts.length && has(texts[at + count]?.marks ?? [], mark)) count++;
		return count;
	};
	let textAt = 0;
	for (const inline of content) {
		if (inline.type === "hardBreak") {
			out += "\n";
			continue;
		}
		if (inline.type === "footnoteRef") {
			out += `<${FOOTNOTE} id="${escapeAttr(inline.id)}"/>`;
			continue;
		}
		const marks = inline.marks ?? [];
		// Keep the open marks this run still has, up to the first it has not: those after it are closed and opened again if needed.
		let kept = 0;
		while (kept < open.length && has(marks, open[kept] as Mark)) kept++;
		while (open.length > kept) out += `</${(open.pop() as Mark).type}>`;
		const opening = marks
			.filter((mark, index) => !has(open, mark) && marks.findIndex((each) => sameMark(each, mark)) === index)
			.map((mark) => ({ mark, reach: reach(textAt, mark) }))
			.sort((a, b) => b.reach - a.reach);
		for (const { mark } of opening) {
			out += `<${mark.type}${attrsOf(mark)}>`;
			open.push(mark);
		}
		out += escapeText(inline.text);
		textAt++;
	}
	while (open.length > 0) out += `</${(open.pop() as Mark).type}>`;
	return out;
}

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };

const bad = (reason: string): never => {
	throw new CheckError({ key: "body.badMarkup", values: { reason } });
};

/** Decodes the entities of words or a string attribute. An `&` that starts no entity is the letter itself. */
const decode = (text: string) =>
	text.replace(/&(amp|lt|gt|quot|apos);/g, (_whole, name: string) => ENTITIES[name] as string);

/**
 * Text with tags as a block's inline content: the other way of `inlineToText`. It takes any tags that nest properly; a tag left open, one closed
 * that was not open or closed out of order, or one that does not read, throws `body.badMarkup` with the reason in words the model can act on.
 */
export function textToInline(text: string): Inline[] {
	const out: Inline[] = [];
	const open: Mark[] = [];
	let words = "";
	const flush = () => {
		if (words === "") return;
		const marks = open.filter((mark, index) => open.findIndex((each) => sameMark(each, mark)) === index);
		const last = out.at(-1);
		const decoded = decode(words);
		if (last?.type === "text" && sameJson(last.marks ?? [], marks)) last.text += decoded;
		else
			out.push({ type: "text", text: decoded, ...(marks.length ? { marks: marks.map((mark) => ({ ...mark })) } : {}) });
		words = "";
	};
	const match = (pattern: RegExp, at: number) => {
		pattern.lastIndex = at;
		return pattern.exec(text)?.[0] ?? null;
	};
	const nameAt = (at: number) => match(TAG, at);
	let at = 0;
	while (at < text.length) {
		const char = text[at] as string;
		if (char === "\n") {
			flush();
			out.push({ type: "hardBreak" });
			at++;
			continue;
		}
		const next = text[at + 1] ?? "";
		// A `<` that starts no tag ("a < b") is the letter itself.
		if (char !== "<" || !(next === "/" || /[A-Za-z]/.test(next))) {
			words += char;
			at++;
			continue;
		}
		flush();
		if (next === "/") {
			const name = nameAt(at + 2);
			if (name === null || text[at + 2 + name.length] !== ">") bad(`A closing tag at ${at} does not read.`);
			const top = open.at(-1);
			if (!top) bad(`</${name}> closes a tag that is not open.`);
			if (top?.type !== name) bad(`</${name}> closes <${top?.type}>: close the inner tag first.`);
			open.pop();
			at += 3 + (name as string).length;
			continue;
		}
		const name = nameAt(at + 1) as string;
		at += 1 + name.length;
		const mark: Mark = { type: name };
		for (;;) {
			const space = /\s*/y;
			space.lastIndex = at;
			at += (space.exec(text)?.[0] ?? "").length;
			if (text.startsWith("/>", at) || text[at] === ">") break;
			const key = match(ATTR, at);
			if (key === null || text[at + key.length] !== "=") bad(`An attribute of <${name}> does not read.`);
			at += (key as string).length + 1;
			if (text[at] === '"') {
				const end = text.indexOf('"', at + 1);
				if (end < 0) bad(`An attribute of <${name}> has no closing quote.`);
				mark[key as string] = decode(text.slice(at + 1, end));
				at = end + 1;
			} else if (text[at] === "{") {
				const end = jsonEnd(text, at);
				if (end < 0) bad(`An attribute of <${name}> has no closing brace.`);
				try {
					mark[key as string] = JSON.parse(text.slice(at + 1, end));
				} catch {
					bad(`An attribute of <${name}> in braces is not JSON.`);
				}
				at = end + 1;
			} else bad(`An attribute of <${name}> is neither "text" nor {JSON}.`);
		}
		if (text.startsWith("/>", at)) {
			if (name !== FOOTNOTE) bad(`<${name}/> closes itself: only <${FOOTNOTE} id="…"/> does.`);
			if (typeof mark.id !== "string") bad(`<${FOOTNOTE}/> needs id="…".`);
			out.push({ type: "footnoteRef", id: mark.id as string });
			at += 2;
			continue;
		}
		if (name === FOOTNOTE) bad(`<${FOOTNOTE} id="…"/> closes itself.`);
		open.push(mark);
		at += 1;
	}
	flush();
	if (open.length > 0) bad(`<${open.at(-1)?.type}> is not closed.`);
	return out;
}

/** Where the JSON in braces that starts at `from` ends (its closing brace), or -1. Braces inside JSON strings do not count. */
function jsonEnd(text: string, from: number): number {
	let depth = 0;
	let inString = false;
	for (let at = from; at < text.length; at++) {
		const char = text[at];
		if (inString) {
			if (char === "\\") at++;
			else if (char === '"') inString = false;
		} else if (char === '"') inString = true;
		else if (char === "{" || char === "[") depth++;
		else if (char === "}" || char === "]") {
			depth--;
			if (depth === 0) return char === "}" ? at : -1;
		}
	}
	return -1;
}
