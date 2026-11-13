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
import { NodeViewContent, NodeViewWrapper, type ReactNodeViewProps, ReactNodeViewRenderer } from "@tiptap/react";
import { type ComponentType, createElement, Suspense } from "react";
import type { AdminBlockComponent, AdminBlockDefinition } from "../operations/admin-context";
import { BlockPlaceProvider } from "./block-api";
import type { Catalog, CatalogBlock } from "./catalog";
import { ENTRY_LINK } from "./link-targets";
import { tableExtensions } from "./table";
import { TranslationBlocks } from "./translation";

/** The editor's node for a block type: a block type may hold `:` or `-` (`component:PostCard`), an editor name may not. */
export const nodeName = (type: string) => type.replace(/[^A-Za-z0-9_]/g, "_");

/** A block whose type the site no longer defines: kept whole in one attr, drawn as a box, never changed (doc 03, 03-5). */
export const UNKNOWN = "unknownBlock";
/** A mark the site no longer defines, kept whole on its text. */
export const KEPT_MARK = "keptMark";

/** The core marks whose editor name differs from their stored name. */
export const MARK_NAMES: Record<string, string> = { sup: "superscript", sub: "subscript" };
const CORE_MARKS = new Set(["bold", "italic", "underline", "strike", "code", "link", "sup", "sub"]);
export const markName = (type: string) =>
	MARK_NAMES[type] ?? (CORE_MARKS.has(type) ? type : `monti_${type.replace(/[^A-Za-z0-9_]/g, "_")}`);
export const markType = (name: string, kit?: Catalog) =>
	kit?.marks.find((mark) => markName(mark.type) === name)?.type ??
	Object.entries(MARK_NAMES).find(([, editor]) => editor === name)?.[0] ??
	name;

/** Every block node carries its block's id and its attrs. Neither is drawn into the page, so a copied block never brings its id along. */
const blockAttributes = () => ({
	blockId: { default: null, keepOnSplit: false, rendered: false },
	data: { default: null, rendered: false },
	/** In a translation, the source block it is paired with and what was decided for it (doc 04). A split-off half is a new block, unpaired. */
	link: { default: null, keepOnSplit: false, rendered: false },
	/** A file on its way up: the `useUpload` id of the file this block is waiting for. Such a block is not stored (`docFromEditor`). */
	upload: { default: null, keepOnSplit: false, rendered: false },
});

type Data = Record<string, unknown> | null;

/**
 * Marks the element of a block that is one thing (it holds no text of its own: a picture, a file, a divider, a boxed block). `EditorBody` lets nothing
 * in it be picked as text: Chrome moves a selection whose two ends both stand between such blocks to the first place that takes a caret as soon as the
 * mouse moves, unless what is in them is not text to pick (T134).
 */
const WHOLE = { "data-whole": "" } as const;

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
			return ["div", WHOLE, ["hr"]];
		case "footnote":
			return ["div", { "data-footnote": String(data?.id ?? "") }, 0];
	}
	// A block that holds no text is all in its attrs: copied, it carries its kind and what it holds (which file, its alt text, its crop), so it is pasted
	// as that block. Its id stays behind, as every block's does.
	if (block.holds === "nothing")
		return [
			"div",
			{
				...WHOLE,
				"data-box": "",
				"data-box-label": boxLabel(block, data),
				// With nothing to carry (a file still on its way up), it says no kind either: pasted, it is no block, not an empty one.
				...(data ? { "data-block": block.type, [HELD]: JSON.stringify(data) } : {}),
			},
		];
	return ["div", { "data-block": block.type }, 0];
}

/** Where a copied block that holds no text carries what it holds. */
const HELD = "data-block-attrs";

/** What a pasted block holds, as it was copied: an object, or nothing when the clipboard says anything else. */
function heldOf(element: HTMLElement): Data {
	try {
		const held: unknown = JSON.parse(element.getAttribute(HELD) ?? "null");
		return held !== null && typeof held === "object" && !Array.isArray(held) ? (held as Record<string, unknown>) : null;
	} catch {
		return null;
	}
}

/** How a pasted element becomes a block: the core's plain HTML, and any block by its `data-block`. */
function parse(block: CatalogBlock) {
	const own = [
		block.holds === "nothing"
			? {
					tag: `div[data-block="${block.type}"]`,
					// A block that holds no text and carries nothing is no block: pasted from elsewhere without its attrs, it would be an empty picture.
					getAttrs: (element: HTMLElement) => {
						const data = heldOf(element);
						return data ? { data } : false;
					},
				}
			: { tag: `div[data-block="${block.type}"]` },
	];
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
export function bodyExtensions(
	kit: Catalog,
	boxLabel: (block: CatalogBlock, data: Data) => string,
	definitions: ReadonlyMap<string, AdminBlockDefinition> = new Map(),
	/** How the core's own blocks that hold no text draw in the editor (an image, a file). */
	views: ReadonlyMap<string, ComponentType<ReactNodeViewProps>> = new Map(),
): AnyExtension[] {
	const heldOnly = new Set(
		kit.blocks
			.flatMap((block) => block.children ?? [])
			.filter((type) => !kit.blocks.find((each) => each.type === type)?.menu),
	);
	// The table is Tiptap's own (its rows, cells, and column widths), tied to the stored block by `table.ts`.
	const nodes = kit.blocks
		.filter((block) => block.type !== "table")
		.map((block) => {
			const definition = definitions.get(block.type);
			const Component = definition?.Editor ?? definition?.Site;
			const View = views.get(block.type);
			const whole = block.holds === "nothing" ? { attrs: WHOLE } : {};
			const addNodeView = View
				? () => ReactNodeViewRenderer(View, whole)
				: Component
					? () =>
							ReactNodeViewRenderer((props: ReactNodeViewProps) => {
								const attrs = (props.node.attrs.data as Record<string, unknown> | null) ?? {};
								const drawn = (Drawn: AdminBlockComponent) =>
									createElement(
										Drawn,
										{ block: { id: String(props.node.attrs.blockId ?? ""), type: block.type, attrs }, attrs },
										block.holds === "nothing" ? undefined : createElement(NodeViewContent),
									);
								// A block's own editor view reads and changes its block through `useBlock` (doc 18); it may load later (its
								// folder's `editor.tsx` comes on first use), and until then the site's drawing stands in.
								return createElement(
									NodeViewWrapper,
									{ "data-block": block.type },
									createElement(
										BlockPlaceProvider,
										{
											value: { node: props.node, editor: props.editor, getPos: props.getPos, selected: props.selected },
										},
										createElement(
											Suspense,
											{ fallback: definition?.Site ? drawn(definition.Site) : null },
											drawn(Component),
										),
									),
								);
							}, whole)
					: undefined;
			return Node.create({
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
				// A code block's text takes the code's own marks only (doc 17): what an import brought stays through an edit.
				marks:
					block.type === "codeBlock"
						? kit.marks
								.filter((mark) => mark.inCode)
								.map((mark) => markName(mark.type))
								.join(" ")
						: undefined,
				code: block.type === "codeBlock",
				atom: block.holds === "nothing",
				selectable: block.holds === "nothing",
				defining: block.holds === "text" && block.type !== "paragraph",
				isolating: block.holds === "nothing",
				addAttributes: blockAttributes,
				parseHTML: () => parse(block),
				// A file still on its way up has nothing to carry yet: copied, it is not a block.
				renderHTML: ({ node }) => draw(block, node.attrs.upload ? null : (node.attrs.data as Data), boxLabel),
				...(addNodeView ? { addNodeView } : {}),
			});
		});
	const unknown = Node.create({
		name: UNKNOWN,
		group: "block",
		atom: true,
		selectable: true,
		addAttributes: () => ({ ...blockAttributes(), block: { default: null, rendered: false } }),
		renderHTML: ({ node }) => [
			"div",
			{
				...WHOLE,
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
		// Its number is the order it comes in the text, drawn from `data-n` (`footnotes.ts`).
		renderHTML: ({ node }) => ["sup", { "data-footnote-ref": String(node.attrs.id ?? "") }],
	});
	const kept = Mark.create({
		name: KEPT_MARK,
		addAttributes: () => ({ mark: { default: null, rendered: false } }),
		renderHTML: () => ["span", { "data-mark": "" }, 0],
	});
	const customMarks = kit.marks
		.filter((mark) => !CORE_MARKS.has(mark.type))
		.map((mark) => {
			const attrs = Object.keys(
				mark.attrs && typeof mark.attrs === "object" && "properties" in mark.attrs ? (mark.attrs.properties ?? {}) : {},
			);
			return Mark.create({
				name: markName(mark.type),
				addAttributes: () => Object.fromEntries(attrs.map((attr) => [attr, { default: null, rendered: false }])),
				parseHTML: () => [
					{
						tag: `span[data-monti-mark="${mark.type}"]`,
						getAttrs: (element: HTMLElement) => {
							try {
								return JSON.parse(element.getAttribute("data-monti-attrs") ?? "{}");
							} catch {
								return {};
							}
						},
					},
				],
				// Drawn with the site's look (doc 18): the class `monti-<type>` and each value as `data-<name>` (a colour's `data-color`), as the mark's
				// own stylesheet reads them; a `text` value (a tooltip's) is the words' hover title.
				// The values are not attributes Tiptap renders (each is `rendered: false`), so they are read off the mark itself.
				renderHTML: ({ mark: on }) => {
					const values = Object.fromEntries(
						Object.entries(on.attrs).filter(([, value]) => value !== null && value !== undefined),
					);
					return [
						"span",
						{
							"data-monti-mark": mark.type,
							"data-monti-attrs": JSON.stringify(values),
							class: `monti-${mark.type}`,
							...Object.fromEntries(
								Object.entries(values)
									.filter(([, value]) => typeof value === "string")
									.map(([name, value]) => [`data-${name}`, value]),
							),
							...(typeof values.text === "string" ? { title: values.text } : {}),
						},
						0,
					];
				},
			});
		});
	return [
		Document.extend({ content: "block+" }),
		TranslationBlocks,
		Text,
		HardBreak,
		...nodes,
		...(kit.blocks.some((block) => block.type === "table") ? tableExtensions() : []),
		unknown,
		footnoteRef,
		Bold,
		Italic,
		Underline,
		Strike,
		Code,
		Link.configure({
			openOnClick: false,
			autolink: false,
			linkOnPaste: true,
			// A link to an entry of the site (`monti:entry/<group>`, doc 03) is a link like any address; the mark would drop the unknown scheme.
			protocols: ["monti"],
			isAllowedUri: (url, context) => url.startsWith(ENTRY_LINK) || context.defaultValidate(url),
		}),
		Superscript,
		Subscript,
		...customMarks,
		kept,
	];
}
