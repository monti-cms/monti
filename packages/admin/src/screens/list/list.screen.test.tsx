import { composeStories } from "@storybook/react-vite";
import { describe, expect, it } from "vitest";
import { page, userEvent } from "vitest/browser";
import {
	dragPath,
	dropDrag,
	middleOf,
	rowHeights,
	spillingCells,
	wholeUnderPointer,
} from "../../../../../testing/input";
import type { StorySite } from "../../../.storybook/pglite-site";
import { scene } from "../../../test/scene";
import * as list from "./list.stories";

const { Main, NarrowColumns, WideColumns } = composeStories(list);

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

	it("06-1 columns wider than the page leave the title its 200px: titles stay readable and the table scrolls sideways", async () => {
		await WideColumns.run();
		await expect.element(columnName("수정일")).toBeInTheDocument();
		const table = main().getByRole("table").element() as HTMLElement;
		const title = [...table.querySelectorAll("thead th")].find((th) => th.textContent?.trim().startsWith("제목"));
		expect(title?.getBoundingClientRect().width).toBeGreaterThanOrEqual(200);
		const cell = page.getByText("발행 후 고친 글").element().closest("td") as HTMLElement;
		expect(cell.getBoundingClientRect().width).toBeGreaterThanOrEqual(200);
		// The table is wider than its column of the page, and the page scrolls sideways to its last column.
		expect(table.getBoundingClientRect().width).toBeGreaterThan(
			table.parentElement?.getBoundingClientRect().width ?? 0,
		);
		const last = columnName("수정일").element() as HTMLElement;
		last.scrollIntoView({ inline: "end", block: "nearest" });
		await expect.poll(() => last.getBoundingClientRect().right).toBeLessThanOrEqual(window.innerWidth);
		expect(spillingCells(table)).toEqual([]);
	});

	it("06-1 columns dragged to their narrowest keep their words inside their cells", async () => {
		await NarrowColumns.run();
		await expect.element(columnName("수정일")).toBeVisible();
		expect(spillingCells(main().getByRole("table").element())).toEqual([]);
		// The row's link covers the row: the pointer still finds what a cut status, category and day say.
		const row = main().getByRole("row").filter({ hasText: "발행 후 고친 글" });
		expect(wholeUnderPointer(row.getByText("수정 중").element())).toBe("수정 중");
		expect(wholeUnderPointer(row.getByText("개발", { exact: true }).element())).toBe("개발");
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
	// Saved for the collection: it is there when the list is read again.
	it("06 [dragging] [dropped] a column's edge held and dragged 80px stays under the pointer and moves no other edge; let go, the width is saved", async () => {
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

	it("the day and range rows end in a › and write the day or range that is on before it (menu.md)", async () => {
		await listAt("#/c/post?updatedAt=2026-10-05..2026-10-26").run();
		await userEvent.click(columnName("수정일"));
		const range = page.getByRole("menuitem", { name: "기간 고르기" });
		await expect.element(range).toHaveTextContent(/10\. 05 – 10\. 26/);
		expect(range.element().querySelector("[data-slot=menu-tick]")).toBeNull();
		expect(range.element().querySelector("svg")).not.toBeNull();
		await expect.element(page.getByRole("menuitem", { name: "하루 고르기" })).toHaveTextContent("하루 고르기");
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

	it("필터 해제 pressed with the keyboard goes with its row once the list has rows again, and the focus goes to the list's first row, not to the page", async () => {
		await listAt("#/c/post?q=없는말").run();
		const clear = () => main().getByRole("button", { name: "필터 해제" });
		await expect.element(clear()).toBeVisible();
		for (let presses = 0; presses < 80 && document.activeElement !== clear().element(); presses++)
			await userEvent.tab();
		expect(document.activeElement).toBe(clear().element());
		await userEvent.keyboard("{Enter}");
		await rowsShown();
		await expect.poll(() => document.activeElement).toBe(main().element().querySelector("tbody [data-slot=row-link]"));
	});
});

describe("the row's menu (menu.md)", () => {
	const row = (title: string) => main().getByRole("row").filter({ hasText: title });
	const rowMenu = async (title: string) => {
		await userEvent.click(row(title).getByRole("button", { name: "더 보기" }));
		return page.getByRole("menu");
	};
	/** A toast on the danger ground: what an error toast is (`toast.error`). */
	const errorToast = () => document.querySelector("[data-sonner-toast] .bg-monti-danger-emphasis");

	it("the category is a pick-one list: the rows' value is ticked, and picking it again changes nothing", async () => {
		const story = listAt();
		await story.run();
		await rowsShown();
		await rowMenu("가을 사진 정리");
		await userEvent.hover(page.getByRole("menuitem", { name: "카테고리" }));
		const daily = page.getByRole("menuitemradio", { name: "일상" });
		await expect.element(daily).toHaveAttribute("aria-checked", "true");
		await expect.element(page.getByRole("menuitemradio", { name: "없음" })).toBeVisible();
		await userEvent.click(daily);
		await expect.element(row("가을 사진 정리").getByText("일상", { exact: true })).toBeVisible();
		// Nothing was written: no toast says it changed.
		expect(document.body.textContent).not.toContain("바꿨습니다");
	});

	it("a write that does not go through says why: duplicating an entry gone behind the screen", async () => {
		const story = listAt();
		await story.run();
		await rowsShown();
		await story.loaded().site.db.deleteFrom("entries").where("title", "=", "가을 사진 정리").execute();
		await userEvent.click((await rowMenu("가을 사진 정리")).getByRole("menuitem", { name: "복제" }));
		await expect.poll(errorToast).not.toBeNull();
	});

	it("Backspace on a row puts it in the trash, as Delete does; the menu writes the key as a key, not typed", async () => {
		await listAt().run();
		await rowsShown();
		await userEvent.click(row("가을 사진 정리").getByText("일상", { exact: true }), { button: "right" });
		const trash = page.getByRole("menuitem", { name: /휴지통으로/ });
		await expect.element(trash).toBeVisible();
		expect(trash.element().querySelector("[data-slot=menu-shortcut]")?.textContent).toMatch(/^(Delete|⌫)$/);
		// "Open" and "open in a new tab" do not share a mark.
		const icon = (name: string) =>
			page.getByRole("menuitem", { name, exact: true }).element().querySelector("svg")?.innerHTML;
		expect(icon("열기")).not.toBe(icon("새 탭에서 열기"));
		await userEvent.keyboard("{Escape}");
		(row("가을 사진 정리").getByRole("link").element() as HTMLElement).focus();
		await userEvent.keyboard("{Backspace}");
		await expect.element(page.getByText("휴지통으로 옮겼습니다")).toBeVisible();
		await expect.element(main().getByText("가을 사진 정리")).not.toBeInTheDocument();
	});
});
