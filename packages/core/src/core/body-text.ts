import { BLOCK_BY_COMPONENT, BLOCK_BY_NAME } from "../blocks/derive";
import { analyze, type CmsNode, toDocument } from "../mdx";
import type { SyntaxExtension } from "../syntax/types";

/**
 * Readable text of an MDX body, taken from the parsed document (`analyze` + `toDocument`) and not from the string. The body is read with the site's
 * syntax, so a notation an extension adds (directives, say) and the JSX blocks of standard MDX are understood the same way, without a pattern per notation.
 */
export interface BodyTextOptions {
	/** Code (fences and inline code) and math. */
	readonly code: boolean;
	/** Images (alt text, caption, title) and file cards (label). */
	readonly media: boolean;
	/** Text a reader of the page does not see: translation notes and the hover text of a text decoration (a tooltip). */
	readonly hidden: boolean;
}

/** What the page shows as prose, for a summary (`fillFromBody`). */
export const EXCERPT_TEXT: BodyTextOptions = { code: false, media: false, hidden: false };

/** Everything a person could look for in the body, for search. */
export const SEARCH_TEXT: BodyTextOptions = { code: true, media: true, hidden: true };

/** Nodes that sit inside a line of text: neighbors of these run together, everything else is set apart by a space. */
const INLINE_TYPES = new Set(["text", "hardBreak", "footnoteReference", "mdxExpression"]);

const MEDIA_TYPES = new Set(["image", "File"]);

/** The block definition of a node (a node's type is the block's renderer name; an image is `image`). */
const blockOf = (node: CmsNode) => BLOCK_BY_COMPONENT.get(node.type === "image" ? "Image" : node.type);

/** Values of the attributes a block definition marks `translatable` (a callout title, a tab label, an image alt…): text a reader sees. */
const translatableValues = (
	attributes: Readonly<Record<string, { readonly translatable?: boolean }>> | undefined,
	values: Readonly<Record<string, unknown>> | undefined,
): string[] =>
	Object.entries(attributes ?? {}).flatMap(([name, attribute]) => {
		const value = values?.[name];
		return attribute.translatable && typeof value === "string" ? [value] : [];
	});

const textOf = (node: CmsNode, options: BodyTextOptions): string => {
	if (node.type === "text") {
		const marks = node.marks ?? [];
		if (!options.code && marks.some((mark) => mark.type === "code")) return "";
		if (!options.hidden && marks.some((mark) => mark.type === "untranslated")) return "";
		const own = node.text ?? "";
		if (!options.hidden) return own;
		// The hover text of a text decoration is attached to its text.
		const hover = marks.flatMap((mark) => translatableValues(BLOCK_BY_NAME.get(mark.type)?.attributes, mark.attrs));
		return [own, ...hover].join(" ");
	}
	if (node.type === "hardBreak") return " ";
	if (node.type === "codeBlock" || node.type === "math") return options.code ? String(node.attrs?.value ?? "") : "";
	if (!options.media && MEDIA_TYPES.has(node.type)) return "";
	if (
		node.type === "footnoteReference" ||
		node.type === "mdxExpression" ||
		node.type === "html" ||
		node.type === "mdxEsm"
	) {
		return "";
	}

	const own = translatableValues(blockOf(node)?.attributes, node.attrs);
	const parts: string[] = [];
	let previous: CmsNode | undefined;
	for (const child of node.content ?? []) {
		const text = textOf(child, options);
		if (previous && !(INLINE_TYPES.has(previous.type) && INLINE_TYPES.has(child.type))) parts.push(" ");
		parts.push(text);
		previous = child;
	}
	return [...own, parts.join("")].join(" ");
};

const collapse = (text: string) => text.replace(/\s+/g, " ").trim();

/**
 * For a body that does not parse (there is no tree to read): the string with comments, import/export lines, link addresses and tags removed.
 * It is a fallback, so it only has to be better than nothing for search and summaries; a body that parses never goes through it.
 */
const looseText = (mdx: string) =>
	collapse(
		mdx
			.replace(/\{\/\*[\s\S]*?\*\/\}/g, " ")
			.replace(/<!--[\s\S]*?-->/g, " ")
			.replace(/^\s*(?:export|import)\b[\s\S]*?;(?:\r?\n|$)/gm, " ")
			.replace(/!?\[([^\]]*)\]\([^)]+\)/g, "$1")
			.replace(/<[a-zA-Z0-9_/][^>"\x27]*(?:"[^"]*"|\x27[^\x27]*\x27|[^>"\x27]*)*>/g, " "),
	);

/**
 * The text of a body, as one line (runs of whitespace are one space). `syntax` is the site's `mdx.syntax` unless given.
 * Block elements are set apart by a space and inline runs stay together, so a word split by emphasis is still one word.
 */
export function bodyText(mdx: string, options: BodyTextOptions, syntax?: readonly SyntaxExtension[]): string {
	if (!mdx) return "";
	const analysis = analyze(mdx, undefined, syntax);
	if (!analysis.tree) return looseText(mdx);
	try {
		return collapse(textOf(toDocument(analysis), options));
	} catch {
		return looseText(mdx);
	}
}
