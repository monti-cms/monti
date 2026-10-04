import { Editor } from "@tiptap/core";
import { TextSelection } from "@tiptap/pm/state";
import { describe, expect, it } from "vitest";
import { buildEditorExtensions } from "../../extensions";
import { mdxToTiptap } from "../../tiptap-content";
import { selectedBlocks, setBlockSelection } from "../block-selection";
import { calculateDropPosition, canDropBlockNode, moveBlockNode, moveBlockSet, sourceRangeOf } from "../drag-commands";

const createTestEditor = (content: string) => {
	return new Editor({
		extensions: buildEditorExtensions(),
		content,
	});
};

describe("블록 드래그 앤 드롭 순수 명령(v2 C1)", () => {
	it("최상위 블록 이동: 문단 순서를 재배치하고 한 번의 undo로 복구된다", () => {
		const editor = createTestEditor("<p>첫 번째</p><p>두 번째</p><p>세 번째</p>");
		const state = editor.state;

		// 첫 번째 블록 (0..7)
		const fromPos = 0;
		// 세 번째 블록 뒤 (끝 위치)
		const targetPos = state.doc.content.size;

		const tr = moveBlockNode(state, fromPos, targetPos);
		expect(tr).not.toBeNull();
		if (!tr) return;

		editor.view.dispatch(tr);
		expect(editor.state.doc.content.content.map((n) => n.textContent)).toEqual(["두 번째", "세 번째", "첫 번째"]);

		// 한 드래그 = 한 undo 검증
		editor.commands.undo();
		expect(editor.state.doc.content.content.map((n) => n.textContent)).toEqual(["첫 번째", "두 번째", "세 번째"]);

		editor.destroy();
	});

	it("원자 노드(이미지/원문 상자 등)도 블록 단위로 이동 가능하다", () => {
		const editor = createTestEditor(
			'<p>앞 단락</p><div data-cms-opaque="true" data-raw-source=":::callout\n내용\n:::" data-line-start="1"></div><p>뒤 단락</p>',
		);
		const state = editor.state;

		const p1 = state.doc.child(0);
		const opaqueNodePos = p1.nodeSize;

		// 원자 노드를 맨 앞으로 이동
		const tr = moveBlockNode(state, opaqueNodePos, 0);
		expect(tr).not.toBeNull();
		if (!tr) return;

		editor.view.dispatch(tr);
		expect(editor.state.doc.child(0).type.name).toBe("cmsOpaqueBlock");
		expect(editor.state.doc.child(1).textContent).toBe("앞 단락");
		expect(editor.state.doc.child(2).textContent).toBe("뒤 단락");

		editor.destroy();
	});

	it("중첩 블록: 목록 항목(listItem)을 목록 내에서 이동할 수 있다", () => {
		const editor = createTestEditor("<ul><li><p>항목 1</p></li><li><p>항목 2</p></li><li><p>항목 3</p></li></ul>");
		const { doc } = editor.state;

		const list = doc.child(0);
		// 두 번째 listItem의 시작 위치
		const item1Size = list.child(0).nodeSize;
		const item2Pos = 1 + item1Size; // list 내부이므로 +1
		const item1Pos = 1; // 첫 번째 listItem 위치

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

	it("중첩 블록: 인용문(blockquote) 안의 단락을 이동하거나 인용문 밖으로 꺼낼 수 있다", () => {
		const editor = createTestEditor("<blockquote><p>인용 1</p><p>인용 2</p></blockquote><p>외부 단락</p>");
		const { doc } = editor.state;

		const blockquote = doc.child(0);
		const p1Size = blockquote.child(0).nodeSize;
		const p2Pos = 1 + p1Size;

		// 인용문 밖 최상위 문서 끝으로 이동
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

	it("스키마가 허용하지 않는 위치는 드롭을 거부한다 (canReplace/contentMatch 불가)", () => {
		const editor = createTestEditor(
			"<ul><li><p>목록</p></li></ul><pre><code>코드 블록 내용</code></pre><p>일반 문단</p>",
		);
		const { doc } = editor.state;

		// 1. listItem을 codeBlock 안에 넣는 것은 목록으로 감싸도 스키마가 거부해야 함
		// (목록 밖 최상위에 놓으면 목록으로 감싸 옮긴다 — 아래 "목록 항목을 목록 밖으로 끌어내기")
		const listItemPos = 1;
		const listSize = doc.child(0).nodeSize;
		const codeBlockPos = listSize;
		const insideCodePos = codeBlockPos + 2; // codeBlock 텍스트 내부
		expect(canDropBlockNode(doc, listItemPos, insideCodePos)).toBe(false);
		expect(moveBlockNode(editor.state, listItemPos, insideCodePos)).toBeNull();

		// 2. 일반 문단을 codeBlock 내부에 자식 블록으로 넣는 것은 스키마가 거부해야 함
		const paragraphPos = listSize + doc.child(1).nodeSize;

		expect(canDropBlockNode(doc, paragraphPos, insideCodePos)).toBe(false);
		expect(moveBlockNode(editor.state, paragraphPos, insideCodePos)).toBeNull();

		// 3. 자기 자신 내부로의 이동 거부
		expect(canDropBlockNode(doc, paragraphPos, paragraphPos + 1)).toBe(false);
		expect(moveBlockNode(editor.state, paragraphPos, paragraphPos + 1)).toBeNull();

		editor.destroy();
	});

	it("calculateDropPosition: 텍스트 안으로 드롭된 경우 유효한 부모 블록 경계로 보정한다", () => {
		const editor = createTestEditor("<p>첫 번째 단락</p><p>두 번째 단락</p>");
		const { doc } = editor.state;

		const fromPos = 0; // 첫 번째 단락
		// 두 번째 단락 텍스트 후반부 위치
		const p1Size = doc.child(0).nodeSize;
		const secondHalfOfSecond = p1Size + 6;

		const dropPos = calculateDropPosition(doc, fromPos, secondHalfOfSecond);
		// 두 번째 단락 뒤 유효 지점(문서 끝)으로 보정되어야 함
		expect(dropPos).not.toBeNull();
		expect(dropPos).toBe(doc.content.size);

		// 반대로 두 번째 단락을 첫 번째 단락 전반부로 드롭 시 문서 시작(0)으로 보정
		const secondPos = p1Size;
		const dropPosFirst = calculateDropPosition(doc, secondPos, 2);
		expect(dropPosFirst).toBe(0);

		editor.destroy();
	});

	it("CmsBlockDrag 플러그인: 유효한 드롭은 문서를 이동시키고 허용 안 되는 드롭은 무시한다", () => {
		const editor = createTestEditor("<p>단락 1</p><pre><code>코드</code></pre><p>단락 2</p>");
		const { view } = editor;

		// 1. 단락 1을 단락 2 뒤로 드롭하는 케이스 (유효)
		(view as unknown as { dragging: unknown }).dragging = {
			slice: editor.state.doc.slice(0, editor.state.doc.child(0).nodeSize),
			move: true,
			cmsBlockPos: 0,
		};
		// jsdom에서 posAtCoords 모의
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

		// 단락 1이 끝으로 이동했는지 확인
		expect(editor.state.doc.child(2).textContent).toBe("단락 1");

		// 2. listItem을 doc 루트(최상위)로 드롭: 원래 목록 종류로 감싸 옮긴다
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

		// 유일한 항목이라 원래 목록은 사라지고, 문단 뒤에 한 항목짜리 목록이 생긴다
		expect(listEditor.state.doc.child(0).textContent).toBe("일반 문단");
		expect(listEditor.state.doc.child(1).type.name).toBe("bulletList");
		expect(listEditor.state.doc.child(1).textContent).toBe("목록 항목 1");

		listEditor.destroy();

		editor.destroy();
	});
});

describe("꺼낸 자리를 비우지 않는 이동(sourceRangeOf)", () => {
	const nodePos = (editor: Editor, match: (text: string, type: string) => boolean) => {
		let found = -1;
		editor.state.doc.descendants((node, pos) => {
			if (found === -1 && match(node.textContent, node.type.name)) found = pos;
			return found === -1;
		});
		return found;
	};

	it("들여쓴 목록의 유일한 항목은 빈 목록째 빼서 다른 목록 사이로 옮긴다", () => {
		const editor = createTestEditor("<ul><li><p>첫째</p></li><li><p>둘째</p><ul><li><p>들여쓴</p></li></ul></li></ul>");
		const from = nodePos(editor, (text, type) => type === "listItem" && text === "들여쓴");
		const target = nodePos(editor, (text, type) => type === "listItem" && text === "둘째들여쓴");
		const source = sourceRangeOf(editor.state.doc, from);
		expect(editor.state.doc.nodeAt(source?.from ?? -1)?.type.name).toBe("bulletList");

		const tr = moveBlockNode(editor.state, from, target);
		expect(tr).not.toBeNull();
		if (tr) editor.view.dispatch(tr);
		// 문서 끝의 빈 문단은 trailing node 확장이 붙인다.
		expect(editor.getHTML()).toMatch(/^<ul><li><p>첫째<\/p><\/li><li><p>들여쓴<\/p><\/li><li><p>둘째<\/p><\/li><\/ul>/);
		editor.destroy();
	});

	it("단의 유일한 문단을 다른 단으로 옮기면 빈 문단을 남긴다", () => {
		const editor = createTestEditor(
			mdxToTiptap("::::columns\n:::column\n왼쪽\n:::\n:::column\n오른쪽\n:::\n::::") as unknown as string,
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

	it("목록 항목의 하나뿐인 문단은 여전히 꺼내지 않는다", () => {
		const editor = createTestEditor("<ul><li><p>항목</p></li></ul><p>뒤</p>");
		const from = nodePos(editor, (text, type) => type === "paragraph" && text === "항목");
		expect(sourceRangeOf(editor.state.doc, from)).toBeNull();
		editor.destroy();
	});
});

describe("목록 항목을 목록 밖으로 끌어내기", () => {
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
	// 문서 끝의 빈 문단은 trailing node 확장이 붙인다.
	const html = (editor: Editor) => editor.getHTML().replace(/<p><\/p>$/, "");

	it("문단 사이에 놓으면 원래 목록 종류로 감싼 새 목록이 되고, 원래 목록에는 나머지 항목이 남는다", () => {
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

	it("유일한 항목을 끌어내면 빈 목록을 남기지 않고, 자식 항목은 함께 옮긴다", () => {
		const editor = createTestEditor("<p>가</p><ul><li><p>부모</p><ul><li><p>자식</p></li></ul></li></ul><p>나</p>");
		move(editor, posOf(editor, "listItem", "부모자식"), 0);
		expect(html(editor)).toBe("<ul><li><p>부모</p><ul><li><p>자식</p></li></ul></li></ul><p>가</p><p>나</p>");
		editor.destroy();
	});

	it("번호 목록 항목은 번호 목록으로 감싸고, 옆의 같은 종류 목록과는 합치되 다른 종류와는 합치지 않는다", () => {
		const editor = createTestEditor(
			"<ol><li><p>일</p></li><li><p>이</p></li></ol><p>가</p><ol><li><p>삼</p></li></ol><ul><li><p>점</p></li></ul>",
		);
		// "가" 뒤(번호 목록 "삼" 앞)에 놓으면 그 번호 목록에 합쳐진다.
		move(editor, posOf(editor, "listItem", "이"), posOf(editor, "orderedList", "삼"));
		expect(html(editor)).toBe(
			"<ol><li><p>일</p></li></ol><p>가</p><ol><li><p>이</p></li><li><p>삼</p></li></ol><ul><li><p>점</p></li></ul>",
		);
		editor.destroy();

		// 문단과 글머리표 목록 사이에 번호 항목을 놓으면, 뒤의 글머리표 목록과는 합치지 않는다.
		const mixed = createTestEditor("<ol><li><p>일</p></li><li><p>이</p></li></ol><p>가</p><ul><li><p>점</p></li></ul>");
		move(mixed, posOf(mixed, "listItem", "이"), posOf(mixed, "bulletList", "점"));
		expect(html(mixed)).toBe(
			"<ol><li><p>일</p></li></ol><p>가</p><ol><li><p>이</p></li></ol><ul><li><p>점</p></li></ul>",
		);
		mixed.destroy();
	});
});

describe("블록 선택(마키): 줄 단위로 고르고 옮기기·지우기", () => {
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

	it("글자를 여러 블록에 걸쳐 골라도 블록 선택이 되지 않는다(보이는 것과 지워지는 것이 같다)", () => {
		const editor = createTestEditor("<p>가나다</p><p>라마바</p>");
		editor.view.dispatch(editor.state.tr.setSelection(TextSelection.create(editor.state.doc, 2, 7)));
		expect(selectedBlocks(editor.state)).toBeNull();
		editor.destroy();
	});

	it("목록 항목은 하나하나가 줄이다: 일부 항목만 골라 지우면 나머지 항목은 남는다", () => {
		const editor = createTestEditor("<ol><li><p>하나</p></li><li><p>둘</p></li><li><p>셋</p></li></ol>");
		select(editor, [posOf(editor, "listItem", "둘"), posOf(editor, "listItem", "셋")]);
		backspace(editor);
		expect(html(editor)).toBe("<ol><li><p>하나</p></li></ol>");
		expect(selectedBlocks(editor.state)).toBeNull();
		editor.destroy();
	});

	it("제목과 목록 앞쪽 항목을 함께 골라 지우면 글자가 남지 않고, 목록이 비면 목록째 빠진다", () => {
		const editor = createTestEditor("<h2>제목</h2><ul><li><p>하나</p></li><li><p>둘</p></li></ul><p>뒤</p>");
		select(editor, [posOf(editor, "heading", "제목"), posOf(editor, "listItem", "하나")]);
		backspace(editor);
		expect(html(editor)).toBe("<ul><li><p>둘</p></li></ul><p>뒤</p>");
		select(editor, [posOf(editor, "listItem", "둘")]);
		backspace(editor);
		expect(html(editor)).toBe("<p>뒤</p>");
		editor.destroy();
	});

	it("부모 항목을 고르면 그 안의 자식 항목은 따로 세지 않는다(자식은 부모와 함께 간다)", () => {
		const editor = createTestEditor("<ul><li><p>부모</p><ul><li><p>자식</p></li></ul></li><li><p>다음</p></li></ul>");
		const parent = posOf(editor, "listItem", "부모자식");
		select(editor, [parent, posOf(editor, "listItem", "자식")]);
		expect(selectedBlocks(editor.state)).toEqual([parent]);
		editor.destroy();
	});

	it("다른 곳을 고르거나 Esc를 누르면 블록 선택을 푼다", () => {
		const editor = createTestEditor("<p>가</p><p>나</p><p>다</p>");
		select(editor, [0, posOf(editor, "paragraph", "나")]);
		editor.view.dom.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
		expect(selectedBlocks(editor.state)).toBeNull();
		select(editor, [0]);
		editor.commands.setTextSelection(1);
		expect(selectedBlocks(editor.state)).toBeNull();
		editor.destroy();
	});

	it("문단과 목록 항목 일부를 함께 옮기면 항목은 목록으로 감싸 옮기고, 옮긴 줄은 계속 선택된다", () => {
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

	it("항목만 골라 다른 목록의 항목 사이에 놓으면 항목 그대로 들어간다", () => {
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
