import type { ListEntriesItem } from "@monti-cms/core/site";
import { act, cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { contentCollection, defaultLocale } from "../../../../core/test/any-site";
import { testSite } from "../../../../core/test/site";
import { renderInRouter as render } from "../../test/router";
import { withSite } from "../../test/site";
import { AdminEntriesTable } from "../admin-entries-table";
import { parseListState } from "../list-state";
import { screensMessages } from "../messages";
import { ENTRY_DRAG_TYPE } from "../shared/entry-drag";

afterEach(cleanup);

const t = testSite.createTranslator(screensMessages);

const item = (id: string, fields: Partial<ListEntriesItem> = {}): ListEntriesItem => ({
	id,
	collection: contentCollection,
	locale: defaultLocale,
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
		collection: contentCollection,
		items: [item("published", { status: "published", hasUnpublishedChanges: true }), item("draft")],
		folders: [],
		explorer: null,
		state: parseListState(testSite, new URLSearchParams(`collection=${contentCollection}`)),
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
	it("LIST-C5 opens the same row actions from right click and from the always-visible ⋯ button", async () => {
		const onSelect = vi.fn();
		// The menu the test hands the table, with a label of its own.
		const label = "보관";
		renderTable({ rowMenu: () => [{ kind: "item", label, onSelect }] });
		const row = screen.getByRole("row", { name: /draft/ });
		await act(async () => {
			fireEvent.contextMenu(row);
		});
		fireEvent.click(await screen.findByRole("menuitem", { name: label }));
		expect(onSelect).toHaveBeenCalledTimes(1);
		await waitFor(() => expect(screen.queryByRole("menuitem", { name: label })).toBeNull());

		fireEvent.click(within(row).getByRole("button", { name: t("list.rowActions", { title: "draft" }) }));
		fireEvent.click(await screen.findByRole("menuitem", { name: label }));
		expect(onSelect).toHaveBeenCalledTimes(2);
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
	});

	describe("empty states", () => {
		const t = testSite.createTranslator(screensMessages);

		it("LIST-F5 says nothing matches when filtered, and clears the search and filters", () => {
			const state = parseListState(
				testSite,
				new URLSearchParams(`collection=${contentCollection}&search=zzz&status=draft`),
			);
			const props = renderTable({ items: [], total: 0, state });
			expect(screen.getByText(t("list.emptyNoMatch"))).toBeInTheDocument();
			fireEvent.click(screen.getByRole("button", { name: t("list.clearFilters") }));
			expect(props.onStateChange).toHaveBeenCalledWith(expect.objectContaining({ search: "", statuses: [] }));
		});
	});
});
