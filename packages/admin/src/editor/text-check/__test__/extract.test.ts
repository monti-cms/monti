import { buildEditorExtensions } from "@monti-cms/admin/editor";
import type { StoredDocument } from "@monti-cms/core/document";
import { Editor } from "@tiptap/core";
import { afterEach, describe, expect, it } from "vitest";
import { testSite } from "../../../../../core/test/site";
import { tiptapOf } from "../../../test/mdx";
import { codeNode, para, storedDoc, table, text } from "../../../test/stored-doc";
import { storedToTiptap } from "../../tiptap-content";
import { docRangeToSegment, extractSegments, PLACEHOLDER, segmentRangeToDoc } from "../extract";

let editor: Editor | null = null;
afterEach(() => {
	editor?.destroy();
	editor = null;
});

const open = (source: string | StoredDocument) => {
	editor = new Editor({
		extensions: buildEditorExtensions(testSite),
		content: typeof source === "string" ? tiptapOf(source) : storedToTiptap(testSite, source),
	});
	return editor;
};

const segmentsOf = (source: string | StoredDocument) => extractSegments(open(source).state.doc, { locale: "ko" });

/** The document text a paragraph-relative position points to. */
const docText = (current: Editor, from: number, to: number) => current.state.doc.textBetween(from, to);

describe("extracting check segments", () => {
	it("extracts one segment per block with text and keeps only the text of marks", () => {
		const segments = segmentsOf("## 제목입니다\n\n**굵은** 글자와 _기울인_ 글자\n\n- 목록 항목\n- 둘째 항목\n");
		expect(segments.map((segment) => segment.text)).toEqual([
			"제목입니다",
			"굵은 글자와 기울인 글자",
			"목록 항목",
			"둘째 항목",
		]);
		expect(segments.every((segment) => segment.locale === "ko")).toBe(true);
	});

	it("Korean text positions map back to document positions as is", () => {
		const current = open("안녕 **세상아** 반갑다\n");
		const [segment] = extractSegments(current.state.doc, { locale: "ko" });
		if (!segment) throw new Error("no segment");
		const start = segment.text.indexOf("세상아");
		const range = segmentRangeToDoc(segment, start, start + 3);
		expect(range && docText(current, range.from, range.to)).toBe("세상아");
	});

	it("positions after an emoji (surrogate pair) are correct too", () => {
		const current = open("좋아요 👍 맞춤법 틀린말\n");
		const [segment] = extractSegments(current.state.doc, { locale: "ko" });
		if (!segment) throw new Error("no segment");
		const start = segment.text.indexOf("틀린말");
		const range = segmentRangeToDoc(segment, start, start + 3);
		expect(range && docText(current, range.from, range.to)).toBe("틀린말");
	});

	it("inline code is replaced with a one-character placeholder and positions after it are correct", () => {
		const current = open("명령은 `pnpm install --frozen` 으로 실행합니다\n");
		const [segment] = extractSegments(current.state.doc, { locale: "ko" });
		if (!segment) throw new Error("no segment");
		expect(segment.text).toBe(`명령은 ${PLACEHOLDER} 으로 실행합니다`);
		expect(segment.text).not.toContain("pnpm");
		const start = segment.text.indexOf("실행");
		const range = segmentRangeToDoc(segment, start, start + 2);
		expect(range && docText(current, range.from, range.to)).toBe("실행");
		// Results that overlap code are not placed in the document.
		const placeholder = segment.text.indexOf(PLACEHOLDER);
		expect(segmentRangeToDoc(segment, placeholder - 1, placeholder + 1)).toBeNull();
	});

	it("sends only the text of links, not the URL", () => {
		const segments = segmentsOf(
			"[공식 문서](https://example.com/docs)를 보세요. https://example.com/raw 주소. [https://a.dev](https://a.dev)\n",
		);
		const [segment] = segments;
		if (!segment) throw new Error("no segment");
		expect(segment.text).toBe(`공식 문서를 보세요. ${PLACEHOLDER} 주소. ${PLACEHOLDER}`);
		expect(segment.text).not.toContain("example.com");
	});

	it("does not send code blocks and math blocks", () => {
		const segments = segmentsOf(
			storedDoc(
				para("앞 문단"),
				codeNode("const 틀린말 = 1;"),
				{ type: "math", attrs: { value: "x^2" } },
				para("뒤 문단"),
			),
		);
		expect(segments.map((segment) => segment.text)).toEqual(["앞 문단", "뒤 문단"]);
	});

	it("extracts table cell text one by one too", () => {
		const segments = segmentsOf(
			storedDoc(
				table([
					[[text("이름")], [text("설명")]],
					[[text("사과")], [text("빨간 과일")]],
				]),
			),
		);
		expect(segments.map((segment) => segment.text)).toEqual(["이름", "설명", "사과", "빨간 과일"]);
	});

	it("skips blocks without letters (only digits or symbols)", () => {
		expect(segmentsOf("1234\n\n---\n\n글자\n").map((segment) => segment.text)).toEqual(["글자"]);
	});

	it("paragraphs with the same text get different names, and names stay the same when another paragraph is edited", () => {
		const current = open("같은 문단\n\n같은 문단\n\n다른 문단\n");
		const before = extractSegments(current.state.doc, { locale: "ko" });
		expect(new Set(before.map((segment) => segment.id)).size).toBe(3);
		const last = before[2];
		if (!last) throw new Error("no segment");
		current.commands.insertContentAt(last.to, "이 바뀜");
		const after = extractSegments(current.state.doc, { locale: "ko" });
		expect(after[0]?.id).toBe(before[0]?.id);
		expect(after[1]?.id).toBe(before[1]?.id);
		expect(after[2]?.id).not.toBe(before[2]?.id);
	});

	it("given a range, returns only paragraphs overlapping it, with names based on the whole document", () => {
		const current = open("첫 문단\n\n둘째 문단\n\n셋째 문단\n");
		const all = extractSegments(current.state.doc, { locale: "ko" });
		const second = all[1];
		if (!second) throw new Error("no segment");
		const picked = extractSegments(current.state.doc, {
			locale: "ko",
			range: { from: second.from + 1, to: second.from + 2 },
		});
		expect(picked.map((segment) => segment.id)).toEqual([second.id]);
		expect(docRangeToSegment(second, second.from + 1, second.from + 2)).toEqual({ start: 1, end: 2 });
	});

	it("widens a zero-length result to one adjacent character and discards positions outside the paragraph", () => {
		const current = open("띄어쓰기없음\n");
		const [segment] = extractSegments(current.state.doc, { locale: "ko" });
		if (!segment) throw new Error("no segment");
		const range = segmentRangeToDoc(segment, 4, 4);
		expect(range && docText(current, range.from, range.to)).toBe("없");
		expect(segmentRangeToDoc(segment, 0, 99)).toBeNull();
		expect(segmentRangeToDoc(segment, 3, 2)).toBeNull();
	});
});
