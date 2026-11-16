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
});
