import { composeStories } from "@storybook/react-vite";
import { describe, expect, it } from "vitest";
import { page, userEvent } from "vitest/browser";
import { pointerPath, scrollsSideways } from "../../../../testing/input";
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

/** The pointer goes from a cell of the table out past the body's edge to the + strip on the table's right, as a hand moves it. */
async function toRightStrip() {
	const box = table().element().getBoundingClientRect();
	const y = box.top + box.height / 2;
	await pointerPath([
		{ x: box.right - 40, y },
		{ x: box.right + 12, y },
	]);
}

describe("a table's tools", () => {
	it("[reach] the pointer travels from the table out of the body to the right + strip, which stays to be pressed and adds a column", async () => {
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
});
