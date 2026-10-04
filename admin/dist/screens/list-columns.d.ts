import type { ListSortField } from "@monti-cms/core/client";
import { type StoredField } from "@monti-cms/core/client";
import type { ListState } from "./list-state.js";
/**
 * Admin list columns: the content's own values (system columns) and taxonomy fields (relation fields pointing to a taxonomy collection, e.g. tags or categories).
 * Saved under these names in the user's column settings (order, visibility, width). A taxonomy field column is named after the field.
 */
export declare const SYSTEM_COLUMNS: readonly ["title", "status", "locale", "updatedAt", "publishedAt", "createdAt", "slug", "folder"];
export type AdminListColumn = string;
type DateFromKey = "createdFrom" | "updatedFrom" | "publishedFrom";
type DateToKey = "createdTo" | "updatedTo" | "publishedTo";
/** Filter kinds the column header popup shows. `relation` is a taxonomy field (values are taxonomy item IDs). */
export type ColumnFilter = {
    kind: "text";
    key: "titleContains" | "slugContains";
    placeholder: string;
} | {
    kind: "status";
} | {
    kind: "locale";
} | {
    kind: "relation";
    field: string;
    collection: string;
} | {
    kind: "date";
    from: DateFromKey;
    to: DateToKey;
} | {
    kind: "none";
};
export interface ColumnConfig {
    label: string;
    sortField?: ListSortField;
    filter: ColumnFilter;
    /** Column for a many-relation (tags etc.). Drawn as chips and hidden first when width runs short. */
    many?: boolean;
}
/**
 * Field of a field column: a stored field whose name is not a system column (text, select, media, relation). Taxonomy fields are included.
 * `undefined` if the name does not exist or the field is not stored.
 */
export declare function fieldColumnOf(collection: string, column: AdminListColumn): StoredField | undefined;
/**
 * Label, sort and filter of one column. A taxonomy field's label is the field label, and it filters by the items of the collection the field points to.
 * Other field columns also use the field label as the label and are not filterable.
 */
export declare function columnConfig(collection: string, column: AdminListColumn): ColumnConfig;
export declare const columnLabel: (collection: string, column: AdminListColumn) => string;
/**
 * Default columns when there is no list setting (`list.columns`). Document collections: title, status, locale, taxonomy fields, updated date, published date; item collections:
 * title, slug, locale, status, updated date. The locale column appears only with two or more locales, the slug column only when there is a slug field.
 */
export declare function defaultListColumns(collection: string): AdminListColumn[];
/**
 * Columns available in a collection and their default visibility. Built from the fields of the collection definition and `list.columns` (default columns if absent).
 * Besides system columns and taxonomy fields, fields listed in `list.columns` (text, select, relation, etc.) can also be columns.
 */
export declare function columnsFor(collection: string): {
    available: AdminListColumn[];
    defaults: AdminListColumn[];
};
/** From the stored values keyed by column name (visibility, width), keeps only the columns usable now. */
export declare function knownColumnRecord<T>(record: Readonly<Record<string, T>> | undefined, available: readonly AdminListColumn[]): Record<string, T> | undefined;
/**
 * Filters actually usable in this collection. Item collections have only active/trash,
 * and the trash screen has no status filter since every item is in trash.
 */
export declare function filterFor(collection: string, column: AdminListColumn, mode?: "list" | "trash"): ColumnFilter;
/** Whether a filter is applied to this column. Shown as a chip even if the column is hidden. */
export declare function isColumnFiltered(state: ListState, filter: ColumnFilter): boolean;
export {};
