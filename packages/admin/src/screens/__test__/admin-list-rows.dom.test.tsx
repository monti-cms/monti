import type { ListEntriesItem } from "@monti-cms/core/site";
import { cleanup, screen, within } from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { testSite } from "../../../../core/test/site";
import { renderInRouter as render } from "../../test/router";
import { withSite } from "../../test/site";
import { AdminEntriesTable } from "../admin-entries-table";
import { parseListState } from "../list-state";
import { screensMessages } from "../messages";

// The rows of the list as the main board draws them (flow "처음 화면" and "여러 개 선택"): one line per row, a month mark on the left, the title with its address, the
// categories, the language, a status only when it is not plainly published, the short date, and the ⋯ at the end.

afterEach(cleanup);

const t = testSite.createTranslator(screensMessages);

const item = (id: string, fields: Partial<ListEntriesItem> = {}): ListEntriesItem => ({
	id,
	collection: "post",
	locale: "ko",
	translationGroupId: id,
	title: id,
	slug: id,
	status: "published",
	version: 1,
	folderId: null,
	relations: {},
	values: {},
	hasUnpublishedChanges: false,
	publishedAt: null,
	createdAt: new Date("2026-01-01T00:00:00Z"),
	updatedAt: new Date("2026-10-26T03:00:00Z"),
	deletedAt: null,
	...fields,
});

function renderRows(
	items: ListEntriesItem[],
	search = "collection=post",
	overrides: Partial<ComponentProps<typeof AdminEntriesTable>> = {},
) {
	const props: ComponentProps<typeof AdminEntriesTable> = {
		collection: "post",
		items,
		folders: [],
		explorer: null,
		state: parseListState(testSite, new URLSearchParams(search)),
		onStateChange: vi.fn(),
		onColumnSettingsChange: vi.fn(),
		selectedIds: new Set(),
		onSelectionChange: vi.fn(),
		total: items.length,
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

const rowOf = (name: RegExp | string) => screen.getByRole("row", { name });

describe("a row of the list", () => {
	it("says the languages as a code and how many others there are", () => {
		renderRows([
			item("one"),
			item("with-translations", {
				translations: [
					{ id: "a", locale: "ko", status: "published", version: 1, isSource: true, hasUnpublishedChanges: false },
					{ id: "b", locale: "en", status: "draft", version: 1, isSource: false, hasUnpublishedChanges: false },
				],
			}),
		]);
		expect(within(rowOf(/one/)).getByText("KO")).toBeInTheDocument();
		expect(within(rowOf(/with-translations/)).getByText("KO +1")).toBeInTheDocument();
	});

	it("has its check and its ⋯ in the row, named for the entry", () => {
		renderRows([item("first", { title: "첫 번째 글" })]);
		const row = rowOf(/첫 번째 글/);
		expect(
			within(row).getByRole("checkbox", { name: t("list.rowSelect", { title: "첫 번째 글" }) }),
		).toBeInTheDocument();
		expect(
			within(row).getByRole("button", { name: t("list.rowActions", { title: "첫 번째 글" }) }),
		).toBeInTheDocument();
	});
});
