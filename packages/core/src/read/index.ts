/**
 * Public site reading (`cms.read`, built by `createRead`). Server components, routes, sitemap and RSS read the published content. No write features.
 * Do not import from browser code.
 *
 * - One entry (`getEntry`): returns the URL to redirect to for an old URL, and can fall back to the source text if this locale has no translation.
 * - List (`listEntries`): relation filters, sorting and pagination are done in the DB.
 * - Translations (`getTranslations`): the published locales of the same entry and their URLs (hreflang).
 * - Preview (`getPreview`): admins only, the latest draft.
 * - Relations are resolved to the target's published version, with title and URL attached (this locale, else the source text).
 */
import type { AuthContext } from "../adapters/auth/auth-gateway";
import type { MediaStore } from "../adapters/r2/types";
import type { ResolvedConfig } from "../config/resolved";
import { type Collection, isCollection, isItemCollection } from "../core/collections";
import { contentPath } from "../core/links";
import { DEFAULT_LOCALE, isLocale, localizePath } from "../core/locales";
import type { ContentStore, EntryMetadata, PublishedEntryRecord, PublishedSort } from "../core/store";
import { createPublicImageResolver, resolvePublicMediaUrl } from "../mdx/public-media";
import type { MetadataOf } from "../schema/collection";
import {
	mergeTranslationMetadata,
	RECORD_TRANSLATIONS_KEY,
	recordLocalizedFields,
	schemaMetadata,
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
	store: ContentStore,
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
	const targets = await store.listPublishedByGroups({ translationGroupIds: [...wanted] });
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
	store: ContentStore,
	records: readonly PublishedEntryRecord[],
	locale: string,
	fallback = false,
): Promise<ReadEntry<C>[]> {
	const relations = await resolveRelations(store, records, locale);
	return records.map((record) => ({
		id: record.id,
		collection: record.collection as C,
		locale: record.locale,
		translationGroupId: record.translationGroupId,
		slug: record.slug,
		path: pathOf(record.collection, record.slug, record.locale),
		title: titleOf(record, locale),
		// Values of fields the site has removed stay stored but are not public: the site code sees the shape its config types.
		metadata: (isCollection(record.collection)
			? schemaMetadata(record.collection, record.metadata)
			: record.metadata) as MetadataFor<C>,
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

/** What the read API needs from a CMS instance. */
export interface ReadDeps {
	readonly store: () => ContentStore;
	readonly mediaStore: () => MediaStore;
	/** Throws if the current request is not from an admin (the check `getPreview` uses). */
	readonly verifyAdmin: () => Promise<AuthContext>;
}

/**
 * The read API of one CMS instance (`cms.read`). Published content is read through the instance's store, so several instances in one process
 * read their own databases.
 */
export interface CmsRead {
	/**
	 * One entry. The URL (`slug`) is that locale's URL. For an old URL it returns `redirect`.
	 * With `fallback: true`, if this locale has no translation, it returns the source text (default locale) at the same URL with `fallback: true`.
	 */
	getEntry<C extends Collection>(params: {
		readonly collection: C;
		readonly slug: string;
		readonly locale?: string;
		readonly fallback?: boolean;
	}): Promise<ReadEntryResult<C>>;
	/** One page of a list. Relation filters (`where`), sorting and pagination are done in the DB. The body is read only when `body: true`. */
	listEntries<C extends Collection>(params: {
		readonly collection: C;
		readonly locale?: string;
		/** Relation field name -> item IDs (OR if several). Different fields are ANDed. */
		readonly where?: Readonly<Record<string, string | readonly string[]>>;
		readonly sort?: PublishedSort;
		readonly order?: "asc" | "desc";
		readonly page?: number;
		readonly pageSize?: number;
		readonly body?: boolean;
	}): Promise<{ items: ReadEntry<C>[]; total: number; page: number; pageSize: number }>;
	/** The published locales of the same entry (source first) and their URLs. Used for hreflang and the locale switcher. */
	getTranslations(params: {
		readonly translationGroupId: string;
	}): Promise<{ locale: string; slug: string; path: string | null }[]>;
	/**
	 * Preview (admins only). Returns the latest draft in the same shape as the published version. A translation is merged with the common values of the source draft.
	 * `null` if not logged in or not an admin. Only published relation targets are resolved.
	 */
	getPreview<C extends Collection>(params: {
		readonly collection: C;
		readonly slug: string;
		readonly locale?: string;
	}): Promise<ReadEntry<C> | null>;
	/** Resolver that turns the body's registered media (`Image`, `File`) into public URLs, for `renderMdx`'s `imageResolver`. */
	imageResolver(source: string): ReturnType<typeof createPublicImageResolver>;
	/** Public URL of one media item (shared image etc.). `null` if it is not ready or the deployment has no DB or storage. */
	mediaUrl(mediaId: string): ReturnType<typeof resolvePublicMediaUrl>;
}

export function createRead(deps: ReadDeps): CmsRead {
	return {
		async getEntry<C extends Collection>(params: {
			readonly collection: C;
			readonly slug: string;
			readonly locale?: string;
			readonly fallback?: boolean;
		}): Promise<ReadEntryResult<C>> {
			const collection = assertCollection(params.collection);
			const locale = storageLocale(collection, params.locale);
			const slug = params.slug.normalize("NFC").trim();
			if (!slug) return { status: "not_found" };
			const store = deps.store();
			let lookup = await store.getPublishedEntryBySlug({ collection, slug, locale, includeBody: true });
			let fellBack = false;
			if (lookup.status === "not_found" && params.fallback && locale !== DEFAULT_LOCALE) {
				lookup = await store.getPublishedEntryBySlug({ collection, slug, locale: DEFAULT_LOCALE, includeBody: true });
				fellBack = lookup.status !== "not_found";
			}
			if (lookup.status === "not_found") return { status: "not_found" };
			const [entry] = await toReadEntries<C>(store, [lookup.entry], params.locale ?? locale, fellBack);
			if (!entry) return { status: "not_found" };
			if (lookup.status === "alias") return { status: "redirect", slug: entry.slug, path: entry.path, entry };
			return { status: "found", entry };
		},

		async listEntries<C extends Collection>(params: {
			readonly collection: C;
			readonly locale?: string;
			readonly where?: Readonly<Record<string, string | readonly string[]>>;
			readonly sort?: PublishedSort;
			readonly order?: "asc" | "desc";
			readonly page?: number;
			readonly pageSize?: number;
			readonly body?: boolean;
		}): Promise<{ items: ReadEntry<C>[]; total: number; page: number; pageSize: number }> {
			const collection = assertCollection(params.collection);
			const locale = storageLocale(collection, params.locale);
			const store = deps.store();
			const result = await store.listPublishedPage({
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
			return { ...result, items: await toReadEntries<C>(store, result.items, params.locale ?? locale) };
		},

		async getTranslations(params) {
			const members = await deps.store().listPublishedTranslations(params);
			return members.map((member) => ({
				locale: member.locale,
				slug: member.slug,
				path: pathOf(member.collection, member.slug, member.locale),
			}));
		},

		async getPreview<C extends Collection>(params: {
			readonly collection: C;
			readonly slug: string;
			readonly locale?: string;
		}): Promise<ReadEntry<C> | null> {
			try {
				await deps.verifyAdmin();
			} catch {
				return null;
			}
			const collection = assertCollection(params.collection);
			const locale = storageLocale(collection, params.locale);
			const store = deps.store();
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
			const [entry] = await toReadEntries<C>(store, [record], locale);
			return entry ?? null;
		},

		imageResolver: (source) => createPublicImageResolver(deps, source),
		mediaUrl: (mediaId) => resolvePublicMediaUrl(deps, mediaId),
	};
}

export type { PublishedSort } from "../core/store";
