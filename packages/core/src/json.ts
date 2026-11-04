/** A JSON value with object keys sorted, so two values compare equal however their keys were ordered (Postgres `jsonb` reorders them). */
export const canonical = (value: unknown): unknown =>
	Array.isArray(value)
		? value.map(canonical)
		: typeof value === "object" && value !== null
			? Object.fromEntries(
					Object.keys(value)
						.sort()
						.map((key) => [key, canonical((value as Record<string, unknown>)[key])]),
				)
			: value;

/** Whether two JSON values are the same, whatever their key order. */
export const sameJson = (a: unknown, b: unknown) => JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));
