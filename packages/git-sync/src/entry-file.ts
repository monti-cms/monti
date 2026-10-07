import { isDeepStrictEqual } from "node:util";
import { type Cms, type Entry, exportBodyText } from "@monti-cms/core/plugin/server";
import { composeFile, parseFile } from "./front-matter";
import { blobSha } from "./github/blob-sha";
import { RESERVED_FRONT_MATTER_KEYS, type ResolvedTarget } from "./options";
import type { PathPattern } from "./path-pattern";

/**
 * The file of a published entry, and the entry a file says.
 *
 * File format (one file per published entry and language): YAML front matter, then the body written by the target's format.
 *
 * - The collection's own fields (title, summary, tags, ...) are top-level front matter keys, as stored. A relation field holds the **ids** of the entries it points
 *   to (a list of ids for a many-relation): an id never goes stale when the target is renamed, and it round-trips exactly. The `per-language names` of a
 *   record collection are the nested `translations` mapping.
 * - `slug`, `date` (published) and `lastmod` (modified) are the keys a static site generator reads. `date` and `lastmod` are written for the site and ignored on import.
 * - `monti` names the entry: its `id`, `collection`, `locale`, and for a translation `translationOf` (the id of the source). It pairs a file with its entry when the
 *   file is moved or renamed.
 */

/** The file of a published entry. */
export interface ExportedEntry {
	/** Repo-relative path. */
	readonly path: string;
	readonly text: string;
	/** The git blob sha of `text`. */
	readonly blobSha: string;
	readonly slug: string;
	/** Content hash of the published entry the text was written from. */
	readonly contentHash: string;
}

/** Whether an entry has a published version with an address (the only kind that has a file). */
export const isSyncable = (
	entry: Entry | null,
	target: ResolvedTarget,
): entry is Entry & { published: NonNullable<Entry["published"]>; publishedSlug: string } =>
	entry !== null &&
	entry.status === "published" &&
	entry.published !== undefined &&
	typeof entry.publishedSlug === "string" &&
	entry.publishedSlug !== "" &&
	target.collections.includes(entry.collection);

const iso = (value: unknown): string | undefined => {
	if (value === undefined || value === null) return undefined;
	const date = value instanceof Date ? value : new Date(value as string);
	return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
};

/** The front matter of an entry. Fields come in the order the collection declares them. */
export function frontMatterOf(
	cms: Cms,
	entry: Entry & { published: NonNullable<Entry["published"]>; publishedSlug: string },
): Record<string, unknown> {
	const metadata = entry.published.metadata as Record<string, unknown>;
	const declared = cms.site.isCollection(entry.collection)
		? cms.site.storedFields(entry.collection).map((stored) => stored.name)
		: [];
	const data: Record<string, unknown> = {};
	for (const key of declared) if (metadata[key] !== undefined) data[key] = metadata[key];
	for (const key of Object.keys(metadata).sort()) if (data[key] === undefined) data[key] = metadata[key];
	data.slug = entry.publishedSlug;
	const date = iso(entry.publishedAt);
	if (date) data.date = date;
	const lastmod = iso(entry.published.updatedAt);
	if (lastmod) data.lastmod = lastmod;
	data.monti = {
		id: entry.id,
		collection: entry.collection,
		locale: entry.locale,
		...(entry.translationGroupId !== entry.id ? { translationOf: entry.translationGroupId } : {}),
	};
	return data;
}

/** Writes the file of a published entry through the target's format (`purpose: "sync"`, front matter included). */
export async function exportEntry(
	cms: Cms,
	target: ResolvedTarget,
	pattern: PathPattern,
	entry: Entry & { published: NonNullable<Entry["published"]>; publishedSlug: string },
): Promise<ExportedEntry> {
	const { text: body } = await exportBodyText(cms, {
		format: target.format,
		doc: entry.published.doc,
		locale: entry.locale,
		scope: "published",
	});
	const text = composeFile(frontMatterOf(cms, entry), body);
	return {
		path: pattern.render({
			collection: entry.collection,
			slug: entry.publishedSlug,
			locale: entry.locale,
			id: entry.id,
		}),
		text,
		blobSha: blobSha(text),
		slug: entry.publishedSlug,
		contentHash: entry.published.contentHash,
	};
}

/** What a file says about its entry. */
export interface ParsedEntryFile {
	/** The collection fields (the front matter without the keys git-sync writes itself). */
	readonly metadata: Record<string, unknown>;
	readonly slug?: string;
	readonly id?: string;
	readonly collection?: string;
	readonly locale?: string;
	readonly translationOf?: string;
	readonly body: string;
}

export type ParseEntryFileResult =
	| { readonly ok: true; readonly file: ParsedEntryFile }
	| { readonly ok: false; readonly message: string };

const stringOf = (value: unknown): string | undefined =>
	typeof value === "string" && value !== "" ? value : undefined;

/** Reads the text of a file into the entry it says. */
export function parseEntryFile(text: string): ParseEntryFileResult {
	const parsed = parseFile(text);
	if (!parsed.ok)
		return { ok: false, message: parsed.line ? `${parsed.message} (line ${parsed.line})` : parsed.message };
	const { data } = parsed;
	const monti = data.monti;
	if (monti !== undefined && (typeof monti !== "object" || monti === null || Array.isArray(monti))) {
		return { ok: false, message: "front matter key `monti` must be a mapping (id, collection, locale)" };
	}
	if (data.slug !== undefined && typeof data.slug !== "string") {
		return { ok: false, message: "front matter key `slug` must be text" };
	}
	const identity = (monti ?? {}) as Record<string, unknown>;
	const metadata = { ...data };
	for (const key of RESERVED_FRONT_MATTER_KEYS) delete metadata[key];
	return {
		ok: true,
		file: {
			metadata,
			slug: stringOf(data.slug),
			id: stringOf(identity.id),
			collection: stringOf(identity.collection),
			locale: stringOf(identity.locale),
			translationOf: stringOf(identity.translationOf),
			body: parsed.body,
		},
	};
}

/** Whether two file texts say the same entry: the same fields, slug and body (the dates, which are only for the site, are not compared). */
export function sameContent(left: string, right: string): boolean {
	if (left === right) return true;
	const a = parseEntryFile(left);
	const b = parseEntryFile(right);
	if (!a.ok || !b.ok) return false;
	return (
		isDeepStrictEqual(a.file.metadata, b.file.metadata) &&
		a.file.slug === b.file.slug &&
		a.file.body.trim() === b.file.body.trim()
	);
}
