import { analyze } from "@monti-cms/core/mdx";
import { Editor, type JSONContent } from "@tiptap/core";
import { describe, expect, it } from "vitest";
import { ADDED_BLOCK_INSERT_ACTIONS, ADDED_NODE_BLOCKS, blockNodeName } from "../blocks/added";
import { buildEditorExtensions } from "../extensions";
import { buildBlockSlashCommands } from "../slash-command";
import { mdxToTiptap, tiptapToMdx } from "../tiptap-content";

/**
 * 설정에 더한 블록의 편집기 흐름(M10-1 재발 방지). 블록 이름을 적지 않고 지금 설정에서 읽는다.
 * 블로그 예시 설정과 다른 사이트 설정 둘 다로 돈다.
 */

/** 블록 안의 빈 문단에 글을 채운다(사용자가 넣은 블록에 글을 쓴 상태). */
const fillEmptyParagraphs = (node: JSONContent, inside = false): JSONContent => {
	if (inside && node.type === "paragraph" && !node.content?.length) {
		return { ...node, content: [{ type: "text", text: "Typed text" }] };
	}
	const isBlock = node.type !== "doc" && node.type !== "paragraph";
	return node.content
		? { ...node, content: node.content.map((child) => fillEmptyParagraphs(child, inside || isBlock)) }
		: node;
};

const insertable = ADDED_NODE_BLOCKS.filter((block) => block.editor.insertable && !block.parent);

describe("any site: added blocks in the editor", () => {
	it("the active config adds at least one insertable block", () => {
		expect(insertable.length).toBeGreaterThan(0);
	});

	it.each(
		insertable.map((block) => [block.name, block] as const),
	)("%s is in the slash menu under its own label", (_name, block) => {
		const command = buildBlockSlashCommands().find((item) => item.id === block.name);
		expect(command?.title).toBe(block.label);
	});

	it.each(
		insertable.map((block) => [block.name, block] as const),
	)("%s inserted from the slash menu saves as valid MDX and reopens as the same node", (_name, block) => {
		const editor = new Editor({ extensions: buildEditorExtensions(), content: "<p></p>" });
		ADDED_BLOCK_INSERT_ACTIONS[block.name]?.(editor, { from: 1, to: 1 });
		// 본문을 담는 블록은 쓴 글이 있는 상태로 저장한다(본문이 꼭 있어야 하는 블록은 비면 원문 상자로 연다).
		const mdx = tiptapToMdx(fillEmptyParagraphs(editor.getJSON()));
		editor.destroy();
		expect(analyze(mdx).errors).toEqual([]);
		const reopened = mdxToTiptap(mdx);
		expect(reopened.content?.some((node) => node.type === blockNodeName(block))).toBe(true);
		expect(tiptapToMdx(reopened)).toBe(mdx);
	});
});
