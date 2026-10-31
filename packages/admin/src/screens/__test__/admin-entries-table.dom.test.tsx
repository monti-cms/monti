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
import { ENTRY_DRAG_TYPE } from "../shared/entry-drag";

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
	deletedAt: null,
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
	it("LIST-C5 selects rows through the row checks and the select-all of the toolbar", () => {
		const props = renderTable();
		fireEvent.click(screen.getByRole("checkbox", { name: "draft 선택" }));
		expect(props.onSelectionChange).toHaveBeenCalledWith(new Set(["draft"]));
		fireEvent.click(screen.getByRole("checkbox", { name: t("list.selectAll") }));
		expect(props.onSelectionChange).toHaveBeenLastCalledWith(new Set(["published", "draft"]));
	});

	it("LIST-C5 opens the same row actions from right click and from the always-visible ⋯ button", async () => {
		const onSelect = vi.fn();
		renderTable({ rowMenu: () => [{ kind: "item", label: "보관", onSelect }] });
		const row = screen.getByRole("row", { name: /draft/ });
		await act(async () => {
			fireEvent.contextMenu(row);
		});
		fireEvent.click(await screen.findByRole("menuitem", { name: "보관" }));
		expect(onSelect).toHaveBeenCalledTimes(1);
		await waitFor(() => expect(screen.queryByRole("menuitem", { name: "보관" })).toBeNull());

		fireEvent.click(within(row).getByRole("button", { name: t("list.rowActions", { title: "draft" }) }));
		fireEvent.click(await screen.findByRole("menuitem", { name: "보관" }));
		expect(onSelect).toHaveBeenCalledTimes(2);
	});

	it("LIST-S3 opens record collections in their form instead of the editor", () => {
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

	it("LIST-F6 shows child folders in explorer mode and navigates up", () => {
		const props = renderTable({
			explorer: {
				folders: [{ id: "f2", collection: "post", parentId: "f1", name: "알고리즘", position: 0, version: 1 }],
				parent: "all",
			},
		});
		fireEvent.click(screen.getByRole("button", { name: "알고리즘" }));
		expect(props.onSelectFolder).toHaveBeenCalledWith("f2");
		fireEvent.click(screen.getByRole("button", { name: t("list.folderUp") }));
		expect(props.onSelectFolder).toHaveBeenCalledWith("all");
	});

	it("LIST-F6 starts a folder row's name in the title's cell, after the folder icon, with how many things are in it, and no status", () => {
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
		expect(titleCell.querySelector("svg")).toBeInTheDocument();
		expect(titleCell.textContent).toBe(
			`알고리즘${t("list.folderCount", { noun: testSite.COLLECTION_DEFINITIONS.post.label, count: 2 })}`,
		);
		// It takes the columns after it, so the ⋯ cell is the last one.
		expect(Number(titleCell.getAttribute("colspan"))).toBe(columnsFor(testSite, "post").defaults.length - 1);
		// The row to go up has the same shape: empty status, then the icon and the name.
		const up = within(screen.getByRole("row", { name: /상위 폴더/ })).getAllByRole("cell");
		expect(up[0]?.textContent).toBe("");
		expect(up[1]?.querySelector("svg")).toBeInTheDocument();
	});

	it("LIST-S3 a taxonomy item shows its first language and how many others have a name", () => {
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
		// Keeps what the row wrote by format, and the image it set, so a test reads them by meaning.
		const dataTransfer = () => {
			const transfer = {
				data: new Map<string, string>(),
				dragImage: null as Element | null,
				setData: vi.fn((format: string, value: string) => {
					transfer.data.set(format, value);
				}),
				setDragImage: vi.fn((image: Element) => {
					transfer.dragImage = image;
				}),
				effectAllowed: "",
				types: [] as string[],
			};
			return transfer;
		};
		const draggedEntries = (transfer: ReturnType<typeof dataTransfer>) =>
			JSON.parse(transfer.data.get(ENTRY_DRAG_TYPE) ?? "null");

		it("LIST-C5 dragging one row uses a small drag image holding only that row's title", () => {
			renderTable();
			const transfer = dataTransfer();
			fireEvent.dragStart(screen.getByRole("row", { name: /draft/ }), { dataTransfer: transfer });

			expect(transfer.setDragImage).toHaveBeenCalledTimes(1);
			expect(transfer.dragImage?.textContent).toBe("draft");
			expect(draggedEntries(transfer)).toEqual([{ id: "draft", expectedVersion: 1 }]);
		});

		it("LIST-C5 dragging selected rows shows the item count and moves all selected rows", () => {
			renderTable({ selectedIds: new Set(["published", "draft"]) });
			const transfer = dataTransfer();
			fireEvent.dragStart(screen.getByRole("row", { name: /draft/ }), { dataTransfer: transfer });

			expect(transfer.dragImage?.textContent).toBe(t("list.itemsCount", { count: 2 }));
			expect(draggedEntries(transfer)).toEqual([
				{ id: "published", expectedVersion: 1 },
				{ id: "draft", expectedVersion: 1 },
			]);
		});

		it("LIST-C5 the drag image is removed from the page after the drag starts", async () => {
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

		it("LIST-S3 welcomes a document collection with no entries, offering to write and to import Markdown", () => {
			const run = vi.fn();
			renderTable({ items: [], total: 0, addAction: { label: "글 추가", run } });
			expect(emptyTitle()).toBe(t("list.welcomeTitle"));
			fireEvent.click(screen.getByRole("button", { name: t("list.writeNew") }));
			expect(run).toHaveBeenCalled();
			const link = screen.getByRole("link", { name: t("list.importMarkdown") });
			expect(link.getAttribute("href")).toMatch(/\/data#import-entries$/);
		});

		it("LIST-S3 keeps the plain empty state with an add button for an item collection", () => {
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

		it("LIST-F5 says nothing matches when filtered, and clears the search and filters", () => {
			const state = parseListState(testSite, new URLSearchParams("collection=post&search=zzz&status=draft"));
			const props = renderTable({ items: [], total: 0, state });
			expect(screen.getByText(t("list.emptyNoMatch"))).toBeInTheDocument();
			fireEvent.click(screen.getByRole("button", { name: t("list.clearFilters") }));
			expect(props.onStateChange).toHaveBeenCalledWith(expect.objectContaining({ search: "", statuses: [] }));
		});
	});
});
