import { describe, expect, it } from "vitest";
import { page } from "vitest/browser";
import { render } from "../test/render";
import { ListSection, ListSectionRow, MenuField } from "./index";

const family = (element: Element) => getComputedStyle(element).fontFamily;
/** How wide an element's words are, cut or not. */
function wordsWidth(element: Element) {
	const range = document.createRange();
	range.selectNodeContents(element);
	return range.getBoundingClientRect().width;
}
const isMono = (element: Element) => /mono/i.test(family(element));

describe("MenuField", () => {
	it("a meta longer than the field gives way and is cut: the value keeps its room and nothing leaves the field", async () => {
		const long = "A key named with every word its owner could think of, far longer than the field";
		render(
			<div className="w-[320px]">
				<MenuField aria-label="Quick tasks" value="claude-haiku-5-5" meta={long} mono />
			</div>,
		);
		await expect.element(page.getByRole("button", { name: "Quick tasks" })).toBeVisible();
		const field = page.getByRole("button", { name: "Quick tasks" }).element();
		expect(field.scrollWidth).toBeLessThanOrEqual(field.clientWidth);
		const value = page.getByText("claude-haiku-5-5").element();
		// Not a part of a pixel short: its last characters would turn into "…".
		expect(value.getBoundingClientRect().width).toBeGreaterThanOrEqual(wordsWidth(value));
		const meta = page.getByText(long).element();
		expect(meta.scrollWidth).toBeGreaterThan(meta.clientWidth);
		expect(meta.getBoundingClientRect().right).toBeLessThanOrEqual(field.getBoundingClientRect().right);
	});

	it("a name a person gave reads in sans; what is copied as it stands (a key's last characters) is mono", async () => {
		render(
			<div className="w-[320px]">
				<MenuField aria-label="Model" value="claude-haiku-5-5" meta="My own key" mono />
				<MenuField aria-label="Key" value="Algolia" meta="··· 4410" metaMono />
			</div>,
		);
		await expect.element(page.getByText("My own key")).toBeVisible();
		expect(isMono(page.getByText("My own key").element())).toBe(false);
		expect(isMono(page.getByText("claude-haiku-5-5").element())).toBe(true);
		expect(isMono(page.getByText("··· 4410").element())).toBe(true);
		expect(isMono(page.getByText("Algolia").element())).toBe(false);
	});
});

describe("ListSectionRow", () => {
	it("the line under a title is words in sans, or an identifier in mono; the row is as tall either way", async () => {
		render(
			<ListSection title="Models">
				<ListSectionRow title="Quick tasks" meta="Summaries · tags · alt text" />
				<ListSectionRow title="Spell check" meta="bareun" metaTone="subtle" metaMono />
			</ListSection>,
		);
		await expect.element(page.getByText("Summaries · tags · alt text")).toBeVisible();
		expect(isMono(page.getByText("Summaries · tags · alt text").element())).toBe(false);
		expect(isMono(page.getByText("bareun").element())).toBe(true);
		const rows = page.getByRole("listitem").elements();
		expect(rows.map((row) => row.getBoundingClientRect().height)).toEqual([74, 74]);
	});
});
