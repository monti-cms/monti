// Column width rules of the entries table: default/min/max sizes and which columns are hidden first when width runs short.
import type { Site } from "@monti-cms/core/site";
import { type AdminListColumn, columnConfig, fieldColumnOf } from "./list-columns";

/**
 * Default column widths (px): the cells of a row (`entries-table-row.tsx`). Title fills the remaining width. The taxonomy fields are drawn as one cell of 198px, so
 * each counts half of it; the month column and the row's end are part of the title's minimum.
 */
const DEFAULT_COLUMN_SIZE: Partial<Record<string, number>> = {
	status: 72,
	locale: 56,
	updatedAt: 56,
	publishedAt: 56,
	createdAt: 56,
	slug: 160,
	folder: 140,
};
export const DEFAULT_TITLE_SIZE = 320;
const TAXONOMY_SIZE = 99;
const FIELD_SIZE = 160;

export function defaultColumnSize(site: Site, collection: string, column: AdminListColumn): number {
	const size = DEFAULT_COLUMN_SIZE[column];
	if (size !== undefined) return size;
	if (site.taxonomyFieldsOf(collection).some((stored) => stored.name === column)) return TAXONOMY_SIZE;
	return fieldColumnOf(site, collection, column) ? FIELD_SIZE : DEFAULT_TITLE_SIZE;
}
export const MIN_COLUMN_SIZE = 72;
export const MAX_COLUMN_SIZE = 960;
/** The title with its address, and the month column and the row end beside it. */
export const TITLE_MIN_WIDTH = 292;

/**
 * Columns hidden first when width runs short, and their order. Even user-enabled columns are hidden in this order if the title cannot get its minimum width.
 * Many-relation taxonomy field columns (tags etc.) are hidden next, and the post date last. Title, status, single taxonomy fields (category etc.) and updated date are never hidden.
 */
const HIDE_ORDER_WHEN_NARROW = ["folder", "slug", "createdAt", "locale"] as const;
/**
 * The post date (`publishedAt`) is the date a reader sees, so it goes last: after the locale and the many-relation columns. Hidden first, as it used to be, the list showed only
 * "Updated", which for imported posts is the day of the import.
 */
export const hideOrderWhenNarrow = (site: Site, collection: string, available: readonly AdminListColumn[]) => [
	...HIDE_ORDER_WHEN_NARROW,
	...available.filter((column) => columnConfig(site, collection, column).many),
	"publishedAt",
];
