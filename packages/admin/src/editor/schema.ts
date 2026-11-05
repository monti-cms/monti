import { type AnyExtension, Mark, Node } from "@tiptap/core";
import { Bold } from "@tiptap/extension-bold";
import { Code } from "@tiptap/extension-code";
import { Document } from "@tiptap/extension-document";
import { HardBreak } from "@tiptap/extension-hard-break";
import { Italic } from "@tiptap/extension-italic";
import { Link } from "@tiptap/extension-link";
import { Strike } from "@tiptap/extension-strike";
import { Subscript } from "@tiptap/extension-subscript";
import { Superscript } from "@tiptap/extension-superscript";
import { Text } from "@tiptap/extension-text";
import { Underline } from "@tiptap/extension-underline";
import type { DOMOutputSpec } from "@tiptap/pm/model";
import type { Catalog, CatalogBlock } from "./catalog";

/** The editor's node for a block type: a block type may hold `:` or `-` (`component:PostCard`), an editor name may not. */
export const nodeName = (type: string) => type.replace(/[^A-Za-z0-9_]/g, "_");

/** A block whose type the site no longer defines: kept whole in one attr, drawn as a box, never changed (doc 03, 03-5). */
export const UNKNOWN = "unknownBlock";
/** A mark the site no longer defines, kept whole on its text. */
export const KEPT_MARK = "keptMark";

/** The core marks whose editor name differs from their stored name. */
export const MARK_NAMES: Record<string, string> = { sup: "superscript", sub: "subscript" };
export const markName = (type: string) => MARK_NAMES[type] ?? type;
export const markType = (name: string) => Object.entries(MARK_NAMES).find(([, editor]) => editor === name)?.[0] ?? name;

/** Every block node carries its block's id and its attrs. Neither is drawn into the page, so a copied block never brings its id along. */
const blockAttributes = () => ({
	blockId: { default: null, keepOnSplit: false, rendered: false },
	data: { default: null, rendered: false },
});

type Data = Record<string, unknown> | null;

/** A paragraph's or heading's alignment, for `EditorBody` to draw (`data-align`); left is the default and adds nothing. */
const aligned = (data: Data): Record<string, string> =>
	data?.align === "center" || data?.align === "right" ? { "data-align": String(data.align) } : {};

/** An element's own alignment when it is pasted in. */
const alignOf = (element: HTMLElement) => {
	const align = element.style.textAlign || element.getAttribute("data-align");
	return align === "center" || align === "right" ? align : undefined;
};

/** The element a block is drawn as. `EditorBody` gives these their looks; a block the editor shows but does not edit is a box with its name. */
function draw(block: CatalogBlock, data: Data, boxLabel: (block: CatalogBlock, data: Data) => string): DOMOutputSpec {
	switch (block.type) {
		case "paragraph":
			return ["p", aligned(data), 0];
		case "heading":
			return [`h${Number(data?.level ?? 2)}`, aligned(data), 0];
		case "bulletList":
			return ["ul", 0];
		case "orderedList":
			return ["ol", data?.start === undefined ? {} : { start: String(data.start) }, 0];
		case "checklist":
			return ["ul", { "data-checklist": "" }, 0];
		case "listItem":
			return ["li", data?.checked ? { "data-checked": "" } : {}, 0];
		case "quote":
			return ["blockquote", 0];
		case "codeBlock":
			return ["pre", data?.language ? { "data-language": String(data.language) } : {}, ["code", 0]];
		case "divider":
			return ["div", ["hr"]];
		case "table": {
			const rows = (data?.rows as string[][] | undefined) ?? [];
			return [
				"table",
				[
					"tbody",
					...rows.map(
						(row, index) =>
							["tr", ...row.map((cell) => [data?.header && index === 0 ? "th" : "td", cell])] as DOMOutputSpec,
					),
				],
			];
		}
		case "footnote":
			return ["div", { "data-footnote": String(data?.id ?? "") }, 0];
	}
	if (block.holds === "nothing") return ["div", { "data-box": "", "data-box-label": boxLabel(block, data) }];
	return ["div", { "data-block": block.type }, 0];
}

/** How a pasted element becomes a block: the core's plain HTML, and any block by its `data-block`. */
function parse(block: CatalogBlock) {
	const own = [{ tag: `div[data-block="${block.type}"]` }];
	switch (block.type) {
		case "paragraph":
			return [
				{
					tag: "p",
					getAttrs: (element: HTMLElement) => {
						const align = alignOf(element);
						return { data: align ? { align } : null };
					},
				},
			];
		case "heading":
			return [1, 2, 3, 4, 5, 6].map((level) => ({
				tag: `h${level}`,
				getAttrs: (element: HTMLElement) => {
					const align = alignOf(element);
					return { data: { level: Math.min(4, Math.max(2, level)), ...(align ? { align } : {}) } };
				},
			}));
		case "bulletList":
			return [{ tag: "ul" }];
		case "checklist":
			return [{ tag: "ul[data-checklist]", priority: 60 }];
		case "orderedList":
			return [
				{
					tag: "ol",
					getAttrs: (element: HTMLElement) => {
						const start = Number(element.getAttribute("start") ?? 1);
						return { data: start === 1 ? null : { start } };
					},
				},
			];
		case "listItem":
			return [
				{
					tag: "li",
					getAttrs: (element: HTMLElement) => ({
						data: element.hasAttribute("data-checked") ? { checked: true } : null,
					}),
				},
			];
		case "quote":
			return [{ tag: "blockquote" }];
		case "codeBlock":
			return [{ tag: "pre", preserveWhitespace: "full" as const }];
		case "divider":
			return [{ tag: "hr" }];
	}
	return own;
}

/**
 * The editor's schema, made from the site's blocks and marks (doc 03, principle 3): one node per block type, the core marks, and a keeper each
 * for blocks and marks the site no longer defines. A block that only another block holds (a list item) is not offered at the top.
 */
export function bodyExtensions(kit: Catalog, boxLabel: (block: CatalogBlock, data: Data) => string): AnyExtension[] {
	const heldOnly = new Set(
		kit.blocks
			.flatMap((block) => block.children ?? [])
			.filter((type) => !kit.blocks.find((each) => each.type === type)?.menu),
	);
	const nodes = kit.blocks.map((block) =>
		Node.create({
			name: nodeName(block.type),
			group: heldOnly.has(block.type) ? "held" : "block",
			content:
				block.holds === "text"
					? block.type === "codeBlock"
						? "text*"
						: "inline*"
					: block.holds === "blocks"
						? block.children
							? `(${block.children.map(nodeName).join(" | ")})+`
							: "block+"
						: undefined,
			marks: block.type === "codeBlock" ? "" : undefined,
			code: block.type === "codeBlock",
			atom: block.holds === "nothing",
			selectable: block.holds === "nothing",
			defining: block.holds === "text" && block.type !== "paragraph",
			isolating: block.holds === "nothing",
			addAttributes: blockAttributes,
			parseHTML: () => parse(block),
			renderHTML: ({ node }) => draw(block, node.attrs.data as Data, boxLabel),
		}),
	);
	const unknown = Node.create({
		name: UNKNOWN,
		group: "block",
		atom: true,
		selectable: true,
		addAttributes: () => ({ ...blockAttributes(), block: { default: null, rendered: false } }),
		renderHTML: ({ node }) => [
			"div",
			{
				"data-box": "",
				"data-box-label": boxLabel({ type: String(node.attrs.block?.type ?? "") } as CatalogBlock, null),
			},
		],
	});
	const footnoteRef = Node.create({
		name: "footnoteRef",
		group: "inline",
		inline: true,
		atom: true,
		addAttributes: () => ({ id: { default: null, rendered: false } }),
		parseHTML: () => [{ tag: "sup[data-footnote-ref]" }],
		renderHTML: ({ node }) => ["sup", { "data-footnote-ref": String(node.attrs.id ?? "") }, "*"],
	});
	const kept = Mark.create({
		name: KEPT_MARK,
		addAttributes: () => ({ mark: { default: null, rendered: false } }),
		renderHTML: () => ["span", { "data-mark": "" }, 0],
	});
	return [
		Document.extend({ content: "block+" }),
		Text,
		HardBreak,
		...nodes,
		unknown,
		footnoteRef,
		Bold,
		Italic,
		Underline,
		Strike,
		Code,
		Link.configure({ openOnClick: false, autolink: false, linkOnPaste: true }),
		Superscript,
		Subscript,
		kept,
	];
}
