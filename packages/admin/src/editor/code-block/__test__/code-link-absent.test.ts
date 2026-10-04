import { ADDED_MARK_BLOCKS } from "@monti-cms/core/client";
import { Editor } from "@tiptap/core";
import { describe, expect, it } from "vitest";
import { CODE_ANCHOR_REF } from "../../added-marks";
import { buildEditorExtensions } from "../../extensions";
import { mdxToTiptap } from "../../tiptap-content";
import { codeEffectsKey, pickLines } from "../effects-plugin";
import { commitLink, startLinkFromText } from "../link-commands";

/**
 * 본문–코드 잇기의 본문 쪽은 코드 줄을 가리키는 글자 꾸밈(속성 `codeAnchor`, 예: 블록 확장의 코드 연결)이다. 본체는 그 이름을
 * 모르고 블록 정의에서 찾는다. 다른 사이트 설정처럼 그런 꾸밈이 없으면 잇기는 아무것도 바꾸지 않는다.
 */
describe("본문–코드 잇기의 본문 꾸밈", () => {
	it("코드 줄을 가리키는 꾸밈을 블록 정의(`codeAnchor`)에서 찾는다", () => {
		const anchorBlock = ADDED_MARK_BLOCKS.find((block) =>
			Object.values(block.attributes).some((attribute) => attribute.codeAnchor),
		);
		expect(CODE_ANCHOR_REF?.mark ?? null).toBe(
			anchorBlock ? `cms${anchorBlock.name.replace(/(^|-)([a-z0-9])/g, (_, _d, c: string) => c.toUpperCase())}` : null,
		);
	});

	it.runIf(CODE_ANCHOR_REF === null)("그런 꾸밈이 없으면 잇기는 문서를 바꾸지 않는다", () => {
		const editor = new Editor({
			extensions: buildEditorExtensions(),
			content: mdxToTiptap("이 함수가 값을 돌려준다.\n\n```ts\nconst a = 1;\n```\n"),
		});
		startLinkFromText(editor.view, 3, 6);
		pickLines(editor.view, editor.state.doc.child(0).nodeSize, 0, 1);
		expect(commitLink(editor.view)).toBe(false);
		const marks: string[] = [];
		editor.state.doc.descendants((node) => {
			marks.push(...node.marks.map((mark) => mark.type.name));
			return true;
		});
		expect(marks).toEqual([]);
		expect(editor.state.doc.child(1).attrs.lineEffects).toEqual([]);
		expect(codeEffectsKey.getState(editor.state)?.linking).toEqual({ kind: "text", from: 3, to: 6 });
		editor.destroy();
	});
});
