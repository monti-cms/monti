import type { ListEntriesItem } from "@monti-cms/core/runtime";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AdminEntriesTable, columnsFor } from "../admin-entries-table";
import { parseListState } from "../list-state";
import { filterChips } from "../list-toolbar";

afterEach(cleanup);

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

const options = { tagIds: [{ id: "t1", title: "React", slug: "react" }], categoryId: [] };

function renderTable(overrides: Partial<ComponentProps<typeof AdminEntriesTable>> = {}) {
	const props: ComponentProps<typeof AdminEntriesTable> = {
		collection: "post",
		items: [item("published", { status: "published", hasUnpublishedChanges: true }), item("draft")],
		folders: [],
		explorer: null,
		state: parseListState(new URLSearchParams("collection=post")),
		options,
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
	render(<AdminEntriesTable {...props} />);
	return props;
}

describe("admin entry list", () => {
	it("uses the default columns per collection", () => {
		for (const collection of ["post", "memo", "tag"] as const) {
			const { defaults, available } = columnsFor(collection);
			expect(defaults[0]).toBe("title");
			expect(defaults).toContain("status");
			expect(defaults).toContain("updatedAt");
			for (const column of defaults) expect(available).toContain(column);
		}
		// Taxonomy items have no per-locale documents but show the locales that have a name.
		expect(columnsFor("tag").defaults).toContain("locale");
		expect(columnsFor("memo").available).not.toContain("categoryId");
		expect(columnsFor("tag").available).not.toContain("tagIds");
	});

	it("states status in text, including unpublished changes", () => {
		renderTable({ items: [item("changed", { status: "published", hasUnpublishedChanges: true })] });
		expect(screen.getByText("발행됨 · 수정 중")).toBeTruthy();
	});

	it("sorts from the column header popup and exposes aria-sort on the header cell", async () => {
		const props = renderTable();
		expect(screen.getByRole("columnheader", { name: /수정일/ }).getAttribute("aria-sort")).toBe("descending");
		fireEvent.click(screen.getByRole("button", { name: /^발행일$/ }));
		fireEvent.click(await screen.findByRole("button", { name: "오름차순" }));
		expect(props.onStateChange).toHaveBeenCalledWith({ sortField: "publishedAt", sortDirection: "asc" });
	});

	it("filters status like a spreadsheet header and marks the filtered header without relying on color", async () => {
		const props = renderTable({ state: parseListState(new URLSearchParams("collection=post&changes=1")) });
		const header = screen.getByRole("button", { name: /^상태, 필터 적용됨/ });
		fireEvent.click(header);
		fireEvent.click(await screen.findByRole("checkbox", { name: "초안" }));
		expect(props.onStateChange).toHaveBeenCalledWith({ statuses: ["draft"] });
		fireEvent.click(screen.getByRole("button", { name: "필터 해제" }));
		expect(props.onStateChange).toHaveBeenLastCalledWith({ statuses: [], hasChanges: false });
	});

	it("keeps filters on hidden columns visible as chips", () => {
		const state = parseListState(
			new URLSearchParams("collection=post&slug=react&relation=tagIds:t1&status=draft&changes=1"),
		);
		const labels = filterChips(state, options).map((chip) => chip.label);
		// The slug column stays as a chip even when hidden by default.
		expect(labels).toEqual(["상태: 초안, 수정 중", "태그: React", '주소: "react"']);
	});

	it("persists column visibility and order", async () => {
		const props = renderTable();
		fireEvent.click(screen.getByRole("button", { name: "컬럼 설정" }));
		fireEvent.click(await screen.findByRole("checkbox", { name: "생성일" }));
		expect(props.onColumnSettingsChange).toHaveBeenLastCalledWith(
			expect.objectContaining({ visibility: expect.objectContaining({ createdAt: true }) }),
		);
		fireEvent.click(screen.getByRole("button", { name: "상태 컬럼 위로" }));
		expect((props.onColumnSettingsChange as ReturnType<typeof vi.fn>).mock.lastCall?.[0].order.slice(0, 2)).toEqual([
			"status",
			"title",
		]);
	});

	it("resizes a column from its header handle and pins the flexible title so only that column grows", () => {
		vi.useFakeTimers();
		try {
			const props = renderTable();
			const handle = screen.getByRole("separator", { name: "태그 열 너비 조절" });
			expect(handle.getAttribute("aria-valuenow")).toBe("200");
			fireEvent.keyDown(handle, { key: "ArrowRight" });
			expect(handle.getAttribute("aria-valuenow")).toBe("216");
			act(() => vi.advanceTimersByTime(400));
			expect(props.onColumnSettingsChange).toHaveBeenLastCalledWith(
				expect.objectContaining({ sizes: { title: 320, tagIds: 216 } }),
			);
		} finally {
			vi.useRealTimers();
		}
	});

	it("ignores saved column names that are not columns any more (no guessing of old names)", () => {
		renderTable({
			columnSettings: {
				order: ["tags", "tagIds", "title"],
				visibility: { category: false, tags: false },
				sizes: { tags: 240, tagIds: 230 },
			},
		});
		// Old short names (`category`, `tags`) are not guessed and renamed by the core (the reference blog setup moves them with a migration).
		expect(screen.getByRole("columnheader", { name: /카테고리/ })).toBeTruthy();
		const handle = screen.getByRole("separator", { name: "태그 열 너비 조절" });
		expect(handle.getAttribute("aria-valuenow")).toBe("230");
		const headers = screen.getAllByRole("columnheader").map((header) => header.textContent);
		expect(headers.findIndex((text) => text?.includes("태그"))).toBeLessThan(
			headers.findIndex((text) => text?.includes("제목")),
		);
	});

	it("selects rows through the Data Table checkboxes", () => {
		const props = renderTable();
		fireEvent.click(screen.getByRole("checkbox", { name: "draft 선택" }));
		expect(props.onSelectionChange).toHaveBeenCalledWith(new Set(["draft"]));
		fireEvent.click(screen.getByRole("checkbox", { name: "현재 페이지 전체 선택" }));
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
			state: parseListState(new URLSearchParams("collection=tag")),
		});
		fireEvent.click(screen.getByRole("button", { name: "TypeScript" }));
		expect(props.onOpenRecord).toHaveBeenCalledWith(tag);
		expect(screen.getByText("활성")).toBeTruthy();
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

	it("a taxonomy item shows the locales that have a name in the locale column", () => {
		const tag = item("tag-1", {
			collection: "tag",
			title: "리액트",
			status: "published",
			recordLocales: ["ko", "en"],
		} as Partial<ListEntriesItem>);
		renderTable({
			collection: "tag",
			items: [tag],
			state: parseListState(new URLSearchParams("collection=tag")),
		});
		const row = screen.getByRole("row", { name: /리액트/ });
		expect(within(row).getByText("한국어 있음")).toBeTruthy();
		expect(within(row).getByText("영어 있음")).toBeTruthy();
		expect(within(row).getByText("일본어 없음")).toBeTruthy();
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
});
