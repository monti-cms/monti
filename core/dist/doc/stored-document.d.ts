import type { Site } from "../site/index.js";
import { type CodeBlockSite } from "./stored-code-block.js";
import type { CmsJsonValue, CmsMark, CmsNode } from "./types.js";
/**
 * Format version of a stored document. Raise it when a node or attribute changes its name or meaning, and add the step
 * from the previous version to `STORED_DOCUMENT_MIGRATIONS`. A new kind of block does not raise it.
 */
export declare const STORED_DOCUMENT_VERSION = 3;
/**
 * A body as it is stored: the parsed document in a shape that does not depend on how the body was written.
 *
 * - a block with a definition is stored under the definition's name (`callout`) with only its attribute values;
 * - JSX that no definition describes (a fragment, a `br` with attributes, spread attributes, a block written as JSX the
 *   editor cannot map) stays `mdxJsx` with its component `name` and raw `attributes` list, so a format that knows JSX can write it back as it was;
 * - a code block keeps `language`, `meta`, its `code` and its `annotations` as data (`stored-code-block.ts`), not the fence text with
 *   annotation comments or the values derived from it;
 * - trailing blank lines are dropped (they are never written);
 * - object keys are sorted at every depth, so the same body is the same JSON wherever it was stored (Postgres `jsonb` reorders keys).
 */
export interface StoredDocument {
    readonly type: "doc";
    readonly version: number;
    readonly content: readonly CmsNode[];
}
/** Node types of the document model itself. A block definition with one of these names is stored as `mdxJsx` so the two never mix. */
export declare const CORE_NODE_TYPES: ReadonlySet<string>;
/** The value with its object keys sorted at every depth. */
export declare const sortJson: (value: CmsJsonValue) => CmsJsonValue;
export declare const sortedAttrs: (attrs: Record<string, CmsJsonValue>) => Record<string, CmsJsonValue> | undefined;
/** Builds a node with its keys in sorted order (`attrs`, `content`, `id`, `marks`, `text`, `type`). */
export declare const storedNode: (type: string, attrs: Record<string, CmsJsonValue> | undefined, content: CmsNode[] | undefined, marks: CmsMark[] | undefined, text: string | undefined, id?: string) => CmsNode;
/** A mark in its stored form: keys sorted, an internal link normalised. */
export declare const storedMark: (given: CmsMark) => CmsMark;
export declare const isBlankParagraph: (block: CmsNode) => boolean;
/**
 * Reads a stored document from JSON (a database column, an API request, an export file): checks its shape and lifts an
 * older version to the current one. Returns `undefined` for anything that is not a stored document of a known version.
 */
export declare const readStoredDocument: (value: unknown, site?: CodeBlockSite) => StoredDocument | undefined;
/**
 * The form a document is stored in whichever way it was made (a client, an API request, a hook, a format): trailing blank paragraphs dropped, text runs
 * normalised (see `canonicalInline`). A document read from a format is already in it, so the same body hashes the same from either source.
 */
export declare const canonicalDocument: (site: Pick<Site, "sortMarks">, doc: StoredDocument) => StoredDocument;
/** A document with no blocks (a new body, a new template). */
export declare const emptyStoredDocument: () => StoredDocument;
/** Node type of a body that could not become a document (see `unparsedDocument`). */
export declare const UNPARSED_NODE = "unparsed";
/**
 * The document of a body that could not be read as one (a format rejected the text): a single `unparsed`
 * node that keeps the text as it was given. A draft can hold it and the editor shows it as it is; `unparsed_body` blocks publishing it.
 */
export declare const unparsedDocument: (source: string, previous?: StoredDocument | null, format?: string) => StoredDocument;
/** Whether a document holds a body that could not be read (an `unparsed` node anywhere in its blocks). */
export declare const isUnparsedDocument: (doc: StoredDocument) => boolean;
