import type { Block, Doc, Field, Label } from "@monti-cms/core";
import { describe, expect, it } from "vitest";
import { type BlockNames, blockWords, hasMarks, readableWordDiff, sideMarks } from "./compare-entries";

const bodyWords = (doc: Doc, names?: BlockNames) => doc.blocks.map((block) => blockWords(block, names));

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

	it("18-8 a block with values has a name line; a paragraph has none; a formula's words are its source; a table's its rows", () => {
		expect(
			bodyWords(
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
			{ id: "a", text: "첫 문단" },
			{ id: "b", values: "콜아웃 · 종류 경고 · 제목 알아 두세요", text: "본문" },
			{ id: "d", values: "이미지 · 파일 build.png · 대체 텍스트 빌드 시간 · 폭 420px", text: "" },
			{ id: "e", values: "수식", text: "a^2 + b^2" },
			{ id: "f", values: "표", text: "월 | 방문\n1월 | 1200" },
			{ id: "g", values: "접기 · 펼쳐 두기", text: "안" },
			{ id: "i", values: "탭", text: "탭 하나 · 탭 이름 npm\nnpm i monti" },
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
		const ours = sideMarks(mine, server, "mine", names);
		const theirs = sideMarks(server, mine, "server", names);
		expect([ours.values.get("b"), ours.values.get("d")].map((parts) => marked(parts ?? []))).toEqual([
			["경고"],
			["speed.png"],
		]);
		expect([theirs.values.get("b"), theirs.values.get("d")].map((parts) => marked(parts ?? []))).toEqual([
			["노트"],
			["build.png"],
		]);
		// The words of the block inside the callout are its own, found by its id.
		expect(marked(ours.words.get("c") ?? [])).toEqual([]);
		// Without the site's names (the translation's side view), no block has a name line.
		expect(sideMarks(mine, server, "mine").values.size).toBe(0);
	});

	it("18-8 a block the other side lacks is marked whole, at any depth; the blocks around it are read as they are", () => {
		const mine = doc(p("a", "같은 문단"), {
			id: "b",
			type: "callout",
			attrs: { tone: "note" },
			children: [p("c", "안에 새로 넣은 문단")],
		});
		const server = doc(p("a", "같은 문단"), { id: "b", type: "callout", attrs: { tone: "note" }, children: [] });
		const marks = sideMarks(mine, server, "mine", names);
		expect(marks.words.get("a")?.some((part) => part.changed)).toBe(false);
		expect(marked(marks.words.get("c") ?? [])).toEqual(["안에 새로 넣은 문단"]);
		// `only` marks the top-level blocks it names: the others are not in the marks.
		expect([...sideMarks(mine, server, "mine", names, new Set(["b"])).words.keys()]).toEqual(["c"]);
	});

	it("04-2 two list items that swapped places are marked on both sides, and a block put in among them moves none", () => {
		const list = (...ids: string[]): Doc =>
			doc({
				id: "l",
				type: "bulletList",
				children: ids.map((id) => ({ id, type: "listItem", content: [{ type: "text", text: `항목 ${id}` }] })),
			});
		const swapped = sideMarks(list("a", "b"), list("b", "a"), "mine", names);
		expect(marked(swapped.words.get("a") ?? [])).toEqual(["항목 a"]);
		expect(marked(swapped.words.get("b") ?? [])).toEqual(["항목 b"]);
		expect(marked(sideMarks(list("b", "a"), list("a", "b"), "server", names).words.get("a") ?? [])).toEqual(["항목 a"]);
		// A new item in front moves no other one.
		const put = sideMarks(list("n", "a", "b"), list("a", "b"), "mine", names);
		expect(marked(put.words.get("a") ?? [])).toEqual([]);
		expect(marked(put.words.get("n") ?? [])).toEqual(["항목 n"]);
	});

	it("04-2 a block moved between containers is marked with the words it holds, and so is a container that moved", () => {
		const callout = (id: string, ...children: Block[]): Block => ({
			id,
			type: "callout",
			attrs: { tone: "note" },
			children,
		});
		const before = doc(callout("x", p("m", "옮길 문단")), callout("y"));
		const after = doc(callout("x"), callout("y", p("m", "옮길 문단")));
		expect(marked(sideMarks(after, before, "mine", names).words.get("m") ?? [])).toEqual(["옮길 문단"]);
		expect(marked(sideMarks(before, after, "server", names).words.get("m") ?? [])).toEqual(["옮길 문단"]);
		// A container that swapped with another: the words inside it are marked, though they stayed where they were in it.
		const two = doc(callout("x", p("m", "첫째")), callout("y", p("n", "둘째")));
		const swap = doc(callout("y", p("n", "둘째")), callout("x", p("m", "첫째")));
		expect(marked(sideMarks(swap, two, "mine", names).words.get("n") ?? [])).toEqual(["둘째"]);
	});

	it("10-1 [AS-09] the same words with other marks are marked on the words whose marks differ, and a change with no words to mark says its kind", () => {
		const bold = (...marks: { type: string }[]): Doc =>
			doc({
				id: "p",
				type: "paragraph",
				content: [
					{ type: "text", text: "앞 " },
					{ type: "text", text: "굵은 말", ...(marks.length ? { marks } : {}) },
					{ type: "text", text: " 뒤" },
				],
			});
		const was = sideMarks(bold(), bold({ type: "bold" }), "mine", names);
		const now = sideMarks(bold({ type: "bold" }), bold(), "server", names);
		expect(marked(was.words.get("p") ?? [])).toEqual(["굵은 말"]);
		expect(marked(now.words.get("p") ?? [])).toEqual(["굵은 말"]);
		// Nothing but the alignment changed: no word is marked, so the block's name line is.
		const aligned = (align?: string): Doc => doc({ ...p("a", "같은 말"), ...(align ? { attrs: { align } } : {}) });
		const line = sideMarks(aligned("center"), aligned(), "mine", names);
		expect(marked(line.words.get("a") ?? [])).toEqual([]);
		expect(marked(line.values.get("a") ?? [])).toEqual(["blocks.paragraph"]);
		expect(hasMarks(line)).toBe(true);
		expect(hasMarks(sideMarks(aligned(), aligned(), "mine", names))).toBe(false);
	});

	it("04-2 a table's rows are as wide as the widest, so a short row reads as the editor draws it", () => {
		const table = doc({ id: "t", type: "table", attrs: { rows: [["a", "b", "c"], ["d"]] } });
		const marks = sideMarks(table, null, "mine", names);
		expect(
			marks.words
				.get("t")
				?.map((part) => part.text)
				.join(""),
		).toBe("a | b | c\nd |  | ");
	});

	it("04-2 a table's words are its cells in order, so the marks can be laid back on its cells", () => {
		const table = (cell: string): Doc =>
			doc({
				id: "t",
				type: "table",
				attrs: {
					header: true,
					rows: [
						["월", "방문"],
						["1월", cell],
					],
				},
			});
		const marks = sideMarks(table("1200"), table("1300"), "mine", names);
		expect(
			marks.words
				.get("t")
				?.map((part) => part.text)
				.join(""),
		).toBe("월 | 방문\n1월 | 1200");
		expect(marked(marks.words.get("t") ?? [])).toEqual(["1200"]);
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
		const a = code({ lines: [{ name: "plus", start: 1, end: 3 }] });
		const b = code({
			lines: [
				{ name: "plus", start: 2, end: 3 },
				{ name: "anchor", start: 0, end: 1, attrs: { id: "c1" } },
			],
		});
		const mine = sideMarks(a, b, "mine");
		const server = sideMarks(b, a, "server");
		expect(mine.words.get("b1")?.some((part) => part.changed)).toBe(false);
		expect(mine.code.get("b1")).toEqual({ lines: [1], language: false, title: false });
		expect(server.code.get("b1")?.lines).toEqual([1]);
		expect(blockWords(a.blocks[0] as Block).code?.lines).toEqual([[], ["plus"], ["plus"]]);
	});
	it("17-11 a language or a file name changed alone is a change too; the same block is none", () => {
		expect(sideMarks(code({ title: "a.ts" }), code({ language: "js" }), "mine").code.get("b1")).toEqual({
			lines: [],
			language: true,
			title: true,
		});
		expect(sideMarks(code({}), code({}), "mine").code.get("b1")).toEqual({ lines: [], language: false, title: false });
	});
	it("17-11 a line put in on one side pairs the rest by their words: only a line whose own effects differ is a change", () => {
		const withLine = (text: string, lines: unknown[]): Doc => ({
			type: "doc",
			blocks: [{ id: "b1", type: "codeBlock", attrs: { lines }, content: [{ type: "text", text }] } as Block],
		});
		const mine = sideMarks(
			withLine("new\na\nb\nc", [{ name: "plus", start: 2, end: 3 }]),
			withLine("a\nb\nc", [{ name: "plus", start: 1, end: 2 }]),
			"mine",
		);
		expect(mine.code.get("b1")?.lines).toEqual([]);
	});
});

describe("a code explorer's files in the comparison (doc 18 with doc 17)", () => {
	const words: Record<string, string> = { "code.effect.plus": "더함", "code.effect.highlight": "강조" };
	const names: BlockNames = {
		block: (type) =>
			type === "codeExplorer" ? { label: { ko: "코드 탐색기", en: "Code explorer" }, fields: {} } : undefined,
		say: (label) => (typeof label === "string" ? label : "key" in label ? (words[label.key] ?? label.key) : label.ko),
	};
	const explorer = (lines: unknown[]): Doc => ({
		type: "doc",
		blocks: [
			{
				id: "e",
				type: "codeExplorer",
				children: [
					{
						id: "f",
						type: "codeBlock",
						attrs: { title: "src/app.ts", lines },
						content: [{ type: "text", text: "a\nb" }],
					},
				],
			} as Block,
		],
	});
	it("18-8 a file says its path over its code in a line, and a change of its line effects alone is a change of its lines", () => {
		const a = explorer([{ name: "plus", start: 1, end: 2 }]);
		const b = explorer([{ name: "highlight", start: 0, end: 2 }]);
		expect(bodyWords(a, names)[0]?.text).toBe("src/app.ts\na\nb\n더함 2");
		expect(bodyWords(b, names)[0]?.text).toBe("src/app.ts\na\nb\n강조 1–2");
		// The file's frame is drawn by `ReadBody`: the lines whose effects differ are what it marks.
		expect(sideMarks(a, b, "mine", names).code.get("f")?.lines).toEqual([0, 1]);
	});
});
