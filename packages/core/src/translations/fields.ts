import { sameJson } from "../json";
import { localeModeOf, type Schema } from "../schema/define";

type Fields = { title: string; values: Record<string, unknown> };

/** A mark on a translation's field (doc 04): the source's value moved on from the one the translation saw. Like a block's, it is counted, never stored. */
export type FieldMark = { field: string; before: unknown; after: unknown };

/** A field's value in an entry, `null` when nothing is written. The title is a column of its own. */
export function fieldValue(fields: Fields, field: string): unknown {
	const value = field === "title" ? fields.title : fields.values[field];
	const nothing = value === undefined || value === "" || (Array.isArray(value) && value.length === 0);
	return nothing ? null : value;
}

/**
 * The fields a translation holds a value of its own in, so that the source moving on is news to it (T111): per language, or following the source with a value written here. A
 * field the same in every language has none. The address has one, but it is the translation's own: a source's new address makes nothing in the translation wrong. An item's
 * languages are written together in one panel, which has no marks: none are kept for it (T119).
 */
export function trackedFields(schema: Schema, collection: string): string[] {
	const definition = schema.collections[collection];
	if (definition?.kind !== "document") return [];
	return Object.entries(definition.fields)
		.filter(([name, definition]) => definition.kind !== "slug" && localeModeOf(name, definition) !== "same")
		.map(([name]) => name);
}

/**
 * What a translation has seen of its source after a save. A field that becomes its own has seen the source as it follows it now, and keeps that until the change is confirmed,
 * whatever is written in it since (as a block's `seen`). An empty field has seen nothing: there is nothing in it for the source to leave behind.
 */
export function seenAfter(
	tracked: readonly string[],
	seen: Record<string, unknown>,
	working: Fields,
	followed: Fields | null,
): Record<string, unknown> {
	return Object.fromEntries(
		tracked.flatMap((field) => {
			if (fieldValue(working, field) === null) return [];
			if (field in seen) return [[field, seen[field]]];
			return followed ? [[field, fieldValue(followed, field)]] : [];
		}),
	);
}

/** A translation's field marks against what the site shows of its source (`null`: the source is not on the site, so nothing is marked). */
export function fieldMarksOf(seen: Record<string, unknown>, source: Fields | null): FieldMark[] {
	if (!source) return [];
	return Object.entries(seen).flatMap(([field, before]) => {
		const after = fieldValue(source, field);
		return sameJson(before, after) ? [] : [{ field, before, after }];
	});
}
