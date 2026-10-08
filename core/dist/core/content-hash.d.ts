import { type StoredDocument } from "../doc/stored-document.js";
import type { JsonValue } from "./types.js";
/**
 * The form of a document that is hashed: the document itself without block ids (they say which block is which, not what the body says), with
 * object keys sorted at every depth. Two bodies get the same value exactly when they read the same to a reader: the same text, marks,
 * blocks and attribute values. The stored form already ignores how a body was written (see `StoredDocument`).
 */
export declare const canonicalBodyForHash: (doc: StoredDocument) => JsonValue;
/**
 * Content hash of a snapshot: metadata (key order ignored) and the stored document of the body. The schema version an entry is stored under is not part of
 * it (see {@link HASHED_SCHEMA_VERSION}): a schema change that does not touch an entry's content leaves its hash alone, so it does not look edited.
 * A body that could not become a document has no content to hash, so its text is hashed under a different tag.
 *
 * Version tag history: `cms-snapshot-v1` hashed the MDX string itself. v2 hashes the parsed body so that a
 * syntax-only change (the serializer changing how the same content is written) is not a content change. v3 hashes the
 * stored document, the form a body is kept in once the document is the source. Hashing the document directly gives the
 * same value v3 gave for the MDX it was written as.
 */
export declare function computeContentHash(metadata: JsonValue, doc: StoredDocument): string;
