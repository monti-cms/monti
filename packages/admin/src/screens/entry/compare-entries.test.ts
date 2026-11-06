import { describe, expect, it } from "vitest";
import { readableWordDiff } from "./compare-entries";

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
