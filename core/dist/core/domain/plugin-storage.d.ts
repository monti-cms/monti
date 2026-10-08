import { CmsError } from "../store/errors.js";
/** Plugin and collection names are lowercase words (`ai`, `action-overrides`): they end up in table rows and migration records, and never need quoting. */
export declare function assertStorageName(kind: "plugin" | "collection", name: string): void;
/** Names of migration steps (`once`): lowercase words that may also use `_`, like `import_legacy_tables`. */
export declare function assertMigrationName(name: string): void;
/** A key is any non-empty text. */
export declare function assertStorageKey(key: string): void;
/** What a stored version number may be: a positive integer (1 is the first write). */
export declare function assertStoredVersion(version: number): void;
/** `expectedVersion`: 0 to create, otherwise a version that was read before. */
export declare function assertExpectedVersionNumber(version: number): void;
/** A value as stored: JSON text. Anything JSON cannot hold (`undefined`, functions, circular references) is rejected with `invalid_input`. */
export declare function serializeStorageValue(value: unknown): string;
/** The conflict a write gets when the stored version is not the expected one (`stored` is 0 when there is no item). */
export declare const storageConflict: (stored: number) => CmsError;
export declare const storageNotFound: () => CmsError;
