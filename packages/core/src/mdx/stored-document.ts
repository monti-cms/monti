import { annotationConfig } from "../annotation/code-block/active";
import { fromCodeFenceToCodeBlockDocument } from "../annotation/code-block/code-fence-to-document";
import type { SyntaxExtension } from "../syntax/types";
import { analyze } from "./analyze";
import { assignBlockIds, copyBlockIds, withoutBlockIds } from "./block-ids";
import { attributeRecord } from "./jsx";
import { BLOCK_JSX_NAMES } from "./registry";
import { serialize } from "./serialize";
import { configuredSyntax, syntaxBlocks } from "./syntax";
import { toDocument } from "./to-document";
import type { CmsJsonValue, CmsJsxAttribute, CmsMark, CmsMdxAnalysis, CmsNode } from "./types";

/**
 * Format version of a stored document. Raise it when a node or attribute changes its name or meaning, and add the step
 * from the previous version to `STORED_DOCUMENT_MIGRATIONS`. A new kind of block does not raise it.
 */
export const STORED_DOCUMENT_VERSION = 1;

/**
 * A body as it is stored: the parsed document in a shape that does not depend on how the body was written.
 *
 * It differs from the working document (`toDocument`) in a few ways:
 * - a block with a definition is stored under the definition's name (`callout`), not the component that renders it (`Callout`),
 *   with only its attribute values (no component name, no raw attribute list);
 * - JSX that no definition describes (a fragment, a `br` with attributes, spread attributes, a block written as JSX the
 *   editor cannot map) stays `mdxJsx` with its component `name` and raw `attributes` list, so it can be written back as it was;
 * - a code block keeps `language`, `meta`, `value` and its meta keys, not the annotation document derived from them;
 * - trailing blank lines are dropped (they are never written);
 * - object keys are sorted at every depth, so the same body is the same JSON wherever it was stored (Postgres `jsonb` reorders keys).
 *
 * A body with front matter has no stored document.
 */
export interface StoredDocument {
	readonly type: "doc";
	readonly version: number;
	readonly content: readonly CmsNode[];
}

/** Node types of the document model itself. A block definition with one of these names is stored as `mdxJsx` so the two never mix. */
const CORE_NODE_TYPES = new Set([
	"doc",
	"paragraph",
	"heading",
	"blockquote",
	"bulletList",
	"orderedList",
	"listItem",
	"horizontalRule",
	"footnoteDefinition",
	"footnoteReference",
	"table",
	"tableRow",
	"tableCell",
	"codeBlock",
	"math",
	"image",
	"html",
	"mdxEsm",
	"mdxExpression",
	"mdxJsx",
	"text",
	"hardBreak",
]);

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === "object" && value !== null && !Array.isArray(value);

const sortJson = (value: CmsJsonValue): CmsJsonValue => {
	if (value === null || typeof value !== "object") return value;
	if (Array.isArray(value)) return value.map(sortJson);
	const out: Record<string, CmsJsonValue> = {};
	for (const key of Object.keys(value).sort()) {
		const member = value[key];
		if (member !== undefined) out[key] = sortJson(member);
	}
	return out;
};

const sortedAttrs = (attrs: Record<string, CmsJsonValue>): Record<string, CmsJsonValue> | undefined =>
	Object.keys(attrs).length > 0 ? (sortJson(attrs) as Record<string, CmsJsonValue>) : undefined;

/** Builds a node with its keys in sorted order (`attrs`, `content`, `id`, `marks`, `text`, `type`). */
const node = (
	type: string,
	attrs: Record<string, CmsJsonValue> | undefined,
	content: CmsNode[] | undefined,
	marks: CmsMark[] | undefined,
	text: string | undefined,
	id?: string,
): CmsNode => {
	const out: CmsNode = {} as CmsNode;
	if (attrs && Object.keys(attrs).length > 0) out.attrs = sortJson(attrs) as Record<string, CmsJsonValue>;
	if (content) out.content = content;
	if (id !== undefined) out.id = id;
	if (marks && marks.length > 0) out.marks = marks;
	if (text !== undefined) out.text = text;
	out.type = type;
	return out;
};

const storedMark = (mark: CmsMark): CmsMark => {
	const attrs = mark.attrs ? sortedAttrs(mark.attrs) : undefined;
	return attrs ? { attrs, type: mark.type } : { type: mark.type };
};

const hasSpread = (attrs: Record<string, CmsJsonValue> | undefined): boolean =>
	Array.isArray(attrs?.attributes) && attrs.attributes.some((item) => isRecord(item) && Boolean(item.spread));

/** The definition a working JSX node is stored by, if it is a plain container or leaf block. */
const definitionOf = (working: CmsNode) => {
	if (!BLOCK_JSX_NAMES.has(working.type) || hasSpread(working.attrs)) return undefined;
	const block = syntaxBlocks.byComponent(working.type);
	if (!block || CORE_NODE_TYPES.has(block.name)) return undefined;
	const kind = block.syntax.kind;
	return kind === "container" || kind === "leaf" ? block : undefined;
};

/** Attribute values of a JSX node: everything but the component name, the raw list and the spread marker. */
const valuesOf = (attrs: Record<string, CmsJsonValue> | undefined): Record<string, CmsJsonValue> => {
	const { name: _name, attributes: _attributes, spread: _spread, ...values } = attrs ?? {};
	return values;
};

/** Raw JSX keeps only its component name and attribute list; the named values are read from the list again. */
const rawJsxAttrs = (attrs: Record<string, CmsJsonValue> | undefined, name: string): Record<string, CmsJsonValue> => ({
	name,
	attributes: Array.isArray(attrs?.attributes) ? attrs.attributes : [],
});

const toStoredNode = (working: CmsNode): CmsNode => {
	const content = working.content?.map(toStoredNode);
	const marks = working.marks?.map(storedMark);
	if (working.type === "codeBlock") {
		const { codeDocument: _derived, ...attrs } = working.attrs ?? {};
		return node("codeBlock", attrs, content, marks, working.text, working.id);
	}
	if (working.type !== "mdxJsx" && BLOCK_JSX_NAMES.has(working.type)) {
		const block = definitionOf(working);
		if (block) return node(block.name, valuesOf(working.attrs), content, marks, working.text, working.id);
		// No plain definition (spread attributes, `Math`, a table row outside a table): keep it as raw JSX.
		return node("mdxJsx", rawJsxAttrs(working.attrs, working.type), content, marks, working.text, working.id);
	}
	if (working.type === "mdxJsx") {
		const name = typeof working.attrs?.name === "string" ? working.attrs.name : "";
		return node("mdxJsx", rawJsxAttrs(working.attrs, name), content, marks, working.text, working.id);
	}
	return node(working.type, working.attrs, content, marks, working.text, working.id);
};

const isBlankParagraph = (block: CmsNode) => block.type === "paragraph" && (block.content ?? []).length === 0;

/** The stored form of a working document, or `null` when the body cannot be stored as a document (it has front matter). */
export const toStoredDocument = (working: CmsNode): StoredDocument | null => {
	if (working.type !== "doc") throw new TypeError("Not a document");
	if (working.attrs?.frontmatter !== undefined) return null;
	const content = (working.content ?? []).map(toStoredNode);
	while (content.length > 0 && isBlankParagraph(content[content.length - 1] as CmsNode)) content.pop();
	return { content, type: "doc", version: STORED_DOCUMENT_VERSION } as StoredDocument;
};

const codeBlockAttrs = (attrs: Record<string, CmsJsonValue>): Record<string, CmsJsonValue> => {
	const language = typeof attrs.language === "string" ? attrs.language : "";
	const meta = typeof attrs.meta === "string" ? attrs.meta : "";
	const value = typeof attrs.value === "string" ? attrs.value : "";
	const codeDocument = fromCodeFenceToCodeBlockDocument(
		{ type: "code", lang: language || undefined, meta: meta || undefined, value },
		annotationConfig,
	);
	return { ...attrs, codeDocument: JSON.parse(JSON.stringify(codeDocument)) as CmsJsonValue };
};

/** Working JSX node for a stored block: the component name and a raw attribute list rebuilt from the values. */
const jsxNode = (component: string, values: Record<string, CmsJsonValue>): Record<string, CmsJsonValue> => ({
	...values,
	name: component,
	attributes: Object.entries(values).map(([name, value]) => ({ name, value })),
});

const toWorkingNode = (stored: CmsNode): CmsNode => {
	const out: CmsNode = { type: stored.type };
	const content = stored.content?.map(toWorkingNode);
	let attrs = stored.attrs ? { ...stored.attrs } : undefined;
	if (stored.type === "codeBlock") {
		attrs = codeBlockAttrs(attrs ?? {});
	} else if (stored.type === "mdxJsx") {
		const name = typeof attrs?.name === "string" ? attrs.name : "";
		const attributes = Array.isArray(attrs?.attributes) ? attrs.attributes : [];
		// The same shape `toDocument` gives JSX: the named values, then the component name and the raw list.
		attrs = { ...attributeRecord(attributes as CmsJsxAttribute[]), name, attributes };
		if (name && BLOCK_JSX_NAMES.has(name)) out.type = name;
	} else if (!CORE_NODE_TYPES.has(stored.type)) {
		const block = syntaxBlocks.byName(stored.type);
		if (block) {
			out.type = block.component;
			attrs = jsxNode(block.component, attrs ?? {});
		}
	}
	if (attrs) out.attrs = attrs;
	if (content) out.content = content;
	if (stored.marks) out.marks = stored.marks.map((mark) => ({ ...mark }));
	if (stored.text !== undefined) out.text = stored.text;
	if (stored.id !== undefined) out.id = stored.id;
	return out;
};

/** The working document (the shape `toDocument` makes and `serialize` and the editor read) of a stored document. */
export const fromStoredDocument = (stored: StoredDocument): CmsNode => ({
	type: "doc",
	content: stored.content.map(toWorkingNode),
});

/** Steps that lift a stored document from version `n` to `n + 1`, by `n`. Empty while there is one version. */
const STORED_DOCUMENT_MIGRATIONS: Readonly<Record<number, (doc: StoredDocument) => StoredDocument>> = {};

const NODE_KEYS = new Set(["type", "id", "attrs", "content", "marks", "text"]);

const isJsonValue = (value: unknown): value is CmsJsonValue => {
	if (value === null || typeof value === "string" || typeof value === "boolean") return true;
	if (typeof value === "number") return Number.isFinite(value);
	if (Array.isArray(value)) return value.every(isJsonValue);
	return isRecord(value) && Object.values(value).every(isJsonValue);
};

const isMark = (value: unknown): value is CmsMark =>
	isRecord(value) &&
	typeof value.type === "string" &&
	value.type.length > 0 &&
	Object.keys(value).every((key) => key === "type" || key === "attrs") &&
	(value.attrs === undefined || (isRecord(value.attrs) && isJsonValue(value.attrs)));

const isNode = (value: unknown): value is CmsNode =>
	isRecord(value) &&
	typeof value.type === "string" &&
	value.type.length > 0 &&
	Object.keys(value).every((key) => NODE_KEYS.has(key)) &&
	(value.attrs === undefined || (isRecord(value.attrs) && isJsonValue(value.attrs))) &&
	(value.content === undefined || (Array.isArray(value.content) && value.content.every(isNode))) &&
	(value.marks === undefined || (Array.isArray(value.marks) && value.marks.every(isMark))) &&
	(value.text === undefined || typeof value.text === "string") &&
	(value.id === undefined || typeof value.id === "string");

/**
 * Reads a stored document from JSON (a database column, an API request, an export file): checks its shape and lifts an
 * older version to the current one. Returns `undefined` for anything that is not a stored document of a known version.
 */
export const readStoredDocument = (value: unknown): StoredDocument | undefined => {
	if (!isRecord(value) || value.type !== "doc") return undefined;
	if (Object.keys(value).some((key) => key !== "type" && key !== "version" && key !== "content")) return undefined;
	const version = value.version;
	if (typeof version !== "number" || !Number.isInteger(version) || version < 1 || version > STORED_DOCUMENT_VERSION) {
		return undefined;
	}
	if (!Array.isArray(value.content) || !value.content.every(isNode)) return undefined;
	// Keys are sorted again: a document read from `jsonb` comes back in Postgres' key order.
	let doc: StoredDocument = {
		content: value.content.map((item) => sortJson(item as unknown as CmsJsonValue) as unknown as CmsNode),
		type: "doc",
		version,
	};
	while (doc.version < STORED_DOCUMENT_VERSION) {
		const step = STORED_DOCUMENT_MIGRATIONS[doc.version];
		if (!step) return undefined;
		doc = step(doc);
	}
	return doc;
};

/** One body in both forms. `doc` is `null` when the MDX does not parse, has front matter, or would not read back the same once written. */
export interface Body {
	readonly mdx: string;
	readonly doc: StoredDocument | null;
	readonly analysis: CmsMdxAnalysis;
}

/** Two documents with the same content (block ids are not content). */
const sameDocument = (left: StoredDocument, right: StoredDocument) =>
	JSON.stringify(withoutBlockIds(left.content)) === JSON.stringify(withoutBlockIds(right.content));

const withContent = (doc: StoredDocument, content: CmsNode[]): StoredDocument => ({
	content,
	type: "doc",
	version: doc.version,
});

const storedFrom = (analysis: CmsMdxAnalysis): StoredDocument | null => {
	if (analysis.errors.length > 0) return null;
	try {
		return toStoredDocument(toDocument(analysis));
	} catch {
		return null;
	}
};

export interface BodyOptions {
	/** The body this one replaces. Blocks that pair with its blocks inherit their ids (`assignBlockIds`). */
	readonly previous?: StoredDocument | null;
}

/**
 * A body from MDX. When the MDX parses, the document is the source and the MDX is written from it with the site's syntax,
 * so the same content is always stored with the same text. The written text must read back to the same document; if it
 * does not (or the MDX does not parse, or has front matter), the MDX is kept exactly as given and there is no document.
 * MDX carries no block ids, so the document's blocks inherit them from `options.previous` or get new ones.
 */
export const bodyFromMdx = (
	mdx: string,
	syntax: readonly SyntaxExtension[] = configuredSyntax(),
	options: BodyOptions = {},
): Body => {
	const analysis = analyze(mdx, undefined, syntax);
	const parsed = storedFrom(analysis);
	if (!parsed) return { mdx, doc: null, analysis };
	const doc = withContent(parsed, assignBlockIds(parsed.content, [options.previous?.content]));
	const written = serialize(fromStoredDocument(doc), syntax);
	if (written === mdx) return { mdx, doc, analysis };
	const rewritten = analyze(written, undefined, syntax);
	const reread = storedFrom(rewritten);
	if (!reread || !sameDocument(doc, reread)) return { mdx, doc: null, analysis };
	return { mdx: written, doc, analysis: rewritten };
};

/**
 * A body from a stored document: its MDX is written with the site's syntax and read back, so the result is the same as from that MDX.
 * The block ids of `doc` are kept (a block without one, or with a copy of another's, gets one as `bodyFromMdx` would).
 */
export const bodyFromDocument = (
	doc: StoredDocument,
	syntax: readonly SyntaxExtension[] = configuredSyntax(),
	options: BodyOptions = {},
): Body => {
	const body = bodyFromMdx(serialize(fromStoredDocument(doc), syntax), syntax);
	if (!body.doc) return body;
	// Read back as the same document: its blocks are the given ones, in the same order. Otherwise pair them up.
	const same = sameDocument(doc, body.doc);
	const given = same ? copyBlockIds(body.doc.content, doc.content) : withoutBlockIds(body.doc.content);
	const content = assignBlockIds(given, same ? [options.previous?.content] : [doc.content, options.previous?.content]);
	return { ...body, doc: withContent(body.doc, content) };
};
