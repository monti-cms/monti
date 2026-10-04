import type { StoreContext } from "./context.js";
import type { PublishedEntryLookup, PublishedEntryRecord } from "./types.js";
/** Public list sort. Publish date is the source's, modified date is this language body's, title is this language's title. */
export type PublishedSort = "publishedAt" | "updatedAt" | "title";
export interface PublishedPageParams {
    readonly collection: string;
    /** Only this language's content. Defaults to the default language. */
    readonly locale?: string;
    /** Relation field name to selected item IDs. Multiple values of the same field are OR; different fields are AND. */
    readonly where?: Readonly<Record<string, string | readonly string[]>>;
    readonly sort?: PublishedSort;
    /**
     * Display language used for title sorting. An item collection keeps one default-language record with per-language names (`translations`), so it sorts
     * by that language's name (falling back to the default name). If unset, `locale`.
     */
    readonly titleLocale?: string;
    readonly order?: "asc" | "desc";
    /** 1-based. */
    readonly page?: number;
    /** 1 to 500. Default 25. */
    readonly pageSize?: number;
    readonly includeBody?: boolean;
}
/**
 * Public reads only. Public pages, RSS, sitemap, and OG call it on every request.
 * It requires both a published body and published status, so drafts, archived, and trashed entries are never returned by any path.
 */
export declare function createPublicReadOps(ctx: StoreContext): {
    listPublishedEntries: (params: {
        collections: readonly string[];
        includeBody?: boolean;
        /** Only this language's content. All languages if unset. Record collections have only the default language. */
        locale?: string;
    }) => Promise<PublishedEntryRecord[]>;
    getPublishedEntryBySlug: (params: {
        collection: string;
        slug: string;
        includeBody?: boolean;
        /** Language of the slug. Defaults to the default language. */
        locale?: string;
    }) => Promise<PublishedEntryLookup>;
    /**
     * One page of published entries for a collection and language (relation filters, sorting, and pagination done in the DB). Relation filters accept relation fields only.
     * A translation's shared relation values are read from the source's published version (from this language's body for per-language fields).
     */
    listPublishedPage: (params: PublishedPageParams) => Promise<{
        items: PublishedEntryRecord[];
        total: number;
        page: number;
        pageSize: number;
    }>;
    /** Published languages of a translation group (including the source). Empty if the source is not published. */
    listPublishedTranslations: (params: {
        translationGroupId: string;
    }) => Promise<{
        id: string;
        collection: string;
        locale: string;
        slug: string;
    }[]>;
    /**
     * Published versions (all languages) for translation group IDs. Used when resolving relations: the caller picks the language and falls back to the source.
     * Targets that are not published are omitted.
     */
    listPublishedByGroups: (params: {
        translationGroupIds: readonly string[];
    }) => Promise<PublishedEntryRecord[]>;
};
