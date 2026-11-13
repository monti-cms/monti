import { composeStories } from "@storybook/react-vite";
import { describe, expect, it, onTestFinished } from "vitest";
import { page, userEvent } from "vitest/browser";
import {
	dragPath,
	dropDrag,
	holdRequests,
	middleOf,
	releaseRequests,
	scrollsSideways,
	slowCpu,
} from "../../../../../testing/input";
import type { StorySite } from "../../../.storybook/pglite-site";
import { scene } from "../../../test/scene";
import { MontiAdmin } from "../../app";
import { schema } from "../story-schema";
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
	const {
		AddressProblemReview,
		Basics,
		NewCollection,
		NewCollectionPreviewReview,
		ReadOnlyBasics,
		PreviewAddress,
		PreviewAddressProposal,
		PreviewAddressReview,
		ReadOnlyPreviewAddress,
	} = composeStories(collections);
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

	it("16-9 a new collection's review with a preview address is a story: the address stands under the public one (T152)", async () => {
		await NewCollectionPreviewReview.run();
		const review = page.getByRole("dialog");
		await expect.element(review.getByText("/note/:slug")).toBeVisible();
		await expect.element(review.getByText("미리보기 주소")).toBeVisible();
		await expect.element(review.getByText("/preview/:slug")).toBeVisible();
	});

	it("16-9 a preview address that is a public address is told under its field, and the review's line opens that field (T151)", async () => {
		await AddressProblemReview.run();
		const review = page.getByRole("dialog");
		await expect.element(review.getByText("이미 쓰는 주소입니다")).toBeVisible();
		await expect.element(review.getByRole("button", { name: "적용", exact: true })).not.toBeInTheDocument();
		await userEvent.click(review.getByRole("button", { name: "열기" }));
		// The review is gone and the keyboard is in the field that is wrong, with what is wrong under it.
		await expect.element(review).not.toBeInTheDocument();
		await expect.element(field()).toHaveFocus();
		await expect.element(field()).toHaveAttribute("aria-invalid", "true");
		await expect.element(page.getByRole("alert").filter({ hasText: "이미 쓰는 주소입니다" })).toBeVisible();
		// Fixed where it stands: the line goes, and the save reaches its review.
		await userEvent.keyboard("-preview");
		await expect.element(field()).toHaveValue("posts-preview");
		await expect.element(page.getByText("이미 쓰는 주소입니다")).not.toBeInTheDocument();
		await expect.element(field()).not.toHaveAttribute("aria-invalid");
		await userEvent.click(page.getByRole("button", { name: "저장하고 적용" }));
		await expect.element(page.getByRole("dialog").getByRole("button", { name: "적용", exact: true })).toBeVisible();
	});

	it("16-9 a public address two collections share is told under the field of each, and the review opens it from another tab (T151)", async () => {
		await Basics.run();
		const address = page.getByRole("textbox", { name: "공개 주소" });
		const taken = () => page.getByRole("alert").filter({ hasText: "다른 컬렉션이 쓰는 주소입니다" });
		const collection = (name: RegExp) => page.getByRole("navigation", { name: "컬렉션" }).getByRole("button", { name });
		// The posts take the memos' address.
		await userEvent.click(address);
		await userEvent.keyboard("{ControlOrMeta>}a{/ControlOrMeta}notes");
		await expect.element(address).toHaveValue("notes");
		await expect.element(taken()).toBeVisible();
		await expect.element(address).toHaveAttribute("aria-invalid", "true");
		// From another tab the review's line still leads to the address the person changed: the posts', though the schema names the memos'.
		await userEvent.click(page.getByRole("button", { name: /^필드/ }));
		await expect.element(address).not.toBeInTheDocument();
		await userEvent.click(page.getByRole("button", { name: "저장하고 적용" }));
		const review = page.getByRole("dialog");
		await expect.element(review.getByText("다른 컬렉션이 쓰는 주소입니다")).toBeVisible();
		await userEvent.click(review.getByRole("button", { name: "열기" }));
		await expect.element(review).not.toBeInTheDocument();
		await expect.element(address).toHaveFocus();
		await expect.element(address).toHaveValue("notes");
		await expect.element(taken()).toBeVisible();
		// The posts' basics, where the undo of that change is: not the memos', which nobody touched.
		await expect.element(page.getByRole("textbox", { name: "표시 이름" })).toHaveValue("게시글");
		// Put back there, it is gone from both.
		await userEvent.click(page.getByRole("button", { name: "되돌리기", exact: true }));
		await expect.element(taken()).not.toBeInTheDocument();
		await userEvent.click(collection(/^메모/));
		await userEvent.click(page.getByRole("button", { name: "기본" }));
		await expect.element(address).toHaveValue("notes");
		await expect.element(taken()).not.toBeInTheDocument();
	});

	it("16-9 a proposed preview address is in its field: blue, with its discard and what is saved under it; the bubble walks to it from the fields", async () => {
		await PreviewAddressProposal.run();
		// In its field, as the assistant wrote it, with the saved value ("none") struck under it.
		await expect.element(field()).toHaveValue("preview");
		// The blue is the whole field's (the fixed letters around the typed part too): its mark is on the field, not on the input in it.
		const blue = () => field().element().closest("[data-proposal]") !== null;
		expect(blue()).toBe(true);
		await expect.element(page.getByRole("deletion").filter({ hasText: "공개 주소에서" })).toBeVisible();
		// The bubble has two stops, the address on the basics and the new field on the fields: it walks to the fields and round to the address.
		await expect.element(page.getByText("1 / 2")).toBeVisible();
		await userEvent.click(page.getByRole("button", { name: "다음", exact: true }));
		await expect.element(page.getByRole("button", { name: "readingTime 열기" })).toBeVisible();
		await expect.element(field()).not.toBeInTheDocument();
		await userEvent.click(page.getByRole("button", { name: "다음", exact: true }));
		await expect.element(field()).toHaveValue("preview");
		// Its own discard is on its row; it drops the proposal, and the field is as saved.
		await userEvent.click(page.getByRole("button", { name: "버리기", exact: true }));
		await expect.element(field()).toHaveValue("");
		expect(blue()).toBe(false);
	});

	it("16-9 the changed preview address's row in the changes list opens the basics with the keyboard in its field", async () => {
		await PreviewAddress.run();
		await userEvent.click(page.getByRole("button", { name: /^필드/ }));
		await expect.element(field()).not.toBeInTheDocument();
		await userEvent.click(changes());
		await userEvent.click(page.getByRole("menu").getByRole("menuitem", { name: /미리보기 주소/ }));
		await expect.element(field()).toHaveValue("preview");
		await expect.element(field()).toHaveFocus();
	});

	it("16-9 a preview address two collections share: the review opens the one whose address the draft changed, not the later one the schema names (T151)", async () => {
		// The memos have a preview page saved; the posts, listed before them, are given the same address in this draft.
		const saved = structuredClone(schema);
		(saved.collections.memo as { previewPath?: string }).previewPath = "/preview/:slug";
		await scene({ loaders: collections.site({ schema: saved }) }, collections.default).run();
		await userEvent.click(page.getByRole("button", { name: "설정" }));
		await userEvent.click(page.getByRole("link", { name: /컬렉션/ }));
		await userEvent.click(page.getByRole("button", { name: "기본" }));
		await expect.element(page.getByRole("textbox", { name: "표시 이름" })).toHaveValue("게시글");
		await userEvent.click(field());
		await userEvent.keyboard("preview");
		await expect.element(page.getByRole("alert").filter({ hasText: "이미 쓰는 주소입니다" })).toBeVisible();
		await userEvent.click(page.getByRole("button", { name: /^필드/ }));
		await userEvent.click(page.getByRole("button", { name: "저장하고 적용" }));
		const review = page.getByRole("dialog");
		await userEvent.click(review.getByRole("button", { name: "열기" }));
		await expect.element(review).not.toBeInTheDocument();
		// The posts' basics, where the change and its undo are; the memos' address is as saved and nobody touched it.
		await expect.element(page.getByRole("textbox", { name: "표시 이름" })).toHaveValue("게시글");
		await expect.element(field()).toHaveFocus();
		await expect.element(page.getByRole("button", { name: "되돌리기", exact: true })).toBeVisible();
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
		const banner = box(page.getByText("저장하지 못했습니다").element().closest("[data-slot=banner]"));
		const inset = box(document.querySelector("[data-slot=sidebar-inset]"));
		expect(banner.top).toBe(inset.top);
		expect([banner.left, banner.right]).toEqual([inset.left, inset.right]);
		expect(banner.bottom).toBeLessThan(box(page.getByRole("heading", { name: "설정" }).element()).top);
		// The assistant's corner keeps its 12px, measured from under the banner.
		expect(box(page.getByRole("button", { name: "어시스턴트 열기" }).element()).top).toBe(banner.bottom + 12);
	});
});

describe("settings › collections: what the assistant proposed", () => {
	it("focus: the bubble's '모두 버리기' pressed with the keyboard: the bubble goes, and the focus is on the first control of what it sat over", async () => {
		const { Proposal } = composeStories(collections);
		await Proposal.run();
		const discard = page.getByRole("button", { name: "모두 버리기" });
		await expect.element(discard).toBeVisible();
		const over = discard.element().closest("[data-slot=proposal-bubble-dock]")?.parentElement as HTMLElement;
		await userEvent.keyboard("{Tab}");
		(discard.element() as HTMLElement).focus();
		expect(discard.element().matches(":focus-visible")).toBe(true);
		await userEvent.keyboard("{Enter}");
		await expect.element(discard).not.toBeInTheDocument();
		await expect
			.poll(() => document.activeElement !== document.body && over.contains(document.activeElement))
			.toBe(true);
	});
});

describe("settings: the review of a hand-edited schema file", () => {
	it("검토 on the banner, pressed on the settings screen with unsaved changes, opens the review at once: nothing is left, so nothing is asked", async () => {
		await scene({ loaders: collections.HandEditReview.loaders }, collections.default).run();
		await expect.element(page.getByText("스키마 파일을 직접 고쳤습니다")).toBeVisible();
		await userEvent.click(page.getByRole("button", { name: "설정" }));
		// A change on another tab of the settings: the review is on this screen, and the tabs share one draft.
		await userEvent.fill(page.getByRole("textbox", { name: "사이트 이름" }), "example.blog");
		await expect.element(page.getByRole("button", { name: "변경 사항", exact: true })).toBeVisible();
		await userEvent.click(page.getByRole("button", { name: "검토" }));
		await expect.element(page.getByRole("dialog").getByText("옛 주소는 404가 됩니다.")).toBeVisible();
		await expect.element(page.getByRole("alertdialog")).not.toBeInTheDocument();
		await expect.element(page.getByText("저장하지 않은 변경 사항이 있습니다")).not.toBeInTheDocument();
		// The change is still in the draft.
		await userEvent.click(page.getByRole("dialog").getByRole("button", { name: "취소" }));
		await expect.element(page.getByRole("button", { name: "변경 사항", exact: true })).toHaveTextContent(/1/);
	});
});

describe("settings › collections: the options of a choice in the review (docs 12 and 19)", () => {
	type Site = {
		site: {
			monti: { run: (name: string, input: unknown, as: { actor: "admin" }) => Promise<unknown> };
			db: import("kysely").Kysely<import("@monti-cms/core").Database>;
		};
	};
	const options = () =>
		scene<Site>(
			{ loaders: collections.site({ schema: collections.optionsSchema, more: collections.optionEntries }) },
			collections.default,
		);
	const opened = async () => {
		await userEvent.click(page.getByRole("button", { name: "설정" }));
		await userEvent.click(page.getByRole("link", { name: /^컬렉션/ }));
		await expect.element(page.getByRole("button", { name: "mood 열기" })).toBeVisible();
	};
	const sheet = () => page.getByRole("dialog");
	const saveSheet = async () => {
		await userEvent.click(sheet().getByRole("button", { name: "저장", exact: true }));
		await expect.element(sheet()).not.toBeInTheDocument();
	};
	const review = async () => {
		await userEvent.click(page.getByRole("button", { name: "저장하고 적용" }));
		await expect.element(sheet().getByText("검토")).toBeVisible();
		return sheet();
	};
	/** The values of each post as the draft and the site have them, by the post's title. */
	const stored = async ({ site }: Site, table: "entries" | "entry_published") => {
		const rows = await site.db.selectFrom(table).select(["title", "values"]).where("collection", "=", "post").execute();
		return Object.fromEntries(rows.map((row) => [row.title, row.values as Record<string, unknown>]));
	};
	/** The value field of the n-th option's row. */
	const option = (index: number) => sheet().getByRole("textbox", { name: "값" }).nth(index);
	/** A field's line in the list, by its name. */
	const line = (name: string) =>
		[...document.querySelectorAll<HTMLElement>("[data-slot=field-row]")].find((row) =>
			row.textContent?.startsWith(name),
		);
	/**
	 * T260: on CI the field sheet closed and its change never reached the draft, cause unknown. Each step says where it stopped: the option's
	 * row gone after its ×, the field's line marked changed after "저장". The page runs slowed, as CI's runner does.
	 */
	const slowed = async () => {
		onTestFinished(() => slowCpu(1));
		await slowCpu(4);
	};
	const takenOut = (value: string) =>
		expect.element(sheet().getByRole("button", { name: `${value} 빼기` })).not.toBeInTheDocument();
	const marked = (name: string) =>
		expect.poll(() => Boolean(line(name)?.querySelector("[data-slot=change-dot]"))).toBe(true);

	// The review names it with the entries that chose it and the published ones.
	it("19-8 an option's value edited in its row is a rename: the review counts its entries, asks nothing, and the site has the new word", async () => {
		const made = options();
		await made.run();
		await opened();
		await userEvent.click(page.getByRole("button", { name: "mood 열기" }));
		await expect.element(option(1)).toHaveValue("loud");
		await userEvent.fill(option(1), "noisy");
		await saveSheet();
		const sheetNow = await review();
		await expect.element(sheetNow.getByText("분위기 · 시끌")).toBeVisible();
		await expect.element(sheetNow.getByText("mood · loud → noisy")).toBeVisible();
		await expect.element(sheetNow.getByText("2편 · 공개된 글 1편")).toBeVisible();
		await expect.element(sheetNow.getByRole("radio")).not.toBeInTheDocument();
		await userEvent.click(sheetNow.getByRole("button", { name: "적용", exact: true }));
		await expect.element(sheet()).not.toBeInTheDocument();
		expect((await stored(made.loaded(), "entry_published"))["loud-video"]).toMatchObject({ mood: "noisy" });
		expect((await stored(made.loaded(), "entries"))["loud-draft"]).toMatchObject({ mood: "noisy" });
		expect((await stored(made.loaded(), "entry_published"))["calm-article"]).toMatchObject({ mood: "calm" });
	});

	// 바꾸기 offers the options that stay; the change is on the site too.
	it("19-9 an option taken out is asked about: 바꾸기 or 비우기 (the red apply); changed, the entries hold the option picked", async () => {
		await slowed();
		const made = options();
		await made.run();
		await opened();
		// No part of the sheet or the review comes on demand: with every module's download held, they still work (T260 asked whether a part
		// arriving late remounted the sheet's form).
		onTestFinished(releaseRequests);
		await holdRequests("**/*.{ts,tsx,js,mjs}");
		await userEvent.click(page.getByRole("button", { name: "mood 열기" }));
		await userEvent.click(sheet().getByRole("button", { name: "loud 빼기" }));
		await takenOut("loud");
		await saveSheet();
		await marked("mood");
		const sheetNow = await review();
		await expect.element(sheetNow.getByText("분위기 · 시끌")).toBeVisible();
		await expect.element(sheetNow.getByText("2편 · 공개된 글 1편")).toBeVisible();
		await expect.element(sheetNow.getByText("저장된 데이터는 바뀌지 않습니다.")).not.toBeInTheDocument();
		// Changing is the default, to the first option that stays: emptying throws values away, so it is chosen, and the button says so.
		await expect.element(sheetNow.getByRole("radio", { name: "바꾸기" })).toBeChecked();
		await expect.element(sheetNow.getByRole("combobox", { name: "바꾸기" })).toHaveTextContent("차분");
		await userEvent.click(sheetNow.getByRole("radio", { name: "비우기" }));
		await expect.element(sheetNow.getByRole("button", { name: "지우고 적용" })).toBeVisible();
		await userEvent.click(sheetNow.getByRole("radio", { name: "바꾸기" }));
		await userEvent.click(sheetNow.getByRole("button", { name: "적용", exact: true }));
		await expect.element(sheet()).not.toBeInTheDocument();
		expect((await stored(made.loaded(), "entry_published"))["loud-video"]).toMatchObject({ mood: "calm" });
		expect((await stored(made.loaded(), "entries"))["loud-draft"]).toMatchObject({ mood: "calm" });
	});

	// The review also says the new option's required fields will be empty, with the published count.
	it("19-10 a required conditional field's option taken out offers only 바꾸기, and its fields are asked about as removed fields", async () => {
		const made = options();
		await made.run();
		await opened();
		await userEvent.click(page.getByRole("button", { name: "format 열기" }));
		await userEvent.click(sheet().getByRole("button", { name: "video 빼기" }));
		await saveSheet();
		const sheetNow = await review();
		await expect.element(sheetNow.getByText("글 종류 · 동영상")).toBeVisible();
		await expect.element(sheetNow.getByRole("radio", { name: "비우기" })).not.toBeInTheDocument();
		await expect.element(sheetNow.getByRole("radio", { name: "바꾸기" })).toBeChecked();
		// The removed option's field, as any removed field: with how many hold a value and how many of them are published.
		await expect.element(sheetNow.getByText("동영상 주소")).toBeVisible();
		await expect.element(sheetNow.getByRole("radio", { name: /값 지우기/ })).toBeVisible();
		await userEvent.click(sheetNow.getByRole("combobox", { name: "바꾸기" }));
		await userEvent.click(page.getByRole("option", { name: "링크" }));
		await expect.element(sheetNow.getByText("링크의 필수 필드가 비게 됩니다 · 공개된 글 1편")).toBeVisible();
		await userEvent.click(sheetNow.getByRole("button", { name: "지우고 적용" }));
		await expect.element(sheet()).not.toBeInTheDocument();
		expect((await stored(made.loaded(), "entry_published"))["loud-video"]).toEqual({ mood: "loud", format: "link" });
	});

	it("19-7 a removed field's line says how many entries hold a value and how many of them are published", async () => {
		const made = options();
		await made.run();
		await opened();
		await userEvent.click(page.getByRole("button", { name: "mood 열기" }));
		await userEvent.click(sheet().getByRole("button", { name: "지우기" }));
		const sheetNow = await review();
		await expect.element(sheetNow.getByRole("radio", { name: /값 지우기/ })).toBeVisible();
		await expect.element(sheetNow.getByText("3편 · 공개된 글 2편")).toBeVisible();
	});

	const read = async ({ site }: Site) =>
		(
			(await site.monti.run("schema.read", {}, { actor: "admin" })) as {
				schema: { collections: Record<string, { fields: Record<string, unknown> }> };
			}
		).schema.collections.post?.fields;

	// A band stands one step in and has no grip; its fields have theirs; an option with no fields keeps its band.
	it("19-6 a conditional field's line has a band for each option under it, with the option's fields under the band", async () => {
		await options().run();
		await opened();
		const rows = () => [...document.querySelectorAll<HTMLElement>("[data-slot=field-row]")];
		const text = () => rows().map((row) => row.textContent ?? "");
		const at = (words: string) => text().findIndex((each) => each.includes(words));
		await expect.poll(() => at("videoUrl")).toBeGreaterThan(-1);
		// The field, then each option's band in the options' order, each followed by its own fields.
		const order = ["format", "필드 없음", "동영상", "videoUrl", "링크", "linkUrl"].map(at);
		expect(order).toEqual([...order].sort((a, b) => a - b));
		const band = rows()[at("동영상")] as HTMLElement;
		expect(band.dataset.group).toBe("true");
		expect(band.textContent).toContain("video");
		// A band is not dragged (the sheet orders the options); its fields are, by their grips.
		expect(band.querySelector("button[aria-label$='옮기기']")).toBeNull();
		expect(
			(rows()[at("videoUrl")] as HTMLElement).querySelector("button[aria-label='videoUrl 옮기기']"),
		).not.toBeNull();
		// A band is one height, the group band's: 36.
		for (const words of ["필드 없음", "동영상", "링크"])
			expect(Math.round((rows()[at(words)] as HTMLElement).getBoundingClientRect().height)).toBe(36);
		const left = (row: HTMLElement) =>
			(row.querySelector("span:nth-child(2)") as HTMLElement).getBoundingClientRect().left;
		expect(left(band)).toBeGreaterThan(left(rows()[at("format")] as HTMLElement));
		expect(left(rows()[at("videoUrl")] as HTMLElement)).toBeGreaterThan(left(band));
	});

	// The sheet says whose the field is, and the field stands under the band.
	it("19-6 '+ 필드' on an option's band adds a field to that option, and the saved schema has it there", async () => {
		const made = options();
		await made.run();
		await opened();
		expect(page.getByRole("button", { name: "글에 필드 추가" }).element().querySelector("svg")).not.toBeNull();
		await userEvent.click(page.getByRole("button", { name: "글에 필드 추가" }));
		await expect.element(sheet().getByText(/게시글 · 글 종류 · 글/)).toBeVisible();
		await userEvent.fill(sheet().getByRole("textbox", { name: /^식별자/ }), "credit");
		await userEvent.click(sheet().getByRole("button", { name: "필드 추가", exact: true }));
		await expect.element(sheet()).not.toBeInTheDocument();
		await expect.element(page.getByRole("button", { name: "credit 열기" })).toBeVisible();
		await expect.element(page.getByText("필드 없음")).not.toBeInTheDocument();
		const sheetNow = await review();
		await userEvent.click(sheetNow.getByRole("button", { name: "적용", exact: true }));
		await expect.element(sheet()).not.toBeInTheDocument();
		expect((await read(made.loaded()))?.format).toMatchObject({
			kind: "conditional",
			fields: { article: { credit: { kind: "text" } }, video: { videoUrl: { kind: "text", required: true } } },
		});
	});

	/** The grip of a field, and a drag of it onto the middle of another thing's row. */
	const grip = (name: string) => page.getByRole("button", { name: `${name} 옮기기` }).element();
	const rowOf = (words: string) =>
		[...document.querySelectorAll<HTMLElement>("[role=tabpanel] [data-slot=field-row]")].find((row) =>
			row.textContent?.includes(words),
		) as HTMLElement;
	const dragTo = async (name: string, onto: HTMLElement, part: "upper" | "lower" = "lower") => {
		const from = middleOf(grip(name));
		const box = onto.getBoundingClientRect();
		const to = { x: from.x, y: box.top + box.height * (part === "upper" ? 0.25 : 0.75) };
		await dragPath([from, { x: from.x, y: (from.y + to.y) / 2 }, to], { hold: true });
		await dropDrag();
		// The line in hand settles into its place for a moment after the drop, over the row it lands on, and the drag swallows a click
		// for 50ms: no person presses again that soon.
		await new Promise((done) => setTimeout(done, 400));
	};
	const adminValues = async ({ site }: Site) =>
		(
			(await site.monti.run("schema.read", {}, { actor: "admin" })) as {
				adminValues: Record<string, { fields?: Record<string, { optionFields?: Record<string, string[]> }> }>;
			}
		).adminValues.post?.fields;

	// The review says where it went and who loses its value, and the saved schema and the order kept have it there.
	it("19-21 a field on its own dragged onto an option's band becomes that option's first field", async () => {
		const made = options();
		await made.run();
		await opened();
		await dragTo("mood", rowOf("동영상"));
		// Under the video's band, before the field the option had.
		await expect
			.poll(() => fieldOrder().filter((name) => ["mood", "videoUrl", "linkUrl"].includes(name ?? "")))
			.toEqual(["mood", "videoUrl", "linkUrl"]);
		await expect.poll(() => topOf("mood") - Math.round(rowOf("동영상").getBoundingClientRect().top)).toBeGreaterThan(0);
		expect(topOf("videoUrl")).toBeGreaterThan(topOf("mood"));
		const sheetNow = await review();
		await expect.element(sheetNow.getByText("mood → format · video")).toBeVisible();
		await expect.element(sheetNow.getByText("옮긴 곳")).toBeVisible();
		// Two posts with a mood chose another option: the loud draft and the calm article, one of them on the site.
		await expect.element(sheetNow.getByText("2편 · 공개된 글 1편")).toBeVisible();
		await userEvent.click(sheetNow.getByRole("button", { name: "지우고 적용" }));
		await expect.element(sheet()).not.toBeInTheDocument();
		const fields = await read(made.loaded());
		expect(fields).not.toHaveProperty("mood");
		expect(Object.keys((fields?.format as { fields: { video: object } }).fields.video)).toEqual(["mood", "videoUrl"]);
		expect((await adminValues(made.loaded()))?.format?.optionFields).toEqual({ video: ["mood", "videoUrl"] });
		expect((await stored(made.loaded(), "entries"))["loud-video"]).toMatchObject({ mood: "loud" });
		expect((await stored(made.loaded(), "entries"))["calm-article"]).not.toHaveProperty("mood");
	});

	it("19-21 a field of an option is dragged to another option, within its option, and out to the fields on their own; out, its values stay", async () => {
		const made = options();
		await made.run();
		await opened();
		// From the link to the video, before the video's field: the place it was dropped at is kept, though two options changed at once.
		await dragTo("linkUrl", rowOf("videoUrl"), "upper");
		await expect
			.poll(() => fieldOrder().filter((name) => ["videoUrl", "linkUrl"].includes(name ?? "")))
			.toEqual(["linkUrl", "videoUrl"]);
		await expect.element(page.getByText("필드 없음").nth(1)).toBeVisible();
		// Within the option: the first goes after the second.
		await dragTo("linkUrl", rowOf("videoUrl"));
		await expect
			.poll(() => fieldOrder().filter((name) => ["videoUrl", "linkUrl"].includes(name ?? "")))
			.toEqual(["videoUrl", "linkUrl"]);
		// Out of the option, to stand on its own before the conditional field.
		await dragTo("videoUrl", rowOf("mood"), "upper");
		await expect.poll(() => topOf("videoUrl")).toBeLessThan(topOf("format"));
		const sheetNow = await review();
		// Into the video: asked of nobody, said. Out of it: no line of its own (the values stay where they are).
		await expect.element(sheetNow.getByText("linkUrl → format · video")).toBeVisible();
		await expect.element(sheetNow.getByText(/videoUrl →/)).not.toBeInTheDocument();
		await userEvent.click(sheetNow.getByRole("button", { name: "지우고 적용" }));
		await expect.element(sheet()).not.toBeInTheDocument();
		const fields = await read(made.loaded());
		expect(fields?.videoUrl).toMatchObject({ kind: "text" });
		expect((fields?.format as { fields: object }).fields).toEqual({
			video: { linkUrl: { kind: "text", required: true } },
		});
		expect((await stored(made.loaded(), "entry_published"))["loud-video"]).toMatchObject({
			videoUrl: "https://example.dev/v.mp4",
		});
	});

	it("19-21 a conditional field is not dropped into its own options, and the title and the address into none", async () => {
		await options().run();
		await opened();
		const left = (name: string) =>
			Math.round(
				(
					document.querySelector(`[role=tabpanel] button[aria-label='${name} 열기']`) as HTMLElement
				).getBoundingClientRect().left,
			);
		const own = left("slug");
		await dragTo("format", rowOf("동영상"));
		// The title's grip in the outline, not the one of the line in hand.
		const titleGrip = middleOf(
			document.querySelector("[role=tabpanel] button[aria-label='title 옮기기']") as HTMLElement,
		);
		const link = rowOf("링크").getBoundingClientRect();
		await dragPath([titleGrip, { x: titleGrip.x, y: link.top + link.height * 0.75 }], { hold: true });
		await dropDrag();
		// Wherever they were let go, both still stand on their own: as far in as the address, and the options keep their fields.
		await expect.poll(() => left("title")).toBe(own);
		expect(left("format")).toBe(own);
		expect(left("videoUrl")).toBeGreaterThan(own);
		expect(left("linkUrl")).toBeGreaterThan(own);
	});

	it("19-17 a field added to an option can be a conditional field: it stands under the band with bands of its own, and the saved schema has it inside the option", async () => {
		const made = options();
		await made.run();
		await opened();
		await userEvent.click(page.getByRole("button", { name: "동영상에 필드 추가" }));
		await userEvent.click(sheet().getByRole("option", { name: /^조건부/ }));
		await userEvent.fill(sheet().getByRole("textbox", { name: /^식별자/ }), "host");
		for (const [index, value] of ["own", "embed"].entries()) {
			await userEvent.click(sheet().getByRole("button", { name: "선택지", exact: true }));
			await userEvent.fill(sheet().getByRole("textbox", { name: "값" }).nth(index), value);
		}
		await userEvent.click(sheet().getByRole("button", { name: "필드 추가", exact: true }));
		await expect.element(sheet()).not.toBeInTheDocument();
		// Its own bands, further in than the band it stands under.
		await userEvent.click(page.getByRole("button", { name: "embed에 필드 추가" }));
		await expect.element(sheet().getByText(/host · embed/)).toBeVisible();
		await userEvent.fill(sheet().getByRole("textbox", { name: /^식별자/ }), "embedCode");
		await userEvent.click(sheet().getByRole("button", { name: "필드 추가", exact: true }));
		await expect.element(sheet()).not.toBeInTheDocument();
		const left = (words: string) =>
			(rowOf(words).querySelector("span:nth-child(2)") as HTMLElement).getBoundingClientRect().left;
		expect(left("embedCode")).toBeGreaterThan(left("host"));
		expect(left("host")).toBeGreaterThan(left("동영상"));
		const sheetNow = await review();
		await userEvent.click(sheetNow.getByRole("button", { name: "적용", exact: true }));
		await expect.element(sheet()).not.toBeInTheDocument();
		expect(((await read(made.loaded()))?.format as { fields: { video: object } }).fields.video).toEqual({
			videoUrl: { kind: "text", required: true },
			host: { kind: "conditional", options: ["own", "embed"], fields: { embed: { embedCode: { kind: "text" } } } },
		});
	});

	it("19-18 a conditional field turned on and off by a switch: the sheet keeps one option and offers no 필수, and the saved field says how it is chosen", async () => {
		const made = options();
		await made.run();
		await opened();
		await userEvent.click(page.getByRole("button", { name: "필드 추가", exact: true }));
		await userEvent.click(sheet().getByRole("option", { name: /^조건부/ }));
		await userEvent.fill(sheet().getByRole("textbox", { name: /^식별자/ }), "featured");
		await expect.element(sheet().getByRole("switch", { name: /필수/ })).toBeVisible();
		await userEvent.click(sheet().getByRole("switch", { name: "스위치로 켜고 끄기" }));
		// One option, the word "on" stores, and nothing to add to it or require of it.
		await expect.element(sheet().getByRole("textbox", { name: "값" })).toHaveValue("on");
		await expect.element(sheet().getByRole("button", { name: "선택지", exact: true })).not.toBeInTheDocument();
		await expect.element(sheet().getByRole("switch", { name: /필수/ })).not.toBeInTheDocument();
		await userEvent.click(sheet().getByRole("button", { name: "필드 추가", exact: true }));
		await expect.element(sheet()).not.toBeInTheDocument();
		await expect.element(page.getByRole("button", { name: "on에 필드 추가" })).toBeVisible();
		const sheetNow = await review();
		await userEvent.click(sheetNow.getByRole("button", { name: "적용", exact: true }));
		await expect.element(sheet()).not.toBeInTheDocument();
		expect((await read(made.loaded()))?.featured).toEqual({
			kind: "conditional",
			options: ["on"],
			fields: {},
			control: "toggle",
		});
	});

	it("19-20 a removed field no entry holds a value of, moved into a field of an option: nothing is moved or deleted, so no count is said and the apply is the plain one", async () => {
		await slowed();
		const made = options();
		await made.run();
		await opened();
		// The link's address: no post is a link, so none holds it.
		await userEvent.click(page.getByRole("button", { name: "linkUrl 열기" }));
		await userEvent.click(sheet().getByRole("button", { name: "지우기" }));
		// The field goes with the sheet: an option's field leaves the list, and the draft holds the change before the review is asked for.
		await expect.element(sheet()).not.toBeInTheDocument();
		await expect.poll(() => line("linkUrl")).toBeUndefined();
		await expect.element(page.getByRole("button", { name: "변경 사항", exact: true })).toHaveTextContent(/1/);
		const sheetNow = await review();
		await userEvent.click(sheetNow.getByRole("radio", { name: "다른 필드로 옮기기" }));
		await userEvent.click(sheetNow.getByRole("combobox", { name: "다른 필드로 옮기기" }));
		await userEvent.click(page.getByRole("option", { name: "동영상 주소" }));
		await expect
			.element(sheetNow.getByRole("combobox", { name: "다른 필드로 옮기기" }))
			.toHaveTextContent("동영상 주소");
		await expect.element(sheetNow.getByText(/옮김 \d+편/)).not.toBeInTheDocument();
		await expect.element(sheetNow.getByText(/지움 \d+편/)).not.toBeInTheDocument();
		await expect.element(sheetNow.getByRole("button", { name: "적용", exact: true })).toBeVisible();
		await expect.element(sheetNow.getByRole("button", { name: "지우고 적용" })).not.toBeInTheDocument();
	});

	// It counts again when an option taken out sends its entries there, and the apply is the red one while any are deleted.
	it("19-20 a removed field's values moved into a field of an option: the review says how many are moved and how many deleted", async () => {
		await slowed();
		const made = options();
		await made.run();
		await opened();
		// The video option goes, and its field with it.
		await userEvent.click(page.getByRole("button", { name: "format 열기" }));
		await userEvent.click(sheet().getByRole("button", { name: "video 빼기" }));
		await takenOut("video");
		await saveSheet();
		await marked("format");
		const sheetNow = await review();
		await userEvent.click(sheetNow.getByRole("radio", { name: "다른 필드로 옮기기" }));
		await userEvent.click(sheetNow.getByRole("combobox", { name: "다른 필드로 옮기기" }));
		await userEvent.click(page.getByRole("option", { name: "링크 주소" }));
		// The video's post is changed to the first option left (글), which is not the link: its address would go.
		await expect.element(sheetNow.getByText("지움 1편", { exact: true })).toBeVisible();
		await expect.element(sheetNow.getByRole("button", { name: "지우고 적용" })).toBeVisible();
		// Changed to the link instead, that post has the link's fields when the value moves.
		await userEvent.click(sheetNow.getByRole("combobox", { name: "바꾸기" }));
		await userEvent.click(page.getByRole("option", { name: "링크", exact: true }));
		await expect.element(sheetNow.getByText("옮김 1편", { exact: true })).toBeVisible();
		await expect.element(sheetNow.getByRole("button", { name: "적용", exact: true })).toBeVisible();
		await userEvent.click(sheetNow.getByRole("button", { name: "적용", exact: true }));
		await expect.element(sheet()).not.toBeInTheDocument();
		expect((await stored(made.loaded(), "entry_published"))["loud-video"]).toEqual({
			mood: "loud",
			format: "link",
			linkUrl: "https://example.dev/v.mp4",
		});
	});

	it("19-6 a conditional field is made in the field sheet: its kind, its options; in the list it has a band for each", async () => {
		const made = options();
		await made.run();
		await opened();
		await userEvent.click(page.getByRole("button", { name: "필드 추가", exact: true }));
		await userEvent.click(sheet().getByRole("option", { name: /^조건부/ }));
		await userEvent.fill(sheet().getByRole("textbox", { name: /^식별자/ }), "source");
		for (const [index, value] of ["own", "quoted"].entries()) {
			await userEvent.click(sheet().getByRole("button", { name: "선택지", exact: true }));
			await userEvent.fill(sheet().getByRole("textbox", { name: "값" }).nth(index), value);
		}
		await userEvent.click(sheet().getByRole("button", { name: "필드 추가", exact: true }));
		await expect.element(sheet()).not.toBeInTheDocument();
		await expect.element(page.getByRole("button", { name: "own에 필드 추가" })).toBeVisible();
		await expect.element(page.getByRole("button", { name: "quoted에 필드 추가" })).toBeVisible();
		const sheetNow = await review();
		await userEvent.click(sheetNow.getByRole("button", { name: "적용", exact: true }));
		await expect.element(sheet()).not.toBeInTheDocument();
		expect((await read(made.loaded()))?.source).toEqual({
			kind: "conditional",
			options: ["own", "quoted"],
			fields: {},
		});
	});

	// The empty value is flagged on the field's line, for a choice and a conditional field alike.
	it("19-16 '+ 선택지' puts the keyboard in the new row's value, and a value left empty keeps the save from applying", async () => {
		const made = options();
		await made.run();
		await opened();
		for (const name of ["format", "mood"]) {
			await userEvent.click(page.getByRole("button", { name: `${name} 열기` }));
			const rows = sheet().getByRole("textbox", { name: "값" });
			const before = rows.elements().length;
			await userEvent.click(sheet().getByRole("button", { name: "선택지", exact: true }));
			await expect.element(rows.nth(before)).toHaveFocus();
			await saveSheet();
		}
		const line = (name: string) =>
			[...document.querySelectorAll<HTMLElement>("[data-slot=field-row]")].find((row) =>
				row.textContent?.startsWith(name),
			)?.textContent;
		await expect.poll(() => line("format")).toContain("빈 값");
		await expect.poll(() => line("mood")).toContain("빈 값");
		const sheetNow = await review();
		await expect.element(sheetNow.getByText("값이 빈 선택지가 있습니다").first()).toBeVisible();
		// Refused: whatever in the sheet says "적용" and can be pressed is pressed, the sheet stays, and the schema is as it was.
		for (const button of sheetNow.element().querySelectorAll<HTMLButtonElement>("button"))
			if (button.textContent?.includes("적용") && !button.disabled && button.getAttribute("aria-disabled") !== "true")
				button.click();
		await expect.element(sheet()).toBeVisible();
		expect((await read(made.loaded()))?.mood).toEqual({ kind: "select", options: ["calm", "loud"] });
	});

	it("19-13 the review of a field moved into an option says where it went and how many entries lose its value, and applies with the red button", async () => {
		const { MovedFieldReview } = composeStories(collections);
		await MovedFieldReview.run();
		const sheetNow = sheet();
		await expect.element(sheetNow.getByText("videoUrl → format · link")).toBeVisible();
		await expect.element(sheetNow.getByText("글 종류 · 링크")).toBeVisible();
		await expect.element(sheetNow.getByText("1편 · 공개된 글 1편")).toBeVisible();
		await expect.element(sheetNow.getByRole("button", { name: "지우고 적용" })).toBeVisible();
	});
});

describe("the collection screens follow the design rules (design audit, 2026-11-14)", () => {
	const { AddSelectField, Basics, EditField, Fields, FixFirst, NewCollection } = composeStories(collections);
	const dialog = () => page.getByRole("dialog");
	const underlined = (element: Element) => getComputedStyle(element).textDecorationLine.includes("underline");

	it("every changed value of the basics tab has the dot by its name and the undo at its row's end", async () => {
		await Basics.run();
		// The dot by the row's name: its label row holds the dot and the undo.
		const marked = (name: string) => {
			const row = [...document.querySelectorAll<HTMLElement>("label")].find((label) => label.textContent === name)
				?.parentElement?.parentElement;
			return Boolean(row?.querySelector("[data-slot=change-dot]")) && Boolean(row?.textContent?.includes("되돌리기"));
		};
		await userEvent.click(page.getByRole("textbox", { name: "표시 이름" }));
		await userEvent.keyboard("x");
		await expect.poll(() => marked("표시 이름")).toBe(true);
		await userEvent.click(page.getByRole("button", { name: "되돌리기", exact: true }));
		await expect.poll(() => marked("표시 이름")).toBe(false);
		await page.getByRole("switch", { name: "폴더 사용" }).click();
		await expect.poll(() => marked("폴더 사용")).toBe(true);
		await userEvent.click(page.getByRole("button", { name: "되돌리기", exact: true }));
		await expect.poll(() => marked("폴더 사용")).toBe(false);
	});

	it("the story of the changed basics tab is reached: both rows marked", async () => {
		await composeStories(collections).BasicsChanged.run();
	});

	it("the new collection sheet's address row is the basics tab's: 36px, in body text", async () => {
		await NewCollection.run();
		const label = dialog().getByText("공개 주소", { exact: true }).element();
		expect(getComputedStyle(label).fontSize).toBe(getComputedStyle(dialog().getByText("문서").element()).fontSize);
		expect(label.parentElement?.getBoundingClientRect().height).toBe(36);
	});

	it("the title's row carries no label, and the add-tab button is the part's own icon", async () => {
		await Fields.run();
		const title = [...document.querySelectorAll<HTMLElement>("[data-slot=field-row]")].find((row) =>
			row.textContent?.startsWith("title"),
		);
		expect(title?.textContent).not.toContain("속성 패널");
		const add = page.getByRole("button", { name: "탭 추가" }).element();
		expect(add.textContent).toBe("");
		expect(add.querySelector("svg")).not.toBeNull();
	});

	it("a saved field's sheet: 지우기 stands alone at the footer's left, and 필수 is its word alone", async () => {
		await EditField.run();
		const remove = dialog().getByRole("button", { name: "지우기" }).element();
		const cancel = dialog().getByRole("button", { name: "취소" }).element();
		expect(remove.getBoundingClientRect().right).toBeLessThan(cancel.getBoundingClientRect().left);
		await expect.element(dialog().getByText("필수", { exact: true })).toBeVisible();
		expect(dialog().getByText("!", { exact: true }).elements()).toHaveLength(0);
	});

	it("a choice's row ends in the icon button ×, and + 선택지 is a ghost button", async () => {
		await AddSelectField.run();
		const remove = dialog().getByRole("button", { name: "memo 빼기" }).element();
		expect(remove.getAttribute("data-slot")).toBe("icon-button");
		expect(remove.textContent).toBe("");
		// One step under its 32px row, as a button inside a field is.
		expect(remove.getBoundingClientRect().height).toBe(28);
		expect(remove.closest("[data-slot=option-row]")?.getBoundingClientRect().height).toBe(32);
		expect(dialog().getByRole("button", { name: "선택지", exact: true }).element().getAttribute("data-slot")).toBe(
			"button",
		);
		expect(dialog().getByRole("button", { name: "선택지", exact: true }).element().querySelector("svg")).not.toBeNull();
	});

	it("the schema banner's 검토 is underlined: it opens the review", async () => {
		await scene({ loaders: collections.HandEditReview.loaders }, collections.default).run();
		await expect.element(page.getByText("스키마 파일을 직접 고쳤습니다")).toBeVisible();
		expect(underlined(page.getByRole("button", { name: "검토" }).element())).toBe(true);
	});

	it("the review's 열기 is underlined: it goes to the field", async () => {
		await FixFirst.run();
		const open = dialog().getByRole("button", { name: "열기" }).first().element();
		expect(underlined(open)).toBe(true);
	});
});

describe("settings: a save takes only what it sent", () => {
	it("a change made while the save is on its way stays after it, still unsaved (as T230)", async () => {
		let release = () => {};
		const held = new Promise<void>((resolve) => {
			release = resolve;
		});
		await scene(
			{
				loaders: collections.site(),
				render: (_args: unknown, { loaded }: { loaded: unknown }) => {
					const { site } = loaded as { site: StorySite };
					return (
						<MontiAdmin
							transport={async (name, input, options) => {
								if (name === "settings.save") await held;
								return site.transport(name, input, options);
							}}
							streams={site.streams}
							siteName="example.dev"
						/>
					);
				},
				play: collections.Basics.play,
			},
			collections.default,
		).run();
		const changes = () => page.getByRole("button", { name: "변경 사항", exact: true });
		await userEvent.click(page.getByRole("textbox", { name: "표시 이름" }));
		await userEvent.keyboard("x");
		await userEvent.click(page.getByRole("button", { name: "저장하고 적용" }));
		// While the name is on its way, the folders are switched.
		const folders = () => page.getByRole("switch", { name: "폴더 사용" });
		const before = folders().element().getAttribute("aria-checked");
		await folders().click();
		await expect.element(changes()).toHaveTextContent(/2/);
		release();
		await expect.element(page.getByText("저장했습니다")).toBeVisible();
		// The name went; the folders did not, and are still a change of this draft.
		await expect.element(folders()).toHaveAttribute("aria-checked", before === "true" ? "false" : "true");
		await expect.element(changes()).toHaveTextContent(/1/);
	});
});
