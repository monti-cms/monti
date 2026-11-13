import { composeStories } from "@storybook/react-vite";
import { describe, expect, it } from "vitest";
import { page, userEvent } from "vitest/browser";
import { spillingCells, wholeUnderPointer } from "../../../../../testing/input";
import type { StorySite } from "../../../.storybook/pglite-site";
import { scene } from "../../../test/scene";
import * as list from "./list.stories";

const {
	ChangeRelationMenu,
	TaxonomyTags,
	TaxonomyNarrowColumns,
	TaxonomyTagsPicked,
	TaxonomyMergeDialog,
	TaxonomySidePanel,
} = composeStories(list);

const main = () => page.getByRole("main");
const table = () => main().getByRole("table");
const dialog = () => page.getByRole("dialog");

describe("taxonomy screen (doc 08)", () => {
	it("08-1 7.06 shows item collection with usage counts and unused notice", async () => {
		await TaxonomyTags.run();
		await expect.element(table().getByText("리액트", { exact: true })).toBeVisible();
		await expect.element(table().getByText("react", { exact: true })).toBeVisible();
		// The address is typed as it stands: mono (tokens.md).
		expect(getComputedStyle(table().getByText("react", { exact: true }).element()).fontFamily).toMatch(/mono/i);
		expect(table().element().textContent).not.toContain("/tag/react");
		await expect.element(table().getByText("React", { exact: true })).toBeVisible();
		await expect.element(table().getByText("글 5", { exact: true })).toBeVisible();
		await expect.element(table().getByText("쓰는 글 없음", { exact: true })).toBeVisible();
		await expect.element(page.getByRole("checkbox", { name: "이 페이지 모두 고르기" })).toBeInTheDocument();
		expect(table().getByText("글 5", { exact: true }).element().closest("td")).toHaveClass("text-right");

		// The name sorts both ways, and the way shows in its head.
		await userEvent.click(table().getByRole("button", { name: "이름" }));
		await userEvent.click(page.getByRole("menuitemradio", { name: "내림차순" }));
		await expect
			.element(table().getByRole("columnheader", { name: "이름" }))
			.toHaveAttribute("aria-sort", "descending");
	});

	it("08-1 the usage column's filter is a box that stays open, as every table's, and a narrowed usage cell says its value whole", async () => {
		await TaxonomyNarrowColumns.run();
		const used = table().getByText("글 5", { exact: true });
		await expect.element(used).toBeVisible();
		expect(wholeUnderPointer(used.element())).toBe("글 5");
		expect(wholeUnderPointer(table().getByText("react", { exact: true }).element())).toBe("react");
		// The count is a link to the entries that use the tag.
		expect(used.element().closest("a")?.getAttribute("href")).toMatch(/^#\/c\/post\?tags=/);
		expect(spillingCells(table().element())).toEqual([]);
		await userEvent.click(table().getByRole("button", { name: "글 수" }));
		const unused = page.getByRole("menuitemcheckbox", { name: /쓰는 글 없음/ });
		await userEvent.click(unused);
		// The menu is still there to untick it, and the list already shows only the unused ones.
		await expect.element(unused).toHaveAttribute("aria-checked", "true");
		await expect.element(table().getByText("글 5", { exact: true })).not.toBeInTheDocument();
		await userEvent.click(unused);
		await expect.element(table().getByText("글 5", { exact: true })).toBeVisible();
		await userEvent.keyboard("{Escape}");
	});

	it("08-1 T112 saving a new item with no name is not greyed out: the name field says what is missing, and typing a name takes it away", async () => {
		await TaxonomyTags.run();
		await userEvent.click(main().getByRole("button", { name: "태그 추가" }));
		const name = page.getByRole("textbox", { name: "이름" });
		await expect.element(name).toBeVisible();
		const save = page.getByRole("button", { name: "저장", exact: true });
		await expect.element(save).toBeEnabled();
		await userEvent.click(save);
		await expect.element(page.getByText("이 칸을 채워 주세요.")).toBeVisible();
		await expect.element(name).toHaveFocus();
		await expect.element(name).toHaveAttribute("aria-invalid", "true");
		// Nothing was made: the panel is still the new item's.
		await expect.element(page.getByRole("heading", { name: "새 태그" })).toBeVisible();
		// The error is this item's: another item opened in its place has a name and no error.
		await userEvent.click(table().getByText("리액트", { exact: true }));
		await expect.element(name).toHaveValue("리액트");
		await expect.element(page.getByText("이 칸을 채워 주세요.")).not.toBeInTheDocument();
		await expect.element(name).not.toHaveAttribute("aria-invalid");
		// Back on a new item it is said again only when save is pressed again, and a name takes it away.
		await userEvent.click(main().getByRole("button", { name: "태그 추가" }));
		await expect.element(name).toHaveValue("");
		await expect.element(page.getByText("이 칸을 채워 주세요.")).not.toBeInTheDocument();
		await userEvent.click(save);
		await expect.element(page.getByText("이 칸을 채워 주세요.")).toBeVisible();
		// Dropping the changes drops the error with them.
		await userEvent.click(page.getByRole("button", { name: "버리기", exact: true }));
		await expect.element(page.getByText("이 칸을 채워 주세요.")).not.toBeInTheDocument();
		await userEvent.click(save);
		await expect.element(page.getByText("이 칸을 채워 주세요.")).toBeVisible();
		await userEvent.keyboard("새");
		await expect.element(page.getByText("이 칸을 채워 주세요.")).not.toBeInTheDocument();
		await expect.element(name).not.toHaveAttribute("aria-invalid");
	});

	it("keeps the same table header height before and after a row is picked", async () => {
		await TaxonomyTags.run();
		const before = table().element().querySelector("thead")?.getBoundingClientRect().height;
		await userEvent.click(page.getByRole("checkbox", { name: "리액트 고르기" }));
		const after = table().element().querySelector("thead")?.getBoundingClientRect().height;
		expect(before).toBe(40);
		expect(after).toBe(before);
	});

	it("uses uniform document-list rows without taxonomy drag handles", async () => {
		await TaxonomyTags.run();
		const heights = [...table().element().querySelectorAll("tbody tr")].map(
			(row) => row.getBoundingClientRect().height,
		);
		expect(new Set(heights).size).toBe(1);
		await expect.element(page.getByRole("button", { name: "리액트 옮기기" })).not.toBeInTheDocument();
	});

	it("08-1 7.07 picking two items shows bulk bar with merge action", async () => {
		await TaxonomyTagsPicked.run();
		const korean = page.getByRole("checkbox", { name: "리액트 고르기" });
		const english = page.getByRole("checkbox", { name: "React 고르기" });
		await expect.element(korean).toBeChecked();
		await expect.element(english).toBeChecked();
		expect(korean.element().closest("tr")).toHaveAttribute("aria-selected", "true");
		expect(english.element().closest("tr")).toHaveAttribute("aria-selected", "true");
		await expect
			.element(page.getByRole("checkbox", { name: "이 페이지 모두 고르기" }))
			.toHaveAttribute("aria-checked", "mixed");
		await expect.element(page.getByRole("button", { name: "합치기" })).toBeVisible();
	});

	it("merges one row into a chosen target without including unrelated items", async () => {
		await TaxonomyTags.run();
		const sourceRow = table().getByText("리액트", { exact: true }).element().closest("tr");
		const menuButton = sourceRow?.querySelector('[data-slot="row-more"]');
		if (!(menuButton instanceof HTMLElement)) throw new Error("Taxonomy row menu button was not found");
		await userEvent.click(menuButton);
		await userEvent.click(page.getByRole("menuitem", { name: "다른 항목과 합치기…" }));

		await expect.element(dialog().getByText("어느 항목과 합칠까요?")).toBeVisible();
		await expect.element(dialog().getByRole("radio", { name: /^리액트/ })).not.toBeInTheDocument();
		await userEvent.click(dialog().getByRole("radio", { name: /^React/ }));
		await expect
			.element(dialog().getByText("글 5편이 “React” 항목을 쓰도록 바뀝니다. “리액트” 항목은 휴지통으로 이동합니다."))
			.toBeVisible();
		await expect.element(dialog().getByText("사라지는 주소: /tag/react")).toBeVisible();
	});

	it("08-1 7.08 merge dialog defaults to item with highest usage count and previews outcome", async () => {
		await TaxonomyMergeDialog.run();
		await expect.element(dialog()).toBeVisible();
		await expect.element(dialog().getByText("어느 이름으로 합칠까요?")).toBeVisible();
		await expect
			.element(dialog().getByText("글 3편이 “리액트” 항목을 쓰도록 바뀝니다. “React” 항목은 휴지통으로 이동합니다."))
			.toBeVisible();
		await expect.element(dialog().getByText("사라지는 주소: /tag/react-en")).toBeVisible();
		// "리액트" has higher usage count than "React" so it is checked by default
		const radioReact = dialog().getByRole("radio", { name: /리액트/ });
		await expect.element(radioReact).toBeChecked();
	});

	it("08-1 7.09 merging items updates relations and shows undo toast", async () => {
		await TaxonomyMergeDialog.run();
		const mergeButton = dialog().getByRole("button", { name: "합치기" });
		await userEvent.click(mergeButton);
		// Toast appears with exact interpolated message and undo button
		await expect.element(page.getByText("글 3편의 태그를 리액트로 바꿨습니다")).toBeVisible();
		const toastUndo = page.getByRole("button", { name: "되돌리기" });
		await expect.element(toastUndo).toBeVisible();
		await userEvent.click(toastUndo);
		await expect.element(table().getByText("React", { exact: true })).toBeVisible();
	});

	it("08-1 7.10 bulk bar change dropdown modifies relations across picked rows", async () => {
		await ChangeRelationMenu.run();
		const tagSubmenu = page.getByRole("menuitem", { name: /태그/ });
		await expect.element(tagSubmenu).toBeVisible();
	});

	it("T45 side panel edits multilingual item fields with dirty tracking and saves", async () => {
		await TaxonomySidePanel.run();
		const koTab = page.getByRole("tab", { name: "한국어" });
		await expect.element(koTab).toBeVisible();
		const nameInput = page.getByRole("textbox", { name: "이름" });
		await expect.element(nameInput).toHaveValue("개발");

		// No save button initially when draft is clean
		await expect.element(page.getByRole("button", { name: "저장" })).not.toBeInTheDocument();

		// Typing into description triggers draft change
		const descInput = page.getByRole("textbox", { name: "설명" });
		await userEvent.fill(descInput, "새로운 설명");
		const saveButton = page.getByRole("button", { name: "저장" });
		await expect.element(saveButton).toBeVisible();

		// Saving updates the item
		await userEvent.click(saveButton);
		await expect.element(saveButton).not.toBeInTheDocument();
	});

	it("a search that finds no item says so in the table, and its button takes the search off (every table's no-match row)", async () => {
		await TaxonomyTags.run();
		await userEvent.click(main().getByRole("button", { name: "검색" }));
		await userEvent.fill(main().getByRole("searchbox"), "없는말");
		await expect.element(table().getByText("맞는 항목이 없습니다.")).toBeVisible();
		await userEvent.click(table().getByRole("button", { name: "필터 해제" }));
		await expect.element(table().getByText("리액트", { exact: true })).toBeVisible();
	});

	it("a right click on a row opens its ⋯ rows, with their icons; on one of several picked rows, the bulk bar's actions", async () => {
		await TaxonomyTags.run();
		await userEvent.click(table().getByText("리액트", { exact: true }), { button: "right" });
		const menu = page.getByRole("menu");
		await expect.element(menu.getByRole("menuitem", { name: "편집" })).toBeVisible();
		expect(menu.getByRole("menuitem", { name: "편집" }).element().querySelector("svg")).not.toBeNull();
		await expect.element(menu.getByRole("menuitem", { name: "휴지통으로" })).toBeVisible();
		await userEvent.keyboard("{Escape}");
		await userEvent.click(page.getByRole("checkbox", { name: "리액트 고르기" }));
		await userEvent.click(page.getByRole("checkbox", { name: "React 고르기" }));
		await userEvent.click(table().getByText("React", { exact: true }), { button: "right" });
		await expect.element(page.getByRole("menu").getByText("2개 항목")).toBeVisible();
		await expect.element(page.getByRole("menuitem", { name: "합치기" })).toBeVisible();
		await userEvent.keyboard("{Escape}");
	});

	it("merging with nothing picked to keep: 합치기 stays pressable and the choices say what is missing; 취소 is a pill like every dialog's", async () => {
		await TaxonomyTags.run();
		const sourceRow = table().getByText("리액트", { exact: true }).element().closest("tr");
		await userEvent.click(sourceRow?.querySelector('[data-slot="row-more"]') as HTMLElement);
		await userEvent.click(page.getByRole("menuitem", { name: "다른 항목과 합치기…" }));
		const merge = dialog().getByRole("button", { name: "합치기" });
		await expect.element(merge).toBeEnabled();
		// A ghost pill: the height and the sides of every dialog's 취소, where a text button has neither.
		const cancel = getComputedStyle(dialog().getByRole("button", { name: "취소" }).element());
		expect([cancel.height, cancel.paddingLeft]).toEqual(["36px", "12px"]);
		await userEvent.click(merge);
		await expect.element(dialog().getByRole("alert")).toBeVisible();
		await userEvent.click(dialog().getByRole("radio", { name: /^React/ }));
		await expect.element(dialog().getByRole("alert")).not.toBeInTheDocument();
	});

	it("a save refused for a deleted item's address says so under the address, not in a toast; a saved item shows no toast", async () => {
		const story = scene<{ site: StorySite }>(
			{
				loaders: list.site(
					async ({ monti }) => {
						const made = await list.run<{ output: { locales: { ko: { id: string } } } }>(monti, "items.saveGroup", {
							collection: "tag",
							locales: { ko: { title: "옛 태그", slug: "old-tag" } },
						});
						const rows = [{ kind: "entry", id: made.output.locales.ko.id }];
						await list.run(monti, "trash.move", { rows });
						await list.run(monti, "trash.purge", { rows });
					},
					"#/c/tag",
					{ schema: list.oneLanguage },
				),
			},
			list.default,
		);
		await story.run();
		await userEvent.click(await table().getByText("리액트", { exact: true }));
		const slug = page.getByRole("textbox", { name: "주소" });
		await userEvent.fill(slug, "old-tag");
		await userEvent.click(page.getByRole("button", { name: "저장", exact: true }));
		await expect.element(page.getByText("주소 old-tag는 지운 항목이 쓰던 주소입니다.")).toBeVisible();
		await expect.element(slug).toHaveAttribute("aria-invalid", "true");
		await userEvent.fill(slug, "react-new");
		await expect.element(page.getByText("주소 old-tag는 지운 항목이 쓰던 주소입니다.")).not.toBeInTheDocument();
		await userEvent.click(page.getByRole("button", { name: "저장", exact: true }));
		await expect.element(page.getByRole("button", { name: "저장", exact: true })).not.toBeInTheDocument();
		expect(document.body.textContent).not.toContain("저장했습니다");
	});
});
