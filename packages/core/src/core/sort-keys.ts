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
