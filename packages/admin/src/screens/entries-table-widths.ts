// Column width rules of the entries table: default/min/max sizes and which columns are hidden first when width runs short.
import type { Site } from "@monti-cms/core/client";
import { type AdminListColumn, columnConfig, fieldColumnOf } from "./list-columns";

/**
 * Default column widths (px). Title fills the remaining width if unset. Dragging to change it saves that value.
 * A taxonomy field column is wide enough for chips if it is a many-relation (tags etc.), or for a single name if single (category etc.).
 */
const DEFAULT_COLUMN_SIZE: Partial<Record<string, number>> = {
	status: 132,
	locale: 124,
	updatedAt: 132,
	publishedAt: 132,
	createdAt: 132,
	slug: 200,
	folder: 140,
};
export const DEFAULT_TITLE_SIZE = 320;
const MANY_RELATION_SIZE = 200;
const SINGLE_RELATION_SIZE = 112;
const SELECT_SIZE = 132;
const TEXT_SIZE = 200;

export function defaultColumnSize(site: Site, collection: string, column: AdminListColumn): number {
	const size = DEFAULT_COLUMN_SIZE[column];
	if (size !== undefined) return size;
	const config = columnConfig(site, collection, column);
	const kind = fieldColumnOf(site, collection, column)?.field.kind;
	if (kind === "relation") return config.many ? MANY_RELATION_SIZE : SINGLE_RELATION_SIZE;
	if (kind === "select") return SELECT_SIZE;
	if (kind === "text" || kind === "media") return TEXT_SIZE;
	return DEFAULT_TITLE_SIZE;
}
export const MIN_COLUMN_SIZE = 72;
export const MAX_COLUMN_SIZE = 960;
export const TITLE_MIN_WIDTH = 240;

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
