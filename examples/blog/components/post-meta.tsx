import type { ReadEntry } from "@monti-cms/core/read";

/** The text of a metadata field, or `undefined` when the field is not set or not text. */
export function metadataText(entry: ReadEntry, field: string): string | undefined {
	const value = (entry.metadata as Record<string, unknown>)[field];
	return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

/** The titles of the targets of a relation field. */
const relationTitles = (entry: ReadEntry, field: string): string[] =>
	(entry.relations[field] ?? []).flatMap((target) => (target.title ? [target.title] : []));

const dateOf = (date: Date) => date.toISOString().slice(0, 10);

/** The byline: the publish date, the category and the tags (the relation fields `categoryId` and `tagIds` of the schema), in a muted line. */
export function PostMeta({ entry }: { entry: ReadEntry }) {
	const parts = [
		...relationTitles(entry, "categoryId"),
		...relationTitles(entry, "tagIds").map((topic) => `#${topic}`),
	];
	return (
		<p className="text-neutral-600 text-sm dark:text-neutral-400">
			{entry.publishedAt ? <time dateTime={dateOf(entry.publishedAt)}>{dateOf(entry.publishedAt)}</time> : null}
			{entry.publishedAt && parts.length > 0 ? " · " : null}
			{parts.join(" · ")}
		</p>
	);
}
