import { buildEditorExtensions, mdxToTiptap } from "@monti-cms/admin/editor";
import { Editor } from "@tiptap/core";
import { afterEach, describe, expect, it } from "vitest";
import { docRangeToSegment, extractSegments, PLACEHOLDER, segmentRangeToDoc } from "../extract";

let editor: Editor | null = null;
afterEach(() => {
	editor?.destroy();
	editor = null;
});

const open = (mdx: string) => {
	editor = new Editor({ extensions: buildEditorExtensions(), content: mdxToTiptap(mdx) });
	return editor;
};

const segmentsOf = (mdx: string) => extractSegments(open(mdx).state.doc, { locale: "ko" });

/** 문단 안 위치가 가리키는 문서 글자. */
const docText = (current: Editor, from: number, to: number) => current.state.doc.textBetween(from, to);

describe("검사 단위 뽑기", () => {
	it("글이 든 블록마다 하나씩 뽑고 마크는 글자만 남긴다", () => {
		const segments = segmentsOf("## 제목입니다\n\n**굵은** 글자와 _기울인_ 글자\n\n- 목록 항목\n- 둘째 항목\n");
		expect(segments.map((segment) => segment.text)).toEqual([
			"제목입니다",
			"굵은 글자와 기울인 글자",
			"목록 항목",
			"둘째 항목",
		]);
		expect(segments.every((segment) => segment.locale === "ko")).toBe(true);
	});

	it("한글 글자 위치가 문서 위치로 그대로 돌아간다", () => {
		const current = open("안녕 **세상아** 반갑다\n");
		const [segment] = extractSegments(current.state.doc, { locale: "ko" });
		if (!segment) throw new Error("no segment");
		const start = segment.text.indexOf("세상아");
		const range = segmentRangeToDoc(segment, start, start + 3);
		expect(range && docText(current, range.from, range.to)).toBe("세상아");
	});

	it("이모지(서로게이트 쌍) 뒤의 위치도 맞는다", () => {
		const current = open("좋아요 👍 맞춤법 틀린말\n");
		const [segment] = extractSegments(current.state.doc, { locale: "ko" });
		if (!segment) throw new Error("no segment");
		const start = segment.text.indexOf("틀린말");
		const range = segmentRangeToDoc(segment, start, start + 3);
		expect(range && docText(current, range.from, range.to)).toBe("틀린말");
	});

	it("인라인 코드는 자리 표시 한 글자로 바꾸고 그 뒤 위치도 맞는다", () => {
		const current = open("명령은 `pnpm install --frozen` 으로 실행합니다\n");
		const [segment] = extractSegments(current.state.doc, { locale: "ko" });
		if (!segment) throw new Error("no segment");
		expect(segment.text).toBe(`명령은 ${PLACEHOLDER} 으로 실행합니다`);
		expect(segment.text).not.toContain("pnpm");
		const start = segment.text.indexOf("실행");
		const range = segmentRangeToDoc(segment, start, start + 2);
		expect(range && docText(current, range.from, range.to)).toBe("실행");
		// 코드에 걸친 결과는 문서에 놓지 않는다.
		const placeholder = segment.text.indexOf(PLACEHOLDER);
		expect(segmentRangeToDoc(segment, placeholder - 1, placeholder + 1)).toBeNull();
	});

	it("링크는 글자만 보내고 주소는 보내지 않는다", () => {
		const segments = segmentsOf(
			"[공식 문서](https://example.com/docs)를 보세요. https://example.com/raw 주소. [https://a.dev](https://a.dev)\n",
		);
		const [segment] = segments;
		if (!segment) throw new Error("no segment");
		expect(segment.text).toBe(`공식 문서를 보세요. ${PLACEHOLDER} 주소. ${PLACEHOLDER}`);
		expect(segment.text).not.toContain("example.com");
	});

	it("코드 블록과 수식 블록은 보내지 않는다", () => {
		const segments = segmentsOf("앞 문단\n\n```ts\nconst 틀린말 = 1;\n```\n\n$$\nx^2\n$$\n\n뒤 문단\n");
		expect(segments.map((segment) => segment.text)).toEqual(["앞 문단", "뒤 문단"]);
	});

	it("표 칸의 글도 하나씩 뽑는다", () => {
		const segments = segmentsOf("| 이름 | 설명 |\n| --- | --- |\n| 사과 | 빨간 과일 |\n");
		expect(segments.map((segment) => segment.text)).toEqual(["이름", "설명", "사과", "빨간 과일"]);
	});

	it("글자가 없는 블록(숫자·기호만)은 뺀다", () => {
		expect(segmentsOf("1234\n\n---\n\n글자\n").map((segment) => segment.text)).toEqual(["글자"]);
	});

	it("같은 글자의 문단은 이름이 다르고, 다른 문단을 고쳐도 이름이 그대로다", () => {
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

	it("범위를 주면 그 범위에 걸친 문단만, 이름은 문서 전체 기준으로 돌려준다", () => {
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

	it("길이 0인 결과는 옆 글자 하나로 넓히고, 문단을 벗어난 위치는 버린다", () => {
		const current = open("띄어쓰기없음\n");
		const [segment] = extractSegments(current.state.doc, { locale: "ko" });
		if (!segment) throw new Error("no segment");
		const range = segmentRangeToDoc(segment, 4, 4);
		expect(range && docText(current, range.from, range.to)).toBe("없");
		expect(segmentRangeToDoc(segment, 0, 99)).toBeNull();
		expect(segmentRangeToDoc(segment, 3, 2)).toBeNull();
	});
});
