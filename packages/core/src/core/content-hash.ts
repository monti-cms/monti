import { createHash } from "node:crypto";
import { withoutBlockIds } from "../doc/block-ids";
import { type StoredDocument, UNPARSED_NODE } from "../doc/stored-document";
import { sortKeys } from "./sort-keys";
import type { JsonValue } from "./types";

/** The text of a document that holds one `unparsed` node and nothing else (a body that could not become a document), otherwise `undefined`. */
const unparsedSource = (doc: StoredDocument): string | undefined => {
	const only = doc.content.length === 1 ? doc.content[0] : undefined;
	return only?.type === UNPARSED_NODE && typeof only.attrs?.source === "string" ? only.attrs.source : undefined;
};

/**
 * The document version the hash is defined over. A later version only changes how a link is written (an internal link is its entry id), which the hashed
 * content already tells apart, so a version bump alone changes no hash and no stored entry looks edited.
 */
const HASHED_DOCUMENT_VERSION = 2;

/**
 * The form of a document that is hashed: the document itself without block ids (they say which block is which, not what the body says), with
 * object keys sorted at every depth. Two bodies get the same value exactly when they read the same to a reader: the same text, marks,
 * blocks and attribute values. The stored form already ignores how a body was written (see `StoredDocument`).
 */
export const canonicalBodyForHash = (doc: StoredDocument): JsonValue =>
	sortKeys({ ...doc, content: withoutBlockIds(doc.content), version: HASHED_DOCUMENT_VERSION } as unknown as JsonValue);

/**
 * The schema version the hash is defined over. It is a constant of the hash rule, not the schema version an entry is stored under: the stored version
 * (`entry_bodies.schema_version`, bumped by `monti schema:apply`) says which schema the entry was written or transformed under, and changing it must not
 * change what an entry's content is. Every hash stored so far was computed with 1, so they all stay as they are.
 */
const HASHED_SCHEMA_VERSION = 1;

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
export function computeContentHash(metadata: JsonValue, doc: StoredDocument): string {
	const source = unparsedSource(doc);
	const tuple =
		source === undefined
			? ["cms-snapshot-v3", HASHED_SCHEMA_VERSION, sortKeys(metadata), canonicalBodyForHash(doc)]
			: ["cms-snapshot-v3-raw", HASHED_SCHEMA_VERSION, sortKeys(metadata), source];
	return createHash("sha256").update(JSON.stringify(tuple)).digest("hex");
}
