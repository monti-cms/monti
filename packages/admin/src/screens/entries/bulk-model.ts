import type { ListEntriesItem, Site } from "@monti-cms/core/site";
import type { BulkSelection } from "../../api/entries";

/** A row as a bulk request names it: its id and the version the writer saw. */
export const toSelection = (item: ListEntriesItem): BulkSelection => ({
	id: item.id,
	expectedVersion: item.version,
	title: item.title,
	status: item.status,
	folderId: item.folderId,
});

/** A relation field of a collection that the bar's Change menu can change on several rows at once. */
export interface ChangeableRelation {
	readonly name: string;
	readonly label: string;
	/** The collection the field points to. */
	readonly to: string;
	readonly many: boolean;
	readonly required: boolean;
	/** The field lists only published targets when picking. */
	readonly publishedOnly: boolean;
}

/**
 * The collection's own relation fields in schema order: the ones a writer edits on the entry. A field that only exists inside a conditional branch is left
 * out (it is kept only while the branch's choice matches, which a bulk change cannot know), and so is a backlink, which is stored on the other record.
 */
export function changeableRelations(site: Site, collection: string): ChangeableRelation[] {
	if (!site.isCollection(collection)) return [];
	return site.storedFields(collection).flatMap(({ name, field, when }) =>
		field.kind === "relation" && !when
			? [
					{
						name,
						label: field.label,
						to: field.to,
						many: field.many === true,
						required: field.required === true,
						publishedOnly: field.publishedOnly === true,
					},
				]
			: [],
	);
}

/** How many of these rows hold `id` in a relation field, and so whether every row, some or none do. */
export function holding(
	rows: readonly ListEntriesItem[],
	field: string,
	id: string,
): { state: "all" | "some" | "none"; count: number } {
	const count = rows.filter((row) => (row.relations[field] ?? []).some((value) => value.id === id)).length;
	return { state: count === 0 ? "none" : count === rows.length ? "all" : "some", count };
}

/** The ids any of these rows holds in a relation field, in the order they are first met. */
export function heldIds(rows: readonly ListEntriesItem[], field: string): string[] {
	return [...new Set(rows.flatMap((row) => (row.relations[field] ?? []).map((value) => value.id)))];
}

/** The one value of a single-value relation that every row holds, or `null` when they differ or any holds none. */
export function sharedValue(rows: readonly ListEntriesItem[], field: string): string | null {
	const first = rows[0]?.relations[field]?.[0]?.id;
	if (first === undefined) return null;
	return rows.every((row) => row.relations[field]?.length === 1 && row.relations[field]?.[0]?.id === first)
		? first
		: null;
}

/** Whether publishing does something for at least one of these rows: a draft, or a published entry with changes not yet published. */
export const canPublish = (rows: readonly ListEntriesItem[]): boolean =>
	rows.some((row) => row.status === "draft" || (row.status === "published" && row.hasUnpublishedChanges));

/** What the archive button does for these rows: it takes the archive off when every row is archived. */
export const archiveAction = (rows: readonly ListEntriesItem[]): "archive" | "unarchive" =>
	rows.length > 0 && rows.every((row) => row.status === "archived") ? "unarchive" : "archive";
