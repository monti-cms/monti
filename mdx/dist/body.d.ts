import type { Site } from "@monti-cms/core/client";
import { type CmsNode, type StoredDocument } from "@monti-cms/core/document";
import type { SyntaxExtension } from "./syntax/types.js";
import type { CmsMdxAnalysis } from "./types.js";
/** The stored form of a working document, or `null` when the body cannot be stored as a document (it has front matter). */
export declare const toStoredDocument: (site: Site, working: CmsNode) => StoredDocument | null;
/** The working document (the shape `toDocument` makes and `serialize` reads) of a stored document. */
export declare const fromStoredDocument: (site: Site, stored: StoredDocument) => CmsNode;
/** One body in both forms. `doc` is `null` when the MDX does not parse, has front matter, or would not read back the same once written. */
export interface Body {
    readonly mdx: string;
    readonly doc: StoredDocument | null;
    readonly analysis: CmsMdxAnalysis;
    /** Line annotations of code blocks that reach past the last code line. The document keeps them cut, or drops them when they start past the code. */
    readonly outOfRange?: readonly OutOfRangeAnnotation[];
}
export interface OutOfRangeAnnotation {
    readonly name: string;
    /** The top-level block that holds the code block. */
    readonly blockId?: string;
}
export interface BodyOptions {
    /** The body this one replaces. Blocks that pair with its blocks inherit their ids (`assignBlockIds`). */
    readonly previous?: StoredDocument | null;
}
/**
 * A body from MDX. When the MDX parses, the document is the source and the MDX is written from it with `syntax`, so the same content is always
 * written as the same text. The written text must read back to the same document; if it does not (or the MDX does not parse, or has front matter),
 * the MDX is kept exactly as given and there is no document. MDX carries no block ids, so the document's blocks inherit them from `options.previous` or get new ones.
 */
export declare const bodyFromMdx: (site: Site, mdx: string, syntax?: readonly SyntaxExtension[], options?: BodyOptions) => Body;
/** The document of a body read from MDX: its parsed document, or an `unparsed` node holding the text when it has none. */
export declare const bodyDocument: (body: Body, previous?: StoredDocument | null) => StoredDocument;
/**
 * The MDX a document is written as: `syntax` over the document, and for a body that could not be read (a single `unparsed` node), the text it was
 * given, exactly.
 */
export declare const documentToMdx: (site: Site, doc: StoredDocument, syntax?: readonly SyntaxExtension[]) => string;
/**
 * A body from a stored document, through the MDX it is written as: written with `syntax` and read back, so the result is the same as from that MDX.
 * The block ids of `doc` are kept (a block without one, or with a copy of another's, gets one as `bodyFromMdx` would). Used where the MDX text has to be
 * derived from a document (the legacy store migrations).
 */
export declare const bodyFromDocument: (site: Site, doc: StoredDocument, syntax?: readonly SyntaxExtension[], options?: BodyOptions) => Body;
