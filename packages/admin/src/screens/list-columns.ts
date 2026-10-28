import type { ListSortField, Site } from "@monti-cms/core/site";
import { type StoredField, valueFieldsOf } from "@monti-cms/core/site";
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

export interface ColumnConfig {
	label: string;
	sortField?: ListSortField;
	/** Column for a many-relation (tags etc.). Drawn as chips and hidden first when width runs short. */
	many?: boolean;
}

/** Label and sort of each system column. */
const systemConfig = (site: Site): Record<SystemColumn, ColumnConfig> => {
	const t = site.createTranslator(screensMessages);
	return {
		title: { label: t("column.title"), sortField: "title" },
		status: { label: t("column.status") },
		locale: { label: t("column.locale") },
		updatedAt: { label: t("column.updatedAt"), sortField: "updatedAt" },
		publishedAt: { label: t("column.publishedAt"), sortField: "publishedAt" },
		createdAt: { label: t("column.createdAt"), sortField: "createdAt" },
		slug: { label: t("column.slug"), sortField: "slug" },
		folder: { label: t("column.folder") },
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
 * Label and sort of one column. A field column is named after the field; a relation to many is drawn as chips and hidden first when width runs short.
 */
export function columnConfig(site: Site, collection: string, column: AdminListColumn): ColumnConfig {
	if (isSystemColumn(column)) return systemConfig(site)[column];
	const stored = fieldColumnOf(site, collection, column);
	if (!stored) return { label: column };
	return {
		label: stored.field.label,
		...(stored.field.kind === "relation" && stored.field.many ? { many: true } : {}),
	};
}

/**
 * Whether the collection is translated per locale in the admin. A document always has a per-locale body; an item only has per-locale values when
 * one of its text fields is `localized: true`, so an item without one shows no locale column or locale tabs.
 */
export function collectionTranslated(site: Site, collection: string): boolean {
	if (!site.ADMIN_TRANSLATIONS || !site.isCollection(collection)) return false;
	return !site.isItemCollection(collection) || site.recordLocalizedFields(collection).length > 0;
}

export const columnLabel = (site: Site, collection: string, column: AdminListColumn) =>
	columnConfig(site, collection, column).label;

/**
 * Default columns, used until the writer chooses their own in the list screen's column settings. Document collections: title, taxonomy fields, locale, status, updated date (the order of a row on the main board); item collections:
 * title, locale, status, updated date. The slug rides beside the title; its own column is off until the writer turns it on. The locale column appears only where the translation UI is shown (two or more locales, `admin.translations` not `false`, and for an item collection a `localized` field).
 */
export function defaultListColumns(site: Site, collection: string): AdminListColumn[] {
	if (!site.isCollection(collection)) return ["title", "status"];
	const schema = site.schemaOf(collection);
	const locale = collectionTranslated(site, collection) ? ["locale"] : [];
	if (schema.kind === "item") {
		return ["title", ...locale, "status", "updatedAt"];
	}
	const taxonomy = site.taxonomyFieldsOf(collection).map((stored) => stored.name);
	return ["title", ...taxonomy, ...locale, "status", "updatedAt"];
}

/**
 * Columns available in a collection and their default visibility. Built from the fields of the collection definition.
 * Besides system columns and taxonomy fields, the other stored fields (text, select, relation, etc.) can also be columns; the defaults are `defaultListColumns`.
 */
export function columnsFor(
	site: Site,
	collection: string,
): { available: AdminListColumn[]; defaults: AdminListColumn[] } {
	if (!site.isCollection(collection)) return { available: [...SYSTEM_COLUMNS], defaults: ["title", "status"] };
	const schema = site.schemaOf(collection);
	// The slug column is used whenever there is a slug field (`fields.slug`), whatever its name.
	const slugField = Object.entries(schema.fields).find(([, field]) => field.kind === "slug")?.[0];
	const system = SYSTEM_COLUMNS.filter((column) => {
		// Item collections have no publishing: saving is publishing. The locale column shows locales that have a name.
		if (column === "publishedAt") return schema.kind === "document";
		if (column === "slug") return slugField !== undefined;
		// A site with one locale, one that turned the translation UI off, or an item collection with no per-locale field has no locale column.
		if (column === "locale") return collectionTranslated(site, collection);
		return true;
	});
	const taxonomy = site.taxonomyFieldsOf(collection).map((stored) => stored.name);
	// Every other stored field can be a column too (hidden until the writer shows it in the column settings).
	// The title field is the system column `title` whatever its name, so its own name is not a second column.
	const titleName = site.titleField(collection).name;
	const fieldColumns = valueFieldsOf(schema)
		.map((stored) => stored.name)
		.filter((column) => column !== titleName && !taxonomy.includes(column) && !isSystemColumn(column));
	// Taxonomy field columns go after the locale column, and other field columns follow.
	const at = system.indexOf(system.includes("locale") ? "locale" : "status") + 1;
	const available = [...system.slice(0, at), ...taxonomy, ...fieldColumns, ...system.slice(at)];
	const defaults = defaultListColumns(site, collection)
		.map((column) => (column === slugField ? "slug" : column === titleName ? "title" : column))
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
