import type { ListEntriesItem } from "@monti-cms/core/site";
import { act, cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { testSite } from "../../../../core/test/site";
import { renderInRouter as render } from "../../test/router";
import { withSite } from "../../test/site";
import { AdminEntriesTable } from "../admin-entries-table";
import { columnsFor } from "../list-columns";
import { parseListState } from "../list-state";
import { screensMessages } from "../messages";

afterEach(cleanup);

const t = testSite.createTranslator(screensMessages);

const item = (id: string, fields: Partial<ListEntriesItem> = {}): ListEntriesItem => ({
	id,
	collection: "post",
	locale: "ko",
	translationGroupId: id,
	title: id,
	slug: id,
	status: "draft",
	version: 1,
	folderId: null,
	relations: {},
	values: {},
	hasUnpublishedChanges: false,
	publishedAt: null,
	createdAt: new Date("2026-01-01T00:00:00Z"),
	updatedAt: new Date("2026-01-01T00:00:00Z"),
	trashedAt: null,
	...fields,
});

function renderTable(overrides: Partial<ComponentProps<typeof AdminEntriesTable>> = {}) {
	const props: ComponentProps<typeof AdminEntriesTable> = {
		collection: "post",
		items: [item("published", { status: "published", hasUnpublishedChanges: true }), item("draft")],
		folders: [],
		explorer: null,
		state: parseListState(testSite, new URLSearchParams("collection=post")),
		onStateChange: vi.fn(),
		onColumnSettingsChange: vi.fn(),
		selectedIds: new Set(),
		onSelectionChange: vi.fn(),
		total: 2,
		isLoading: false,
		errorMessage: null,
		rowMenu: () => [{ kind: "item", label: "휴지통으로 이동", onSelect: vi.fn() }],
		onSelectFolder: vi.fn(),
		onOpenRecord: vi.fn(),
		onPageChange: vi.fn(),
		onPageSizeChange: vi.fn(),
		onRetry: vi.fn(),
		...overrides,
	};
	render(withSite(<AdminEntriesTable {...props} />));
	return props;
}

describe("admin entry list", () => {
	it("uses the default columns per collection", () => {
		for (const collection of ["post", "memo", "tag"] as const) {
			const { defaults, available } = columnsFor(testSite, collection);
			expect(defaults.slice(0, 2)).toEqual(["status", "title"]);
			expect(defaults).toContain("updatedAt");
			for (const column of defaults) expect(available).toContain(column);
		}
		// Taxonomy items have no per-locale documents but show the locales that have a name.
		expect(columnsFor(testSite, "tag").defaults).toContain("locale");
		expect(columnsFor(testSite, "memo").available).not.toContain("categoryId");
		expect(columnsFor(testSite, "tag").available).not.toContain("tagIds");
	});

	it("selects rows through the row checks and the select-all of the toolbar", () => {
		const props = renderTable();
		fireEvent.click(screen.getByRole("checkbox", { name: "draft 선택" }));
		expect(props.onSelectionChange).toHaveBeenCalledWith(new Set(["draft"]));
		fireEvent.click(screen.getByRole("checkbox", { name: t("list.selectAll") }));
		expect(props.onSelectionChange).toHaveBeenLastCalledWith(new Set(["published", "draft"]));
	});

	it("offers restore and permanent delete in the trash view and routes Delete to the handler", () => {
		const trashed = item("trashed", { status: "trashed" });
		const onRestore = vi.fn();
		const onPermanentDelete = vi.fn();
		const onDeleteKey = vi.fn();
		renderTable({ items: [trashed], mode: "trash", onRestore, onPermanentDelete, onDeleteKey });
		const row = screen.getByRole("row", { name: /trashed/ });
		fireEvent.click(within(row).getByRole("button", { name: "복원" }));
		fireEvent.click(within(row).getByRole("button", { name: "영구 삭제" }));
		expect(onRestore).toHaveBeenCalledWith(trashed);
		expect(onPermanentDelete).toHaveBeenCalledWith(trashed);
		fireEvent.keyDown(within(row).getByRole("button", { name: "복원" }), { key: "Delete" });
		expect(onDeleteKey).toHaveBeenCalledWith(trashed);
	});

	it("opens the same row actions from right click and from the always-visible ⋯ button", async () => {
		const onSelect = vi.fn();
		renderTable({ rowMenu: () => [{ kind: "item", label: "보관", onSelect }] });
		const row = screen.getByRole("row", { name: /draft/ });
		await act(async () => {
			fireEvent.contextMenu(row);
		});
		fireEvent.click(await screen.findByRole("menuitem", { name: "보관" }));
		expect(onSelect).toHaveBeenCalledTimes(1);
		await waitFor(() => expect(screen.queryByRole("menuitem", { name: "보관" })).toBeNull());

		fireEvent.click(within(row).getByRole("button", { name: "draft 작업" }));
		fireEvent.click(await screen.findByRole("menuitem", { name: "보관" }));
		expect(onSelect).toHaveBeenCalledTimes(2);
	});

	it("opens record collections in their form instead of the editor", () => {
		const tag = item("tag-1", { collection: "tag", title: "TypeScript", status: "published" });
		const props = renderTable({
			collection: "tag",
			items: [tag],
			state: parseListState(testSite, new URLSearchParams("collection=tag")),
		});
		fireEvent.click(screen.getByRole("button", { name: "TypeScript" }));
		expect(props.onOpenRecord).toHaveBeenCalledWith(tag);
		// A published item is the normal case: it says nothing.
		expect(screen.queryByText("활성")).toBeNull();
	});

	it("cuts a long relation to its cell with its whole text in the title, as a block that ends in an ellipsis", () => {
		const names = ["리액트", "타입스크립트", "넥스트", "회고"];
		renderTable({
			items: [item("tagged", { relations: { tagIds: names.map((title, id) => ({ id: `t${id}`, title })) } })],
		});
		const cell = screen.getByTitle(names.join(" · "));
		expect(cell.textContent).toBe(names.join(" · "));
		// A block, not a flex box, which would ignore the ellipsis.
		expect(cell.tagName).toBe("DIV");
	});

	it("shows child folders in explorer mode and navigates up", () => {
		const props = renderTable({
			explorer: {
				folders: [{ id: "f2", collection: "post", parentId: "f1", name: "알고리즘", position: 0, version: 1 }],
				parent: "all",
			},
		});
		fireEvent.click(screen.getByRole("button", { name: "알고리즘" }));
		expect(props.onSelectFolder).toHaveBeenCalledWith("f2");
		fireEvent.click(screen.getByRole("button", { name: ".. 상위 폴더" }));
		expect(props.onSelectFolder).toHaveBeenCalledWith("all");
	});

	it("starts a folder row's name in the title's cell, after the folder icon, with how many things are in it, and no status", () => {
		renderTable({
			explorer: {
				folders: [
					{ id: "f2", collection: "post", parentId: null, name: "알고리즘", position: 0, version: 1, entryCount: 2 },
				],
				parent: "f1",
			},
		});
		const folderRow = screen.getByRole("row", { name: /알고리즘/ });
		const cells = within(folderRow).getAllByRole("cell");
		// The status column (first by default) is an empty cell; the title's cell holds the icon, the name and the count.
		expect(cells[0]?.textContent).toBe("");
		const titleCell = cells[1] as HTMLElement;
		expect(titleCell.querySelector("svg")).not.toBeNull();
		expect(titleCell.textContent).toBe(
			`알고리즘${t("list.folderCount", { noun: testSite.COLLECTION_DEFINITIONS.post.label, count: 2 })}`,
		);
		// It takes the columns after it, so the ⋯ cell is the last one.
		expect(Number(titleCell.getAttribute("colspan"))).toBe(columnsFor(testSite, "post").defaults.length - 1);
		// The row to go up has the same shape: empty status, then the icon and the name.
		const up = within(screen.getByRole("row", { name: /상위 폴더/ })).getAllByRole("cell");
		expect(up[0]?.textContent).toBe("");
		expect(up[1]?.querySelector("svg")).not.toBeNull();
	});

	it("a taxonomy item shows its first language and how many others have a name", () => {
		const tag = item("tag-1", {
			collection: "tag",
			title: "리액트",
			status: "published",
			recordLocales: ["ko", "en"],
		} as Partial<ListEntriesItem>);
		renderTable({
			collection: "tag",
			items: [tag],
			state: parseListState(testSite, new URLSearchParams("collection=tag")),
		});
		const row = screen.getByRole("row", { name: /리액트/ });
		// The first language in mono and "+1" for the other one that has a name; the whole list is in its title.
		const cell = within(row).getByText("KO +1");
		expect(cell.getAttribute("title")).toBe("한국어, 영어");
	});

	describe("row drag", () => {
		const dataTransfer = () => ({
			setData: vi.fn(),
			setDragImage: vi.fn(),
			effectAllowed: "",
			types: [] as string[],
		});

		it("dragging one row uses a small drag image holding only that row's title", () => {
			renderTable();
			const transfer = dataTransfer();
			fireEvent.dragStart(screen.getByRole("row", { name: /draft/ }), { dataTransfer: transfer });

			expect(transfer.setDragImage).toHaveBeenCalledTimes(1);
			const [image] = transfer.setDragImage.mock.calls[0] as [HTMLElement];
			expect(image.textContent).toBe("draft");
			expect(JSON.parse(transfer.setData.mock.calls[0]?.[1] as string)).toEqual([{ id: "draft", expectedVersion: 1 }]);
		});

		it("dragging selected rows shows the item count and moves all selected rows", () => {
			renderTable({ selectedIds: new Set(["published", "draft"]) });
			const transfer = dataTransfer();
			fireEvent.dragStart(screen.getByRole("row", { name: /draft/ }), { dataTransfer: transfer });

			const [image] = transfer.setDragImage.mock.calls[0] as [HTMLElement];
			expect(image.textContent).toBe("2개 항목");
			expect(JSON.parse(transfer.setData.mock.calls[0]?.[1] as string)).toHaveLength(2);
		});

		it("the drag image is removed from the page after the drag starts", async () => {
			renderTable();
			const transfer = dataTransfer();
			fireEvent.dragStart(screen.getByRole("row", { name: /draft/ }), { dataTransfer: transfer });
			const [image] = transfer.setDragImage.mock.calls[0] as [HTMLElement];
			expect(document.body.contains(image)).toBe(true);
			await waitFor(() => expect(document.body.contains(image)).toBe(false));
		});
	});

	describe("empty states", () => {
		const t = testSite.createTranslator(screensMessages);
		const emptyTitle = () => document.querySelector('[data-slot="empty-title"]')?.textContent;

		it("welcomes a document collection with no entries, offering to write and to import Markdown", () => {
			const run = vi.fn();
			renderTable({ items: [], total: 0, addAction: { label: "글 추가", run } });
			expect(emptyTitle()).toBe(t("list.welcomeTitle"));
			fireEvent.click(screen.getByRole("button", { name: t("list.writeNew") }));
			expect(run).toHaveBeenCalled();
			const link = screen.getByRole("link", { name: t("list.importMarkdown") });
			expect(link.getAttribute("href")).toMatch(/\/data#import-entries$/);
		});

		it("keeps the plain empty state with an add button for an item collection", () => {
			const run = vi.fn();
			renderTable({
				collection: "tag",
				state: parseListState(testSite, new URLSearchParams("collection=tag")),
				items: [],
				total: 0,
				addAction: { label: "태그 추가", run },
			});
			expect(emptyTitle()).toBe(t("list.emptyYet"));
			expect(screen.queryByRole("link", { name: t("list.importMarkdown") })).toBeNull();
			fireEvent.click(screen.getByRole("button", { name: "태그 추가" }));
			expect(run).toHaveBeenCalled();
		});

		it("says nothing matches when filtered, and clears only the search and filters", () => {
			const state = parseListState(testSite, new URLSearchParams("collection=post&search=zzz&status=draft"));
			const props = renderTable({ items: [], total: 0, state });
			expect(emptyTitle()).toBe(t("list.emptyNoMatch"));
			const empty = document.querySelector<HTMLElement>('[data-slot="empty"]') as HTMLElement;
			fireEvent.click(within(empty).getByRole("button", { name: t("list.clearFilters") }));
			expect(props.onStateChange).toHaveBeenCalledWith(expect.objectContaining({ search: "", statuses: [] }));
			const patch = vi.mocked(props.onStateChange).mock.calls[0]?.[0] ?? {};
			expect(patch).not.toHaveProperty("collection");
			expect(patch).not.toHaveProperty("pageSize");
		});

		it("shows the trash as empty without an action", () => {
			renderTable({ items: [], total: 0, mode: "trash" });
			expect(emptyTitle()).toBe(t("list.emptyTrash"));
			expect(screen.queryByRole("button", { name: t("list.clearFilters") })).toBeNull();
		});
	});
});
