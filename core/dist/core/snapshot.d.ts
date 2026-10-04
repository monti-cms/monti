import { type Collection, type Issue, type JsonValue, type PreparedSnapshot, type Reference, type ResolvedTargets, type ServiceInput } from "./types.js";
/**
 * Snapshot preparation and publish validation. Pure rules; knows nothing about the DB or HTTP.
 * The service (draft save) and the repository implementation (re-validation inside the publish transaction) use the same rules.
 */
export declare const MAX_MDX_BYTES: number;
export declare const MAX_METADATA_BYTES: number;
/** Content hash of a snapshot. The same metadata and body give the same value regardless of key order. */
export declare function computeContentHash(metadata: JsonValue, mdx: string, schemaVersion?: number): string;
/** Is this a plain object with exactly the allowed keys? Getters and inherited properties are rejected. */
export declare function validateExactRecord(value: unknown, expectedKeys: readonly string[]): asserts value is Record<string, unknown>;
export declare const SERVICE_INPUT_KEYS: readonly string[];
export declare function prepareSnapshot(input: ServiceInput, options?: {
    schemaVersion?: number;
    previousReferences?: readonly Reference[];
}): Promise<PreparedSnapshot>;
/**
 * Collects only the image warnings to include in the publish response. **Non-blocking**; if computation fails it returns an empty array.
 *
 * For media that is `ready` with a `storageKey`, if `headStorageKey` is provided, the actual object in storage is checked once more.
 * If it is missing, an `image_media_missing_in_storage` warning is added. On an infrastructure error it falls back to the DB decision.
 */
export declare function imageWarningsForPublish(input: {
    collection: Collection;
    slug: string | null;
    metadata: {
        readonly [key: string]: unknown;
    };
    mdx: string;
    getMediaAsset: (id: string) => Promise<{
        status?: string;
        storageKey?: string | null;
    } | null>;
    headStorageKey?: (storageKey: string) => Promise<boolean>;
}): Promise<Issue[]>;
export declare function validateForPublish(snapshot: PreparedSnapshot, resolved: ResolvedTargets): {
    ready: boolean;
    issues: Issue[];
    warnings: Issue[];
};
