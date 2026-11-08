import type { Block, Doc, Inline, Mark } from "@monti-cms/core";
import type { JSONContent } from "@tiptap/core";
import type { Catalog, CatalogBlock } from "./catalog";
import { KEPT_MARK, markName, markType, nodeName, UNKNOWN } from "./schema";
import { tableFromEditor, tableToEditor } from "./table";

type MarkJson = { type: string; attrs?: Record<string, unknown> };

const markToEditor = (mark: Mark, kit: Catalog): MarkJson => {
	const { type, ...attrs } = mark;
	const name = markName(type);
	if (!kit.marks.some((definition) => definition.type === type)) return { type: KEPT_MARK, attrs: { mark } };
	return Object.keys(attrs).length > 0 ? { type: name, attrs } : { type: name };
};

const markFromEditor = (mark: MarkJson, kit: Catalog): Mark => {
	if (mark.type === KEPT_MARK) return mark.attrs?.mark as Mark;
	// A link keeps only its address; the editor's own attrs (target, rel, class) are not stored.
	if (mark.type === "link") return { type: "link", href: String(mark.attrs?.href ?? "") };
	const attrs = Object.fromEntries(Object.entries(mark.attrs ?? {}).filter(([, value]) => value !== null));
	return { type: markType(mark.type, kit), ...attrs };
};

const inlineToEditor = (inline: Inline, kit: Catalog): JSONContent | null => {
	if (inline.type === "hardBreak") return { type: "hardBreak" };
	if (inline.type === "footnoteRef") return { type: "footnoteRef", attrs: { id: inline.id } };
	if (inline.text === "") return null;
	return {
		type: "text",
		text: inline.text,
		...(inline.marks?.length ? { marks: inline.marks.map((mark) => markToEditor(mark, kit)) } : {}),
	};
};

const inlineFromEditor = (node: JSONContent, kit: Catalog): Inline | null => {
	if (node.type === "hardBreak") return { type: "hardBreak" };
	if (node.type === "footnoteRef") return { type: "footnoteRef", id: String(node.attrs?.id ?? "") };
	if (node.type !== "text" || !node.text) return null;
	const marks = (node.marks ?? []).map((mark) => markFromEditor(mark as MarkJson, kit));
	return { type: "text", text: node.text, ...(marks.length ? { marks } : {}) };
};

/**
 * A stored body as the editor holds it (doc 03). Each block keeps its id; a block the site does not define is kept whole. `fresh` drops the ids, so a
 * template put into a body gets new ones (decisions: a template's blocks are new blocks).
 */
export function docToEditor(doc: Doc, kit: Catalog, { fresh = false } = {}): JSONContent {
	const byType = new Map(kit.blocks.map((block) => [block.type, block]));
	const toEditor = (block: Block): JSONContent => {
		const id = fresh ? null : block.id;
		const definition = byType.get(block.type);
		if (!definition) return { type: UNKNOWN, attrs: { blockId: id, block } };
		if (block.type === "table") return tableToEditor(block, id);
		// A translation's link goes along so the editor can draw the block's state; the core keeps the link itself on save (doc 04).
		const node: JSONContent = {
			type: nodeName(block.type),
			attrs: { blockId: id, data: block.attrs ?? null, link: fresh ? null : (block.link ?? null) },
		};
		if (definition.holds === "text") {
			const content = (block.content ?? [])
				.map((inline) => inlineToEditor(inline, kit))
				.filter((each) => each !== null);
			if (content.length) node.content = content;
		} else if (definition.holds === "blocks") {
			const children = (block.children ?? []).map(toEditor);
			node.content = children.length ? children : [emptyChild(definition, byType)];
		}
		return node;
	};
	const blocks = footnotesLast(doc.blocks).map(toEditor);
	return { type: "doc", content: blocks.length ? blocks : [{ type: "paragraph" }] };
}

/**
 * The footnotes at the end, in the order their references come in the text, as the editor keeps them (`footnotes.ts`). A body written elsewhere (an
 * assistant's edit, an import) may have them anywhere.
 */
function footnotesLast(blocks: Block[]): Block[] {
	const order: string[] = [];
	const visit = (list: Block[]) => {
		for (const block of list) {
			if (block.type === "footnote") continue;
			for (const part of block.content ?? [])
				if (part.type === "footnoteRef" && !order.includes(part.id)) order.push(part.id);
			if (block.children) visit(block.children);
		}
	};
	visit(blocks);
	const rank = (block: Block) => {
		const at = order.indexOf(String(block.attrs?.id));
		return at === -1 ? Number.POSITIVE_INFINITY : at;
	};
	const notes = blocks.filter((block) => block.type === "footnote").sort((a, b) => rank(a) - rank(b));
	return notes.length ? [...blocks.filter((block) => block.type !== "footnote"), ...notes] : blocks;
}

/** A block that holds blocks needs one: an empty item of the first kind it takes. */
const emptyChild = (block: CatalogBlock, byType: Map<string, CatalogBlock>): JSONContent => {
	const type = block.children?.[0] ?? "paragraph";
	const child = byType.get(type);
	return child?.holds === "blocks"
		? { type: nodeName(type), content: [emptyChild(child, byType)] }
		: { type: nodeName(type) };
};

/** What is stored of the editor's blocks: a file still on its way up is not in the body until the library has it (doc 09). */
const stored = (nodes: JSONContent[]) => nodes.filter((node) => !node.attrs?.upload);

/** The editor's body as it is stored. A body that is one empty paragraph is an empty body. */
export function docFromEditor(json: JSONContent, kit: Catalog): Doc {
	const byName = new Map(kit.blocks.map((block) => [nodeName(block.type), block]));
	const fromEditor = (node: JSONContent): Block => {
		if (node.type === UNKNOWN) return node.attrs?.block as Block;
		if (node.type === "table") return tableFromEditor(node);
		const definition = byName.get(node.type ?? "");
		const data = node.attrs?.data as Record<string, unknown> | null | undefined;
		const block: Block = { id: String(node.attrs?.blockId ?? ""), type: definition?.type ?? String(node.type) };
		if (data && Object.keys(data).length) block.attrs = data;
		const link = node.attrs?.link as Block["link"] | null | undefined;
		if (link) block.link = link;
		if (definition?.holds === "text") {
			const content = (node.content ?? [])
				.map((inline) => inlineFromEditor(inline, kit))
				.filter((each) => each !== null);
			if (content.length) block.content = content;
		} else if (definition?.holds === "blocks") block.children = stored(node.content ?? []).map(fromEditor);
		return block;
	};
	const blocks = stored(json.content ?? []).map(fromEditor);
	const only = blocks[0];
	if (blocks.length === 1 && only?.type === "paragraph" && !only.content && !only.attrs)
		return { type: "doc", blocks: [] };
	return { type: "doc", blocks };
}
