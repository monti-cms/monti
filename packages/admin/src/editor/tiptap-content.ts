import { perSite, type Site } from "@monti-cms/core/client";
import type { CmsJsonValue, CmsMark, CmsNode, StoredDocument } from "@monti-cms/core/document";
import {
	TEXT_ALIGN_VALUES as ALIGN_VALUES,
	canonicalDocument,
	entryIdOfMark,
	isBlockId,
	STORED_DOCUMENT_VERSION,
	UNPARSED_NODE,
} from "@monti-cms/core/document";
import type { JSONContent } from "@tiptap/core";
import { addedMarkByEditorName, addedMarkName, addedMarksOf, markAttrsOf } from "./added-marks";
import { BLOCK_ID_ATTRIBUTE } from "./block-ids";
import { parentOnlyTypes } from "./blocks/added";
import { type ConverterContext, converterForCms, converterForTiptap } from "./converters";
import { asNumber, asString, lineBreakNode } from "./converters/shared";
import { editorMessages } from "./messages";

/**
 * Stored document <-> Tiptap JSONContent conversion. This is the visual editor's load/save path, and it works on the stored document directly: no notation
 * (MDX or any other) is involved.
 *
 * - Load: `StoredDocument` → `storedToTiptap` → Tiptap JSON.
 * - Save: Tiptap `getJSON()` → `tiptapToStored` → `StoredDocument`.
 *
 * Neither direction **drops data.** Blocks missing from the Tiptap schema (merged-cell tables with block content, blocks without an edit view, nodes only a
 * notation can describe, a body that could not be read) are kept as a read-only box holding the stored node in `cmsOpaqueBlock` (nodes are never silently
 * deleted). A block is either entirely native or entirely a box: part of a box is never lost.
 */

export const OPAQUE_BLOCK_NAME = "cmsOpaqueBlock";

/** Stored node type of the alignment container (the `text-align` block): one paragraph or heading with its alignment. */
const TEXT_ALIGN_NODE = "text-align";

/** Marks Tiptap can carry as-is. Added text styles (block extensions) are carried as marks built from the definition (`added-marks.ts`). */
const NATIVE_MARKS = new Set([
	"bold",
	"italic",
	"strike",
	"code",
	"link",
	"underline",
	"superscript",
	"subscript",
	// Translation notice text. It has no attributes, so it passes through by name.
	"untranslated",
]);

const TEXT_ALIGN_VALUES: ReadonlySet<string> = new Set(ALIGN_VALUES);

/** The first node of a list, for a container that holds exactly one. */
const onlyChild = (node: CmsNode): CmsNode | undefined => (node.content?.length === 1 ? node.content[0] : undefined);

/** Writes a node as text for the box that shows it (the registered source format), or gives `""` for the box to show the node as JSON. */
export type BoxPreview = (node: CmsNode) => string;

/** The box preview for a format: the node as a one-block document written in it. A node the format cannot write is shown as JSON. */
export const boxPreviewOf =
	(format: { export(doc: StoredDocument): string } | undefined): BoxPreview | undefined =>
	(node) => {
		if (!format) return "";
		try {
			return format.export({ type: "doc", version: STORED_DOCUMENT_VERSION, content: [node] }).trim();
		} catch {
			return "";
		}
	};

/** The conversions of a site: the blocks and text styles it added take part in them. The same functions for the same site. */
const conversionsOf = perSite((site: Site) => {
	const t = site.createTranslator(editorMessages);
	const MAPPABLE_MARKS = new Set([...NATIVE_MARKS, ...addedMarksOf(site).keys()]);
	let previewWriter: BoxPreview | undefined;

	/** Wraps a subtree in a box. `node` is the stored node as JSON (read back as it is on save), so nothing the box holds is lost. */
	const toOpaque = (node: CmsNode): JSONContent => {
		const preview = previewWriter && node.type !== UNPARSED_NODE ? previewWriter(node) : "";
		const named = typeof node.attrs?.name === "string" && node.attrs.name.length > 0 ? node.attrs.name : node.type;
		return { type: OPAQUE_BLOCK_NAME, attrs: { node: JSON.stringify(node), label: named, preview } };
	};

	const isMappableInline = (node: CmsNode): boolean => {
		if (node.type === "text") return (node.marks ?? []).every((mark) => MAPPABLE_MARKS.has(mark.type));
		if (node.type === "hardBreak") return true;
		if (node.type === "footnoteReference") return true;
		// Images, math, and other blocks cannot sit inline, so the whole block goes into a box.
		return false;
	};

	/** Unordered list where every item is `- [ ]`/`- [x]`. */
	const isTaskList = (node: CmsNode): boolean => {
		const items = node.content ?? [];
		return (
			node.type === "bulletList" &&
			items.length > 0 &&
			items.every(
				(item) =>
					item.type === "listItem" &&
					typeof item.attrs?.checked === "boolean" &&
					(item.content ?? []).every((child) => isMappableBlock(child)),
			)
		);
	};

	const isMappableBlock = (node: CmsNode): boolean => {
		// Parent-only blocks (a single tab or column) are invalid outside their parent. The parent converter validates its children directly.
		if (parentOnlyTypes(site).has(node.type)) return false;
		const converter = converterForCms(site, node.type, node);
		if (converter) return converter.isMappable(node, context);
		switch (node.type) {
			case "paragraph":
			case "heading":
				return (node.content ?? []).every(isMappableInline);
			case "blockquote":
			case "orderedList":
				return (node.content ?? []).every(isMappableBlock);
			case "bulletList":
				// If every item is a task item, edit it as a Tiptap task list. Mixed lists are kept as a box.
				return isTaskList(node) || (node.content ?? []).every(isMappableBlock);
			case "listItem":
				// Task items are converted only inside a task list (`isTaskList`). Task items in an ordered list are kept as a box.
				if (node.attrs?.checked != null) return false;
				return (node.content ?? []).every(isMappableBlock);
			case "horizontalRule":
				return true;
			case TEXT_ALIGN_NODE: {
				const align = asString(node.attrs?.align);
				const only = onlyChild(node);
				return (
					!!align &&
					TEXT_ALIGN_VALUES.has(align) &&
					!!only &&
					(only.type === "paragraph" || only.type === "heading") &&
					isMappableBlock(only)
				);
			}
			default:
				return false;
		}
	};

	const toTiptapMarks = (marks: CmsMark[] | undefined): JSONContent["marks"] => {
		if (!marks || marks.length === 0) return undefined;
		const out: NonNullable<JSONContent["marks"]> = [];
		for (const mark of marks) {
			const added = addedMarksOf(site).get(mark.type);
			if (added) {
				out.push({ type: addedMarkName(added.name), attrs: markAttrsOf(added, mark.attrs) });
				continue;
			}
			// isMappableInline has filtered these, so every mark here is native.
			if (mark.type === "link") {
				// An internal link is its entry id. The address is not in the document: the editor looks up where it goes (`useEntryLinkTargets`).
				const entryId = entryIdOfMark(mark);
				if (entryId) {
					out.push({ type: "link", attrs: { entryId, href: null } });
					continue;
				}
				const href = asString(mark.attrs?.href) ?? "";
				const title = asString(mark.attrs?.title);
				out.push(title != null ? { type: "link", attrs: { href, title } } : { type: "link", attrs: { href } });
				continue;
			}
			const rest = mark.attrs && Object.keys(mark.attrs).length > 0 ? { attrs: { ...mark.attrs } } : {};
			out.push({ type: mark.type, ...rest });
		}
		return out.length > 0 ? out : undefined;
	};

	const inlineChildren = (nodes: CmsNode[]): JSONContent[] => {
		const out: JSONContent[] = [];
		for (const node of nodes) {
			if (node.type === "text") {
				const marks = toTiptapMarks(node.marks);
				out.push(marks ? { type: "text", text: node.text ?? "", marks } : { type: "text", text: node.text ?? "" });
				continue;
			}
			if (node.type === "hardBreak") {
				out.push({ type: "hardBreak" });
				continue;
			}
			if (node.type === "footnoteReference") {
				out.push({ type: "footnoteReference", attrs: { label: asString(node.attrs?.label) ?? "" } });
				continue;
			}
			// Unreachable because isMappableInline has filtered. A box cannot sit inline,
			// so reaching this means the parent block decision was wrong — surface it instead of passing silently.
			throw new Error(t("tiptapContent.unmappableInline", { type: node.type }));
		}
		return out;
	};

	const withTextAlign = (align: string | undefined, content: JSONContent): JSONContent => {
		if (align && TEXT_ALIGN_VALUES.has(align)) {
			content.attrs = { ...(content.attrs ?? {}), textAlign: align };
		}
		return content;
	};

	/**
	 * A block with its id (`CmsNode.id` → the editor's `blockId`). A block that already has one keeps it: an alignment box becomes its paragraph,
	 * and the paragraph's own id is the one the editor keeps (the box's id is paired up again by the server).
	 */
	const blockToTiptap = (node: CmsNode): JSONContent => {
		const converted = convertBlockToTiptap(node);
		if (node.id !== undefined && converted.attrs?.[BLOCK_ID_ATTRIBUTE] == null) {
			converted.attrs = { ...(converted.attrs ?? {}), [BLOCK_ID_ATTRIBUTE]: node.id };
		}
		return converted;
	};

	const convertBlockToTiptap = (node: CmsNode): JSONContent => {
		if (!isMappableBlock(node)) return toOpaque(node);
		const converter = converterForCms(site, node.type, node);
		if (converter) return converter.toTiptap(node, context);
		switch (node.type) {
			case "paragraph":
				return { type: "paragraph", content: inlineChildren(node.content ?? []) };
			case "heading": {
				const level = asNumber(node.attrs?.level) ?? 2;
				return { type: "heading", attrs: { level }, content: inlineChildren(node.content ?? []) };
			}
			case "blockquote":
				return { type: "blockquote", content: (node.content ?? []).map(blockToTiptap) };
			case "bulletList":
				if (isTaskList(node)) {
					return {
						type: "taskList",
						content: (node.content ?? []).map((item) => ({
							type: "taskItem",
							attrs: { checked: item.attrs?.checked === true },
							content: (item.content ?? []).map(blockToTiptap),
						})),
					};
				}
				return { type: "bulletList", content: (node.content ?? []).map(blockToTiptap) };
			case "orderedList": {
				const start = asNumber(node.attrs?.start);
				return {
					type: "orderedList",
					...(start != null && start !== 1 ? { attrs: { start } } : {}),
					content: (node.content ?? []).map(blockToTiptap),
				};
			}
			case "listItem":
				return { type: "listItem", content: (node.content ?? []).map(blockToTiptap) };
			case "horizontalRule":
				return { type: "horizontalRule" };
			case TEXT_ALIGN_NODE: {
				const child = onlyChild(node) as CmsNode;
				return withTextAlign(asString(node.attrs?.align), blockToTiptap(child));
			}
			default:
				return toOpaque(node);
		}
	};

	/** A stored document → Tiptap JSON, with its block ids. Converts what it can; a body that could not be read stays a box holding it. */
	const storedToTiptap = (doc: StoredDocument, options: { boxPreview?: BoxPreview } = {}): JSONContent => {
		previewWriter = options.boxPreview;
		try {
			return {
				type: "doc",
				content: doc.content.map((block) => {
					try {
						return blockToTiptap(block);
					} catch {
						// Even on a mapping bug the body is not dropped — keeping it as a box makes saving exact.
						return toOpaque(block);
					}
				}),
			};
		} finally {
			previewWriter = undefined;
		}
	};

	const tiptapMarksToStored = (marks: JSONContent["marks"]): CmsMark[] => {
		const out: CmsMark[] = [];
		for (const mark of marks ?? []) {
			if (!mark || typeof mark.type !== "string") continue;
			const added = addedMarkByEditorName(site).get(mark.type);
			if (added) {
				const attrs = markAttrsOf(added, mark.attrs);
				out.push(Object.keys(attrs).length > 0 ? { type: added.name, attrs } : { type: added.name });
				continue;
			}
			if (mark.type === "link") {
				// The `href` of an entry link is only what the editor shows (the address of the entry); the document holds the id alone.
				const entryId = asString(mark.attrs?.entryId);
				if (entryId) {
					out.push({ type: "link", attrs: { entryId } });
					continue;
				}
				const href = asString(mark.attrs?.href) ?? "";
				const title = asString(mark.attrs?.title);
				out.push(title ? { type: "link", attrs: { href, title } } : { type: "link", attrs: { href } });
				continue;
			}
			// Marks outside the Tiptap schema cannot appear in getJSON (defensive: dropped).
			if (NATIVE_MARKS.has(mark.type)) out.push({ type: mark.type });
		}
		return site.sortMarks(out);
	};

	const tiptapInlineToStored = (nodes: JSONContent[] | undefined): CmsNode[] => {
		const out: CmsNode[] = [];
		for (const node of nodes ?? []) {
			if (!node || typeof node.type !== "string") continue;
			if (node.type === "text") {
				const text: CmsNode = { type: "text", text: node.text ?? "" };
				const marks = tiptapMarksToStored(node.marks);
				if (marks.length > 0) text.marks = marks;
				out.push(text);
				continue;
			}
			if (node.type === "hardBreak") {
				out.push(lineBreakNode());
				continue;
			}
			if (node.type === "footnoteReference") {
				out.push({ type: "footnoteReference", attrs: { label: asString(node.attrs?.label) ?? "" } });
				continue;
			}
			if (node.type === "image") {
				// An image inside text is inline: only blocks carry ids.
				out.push(...tiptapBlockToStored(node).map(({ id: _id, ...inline }) => inline));
			}
			// Inlines outside the schema cannot appear in getJSON (defensive: dropped).
		}
		return out;
	};

	/** The stored node a box holds, or none when its content cannot be read (it is not dropped silently by a throw: an unreadable box is an empty one). */
	const opaqueNode = (json: string): CmsNode | undefined => {
		try {
			const parsed: unknown = JSON.parse(json);
			return typeof parsed === "object" && parsed !== null && typeof (parsed as CmsNode).type === "string"
				? (parsed as CmsNode)
				: undefined;
		} catch {
			return undefined;
		}
	};

	/** A block back with its id (the editor's `blockId` → `CmsNode.id`) on the first node it becomes. */
	const tiptapBlockToStored = (node: JSONContent): CmsNode[] => {
		const converted = convertTiptapBlock(node);
		const id = node?.attrs?.[BLOCK_ID_ATTRIBUTE];
		const first = converted[0];
		// A box holds its node with the id it had when loaded; the editor's id is the current one (a copy of the box gets a new one).
		if (first && isBlockId(id) && (first.id === undefined || node.type === OPAQUE_BLOCK_NAME)) {
			converted[0] = { ...first, id };
		}
		return converted;
	};

	const convertTiptapBlock = (node: JSONContent): CmsNode[] => {
		if (!node || typeof node.type !== "string") return [];
		const converter = converterForTiptap(site, node.type);
		if (converter) return converter.toCms(node, context);
		switch (node.type) {
			case "paragraph":
			case "text": {
				const block: CmsNode =
					node.type === "text"
						? { type: "text", text: node.text ?? "" }
						: { type: "paragraph", content: tiptapInlineToStored(node.content) };
				if (node.type === "paragraph") {
					const align = asString(node.attrs?.textAlign);
					if (align && TEXT_ALIGN_VALUES.has(align)) {
						return [{ type: TEXT_ALIGN_NODE, attrs: { align }, content: [block] }];
					}
				}
				return [block];
			}
			case "heading": {
				const block: CmsNode = {
					type: "heading",
					attrs: { level: asNumber(node.attrs?.level) ?? 2 },
					content: tiptapInlineToStored(node.content),
				};
				const align = asString(node.attrs?.textAlign);
				if (align && TEXT_ALIGN_VALUES.has(align)) {
					return [{ type: TEXT_ALIGN_NODE, attrs: { align }, content: [block] }];
				}
				return [block];
			}
			case "blockquote":
			case "bulletList":
			case "orderedList":
			case "listItem": {
				const children = (node.content ?? []).flatMap(tiptapBlockToStored);
				if (node.type === "blockquote") return [{ type: "blockquote", content: children }];
				if (node.type === "bulletList") return [{ type: "bulletList", content: children }];
				if (node.type === "listItem") return [{ type: "listItem", content: children }];
				const start = asNumber(node.attrs?.start);
				return [
					start != null && start !== 1
						? { type: "orderedList", attrs: { start }, content: children }
						: { type: "orderedList", content: children },
				];
			}
			case "taskList":
				return [
					{
						type: "bulletList",
						content: (node.content ?? []).map((item) => ({
							type: "listItem",
							attrs: { checked: item.attrs?.checked === true },
							content: (item.content ?? []).flatMap(tiptapBlockToStored),
						})),
					},
				];
			case "horizontalRule":
				return [{ type: "horizontalRule" }];
			case "hardBreak":
				// Not reachable from `getJSON` (a break sits inside a paragraph); kept as a paragraph holding it rather than dropped.
				return [{ type: "paragraph", content: [lineBreakNode()] }];
			case OPAQUE_BLOCK_NAME: {
				const held = opaqueNode(asString(node.attrs?.node) ?? "");
				return held ? [structuredClone(held)] : [];
			}
			default:
				// Nodes outside the Tiptap schema cannot appear in getJSON (defensive: dropped).
				return [];
		}
	};

	/** Recursive conversion functions passed to the converter registry (`./converters`). Placed after the function declarations, but calls happen at run time so this is safe. */
	const context: ConverterContext = {
		site,
		blockToTiptap: (node) => blockToTiptap(node),
		tiptapBlockToCms: (node) => tiptapBlockToStored(node),
		isMappableBlock: (node) => isMappableBlock(node),
		isMappableInline: (node) => isMappableInline(node),
		inlineToTiptap: (nodes) => inlineChildren(nodes),
		inlineToCms: (nodes) => tiptapInlineToStored(nodes),
	};

	/** The same value with its object keys sorted at every depth and no `undefined` members, as a stored document keeps them (the same body is the same JSON wherever it was stored). */
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

	/** A node with its keys in the stored order and no empty `attrs`, `marks` or `content`-less leftovers. */
	const storedNode = (node: CmsNode): CmsNode => {
		const out = {} as CmsNode;
		if (node.attrs && Object.keys(node.attrs).length > 0)
			out.attrs = sortJson(node.attrs) as Record<string, CmsJsonValue>;
		if (node.content) out.content = node.content.map(storedNode);
		if (node.id !== undefined) out.id = node.id;
		if (node.marks && node.marks.length > 0) {
			out.marks = node.marks.map((mark) => {
				const attrs = mark.attrs && Object.keys(mark.attrs).length > 0 ? sortJson(mark.attrs) : undefined;
				return attrs ? { attrs: attrs as Record<string, CmsJsonValue>, type: mark.type } : { type: mark.type };
			});
		}
		if (node.text !== undefined) out.text = node.text;
		out.type = node.type;
		return out;
	};

	/**
	 * Tiptap `getJSON()` → the stored document, with the editor's block ids. It is in the canonical form every body is stored in (sorted keys, merged text runs,
	 * no trailing empty paragraph), so the same content is the same document whether it came from the editor or from the server.
	 */
	const tiptapToStored = (content: JSONContent): StoredDocument => {
		const children = Array.isArray(content?.content) ? content.content : [];
		return canonicalDocument(site, {
			type: "doc",
			version: STORED_DOCUMENT_VERSION,
			content: children.flatMap(tiptapBlockToStored).map(storedNode),
		});
	};

	return { storedToTiptap, tiptapToStored };
});

/** A stored document → Tiptap JSON, with its block ids. Converts what it can; a body that could not be read stays a box holding it. */
export const storedToTiptap = (
	site: Site,
	doc: StoredDocument,
	options: { boxPreview?: BoxPreview } = {},
): JSONContent => conversionsOf(site).storedToTiptap(doc, options);

/**
 * Tiptap `getJSON()` → the stored document, with the editor's block ids. It is in the canonical form every body is stored in (sorted keys, merged text runs,
 * no trailing empty paragraph), so the same content is the same document whether it came from the editor or from the server.
 */
export const tiptapToStored = (site: Site, content: JSONContent): StoredDocument =>
	conversionsOf(site).tiptapToStored(content);
