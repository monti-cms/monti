import type { Site } from "@monti-cms/core/client";
import { type AdminListColumn } from "./list-columns.js";
export declare const DEFAULT_TITLE_SIZE = 320;
export declare function defaultColumnSize(site: Site, collection: string, column: AdminListColumn): number;
export declare const MIN_COLUMN_SIZE = 72;
export declare const MAX_COLUMN_SIZE = 960;
export declare const TITLE_MIN_WIDTH = 240;
/**
 * The post date (`publishedAt`) is the date a reader sees, so it goes last: after the locale and the many-relation columns. Hidden first, as it used to be, the list showed only
 * "Updated", which for imported posts is the day of the import.
 */
export declare const hideOrderWhenNarrow: (site: Site, collection: string, available: readonly AdminListColumn[]) => string[];
