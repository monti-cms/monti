// @vitest-environment jsdom

import {
	BLOCK_ID_ATTRIBUTE,
	buildEditorExtensions,
	findBlock,
	storedToTiptap,
	tiptapToStored,
} from "@monti-cms/admin/editor";
import { withTranslationHints as hintDocument } from "@monti-cms/core/client";
import { assignBlockIds, type StoredDocument } from "@monti-cms/core/document";
import { mdxBrowserFormat as format } from "@monti-cms/mdx/admin";
import { Editor, type JSONContent } from "@tiptap/core";
import type { Node as PmNode } from "@tiptap/pm/model";
import { afterEach, describe, expect, it } from "vitest";
import { applyTranslation, collectUnits, sourceMdxFromJson, unitAt } from "../ai-translate-units";

/** The stored document of MDX text, with block ids as the entry screen has them. */
const docOf = (mdx: string): StoredDocument => {
	const read = format.import(mdx);
	if (!read.ok) throw new Error("not readable");
	return { ...read.doc, content: assignBlockIds(read.doc.content) };
};
/** The editor's content for MDX text, and the MDX text of the editor's content. */
const tiptapOf = (mdx: string): JSONContent => storedToTiptap(docOf(mdx));
const mdxOf = (json: JSONContent): string => format.export(tiptapToStored(json));

/** The source with translation hints: the source is read as a document and hinted. */
const withTranslationHints = (source: string): StoredDocument => hintDocument(docOf(source));

let editor: Editor | null = null;
afterEach(() => {
	editor?.destroy();
	editor = null;
});

/** Opens the translation frame (with hint text) from the source MDX. */
const openFrame = (source: string) => {
	editor = new Editor({ extensions: buildEditorExtensions(), content: storedToTiptap(withTranslationHints(source)) });
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
			const hinted = storedToTiptap(withTranslationHints(block)).content?.[0];
			if (!hinted) throw new Error("No block found.");
			expect(sourceMdxFromJson(format, hinted)).toBe(sourceMdxFromJson(format, tiptapOf(block).content?.[0] ?? {}));
			expect(JSON.stringify(hinted)).toContain("untranslated");
		}
	});
});

describe("translation units and replacement", () => {
	it("a list item is sent as a one-item list and only that item's position is replaced", () => {
		const current = openFrame("## 목록\n\n- **첫째**: 하나\n- 둘째\n- 셋째\n\n끝 문단");
		const pos = posOf(current.state.doc, "listItem", 0);
		const unit = unitAt(format, current.state.doc, pos);
		expect(unit?.mdx).toBe("- **첫째**: 하나");
		expect(applyTranslation(format, current, unit as NonNullable<typeof unit>, "- **First**: one", pos)).toBe(
			"replaced",
		);

		const doc = current.state.doc;
		expect(doc.childCount).toBe(3);
		expect(doc.child(1).type.name).toBe("bulletList");
		expect(doc.child(1).childCount).toBe(3);
		expect(mdxOf(current.getJSON())).toContain("- **First**: one\n- <Untranslated>둘째</Untranslated>");
	});

	it("the middle item of a numbered list is also replaced in place only", () => {
		const current = openFrame("1. 하나\n2. 둘\n3. 셋");
		const pos = posOf(current.state.doc, "listItem", 1);
		const unit = unitAt(format, current.state.doc, pos);
		if (!unit) throw new Error("No unit found.");
		expect(applyTranslation(format, current, unit, "1. two", pos)).toBe("replaced");
		// The editor appends an empty paragraph at the end. The list is not split and keeps its three items.
		expect(current.state.doc.child(0).type.name).toBe("orderedList");
		expect(current.state.doc.child(0).childCount).toBe(3);
		expect(mdxOf(current.getJSON())).toContain("two");
	});

	it("a non-list result is not put in a list item position", () => {
		const current = openFrame("- 첫째\n- 둘째");
		const before = mdxOf(current.getJSON());
		const pos = posOf(current.state.doc, "listItem", 0);
		const unit = unitAt(format, current.state.doc, pos);
		if (!unit) throw new Error("No unit found.");
		expect(applyTranslation(format, current, unit, "First", pos)).toBe("invalid");
		expect(mdxOf(current.getJSON())).toBe(before);
	});

	it("a paragraph inside a callout replaces only that paragraph", () => {
		const current = openFrame('<Callout variant="info" title="주의">\n첫 문단\n\n둘째 문단\n</Callout>');
		const pos = posOf(current.state.doc, "paragraph", 1);
		const unit = unitAt(format, current.state.doc, pos);
		if (!unit) throw new Error("No unit found.");
		expect(unit.mdx).toBe("둘째 문단");
		expect(applyTranslation(format, current, unit, "Second paragraph", pos)).toBe("replaced");
		expect(current.state.doc.child(0).type.name).toBe("cmsCallout");
		expect(current.state.doc.child(0).childCount).toBe(2);
		const mdx = mdxOf(current.getJSON());
		expect(mdx).toContain("Second paragraph");
		expect(mdx).toContain("<Untranslated>첫 문단</Untranslated>");
	});

	it("does not replace if the block was edited in the meantime", () => {
		const current = openFrame("문단");
		const unit = unitAt(format, current.state.doc, 0);
		if (!unit) throw new Error("No unit found.");
		current.commands.setContent(tiptapOf("직접 쓴 번역"));
		expect(applyTranslation(format, current, unit, "Paragraph", 0)).toBe("changed");
		expect(mdxOf(current.getJSON()).trim()).toBe("직접 쓴 번역");
	});

	it("translate-all splits lists into single items and skips translated blocks", () => {
		const current = openFrame("## 제목\n\n- 하나\n- 둘\n\n문단");
		current.commands.setContent(
			tiptapOf(mdxOf(current.getJSON()).replace("<Untranslated>제목</Untranslated>", "Title")),
		);
		expect(collectUnits(format, current.state.doc).map((unit) => unit.mdx)).toEqual(["- 하나", "- 둘", "문단"]);

		for (const [unit, mdx] of collectUnits(format, current.state.doc).map(
			(unit, i) => [unit, ["- one", "- two", "Text"][i]] as const,
		)) {
			expect(applyTranslation(format, current, unit, mdx as string, null)).toBe("replaced");
		}
		expect(mdxOf(current.getJSON()).trim()).toBe("## Title\n\n- one\n- two\n\nText");
	});

	describe("blocks with ids", () => {
		/** The translation frame as a stored document, so every block has its id (as the entry screen loads it). */
		const openStored = (source: string) => {
			const hinted = withTranslationHints(source);
			editor = new Editor({
				extensions: buildEditorExtensions(),
				content: storedToTiptap({ ...hinted, content: assignBlockIds(hinted.content) }),
			});
			return editor;
		};

		it("the translated block keeps its id", () => {
			const current = openStored("첫 문단\n\n둘째 문단");
			const pos = posOf(current.state.doc, "paragraph", 1);
			const id = current.state.doc.nodeAt(pos)?.attrs[BLOCK_ID_ATTRIBUTE];
			const unit = unitAt(format, current.state.doc, pos);
			if (!unit) throw new Error("No unit found.");
			expect(applyTranslation(format, current, unit, "Second paragraph", pos)).toBe("replaced");
			const at = findBlock(current.state.doc, id);
			expect(at).toBeDefined();
			expect(current.state.doc.nodeAt(at as number)?.textContent).toBe("Second paragraph");
		});

		it("finds the block by its id after it moved", () => {
			const current = openStored("첫 문단\n\n둘째 문단");
			const pos = posOf(current.state.doc, "paragraph", 1);
			const unit = unitAt(format, current.state.doc, pos);
			if (!unit) throw new Error("No unit found.");
			// Move the second paragraph to the top.
			const node = current.state.doc.nodeAt(pos);
			if (!node) throw new Error("No node.");
			current.view.dispatch(current.state.tr.delete(pos, pos + node.nodeSize).insert(0, node));
			expect(applyTranslation(format, current, unit, "Second paragraph", pos)).toBe("replaced");
			expect(current.state.doc.child(0).textContent).toBe("Second paragraph");
		});

		it("does not replace a block with the same id whose text changed", () => {
			const current = openStored("문단");
			const unit = unitAt(format, current.state.doc, 0);
			if (!unit) throw new Error("No unit found.");
			current.commands.insertContentAt(1, "직접 ");
			expect(applyTranslation(format, current, unit, "Paragraph", 0)).toBe("changed");
		});
	});
});
