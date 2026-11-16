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
		await expect.poll(() => frame.querySelectorAll("[data-slot=code-token]").length).toBeGreaterThan(0);
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
});
