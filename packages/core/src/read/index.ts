/**
 * Public site reading (`cms.read`, built by `createRead`). Server components, routes, sitemap and RSS read the published content. No write features.
 * Do not import from browser code.
 *
 * - One entry (`getEntry`): returns the URL to redirect to for an old URL, and can fall back to the source text if this locale has no translation.
 * - List (`listEntries`): relation filters, sorting and pagination are done in the DB.
 * - Translations (`getTranslations`): the published locales of the same entry and their URLs (hreflang).
 * - Preview (`getPreview`): admins only, the latest draft.
 * - The body is the stored document (`doc`) and what it points to, resolved (`refs`: media URLs and the addresses of internal links). `<CmsContent entry={entry} />` renders both.
 *   With the `format` option the body is also written as text in that format (`body`), with internal links as the real path of the target.
 * - Relations are resolved to the target's published version, with title and URL attached (this locale, else the source text).
 */
import type { AuthContext } from "../adapters/auth/auth-gateway";
import type { MediaStore } from "../adapters/r2/types";
import type { ContentStore, EntryMetadata, PublishedEntryRecord, PublishedSort } from "../core/store";
import { type CollectionName, type MetadataFor, ServiceError } from "../core/types";
import { collectRefs, EMPTY_REFS, type ReadLink, type ReadRefs } from "../doc/document-refs";
import { type PublicMediaDeps, resolvePublicMedia, resolvePublicMediaUrl } from "../doc/public-media";
import type { StoredDocument } from "../doc/stored-document";
import { type ExportRefs, exportText } from "../format/convert";
import type { FormatRegistry } from "../format/registry";
import type { FormatLink, FormatMedia } from "../format/types";
import { RECORD_TRANSLATIONS_KEY } from "../schema/derive";
import type { AnyCmsConfig, Site } from "../site";

export type { CollectionName, MetadataFor } from "../core/types";

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

export interface ReadEntry<
	C extends string = string,
	// biome-ignore lint/suspicious/noExplicitAny: `ReadEntry` alone is an entry of any site config
	Config extends AnyCmsConfig = any,
> {
	readonly id: string;
	readonly collection: C;
	/** Locale of the body shown. If it fell back to the source text, the source locale. */
	readonly locale: string;
	readonly translationGroupId: string;
	readonly slug: string;
	/** Public URL (if the collection has `path`, including the locale prefix). */
	readonly path: string | null;
	readonly title: string | null;
	readonly metadata: MetadataFor<C, Config>;
	/** Relation field name -> published targets (in declared/picked order). Unpublished targets are omitted. */
	readonly relations: Readonly<Record<string, readonly ReadRelation[]>>;
	/** Publish date (of the source text). */
	readonly publishedAt: Date | null;
	/** Modified date of this locale's body. */
	readonly updatedAt: Date;
	/**
	 * The body as a stored document, the input of `<CmsContent entry={entry} />` and `renderDocument`. In lists it is filled only when `body: true`
	 * (otherwise `null`). `null` for a preview of a draft that does not parse (it has no document); the published version always has one.
	 */
	readonly doc: StoredDocument | null;
	/**
	 * What `doc` points to, resolved for rendering: the public URL, size and file info of each registered image and file. Only media that occurs
	 * in `doc` is listed. Empty when `doc` is `null`.
	 */
	readonly refs: ReadRefs;
	/**
	 * The body written as text, when the read asked for a `format`: the document through that format, with internal links as the real path of the target
	 * (an unpublished target is not a link) and registered images by their public URL, so the text works outside this CMS. Absent without `format`, and for
	 * a list without `body: true`.
	 */
	readonly body?: ReadBody;
	/** The source text is shown because there is no translation for the requested locale. */
	readonly fallback: boolean;
}

/** A body written as text in a format. */
export interface ReadBody {
	readonly format: string;
	readonly text: string;
}

export type ReadEntryResult<
	C extends string = string,
	// biome-ignore lint/suspicious/noExplicitAny: `ReadEntryResult` alone is a result of any site config
	Config extends AnyCmsConfig = any,
> =
	| { readonly status: "found"; readonly entry: ReadEntry<C, Config> }
	/** Arrived through an old URL. Permanently redirect (308) to `path` (or `slug` if absent). */
	| {
			readonly status: "redirect";
			readonly slug: string;
			readonly path: string | null;
			readonly entry: ReadEntry<C, Config>;
	  }
	| { readonly status: "not_found" };

const relationFieldsOf = (site: Site, collection: string) =>
	site.storedFields(collection).filter((stored) => stored.field.kind === "relation");

const idsOf = (value: unknown): string[] =>
	typeof value === "string" ? [value] : Array.isArray(value) ? value.filter((id) => typeof id === "string") : [];

const titleOf = (site: Site, record: PublishedEntryRecord, locale: string): string | null => {
	const metadata = record.metadata as Record<string, unknown>;
	if (site.isCollection(record.collection) && site.recordLocalizedFields(record.collection).includes("title")) {
		const translations = metadata[RECORD_TRANSLATIONS_KEY] as Record<string, Record<string, unknown>> | undefined;
		const localized = translations?.[locale]?.title;
		if (typeof localized === "string" && localized.trim()) return localized;
	}
	return typeof metadata.title === "string" ? metadata.title : null;
};

const pathOf = (site: Site, collection: string, slug: string, locale: string): string | null => {
	const path = site.contentPath(collection, slug);
	return path ? site.localizePath(locale, path) : null;
};

/**
 * The published version of each entry (translation group) id for a reader: the one in `locale`, else the source text, else any language.
 * One query for all ids; an id with no published version has no result.
 */
async function publishedPicker(
	store: ContentStore,
	groupIds: Iterable<string>,
	locale: string,
): Promise<(groupId: string) => PublishedEntryRecord | undefined> {
	const wanted = [...new Set(groupIds)];
	const targets = wanted.length > 0 ? await store.listPublishedByGroups({ translationGroupIds: wanted }) : [];
	const byGroup = new Map<string, PublishedEntryRecord[]>();
	for (const target of targets)
		byGroup.set(target.translationGroupId, [...(byGroup.get(target.translationGroupId) ?? []), target]);
	return (groupId) => {
		const members = byGroup.get(groupId);
		if (!members) return undefined;
		return (
			members.find((member) => member.locale === locale) ??
			members.find((member) => member.id === member.translationGroupId) ??
			members[0]
		);
	};
}

const relationIdsOfRecord = (site: Site, record: PublishedEntryRecord): string[] =>
	site.isCollection(record.collection)
		? relationFieldsOf(site, record.collection).flatMap(({ name }) =>
				idsOf((record.metadata as Record<string, unknown>)[name]),
			)
		: [];

/** Relation targets of each record: the published version of each, this locale -> source text. */
function resolveRelations(
	site: Site,
	records: readonly PublishedEntryRecord[],
	locale: string,
	pick: (groupId: string) => PublishedEntryRecord | undefined,
): Map<string, Record<string, ReadRelation[]>> {
	const relationOf = (groupId: string): ReadRelation | null => {
		const chosen = pick(groupId);
		if (!chosen) return null;
		return {
			id: chosen.translationGroupId,
			collection: chosen.collection,
			locale: chosen.locale,
			slug: chosen.slug,
			title: titleOf(site, chosen, locale),
			path: pathOf(site, chosen.collection, chosen.slug, chosen.locale),
		};
	};
	const result = new Map<string, Record<string, ReadRelation[]>>();
	for (const record of records) {
		const relations: Record<string, ReadRelation[]> = {};
		if (site.isCollection(record.collection)) {
			for (const { name } of relationFieldsOf(site, record.collection)) {
				relations[name] = idsOf((record.metadata as Record<string, unknown>)[name])
					.map(relationOf)
					.filter((relation): relation is ReadRelation => relation !== null);
			}
		}
		result.set(record.id, relations);
	}
	return result;
}

/**
 * The refs of each record's document. The media of all records is looked up together (each id once); a record gets only the ids its own document
 * holds, so a read never lists a media item or a link target the document does not use. A link target is the published version in the reader's
 * language, else the source's; one that is not published, or has no public path, is left out (the renderer draws that link as plain text).
 */
async function resolveRefs(
	deps: PublicMediaDeps & { readonly site: Site },
	records: readonly PublishedEntryRecord[],
	locale: string,
	pick: (groupId: string) => PublishedEntryRecord | undefined,
): Promise<Map<string, ReadRefs>> {
	const idsByRecord = new Map(records.map((record) => [record.id, collectRefs(record.doc)] as const));
	const resolved = await resolvePublicMedia(deps, [...new Set([...idsByRecord.values()].flatMap((ids) => ids.media))]);
	const linkOf = (groupId: string): ReadLink | undefined => {
		const chosen = pick(groupId);
		const path = chosen && pathOf(deps.site, chosen.collection, chosen.slug, chosen.locale);
		return chosen && path ? { path, title: titleOf(deps.site, chosen, locale), locale: chosen.locale } : undefined;
	};
	return new Map(
		records.map((record) => {
			const ids = idsByRecord.get(record.id);
			const media: Record<string, ReadRefs["media"][string]> = {};
			for (const mediaId of ids?.media ?? []) {
				// An id with no media row is left out: a renderer reads it as unresolved.
				const result = resolved.get(mediaId);
				if (result) media[mediaId] = result;
			}
			const links: Record<string, ReadLink> = {};
			for (const groupId of ids?.links ?? []) {
				const link = linkOf(groupId);
				if (link) links[groupId] = link;
			}
			return [
				record.id,
				Object.keys(media).length > 0 || Object.keys(links).length > 0 ? { media, links } : EMPTY_REFS,
			] as const;
		}),
	);
}

/** The refs of a read as the lookups a format uses: links by the address they resolved to, media by public URL. */
const exportRefsOf = (refs: ReadRefs): ExportRefs => ({
	links: Object.fromEntries(
		Object.entries(refs.links).map(([id, link]) => [
			id,
			{ url: link.path, title: link.title, locale: link.locale } satisfies FormatLink,
		]),
	),
	media: Object.fromEntries(
		Object.entries(refs.media).flatMap(([id, media]) =>
			"url" in media
				? [
						[
							id,
							{
								url: media.url,
								...(media.width === undefined ? {} : { width: media.width }),
								...(media.height === undefined ? {} : { height: media.height }),
								filename: media.file?.filename ?? "",
								mimeType: media.file?.mimeType ?? null,
								byteSize: media.file?.byteSize ?? null,
							} satisfies FormatMedia,
						],
					]
				: [],
		),
	),
});

async function toReadEntries<C extends string, Config extends AnyCmsConfig>(
	deps: ReadDeps<Config>,
	records: readonly PublishedEntryRecord[],
	locale: string,
	fallback = false,
	format?: string,
): Promise<ReadEntry<C, Config>[]> {
	const { site } = deps;
	const formats = format === undefined ? undefined : await deps.formats();
	if (formats && format !== undefined && !formats.get(format)) {
		throw new ServiceError("unknown_format", [{ code: "unknown_format", message: format, params: { format } }]);
	}
	// Relation targets and link targets are the same kind of thing (a published entry by translation group id), so they are looked up together.
	const pick = await publishedPicker(
		deps.store(),
		records.flatMap((record) => [...relationIdsOfRecord(site, record), ...collectRefs(record.doc).links]),
		locale,
	);
	const relations = resolveRelations(site, records, locale, pick);
	const refs = await resolveRefs(deps, records, locale, pick);
	const bodies = new Map<string, ReadBody>();
	if (formats && format !== undefined) {
		for (const record of records) {
			if (!record.doc) continue;
			const { text } = await exportText(site, formats, format, record.doc, {
				locale: record.locale,
				purpose: "read",
				refs: exportRefsOf(refs.get(record.id) ?? EMPTY_REFS),
			});
			bodies.set(record.id, { format, text });
		}
	}
	return records.map((record) => ({
		id: record.id,
		collection: record.collection as C,
		locale: record.locale,
		translationGroupId: record.translationGroupId,
		slug: record.slug,
		path: pathOf(site, record.collection, record.slug, record.locale),
		title: titleOf(site, record, locale),
		// Values of fields the site has removed stay stored but are not public: the site code sees the shape its config types.
		metadata: (site.isCollection(record.collection)
			? site.schemaMetadata(record.collection, record.metadata)
			: record.metadata) as MetadataFor<C, Config>,
		relations: relations.get(record.id) ?? {},
		publishedAt: record.publishedAt,
		updatedAt: record.updatedAt,
		doc: record.doc,
		refs: refs.get(record.id) ?? EMPTY_REFS,
		...(bodies.has(record.id) ? { body: bodies.get(record.id) } : {}),
		fallback,
	}));
}

const assertCollection = (site: Site, collection: string): string => {
	if (!site.isCollection(collection)) throw new Error(`cms/read: unknown collection "${collection}"`);
	return collection;
};

/** An item collection has only the default locale (the name is picked from the per-locale values). */
const storageLocale = (site: Site, collection: string, locale: string | undefined) =>
	site.isItemCollection(collection)
		? site.DEFAULT_LOCALE
		: locale && site.isLocale(locale)
			? locale
			: site.DEFAULT_LOCALE;

/** What the read API needs from a CMS instance. */
export interface ReadDeps<Config extends AnyCmsConfig = AnyCmsConfig> {
	/** The site of the instance: the collections, locales and URLs the reads follow. */
	readonly site: Site<Config>;
	readonly store: () => ContentStore;
	readonly mediaStore: () => MediaStore;
	/** The formats of the instance (`cms.formats()`), for the `format` option. */
	readonly formats: () => Promise<FormatRegistry>;
	/** Throws if the current request is not from an admin (the check `getPreview` uses). */
	readonly verifyAdmin: () => Promise<AuthContext>;
}

/**
 * The read API of one CMS instance (`cms.read`). Published content is read through the instance's store, so several instances in one process
 * read their own databases.
 */
export interface CmsRead<
	// biome-ignore lint/suspicious/noExplicitAny: `CmsRead` alone reads any site config
	Config extends AnyCmsConfig = any,
> {
	/**
	 * One entry. The URL (`slug`) is that locale's URL. For an old URL it returns `redirect`.
	 * With `fallback: true`, if this locale has no translation, it returns the source text (default locale) at the same URL with `fallback: true`.
	 */
	getEntry<C extends CollectionName<Config>>(params: {
		readonly collection: C;
		readonly slug: string;
		readonly locale?: string;
		readonly fallback?: boolean;
		/** Also return the body as text in this format (`entry.body`). An unknown format throws a `ServiceError` coded `unknown_format`. */
		readonly format?: string;
	}): Promise<ReadEntryResult<C, Config>>;
	/** One page of a list. Relation filters (`where`), sorting and pagination are done in the DB. The body is read only when `body: true`. */
	listEntries<C extends CollectionName<Config>>(params: {
		readonly collection: C;
		readonly locale?: string;
		/** Relation field name -> item IDs (OR if several). Different fields are ANDed. */
		readonly where?: Readonly<Record<string, string | readonly string[]>>;
		readonly sort?: PublishedSort;
		readonly order?: "asc" | "desc";
		readonly page?: number;
		readonly pageSize?: number;
		readonly body?: boolean;
		/** With `body: true`, also return each body as text in this format (`entry.body`). */
		readonly format?: string;
	}): Promise<{ items: ReadEntry<C, Config>[]; total: number; page: number; pageSize: number }>;
	/** The published locales of the same entry (source first) and their URLs. Used for hreflang and the locale switcher. */
	getTranslations(params: {
		readonly translationGroupId: string;
	}): Promise<{ locale: string; slug: string; path: string | null }[]>;
	/**
	 * Preview (admins only). Returns the latest draft in the same shape as the published version. A translation is merged with the common values of the source draft.
	 * `null` if not logged in or not an admin. Only published relation targets are resolved.
	 */
	getPreview<C extends CollectionName<Config>>(params: {
		readonly collection: C;
		readonly slug: string;
		readonly locale?: string;
		/** Also return the draft as text in this format (`entry.body`). */
		readonly format?: string;
	}): Promise<ReadEntry<C, Config> | null>;
	/** Public URL of one media item (shared image etc.). `null` if it is not ready or the deployment has no DB or storage. */
	mediaUrl(mediaId: string): ReturnType<typeof resolvePublicMediaUrl>;
}

export function createRead<Config extends AnyCmsConfig = AnyCmsConfig>(deps: ReadDeps<Config>): CmsRead<Config> {
	const { site } = deps;
	return {
		async getEntry<C extends CollectionName<Config>>(params: {
			readonly collection: C;
			readonly slug: string;
			readonly locale?: string;
			readonly fallback?: boolean;
			readonly format?: string;
		}): Promise<ReadEntryResult<C, Config>> {
			const collection = assertCollection(site, params.collection);
			const locale = storageLocale(site, collection, params.locale);
			const slug = params.slug.normalize("NFC").trim();
			if (!slug) return { status: "not_found" };
			const store = deps.store();
			let lookup = await store.getPublishedEntryBySlug({ collection, slug, locale, includeBody: true });
			let fellBack = false;
			if (lookup.status === "not_found" && params.fallback && locale !== site.DEFAULT_LOCALE) {
				lookup = await store.getPublishedEntryBySlug({
					collection,
					slug,
					locale: site.DEFAULT_LOCALE,
					includeBody: true,
				});
				fellBack = lookup.status !== "not_found";
			}
			if (lookup.status === "not_found") return { status: "not_found" };
			const [entry] = await toReadEntries<C, Config>(
				deps,
				[lookup.entry],
				params.locale ?? locale,
				fellBack,
				params.format,
			);
			if (!entry) return { status: "not_found" };
			if (lookup.status === "alias") return { status: "redirect", slug: entry.slug, path: entry.path, entry };
			return { status: "found", entry };
		},

		async listEntries<C extends CollectionName<Config>>(params: {
			readonly collection: C;
			readonly locale?: string;
			readonly where?: Readonly<Record<string, string | readonly string[]>>;
			readonly sort?: PublishedSort;
			readonly order?: "asc" | "desc";
			readonly page?: number;
			readonly pageSize?: number;
			readonly body?: boolean;
			readonly format?: string;
		}): Promise<{ items: ReadEntry<C, Config>[]; total: number; page: number; pageSize: number }> {
			const collection = assertCollection(site, params.collection);
			const locale = storageLocale(site, collection, params.locale);
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
			return {
				...result,
				items: await toReadEntries<C, Config>(deps, result.items, params.locale ?? locale, false, params.format),
			};
		},

		async getTranslations(params) {
			const members = await deps.store().listPublishedTranslations(params);
			return members.map((member) => ({
				locale: member.locale,
				slug: member.slug,
				path: pathOf(site, member.collection, member.slug, member.locale),
			}));
		},

		async getPreview<C extends CollectionName<Config>>(params: {
			readonly collection: C;
			readonly slug: string;
			readonly locale?: string;
			readonly format?: string;
		}): Promise<ReadEntry<C, Config> | null> {
			try {
				await deps.verifyAdmin();
			} catch {
				return null;
			}
			const collection = assertCollection(site, params.collection);
			const locale = storageLocale(site, collection, params.locale);
			const store = deps.store();
			const draft = await store.getWorkingEntryBySlug({ collection, slug: params.slug, locale });
			if (!draft || draft.status === "trashed") return null;
			let metadata = draft.working.metadata;
			if (draft.translationGroupId !== draft.id) {
				const source = await store.getEntry(draft.translationGroupId).catch(() => null);
				if (source)
					metadata = site.mergeTranslationMetadata(collection, source.working.metadata, metadata) as EntryMetadata;
			}
			const record: PublishedEntryRecord = {
				id: draft.id,
				collection,
				locale: draft.locale,
				translationGroupId: draft.translationGroupId,
				slug: draft.workingSlug ?? params.slug,
				metadata,
				doc: draft.working.doc,
				publishedAt: draft.publishedAt ?? null,
				updatedAt: draft.updatedAt,
			};
			const [entry] = await toReadEntries<C, Config>(deps, [record], locale, false, params.format);
			return entry ?? null;
		},

		mediaUrl: (mediaId) => resolvePublicMediaUrl(deps, mediaId),
	};
}

/**
 * Resolves what documents point to, for writing them as text outside a page read: `published` resolves links the way a reader sees them (the published
 * version of the target in the document's language, else the source's; an unpublished target is not a link). `working` is for a draft or a backup: the target
 * is whichever entry the id names, at its current address (its draft address when it is not published yet), unless it is trashed or has no public path.
 * Media is the ready file either way. Lookups are remembered, so exporting many documents asks for each target once.
 */
export function createExportRefs(
	deps: PublicMediaDeps & { readonly site: Site },
	scope: "published" | "working",
): (doc: StoredDocument, locale: string) => Promise<ExportRefs> {
	const links = new Map<string, FormatLink | null>();
	const media = new Map<string, FormatMedia | null>();
	const store = () => deps.store();

	const workingLink = async (id: string, locale: string): Promise<FormatLink | null> => {
		try {
			const entry = await store().getEntry(id);
			if (entry.status === "trashed") return null;
			const group = await store().getTranslationGroup({ entryId: id });
			const member =
				group.members.find((item) => item.locale === locale) ?? group.members.find((item) => item.isSource);
			if (!member?.workingSlug) return null;
			const path = pathOf(deps.site, entry.collection, member.workingSlug, member.locale);
			return path ? { url: path, title: member.title, locale: member.locale } : null;
		} catch {
			return null;
		}
	};

	return async (doc, locale) => {
		const ids = collectRefs(doc);
		const missingLinks = ids.links.filter((id) => !links.has(`${locale}:${id}`));
		if (scope === "published") {
			const pick = await publishedPicker(store(), missingLinks, locale);
			for (const id of missingLinks) {
				const chosen = pick(id);
				const path = chosen && pathOf(deps.site, chosen.collection, chosen.slug, chosen.locale);
				links.set(
					`${locale}:${id}`,
					chosen && path ? { url: path, title: titleOf(deps.site, chosen, locale), locale: chosen.locale } : null,
				);
			}
		} else {
			for (const id of missingLinks) links.set(`${locale}:${id}`, await workingLink(id, locale));
		}
		const missingMedia = ids.media.filter((id) => !media.has(id));
		if (missingMedia.length > 0) {
			const resolved = await resolvePublicMedia(deps, missingMedia);
			for (const id of missingMedia) {
				const result = resolved.get(id);
				media.set(
					id,
					result && "url" in result
						? {
								url: result.url,
								...(result.width === undefined ? {} : { width: result.width }),
								...(result.height === undefined ? {} : { height: result.height }),
								filename: result.file?.filename ?? "",
								mimeType: result.file?.mimeType ?? null,
								byteSize: result.file?.byteSize ?? null,
							}
						: null,
				);
			}
		}
		const found = <T>(entries: [string, T | null][]) =>
			new Map(entries.filter((entry): entry is [string, T] => entry[1] !== null));
		return {
			links: found(ids.links.map((id): [string, FormatLink | null] => [id, links.get(`${locale}:${id}`) ?? null])),
			media: found(ids.media.map((id): [string, FormatMedia | null] => [id, media.get(id) ?? null])),
		};
	};
}

export type { PublishedSort } from "../core/store";
export type { DocumentRefIds, ReadLink, ReadRefs } from "../doc/document-refs";
export { collectRefs } from "../doc/document-refs";
export type { StoredDocument } from "../doc/stored-document";
