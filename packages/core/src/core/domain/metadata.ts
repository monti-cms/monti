import { CmsError } from "../store/errors";
import type { EntryMetadata, JsonObject, JsonValue } from "../store/types";

/**
 * Metadata as a store keeps it: plain JSON with object keys in sorted order, so equal values compare equal and hash the same.
 * Anything JSON cannot hold (`NaN`, class instances, functions) is rejected with `invalid_input`.
 */

function normalizeJsonValue(val: unknown): JsonValue {
	if (val === null) return null;
	if (typeof val === "string" || typeof val === "boolean") return val;
	if (typeof val === "number") {
		if (!Number.isFinite(val)) throw new CmsError("Non-finite number", "invalid_input");
		return val;
	}
	if (Array.isArray(val)) return val.map((v) => normalizeJsonValue(v));
	if (typeof val === "object") {
		if (Object.getPrototypeOf(val) !== Object.prototype && Object.getPrototypeOf(val) !== null) {
			throw new CmsError("Invalid object type", "invalid_input");
		}
		const obj: JsonObject = {};
		for (const key of Object.keys(val).sort()) {
			Object.defineProperty(obj, key, {
				value: normalizeJsonValue((val as Record<string, unknown>)[key]),
				enumerable: true,
				writable: true,
				configurable: true,
			});
		}
		return obj;
	}
	throw new CmsError(`Invalid JSON type: ${typeof val}`, "invalid_input");
}

export function normalizeMetadata(input: unknown): EntryMetadata {
	if (typeof input !== "object" || input === null || Array.isArray(input)) {
		throw new CmsError("Metadata must be a JSON object", "invalid_input");
	}
	if (Object.getPrototypeOf(input) !== Object.prototype && Object.getPrototypeOf(input) !== null) {
		throw new CmsError("Metadata must be a plain object", "invalid_input");
	}
	return normalizeJsonValue(input) as EntryMetadata;
}
