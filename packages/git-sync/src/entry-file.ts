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
 * - The collection's own fields (title, summary, tags, ...) are top-level front matter keys, as stored. A relation field is written as the **slug** of the entry it
 *   points to (a list of slugs for a many-relation), which is what a site's templates use. The exact ids are under `monti.refs` (`{ tagIds: [uuid, ...] }`), so the
 *   file imports back to the same entry even if the target was renamed since. The per-language names of a record collection are the nested `translations` mapping.
 * - `slug`, `date` (published) and `lastmod` (modified) are the keys a static site generator reads. `date` and `lastmod` are written for the site and ignored on import.
 * - `monti` names the entry: its `id`, `collection`, `locale`, and for a translation `translationOf` (the id of the source), and the relation `refs`. It pairs a file
 *   with its entry when the file is moved or renamed.
 * - On import a relation takes its ids from `monti.refs` when they still match the slugs written in the field (nobody edited the slugs); otherwise the slugs are
 *   looked up, which is what a file written by hand has. A slug no entry has is an import error.
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

/** The relation fields of a collection: name, the collection they point to, and whether they hold a list. */
export function relationFieldsOf(cms: Cms, collection: string): { name: string; to: string; many: boolean }[] {
	if (!cms.site.isCollection(collection)) return [];
	return cms.site
		.storedFields(collection)
		.flatMap(({ name, field }) =>
			field.kind === "relation" ? [{ name, to: field.to, many: field.many === true }] : [],
		);
}

const idsOf = (value: unknown): string[] =>
	typeof value === "string"
		? [value]
		: Array.isArray(value)
			? value.filter((item): item is string => typeof item === "string")
			: [];

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * The slug a relation target is written as for a reader in `locale`: its published slug in that language, else the source's, else any. `undefined` when the target is
 * not published (the id stands in for it).
 */
async function slugsOfTargets(cms: Cms, ids: readonly string[], locale: string): Promise<Map<string, string>> {
	const found = new Map<string, string>();
	if (ids.length === 0) return found;
	const records = await cms.store().listPublishedByGroups({ translationGroupIds: [...new Set(ids)] });
	for (const id of new Set(ids)) {
		const members = records.filter((record) => record.translationGroupId === id);
		const chosen =
			members.find((record) => record.locale === locale) ?? members.find((record) => record.id === id) ?? members[0];
		if (chosen) found.set(id, chosen.slug);
	}
	return found;
}

/** The front matter of an entry. Fields come in the order the collection declares them; relations are slugs with the exact ids under `monti.refs`. */
export async function frontMatterOf(
	cms: Cms,
	entry: Entry & { published: NonNullable<Entry["published"]>; publishedSlug: string },
): Promise<Record<string, unknown>> {
	const metadata = entry.published.metadata as Record<string, unknown>;
	const declared = cms.site.isCollection(entry.collection)
		? cms.site.storedFields(entry.collection).map((stored) => stored.name)
		: [];
	const data: Record<string, unknown> = {};
	for (const key of declared) if (metadata[key] !== undefined) data[key] = metadata[key];
	for (const key of Object.keys(metadata).sort()) if (data[key] === undefined) data[key] = metadata[key];
	const refs: Record<string, string | string[]> = {};
	const relations = relationFieldsOf(cms, entry.collection);
	const slugs = await slugsOfTargets(
		cms,
		relations.flatMap(({ name }) => idsOf(metadata[name])),
		entry.locale,
	);
	for (const { name, many } of relations) {
		const ids = idsOf(metadata[name]);
		if (ids.length === 0) continue;
		refs[name] = many ? ids : (ids[0] as string);
		// An unpublished target has no address: its id stands in for the slug.
		const written = ids.map((id) => slugs.get(id) ?? id);
		data[name] = many ? written : written[0];
	}
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
		...(Object.keys(refs).length > 0 ? { refs } : {}),
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
	const text = composeFile(await frontMatterOf(cms, entry), body);
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
	/** `monti.refs`: the exact ids of relation fields, by field name. */
	readonly refs: Readonly<Record<string, readonly string[]>>;
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
	const refs: Record<string, string[]> = {};
	if (identity.refs !== undefined) {
		if (typeof identity.refs !== "object" || identity.refs === null || Array.isArray(identity.refs)) {
			return {
				ok: false,
				message: "front matter key `monti.refs` must be a mapping of field name to id (or list of ids)",
			};
		}
		for (const [name, value] of Object.entries(identity.refs)) {
			const ids = idsOf(value);
			if (ids.length !== (Array.isArray(value) ? value.length : 1)) {
				return { ok: false, message: `front matter key \`monti.refs.${name}\` must hold ids (text)` };
			}
			refs[name] = ids;
		}
	}
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
			refs,
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

/** What the relation fields of a file point to could not be found. Carries one message per field. */
export class RelationImportError extends Error {
	constructor(readonly problems: readonly string[]) {
		super(problems.join("; "));
		this.name = "RelationImportError";
	}
}

/**
 * The metadata of a file with its relation fields turned into ids. A field takes the ids of `monti.refs` when each of them still has the slug the field says (or is
 * itself what the field says: an unpublished target is written as its id); otherwise every value is looked up as a slug of the field's target collection
 * (published first, then drafts, in the file's language and then the default one). A slug no entry has is an error that names the field and the slug.
 */
export async function resolveRelations(
	cms: Cms,
	file: ParsedEntryFile,
	where: { readonly collection: string; readonly locale: string },
): Promise<Record<string, unknown>> {
	const metadata = { ...file.metadata };
	const problems: string[] = [];
	for (const { name, to, many } of relationFieldsOf(cms, where.collection)) {
		if (metadata[name] === undefined) continue;
		const written = idsOf(metadata[name]);
		if (written.length !== (Array.isArray(metadata[name]) ? (metadata[name] as unknown[]).length : 1)) {
			problems.push(`field ${name}: values must be slugs (text)`);
			continue;
		}
		const refs = file.refs[name];
		if (refs && refs.length === written.length) {
			const slugs = await slugsOfTargets(cms, refs, where.locale);
			if (refs.every((id, index) => (slugs.get(id) ?? id) === written[index])) {
				metadata[name] = many ? [...refs] : (refs[0] as string);
				continue;
			}
		}
		const ids: string[] = [];
		for (const value of written) {
			if (UUID.test(value)) {
				ids.push(value);
				continue;
			}
			const id = await entryIdBySlug(cms, to, value, where.locale);
			if (id) ids.push(id);
			else problems.push(`field ${name}: no ${to} has the slug "${value}"`);
		}
		metadata[name] = many ? ids : (ids[0] as string);
	}
	if (problems.length > 0) throw new RelationImportError(problems);
	return metadata;
}

/** The id (translation group id) of the entry of a collection that has this slug. */
async function entryIdBySlug(cms: Cms, collection: string, slug: string, locale: string): Promise<string | undefined> {
	const store = cms.store();
	for (const language of new Set([locale, cms.site.DEFAULT_LOCALE])) {
		const published = await store.getPublishedEntryBySlug({ collection, slug, locale: language, includeBody: false });
		// A former slug (`alias`) still names the entry: a file written before the target was renamed keeps working.
		if (published.status !== "not_found") return published.entry.translationGroupId;
	}
	for (const language of new Set([locale, cms.site.DEFAULT_LOCALE])) {
		const draft = await store.getWorkingEntryBySlug({ collection, slug, locale: language });
		if (draft) return draft.translationGroupId;
	}
	return undefined;
}
