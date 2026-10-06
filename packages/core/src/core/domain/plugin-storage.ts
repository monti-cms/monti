import { CmsError } from "../store/errors";

/** Rules every plugin storage follows, whatever database holds it. */

/** Plugin and collection names: lowercase letters, digits and `-`, starting with a letter (the same rule as plugin names). */
const STORAGE_NAME = /^[a-z][a-z0-9-]*$/;

/** Plugin and collection names are lowercase words (`ai`, `action-overrides`): they end up in table rows and migration records, and never need quoting. */
export function assertStorageName(kind: "plugin" | "collection", name: string): void {
	if (typeof name !== "string" || !STORAGE_NAME.test(name)) {
		throw new CmsError(`plugin storage: invalid ${kind} name "${String(name)}"`, "invalid_input");
	}
}

/** Names of migration steps (`once`): lowercase words that may also use `_`, like `import_legacy_tables`. */
export function assertMigrationName(name: string): void {
	if (typeof name !== "string" || !/^[a-z][a-z0-9_-]*$/.test(name)) {
		throw new CmsError(`plugin storage: invalid migration name "${String(name)}"`, "invalid_input");
	}
}

/** A key is any non-empty text. */
export function assertStorageKey(key: string): void {
	if (typeof key !== "string" || key.length === 0)
		throw new CmsError("plugin storage: a key cannot be empty", "invalid_input");
}

/** What a stored version number may be: a positive integer (1 is the first write). */
export function assertStoredVersion(version: number): void {
	if (!Number.isInteger(version) || version < 1) {
		throw new CmsError("plugin storage: a version is a positive integer", "invalid_input");
	}
}

/** `expectedVersion`: 0 to create, otherwise a version that was read before. */
export function assertExpectedVersionNumber(version: number): void {
	if (!Number.isInteger(version) || version < 0) {
		throw new CmsError("plugin storage: expectedVersion is 0 or a version that was read", "invalid_input");
	}
}

/** A value as stored: JSON text. Anything JSON cannot hold (`undefined`, functions, circular references) is rejected with `invalid_input`. */
export function serializeStorageValue(value: unknown): string {
	let text: string | undefined;
	try {
		text = JSON.stringify(value);
	} catch {
		throw new CmsError("plugin storage: the value is not JSON", "invalid_input");
	}
	if (text === undefined) throw new CmsError("plugin storage: the value is not JSON", "invalid_input");
	return text;
}

/** The conflict a write gets when the stored version is not the expected one (`stored` is 0 when there is no item). */
export const storageConflict = (stored: number): CmsError => new CmsError("Conflict", "conflict", stored);

export const storageNotFound = (): CmsError => new CmsError("Not found", "not_found");
