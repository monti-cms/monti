import type { StoredDocument } from "../doc/stored-document.js";
import type { CmsImageSource } from "../doc/types.js";
import { type BodyAllowed, type DisallowedItem } from "../schema/allowed.js";
import type { Site } from "../site/index.js";
import type { BodyPosition, InternalLinkSource, Issue } from "./types.js";
/**
 * The checks of a stored document that run before it is saved or published: what its blocks need (required, unknown and invalid attributes),
 * the references it holds (media, internal links, code line labels, footnotes), table merges and translation notes left in it.
 * It reads the stored document only, never MDX text, so it checks a body the same whichever notation or API it came from. Positions are the
 * `blockId` of the block a finding is in.
 */
export interface DocumentCheck {
    /** Findings that block publishing, in body order. */
    readonly issues: Issue[];
    /** Notices that do not block publishing. */
    readonly warnings: Issue[];
    /** Registered media the body uses (valid ids only), one entry per use. */
    readonly mediaReferences: {
        readonly mediaId: string;
        readonly position: BodyPosition;
    }[];
    readonly imageSources: CmsImageSource[];
    /** Links by address (`href`) that point into this site's content. They are looked up by address when the body is published. */
    readonly internalLinks: InternalLinkSource[];
    /** Links by entry id (valid ids only), one entry per link. */
    readonly entryLinks: {
        readonly entryId: string;
        readonly position: BodyPosition;
    }[];
    /** Whether the body holds an `unparsed` node. */
    readonly unparsed: boolean;
    /**
     * Whether the references of the body cannot be trusted: it is unparsed, or a reference in it is missing or malformed (an image with no source,
     * a media id that is not an id). The references of the draft it replaces then stay (marked stale) and no new ones are taken from it.
     */
    readonly incomplete: boolean;
}
/**
 * The notice for a block or mark the body's allowed list does not list (`disallowed_block`, `disallowed_mark`). It names the block or mark, the heading
 * level for a heading, and the block it is in.
 */
export declare const disallowedIssue: (item: DisallowedItem) => Issue;
/**
 * Checks a stored document. Block attribute rules and the like only block publishing; a draft save is never blocked by them.
 * `allowed` is the allowed list of the collection's body: a block or mark it does not list is reported as a warning (the content is kept as it is).
 */
export declare function checkDocument(site: Site, doc: StoredDocument, allowed?: BodyAllowed): DocumentCheck;
/** Whether a document has nothing a reader would see: no blocks, or only blank paragraphs. */
export declare const isEmptyDocument: (doc: StoredDocument) => boolean;
