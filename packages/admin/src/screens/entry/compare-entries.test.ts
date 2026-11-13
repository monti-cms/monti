import type { Block, Doc } from "@monti-cms/core";
import { describe, expect, it } from "vitest";
import { compareBodies, readableWordDiff } from "./compare-entries";

const marked = (parts: { text: string; changed: boolean }[]) =>
	parts.filter((part) => part.changed).map((part) => part.text.trim());

describe("the source's changed words, grouped to read", () => {
	it("04-2 two runs that swapped places are one changed stretch on each side, with no direction made up", () => {
		const { mine, server } = readableWordDiff(
			"블로그를 다시 만들기로 한 건 글을 쓰는 시간보다 도구를 고치는 시간이 길어졌기 때문이다.",
			"블로그를 다시 만들기로 한 건 도구를 고치는 시간이 글을 쓰는 시간보다 길어졌기 때문이다.",
		);
		expect(marked(mine)).toEqual(["글을 쓰는 시간보다 도구를 고치는 시간이"]);
		expect(marked(server)).toEqual(["도구를 고치는 시간이 글을 쓰는 시간보다"]);
	});

	it("04-2 two changes far apart stay two: the long same words between them are not marked", () => {
		const { mine, server } = readableWordDiff(
			"처음 쓴 말 그리고 그 사이에 길게 이어지는 같은 말들이 여기에 많이 있다 끝 말",
			"새로 쓴 말 그리고 그 사이에 길게 이어지는 같은 말들이 여기에 많이 있다 끝 문장",
		);
		expect(marked(mine)).toEqual(["처음", "말"]);
		expect(marked(server)).toEqual(["새로", "문장"]);
	});

	it("04-2 a word replaced by another is marked on both sides, and nothing else", () => {
		const { mine, server } = readableWordDiff("목록에는 제목과 주소만 남겼다.", "목록에는 제목과 상태만 남겼다.");
		expect(marked(mine)).toEqual(["주소만"]);
		expect(marked(server)).toEqual(["상태만"]);
	});
});

describe("a code block whose effects changed", () => {
	const code = (attrs: Record<string, unknown>): Doc => ({
		type: "doc",
		blocks: [
			{
				id: "b1",
				type: "codeBlock",
				attrs: { language: "ts", ...attrs },
				content: [{ type: "text", text: "a\nb\nc" }],
			} as Block,
		],
	});
	it("17-11 the same code with other line effects is a change on the lines whose effects differ, and no word is marked", () => {
		const { mine, server } = compareBodies(
			code({ lines: [{ name: "plus", start: 1, end: 3 }] }),
			code({
				lines: [
					{ name: "plus", start: 2, end: 3 },
					{ name: "anchor", start: 0, end: 1, attrs: { id: "c1" } },
				],
			}),
		);
		expect(mine[0].parts.some((part) => part.changed)).toBe(false);
		expect(mine[0].changes).toEqual({ lines: [1], language: false, title: false });
		expect(server[0].changes.lines).toEqual([1]);
		expect(mine[0].code?.lines).toEqual([[], ["plus"], ["plus"]]);
	});
	it("17-11 a language or a file name changed alone is a change too; the same block is none", () => {
		expect(compareBodies(code({ title: "a.ts" }), code({ language: "js" })).mine[0].changes).toEqual({
			lines: [],
			language: true,
			title: true,
		});
		expect(compareBodies(code({}), code({})).mine[0].changes).toEqual({ lines: [], language: false, title: false });
	});
	it("17-11 a line put in on one side pairs the rest by their words: only a line whose own effects differ is a change", () => {
		const withLine = (text: string, lines: unknown[]): Doc => ({
			type: "doc",
			blocks: [{ id: "b1", type: "codeBlock", attrs: { lines }, content: [{ type: "text", text }] } as Block],
		});
		const { mine } = compareBodies(
			withLine("new\na\nb\nc", [{ name: "plus", start: 2, end: 3 }]),
			withLine("a\nb\nc", [{ name: "plus", start: 1, end: 2 }]),
		);
		expect(mine[0].changes.lines).toEqual([]);
	});
});
