import { type ImageResolveResult, type ImageResolver } from "./image-src.js";
import type { StoredDocument } from "./stored-document.js";
/**
 * What a stored document points to outside itself, and what a renderer needs resolved before it can draw the document.
 *
 * Registered media: an `image` or `file` node holds a `mediaId`, and the public URL, the size and the file name come from the media table.
 * Internal links: a link mark holds the `entryId` of the entry it points to, and the address and title come from that entry's published version.
 * Code links need nothing resolved (a link and the line it points to are in the same document).
 */
export interface DocumentRefIds {
    /** Media ids of the `image` and `file` nodes, in document order, each once. */
    readonly media: readonly string[];
    /** Entry ids (translation group ids) of the internal links, in document order, each once. */
    readonly links: readonly string[];
}
/** Where an internal link points for one reader: the published version of the entry in the reader's language, or in the source language when it has none. */
export interface ReadLink {
    /** The public URL, with the locale prefix of `locale`. */
    readonly path: string;
    /** The target's title in the reader's language (`null` when it has none). */
    readonly title: string | null;
    /** Language of the version `path` is the address of. */
    readonly locale: string;
}
/** The resolved targets of the ids in one document (`ReadEntry.refs`). Only ids that occur in that document are keyed. */
export interface ReadRefs {
    /** Media id → the public URL and size of a ready file, or why there is none. */
    readonly media: Readonly<Record<string, ImageResolveResult>>;
    /**
     * Entry id (translation group id) → where the link goes. An id that is not here is unresolved (the entry is not published, or is gone, or has no public
     * path): the link is drawn as plain text.
     */
    readonly links: Readonly<Record<string, ReadLink>>;
}
/** The refs of a document with nothing to resolve. */
export declare const EMPTY_REFS: ReadRefs;
/** The ids a document points to (a pure walk over every node, inline images included). A missing or malformed document has none. */
export declare function collectRefs(doc: StoredDocument | null | undefined): DocumentRefIds;
/**
 * The image resolver the renderer uses for a set of refs: a registered media id is looked up in `refs.media` (one that is not there is unresolved),
 * and an outer `src` goes through the same allow rules as everywhere else.
 */
export declare const imageResolverFromRefs: (refs: Pick<ReadRefs, "media">) => ImageResolver;
