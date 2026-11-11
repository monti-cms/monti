import { composeStories } from "@storybook/react-vite";
import { describe, expect, it } from "vitest";
import { page, userEvent } from "vitest/browser";
import {
	dragPath,
	dropDrag,
	middleOf,
	rowHeights,
	spillingCells,
	titleUnderPointer,
} from "../../../../../testing/input";
import type { StorySite } from "../../../.storybook/pglite-site";
import { scene } from "../../../test/scene";
import * as list from "./list.stories";

const { Main, NarrowColumns } = composeStories(list);

const main = () => page.getByRole("main");
const columnName = (name: string) => main().getByRole("columnheader").getByRole("button", { name, exact: true });

describe("the list's column names", () => {
	it("[reach] a right click on a column's name opens that column's menu, as a right click on a row opens the row's", async () => {
		await Main.run();
		await userEvent.click(columnName("수정일"), { button: "right" });
		const menu = page.getByRole("menu");
		await expect.element(menu.getByRole("menuitem", { name: "열 숨기기" })).toBeVisible();
		await userEvent.click(menu.getByRole("menuitem", { name: "열 숨기기" }));
		await expect.element(columnName("수정일")).not.toBeInTheDocument();
	});

	it("06-1 every row is as tall as the others: a folder's, an entry's with a category and one without", async () => {
		await Main.run();
		await expect.element(columnName("수정일")).toBeVisible();
		expect(rowHeights(main().getByRole("table").element())).toHaveLength(1);
	});

	it("06-1 columns dragged to their narrowest keep their words inside their cells", async () => {
		await NarrowColumns.run();
		await expect.element(columnName("수정일")).toBeVisible();
		expect(spillingCells(main().getByRole("table").element())).toEqual([]);
		// The row's link covers the row: the pointer still finds what a cut status, category and day say.
		const row = main().getByRole("row").filter({ hasText: "발행 후 고친 글" });
		expect(titleUnderPointer(row.getByText("수정 중").element())).toBe("수정 중");
		expect(titleUnderPointer(row.getByText("개발", { exact: true }).element())).toBe("개발");
		// A press on them opens the row as a press anywhere on it does.
		await userEvent.click(row.getByText("개발", { exact: true }));
		await expect.poll(() => location.hash).toMatch(/^#\/c\/post\/[^?]+$/);
	});
});

/** The posts list at an address, with its site at hand. */
const listAt = (hash?: string) => scene<{ site: StorySite }>({ loaders: list.site(undefined, hash) }, list.default);
const rowsShown = () => expect.element(main().getByText("발행 후 고친 글")).toBeVisible();
const head = (id: string) => document.querySelector<HTMLElement>(`th[data-column=${id}]`);
const sidebar = (name: string | RegExp) => page.getByRole("navigation").getByRole("button", { name });

describe("the list: what is kept, and what comes back", () => {
	it("06 [dragging] [dropped] a column's edge held and dragged 80px stays under the pointer and moves no other edge; let go, the width is saved for the collection and is there when the list is read again", async () => {
		const story = listAt();
		await story.run();
		await rowsShown();
		const order = () => [...document.querySelectorAll<HTMLElement>("th[data-column]")].map((th) => th.dataset.column);
		const before = order();
		const right = (id: string) => Math.round(head(id)?.getBoundingClientRect().right ?? 0);
		const [title, category] = [right("title"), right("category")];
		const from = middleOf(main().getByRole("separator", { name: "제목 열 너비 조절" }).element());
		await dragPath([from, { x: from.x - 80, y: from.y }], { hold: true });
		await expect.poll(() => right("title")).toBe(title - 80);
		expect(right("category")).toBe(category);
		await dropDrag();
		const kept = () =>
			list
				.run<{ columns: { id: string; width?: number }[] }>(story.loaded().site.monti, "list.columns", {
					collection: "post",
				})
				.then((answer) => answer.columns.find((column) => column.id === "category")?.width);
		await expect.poll(kept).toBe(164);
		await userEvent.click(sidebar("메모"));
		await expect.poll(() => head("category")).toBeNull();
		await userEvent.click(sidebar(/^게시글/));
		await rowsShown();
		await expect.poll(() => Math.round(head("category")?.getBoundingClientRect().width ?? 0)).toBe(164);
		expect(order()).toEqual(before);
	});

	it("[flow 7·05c] opened again on a range picked before: the range's calendar shows", async () => {
		await listAt("#/c/post?updatedAt=2026-10-05..2026-10-26").run();
		await userEvent.click(columnName("수정일"));
		await userEvent.hover(page.getByRole("menuitem", { name: "기간 고르기" }));
		await expect.element(page.getByRole("grid")).toBeVisible();
	});

	it("opened again on a day picked before: the day's calendar shows that day picked", async () => {
		await listAt("#/c/post?updatedAt=2026-10-26..2026-10-26").run();
		await userEvent.click(columnName("수정일"));
		await userEvent.hover(page.getByRole("menuitem", { name: "하루 고르기" }));
		await expect.element(page.getByRole("button", { name: /10월 26일.*선택됨/ })).toBeVisible();
	});

	it("15 the session ended while the list was open: the next read comes back without one, and the banner offers to sign in again", async () => {
		const story = listAt();
		await story.run();
		await rowsShown();
		await story.loaded().site.db.deleteFrom("monti_session").execute();
		await userEvent.click(sidebar("메모"));
		await expect.element(page.getByText("로그인이 풀렸습니다")).toBeVisible();
		await expect.element(page.getByRole("button", { name: "다시 로그인" })).toBeVisible();
	});
});
