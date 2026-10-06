import type { Element, Root, RootContent } from "hast";
import { fromHtml } from "hast-util-from-html";
import { toHtml } from "hast-util-to-html";
import type { ComponentType, ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ADDED_BLOCKS } from "../../blocks/active";
import { bodyFromMdx, type StoredDocument } from "../../mdx/stored-document";
import type { SyntaxExtension } from "../../syntax/types";
import {
	type DocumentComponents,
	type MdxComponents,
	type RenderDocumentOptions,
	renderDocument,
	renderMdx,
} from "../index";

/**
 * Parity between the two renderers. A body is stored as a document; `renderMdx` renders the MDX written from that document (`Body.mdx`) and
 * `renderDocument` renders the document itself. After `normalizeHtml` the two must be the same markup; what the normalizer hides is the
 * list of insignificant differences (and the intended ones), in one place:
 *
 * - whitespace and line endings between blocks (`mdast-util-to-hast` writes `\n`, React writes nothing);
 * - the order of attributes and of classes, a `;` that ends a style value;
 * - a GFM table (`<table><thead><th style="text-align:center">`) and the table component of the JSON renderer (a scroll wrapper, `cms-table-*` classes,
 *   `cms-align-*` for alignment): both are read as the same table (rows, header cells, spans, alignment). The JSON renderer draws every table with its
 *   own table component, the way the MDX chain already drew a JSX table; the page looks the same.
 * - the `<link rel="preload">` hints React puts in front of the first images (their order depends on when each image was reached);
 * - a paragraph of only `<strong>`/`<em>`/`<del>` elements is drawn by MDX without its `<p>` (a line of only inline JSX is a flow element there);
 *   the JSON renderer keeps the paragraph;
 * - `useId` ids (tabs, folds) are numbered by first appearance: React derives them from the position in the tree;
 * - block formulas: KaTeX output is inside `<div class="cms-math">` (a React tree cannot be a bare string of HTML).
 */

const BLOCKS = new Set([
	"address",
	"article",
	"aside",
	"blockquote",
	"details",
	"div",
	"figure",
	"figcaption",
	"footer",
	"h1",
	"h2",
	"h3",
	"h4",
	"h5",
	"h6",
	"header",
	"hr",
	"li",
	"main",
	"nav",
	"ol",
	"p",
	"pre",
	"section",
	"summary",
	"table",
	"tbody",
	"td",
	"th",
	"thead",
	"tr",
	"ul",
	"colgroup",
]);

const isElement = (node: RootContent): node is Element => node.type === "element";

const classesOf = (node: Element): string[] => {
	const value: unknown = node.properties?.className;
	return Array.isArray(value) ? value.map(String) : typeof value === "string" ? value.split(/\s+/) : [];
};

const setClasses = (node: Element, classes: string[]) => {
	if (classes.length > 0) node.properties.className = classes;
	else delete node.properties.className;
};

const normalizeStyle = (value: string) =>
	value
		.split(";")
		.map((part) => part.trim())
		.filter(Boolean)
		.join(";");

const ALIGN = /^cms-align-(left|center|right)$/;

const EMPHASIS = new Set(["strong", "em", "del"]);

/**
 * A paragraph of only `<strong>`, `<em>` or `<del>` elements: MDX reads a line of only inline JSX (how the serializer writes emphasis next to
 * punctuation) as a flow element and draws it without the paragraph. The JSON renderer keeps the paragraph, so both are read as the bare elements.
 */
const isEmphasisOnly = (node: Element) =>
	node.tagName === "p" &&
	node.children.length > 0 &&
	node.children.every(
		(child) =>
			(isElement(child) && EMPHASIS.has(child.tagName)) || (child.type === "text" && /^\s*$/.test(child.value)),
	);

const normalizeTables = (node: Element | Root) => {
	for (let index = 0; index < node.children.length; index += 1) {
		const child = node.children[index] as RootContent;
		if (!isElement(child)) continue;
		// Resource hints React hoists for images (their order depends on when each image was reached).
		if (
			child.tagName === "link" &&
			child.properties.rel !== undefined &&
			String(child.properties.rel).includes("preload")
		) {
			node.children.splice(index, 1);
			index -= 1;
			continue;
		}
		if (isEmphasisOnly(child)) {
			node.children.splice(index, 1, ...(child.children.filter(isElement) as RootContent[]));
			index -= 1;
			continue;
		}
		// The scroll wrapper of the table component.
		if (child.tagName === "div" && classesOf(child).includes("cms-table-scroll")) {
			node.children.splice(index, 1, ...(child.children as RootContent[]));
			index -= 1;
			continue;
		}
		if (child.tagName === "div" && classesOf(child).includes("cms-math")) {
			node.children.splice(index, 1, ...(child.children as RootContent[]));
			index -= 1;
			continue;
		}
		normalizeTables(child);
	}
};

const normalizeNode = (node: Element | Root, inPre: boolean) => {
	if (node.type === "element") {
		const classes = classesOf(node);
		if (node.tagName === "table" || node.tagName === "th" || node.tagName === "td") {
			const align = classes.map((name) => ALIGN.exec(name)?.[1]).find(Boolean);
			const style = typeof node.properties.style === "string" ? node.properties.style : "";
			const textAlign = /text-align:\s*(left|center|right)/.exec(style)?.[1];
			setClasses(
				node,
				classes.filter((name) => !name.startsWith("cms-table") && !ALIGN.test(name)),
			);
			delete node.properties.align;
			if (align ?? textAlign) node.properties["data-align"] = (align ?? textAlign) as string;
			if (textAlign) node.properties.style = normalizeStyle(style.replace(/text-align:\s*(left|center|right)/, ""));
			if (node.properties.style === "") delete node.properties.style;
		} else {
			setClasses(node, [...classes].sort());
		}
		if (typeof node.properties.style === "string") node.properties.style = normalizeStyle(node.properties.style);
		if (node.properties.style === "") delete node.properties.style;
		node.properties = Object.fromEntries(Object.entries(node.properties).sort(([a], [b]) => a.localeCompare(b)));
	}
	const code = inPre || (node.type === "element" && node.tagName === "pre");
	const children = node.children as RootContent[];
	for (let index = 0; index < children.length; index += 1) {
		const child = children[index] as RootContent;
		if (isElement(child)) {
			normalizeNode(child, code);
			continue;
		}
		if (child.type !== "text" || code) continue;
		const previous = children[index - 1];
		const next = children[index + 1];
		const startsBlock = index === 0 || (previous && isElement(previous) && BLOCKS.has(previous.tagName));
		const endsBlock = index === children.length - 1 || (next && isElement(next) && BLOCKS.has(next.tagName));
		let value = child.value;
		if (startsBlock) value = value.replace(/^\s*\n\s*/, "");
		if (endsBlock) value = value.replace(/\s*\n\s*$/, "");
		if (value === "" || (/^\s*$/.test(value) && value.includes("\n"))) {
			children.splice(index, 1);
			index -= 1;
			continue;
		}
		child.value = value;
	}
};

/** `useId` ids (`_R_1_`, `«R1»`) depend on where a component sits in the tree, so they are numbered by first appearance instead. */
const USE_ID = /_R_[0-9a-z]*_|«R[0-9a-z]*»|:R[0-9a-z]*:/g;

const renumberIds = (html: string): string => {
	const seen = new Map<string, string>();
	return html.replace(USE_ID, (id) => {
		if (!seen.has(id)) seen.set(id, `useid${seen.size}`);
		return seen.get(id) as string;
	});
};

/** Markup with the insignificant differences between the two renderers removed (see the list at the top of this file). */
export const normalizeHtml = (html: string): string => {
	const tree = fromHtml(renumberIds(html), { fragment: true });
	normalizeTables(tree);
	normalizeNode(tree, false);
	return toHtml(tree, { allowDangerousHtml: true, closeSelfClosing: true });
};

export interface Parity {
	readonly mdx: string;
	readonly document: string;
	readonly doc: StoredDocument;
	readonly unknown: number;
	readonly tocMdx: readonly { value: string; href: string; depth: number }[];
	readonly tocDocument: readonly { value: string; href: string; depth: number }[];
}

export interface ParityOptions extends Omit<RenderDocumentOptions, "components"> {
	/** Syntax extensions the source is written in (the site config's `mdx.syntax` otherwise). */
	readonly syntax?: readonly SyntaxExtension[];
	/** The component table of each renderer (the MDX table is keyed by component name, the document table by node, mark and block name). */
	readonly mdxComponents?: MdxComponents;
	readonly documentComponents?: DocumentComponents;
}

/**
 * Renders a body both ways. `source` is MDX; it is stored as a document and the document is rendered, and `renderMdx` renders the text written from
 * the same document, so both renderers read what the store would hold.
 */
export const renderBoth = async (source: string, options: ParityOptions = {}): Promise<Parity> => {
	const { syntax, mdxComponents, documentComponents, ...shared } = options;
	const body = bodyFromMdx(source, syntax);
	if (!body.doc) throw new Error("renderBoth: the source does not become a document");
	const mdx = await renderMdx(body.mdx, { ...shared, syntax, components: mdxComponents });
	const document = await renderDocument(body.doc, { ...shared, components: documentComponents });
	return {
		mdx: normalizeHtml(renderToStaticMarkup(mdx.content as never)),
		document: normalizeHtml(renderToStaticMarkup(document.content as never)),
		doc: body.doc,
		unknown: document.unknown.length,
		tocMdx: mdx.toc.map(({ value, href, depth }) => ({ value, href, depth })),
		tocDocument: document.toc.map(({ value, href, depth }) => ({ value, href, depth })),
	};
};

/**
 * One stand-in component per block of the site config (and the code tag `Tooltip`), for both renderers: the same element with the block's name and
 * its attributes (a default value, `false` and an empty value are left out, as the MDX source does not carry them). It lets the core tests compare
 * the renderers for any site config; the real block components are compared in `@monti-cms/blocks`.
 */
export const stubComponents = (): { mdxComponents: MdxComponents; documentComponents: DocumentComponents } => {
	const mdxComponents: MdxComponents = {};
	const blocks: Record<string, ComponentType<never>> = {};
	const marks: Record<string, ComponentType<never>> = {};
	const reserved = new Set(["children", "items", "node", "blockId", "ctx"]);
	for (const block of ADDED_BLOCKS) {
		const Tag = block.syntax.kind === "text" ? "span" : "div";
		const Stub = (props: Record<string, unknown>) => {
			const data: Record<string, string> = { "data-stub": block.name };
			for (const [name, value] of Object.entries(props)) {
				if (reserved.has(name)) continue;
				const attribute = block.attributes[name];
				if (value === undefined || value === false || value === "" || value === attribute?.defaultValue) continue;
				data[`data-${name}`] = value === true ? "" : String(value);
			}
			return <Tag {...data}>{props.children as ReactNode}</Tag>;
		};
		mdxComponents[block.component] = Stub;
		(block.syntax.kind === "text" ? marks : blocks)[block.name] = Stub as ComponentType<never>;
	}
	// The code tag `Tooltip` (one component serves the mark and the tag in the MDX table); the tag also gets the note number.
	const Tooltip = ({ children, content, note }: { children?: ReactNode; content?: string; note?: string }) => (
		<span data-stub="tooltip" data-content={content} data-note={note}>
			{children}
		</span>
	);
	mdxComponents.Tooltip = Tooltip;
	marks.tooltip = Tooltip as ComponentType<never>;
	return {
		mdxComponents,
		documentComponents: { blocks, marks, codeTags: { Tooltip } } as unknown as DocumentComponents,
	};
};
