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

/** Opens the translation frame (with hint text) from the source MDX. */
const openFrame = (source: string) => {
	editor = new Editor({ extensions: buildEditorExtensions(), content: mdxToTiptap(withTranslationHints(source)) });
	return editor;
};

/** The position of the `nth` block of `type`. */
const posOf = (doc: PmNode, type: string, nth = 0) => {
	let seen = 0;
	let found = -1;
	doc.descendants((node, pos) => {
		if (found >= 0) return false;
		if (node.type.name === type && seen++ === nth) found = pos;
		return true;
	});
	if (found < 0) throw new Error(`No ${type} block found.`);
	return found;
};

describe("MDX source of translation blocks", () => {
	it("stripping the hint markers gives back the source block MDX unchanged", () => {
		const blocks = [
			'<Callout variant="info" title="주의">\n**굵게**와 [링크](/posts/a), `code`\n</Callout>',
			"- 첫째\n- 둘째",
			"| 가 | 나 |\n| --- | --- |\n| 다 | 라 |",
		];
		for (const block of blocks) {
			const hinted = mdxToTiptap(withTranslationHints(block)).content?.[0];
			if (!hinted) throw new Error("No block found.");
			expect(sourceMdxFromJson(hinted)).toBe(sourceMdxFromJson(mdxToTiptap(block).content?.[0] ?? {}));
			expect(JSON.stringify(hinted)).toContain("untranslated");
		}
	});
});

describe("translation units and replacement", () => {
	it("a list item is sent as a one-item list and only that item's position is replaced", () => {
		const current = openFrame("## 목록\n\n- **첫째**: 하나\n- 둘째\n- 셋째\n\n끝 문단");
		const pos = posOf(current.state.doc, "listItem", 0);
		const unit = unitAt(current.state.doc, pos);
		expect(unit?.mdx).toBe("- **첫째**: 하나");
		expect(applyTranslation(current, unit as NonNullable<typeof unit>, "- **First**: one", pos)).toBe("replaced");

		const doc = current.state.doc;
		expect(doc.childCount).toBe(3);
		expect(doc.child(1).type.name).toBe("bulletList");
		expect(doc.child(1).childCount).toBe(3);
		expect(tiptapToMdx(current.getJSON())).toContain("- **First**: one\n- <Untranslated>둘째</Untranslated>");
	});

	it("the middle item of a numbered list is also replaced in place only", () => {
		const current = openFrame("1. 하나\n2. 둘\n3. 셋");
		const pos = posOf(current.state.doc, "listItem", 1);
		const unit = unitAt(current.state.doc, pos);
		if (!unit) throw new Error("No unit found.");
		expect(applyTranslation(current, unit, "1. two", pos)).toBe("replaced");
		// The editor appends an empty paragraph at the end. The list is not split and keeps its three items.
		expect(current.state.doc.child(0).type.name).toBe("orderedList");
		expect(current.state.doc.child(0).childCount).toBe(3);
		expect(tiptapToMdx(current.getJSON())).toContain("two");
	});

	it("a non-list result is not put in a list item position", () => {
		const current = openFrame("- 첫째\n- 둘째");
		const before = tiptapToMdx(current.getJSON());
		const pos = posOf(current.state.doc, "listItem", 0);
		const unit = unitAt(current.state.doc, pos);
		if (!unit) throw new Error("No unit found.");
		expect(applyTranslation(current, unit, "First", pos)).toBe("invalid");
		expect(tiptapToMdx(current.getJSON())).toBe(before);
	});

	it("a paragraph inside a callout replaces only that paragraph", () => {
		const current = openFrame('<Callout variant="info" title="주의">\n첫 문단\n\n둘째 문단\n</Callout>');
		const pos = posOf(current.state.doc, "paragraph", 1);
		const unit = unitAt(current.state.doc, pos);
		if (!unit) throw new Error("No unit found.");
		expect(unit.mdx).toBe("둘째 문단");
		expect(applyTranslation(current, unit, "Second paragraph", pos)).toBe("replaced");
		expect(current.state.doc.child(0).type.name).toBe("cmsCallout");
		expect(current.state.doc.child(0).childCount).toBe(2);
		const mdx = tiptapToMdx(current.getJSON());
		expect(mdx).toContain("Second paragraph");
		expect(mdx).toContain("<Untranslated>첫 문단</Untranslated>");
	});

	it("does not replace if the block was edited in the meantime", () => {
		const current = openFrame("문단");
		const unit = unitAt(current.state.doc, 0);
		if (!unit) throw new Error("No unit found.");
		current.commands.setContent(mdxToTiptap("직접 쓴 번역"));
		expect(applyTranslation(current, unit, "Paragraph", 0)).toBe("changed");
		expect(tiptapToMdx(current.getJSON()).trim()).toBe("직접 쓴 번역");
	});

	it("translate-all splits lists into single items and skips translated blocks", () => {
		const current = openFrame("## 제목\n\n- 하나\n- 둘\n\n문단");
		current.commands.setContent(
			mdxToTiptap(tiptapToMdx(current.getJSON()).replace("<Untranslated>제목</Untranslated>", "Title")),
		);
		expect(collectUnits(current.state.doc).map((unit) => unit.mdx)).toEqual(["- 하나", "- 둘", "문단"]);

		for (const [unit, mdx] of collectUnits(current.state.doc).map(
			(unit, i) => [unit, ["- one", "- two", "Text"][i]] as const,
		)) {
			expect(applyTranslation(current, unit, mdx as string, null)).toBe("replaced");
		}
		expect(tiptapToMdx(current.getJSON()).trim()).toBe("## Title\n\n- one\n- two\n\nText");
	});
});
