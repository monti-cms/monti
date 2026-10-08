import type { ReadEntry } from "@monti-cms/core/read";
import { blogTheme } from "./theme.config";

/** The text of a metadata field, or `undefined` when the field is not set or not text. */
export function metadataText(entry: ReadEntry, field: string | undefined): string | undefined {
	const value = field ? (entry.metadata as Record<string, unknown>)[field] : undefined;
	return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

/** The titles of the targets of a relation field. */
export const relationTitles = (entry: ReadEntry, field: string | undefined): string[] =>
	(field ? (entry.relations[field] ?? []) : []).flatMap((target) => (target.title ? [target.title] : []));

const dateOf = (date: Date) => date.toISOString().slice(0, 10);

/** The byline: the publish date, the category, the author and the topics, in a muted line. */
export function PostMeta({ entry }: { entry: ReadEntry }) {
	const categories = relationTitles(entry, blogTheme.categoryField);
	const author = relationTitles(entry, blogTheme.authorField)[0];
	const topics = relationTitles(entry, blogTheme.topicsField);
	const parts = [...categories, ...(author ? [author] : []), ...topics.map((topic) => `#${topic}`)];
	return (
		<p className="text-neutral-600 text-sm dark:text-neutral-400">
			{entry.publishedAt ? <time dateTime={dateOf(entry.publishedAt)}>{dateOf(entry.publishedAt)}</time> : null}
			{entry.publishedAt && parts.length > 0 ? " · " : null}
			{parts.join(" · ")}
		</p>
	);
}
