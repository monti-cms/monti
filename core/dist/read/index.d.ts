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
import type { AuthContext } from "../adapters/auth/auth-gateway.js";
import type { ContentStore, PublishedSort } from "../core/store/index.js";
import type { CollectionName, PublishedMetadataFor } from "../core/types.js";
import { type ReadRefs } from "../doc/document-refs.js";
import { type PublicMediaDeps, resolvePublicMediaUrl } from "../doc/public-media.js";
import type { StoredDocument } from "../doc/stored-document.js";
import { type ExportRefs } from "../format/convert.js";
import type { FormatRegistry } from "../format/registry.js";
import type { MediaStore } from "../media/store.js";
import type { AnyCmsConfig, Site } from "../site/index.js";
export type { CollectionName, MetadataFor, PublishedMetadataFor } from "../core/types.js";
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
export interface ReadEntry<C extends string = string, Config extends AnyCmsConfig = any> {
    readonly id: string;
    readonly collection: C;
    /** Locale of the body shown. If it fell back to the source text, the source locale. */
    readonly locale: string;
    readonly translationGroupId: string;
    readonly slug: string;
    /** Public URL (if the collection has `path`, including the locale prefix). */
    readonly path: string | null;
    readonly title: string | null;
    readonly metadata: PublishedMetadataFor<C, Config>;
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
export type ReadEntryResult<C extends string = string, Config extends AnyCmsConfig = any> = {
    readonly status: "found";
    readonly entry: ReadEntry<C, Config>;
}
/** Arrived through an old URL. Permanently redirect (308) to `path` (or `slug` if absent). */
 | {
    readonly status: "redirect";
    readonly slug: string;
    readonly path: string | null;
    readonly entry: ReadEntry<C, Config>;
} | {
    readonly status: "not_found";
};
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
export interface CmsRead<Config extends AnyCmsConfig = any> {
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
    }): Promise<{
        items: ReadEntry<C, Config>[];
        total: number;
        page: number;
        pageSize: number;
    }>;
    /** The published locales of the same entry (source first) and their URLs. Used for hreflang and the locale switcher. */
    getTranslations(params: {
        readonly translationGroupId: string;
    }): Promise<{
        locale: string;
        slug: string;
        path: string | null;
    }[]>;
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
export declare function createRead<Config extends AnyCmsConfig = AnyCmsConfig>(deps: ReadDeps<Config>): CmsRead<Config>;
/**
 * Resolves what documents point to, for writing them as text outside a page read: `published` resolves links the way a reader sees them (the published
 * version of the target in the document's language, else the source's; an unpublished target is not a link). `working` is for a draft or a backup: the target
 * is whichever entry the id names, at its current address (its draft address when it is not published yet), unless it is trashed or has no public path.
 * Media is the ready file either way. Lookups are remembered, so exporting many documents asks for each target once.
 */
export declare function createExportRefs(deps: PublicMediaDeps & {
    readonly site: Site;
}, scope: "published" | "working"): (doc: StoredDocument, locale: string) => Promise<ExportRefs>;
export type { PublishedSort } from "../core/store/index.js";
export type { DocumentRefIds, ReadLink, ReadRefs } from "../doc/document-refs.js";
export { collectRefs } from "../doc/document-refs.js";
export type { StoredDocument } from "../doc/stored-document.js";
