import { composeStories } from "@storybook/react-vite";
import { describe, expect, it } from "vitest";
import { page, userEvent } from "vitest/browser";
import { coversText, onTopOf, pointerPath, scrollsSideways } from "../../../../testing/input";
import { scene } from "../../test/scene";
import * as entry from "../screens/entry/entry.stories";

const { TableGrips } = composeStories(entry);
/** A table whose columns were sized (20 · 50 · 30). */
const TableSized = scene({ loaders: entry.site("tableSized") }, entry.default);

const body = () => page.getByRole("textbox", { name: "본문" });
const table = () => body().getByRole("table");
const addColumn = () => page.getByRole("button", { name: "열 더하기" });
/** How many columns the table has: the cells of its first row. */
const columns = () => (table().element() as HTMLTableElement).rows[0]?.cells.length;

/** The pointer goes from a cell of the table to the + strip inside the table's right edge, as a hand moves it. */
async function toRightStrip() {
	const box = table().element().getBoundingClientRect();
	const y = box.top + box.height / 2;
	await pointerPath([
		{ x: box.right - 40, y },
		{ x: box.right - 4, y },
	]);
}

describe("a table's tools", () => {
	it("[reach] the pointer travels from the table to the right + strip inside its edge, which stays to be pressed and adds a column", async () => {
		await TableGrips.run();
		await toRightStrip();
		await expect.element(addColumn()).toBeVisible();
		await userEvent.click(addColumn());
		await expect.poll(columns).toBe(4);
	});

	it("[overflow-after-add] three columns put in a table whose columns were sized: it is still as wide as the body, and nothing scrolls sideways", async () => {
		await TableSized.run();
		await userEvent.click(body().getByRole("cell", { name: "편집기 다시 만들기" }));
		const edge = body().element().getBoundingClientRect();
		for (let count = 4; count <= 6; count++) {
			await userEvent.click(page.getByRole("button", { name: "2번째 열", exact: true }));
			await userEvent.click(page.getByRole("menuitem", { name: "오른쪽에 열 넣기" }));
			await expect.poll(columns).toBe(count);
		}
		const box = table().element().getBoundingClientRect();
		expect(box.left).toBeGreaterThanOrEqual(edge.left - 1);
		expect(box.right).toBeLessThanOrEqual(edge.right + 1);
		expect(scrollsSideways(table().element())).toEqual([]);
	});

	it("the + strips and the grips say their names in a tooltip, and a grip goes a step darker when pointed at", async () => {
		await TableGrips.run();
		const tip = () => document.querySelector('[data-slot="tooltip-content"]')?.textContent ?? null;
		await toRightStrip();
		await userEvent.hover(addColumn());
		await expect.poll(tip).toBe("열 더하기");
		await userEvent.click(body().getByRole("cell", { name: "편집기 다시 만들기" }));
		const grip = page.getByRole("button", { name: "2번째 열", exact: true });
		const resting = getComputedStyle(grip.element()).backgroundColor;
		await userEvent.hover(grip);
		await expect.poll(tip).toBe("2번째 열");
		await expect.poll(() => getComputedStyle(grip.element()).backgroundColor).not.toBe(resting);
	});

	it("the grips and the + strips cover no words of the text, the row grip stands out of the left rule, and each is pressable over 24px", async () => {
		await TableGrips.run();
		await toRightStrip();
		await expect.element(addColumn()).toBeVisible();
		await userEvent.click(body().getByRole("cell", { name: "편집기 다시 만들기" }));
		await toRightStrip();
		const text = body().element();
		const box = table().element().getBoundingClientRect();
		const column = page.getByRole("button", { name: "2번째 열", exact: true }).element();
		const row = page
			.getByRole("button", { name: /번째 행/, exact: false })
			.first()
			.element();
		const strips = [...document.querySelectorAll("[data-slot=table-add-strip]")];
		expect(strips).toHaveLength(2);
		for (const thing of [column, row, ...strips]) expect(coversText(thing, text)).toEqual([]);
		// Out of the rule by its own width and the gap (EX-02), not centred on it.
		expect(row.getBoundingClientRect().right).toBeLessThanOrEqual(box.left - 3);
		// The grips keep their look and the pointer finds a 24px box around them (EX-03).
		for (const grip of [column, row]) {
			const at = grip.getBoundingClientRect();
			const x = at.left + at.width / 2;
			const y = at.top + at.height / 2;
			expect(document.elementFromPoint(x, y + 11)).toBe(grip);
			expect(document.elementFromPoint(x + 11, y)).toBe(grip);
		}
		expect(onTopOf(column)).toBe(column);
	});
});
