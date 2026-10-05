import { createHash } from "node:crypto";
import { analyze, toDocument } from "../mdx";
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

/** Node attributes without the source-replay data (see `canonicalBodyForHash`). */
const canonicalAttrs = (type: string, attrs: Record<string, JsonValue>): Record<string, JsonValue> => {
	const out = { ...attrs };
	if (type === "codeBlock") {
		delete out.codeDocument;
	} else if (typeof out.name === "string" && isJsonArray(out.attributes)) {
		// Only the raw list a JSX node carries next to its named values is dropped, not any attribute that happens to be called `attributes`.
		delete out.attributes;
	}
	return out;
};

const canonicalNode = (node: CmsNode): JsonValue => {
	const { type, attrs, content, marks, text } = node;
	const out: Record<string, JsonValue> = { type };
	if (attrs) out.attrs = sortKeys(canonicalAttrs(type, attrs as Record<string, JsonValue>));
	if (content) out.content = content.map(canonicalNode);
	if (marks) out.marks = marks.map((mark) => sortKeys(mark as unknown as JsonValue));
	if (text !== undefined) out.text = text;
	return sortKeys(out);
};

/**
 * The form of a parsed body that is hashed. Two bodies get the same value exactly when they read the same
 * to a reader: the same text, marks, blocks and attribute values.
 *
 * The parsed document (`toDocument`) already ignores spelling: `*a*` and `_a_`, directive and JSX syntax, and whitespace between blocks
 * all produce the same nodes. On top of that:
 * - object keys are sorted at every depth, so the order attributes were written in does not matter;
 * - source-replay data is dropped because it only records how the text was written, not what it says:
 *   the raw `attributes[]` list of a JSX node (the named attribute values stay) and the `codeDocument` of a
 *   code block (derived from its `value`, `language` and `meta`, which stay);
 * - source positions are never part of the result.
 *
 * Everything else that changes rendered output stays.
 */
export const canonicalBodyForHash = (document: CmsNode): JsonValue => canonicalNode(document);

/**
 * Content hash of a snapshot: schema version, metadata (key order ignored) and the body in its canonical form.
 * A body that does not parse cleanly has no canonical form, so its raw string is hashed under a different tag.
 * Pass an `analysis` of `mdx` that was already made to avoid parsing it again.
 *
 * Version tag history: `cms-snapshot-v1` hashed the MDX string itself. v2 hashes the parsed body so that a
 * syntax-only change (the serializer changing how the same content is written) is not a content change.
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
			? ["cms-snapshot-v2-raw", schemaVersion, sortKeys(metadata), mdx]
			: ["cms-snapshot-v2", schemaVersion, sortKeys(metadata), body];
	return createHash("sha256").update(JSON.stringify(tuple)).digest("hex");
}

/** The canonical body, or `undefined` when the document cannot be built (the caller then hashes the raw string). */
const parsedBody = (analysis: CmsMdxAnalysis): JsonValue | undefined => {
	try {
		return canonicalBodyForHash(toDocument(analysis));
	} catch {
		return undefined;
	}
};
