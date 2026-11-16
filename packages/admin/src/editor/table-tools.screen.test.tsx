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

/** The pointer goes from a cell of the table out past its right edge to the + strip there, as a hand moves it. */
async function toRightStrip() {
	const box = table().element().getBoundingClientRect();
	const y = box.top + box.height / 2;
	await pointerPath([
		{ x: box.right - 40, y },
		{ x: box.right + 12, y },
	]);
}

describe("a table's tools", () => {
	it("[reach] the pointer travels from the table to the right + strip outside its edge, which stays to be pressed and adds a column", async () => {
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

	it("the + strips follow the table's size: a cell's words wrapping make the table taller, and the right strip is as tall as it is", async () => {
		await TableGrips.run();
		await toRightStrip();
		await expect.element(addColumn()).toBeVisible();
		const strip = () => addColumn().element().getBoundingClientRect().height;
		const height = () => table().element().getBoundingClientRect().height;
		await expect.poll(strip).toBeCloseTo(height(), 0);
		const before = height();
		await userEvent.click(body().getByRole("cell", { name: "편집기 다시 만들기" }));
		await userEvent.keyboard(" 그리고 한 칸의 글이 길어져서 여러 줄로 나뉘어 표가 더 높아지는 경우".repeat(3));
		await expect.poll(height).toBeGreaterThan(before + 20);
		await toRightStrip();
		await expect.poll(() => Math.abs(strip() - height())).toBeLessThan(1.5);
	});

	it("the strips stand outside the edge as the owner approved them: 16px thick, 4px off, with the 14px + glyph; and the block handle stands left of the row grip without meeting it", async () => {
		await TableGrips.run();
		await userEvent.click(body().getByRole("cell", { name: "편집기 다시 만들기" }));
		await toRightStrip();
		const box = table().element().getBoundingClientRect();
		const strip = addColumn().element().getBoundingClientRect();
		expect(strip.width).toBe(16);
		expect(Math.round(strip.left - box.right)).toBe(4);
		expect(Math.round(addColumn().element().querySelector("svg")?.getBoundingClientRect().width ?? 0)).toBe(14);
		// The pointer on the table's block, beside it: the handle comes out next to the row grip.
		await pointerPath([
			{ x: box.left + 40, y: box.top + 10 },
			{ x: box.left - 40, y: box.top + 14 },
		]);
		const handle = page.getByRole("button", { name: "블록 메뉴" });
		await expect.element(handle).toBeVisible();
		const grip = page
			.getByRole("button", { name: /번째 행/ })
			.first()
			.element()
			.getBoundingClientRect();
		const at = handle.element().getBoundingClientRect();
		// Not touching: not even the 24px box the grip is pressed in (6px beyond the grip's 12).
		expect(at.right).toBeLessThanOrEqual(grip.left - 6);
	});
});
