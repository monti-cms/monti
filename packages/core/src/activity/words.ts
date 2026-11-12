import type { LoggedRecord, Message } from "../operation";

/** The records of a kind among the ones a write touched, in the order of `ids` when given. */
export function recordsOf(records: LoggedRecord[], kind: string, ids?: readonly string[]): LoggedRecord[] {
	const found = records.filter((record) => record.kind === kind);
	return ids ? ids.flatMap((id) => found.find((record) => record.id === id) ?? []) : found;
}

/** What one record is called in the log; an empty title stays empty, and the screen writes "Untitled" in its language. */
export const titleOf = (records: LoggedRecord[], kind: string, id: string): string =>
	records.find((record) => record.kind === kind && record.id === id)?.title ?? "";

/**
 * One thing by its title, several by their count: `<key>.one` with `{title}`, `<key>.many` with `{count}`. The log's first line reads "“First
 * post” published" for one and "3 entries published" for several.
 */
export function oneOrMany(key: string, records: LoggedRecord[], values: Record<string, string | number> = {}): Message {
	const [only] = records;
	return records.length === 1 && only
		? { key: `${key}.one`, values: { title: only.title ?? "", ...values } }
		: { key: `${key}.many`, values: { count: records.length, ...values } };
}

/**
 * Where entries are, for the log's second line: one entry's collection and address (`post/first-post`), its collection alone before it has an
 * address, and for several entries the collection they share.
 */
export function entryPlace(records: LoggedRecord[]): Message | null {
	const [first] = records;
	if (!first?.collection) return null;
	if (records.length === 1 && first.slug)
		return { key: "activity.where.address", values: { collection: first.collection, slug: first.slug } };
	return records.every((record) => record.collection === first.collection)
		? { key: "activity.where.collection", values: { collection: first.collection } }
		: null;
}

/** The log's group for a folder's write: a folder of entries is filed with saves, a folder of files with media. */
export const folderLog = (_input: unknown, records: LoggedRecord[]) =>
	records.some((record) => record.kind === "folder" && record.collection !== undefined) ? "save" : "media";

/** Where a folder's write happened: its collection, or the media library. */
export function folderPlace(records: LoggedRecord[]): Message {
	const collection = records.find((record) => record.kind === "folder")?.collection;
	return collection === undefined
		? { key: "activity.where.media" }
		: { key: "activity.where.collection", values: { collection } };
}
