import type { BlockDefinition } from "@monti-cms/core/client";
import { mergeAttributes, Node } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { ADDED_NODE_BLOCKS, blockNodeName, childBlocksOf, isContainer, isFence } from "./shared";
import { AddedBlockNodeView } from "./view";

const parseJson = (value: string | null, fallback: unknown) => {
	try {
		return value ? JSON.parse(value) : fallback;
	} catch {
		return fallback;
	}
};

/** 자식 블록 규칙에서 만든 노드 내용 식(예: `cmsTab{2,8}`). */
const childContent = (block: BlockDefinition, all: readonly BlockDefinition[]) => {
	const names = childBlocksOf(block, all).map(blockNodeName);
	if (names.length === 0) return "block+";
	const min = block.children?.min ?? 1;
	const max = block.children?.max;
	const choice = names.length === 1 ? names[0] : `(${names.join(" | ")})`;
	return `${choice}{${min},${max ?? ""}}`;
};

/** 코드 펜스 블록 노드. 코드는 `value`, 펜스 언어와 메타는 그대로 보존한다. */
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
			return ReactNodeViewRenderer(AddedBlockNodeView);
		},
	});
}

/**
 * 더한 블록 하나의 Tiptap 노드. 컨테이너는 본문(또는 정해진 자식 블록)을 담고, 한 줄 블록과 코드 펜스 블록은 통째로
 * 고르는 노드다. 편집 화면은 `AddedBlockNodeView`가 고른다.
 */
export function createAddedBlockNode(block: BlockDefinition, all: readonly BlockDefinition[]): Node {
	if (isFence(block)) return createFenceNode(block as BlockDefinition & { syntax: { kind: "fence"; lang: string } });
	const content = isContainer(block) ? childContent(block, all) : undefined;
	return Node.create({
		name: blockNodeName(block),
		// 부모 전용 블록은 부모 안에만 둔다.
		...(block.parent ? {} : { group: "block" }),
		...(content ? { content, isolating: true } : { atom: true }),
		selectable: true,
		// 핸들 오버레이가 끈다. 본문 선택과 경쟁하지 않는다.
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
			return ReactNodeViewRenderer(AddedBlockNodeView);
		},
	});
}

/** 더한 블록 노드 전부. */
export const ADDED_BLOCK_NODES: readonly Node[] = ADDED_NODE_BLOCKS.map((block) =>
	createAddedBlockNode(block, ADDED_NODE_BLOCKS),
);
