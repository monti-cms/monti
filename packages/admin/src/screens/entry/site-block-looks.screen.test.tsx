import type { Block, Doc } from "@monti-cms/core";
import { describe, expect, it } from "vitest";
import { page } from "vitest/browser";
import { scene } from "../../../test/scene";
import * as blocks from "./site-blocks.stories";

const on = (doc: Doc) => scene<blocks.Loaded>({ loaders: blocks.site(doc) }, blocks.default);
const body = () => page.getByRole("textbox", { name: "본문" });
const p = (id: string, text: string): Block => ({ id, type: "paragraph", content: [{ type: "text", text }] });
const px = (value: string) => Number.parseFloat(value);

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
		// The words are the body's size, not a smaller one of the block's own (EE-06).
		const outside = text.querySelector("p") as HTMLElement;
		const inside = box.querySelector<HTMLElement>(".monti-block-callout-body p") as HTMLElement;
		expect(getComputedStyle(inside).fontSize).toBe(getComputedStyle(outside).fontSize);
		console.log(
			"DOM",
			box.outerHTML.replace(/ class="[^"]*"/g, (m) => (m.includes("monti-block") ? m : "")).slice(0, 1500),
		);
		const over = title.getBoundingClientRect().top - box.getBoundingClientRect().top;
		const under = box.getBoundingClientRect().bottom - inside.getBoundingClientRect().bottom;
		expect(Math.abs(under - over)).toBeLessThanOrEqual(2);
	});

	it("18-5 the open tab's panel in the editor has no box of its own", async () => {
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
		for (const panel of body()
			.element()
			.querySelectorAll<HTMLElement>(".monti-block-tabs-panel, .monti-block-tabs-content")) {
			const style = getComputedStyle(panel);
			expect(style.backgroundColor).toBe("rgba(0, 0, 0, 0)");
			for (const side of ["Top", "Right", "Bottom", "Left"] as const) expect(px(style[`border${side}Width`])).toBe(0);
			expect(px(style.paddingLeft)).toBe(0);
		}
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
