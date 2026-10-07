import type { ListSortField, Site } from "@monti-cms/core/client";
import { type StoredField, valueFieldsOf } from "@monti-cms/core/client";
import type { ListState } from "./list-state";
import { screensMessages } from "./messages";

/**
 * Admin list columns: the content's own values (system columns) and taxonomy fields (relation fields pointing to a taxonomy collection, e.g. tags or categories).
 * Saved under these names in the user's column settings (order, visibility, width). A taxonomy field column is named after the field.
 */
export const SYSTEM_COLUMNS = [
	"title",
	"status",
	"locale",
	"updatedAt",
	"publishedAt",
	"createdAt",
	"slug",
	"folder",
] as const;
type SystemColumn = (typeof SYSTEM_COLUMNS)[number];
export type AdminListColumn = string;

type DateFromKey = "createdFrom" | "updatedFrom" | "publishedFrom";
type DateToKey = "createdTo" | "updatedTo" | "publishedTo";

/** Filter kinds the column header popup shows. `relation` is a taxonomy field (values are taxonomy item IDs). */
export type ColumnFilter =
	| { kind: "text"; key: "titleContains" | "slugContains"; placeholder: string }
	| { kind: "status" }
	| { kind: "locale" }
	| { kind: "relation"; field: string; collection: string }
	| { kind: "date"; from: DateFromKey; to: DateToKey }
	| { kind: "none" };

export interface ColumnConfig {
	label: string;
	sortField?: ListSortField;
	filter: ColumnFilter;
	/** Column for a many-relation (tags etc.). Drawn as chips and hidden first when width runs short. */
	many?: boolean;
}

/** Label, sort and filter of each system column. */
const systemConfig = (site: Site): Record<SystemColumn, ColumnConfig> => {
	const t = site.createTranslator(screensMessages);
	return {
		title: {
			label: t("column.title"),
			sortField: "title",
			filter: { kind: "text", key: "titleContains", placeholder: t("column.titlePlaceholder") },
		},
		status: { label: t("column.status"), filter: { kind: "status" } },
		locale: { label: t("column.locale"), filter: { kind: "locale" } },
		updatedAt: {
			label: t("column.updatedAt"),
			sortField: "updatedAt",
			filter: { kind: "date", from: "updatedFrom", to: "updatedTo" },
		},
		publishedAt: {
			label: t("column.publishedAt"),
			sortField: "publishedAt",
			filter: { kind: "date", from: "publishedFrom", to: "publishedTo" },
		},
		createdAt: {
			label: t("column.createdAt"),
			sortField: "createdAt",
			filter: { kind: "date", from: "createdFrom", to: "createdTo" },
		},
		slug: {
			label: t("column.slug"),
			sortField: "slug",
			filter: { kind: "text", key: "slugContains", placeholder: t("column.slugPlaceholder") },
		},
		// Folders are filtered through sidebar navigation.
		folder: { label: t("column.folder"), filter: { kind: "none" } },
	};
};

const isSystemColumn = (column: string): column is SystemColumn =>
	(SYSTEM_COLUMNS as readonly string[]).includes(column);

/**
 * Field of a field column: a stored field whose name is not a system column (text, select, media, relation). Taxonomy fields are included.
 * `undefined` if the name does not exist or the field is not stored.
 */
export function fieldColumnOf(site: Site, collection: string, column: AdminListColumn): StoredField | undefined {
	if (isSystemColumn(column) || !site.isCollection(collection)) return undefined;
	return valueFieldsOf(site.schemaOf(collection)).find((stored) => stored.name === column);
}

/**
 * Label, sort and filter of one column. A taxonomy field's label is the field label, and it filters by the items of the collection the field points to.
 * Other field columns also use the field label as the label and are not filterable.
 */
export function columnConfig(site: Site, collection: string, column: AdminListColumn): ColumnConfig {
	if (isSystemColumn(column)) return systemConfig(site)[column];
	const taxonomy = site.taxonomyFieldsOf(collection).find((stored) => stored.name === column);
	if (taxonomy?.field.kind === "relation") {
		return {
			label: taxonomy.field.label,
			filter: { kind: "relation", field: column, collection: taxonomy.to },
			many: taxonomy.field.many === true,
		};
	}
	const stored = fieldColumnOf(site, collection, column);
	if (!stored) return { label: column, filter: { kind: "none" } };
	return {
		label: stored.field.label,
		filter: { kind: "none" },
		...(stored.field.kind === "relation" && stored.field.many ? { many: true } : {}),
	};
}

export const columnLabel = (site: Site, collection: string, column: AdminListColumn) =>
	columnConfig(site, collection, column).label;

/**
 * Default columns when there is no list setting (`list.columns`). Document collections: title, status, locale, taxonomy fields, updated date, published date; item collections:
 * title, slug, locale, status, updated date. The locale column appears only where the translation UI is shown (two or more locales, `admin.translations` not `false`), the slug column only when there is a slug field.
 */
export function defaultListColumns(site: Site, collection: string): AdminListColumn[] {
	if (!site.isCollection(collection)) return ["title", "status"];
	const schema = site.schemaOf(collection);
	const locale = site.ADMIN_TRANSLATIONS ? ["locale"] : [];
	if (schema.kind === "item") {
		const slug = Object.values(schema.fields).some((field) => field.kind === "slug") ? ["slug"] : [];
		return ["title", ...slug, ...locale, "status", "updatedAt"];
	}
	const taxonomy = site.taxonomyFieldsOf(collection).map((stored) => stored.name);
	return ["title", "status", ...locale, ...taxonomy, "updatedAt", "publishedAt"];
}

/**
 * Columns available in a collection and their default visibility. Built from the fields of the collection definition and `list.columns` (default columns if absent).
 * Besides system columns and taxonomy fields, fields listed in `list.columns` (text, select, relation, etc.) can also be columns.
 */
export function columnsFor(
	site: Site,
	collection: string,
): { available: AdminListColumn[]; defaults: AdminListColumn[] } {
	if (!site.isCollection(collection)) return { available: [...SYSTEM_COLUMNS], defaults: ["title", "status"] };
	const schema = site.schemaOf(collection);
	// The slug column is used whenever there is a slug field (`fields.slug`), whatever its name. `title` exists in every collection.
	const slugField = Object.entries(schema.fields).find(([, field]) => field.kind === "slug")?.[0];
	const system = SYSTEM_COLUMNS.filter((column) => {
		// Item collections have no publishing: saving is publishing. The locale column shows locales that have a name.
		if (column === "publishedAt") return schema.kind === "document";
		if (column === "slug") return slugField !== undefined;
		// A site with one locale, or one that turned the translation UI off, has no locale column.
		if (column === "locale") return site.ADMIN_TRANSLATIONS;
		return true;
	});
	const taxonomy = site.taxonomyFieldsOf(collection).map((stored) => stored.name);
	// Other fields listed in the list setting (`defineConfig` verified they are stored fields).
	const listed = [...new Set(schema.list?.columns ?? [])];
	const fieldColumns = listed.filter((column) => !taxonomy.includes(column) && fieldColumnOf(site, collection, column));
	// Taxonomy field columns go after the locale column, and other field columns follow.
	const at = system.indexOf(system.includes("locale") ? "locale" : "status") + 1;
	const available = [...system.slice(0, at), ...taxonomy, ...fieldColumns, ...system.slice(at)];
	const defaults = (schema.list?.columns ?? defaultListColumns(site, collection))
		.map((column) => (column === slugField ? "slug" : column))
		.filter((column) => available.includes(column));
	return { available, defaults };
}

/** From the stored values keyed by column name (visibility, width), keeps only the columns usable now. */
export function knownColumnRecord<T>(
	record: Readonly<Record<string, T>> | undefined,
	available: readonly AdminListColumn[],
): Record<string, T> | undefined {
	if (!record) return undefined;
	return Object.fromEntries(Object.entries(record).filter(([column]) => available.includes(column)));
}

/**
 * Filters actually usable in this collection. Item collections have only active/trash,
 * and the trash screen has no status filter since every item is in trash.
 */
export function filterFor(
	site: Site,
	collection: string,
	column: AdminListColumn,
	mode: "list" | "trash" = "list",
): ColumnFilter {
	const filter = columnConfig(site, collection, column).filter;
	if (filter.kind === "status" && (site.isItemCollection(collection) || mode === "trash")) return { kind: "none" };
	// A taxonomy item's locale column only shows locales that have a name, so it does not filter by locale.
	if (filter.kind === "locale" && site.isItemCollection(collection)) return { kind: "none" };
	return filter;
}

/** Whether a filter is applied to this column. Shown as a chip even if the column is hidden. */
export function isColumnFiltered(state: ListState, filter: ColumnFilter): boolean {
	switch (filter.kind) {
		case "text":
			return state[filter.key].trim() !== "";
		case "status":
			return state.statuses.length > 0 || state.hasChanges;
		case "relation":
			return (state.relations[filter.field]?.length ?? 0) > 0;
		case "locale":
			return state.locales.length > 0;
		case "date":
			return Boolean(state[filter.from] || state[filter.to]);
		case "none":
			return false;
	}
}
