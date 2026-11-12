/**
 * A JSON value with object keys sorted, so two values compare equal however their keys were ordered (Postgres `jsonb` reorders them). A date is
 * its instant as text, as JSON writes it: read as an object it has no keys, and any two dates would look the same.
 */
export const canonical = (value: unknown): unknown =>
	Array.isArray(value)
		? value.map(canonical)
		: value instanceof Date
			? value.toISOString()
			: typeof value === "object" && value !== null
				? Object.fromEntries(
						Object.keys(value)
							.sort()
							.map((key) => [key, canonical((value as Record<string, unknown>)[key])]),
					)
				: value;

/** Whether two JSON values are the same, whatever their key order. */
export const sameJson = (a: unknown, b: unknown) => JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));

/** Nothing written: no value, an empty text or an empty list. */
export const isEmptyValue = (value: unknown) =>
	value === undefined || value === null || value === "" || (Array.isArray(value) && value.length === 0);
