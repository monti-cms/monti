import type { ReadEntry } from "../../../read/index.js";
/**
 * Public JSON API (`/api/cms/v1/public/*`). Enabled by `publicApi` in the server config. Without it, public API paths return 404.
 * Returns only published content without login, and responses are not cached (archiving and address changes show up on the next request).
 */
export interface PublicApiOptions {
    /** Collections to expose. Both list and single reads are limited to these. */
    readonly collections: readonly string[];
    /** Used when the list request gives no `collection`. Defaults to the first of `collections`. */
    readonly defaultCollection?: string;
    /**
     * List query name → relation field. The value is the target entry's address (slug). E.g. with `{ category: "categoryId", tag: "tagIds" }`,
     * `?category=react` returns only posts pointing to the entry whose address is `react`.
     */
    readonly filters?: Readonly<Record<string, string>>;
    /** Maximum page size (default 100). The default page size is 25. */
    readonly maxPageSize?: number;
    /**
     * Shape of an entry in the response. Defaults to `defaultPublicJson`. The body (`doc` and `refs`) is included only for a single read (`body: true`).
     * Returning `null` hides that entry from the public API (dropped from lists, 404 for a single read). A page's `total` is the count before hiding.
     */
    readonly toJson?: (entry: ReadEntry, options: {
        readonly body: boolean;
    }) => unknown;
}
/**
 * Default response shape. No admin-only values (edition, folder, status).
 * A single read adds the body: `doc` (the stored document), `refs` (the public URLs of its media keyed by media id, and the address and title of its internal links keyed by entry id; only what the document uses)
 * With `?format=<name>` it also carries `body`: the document as text in that format, as `{ format, text }`.
 */
export declare function defaultPublicJson(entry: ReadEntry, { body }: {
    readonly body: boolean;
}): {
    id: string;
    collection: string;
    locale: string;
    slug: string;
    path: string | null;
    title: string | null;
    publishedAt: string | null;
    updatedAt: string;
    metadata: {
        [field: string]: unknown;
    };
    relations: Readonly<Record<string, readonly import("../../../read/index.js").ReadRelation[]>>;
    doc?: import("../../../read/index.js").StoredDocument | null | undefined;
    refs?: import("../../../read/index.js").ReadRefs | undefined;
    body?: import("../../../read/index.js").ReadBody | undefined;
};
