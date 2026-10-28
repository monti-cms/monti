// Column widths of a list and which columns are left out first when the width runs short.
import type { Site } from "@monti-cms/core/site";
import { type AdminListColumn, columnConfig, fieldColumnOf } from "./list-columns";

/** Widths (px) of the system columns: what each holds, plus the 20px a cell keeps around it. The title takes the room the others leave. */
const SYSTEM_SIZE: Partial<Record<AdminListColumn, number>> = {
	status: 92,
	locale: 64,
	updatedAt: 72,
	publishedAt: 72,
	createdAt: 72,
	slug: 160,
	folder: 140,
};
/** A relation to many (tags) holds a few names; one to one (a category) holds one. */
const MANY_SIZE = 180;
const ONE_SIZE = 120;
const FIELD_SIZE = 160;

/** The width of one column. The title has none: it takes the rest. */
export function columnSize(site: Site, collection: string, column: AdminListColumn): number | undefined {
	if (column === "title") return undefined;
	const size = SYSTEM_SIZE[column];
	if (size !== undefined) return size;
	const stored = fieldColumnOf(site, collection, column);
	if (stored?.field.kind === "relation") return stored.field.many ? MANY_SIZE : ONE_SIZE;
	return FIELD_SIZE;
}

/** The least the title gets (with its address beside it) before columns are left out. */
export const TITLE_MIN_WIDTH = 240;
/** The ⋯ at the end of a row: its 32px button and the cell's padding. */
export const ACTIONS_SIZE = 54;

/** Columns left out first when the width runs short, in this order. The title, the status, a single taxonomy field and the updated date always stay. */
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
