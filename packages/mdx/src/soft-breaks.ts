import type { Root } from "mdast";
import { splitFrontmatter } from "./frontmatter";
import { parseMdxAst } from "./parse";
import { RAW_SOURCE_PARAGRAPH } from "./syntax/raw-source";
import type { SyntaxExtension } from "./syntax/types";

/**
 * Soft line endings, made explicit. A single newline inside a paragraph used to render as a line break on the public page (`remark-breaks`) while the CMS
 * tree and the editor read it as a space. The public page now follows CommonMark (a space), so a body that relied on the old look keeps it by
 * writing a `<br />` at each such line ending.
 *
 * The edit is made on the stored string at the offsets the parser reports, so nothing else in the body moves: no re-serialization, which matters to a site that writes
 * its own notation (directive syntax) and must keep its exact text. Only paragraph text is touched. Code, inline code, math, expressions, raw HTML, headings, tables,
 * and attributes are never text nodes of a paragraph, so they are left alone by construction.
 */

type MdNode = {
	type: string;
	name?: string | null;
	value?: string;
	children?: MdNode[];
	data?: Record<string, unknown>;
	position?: { start?: { offset?: number }; end?: { offset?: number } };
};

/** Nodes whose text is not paragraph prose, even where they sit inside a paragraph. */
const SKIPPED_TYPES = new Set([
	"code",
	"inlineCode",
	"math",
	"inlineMath",
	"html",
	"heading",
	"table",
	"tableRow",
	"tableCell",
	"definition",
	"mdxFlowExpression",
	"mdxTextExpression",
	"mdxjsEsm",
	"yaml",
	"toml",
]);

/** Elements whose children are cells or source, not prose: a cell is one line, and a code or math element holds its source. */
const SKIPPED_ELEMENTS = new Set(["Table", "TableRow", "TableCell", "CodeBlock", "Math"]);

const isElement = (node: MdNode) => node.type === "mdxJsxFlowElement" || node.type === "mdxJsxTextElement";

const isBreakElement = (node: MdNode | undefined) => node?.type === "mdxJsxTextElement" && node.name === "br";

const LINE_ENDING = /\r?\n/g;

type Collected = { offsets: number[]; skipped: number };

/** Offsets (into the parsed body) just before each soft line ending of the paragraph text under `node`. */
const collect = (body: string, node: MdNode, inParagraph: boolean, out: Collected, previous?: MdNode): void => {
	if (SKIPPED_TYPES.has(node.type) || (isElement(node) && SKIPPED_ELEMENTS.has(node.name ?? ""))) return;
	if (node.type === "paragraph") {
		// Source a syntax extension turned back into text is written as it is: nothing may be inserted into it.
		if (node.data?.[RAW_SOURCE_PARAGRAPH]) return;
		inParagraph = true;
	}
	if (node.type === "text" && inParagraph) {
		collectText(body, node, previous, out);
		return;
	}
	let before: MdNode | undefined;
	for (const child of node.children ?? []) {
		collect(body, child, inParagraph, out, before);
		before = child;
	}
};

const collectText = (body: string, node: MdNode, previous: MdNode | undefined, out: Collected): void => {
	const value = node.value ?? "";
	const start = node.position?.start?.offset;
	const end = node.position?.end?.offset;
	const expected = [...value.matchAll(/\n/g)].length;
	if (expected === 0 && !isBreakElement(previous)) return;
	if (typeof start !== "number" || typeof end !== "number") {
		if (expected > 0) out.skipped += 1;
		return;
	}
	const raw = body.slice(start, end);
	const endings = [...raw.matchAll(LINE_ENDING)];
	// The line ending the serializer writes after `<br />` is not content: the parser drops it from the text, but it is still in the source.
	if (isBreakElement(previous) && endings[0]?.index === 0) endings.shift();
	if (endings.length !== expected) {
		// The text and the source cannot be paired (a character reference, a synthesized node), so nothing is inserted into it.
		if (expected > 0) out.skipped += 1;
		return;
	}
	for (const ending of endings) {
		let at = start + ending.index;
		// Trailing spaces before the line ending are not part of the line's text.
		while (at > start && (body[at - 1] === " " || body[at - 1] === "\t")) at -= 1;
		out.offsets.push(at);
	}
};

/**
 * What a tree says, apart from `<br />` elements and how text is split: node types and names in order, and the text without whitespace.
 * Inserting breaks must change nothing else, so two trees that differ only by breaks have the same fingerprint.
 */
const fingerprint = (node: MdNode): string => {
	if (node.type === "text") return (node.value ?? "").replace(/\s+/g, "");
	if (isBreakElement(node)) return "";
	const own = `<${node.type}:${node.name ?? ""}>${typeof node.value === "string" ? node.value.replace(/\s+/g, "") : ""}`;
	return own + (node.children ?? []).map(fingerprint).join("");
};

const breakCount = (node: MdNode): number =>
	(isBreakElement(node) ? 1 : 0) + (node.children ?? []).reduce((sum, child) => sum + breakCount(child), 0);

export type SoftBreakResult =
	| { readonly status: "unchanged" }
	| { readonly status: "changed"; readonly mdx: string; readonly inserted: number }
	| { readonly status: "skipped"; readonly reason: "unparsed" | "unsafe"; readonly detail?: string };

/**
 * Writes `<br />` at each soft line ending inside paragraph text of `mdx`. `syntax` is the syntax extensions to read with (none: standard MDX).
 *
 * - `unchanged`: there is no soft line ending (running it again on its own result gives this).
 * - `changed`: the new string. The change was checked: it parses, and the parsed tree differs from the old one only by the added breaks.
 * - `skipped`: the body is left as it is. `unparsed` for a body that does not parse, `unsafe` when the edit could not be made without
 *   touching something else (a line ending that cannot be paired with the source, or a result that does not read the same).
 */
export const insertSoftBreaks = (mdx: string, syntax?: readonly SyntaxExtension[]): SoftBreakResult => {
	const { body } = splitFrontmatter(mdx);
	const prefix = mdx.slice(0, mdx.length - body.length);
	let before: Root;
	try {
		before = parseMdxAst(body, syntax);
	} catch (error) {
		return { status: "skipped", reason: "unparsed", detail: error instanceof Error ? error.message : String(error) };
	}

	const found: Collected = { offsets: [], skipped: 0 };
	collect(body, before as MdNode, false, found);
	if (found.skipped > 0) {
		return {
			status: "skipped",
			reason: "unsafe",
			detail: `${found.skipped} text node(s) cannot be paired with the source`,
		};
	}
	if (found.offsets.length === 0) return { status: "unchanged" };

	let edited = body;
	for (const offset of [...found.offsets].sort((left, right) => right - left)) {
		edited = `${edited.slice(0, offset)}<br />${edited.slice(offset)}`;
	}

	let after: Root;
	try {
		after = parseMdxAst(edited, syntax);
	} catch (error) {
		return { status: "skipped", reason: "unsafe", detail: error instanceof Error ? error.message : String(error) };
	}
	const sameTree = fingerprint(before as MdNode) === fingerprint(after as MdNode);
	const added = breakCount(after as MdNode) - breakCount(before as MdNode);
	if (!sameTree || added !== found.offsets.length) {
		return {
			status: "skipped",
			reason: "unsafe",
			detail: "the edited body does not read the same apart from the breaks",
		};
	}
	return { status: "changed", mdx: prefix + edited, inserted: found.offsets.length };
};
