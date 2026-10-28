import type { ListSortField, Site } from "@monti-cms/core/site";
import { type AdminListColumn, columnConfig, columnsFor } from "./list-columns";
import { type FilterField, filterFieldOf } from "./list-filter-fields";
import type { ListState } from "./list-state";

/** The dates a list can be filtered by, as `ListState` keeps them. */
export type DateKey = "updated" | "published" | "created";

const DATE_KEYS: Partial<Record<AdminListColumn, DateKey>> = {
	updatedAt: "updated",
	publishedAt: "published",
	createdAt: "created",
};

/** What a column's menu can filter by: the status, the language (with the translation state beside it), one date, or one stored field. */
export type ColumnFilter =
	| { readonly kind: "status" }
	| { readonly kind: "language"; readonly translation: boolean }
	| { readonly kind: "date"; readonly key: DateKey }
	| { readonly kind: "field"; readonly field: FilterField };

/**
 * The sections a column's menu has, top to bottom; a section a column does not have is left out. Sort: the field the list is sorted by, and whether its
 * two orders read as letters (A → Z) or as dates (newest first). Filter: the values to tick. Hide: every column but the title.
 */
export interface ColumnMenu {
	readonly sort: { readonly field: ListSortField; readonly reads: "text" | "date" } | null;
	readonly filter: ColumnFilter | null;
	readonly hide: boolean;
}

/** The date a column holds, if it holds one. */
const dateKeyOf = (column: AdminListColumn): DateKey | undefined => DATE_KEYS[column];

/** The filter of a column, or `null` when it has none: the title and the address are found by search, and the folder is filtered in the sidebar. */
function filterOf(site: Site, collection: string, column: AdminListColumn): ColumnFilter | null {
	if (column === "status") return { kind: "status" };
	if (column === "locale") return { kind: "language", translation: site.isDocumentCollection(collection) };
	const key = dateKeyOf(column);
	if (key) return { kind: "date", key };
	const field = filterFieldOf(site, collection, column);
	return field ? { kind: "field", field } : null;
}

/** The menu of one column of a list. */
export function columnMenuOf(site: Site, collection: string, column: AdminListColumn): ColumnMenu {
	const field = columnConfig(site, collection, column).sortField;
	return {
		sort: field ? { field, reads: field === "title" || field === "slug" ? "text" : "date" } : null,
		filter: filterOf(site, collection, column),
		hide: column !== "title" && columnsFor(site, collection).available.includes(column),
	};
}

/** Whether a filter is on in this column: it shows a dot after the name. */
export function isColumnFiltered(
	site: Site,
	collection: string,
	column: AdminListColumn,
	state: Pick<ListState, "statuses" | "locales" | "translations" | "fields" | "updated" | "published" | "created">,
): boolean {
	const filter = filterOf(site, collection, column);
	switch (filter?.kind) {
		case "status":
			return state.statuses.length > 0;
		case "language":
			return state.locales.length > 0 || state.translations.length > 0;
		case "date":
			return state[filter.key] !== null;
		case "field":
			return (state.fields[filter.field.name]?.length ?? 0) > 0;
		default:
			return false;
	}
}

/** The columns a menu can turn on: those that are hidden (the title never is). */
export const hiddenColumns = (order: readonly AdminListColumn[], visibility: Readonly<Record<string, boolean>>) =>
	order.filter((column) => column !== "title" && visibility[column] === false);
