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

describe("a collection's preview address", () => {
	const { Basics, NewCollection, ReadOnlyBasics, PreviewAddress, PreviewAddressReview, ReadOnlyPreviewAddress } =
		composeStories(collections);
	const field = () => page.getByRole("textbox", { name: "미리보기 주소" });
	const hint = () => page.getByText("비워 두면 공개 주소에서 미리봅니다.");
	/** "변경 사항 n ▾": there only while something is changed. */
	const changes = () => page.getByRole("button", { name: "변경 사항", exact: true });

	it("16-9 typed in the basics tab it is one change with its review; applied, the schema has it and the review is gone", async () => {
		const story = scene<{
			site: { monti: { run: (name: string, input: unknown, as: { actor: "admin" }) => Promise<unknown> } };
		}>(collections.Basics, collections.default);
		await story.run();
		await expect.element(field()).toHaveValue("");
		// What leaving it empty does is said only while it is empty, and its line stays: what is under the field does not move.
		await expect.element(hint()).toBeVisible();
		const under = () => Math.round(page.getByText("폴더 사용").element().getBoundingClientRect().top);
		const before = under();
		await userEvent.click(field());
		await userEvent.keyboard("preview");
		await expect.element(changes()).toHaveTextContent(/1/);
		await expect.element(hint()).not.toBeInTheDocument();
		expect(under()).toBe(before);
		await userEvent.click(page.getByRole("button", { name: "저장하고 적용" }));
		const review = page.getByRole("dialog");
		await expect.element(review.getByText("게시글 · 미리보기 주소")).toBeVisible();
		await expect.element(review.getByText("공개 주소에서")).toBeVisible();
		await expect.element(review.getByText("/preview/:slug")).toBeVisible();
		await expect.element(review.getByText("저장된 데이터는 바뀌지 않습니다.")).toBeVisible();
		await userEvent.click(review.getByRole("button", { name: "적용", exact: true }));
		await expect.element(review).not.toBeInTheDocument();
		const read = (await story.loaded().site.monti.run("schema.read", {}, { actor: "admin" })) as {
			schema: { collections: Record<string, { previewPath?: string }> };
		};
		expect(read.schema.collections.post?.previewPath).toBe("/preview/:slug");
		await expect.element(field()).toHaveValue("preview");
	});

	it("16-9 emptied again it is no change, and its undo puts back what was saved", async () => {
		await Basics.run();
		await userEvent.click(field());
		await userEvent.keyboard("draft");
		await expect.element(changes()).toHaveTextContent(/1/);
		await userEvent.keyboard("{Backspace}{Backspace}{Backspace}{Backspace}{Backspace}");
		await expect.element(changes()).not.toBeInTheDocument();
		await userEvent.keyboard("draft");
		await userEvent.click(page.getByRole("button", { name: "되돌리기", exact: true }));
		await expect.element(field()).toHaveValue("");
	});

	it("16-9 slashes alone are no address: the field stays empty with its hint, and nothing is changed", async () => {
		await Basics.run();
		await userEvent.click(field());
		await userEvent.keyboard("/");
		await expect.element(field()).toHaveValue("");
		await expect.element(hint()).toBeVisible();
		await expect.element(changes()).not.toBeInTheDocument();
		await userEvent.keyboard("//");
		await expect.element(changes()).not.toBeInTheDocument();
	});

	it("16-9 a new collection's review names the preview address it is made with", async () => {
		await NewCollection.run();
		await userEvent.click(page.getByRole("dialog").getByRole("button", { name: "만들기" }));
		await expect.element(page.getByRole("dialog")).not.toBeInTheDocument();
		await userEvent.click(page.getByRole("button", { name: "기본" }));
		await userEvent.click(field());
		await userEvent.keyboard("preview");
		await userEvent.click(page.getByRole("button", { name: "저장하고 적용" }));
		const review = page.getByRole("dialog");
		await expect.element(review.getByText("미리보기 주소")).toBeVisible();
		await expect.element(review.getByText("/preview/:slug")).toBeVisible();
	});

	it("16-9 an item collection has no preview address, and the live site reads a document's as words with its lock", async () => {
		await Basics.run();
		await expect.element(field()).toBeVisible();
		await userEvent.click(page.getByRole("navigation", { name: "컬렉션" }).getByRole("button", { name: /^카테고리/ }));
		await userEvent.click(page.getByRole("button", { name: "기본" }));
		await expect.element(page.getByText("공개 주소", { exact: true })).toBeVisible();
		await expect.element(field()).not.toBeInTheDocument();
		await ReadOnlyBasics.run();
		await expect.element(page.getByText("공개 주소에서")).toBeVisible();
		await expect.element(field()).not.toBeInTheDocument();
	});

	it("16-9 the live site with a preview address reads the address, and the typed address and its review are drawn", async () => {
		await ReadOnlyPreviewAddress.run();
		await expect.element(page.getByText("/preview/:slug")).toBeVisible();
		await expect.element(page.getByText("공개 주소에서")).not.toBeInTheDocument();
		await expect.element(field()).not.toBeInTheDocument();
		await PreviewAddress.run();
		await expect.element(field()).toHaveValue("preview");
		await expect.element(page.getByRole("button", { name: "되돌리기", exact: true })).toBeVisible();
		await PreviewAddressReview.run();
		await expect.element(page.getByRole("dialog").getByText("/preview/:slug")).toBeVisible();
	});
});

describe("a control that goes away with its press", () => {
	const { Basics } = composeStories(collections);

	it("a changed address's undo, pressed with the keyboard, leaves the focus in that row's field, not on the page", async () => {
		await Basics.run();
		for (const name of ["공개 주소", "미리보기 주소"]) {
			const field = page.getByRole("textbox", { name });
			await userEvent.click(field);
			await userEvent.keyboard("x");
			const undo = page.getByRole("button", { name: "되돌리기", exact: true });
			await expect.element(undo).toBeVisible();
			// The undo stands on the label's line, before its field.
			await userEvent.keyboard("{Shift>}{Tab}{/Shift}");
			await expect.element(undo).toHaveFocus();
			await userEvent.keyboard("{Enter}");
			await expect.element(undo).not.toBeInTheDocument();
			await expect.element(field).toHaveFocus();
			expect(document.activeElement).not.toBe(document.body);
		}
	});

	it("the same undo pressed with the pointer moves no focus into the field: it stays where the browser puts it", async () => {
		await Basics.run();
		for (const name of ["공개 주소", "미리보기 주소"]) {
			const field = page.getByRole("textbox", { name });
			await userEvent.click(field);
			await userEvent.keyboard("x");
			const undo = page.getByRole("button", { name: "되돌리기", exact: true });
			await userEvent.click(undo);
			await expect.element(undo).not.toBeInTheDocument();
			await expect.element(field).not.toHaveFocus();
		}
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
