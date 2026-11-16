import type { Block, Doc } from "@monti-cms/core";
import { describe, expect, it } from "vitest";
import { scene } from "../../test/scene";
import * as read from "./read-body.stories";

const text = (value: string) => ({ type: "text" as const, text: value });
const paragraph = (id: string, ...content: NonNullable<Block["content"]>): Block => ({
	id,
	type: "paragraph",
	content,
});
const code = (id: string, lines: string): Block => ({
	id,
	type: "codeBlock",
	attrs: { language: "ts", title: "src/counter.ts", lineNumbers: true, lines: [{ name: "plus", start: 0, end: 1 }] },
	content: [{ type: "text", text: lines }],
});

const FOLDED: Block = {
	id: "c2",
	type: "codeBlock",
	attrs: {
		language: "ts",
		rules: [{ scope: "document", name: "bold", pattern: "count", flags: "" }],
		lines: [{ name: "collapse", start: 1, end: 4 }],
	},
	content: [
		{ type: "text", text: "let count = 0;\nfunction reset() {\n  count = 0;\n}\nconst " },
		{ type: "text", text: "add", marks: [{ type: "codeTip", text: "더하기" }] },
		{ type: "text", text: " = () => count++;" },
	],
};

const MINE: Doc = {
	type: "doc",
	blocks: [
		paragraph(
			"p1",
			text("버튼을 누를 때마다 "),
			{ type: "text", text: "수를 둘 올린다", marks: [{ type: "bold" }] },
			text(" · "),
			{ type: "text", text: "문서", marks: [{ type: "link", href: "https://example.dev/docs" }] },
			text(" "),
			{ type: "text", text: "npm", marks: [{ type: "code" }] },
		),
		{ id: "h1", type: "heading", attrs: { level: 3 }, content: [{ type: "text", text: "새 제목" }] },
		code("c1", "let count = 0;\nconst add = () => count++;"),
		{
			id: "note",
			type: "callout",
			attrs: { tone: "tip", title: "알아 두세요" },
			children: [paragraph("n1", text("콜아웃 본문입니다"))],
		},
		{ id: "m1", type: "math", attrs: { source: "a^2 + b^2 = c^2" } },
		FOLDED,
	],
};
const THEIRS: Doc = {
	type: "doc",
	blocks: [
		paragraph(
			"p1",
			text("버튼을 누를 때마다 "),
			{ type: "text", text: "수를 하나 올린다", marks: [{ type: "bold" }] },
			text(" · "),
			{ type: "text", text: "문서", marks: [{ type: "link", href: "https://example.dev/docs" }] },
			text(" "),
			{ type: "text", text: "npm", marks: [{ type: "code" }] },
		),
		code("c1", "let count = 0;\nconst add = () => count--;"),
		{
			id: "note",
			type: "callout",
			attrs: { tone: "tip", title: "알아 두세요" },
			children: [paragraph("n1", text("콜아웃 본문입니다 다르게"))],
		},
		{ id: "m1", type: "math", attrs: { source: "a^2 + b^2 = d^2" } },
		FOLDED,
	],
};

const Compared = scene<read.Loaded>({ loaders: read.read(MINE, THEIRS) }, read.default);

const code2 = (id: string, title: string, text: string): Block => ({
	id,
	type: "codeBlock",
	attrs: { language: "ts", title },
	content: [{ type: "text", text }],
});
const BLOCKS: Doc = {
	type: "doc",
	blocks: [
		{
			id: "tabs",
			type: "tabs",
			children: [
				{ id: "t1", type: "tab", attrs: { label: "npm" }, children: [paragraph("t1p", text("npm install monti"))] },
				{ id: "t2", type: "tab", attrs: { label: "pnpm" }, children: [paragraph("t2p", text("pnpm add monti"))] },
			],
		},
		{
			id: "explorer",
			type: "codeExplorer",
			children: [code2("e1", "src/app.ts", "export const app = 1;"), code2("e2", "src/db.ts", "export const db = 2;")],
		},
		{
			id: "columns",
			type: "columns",
			children: [
				{ id: "k1", type: "column", children: [paragraph("k1p", text("왼쪽 단"))] },
				{ id: "k2", type: "column", children: [paragraph("k2p", text("오른쪽 단"))] },
			],
		},
	],
};
const Blocks = scene<read.Loaded>({ loaders: read.read(BLOCKS, null) }, read.default);

const TODO: Doc = {
	type: "doc",
	blocks: [
		{
			id: "todo",
			type: "checklist",
			children: [
				{ id: "i1", type: "listItem", attrs: { checked: true }, content: [text("초안 쓰기")] },
				{ id: "i2", type: "listItem", content: [text("발행하기")] },
			],
		},
		paragraph("p", { type: "text", text: "문서", marks: [{ type: "link", href: "#/c/post/abc" }] }),
	],
};
const Todo = scene<read.Loaded>({ loaders: read.read(TODO, null) }, read.default);

const Failed = scene<read.Loaded>({ loaders: read.read(MINE, THEIRS, { failCatalog: true }) }, read.default);
const Streaming = scene<read.Loaded>(
	{ loaders: read.read({ type: "doc", blocks: [FOLDED] }, null, { streaming: true }) },
	read.default,
);

const MOVED_A: Doc = { type: "doc", blocks: [paragraph("a", text("첫째 문단")), paragraph("b", text("둘째 문단"))] };
const MOVED_B: Doc = { type: "doc", blocks: [paragraph("b", text("둘째 문단")), paragraph("a", text("첫째 문단"))] };
const Moved = scene<read.Loaded>({ loaders: read.read(MOVED_A, MOVED_B) }, read.default);

const BROKEN: Doc = {
	type: "doc",
	blocks: [
		paragraph("ok", text("그려지는 문단")),
		{ id: "bad", type: "table", attrs: { rows: [null] } } as unknown as Block,
	],
};
const Broken = scene<read.Loaded>({ loaders: read.read(BROKEN, null) }, read.default);

const IMAGES = (alt: string): Doc => ({
	type: "doc",
	blocks: [{ id: "img", type: "image", attrs: { media: "m1", alt } }],
});
const Pictures = scene<read.Loaded>({ loaders: read.read(IMAGES("빌드 시간"), IMAGES("속도")) }, read.default);

const sides = () => [...document.querySelectorAll<HTMLElement>("[data-slot=compare-side]")];
const marked = (side: HTMLElement) =>
	[...side.querySelectorAll("[data-slot=highlight]")].map((each) => each.textContent?.trim());

describe("a body read without being written draws as the editor draws it", () => {
	it("[reach] bold, a link, inline code and a heading's level keep their elements, and the changed words are marked on both sides", async () => {
		await Compared.run();
		await expect.poll(() => sides()[0]?.querySelector("strong")).not.toBeNull();
		const [mine, theirs] = sides() as [HTMLElement, HTMLElement];
		expect(mine.querySelector("strong")?.textContent).toContain("둘");
		expect(mine.querySelector("a")?.getAttribute("href")).toBe("https://example.dev/docs");
		expect(mine.querySelector(":not(pre) > code")?.textContent).toBe("npm");
		// A third-level heading stays one, whatever the screen it is read on.
		expect(mine.querySelector("h3")?.textContent).toBe("새 제목");
		// The same mark on both sides, over the words that differ.
		expect(marked(mine)).toContain("둘");
		expect(marked(theirs)).toContain("하나");
		expect(theirs.querySelector("strong")?.textContent).toContain("하나");
	});

	it("[reach] a code block keeps its head, its line effects and the site's colours, and its changed words are marked", async () => {
		await Compared.run();
		await expect.poll(() => sides()[0]?.querySelector("[data-slot=code-frame]")).not.toBeNull();
		const [mine, theirs] = sides() as [HTMLElement, HTMLElement];
		const frame = mine.querySelector("[data-slot=code-frame]") as HTMLElement;
		expect(frame.textContent).toContain("src/counter.ts");
		expect(frame.querySelector("[data-slot=code-number][data-tone=plus]")).not.toBeNull();
		await expect.poll(() => frame.querySelectorAll("[data-token]").length).toBeGreaterThan(0);
		expect(marked(mine).some((words) => words?.includes("++"))).toBe(true);
		expect(marked(theirs).some((words) => words?.includes("--"))).toBe(true);
	});

	it("[reach] a site's blocks are drawn by their own drawing, and the changed words inside them and in a formula's source are marked", async () => {
		await Compared.run();
		await expect.poll(() => sides()[0]?.querySelector("[data-block=callout] [role=note]")).not.toBeNull();
		const [mine, theirs] = sides() as [HTMLElement, HTMLElement];
		expect(mine.querySelector("[data-block=callout]")?.textContent).toContain("콜아웃 본문입니다");
		expect(marked(theirs).some((words) => words?.includes("다르게"))).toBe(true);
		// A formula is drawn, and its source, where it differs, is read as code with the words marked.
		expect(mine.querySelector("[data-block=math]")?.textContent).not.toBe("");
		expect(marked(mine).some((words) => words?.includes("c^2"))).toBe(true);
	});

	it("[reach] read-only code draws a rule's text styles and a tooltip as the editor does, and a closed fold stays folded until it is opened", async () => {
		await Compared.run();
		await expect.poll(() => sides()[0]?.querySelectorAll("[data-slot=code-frame]").length).toBe(3);
		const frame = [...(sides()[0]?.querySelectorAll<HTMLElement>("[data-slot=code-frame]") ?? [])].find((each) =>
			each.textContent?.includes("function reset"),
		) as HTMLElement;
		expect(frame.querySelector("[data-effect=bold]")?.textContent).toBe("count");
		expect(frame.querySelector("[data-monti-mark=codeTip]")?.textContent).toBe("add");
		expect(frame.querySelector("[data-monti-mark=codeTip]")?.getAttribute("title")).toBe("더하기");
		// The fold's lines are hidden and its summary stands in their place, with the editor's own button to open it.
		expect(frame.querySelectorAll("[data-code-hidden]").length).toBeGreaterThan(0);
		const numbers = () => frame.querySelectorAll("[data-slot=code-number]").length;
		expect(numbers()).toBe(3);
		const open = frame.querySelector("[data-slot=code-aside] button") as HTMLButtonElement;
		expect(open.textContent).toBe("접힌 2줄");
		open.click();
		await expect.poll(numbers).toBe(5);
		expect(frame.querySelectorAll("[data-code-hidden]").length).toBe(0);
	});

	it("[reach] a site's blocks are given the blocks they hold: tabs keep their labels, a code explorer its tree and file names, columns their count", async () => {
		await Blocks.run();
		await expect.poll(() => sides()[0]?.querySelector("[role=tab]")).not.toBeNull();
		const [side] = sides() as [HTMLElement];
		expect([...side.querySelectorAll("[role=tab]")].map((tab) => tab.textContent)).toEqual(["npm", "pnpm"]);
		// The explorer names its files in its own list, and its frames do not say them again.
		expect(side.querySelector("[data-block=codeExplorer]")?.textContent).toContain("app.ts");
		expect(side.querySelector("[data-block=codeExplorer]")?.textContent).toContain("db.ts");
		const columns = side.querySelector("[data-block=columns] > *") as HTMLElement;
		const tracks = getComputedStyle(columns).gridTemplateColumns.split(" ").length;
		expect(tracks).toBe(2);
	});

	it("[reach] two blocks that swapped places are marked on both sides, though their words are the same", async () => {
		await Moved.run();
		await expect.poll(() => sides()[0]?.querySelectorAll("[data-slot=highlight]").length).toBeGreaterThan(0);
		for (const side of sides()) expect(marked(side).sort()).toEqual(["둘째 문단", "첫째 문단"].sort());
	});

	it("[reach] a to-do's box says its state and its item, read only, and a link to a place of the admin is left to the browser when pressed with Cmd or Ctrl", async () => {
		await Todo.run();
		await expect.poll(() => sides()[0]?.querySelectorAll("[role=checkbox]").length).toBe(2);
		const [side] = sides() as [HTMLElement];
		const boxes = [...side.querySelectorAll<HTMLElement>("[role=checkbox]")];
		expect(
			boxes.map((box) => [
				box.getAttribute("aria-label"),
				box.getAttribute("aria-checked"),
				box.getAttribute("aria-readonly"),
			]),
		).toEqual([
			["초안 쓰기", "true", "true"],
			["발행하기", "false", "true"],
		]);
		const link = side.querySelector("a") as HTMLAnchorElement;
		const opened = Todo.loaded().opened;
		// Whether the page's own handler took the press; the browser's own (leaving for the address) is stopped after it, so the test stays where it is.
		const press = (init: MouseEventInit) => {
			let taken = false;
			const watch = (event: Event) => {
				taken = event.defaultPrevented;
				event.preventDefault();
			};
			document.addEventListener("click", watch, { once: true });
			link.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, button: 0, ...init }));
			document.removeEventListener("click", watch);
			return taken;
		};
		expect(press({ ctrlKey: true })).toBe(false);
		expect(press({ metaKey: true })).toBe(false);
		expect(opened).toEqual([]);
		expect(press({})).toBe(true);
		expect(opened).toEqual(["#/c/post/abc"]);
	});

	it("with no catalog the bodies are their words, not blank, and a block that cannot be made is a box while the others are drawn", async () => {
		await Failed.run();
		await expect.poll(() => sides()[0]?.textContent).toContain("버튼을 누를 때마다");
		expect(sides()[1]?.textContent).toContain("버튼을 누를 때마다");
		await Broken.run();
		await expect.poll(() => sides()[0]?.textContent).toContain("그려지는 문단");
		expect(sides()[0]?.querySelector("[data-box]")).not.toBeNull();
	});

	it("[reach] a block drawn as a box says its values once: the changed ones are marked in the box, with no name line over it", async () => {
		await Pictures.run();
		await expect.poll(() => sides()[0]?.querySelector("[data-box]")).not.toBeNull();
		for (const side of sides()) {
			expect(side.querySelectorAll("[data-slot=compare-values]")).toHaveLength(0);
			expect(side.querySelector("[data-box] [data-slot=highlight]")).not.toBeNull();
		}
	});

	it("code still arriving is not coloured", async () => {
		await Streaming.run();
		await expect.poll(() => sides()[0]?.querySelectorAll("[data-slot=code-frame]").length).toBe(1);
		await new Promise((done) => setTimeout(done, 600));
		expect(sides()[0]?.querySelectorAll("[data-token]")).toHaveLength(0);
	});
});
