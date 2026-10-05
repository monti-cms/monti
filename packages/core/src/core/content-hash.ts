import { createHash } from "node:crypto";
import { analyze, toDocument } from "../mdx";
import { withoutBlockIds } from "../mdx/block-ids";
import { toStoredDocument } from "../mdx/stored-document";
import type { CmsMdxAnalysis, CmsNode } from "../mdx/types";
import type { JsonValue } from "./types";

const isJsonArray = (value: unknown): value is readonly JsonValue[] => Array.isArray(value);

/** Copies a JSON value with object keys sorted at every depth (`undefined` members are dropped). */
export function sortKeys(value: JsonValue): JsonValue {
	if (value === null || typeof value !== "object") return value;
	if (isJsonArray(value)) return value.map(sortKeys);
	const record = value;
	return Object.keys(record)
		.sort()
		.reduce<Record<string, JsonValue>>((acc, key) => {
			const member = record[key];
			if (member !== undefined) acc[key] = sortKeys(member);
			return acc;
		}, {});
}

/**
 * The form of a parsed body that is hashed: its stored document (`toStoredDocument`). Two bodies get the same value exactly
 * when they read the same to a reader: the same text, marks, blocks and attribute values.
 *
 * The parsed document already ignores spelling: `*a*` and `_a_`, directive and JSX syntax, and whitespace between blocks
 * all produce the same nodes. The stored form also drops what only records how the text was written (the component name and
 * raw attribute list of a block, the annotation document of a code block, trailing blank lines) and sorts object keys at every
 * depth. Block ids and source positions are never part of it. Returns `null` when the body has no stored document (front matter).
 */
export const canonicalBodyForHash = (document: CmsNode): JsonValue | null => {
	const stored = toStoredDocument(document);
	// Block ids say which block is which, not what the body says.
	return stored && ({ ...stored, content: withoutBlockIds(stored.content) } as unknown as JsonValue);
};

/**
 * Content hash of a snapshot: schema version, metadata (key order ignored) and the body in its canonical form.
 * A body that does not parse cleanly has no canonical form, so its raw string is hashed under a different tag.
 * Pass an `analysis` of `mdx` that was already made to avoid parsing it again.
 *
 * Version tag history: `cms-snapshot-v1` hashed the MDX string itself. v2 hashes the parsed body so that a
 * syntax-only change (the serializer changing how the same content is written) is not a content change. v3 hashes the
 * stored document, the form a body is kept in once the document is the source.
 */
export function computeContentHash(
	metadata: JsonValue,
	mdx: string,
	schemaVersion = 1,
	analysis: CmsMdxAnalysis = analyze(mdx),
): string {
	const body = analysis.errors.length === 0 ? parsedBody(analysis) : undefined;
	const tuple =
		body === undefined
			? ["cms-snapshot-v3-raw", schemaVersion, sortKeys(metadata), mdx]
			: ["cms-snapshot-v3", schemaVersion, sortKeys(metadata), body];
	return createHash("sha256").update(JSON.stringify(tuple)).digest("hex");
}

/** The canonical body, or `undefined` when there is no stored document (the caller then hashes the raw string). */
const parsedBody = (analysis: CmsMdxAnalysis): JsonValue | undefined => {
	try {
		return canonicalBodyForHash(toDocument(analysis)) ?? undefined;
	} catch {
		return undefined;
	}
};
