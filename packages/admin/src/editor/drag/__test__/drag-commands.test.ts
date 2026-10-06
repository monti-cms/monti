import { Editor } from "@tiptap/core";
import { TextSelection } from "@tiptap/pm/state";
import { describe, expect, it } from "vitest";
import { para, tiptapOfNodes } from "../../../test/stored-doc";
import { buildEditorExtensions } from "../../extensions";
import { selectedBlocks, setBlockSelection } from "../block-selection";
import { calculateDropPosition, canDropBlockNode, moveBlockNode, moveBlockSet, sourceRangeOf } from "../drag-commands";

const createTestEditor = (content: string) => {
	return new Editor({
		extensions: buildEditorExtensions(),
		content,
	});
};

describe("Pure block drag-and-drop commands", () => {
	it("top-level block move: reorders paragraphs and is restored with a single undo", () => {
		const editor = createTestEditor("<p>첫 번째</p><p>두 번째</p><p>세 번째</p>");
		const state = editor.state;

		// first block (0..7)
		const fromPos = 0;
		// after the third block (end position)
		const targetPos = state.doc.content.size;

		const tr = moveBlockNode(state, fromPos, targetPos);
		expect(tr).not.toBeNull();
		if (!tr) return;

		editor.view.dispatch(tr);
		expect(editor.state.doc.content.content.map((n) => n.textContent)).toEqual(["두 번째", "세 번째", "첫 번째"]);

		// one drag = one undo
		editor.commands.undo();
		expect(editor.state.doc.content.content.map((n) => n.textContent)).toEqual(["첫 번째", "두 번째", "세 번째"]);

		editor.destroy();
	});

	it("atom nodes (images, raw-source boxes, etc.) can also be moved as blocks", () => {
		const editor = createTestEditor(
			'<p>앞 단락</p><div data-cms-opaque="true" data-raw-source="<Callout>\n내용\n</Callout>" data-line-start="1"></div><p>뒤 단락</p>',
		);
		const state = editor.state;

		const p1 = state.doc.child(0);
		const opaqueNodePos = p1.nodeSize;

		// move the atom node to the very front
		const tr = moveBlockNode(state, opaqueNodePos, 0);
		expect(tr).not.toBeNull();
		if (!tr) return;

		editor.view.dispatch(tr);
		expect(editor.state.doc.child(0).type.name).toBe("cmsOpaqueBlock");
		expect(editor.state.doc.child(1).textContent).toBe("앞 단락");
		expect(editor.state.doc.child(2).textContent).toBe("뒤 단락");

		editor.destroy();
	});

	it("nested blocks: a list item (listItem) can be moved within its list", () => {
		const editor = createTestEditor("<ul><li><p>항목 1</p></li><li><p>항목 2</p></li><li><p>항목 3</p></li></ul>");
		const { doc } = editor.state;

		const list = doc.child(0);
		// start position of the second listItem
		const item1Size = list.child(0).nodeSize;
		const item2Pos = 1 + item1Size; // +1 because it is inside the list
		const item1Pos = 1; // position of the first listItem

		expect(canDropBlockNode(doc, item2Pos, item1Pos)).toBe(true);

		const tr = moveBlockNode(editor.state, item2Pos, item1Pos);
		expect(tr).not.toBeNull();
		if (!tr) return;

		editor.view.dispatch(tr);
		const updatedList = editor.state.doc.child(0);
		const texts = [
			updatedList.child(0).textContent,
			updatedList.child(1).textContent,
			updatedList.child(2).textContent,
		];
		expect(texts).toEqual(["항목 2", "항목 1", "항목 3"]);

		editor.destroy();
	});

	it("nested blocks: a paragraph inside a blockquote can be moved or taken out of it", () => {
		const editor = createTestEditor("<blockquote><p>인용 1</p><p>인용 2</p></blockquote><p>외부 단락</p>");
		const { doc } = editor.state;

		const blockquote = doc.child(0);
		const p1Size = blockquote.child(0).nodeSize;
		const p2Pos = 1 + p1Size;

		// move to the end of the top-level document, outside the blockquote
		const endPos = doc.content.size;
		expect(canDropBlockNode(doc, p2Pos, endPos)).toBe(true);

		const tr = moveBlockNode(editor.state, p2Pos, endPos);
		expect(tr).not.toBeNull();
		if (!tr) return;

		editor.view.dispatch(tr);
		const bq = editor.state.doc.child(0);
		expect(bq.childCount).toBe(1);
		expect(bq.child(0).textContent).toBe("인용 1");
		expect(editor.state.doc.child(2).textContent).toBe("인용 2");

		editor.destroy();
	});

	it("rejects drops at positions the schema does not allow (canReplace/contentMatch fail)", () => {
		const editor = createTestEditor(
			"<ul><li><p>목록</p></li></ul><pre><code>코드 블록 내용</code></pre><p>일반 문단</p>",
		);
		const { doc } = editor.state;

		// 1. the schema must reject putting a listItem inside a codeBlock even when wrapped in a list
		// (placed at the top level outside a list, it is wrapped in a list — see "dragging a list item out of its list" below)
		const listItemPos = 1;
		const listSize = doc.child(0).nodeSize;
		const codeBlockPos = listSize;
		const insideCodePos = codeBlockPos + 2; // inside the codeBlock text
		expect(canDropBlockNode(doc, listItemPos, insideCodePos)).toBe(false);
		expect(moveBlockNode(editor.state, listItemPos, insideCodePos)).toBeNull();

		// 2. the schema must reject putting a plain paragraph inside a codeBlock as a child block
		const paragraphPos = listSize + doc.child(1).nodeSize;

		expect(canDropBlockNode(doc, paragraphPos, insideCodePos)).toBe(false);
		expect(moveBlockNode(editor.state, paragraphPos, insideCodePos)).toBeNull();

		// 3. moving into itself is rejected
		expect(canDropBlockNode(doc, paragraphPos, paragraphPos + 1)).toBe(false);
		expect(moveBlockNode(editor.state, paragraphPos, paragraphPos + 1)).toBeNull();

		editor.destroy();
	});

	it("calculateDropPosition: a drop inside text is corrected to a valid parent block boundary", () => {
		const editor = createTestEditor("<p>첫 번째 단락</p><p>두 번째 단락</p>");
		const { doc } = editor.state;

		const fromPos = 0; // first paragraph
		// position in the latter half of the second paragraph text
		const p1Size = doc.child(0).nodeSize;
		const secondHalfOfSecond = p1Size + 6;

		const dropPos = calculateDropPosition(doc, fromPos, secondHalfOfSecond);
		// should be corrected to a valid point after the second paragraph (end of document)
		expect(dropPos).not.toBeNull();
		expect(dropPos).toBe(doc.content.size);

		// conversely, dropping the second paragraph into the first half of the first paragraph is corrected to the document start (0)
		const secondPos = p1Size;
		const dropPosFirst = calculateDropPosition(doc, secondPos, 2);
		expect(dropPosFirst).toBe(0);

		editor.destroy();
	});

	it("CmsBlockDrag plugin: a valid drop moves the document and a disallowed drop is ignored", () => {
		const editor = createTestEditor("<p>단락 1</p><pre><code>코드</code></pre><p>단락 2</p>");
		const { view } = editor;

		// 1. dropping paragraph 1 after paragraph 2 (valid)
		(view as unknown as { dragging: unknown }).dragging = {
			slice: editor.state.doc.slice(0, editor.state.doc.child(0).nodeSize),
			move: true,
			cmsBlockPos: 0,
		};
		// mock posAtCoords in jsdom
		view.posAtCoords = () => ({ pos: editor.state.doc.content.size, inside: editor.state.doc.content.size });

		const dropEvent = Object.assign(new Event("drop", { bubbles: true, cancelable: true }), {
			clientX: 100,
			clientY: 100,
			dataTransfer: {
				getData: () => "",
				setData: () => {},
				types: [],
			},
		});
		view.dom.dispatchEvent(dropEvent);

		// check that paragraph 1 moved to the end
		expect(editor.state.doc.child(2).textContent).toBe("단락 1");

		// 2. dropping a listItem at the doc root (top level): it is wrapped in its original list type
		const listEditor = createTestEditor("<ul><li><p>목록 항목 1</p></li></ul><p>일반 문단</p>");
		const listDoc = listEditor.state.doc;
		const listItemPos = 1;
		(listEditor.view as unknown as { dragging: unknown }).dragging = {
			slice: listDoc.slice(listItemPos, listItemPos + listDoc.child(0).child(0).nodeSize),
			move: true,
			cmsBlockPos: listItemPos,
		};
		const targetEndPos = listDoc.content.size;
		listEditor.view.posAtCoords = () => ({ pos: targetEndPos, inside: targetEndPos });

		const outsideDropEvent = Object.assign(new Event("drop", { bubbles: true, cancelable: true }), {
			clientX: 50,
			clientY: 50,
			dataTransfer: {
				getData: () => "",
				setData: () => {},
				types: [],
			},
		});
		listEditor.view.dom.dispatchEvent(outsideDropEvent);

		// it was the only item, so the original list disappears and a one-item list appears after the paragraph
		expect(listEditor.state.doc.child(0).textContent).toBe("일반 문단");
		expect(listEditor.state.doc.child(1).type.name).toBe("bulletList");
		expect(listEditor.state.doc.child(1).textContent).toBe("목록 항목 1");

		listEditor.destroy();

		editor.destroy();
	});
});

describe("moves that do not leave the source empty (sourceRangeOf)", () => {
	const nodePos = (editor: Editor, match: (text: string, type: string) => boolean) => {
		let found = -1;
		editor.state.doc.descendants((node, pos) => {
			if (found === -1 && match(node.textContent, node.type.name)) found = pos;
			return found === -1;
		});
		return found;
	};

	it("the only item of an indented list is taken out together with the empty list and moved between other list items", () => {
		const editor = createTestEditor("<ul><li><p>첫째</p></li><li><p>둘째</p><ul><li><p>들여쓴</p></li></ul></li></ul>");
		const from = nodePos(editor, (text, type) => type === "listItem" && text === "들여쓴");
		const target = nodePos(editor, (text, type) => type === "listItem" && text === "둘째들여쓴");
		const source = sourceRangeOf(editor.state.doc, from);
		expect(editor.state.doc.nodeAt(source?.from ?? -1)?.type.name).toBe("bulletList");

		const tr = moveBlockNode(editor.state, from, target);
		expect(tr).not.toBeNull();
		if (tr) editor.view.dispatch(tr);
		// the empty paragraph at the end of the document is added by the trailing node extension.
		expect(editor.getHTML()).toMatch(/^<ul><li><p>첫째<\/p><\/li><li><p>들여쓴<\/p><\/li><li><p>둘째<\/p><\/li><\/ul>/);
		editor.destroy();
	});

	it("moving the only paragraph of a column into another column leaves an empty paragraph", () => {
		const editor = createTestEditor(
			tiptapOfNodes({
				type: "columns",
				content: [
					{ type: "column", content: [para("왼쪽")] },
					{ type: "column", content: [para("오른쪽")] },
				],
			}) as unknown as string,
		);
		const from = nodePos(editor, (text, type) => type === "paragraph" && text === "왼쪽");
		const right = nodePos(editor, (text, type) => type === "paragraph" && text === "오른쪽");
		const target = right + (editor.state.doc.nodeAt(right)?.nodeSize ?? 0);
		expect(sourceRangeOf(editor.state.doc, from)?.fill?.type.name).toBe("paragraph");

		const tr = moveBlockNode(editor.state, from, target);
		expect(tr).not.toBeNull();
		if (tr) editor.view.dispatch(tr);
		const columns = editor.state.doc.firstChild;
		expect(columns?.child(0).textContent).toBe("");
		expect(columns?.child(1).childCount).toBe(2);
		expect(columns?.child(1).textContent).toBe("오른쪽왼쪽");
		editor.destroy();
	});

	it("the sole paragraph of a list item is still not taken out", () => {
		const editor = createTestEditor("<ul><li><p>항목</p></li></ul><p>뒤</p>");
		const from = nodePos(editor, (text, type) => type === "paragraph" && text === "항목");
		expect(sourceRangeOf(editor.state.doc, from)).toBeNull();
		editor.destroy();
	});
});

describe("dragging a list item out of its list", () => {
	const posOf = (editor: Editor, type: string, text: string) => {
		let found = -1;
		editor.state.doc.descendants((node, pos) => {
			if (found === -1 && node.type.name === type && node.textContent === text) found = pos;
			return found === -1;
		});
		return found;
	};
	const move = (editor: Editor, from: number, target: number) => {
		const tr = moveBlockNode(editor.state, from, target);
		expect(tr).not.toBeNull();
		if (tr) editor.view.dispatch(tr);
	};
	// the empty paragraph at the end of the document is added by the trailing node extension.
	const html = (editor: Editor) => editor.getHTML().replace(/<p><\/p>$/, "");

	it("dropping between paragraphs makes a new list wrapped in the original list type, and the remaining items stay in the original list", () => {
		const editor = createTestEditor("<ul><li><p>하나</p></li><li><p>둘</p></li></ul><p>가</p><p>나</p>");
		const from = posOf(editor, "listItem", "둘");
		const target = posOf(editor, "paragraph", "나");
		expect(calculateDropPosition(editor.state.doc, from, target + 1)).toBe(target);
		move(editor, from, target);
		expect(html(editor)).toBe("<ul><li><p>하나</p></li></ul><p>가</p><ul><li><p>둘</p></li></ul><p>나</p>");
		editor.commands.undo();
		expect(html(editor)).toBe("<ul><li><p>하나</p></li><li><p>둘</p></li></ul><p>가</p><p>나</p>");
		editor.destroy();
	});

	it("dragging out the only item leaves no empty list, and child items move along with it", () => {
		const editor = createTestEditor("<p>가</p><ul><li><p>부모</p><ul><li><p>자식</p></li></ul></li></ul><p>나</p>");
		move(editor, posOf(editor, "listItem", "부모자식"), 0);
		expect(html(editor)).toBe("<ul><li><p>부모</p><ul><li><p>자식</p></li></ul></li></ul><p>가</p><p>나</p>");
		editor.destroy();
	});

	it("an ordered list item is wrapped in an ordered list, merged with an adjacent list of the same type but not with a different type", () => {
		const editor = createTestEditor(
			"<ol><li><p>일</p></li><li><p>이</p></li></ol><p>가</p><ol><li><p>삼</p></li></ol><ul><li><p>점</p></li></ul>",
		);
		// placed after "가" (before the ordered list "삼"), it merges into that ordered list.
		move(editor, posOf(editor, "listItem", "이"), posOf(editor, "orderedList", "삼"));
		expect(html(editor)).toBe(
			"<ol><li><p>일</p></li></ol><p>가</p><ol><li><p>이</p></li><li><p>삼</p></li></ol><ul><li><p>점</p></li></ul>",
		);
		editor.destroy();

		// placing an ordered item between a paragraph and a bullet list does not merge it with the following bullet list.
		const mixed = createTestEditor("<ol><li><p>일</p></li><li><p>이</p></li></ol><p>가</p><ul><li><p>점</p></li></ul>");
		move(mixed, posOf(mixed, "listItem", "이"), posOf(mixed, "bulletList", "점"));
		expect(html(mixed)).toBe(
			"<ol><li><p>일</p></li></ol><p>가</p><ol><li><p>이</p></li></ol><ul><li><p>점</p></li></ul>",
		);
		mixed.destroy();
	});
});

describe("block selection (marquee): select, move and delete by line", () => {
	const posOf = (editor: Editor, type: string, text: string) => {
		let found = -1;
		editor.state.doc.descendants((node, pos) => {
			if (found === -1 && node.type.name === type && node.textContent === text) found = pos;
			return found === -1;
		});
		return found;
	};
	const html = (editor: Editor) => editor.getHTML().replace(/<p><\/p>$/, "");
	const select = (editor: Editor, positions: number[]) =>
		editor.view.dispatch(setBlockSelection(editor.state.tr, positions));
	const backspace = (editor: Editor) =>
		editor.view.dom.dispatchEvent(new KeyboardEvent("keydown", { key: "Backspace", bubbles: true }));

	it("selecting text across several blocks does not make a block selection (what is shown is what is deleted)", () => {
		const editor = createTestEditor("<p>가나다</p><p>라마바</p>");
		editor.view.dispatch(editor.state.tr.setSelection(TextSelection.create(editor.state.doc, 2, 7)));
		expect(selectedBlocks(editor.state)).toBeNull();
		editor.destroy();
	});

	it("each list item is a line: deleting only some items leaves the rest", () => {
		const editor = createTestEditor("<ol><li><p>하나</p></li><li><p>둘</p></li><li><p>셋</p></li></ol>");
		select(editor, [posOf(editor, "listItem", "둘"), posOf(editor, "listItem", "셋")]);
		backspace(editor);
		expect(html(editor)).toBe("<ol><li><p>하나</p></li></ol>");
		expect(selectedBlocks(editor.state)).toBeNull();
		editor.destroy();
	});

	it("deleting a heading together with the leading list items leaves no stray text, and an emptied list is removed entirely", () => {
		const editor = createTestEditor("<h2>제목</h2><ul><li><p>하나</p></li><li><p>둘</p></li></ul><p>뒤</p>");
		select(editor, [posOf(editor, "heading", "제목"), posOf(editor, "listItem", "하나")]);
		backspace(editor);
		expect(html(editor)).toBe("<ul><li><p>둘</p></li></ul><p>뒤</p>");
		select(editor, [posOf(editor, "listItem", "둘")]);
		backspace(editor);
		expect(html(editor)).toBe("<p>뒤</p>");
		editor.destroy();
	});

	it("selecting a parent item does not count its child items separately (children go with the parent)", () => {
		const editor = createTestEditor("<ul><li><p>부모</p><ul><li><p>자식</p></li></ul></li><li><p>다음</p></li></ul>");
		const parent = posOf(editor, "listItem", "부모자식");
		select(editor, [parent, posOf(editor, "listItem", "자식")]);
		expect(selectedBlocks(editor.state)).toEqual([parent]);
		editor.destroy();
	});

	it("selecting elsewhere or pressing Esc clears the block selection", () => {
		const editor = createTestEditor("<p>가</p><p>나</p><p>다</p>");
		select(editor, [0, posOf(editor, "paragraph", "나")]);
		editor.view.dom.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
		expect(selectedBlocks(editor.state)).toBeNull();
		select(editor, [0]);
		editor.commands.setTextSelection(1);
		expect(selectedBlocks(editor.state)).toBeNull();
		editor.destroy();
	});

	it("moving a paragraph and some list items together wraps the items in a list, and the moved lines stay selected", () => {
		const editor = createTestEditor("<p>가</p><ul><li><p>하나</p></li><li><p>둘</p></li></ul><p>나</p>");
		const rows = [0, posOf(editor, "listItem", "하나")];
		const tr = moveBlockSet(editor.state, rows, editor.state.doc.content.size);
		expect(tr).not.toBeNull();
		if (tr) editor.view.dispatch(tr);
		expect(html(editor)).toBe("<ul><li><p>둘</p></li></ul><p>나</p><p>가</p><ul><li><p>하나</p></li></ul>");
		const moved = selectedBlocks(editor.state) ?? [];
		expect(moved.map((pos) => editor.state.doc.nodeAt(pos)?.textContent)).toEqual(["가", "하나"]);
		editor.commands.undo();
		expect(html(editor)).toBe("<p>가</p><ul><li><p>하나</p></li><li><p>둘</p></li></ul><p>나</p>");
		editor.destroy();
	});

	it("selecting only items and dropping them between items of another list inserts them as plain items", () => {
		const editor = createTestEditor(
			"<ul><li><p>a</p></li><li><p>b</p></li></ul><p>가</p><ul><li><p>x</p></li><li><p>y</p></li></ul>",
		);
		const rows = [posOf(editor, "listItem", "a"), posOf(editor, "listItem", "b")];
		const tr = moveBlockSet(editor.state, rows, posOf(editor, "listItem", "y"));
		if (tr) editor.view.dispatch(tr);
		expect(html(editor)).toBe("<p>가</p><ul><li><p>x</p></li><li><p>a</p></li><li><p>b</p></li><li><p>y</p></li></ul>");
		editor.destroy();
	});
});
