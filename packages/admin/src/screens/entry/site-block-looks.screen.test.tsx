import type { Block, Doc } from "@monti-cms/core";
import { describe, expect, it } from "vitest";
import { page } from "vitest/browser";
import { scene } from "../../../test/scene";
import * as blocks from "./site-blocks.stories";

const on = (doc: Doc) => scene<blocks.Loaded>({ loaders: blocks.site(doc) }, blocks.default);
const body = () => page.getByRole("textbox", { name: "본문" });
const p = (id: string, text: string): Block => ({ id, type: "paragraph", content: [{ type: "text", text }] });

describe("the looks of the site's blocks in the editor (doc 18)", () => {
	it("18-4 a callout in the editor is the bar and the icon, its words the body's size, and the space under its words is the space over its title", async () => {
		const made = on({
			type: "doc",
			blocks: [
				p("s", "A paragraph outside."),
				{
					id: "callout",
					type: "callout",
					attrs: { tone: "tip", title: "알아 두세요" },
					children: [p("c", "콜아웃 본문")],
				},
			],
		});
		await made.run();
		await expect.element(body().getByText("콜아웃 본문")).toBeVisible();
		const text = body().element();
		const box = text.querySelector<HTMLElement>('[role="note"]') as HTMLElement;
		const style = getComputedStyle(box);
		expect(style.borderLeftWidth).toBe("4px");
		expect(style.borderTopWidth).toBe("0px");
		expect(style.borderTopLeftRadius).toBe("0px");
		const title = box.querySelector<HTMLElement>(".monti-block-callout-title") as HTMLElement;
		const icon = getComputedStyle(title, "::before");
		expect(icon.maskImage || icon.webkitMaskImage).toContain("svg");
		// The icon is drawn in the text colour, as on the site.
		expect(icon.backgroundColor).toBe(getComputedStyle(title).color);
		// The words are the body's size, not a smaller one of the block's own (EE-06).
		const outside = text.querySelector("p") as HTMLElement;
		const inside = box.querySelector<HTMLElement>(".monti-block-callout-body p") as HTMLElement;
		expect(getComputedStyle(inside).fontSize).toBe(getComputedStyle(outside).fontSize);
		const over = title.getBoundingClientRect().top - box.getBoundingClientRect().top;
		const under = box.getBoundingClientRect().bottom - inside.getBoundingClientRect().bottom;
		expect(Math.abs(under - over)).toBeLessThanOrEqual(2);
	});

	it("18-5 the editor's tabs are the folder tabs: the open tab joins the box under it, the box has one frame and its top-left corner is square", async () => {
		const made = on({
			type: "doc",
			blocks: [
				{
					id: "tabs",
					type: "tabs",
					children: [
						{ id: "t1", type: "tab", attrs: { label: "npm" }, children: [p("t1p", "npm install monti")] },
						{ id: "t2", type: "tab", attrs: { label: "pnpm" }, children: [p("t2p", "pnpm add monti")] },
					],
				},
			],
		});
		await made.run();
		await expect.element(body().getByText("npm install monti")).toBeVisible();
		const text = body().element();
		// The tabs' own view loads the first time they are drawn: until then it is the site's drawing.
		await expect.poll(() => text.querySelector('[data-slot="folder-tabs-body"]'), { timeout: 15_000 }).not.toBeNull();
		const open = text.querySelector<HTMLElement>('[data-slot="folder-tab-edit"]') as HTMLElement;
		const other = text.querySelector<HTMLElement>('[data-slot="folder-tab"]') as HTMLElement;
		const box = text.querySelector<HTMLElement>('[data-slot="folder-tabs-body"]') as HTMLElement;
		// No line under the open tab (its bottom edge is its own ground, over the box's top line); the closed tab keeps its line.
		expect(getComputedStyle(open).borderBottomColor).toBe(getComputedStyle(open).backgroundColor);
		expect(getComputedStyle(other).borderBottomColor).not.toBe(getComputedStyle(other).backgroundColor);
		expect(getComputedStyle(open).borderTopLeftRadius).toBe("8px");
		expect(getComputedStyle(open).borderBottomLeftRadius).toBe("0px");
		const frame = getComputedStyle(box);
		for (const side of ["Top", "Right", "Bottom", "Left"] as const) expect(frame[`border${side}Width`]).toBe("1px");
		expect(frame.borderTopLeftRadius).toBe("0px");
		expect(frame.borderBottomRightRadius).toBe("8px");
		expect(Math.round(open.getBoundingClientRect().bottom - box.getBoundingClientRect().top)).toBe(1);
		// One frame: what is inside the box has no ground or line of its own.
		for (const inside of box.querySelectorAll(".monti-block-tabs-content, .monti-block-tabs-content *")) {
			const style = getComputedStyle(inside);
			expect(style.backgroundColor, inside.className).toBe("rgba(0, 0, 0, 0)");
			expect(style.borderTopWidth).toBe("0px");
		}
		// A tab is never wider than its name: "pnpm" is its words and its padding in a row that fits.
		const words = document.createRange();
		words.selectNodeContents(other.querySelector("[data-name]") as Element);
		const sides = getComputedStyle(other);
		expect(other.getBoundingClientRect().width).toBeCloseTo(
			words.getBoundingClientRect().width +
				Number.parseFloat(sides.paddingLeft) +
				Number.parseFloat(sides.paddingRight) +
				2,
			0,
		);
		// The row has no scroll of its own up and down.
		const row = text.querySelector<HTMLElement>('[data-slot="folder-tabs-list"]') as HTMLElement;
		expect(row.scrollHeight).toBeLessThanOrEqual(row.clientHeight + 1);
		expect(getComputedStyle(row).overflowX).toBe("auto");
		expect(getComputedStyle(row).overflowY).toBe("hidden");
		// Narrowed until the tabs overflow, the row scrolls sideways, not up and down, and not the block.
		const block = text.querySelector<HTMLElement>('[data-block="tabs"]') as HTMLElement;
		block.style.width = "120px";
		await expect.poll(() => row.scrollWidth > row.clientWidth).toBe(true);
		expect(row.scrollHeight).toBeLessThanOrEqual(row.clientHeight + 1);
		expect(box.getBoundingClientRect().width).toBeLessThanOrEqual(block.getBoundingClientRect().width + 1);
		expect(open.getBoundingClientRect().bottom).toBeLessThanOrEqual(row.getBoundingClientRect().bottom + 0.5);
	});

	it("18-4 code in a callout is one grey box with no line of its own, as on the site", async () => {
		const made = on({
			type: "doc",
			blocks: [
				{
					id: "callout",
					type: "callout",
					attrs: { tone: "tip", title: "알아 두세요" },
					children: [
						{
							id: "k",
							type: "codeBlock",
							attrs: { language: "ts" },
							content: [{ type: "text", text: "const a = 1;" }],
						},
					],
				},
			],
		});
		await made.run();
		await expect.element(body().getByText("const a")).toBeVisible();
		const callout = body().element().querySelector<HTMLElement>(".monti-block-callout-body") as HTMLElement;
		const frame = callout.querySelector<HTMLElement>('[data-slot="code-frame"]') as HTMLElement;
		for (let at: HTMLElement | null = frame; at && at !== callout; at = at.parentElement)
			for (const side of ["Top", "Right", "Bottom", "Left"] as const)
				expect(getComputedStyle(at)[`border${side}Width`], `${at.dataset.slot ?? at.tagName}`).toBe("0px");
		expect(getComputedStyle(frame).backgroundColor).not.toBe("rgba(0, 0, 0, 0)");
	});

	it("17-4 a comment is italic and a function's name bold in the editor's code, from the theme's font style", async () => {
		const made = on({
			type: "doc",
			blocks: [
				{
					id: "k",
					type: "codeBlock",
					attrs: { language: "ts" },
					content: [{ type: "text", text: "// a note\nfunction add(a: number) {}" }],
				},
			],
		});
		await made.run();
		await expect
			.poll(() => body().element().querySelectorAll("[data-token]").length, { timeout: 15_000 })
			.toBeGreaterThan(0);
		const tokens = [...body().element().querySelectorAll<HTMLElement>("[data-token]")];
		const word = (text: string) => tokens.find((token) => token.textContent?.includes(text)) as HTMLElement;
		expect(getComputedStyle(word("a note")).fontStyle).toBe("italic");
		expect(getComputedStyle(word("add")).fontWeight).toBe("700");
	});

	it("18-4 a footnote's number sits against the word it follows, with no gap of a space", async () => {
		const made = on({
			type: "doc",
			blocks: [
				{
					id: "para",
					type: "paragraph",
					content: [
						{ type: "text", text: "각주가 붙은 말" },
						{ type: "footnoteRef", id: "1" },
					],
				},
				{ id: "note", type: "footnote", attrs: { id: "1" }, content: [{ type: "text", text: "각주의 글" }] },
			],
		});
		await made.run();
		await expect.element(body().getByText("각주가 붙은 말")).toBeVisible();
		const reference = body().element().querySelector<HTMLElement>("[data-footnote-ref]") as HTMLElement;
		const word = reference.previousSibling as Text;
		const range = document.createRange();
		range.selectNodeContents(word);
		expect(reference.getBoundingClientRect().left - range.getBoundingClientRect().right).toBeLessThanOrEqual(2);
	});
});
