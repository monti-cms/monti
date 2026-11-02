import { createHash } from "node:crypto";

/**
 * The base of one spot of a target (a field's value, an entry's folder): a short hash of the value as JSON. A write's change is checked against the spot it
 * touches, not the whole entry, so two changes to different fields of one entry apply one after the other, while a field someone changed in the meantime is
 * left alone.
 */
export const spotBase = (value: unknown): string =>
	createHash("sha256")
		.update(JSON.stringify(value ?? null))
		.digest("hex")
		.slice(0, 16);
