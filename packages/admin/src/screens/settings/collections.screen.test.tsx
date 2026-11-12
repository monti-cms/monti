import { composeStories } from "@storybook/react-vite";
import { describe, expect, it } from "vitest";
import { page, userEvent } from "vitest/browser";
import { dragPath, dropDrag, middleOf, scrollsSideways } from "../../../../../testing/input";
import { scene } from "../../../test/scene";
import * as collections from "./collections.stories";

const { NewItemCollection } = composeStories(collections);

describe("collection public pages", () => {
	it("keeps an item private until its public-page switch is enabled", async () => {
		await NewItemCollection.run();
		const publicPage = page.getByRole("switch", { name: "공개 주소" });
		await expect.element(publicPage).not.toBeChecked();
		await expect.element(page.getByRole("textbox", { name: "공개 주소" })).not.toBeInTheDocument();
		await publicPage.click();
		await expect.element(publicPage).toBeChecked();
		await expect.element(page.getByRole("textbox", { name: "공개 주소" })).toBeVisible();
	});
});

const { ChangesList, DeleteReview, Fields } = composeStories(collections);

const tab = (name: RegExp) => page.getByRole("tab", { name });
/** The fields' names in the order the outline shows them. */
const fieldOrder = () =>
	[...(document.querySelector("[role=tabpanel]")?.querySelectorAll("button[aria-label$=' 열기']") ?? [])].map(
		(button) => button.getAttribute("aria-label")?.replace(/ 열기$/, ""),
	);

/** Where a field's row stands: the top of its "열기" button (the one in the outline, not the copy in hand). */
const topOf = (name: string) =>
	Math.round(
		document.querySelector(`[role=tabpanel] button[aria-label='${name} 열기']`)?.getBoundingClientRect().top ??
			Number.NaN,
	);
/**
 * What a person sees of the fields at a point: the words of the row on top there, or "" when what is on top is not drawn (the gap a field in hand
 * leaves keeps its place, unseen). The row is as far up from the point as holds one field only.
 */
function fieldShownAt(x: number, y: number, others: string[]) {
	let box = document.elementFromPoint(x, y);
	for (let up: Element | null = box; up; up = up.parentElement) if (getComputedStyle(up).opacity === "0") return "";
	while (box?.parentElement && !others.some((name) => box?.parentElement?.textContent?.includes(name)))
		box = box.parentElement;
	return box?.textContent ?? "";
}
/** What the screen reader was last told about a drag. */
const said = () => document.querySelector("[id^=DndLiveRegion]")?.textContent ?? "";

describe("settings › collections: what an action does", () => {
	it("[flow 4·10] a row's undo in the changes list puts that change back and keeps the list open; a press on a row opens its field", async () => {
		await ChangesList.run();
		const menu = page.getByRole("menu");
		await userEvent.click(menu.getByRole("menuitem", { name: /부제/ }).getByRole("button", { name: "되돌리기" }));
		await expect.element(menu.getByRole("menuitem", { name: /부제/ })).not.toBeInTheDocument();
		await expect.element(menu).toBeVisible();
		await userEvent.click(menu.getByRole("menuitem", { name: /요약/ }));
		await expect.element(page.getByRole("dialog", { name: /요약/ })).toBeVisible();
	});

	it("[flow 4·18] a collection deleted and applied: the toast says applied, and the removal's undo toast goes with the save", async () => {
		await DeleteReview.run();
		await userEvent.click(page.getByRole("button", { name: "지우고 적용" }));
		await expect.element(page.getByText("적용했습니다")).toBeVisible();
		await expect.element(page.getByText("메모 컬렉션을 지웠습니다")).not.toBeInTheDocument();
	});

	it("a tab renamed through its right-click menu: the name opens in place with the focus in it, and Enter keeps it", async () => {
		await Fields.run();
		await userEvent.click(tab(/^기본/), { button: "right" });
		await userEvent.click(page.getByRole("menuitem", { name: "이름 바꾸기" }));
		const name = page.getByRole("textbox", { name: "탭 이름" });
		await expect.element(name).toHaveFocus();
		await userEvent.fill(name, "글 정보");
		await userEvent.keyboard("{Enter}");
		await expect.element(tab(/^글 정보/)).toBeVisible();
	});

	it("a tab deleted through its right-click menu: its fields join the end of the first tab", async () => {
		await scene(
			{ ...collections.Fields, loaders: collections.site({ more: collections.twoTabs }) },
			collections.default,
		).run();
		await userEvent.click(tab(/^SEO/), { button: "right" });
		await userEvent.click(page.getByRole("menuitem", { name: "지우기" }));
		await expect.element(tab(/^SEO/)).not.toBeInTheDocument();
		await expect.poll(fieldOrder).toEqual(["title", "slug", "summary", "category", "subtitle", "cover"]);
	});

	it("[keys-move] fields reordered with the keyboard: Space lifts one by its grip, ↓ moves it past the next, Space drops it there", async () => {
		await Fields.run();
		expect(fieldOrder()).toEqual(["title", "slug", "summary", "subtitle", "cover", "category"]);
		(page.getByRole("button", { name: "summary 옮기기" }).element() as HTMLElement).focus();
		await userEvent.keyboard(" ");
		// Lifted: the screen reader is told, and the arrow moves it only from then on.
		await expect.poll(said).toContain("summary");
		await userEvent.keyboard("{ArrowDown}");
		await expect.poll(() => topOf("summary") - topOf("subtitle")).toBeGreaterThan(0);
		await userEvent.keyboard(" ");
		await expect.poll(fieldOrder).toEqual(["title", "slug", "subtitle", "summary", "cover", "category"]);
	});

	it("[dragging] [dropped] a field held by its grip is under the pointer while only the next one makes room; let go, it stays after it", async () => {
		await Fields.run();
		const before = { title: topOf("title"), subtitle: topOf("subtitle"), cover: topOf("cover") };
		const from = middleOf(page.getByRole("button", { name: "summary 옮기기" }).element());
		const down = before.subtitle - topOf("summary");
		await dragPath([from, { x: from.x, y: from.y + down }], { hold: true });
		// What the pointer finds beside the grip is the field in hand, floating over the row it passes; that row moved up into its place.
		await expect
			.poll(() => fieldShownAt(from.x + 60, from.y + down, ["subtitle", "slug", "cover"]))
			.toContain("summary");
		await expect.poll(() => topOf("subtitle")).toBe(before.subtitle - down);
		expect(topOf("title")).toBe(before.title);
		expect(topOf("cover")).toBe(before.cover);
		await dropDrag();
		await expect.poll(fieldOrder).toEqual(["title", "slug", "subtitle", "summary", "cover", "category"]);
	});

	it("[overflow-after-add] six tabs added: the tab row still fits the page, and nothing scrolls sideways", async () => {
		await Fields.run();
		for (let count = 0; count < 6; count++) {
			await userEvent.click(page.getByRole("button", { name: "탭 추가" }));
			await userEvent.keyboard("{Enter}");
		}
		await expect.poll(() => page.getByRole("tab").elements().length).toBeGreaterThanOrEqual(7);
		const row = page.getByRole("tablist").last().element();
		expect(row.getBoundingClientRect().right).toBeLessThanOrEqual(window.innerWidth);
		expect(scrollsSideways(row)).toEqual([]);
	});
});

const { SaveRefused } = composeStories(collections);

describe("settings › collections: a refused save", () => {
	it("says why in a banner at the very top of the screen: over the title, from edge to edge of the page area, the corner under it", async () => {
		await SaveRefused.run();
		const box = (element: Element | null) => (element as Element).getBoundingClientRect();
		const banner = box(
			page.getByText("저장하지 못했습니다. 다시 시도해 주세요.").element().closest("[data-slot=banner]"),
		);
		const inset = box(document.querySelector("[data-slot=sidebar-inset]"));
		expect(banner.top).toBe(inset.top);
		expect([banner.left, banner.right]).toEqual([inset.left, inset.right]);
		expect(banner.bottom).toBeLessThan(box(page.getByRole("heading", { name: "설정" }).element()).top);
		// The assistant's corner keeps its 12px, measured from under the banner.
		expect(box(page.getByRole("button", { name: "어시스턴트 열기" }).element()).top).toBe(banner.bottom + 12);
	});
});
