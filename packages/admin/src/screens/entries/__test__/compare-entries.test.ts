import { unparsedDocument } from "@monti-cms/core/document";
import { describe, expect, it } from "vitest";
import { testSite } from "../../../../../core/test/site";
import { docOf } from "../../../test/mdx";
import { blockText, compareEntries, diffText, type Segment } from "../compare-entries";
import { type EntryForm, formFromEntry } from "../entry-form";
import { ENTRY } from "./entry-editor-fakes";

const labels = { slug: "주소" };
const marked = (segments: readonly Segment[]) =>
	segments.filter((segment) => segment.changed).map((segment) => segment.text);
const plain = (segments: readonly Segment[]) => segments.map((segment) => segment.text).join("");

const base = formFromEntry(testSite, ENTRY);
const withBody = (text: string, over: Partial<EntryForm> = {}): EntryForm => ({ ...base, doc: docOf(text), ...over });
const compare = (left: EntryForm, right: EntryForm) => compareEntries(testSite, "post", left, right, labels);

describe("diffText", () => {
	it("marks nothing when the texts are the same", () => {
		const result = diffText("같은 글", "같은 글");
		expect(marked(result.before)).toEqual([]);
		expect(plain(result.after)).toBe("같은 글");
	});

	it("marks only the words that are not on the other side, keeping all the text", () => {
		const result = diffText(
			"목록에는 제목만 남겼다. 나머지는 꺼내 본다.",
			"목록에는 제목만 남겼다. 설정 화면은 그대로 두었다.",
		);
		expect(marked(result.before).join("")).toBe("나머지는 꺼내 본다.");
		expect(marked(result.after).join("")).toBe("설정 화면은 그대로 두었다.");
		expect(plain(result.before)).toBe("목록에는 제목만 남겼다. 나머지는 꺼내 본다.");
	});

	it("marks every word when one side is empty, and nothing on the empty side", () => {
		const result = diffText("", "새 글");
		expect(result.before).toEqual([]);
		expect(marked(result.after)).toEqual(["새 글"]);
	});

	it("keeps a shared word in the middle unmarked", () => {
		const result = diffText("가 나 다", "라 나 마");
		expect(
			marked(result.before)
				.map((text) => text.trim())
				.filter(Boolean),
		).toEqual(["가", "다"]);
		expect(
			marked(result.after)
				.map((text) => text.trim())
				.filter(Boolean),
		).toEqual(["라", "마"]);
	});
});

describe("blockText", () => {
	it("reads the words of a block, a new line at a hard break and between list items", () => {
		const [list] = docOf("- 하나\n- 둘").content;
		expect(blockText(list as never)).toBe("하나\n둘");
		const [paragraph] = docOf("앞<br />뒤").content;
		expect(blockText(paragraph as never)).toBe("앞\n뒤");
	});
});

describe("comparing two entries", () => {
	it("has no difference between the same entry", () => {
		const result = compare(withBody("첫 문단"), withBody("첫 문단"));
		expect(result.count).toBe(0);
		expect(result.properties).toEqual([]);
		expect(result.left.flatMap((block) => marked(block.segments))).toEqual([]);
	});

	it("lists only the properties that differ, the same on both sides, with the words that differ marked", () => {
		const result = compare(
			withBody("본문", { summary: "리액트로 다시 만들며 덜어낸 것." }),
			withBody("본문", { summary: "" }),
		);
		expect(result.properties.map((property) => [property.name, property.label])).toEqual([["summary", "요약"]]);
		expect(marked(result.properties[0]?.left ?? [])).toEqual(["리액트로 다시 만들며 덜어낸 것."]);
		expect(result.properties[0]?.right).toEqual([]);
		expect(result.count).toBe(1);
	});

	it("compares the address and the title as well", () => {
		const result = compare(withBody("본문", { slug: "a" }), withBody("본문", { slug: "b", title: "다른 제목" }));
		expect(result.properties.map((property) => property.label)).toEqual(["주소"]);
		expect(marked(result.title.left)).toEqual(["테스트"]);
		expect(marked(result.title.right)).toEqual(["다른 제목"]);
		expect(result.count).toBe(2);
	});

	it("marks the words of a block that changed in place, and a block that is only on one side as a whole", () => {
		const left = withBody("# 제목\n\n목록은 짧다. 나머지는 꺼내 본다.\n\n끝 문단");
		const right = withBody(
			"# 제목\n\n목록은 짧다. 설정 화면은 그대로 두었다.\n\n끝 문단\n\n## 남긴 것\n\n블록 손잡이는 그대로",
			{},
		);
		// The right body is made from the left one, so the blocks that did not change share their block ids.
		right.doc = docOf(
			"# 제목\n\n목록은 짧다. 설정 화면은 그대로 두었다.\n\n끝 문단\n\n## 남긴 것\n\n블록 손잡이는 그대로",
			left.doc,
		);
		const result = compare(left, right);
		expect(result.left.map((block) => block.kind)).toEqual(["heading", "paragraph", "paragraph"]);
		expect(result.right.map((block) => block.kind)).toEqual([
			"heading",
			"paragraph",
			"paragraph",
			"heading",
			"paragraph",
		]);
		expect(marked(result.left[1]?.segments ?? []).join("")).toBe("나머지는 꺼내 본다.");
		expect(marked(result.right[1]?.segments ?? []).join("")).toBe("설정 화면은 그대로 두었다.");
		expect(marked(result.right[3]?.segments ?? [])).toEqual(["남긴 것"]);
		expect(marked(result.right[4]?.segments ?? [])).toEqual(["블록 손잡이는 그대로"]);
		expect(result.left.flatMap((block) => marked(block.segments)).join("")).not.toContain("끝");
		expect(result.count).toBe(3);
	});

	it("shows a body that could not be read as it is, marked whole when the other side differs", () => {
		const unreadable = { ...base, doc: unparsedDocument("<<깨진 글") };
		const result = compare(unreadable, withBody("멀쩡한 글"));
		expect(result.left[0]?.kind).toBe("code");
		expect(marked(result.left[0]?.segments ?? [])).toEqual(["<<깨진 글"]);
		expect(result.count).toBe(1);
		expect(compare(unreadable, unreadable).count).toBe(0);
	});
});
