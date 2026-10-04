/**
 * Public site reading (`@monti-cms/core/read`). Server components, routes, sitemap and RSS read the published content. No write features.
 * Do not import from browser code.
 *
 * - One entry (`getEntry`): returns the URL to redirect to for an old URL, and can fall back to the source text if this locale has no translation.
 * - List (`listEntries`): relation filters, sorting and pagination are done in the DB.
 * - Translations (`getTranslations`): the published locales of the same entry and their URLs (hreflang).
 * - Preview (`getPreview`): admins only, the latest draft.
 * - Relations are resolved to the target's published version, with title and URL attached (this locale, else the source text).
 */
import { authGateway } from "../adapters/auth";
import type { EntryMetadata, PublishedEntryRecord } from "../adapters/postgres/content-store";
import type { PublishedSort } from "../adapters/postgres/store/public-read";
import type { ResolvedConfig } from "../config/resolved";
import { getCmsContentStore } from "../container";
import { type Collection, isCollection, isItemCollection } from "../core/collections";
import { contentPath } from "../core/links";
import { DEFAULT_LOCALE, isLocale, localizePath } from "../core/locales";
import type { MetadataOf } from "../schema/collection";
import {
	mergeTranslationMetadata,
	RECORD_TRANSLATIONS_KEY,
	recordLocalizedFields,
	storedFields,
} from "../schema/derive";

/** Collection metadata type extracted from the site config. */
export type MetadataFor<C extends Collection> = C extends keyof ResolvedConfig["collections"]
	? MetadataOf<ResolvedConfig["collections"][C]>
	: EntryMetadata;

/** A published item a relation field points to. */
export interface ReadRelation {
	readonly id: string;
	readonly collection: string;
	readonly locale: string;
	readonly slug: string;
	/** Name in this locale (the item collection's per-locale name -> default name). */
	readonly title: string | null;
	/** Public URL (if the collection has `path`, including the locale prefix). */
	readonly path: string | null;
}

export interface ReadEntry<C extends Collection = Collection> {
	readonly id: string;
	readonly collection: C;
	/** Locale of the body shown. If it fell back to the source text, the source locale. */
	readonly locale: string;
	readonly translationGroupId: string;
	readonly slug: string;
	/** Public URL (if the collection has `path`, including the locale prefix). */
	readonly path: string | null;
	readonly title: string | null;
	readonly metadata: MetadataFor<C>;
	/** Relation field name -> published targets (in declared/picked order). Unpublished targets are omitted. */
	readonly relations: Readonly<Record<string, readonly ReadRelation[]>>;
	/** Publish date (of the source text). */
	readonly publishedAt: Date | null;
	/** Modified date of this locale's body. */
	readonly updatedAt: Date;
	/** Body MDX. In lists it is filled only when `body: true`. */
	readonly mdx: string;
	/** The source text is shown because there is no translation for the requested locale. */
	readonly fallback: boolean;
}

export type ReadEntryResult<C extends Collection = Collection> =
	| { readonly status: "found"; readonly entry: ReadEntry<C> }
	/** Arrived through an old URL. Permanently redirect (308) to `path` (or `slug` if absent). */
	| { readonly status: "redirect"; readonly slug: string; readonly path: string | null; readonly entry: ReadEntry<C> }
	| { readonly status: "not_found" };

const relationFieldsOf = (collection: Collection) =>
	storedFields(collection).filter((stored) => stored.field.kind === "relation");

const idsOf = (value: unknown): string[] =>
	typeof value === "string" ? [value] : Array.isArray(value) ? value.filter((id) => typeof id === "string") : [];

const titleOf = (record: PublishedEntryRecord, locale: string): string | null => {
	const metadata = record.metadata as Record<string, unknown>;
	if (isCollection(record.collection) && recordLocalizedFields(record.collection).includes("title")) {
		const translations = metadata[RECORD_TRANSLATIONS_KEY] as Record<string, Record<string, unknown>> | undefined;
		const localized = translations?.[locale]?.title;
		if (typeof localized === "string" && localized.trim()) return localized;
	}
	return typeof metadata.title === "string" ? metadata.title : null;
};

const pathOf = (collection: string, slug: string, locale: string): string | null => {
	const path = contentPath(collection, slug);
	return path ? localizePath(locale, path) : null;
};

/** Gathers the published versions of relation targets (in one query) and picks this locale -> source text. */
async function resolveRelations(
	records: readonly PublishedEntryRecord[],
	locale: string,
): Promise<Map<string, Record<string, ReadRelation[]>>> {
	const wanted = new Set<string>();
	for (const record of records) {
		if (!isCollection(record.collection)) continue;
		for (const { name } of relationFieldsOf(record.collection)) {
			for (const id of idsOf((record.metadata as Record<string, unknown>)[name])) wanted.add(id);
		}
	}
	const targets = await getCmsContentStore().listPublishedByGroups({ translationGroupIds: [...wanted] });
	const byGroup = new Map<string, PublishedEntryRecord[]>();
	for (const target of targets)
		byGroup.set(target.translationGroupId, [...(byGroup.get(target.translationGroupId) ?? []), target]);
	const pick = (groupId: string): ReadRelation | null => {
		const members = byGroup.get(groupId);
		if (!members) return null;
		const chosen =
			members.find((member) => member.locale === locale) ??
			members.find((member) => member.id === member.translationGroupId) ??
			members[0];
		if (!chosen) return null;
		return {
			id: chosen.translationGroupId,
			collection: chosen.collection,
			locale: chosen.locale,
			slug: chosen.slug,
			title: titleOf(chosen, locale),
			path: pathOf(chosen.collection, chosen.slug, chosen.locale),
		};
	};
	const result = new Map<string, Record<string, ReadRelation[]>>();
	for (const record of records) {
		const relations: Record<string, ReadRelation[]> = {};
		if (isCollection(record.collection)) {
			for (const { name } of relationFieldsOf(record.collection)) {
				relations[name] = idsOf((record.metadata as Record<string, unknown>)[name])
					.map(pick)
					.filter((relation): relation is ReadRelation => relation !== null);
			}
		}
		result.set(record.id, relations);
	}
	return result;
}

async function toReadEntries<C extends Collection>(
	records: readonly PublishedEntryRecord[],
	locale: string,
	fallback = false,
): Promise<ReadEntry<C>[]> {
	const relations = await resolveRelations(records, locale);
	return records.map((record) => ({
		id: record.id,
		collection: record.collection as C,
		locale: record.locale,
		translationGroupId: record.translationGroupId,
		slug: record.slug,
		path: pathOf(record.collection, record.slug, record.locale),
		title: titleOf(record, locale),
		metadata: record.metadata as MetadataFor<C>,
		relations: relations.get(record.id) ?? {},
		publishedAt: record.publishedAt,
		updatedAt: record.updatedAt,
		mdx: record.mdx,
		fallback,
	}));
}

const assertCollection = (collection: string): Collection => {
	if (!isCollection(collection)) throw new Error(`cms/read: unknown collection "${collection}"`);
	return collection;
};

/** An item collection has only the default locale (the name is picked from the per-locale values). */
const storageLocale = (collection: Collection, locale: string | undefined) =>
	isItemCollection(collection) ? DEFAULT_LOCALE : locale && isLocale(locale) ? locale : DEFAULT_LOCALE;

/**
 * One entry. The URL (`slug`) is that locale's URL. For an old URL it returns `redirect`.
 * With `fallback: true`, if this locale has no translation, it returns the source text (default locale) at the same URL with `fallback: true`.
 */
export async function getEntry<C extends Collection>(params: {
	readonly collection: C;
	readonly slug: string;
	readonly locale?: string;
	readonly fallback?: boolean;
}): Promise<ReadEntryResult<C>> {
	const collection = assertCollection(params.collection);
	const locale = storageLocale(collection, params.locale);
	const slug = params.slug.normalize("NFC").trim();
	if (!slug) return { status: "not_found" };
	const store = getCmsContentStore();
	let lookup = await store.getPublishedEntryBySlug({ collection, slug, locale, includeBody: true });
	let fellBack = false;
	if (lookup.status === "not_found" && params.fallback && locale !== DEFAULT_LOCALE) {
		lookup = await store.getPublishedEntryBySlug({ collection, slug, locale: DEFAULT_LOCALE, includeBody: true });
		fellBack = lookup.status !== "not_found";
	}
	if (lookup.status === "not_found") return { status: "not_found" };
	const [entry] = await toReadEntries<C>([lookup.entry], params.locale ?? locale, fellBack);
	if (!entry) return { status: "not_found" };
	if (lookup.status === "alias") return { status: "redirect", slug: entry.slug, path: entry.path, entry };
	return { status: "found", entry };
}

/** One page of a list. Relation filters (`where`), sorting and pagination are done in the DB. The body is read only when `body: true`. */
export async function listEntries<C extends Collection>(params: {
	readonly collection: C;
	readonly locale?: string;
	/** Relation field name -> item IDs (OR if several). Different fields are ANDed. */
	readonly where?: Readonly<Record<string, string | readonly string[]>>;
	readonly sort?: PublishedSort;
	readonly order?: "asc" | "desc";
	readonly page?: number;
	readonly pageSize?: number;
	readonly body?: boolean;
}): Promise<{ items: ReadEntry<C>[]; total: number; page: number; pageSize: number }> {
	const collection = assertCollection(params.collection);
	const locale = storageLocale(collection, params.locale);
	const result = await getCmsContentStore().listPublishedPage({
		collection,
		locale,
		where: params.where,
		sort: params.sort,
		// For item collections, title sorting uses the displayed name (the translated name in this locale).
		titleLocale: params.locale ?? locale,
		order: params.order,
		page: params.page,
		pageSize: params.pageSize,
		includeBody: params.body === true,
	});
	return { ...result, items: await toReadEntries<C>(result.items, params.locale ?? locale) };
}

/** The published locales of the same entry (source first) and their URLs. Used for hreflang and the locale switcher. */
export async function getTranslations(params: {
	readonly translationGroupId: string;
}): Promise<{ locale: string; slug: string; path: string | null }[]> {
	const members = await getCmsContentStore().listPublishedTranslations(params);
	return members.map((member) => ({
		locale: member.locale,
		slug: member.slug,
		path: pathOf(member.collection, member.slug, member.locale),
	}));
}

/**
 * Preview (admins only). Returns the latest draft in the same shape as the published version. A translation is merged with the common values of the source draft.
 * `null` if not logged in or not an admin. Only published relation targets are resolved.
 */
export async function getPreview<C extends Collection>(params: {
	readonly collection: C;
	readonly slug: string;
	readonly locale?: string;
}): Promise<ReadEntry<C> | null> {
	try {
		await authGateway.verifyAdmin();
	} catch {
		return null;
	}
	const collection = assertCollection(params.collection);
	const locale = storageLocale(collection, params.locale);
	const store = getCmsContentStore();
	const draft = await store.getWorkingEntryBySlug({ collection, slug: params.slug, locale });
	if (!draft || draft.status === "trashed") return null;
	let metadata = draft.working.metadata;
	if (draft.translationGroupId !== draft.id) {
		const source = await store.getEntry(draft.translationGroupId).catch(() => null);
		if (source) metadata = mergeTranslationMetadata(collection, source.working.metadata, metadata) as EntryMetadata;
	}
	const record: PublishedEntryRecord = {
		id: draft.id,
		collection,
		locale: draft.locale,
		translationGroupId: draft.translationGroupId,
		slug: draft.workingSlug ?? params.slug,
		metadata,
		mdx: draft.working.mdx,
		publishedAt: draft.publishedAt ?? null,
		updatedAt: draft.updatedAt,
	};
	const [entry] = await toReadEntries<C>([record], locale);
	return entry ?? null;
}

export type { PublishedSort } from "../adapters/postgres/store/public-read";
