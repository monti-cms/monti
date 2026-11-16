import { describe, expect, it } from "vitest";
import { page, userEvent } from "vitest/browser";
import { scene } from "../../../test/scene";
import * as collections from "./collections.stories";

/**
 * A collection's icon (D1, 2026-11-16): picked in the collection's settings from a fixed list, saved with its admin values, and drawn by one function
 * wherever the collection is named: its sidebar row, the relation submenus of the list's row menus.
 */
type Loaded = {
	site: { monti: { run: (name: string, input: unknown, as: { actor: "admin" }) => Promise<unknown> } };
};
const iconsIn = (element: Element | null) =>
	[...(element?.querySelectorAll("[data-collection-icon]") ?? [])].map((each) =>
		each.getAttribute("data-collection-icon"),
	);
const sidebarRow = (name: RegExp) => page.getByRole("list", { name: "콘텐츠" }).getByRole("button", { name });
const collection = (name: RegExp) => page.getByRole("navigation", { name: "컬렉션" }).getByRole("button", { name });

describe("a collection's icon", () => {
	it("is picked in the settings, saved with the admin values, and shown by the sidebar and by the relation submenu of a row's menu", async () => {
		const story = scene<Loaded>(collections.Basics, collections.default);
		await story.run();
		// Without one a collection wears the icon of its kind: a page for entries, a tag for items.
		await expect.element(sidebarRow(/^게시글/)).toBeVisible();
		expect(iconsIn(sidebarRow(/^게시글/).element())).toEqual(["document"]);
		expect(iconsIn(sidebarRow(/^카테고리/).element())).toEqual(["tag"]);

		// The tags' basics: the picker is a select of the list, the kind's own icon first.
		await userEvent.click(collection(/^카테고리/));
		await userEvent.click(page.getByRole("button", { name: "기본" }));
		const picker = page.getByRole("combobox", { name: "아이콘" });
		await expect.element(picker).toBeVisible();
		await expect.element(picker).toHaveTextContent("종류에 따라");
		await userEvent.click(picker);
		const options = page.getByRole("option").elements();
		// "By kind", then the fixed list of about twenty.
		expect(options.length).toBeGreaterThanOrEqual(19);
		// The rows show the icons they stand for.
		expect(options.every((each) => each.querySelector("[data-collection-icon]") !== null)).toBe(true);
		await userEvent.click(page.getByRole("option", { name: "여러 사람" }));
		await expect.element(picker).toHaveTextContent("여러 사람");
		expect(iconsIn(picker.element())).toEqual(["user-multiple"]);

		await userEvent.click(page.getByRole("button", { name: "저장하고 적용" }));
		const review = page.getByRole("dialog");
		if (review.elements().length > 0) await userEvent.click(review.getByRole("button", { name: "적용", exact: true }));
		await expect
			.poll(async () => {
				const read = (await story.loaded().site.monti.run("schema.read", {}, { actor: "admin" })) as {
					adminValues: Record<string, { icon?: string }>;
				};
				return read.adminValues.category?.icon;
			})
			.toBe("user-multiple");
		// The sidebar draws it from the saved value, at once.
		await expect.poll(() => iconsIn(sidebarRow(/^카테고리/).element())).toEqual(["user-multiple"]);
		expect(iconsIn(sidebarRow(/^게시글/).element())).toEqual(["document"]);

		// The list's row menu names the category relation with the icon of the collection it points at.
		window.location.hash = "#/c/post";
		await expect.element(page.getByRole("main").getByRole("row").nth(1)).toBeVisible();
		await userEvent.click(page.getByRole("main").getByRole("button", { name: "더 보기" }).first());
		const tags = page.getByRole("menu").getByRole("menuitem", { name: /카테고리/ });
		await expect.element(tags).toBeVisible();
		await expect.poll(() => iconsIn(tags.element())).toEqual(["user-multiple"]);
	});

	it("takes the kind's own icon back when the picker goes back to 'by kind'", async () => {
		const story = scene<Loaded>(collections.Basics, collections.default);
		await story.run();
		await userEvent.click(collection(/^카테고리/));
		await userEvent.click(page.getByRole("button", { name: "기본" }));
		await userEvent.click(page.getByRole("combobox", { name: "아이콘" }));
		await userEvent.click(page.getByRole("option", { name: "책", exact: true }));
		await expect.element(page.getByRole("combobox", { name: "아이콘" })).toHaveTextContent("책");
		await userEvent.click(page.getByRole("combobox", { name: "아이콘" }));
		await userEvent.click(page.getByRole("option", { name: "종류에 따라" }));
		await expect.element(page.getByRole("combobox", { name: "아이콘" })).toHaveTextContent("종류에 따라");
		// Back where it was: nothing to save.
		await expect.element(page.getByRole("button", { name: "변경 사항", exact: true })).not.toBeInTheDocument();
	});
});
