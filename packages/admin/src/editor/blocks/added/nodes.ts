import type { BlockDefinition } from "@monti-cms/core/client";
import { mergeAttributes, Node } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { BlockNodeView } from "../block-node-view";
import { ADDED_NODE_BLOCKS, blockNodeName, childBlocksOf, isContainer, isFence } from "./shared";

const parseJson = (value: string | null, fallback: unknown) => {
	try {
		return value ? JSON.parse(value) : fallback;
	} catch {
		return fallback;
	}
};

/** Node content expression built from the child block rules (e.g. `cmsTab{2,8}`). */
const childContent = (block: BlockDefinition, all: readonly BlockDefinition[]) => {
	const names = childBlocksOf(block, all).map(blockNodeName);
	if (names.length === 0) return "block+";
	const min = block.children?.min ?? 1;
	const max = block.children?.max;
	const choice = names.length === 1 ? names[0] : `(${names.join(" | ")})`;
	return `${choice}{${min},${max ?? ""}}`;
};

/** Code fence block node. The code is `value`; the fence language and meta are preserved as is. */
function createFenceNode(block: BlockDefinition & { syntax: { kind: "fence"; lang: string } }): Node {
	return Node.create({
		name: blockNodeName(block),
		group: "block",
		atom: true,
		draggable: true,
		selectable: true,
		addAttributes() {
			return { value: { default: "" }, meta: { default: "" }, language: { default: block.syntax.lang } };
		},
		parseHTML() {
			return [{ tag: `div[data-cms-fence="${block.syntax.lang}"]` }];
		},
		renderHTML({ HTMLAttributes }) {
			return ["div", mergeAttributes(HTMLAttributes, { "data-cms-fence": block.syntax.lang })];
		},
		addNodeView() {
			return ReactNodeViewRenderer(BlockNodeView);
		},
	});
}

/**
 * Tiptap node for a single added block. A container holds body content (or fixed child blocks); single-line blocks and code fence blocks are selected
 * as a whole. The edit view is chosen by `BlockNodeView`.
 */
export function createAddedBlockNode(block: BlockDefinition, all: readonly BlockDefinition[]): Node {
	if (isFence(block)) return createFenceNode(block as BlockDefinition & { syntax: { kind: "fence"; lang: string } });
	const content = isContainer(block) ? childContent(block, all) : undefined;
	return Node.create({
		name: blockNodeName(block),
		// Parent-only blocks are placed only inside their parent.
		...(block.parent ? {} : { group: "block" }),
		...(content ? { content, isolating: true } : { atom: true }),
		selectable: true,
		// Dragged via the handle overlay. It does not compete with body selection.
		draggable: false,
		addAttributes() {
			return {
				values: {
					default: {},
					parseHTML: (element) => parseJson(element.getAttribute("data-cms-values"), {}),
					renderHTML: (attributes) => ({ "data-cms-values": JSON.stringify(attributes.values ?? {}) }),
				},
				originalAttributes: {
					default: [],
					parseHTML: (element) => parseJson(element.getAttribute("data-cms-original-attributes"), []),
					renderHTML: (attributes) => ({
						"data-cms-original-attributes": JSON.stringify(attributes.originalAttributes ?? []),
					}),
				},
			};
		},
		parseHTML() {
			return [{ tag: `div[data-cms-block="${block.name}"]` }];
		},
		renderHTML({ HTMLAttributes }) {
			return content
				? ["div", mergeAttributes(HTMLAttributes, { "data-cms-block": block.name }), 0]
				: ["div", mergeAttributes(HTMLAttributes, { "data-cms-block": block.name })];
		},
		addNodeView() {
			return ReactNodeViewRenderer(BlockNodeView);
		},
	});
}

/** All added block nodes. */
export const ADDED_BLOCK_NODES: readonly Node[] = ADDED_NODE_BLOCKS.map((block) =>
	createAddedBlockNode(block, ADDED_NODE_BLOCKS),
);
