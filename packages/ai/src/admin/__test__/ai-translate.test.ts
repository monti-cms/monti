// @vitest-environment jsdom

import { buildEditorExtensions, mdxToTiptap, tiptapToMdx } from "@monti-cms/admin/editor";
import { withTranslationHints } from "@monti-cms/core/client";
import { Editor } from "@tiptap/core";
import type { Node as PmNode } from "@tiptap/pm/model";
import { afterEach, describe, expect, it } from "vitest";
import { applyTranslation, collectUnits, sourceMdxFromJson, unitAt } from "../ai-translate-units";

let editor: Editor | null = null;
afterEach(() => {
	editor?.destroy();
	editor = null;
});

/** 원문 MDX로 번역본 틀(안내 글)을 연다. */
const openFrame = (source: string) => {
	editor = new Editor({ extensions: buildEditorExtensions(), content: mdxToTiptap(withTranslationHints(source)) });
	return editor;
};

/** `type` 블록 중 `nth`번째의 자리. */
const posOf = (doc: PmNode, type: string, nth = 0) => {
	let seen = 0;
	let found = -1;
	doc.descendants((node, pos) => {
		if (found >= 0) return false;
		if (node.type.name === type && seen++ === nth) found = pos;
		return true;
	});
	if (found < 0) throw new Error(`${type} 블록이 없습니다.`);
	return found;
};

describe("번역본 블록의 원문 MDX", () => {
	it("안내 글 표시를 걷어 내면 원문 블록 MDX가 그대로 나온다", () => {
		const blocks = [
			'<Callout variant="info" title="주의">\n**굵게**와 [링크](/posts/a), `code`\n</Callout>',
			"- 첫째\n- 둘째",
			"| 가 | 나 |\n| --- | --- |\n| 다 | 라 |",
		];
		for (const block of blocks) {
			const hinted = mdxToTiptap(withTranslationHints(block)).content?.[0];
			if (!hinted) throw new Error("블록이 없습니다.");
			expect(sourceMdxFromJson(hinted)).toBe(sourceMdxFromJson(mdxToTiptap(block).content?.[0] ?? {}));
			expect(JSON.stringify(hinted)).toContain("untranslated");
		}
	});
});

describe("번역 단위와 바꾸기", () => {
	it("목록 항목은 항목 하나만 든 목록으로 보내고, 그 항목 자리만 바꾼다", () => {
		const current = openFrame("## 목록\n\n- **첫째**: 하나\n- 둘째\n- 셋째\n\n끝 문단");
		const pos = posOf(current.state.doc, "listItem", 0);
		const unit = unitAt(current.state.doc, pos);
		expect(unit?.mdx).toBe("- **첫째**: 하나");
		expect(applyTranslation(current, unit as NonNullable<typeof unit>, "- **First**: one", pos)).toBe("replaced");

		const doc = current.state.doc;
		expect(doc.childCount).toBe(3);
		expect(doc.child(1).type.name).toBe("bulletList");
		expect(doc.child(1).childCount).toBe(3);
		expect(tiptapToMdx(current.getJSON())).toContain("- **First**: one\n- :untranslated[둘째]");
	});

	it("번호 목록의 가운데 항목도 그 자리만 바꾼다", () => {
		const current = openFrame("1. 하나\n2. 둘\n3. 셋");
		const pos = posOf(current.state.doc, "listItem", 1);
		const unit = unitAt(current.state.doc, pos);
		if (!unit) throw new Error("단위가 없습니다.");
		expect(applyTranslation(current, unit, "1. two", pos)).toBe("replaced");
		// 편집기는 끝에 빈 문단을 하나 붙인다. 목록은 쪼개지지 않고 항목 셋 그대로다.
		expect(current.state.doc.child(0).type.name).toBe("orderedList");
		expect(current.state.doc.child(0).childCount).toBe(3);
		expect(tiptapToMdx(current.getJSON())).toContain("two");
	});

	it("목록 항목 자리에 목록이 아닌 결과는 넣지 않는다", () => {
		const current = openFrame("- 첫째\n- 둘째");
		const before = tiptapToMdx(current.getJSON());
		const pos = posOf(current.state.doc, "listItem", 0);
		const unit = unitAt(current.state.doc, pos);
		if (!unit) throw new Error("단위가 없습니다.");
		expect(applyTranslation(current, unit, "First", pos)).toBe("invalid");
		expect(tiptapToMdx(current.getJSON())).toBe(before);
	});

	it("콜아웃 안 문단은 그 문단만 바꾼다", () => {
		const current = openFrame('<Callout variant="info" title="주의">\n첫 문단\n\n둘째 문단\n</Callout>');
		const pos = posOf(current.state.doc, "paragraph", 1);
		const unit = unitAt(current.state.doc, pos);
		if (!unit) throw new Error("단위가 없습니다.");
		expect(unit.mdx).toBe("둘째 문단");
		expect(applyTranslation(current, unit, "Second paragraph", pos)).toBe("replaced");
		expect(current.state.doc.child(0).type.name).toBe("cmsCallout");
		expect(current.state.doc.child(0).childCount).toBe(2);
		const mdx = tiptapToMdx(current.getJSON());
		expect(mdx).toContain("Second paragraph");
		expect(mdx).toContain(":untranslated[첫 문단]");
	});

	it("그사이 블록을 고쳤으면 바꾸지 않는다", () => {
		const current = openFrame("문단");
		const unit = unitAt(current.state.doc, 0);
		if (!unit) throw new Error("단위가 없습니다.");
		current.commands.setContent(mdxToTiptap("직접 쓴 번역"));
		expect(applyTranslation(current, unit, "Paragraph", 0)).toBe("changed");
		expect(tiptapToMdx(current.getJSON()).trim()).toBe("직접 쓴 번역");
	});

	it("모두 번역은 목록을 항목 하나씩 나누고, 번역한 블록은 건너뛴다", () => {
		const current = openFrame("## 제목\n\n- 하나\n- 둘\n\n문단");
		current.commands.setContent(mdxToTiptap(tiptapToMdx(current.getJSON()).replace(":untranslated[제목]", "Title")));
		expect(collectUnits(current.state.doc).map((unit) => unit.mdx)).toEqual(["- 하나", "- 둘", "문단"]);

		for (const [unit, mdx] of collectUnits(current.state.doc).map(
			(unit, i) => [unit, ["- one", "- two", "Text"][i]] as const,
		)) {
			expect(applyTranslation(current, unit, mdx as string, null)).toBe("replaced");
		}
		expect(tiptapToMdx(current.getJSON()).trim()).toBe("## Title\n\n- one\n- two\n\nText");
	});
});
