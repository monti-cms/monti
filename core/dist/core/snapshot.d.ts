import { type StoredDocument } from "../doc/stored-document.js";
import { type FormatRegistry } from "../format/registry.js";
import type { Site } from "../site/index.js";
import { computeContentHash } from "./content-hash.js";
import { MAX_DOC_BYTES, MAX_METADATA_BYTES, MAX_TEXT_BYTES } from "./limits.js";
import { type Issue, type PreparedSnapshot, type Reference, type ResolvedTargets, type ServiceInput } from "./types.js";
/**
 * Snapshot preparation and publish validation. Pure rules; knows nothing about the DB or HTTP.
 * The service (draft save) and the repository implementation (re-validation inside the publish transaction) use the same rules.
 */
export { MAX_DOC_BYTES, MAX_METADATA_BYTES, MAX_TEXT_BYTES };
export { computeContentHash };
/** Is this a plain object with exactly the allowed keys? Getters and inherited properties are rejected. */
export declare function validateExactRecord(value: unknown, expectedKeys: readonly string[]): asserts value is Record<string, unknown>;
/** Keys a service input must have: the body is `doc`, or `body` with its `format`, or nothing (an item collection has no body, `readInputBody`). */
export declare const serviceInputKeys: (input: unknown) => readonly string[];
/** What reading the body of a service input gives: the document, and the findings about a text that could not become one. */
export interface InputBody {
    readonly doc: StoredDocument;
    /** For a body given as text that the format could not read: why (`mdx_error`, `frontmatter_present`), with the line and column in that text. */
    readonly importIssues: Issue[];
    /** Warnings about a text that was read, but not kept as written (a code annotation that reaches past the code). */
    readonly importWarnings?: Issue[];
}
/**
 * The body of a service input given as a stored document: taken as given (checked in shape, put in its canonical form). Blocks inherit their ids from
 * `previous`, the body being replaced, where the input has none.
 */
export declare const documentInputBody: (site: Site, input: ServiceInput, previous: StoredDocument | null | undefined) => InputBody;
/** What `readInputBody` needs to read a text: the formats and the language of the body. Without `formats`, only the built-in ones. */
export interface TextImport {
    readonly formats?: FormatRegistry;
    readonly locale?: string;
    readonly entryId?: string;
}
/**
 * The body of a service input as a document: the one given, or the text read by its format. A text the format rejects becomes a document of one
 * `unparsed` node that keeps it (with the reasons as `importIssues`): a draft can hold it, and `unparsed_body` blocks publishing it.
 */
export declare const readInputBody: (site: Site, input: ServiceInput, previous: StoredDocument | null | undefined, options?: TextImport) => Promise<InputBody>;
export declare function prepareSnapshot(site: Site, input: ServiceInput, options?: {
    schemaVersion?: number;
    previousReferences?: readonly Reference[];
    /** The stored document this body replaces (the current draft). Its block ids carry over to the blocks that pair with them. */
    previousDoc?: StoredDocument | null;
    /**
     * The metadata stored for this entry (the current draft). A key the schema no longer has is kept only if it is stored here
     * (a schema change orphaned it); a new unknown key is rejected. A new entry has none.
     */
    previousMetadata?: {
        readonly [key: string]: unknown;
    };
    /** Reading a body given as text: the formats (default: the built-in ones), the language of the body, the entry it is written to. */
    import?: TextImport;
    /** What the write pipeline already found while reading the body, when it read the text itself (the input then holds the document). */
    imported?: {
        readonly issues: readonly Issue[];
        readonly warnings: readonly Issue[];
    };
}): Promise<PreparedSnapshot>;
/**
 * Collects only the image warnings to include in the publish response, for a snapshot the write pipeline prepared. **Non-blocking**; if computation fails it returns an empty array.
 *
 * For media that is `ready` with a `storageKey`, if `headStorageKey` is provided, the actual object in storage is checked once more.
 * If it is missing, an `image_media_missing_in_storage` warning is added. On an infrastructure error it falls back to the DB decision.
 */
export declare function imageWarningsForSnapshot(snapshot: PreparedSnapshot, resolvers: {
    getMediaAsset: (id: string) => Promise<{
        status?: string;
        storageKey?: string | null;
    } | null>;
    headStorageKey?: (storageKey: string) => Promise<boolean>;
}): Promise<Issue[]>;
export declare function validateForPublish(site: Site, snapshot: PreparedSnapshot, resolved: ResolvedTargets): {
    ready: boolean;
    issues: Issue[];
    warnings: Issue[];
};
