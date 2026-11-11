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
		await new Promise((done) => setTimeout(done, 100));
		await userEvent.keyboard("{ArrowDown}");
		await new Promise((done) => setTimeout(done, 300));
		await userEvent.keyboard(" ");
		await expect.poll(fieldOrder).toEqual(["title", "slug", "subtitle", "summary", "cover", "category"]);
	});

	it("[dragging] [dropped] a field held by its grip follows the pointer while the next one makes room; let go, it stays after it", async () => {
		await Fields.run();
		const grip = page.getByRole("button", { name: "summary 옮기기" }).element();
		const rowOf = (name: string) => page.getByRole("button", { name: `${name} 열기` }).element();
		const from = middleOf(grip);
		const down = rowOf("subtitle").getBoundingClientRect().top - rowOf("summary").getBoundingClientRect().top;
		await dragPath([from, { x: from.x, y: from.y + down }], { hold: true });
		// The floating copy of the field is under the pointer.
		await expect
			.poll(() =>
				document.elementsFromPoint(from.x + 60, from.y + down).some((each) => each.textContent?.includes("summary")),
			)
			.toBe(true);
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
