import { type MediaUrlResolver } from "../core/import-normalize.js";
import { type LinkResolver } from "../core/link-ids.js";
import { prepareSnapshot } from "../core/snapshot.js";
import { type FormatRegistry } from "../format/registry.js";
import type { Site } from "../site/index.js";
import type { HookProvider, WriteOperation } from "./hooks.js";
import { type Issue, type PreparedSnapshot, type ServiceInput, type StorePort } from "./types.js";
/**
 * The one place content is prepared for a write. Create, save, publish (single and bulk), duplicate, translation and bulk metadata or folder
 * changes all build their input and call `run`, so a rule or hook added here applies to every one of them. The store never prepares content.
 *
 * Stages: `transform` hooks, core preparation (`prepareSnapshot`, always on the transformed data), the `validate` of each block
 * (warnings only), `validate` hooks, and for a publish
 * `validatePublish` hooks. The store commit and `afterCommit` come after, in the caller and the store.
 */
type PrepareOptions = Omit<NonNullable<Parameters<typeof prepareSnapshot>[2]>, "import" | "imported">;
export interface WriteRequest {
    readonly operation: WriteOperation;
    /** The entry being changed. Absent while it is being created. */
    readonly entryId?: string;
    /** Content locale of the entry. */
    readonly locale: string;
    /** The input as it came in (a request, or built from the stored draft). Its shape is checked by core preparation. */
    readonly input: ServiceInput;
    /** What the write replaces: references, document (block ids carry over) and metadata (kept keys the schema no longer has) of the current draft. */
    readonly prepare?: PrepareOptions;
    /**
     * Do not run `transform` hooks. For a change that publishes a draft without changing it (restoring a record): validation still runs,
     * so a restriction on publishing cannot be bypassed.
     */
    readonly skipTransform?: boolean;
}
export interface WriteResult {
    /** Core preparation of the (transformed) input. */
    readonly snapshot: PreparedSnapshot;
    /** Warnings: a text body that could not be read (it is kept as an `unparsed` body), the blocks' own `validate`, and the `validate` and `validatePublish` hooks. */
    readonly warnings: readonly Issue[];
    /** Whether a `transform` hook changed the data. */
    readonly transformed: boolean;
}
export interface WritePipelineOptions {
    /** The site the writes are for: its collections, blocks and links decide how a body and its metadata are checked. */
    readonly site: Site;
    readonly hooks?: HookProvider;
    /** The formats a body given as text can be in. Without it, only the built-in ones. */
    readonly formats?: () => Promise<FormatRegistry>;
    /** Looks up the entries internal links point to. Without it, links keep the address they were written with. */
    readonly links?: LinkResolver;
    /** Looks up the registered media files image URLs point to. Without it, images keep the URL they were written with. */
    readonly media?: MediaUrlResolver;
}
/** The link resolver of a store, when it can look up addresses. */
export declare const linkResolverOf: (site: Site, store: Pick<StorePort, "resolveLinkTargets">) => LinkResolver | undefined;
export declare function createWritePipeline(options: WritePipelineOptions): {
    /**
     * Prepares a write. Throws a `ServiceError` when core preparation rejects the input, when a hook fails (`hook_failed`) or when a
     * hook's validation adds failures (`validation_failed`, `publish_validation_failed`). Nothing is stored here.
     */
    run: (request: WriteRequest) => Promise<WriteResult>;
};
export type WritePipeline = ReturnType<typeof createWritePipeline>;
export {};
