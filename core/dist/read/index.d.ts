import type { EntryMetadata } from "../adapters/postgres/content-store.js";
import type { PublishedSort } from "../adapters/postgres/store/public-read.js";
import type { ResolvedConfig } from "../config/resolved.js";
import { type Collection } from "../core/collections.js";
import type { MetadataOf } from "../schema/collection.js";
/** Collection metadata type extracted from the site config. */
export type MetadataFor<C extends Collection> = C extends keyof ResolvedConfig["collections"] ? MetadataOf<ResolvedConfig["collections"][C]> : EntryMetadata;
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
export type ReadEntryResult<C extends Collection = Collection> = {
    readonly status: "found";
    readonly entry: ReadEntry<C>;
}
/** Arrived through an old URL. Permanently redirect (308) to `path` (or `slug` if absent). */
 | {
    readonly status: "redirect";
    readonly slug: string;
    readonly path: string | null;
    readonly entry: ReadEntry<C>;
} | {
    readonly status: "not_found";
};
/**
 * One entry. The URL (`slug`) is that locale's URL. For an old URL it returns `redirect`.
 * With `fallback: true`, if this locale has no translation, it returns the source text (default locale) at the same URL with `fallback: true`.
 */
export declare function getEntry<C extends Collection>(params: {
    readonly collection: C;
    readonly slug: string;
    readonly locale?: string;
    readonly fallback?: boolean;
}): Promise<ReadEntryResult<C>>;
/** One page of a list. Relation filters (`where`), sorting and pagination are done in the DB. The body is read only when `body: true`. */
export declare function listEntries<C extends Collection>(params: {
    readonly collection: C;
    readonly locale?: string;
    /** Relation field name -> item IDs (OR if several). Different fields are ANDed. */
    readonly where?: Readonly<Record<string, string | readonly string[]>>;
    readonly sort?: PublishedSort;
    readonly order?: "asc" | "desc";
    readonly page?: number;
    readonly pageSize?: number;
    readonly body?: boolean;
}): Promise<{
    items: ReadEntry<C>[];
    total: number;
    page: number;
    pageSize: number;
}>;
/** The published locales of the same entry (source first) and their URLs. Used for hreflang and the locale switcher. */
export declare function getTranslations(params: {
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
export declare function getPreview<C extends Collection>(params: {
    readonly collection: C;
    readonly slug: string;
    readonly locale?: string;
}): Promise<ReadEntry<C> | null>;
export type { PublishedSort } from "../adapters/postgres/store/public-read.js";
