import type { BlockDefinition, BlockInsert } from "@monti-cms/core/client";
import type { Editor, JSONContent, Range } from "@tiptap/core";
import { ADDED_NODE_BLOCKS, blockNodeName, childBlocksOf, defaultValues, isContainer, isFence } from "./shared";

type Initial = Omit<BlockInsert, "children" | "code">;

const paragraph = (text?: string): JSONContent =>
	text ? { type: "paragraph", content: [{ type: "text", text }] } : { type: "paragraph" };

const directiveContent = (
	block: BlockDefinition,
	initial: Initial | undefined,
	children: JSONContent[],
): JSONContent => ({
	type: blockNodeName(block),
	attrs: { values: initial?.values ?? defaultValues(block), originalAttributes: [] },
	...(isContainer(block) ? { content: children.length > 0 ? children : [paragraph(initial?.text)] } : {}),
});

/**
 * 슬래시 메뉴로 넣을 노드. 정의의 `editor.insert`(처음 값)를 따르고, 없으면 속성 기본값과 빈 본문이다. 자식 블록 규칙이
 * 있으면 처음 값의 자식들, 없으면 최소 개수(없으면 하나)만큼 첫 자식 블록을 넣는다.
 */
export function insertContentOf(
	block: BlockDefinition,
	all: readonly BlockDefinition[] = ADDED_NODE_BLOCKS,
): JSONContent {
	const insert = block.editor.insert;
	if (isFence(block) && block.syntax.kind === "fence") {
		return { type: blockNodeName(block), attrs: { value: insert?.code ?? "", language: block.syntax.lang } };
	}
	const [firstChild] = childBlocksOf(block, all);
	const children = firstChild
		? (insert?.children ?? Array.from({ length: Math.max(block.children?.min ?? 1, 1) }, () => undefined)).map(
				(initial) => directiveContent(firstChild, initial, []),
			)
		: [];
	return directiveContent(block, insert, children);
}

/** 더한 블록 삽입 동작(슬래시 메뉴). 키는 블록 이름이다. */
export const ADDED_BLOCK_INSERT_ACTIONS: Readonly<Record<string, (editor: Editor, range: Range) => void>> =
	Object.fromEntries(
		ADDED_NODE_BLOCKS.filter((block) => !block.parent).map((block) => [
			block.name,
			(editor: Editor, range: Range) =>
				editor.chain().focus().deleteRange(range).insertContent(insertContentOf(block)).run(),
		]),
	);
