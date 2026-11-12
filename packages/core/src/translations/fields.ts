import { isEmptyValue, sameJson } from "../json";
import { localeModeOf, type Schema, storedFields } from "../schema/define";

type Fields = { title: string; values: Record<string, unknown> };

/** A mark on a translation's field (doc 04): the source's value moved on from the one the translation saw. Like a block's, it is counted, never stored. */
export type FieldMark = { field: string; before: unknown; after: unknown };

/** A field's value in an entry, `null` when nothing is written. The title is a column of its own. */
export function writtenValue(fields: Fields, field: string): unknown {
	const value = field === "title" ? fields.title : fields.values[field];
	return isEmptyValue(value) ? null : value;
}

/**
 * The fields a translation holds a value of its own in, so that the source moving on is news to it (T111): per language, or following the source with a value written here. A
 * field the same in every language has none. The address has one, but it is the translation's own: a source's new address makes nothing in the translation wrong. An item is
 * kept in its own screen, not the entry editor, and whoever renames it sees its languages side by side in one panel; a relation picks entries and holds no words to translate,
 * and merges and bulk edits rewrite it too: none are kept for either (T119, 2026-11-10, owner).
 */
export function trackedFields(schema: Schema, collection: string): string[] {
	const definition = schema.collections[collection];
	if (definition?.kind !== "document") return [];
	return Object.entries(storedFields(definition))
		.filter(
			([name, field]) => field.kind !== "slug" && field.kind !== "relation" && localeModeOf(name, field) !== "same",
		)
		.map(([name]) => name);
}

/**
 * What a translation has seen of its source after a save. A field that becomes its own has seen the source as it follows it now. One whose value this save changes from `before`
 * is written against the source as it is now too, so its mark goes (2026-11-10, owner); one left as it was keeps what it saw until someone says to leave it (as a block's
 * `seen`). An empty field has seen nothing: there is nothing in it for the source to leave behind.
 */
export function seenAfter(
	tracked: readonly string[],
	seen: Record<string, unknown>,
	working: Fields,
	followed: Fields | null,
	before?: Fields,
): Record<string, unknown> {
	return Object.fromEntries(
		tracked.flatMap((field) => {
			if (writtenValue(working, field) === null) return [];
			const changed = before !== undefined && !sameJson(writtenValue(before, field), writtenValue(working, field));
			if (field in seen && !(changed && followed)) return [[field, seen[field]]];
			return followed ? [[field, writtenValue(followed, field)]] : [];
		}),
	);
}

/** A translation's field marks against what the site shows of its source (`null`: the source is not on the site, so nothing is marked). */
export function fieldMarksOf(seen: Record<string, unknown>, source: Fields | null): FieldMark[] {
	if (!source) return [];
	return Object.entries(seen).flatMap(([field, before]) => {
		const after = writtenValue(source, field);
		return sameJson(before, after) ? [] : [{ field, before, after }];
	});
}
