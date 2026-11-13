import type { Block, Doc, Field, Label } from "@monti-cms/core";
import { describe, expect, it } from "vitest";
import { type BlockNames, compareBodies, readableWordDiff, shownBlocks } from "./compare-entries";

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

describe("blocks that hold values, in the comparison (doc 18, T197)", () => {
	const fields = {
		tone: {
			label: { ko: "종류", en: "Kind" },
			options: { note: { ko: "노트", en: "Note" }, warning: { ko: "경고", en: "Warning" } },
		},
		title: { label: { ko: "제목", en: "Title" } },
	};
	const catalog: Record<
		string,
		{ label: Label; fields?: Record<string, Field> | null; fence?: { language: string; attr: string } }
	> = {
		paragraph: { label: { key: "blocks.paragraph" } },
		image: { label: { key: "blocks.image" } },
		table: { label: { key: "blocks.table" } },
		callout: { label: { ko: "콜아웃", en: "Callout" }, fields },
		collapsible: {
			label: { ko: "접기", en: "Collapsible" },
			fields: { defaultOpen: { label: { ko: "펼쳐 두기", en: "Open at first" } } },
		},
		math: {
			label: { ko: "수식", en: "Math" },
			fields: { source: { label: "수식" } },
			fence: { language: "math", attr: "source" },
		},
		tabs: { label: { ko: "탭", en: "Tabs" }, fields: {} },
		tab: {
			label: { ko: "탭 하나", en: "Tab" },
			fields: { label: { label: { ko: "탭 이름", en: "Tab name" } } },
		},
	};
	const words: Record<string, string> = {
		"blocks.image": "이미지",
		"blocks.table": "표",
		"compare.value.file": "파일",
		"compare.value.alt": "대체 텍스트",
		"compare.value.caption": "캡션",
		"compare.value.width": "폭",
	};
	const names: BlockNames = {
		block: (type) => catalog[type],
		say: (label) =>
			typeof label === "string" ? (words[label] ?? label) : "key" in label ? (words[label.key] ?? label.key) : label.ko,
		file: (media) => ({ m1: "build.png", m2: "speed.png" })[media],
	};
	const p = (id: string, text: string): Block => ({ id, type: "paragraph", content: [{ type: "text", text }] });
	const doc = (...blocks: Block[]): Doc => ({ type: "doc", blocks });

	it("18-8 a block with values has a name line; a paragraph has none; a formula reads as code; a table as its rows", () => {
		expect(
			shownBlocks(
				doc(
					p("a", "첫 문단"),
					{ id: "b", type: "callout", attrs: { tone: "warning", title: "알아 두세요" }, children: [p("c", "본문")] },
					{ id: "d", type: "image", attrs: { media: "m1", alt: "빌드 시간", width: 420 } },
					{ id: "e", type: "math", attrs: { source: "a^2 + b^2" } },
					{
						id: "f",
						type: "table",
						attrs: {
							header: true,
							rows: [
								["월", "방문"],
								["1월", "1200"],
							],
						},
					},
					{ id: "g", type: "collapsible", attrs: { defaultOpen: true }, children: [p("h", "안")] },
					{
						id: "i",
						type: "tabs",
						children: [{ id: "j", type: "tab", attrs: { label: "npm" }, children: [p("k", "npm i monti")] }],
					},
				),
				names,
			),
		).toEqual([
			{ id: "a", look: "text", text: "첫 문단" },
			{ id: "b", look: "text", values: "콜아웃 · 종류 경고 · 제목 알아 두세요", text: "본문" },
			{ id: "d", look: "text", values: "이미지 · 파일 build.png · 대체 텍스트 빌드 시간 · 폭 420px", text: "" },
			{ id: "e", look: "code", values: "수식", text: "a^2 + b^2" },
			{ id: "f", look: "text", values: "표", text: "월 | 방문\n1월 | 1200" },
			{ id: "g", look: "text", values: "접기 · 펼쳐 두기", text: "안" },
			{ id: "i", look: "text", values: "탭", text: "탭 하나 · 탭 이름 npm\nnpm i monti" },
		]);
	});

	it("18-8 a changed value is marked word by word, as a changed word is; with no names the comparison is as before", () => {
		const mine = doc(
			{ id: "b", type: "callout", attrs: { tone: "warning", title: "알아 두세요" }, children: [p("c", "본문")] },
			{ id: "d", type: "image", attrs: { media: "m2", alt: "빌드 시간" } },
		);
		const server = doc(
			{ id: "b", type: "callout", attrs: { tone: "note", title: "알아 두세요" }, children: [p("c", "본문")] },
			{ id: "d", type: "image", attrs: { media: "m1", alt: "빌드 시간" } },
		);
		const { mine: ours, server: theirs } = compareBodies(mine, server, names);
		expect(ours.map((block) => marked(block.valueParts ?? []))).toEqual([["경고"], ["speed.png"]]);
		expect(theirs.map((block) => marked(block.valueParts ?? []))).toEqual([["노트"], ["build.png"]]);
		expect(ours.map((block) => marked(block.parts))).toEqual([[], []]);
		// Without the site's names (the translation's side view), the blocks read as their words, as they did.
		expect(compareBodies(mine, server).mine.map((block) => [block.text, "valueParts" in block])).toEqual([
			["본문", false],
			["", false],
		]);
	});
});
