import type { Cms } from "../cms";
import type { AfterCommit, ContentEvent } from "../core/store";
import type { StoredDocument } from "../doc/stored-document";
import type { Collection, Issue, PreparedSnapshot } from "./types";

/**
 * Write hooks. The server config (`hooks` of `cms.server.ts`) and plugins (`CmsServerPlugin.hooks`) register them with the same shape.
 * Every content write runs the same stages (`write-pipeline.ts`):
 *
 * 1. build the input (from the request, or from the stored draft)
 * 2. `transform`: may change the data
 * 3. core preparation: normalization, reference collection, core validation. Always runs, on the transformed data.
 * 4. `validate`: may add failures and warnings
 * 5. publish (and restoring a record), `validatePublish`: may add failures and warnings
 * 6. store commit, one transaction per entry
 * 7. `afterCommit`: a failure is logged and never undoes the committed write
 *
 * Hooks run outside the database transaction and get no database client. The server config's hooks run first, then the plugins' in config order.
 * A hook that throws fails the write with `hook_failed` (naming its owner) and nothing is stored.
 */

/**
 * What a write does. A bulk change to metadata or folder is a `save`, a bulk publish is a `publish`. `restore` is a trashed record coming back
 * (it is published again, with its content unchanged): `validate` and `validatePublish` run for it, `transform` does not.
 */
export type WriteOperation = "create" | "save" | "publish" | "duplicate" | "translate" | "restore";

/** Read-only context every hook gets. The data is a copy: changing it does not change the write unless a `transform` returns it. */
export interface WriteHookContext {
	readonly operation: WriteOperation;
	readonly collection: Collection;
	/** The entry being changed. Absent while the entry is being created (`create`, `duplicate`, `translate`). */
	readonly entryId?: string;
	/** Content locale of the entry. */
	readonly locale: string;
	/** The address (slug) the write gives the entry, `null` when it gives none. A `transform` can change it (`WriteData.slug`). */
	readonly slug: string | null;
	readonly metadata: { readonly [key: string]: unknown };
	/** The body as a stored document (one `unparsed` node when the body could not become a document, which only a draft can be). */
	readonly doc: StoredDocument;
}

/** The data a `transform` receives and returns. */
export interface WriteData {
	readonly metadata: { readonly [key: string]: unknown };
	readonly doc: StoredDocument;
	/** The address of the entry. Leave it out of a `transform`'s result to keep it; return a string to change it (core still checks and normalises it). */
	readonly slug?: string | null;
}

/**
 * Runs before core preparation. Returns the data to prepare, or nothing to keep it as it is. The result still goes through normalization,
 * reference collection and validation, so a transform cannot get anything past core checks.
 */
export type TransformHook = (context: WriteHookContext) => WriteData | undefined | Promise<WriteData | undefined>;

/** The context of `validate` and `validatePublish`: the data as prepared, and the prepared snapshot (a copy). */
export interface ValidationHookContext extends WriteHookContext {
	readonly snapshot: PreparedSnapshot;
}

/** What validation adds. It can only add: the core issues and warnings always stay. */
export interface ValidationResult {
	/** Failures. Any of them blocks the write (`validation_failed`, or `publish_validation_failed` for `validatePublish`). */
	readonly issues?: readonly Issue[];
	/** Notices that do not block. They come back with the write's result. */
	readonly warnings?: readonly Issue[];
}

/** Runs after core preparation, for every write. */
export type ValidateHook = (
	context: ValidationHookContext,
) => ValidationResult | undefined | Promise<ValidationResult | undefined>;

/** Runs after core preparation, for a publish (single and bulk) and for restoring a record, which publishes it again. */
export type ValidatePublishHook = ValidateHook;

/**
 * The `afterCommit` hook: a notification after a change is committed, with the instance it runs for (so a hook reads its storage, the store or the site
 * without state of its own). The server config and the plugins take the same function.
 */
export type AfterCommitHook = (event: ContentEvent, cms: Cms) => ReturnType<AfterCommit>;

export interface WriteHooks {
	readonly transform?: TransformHook;
	readonly validate?: ValidateHook;
	readonly validatePublish?: ValidatePublishHook;
	/** After the transaction commits (create, save, publish, archive, trash, restore, delete). The change stands even if it fails. */
	readonly afterCommit?: AfterCommitHook;
}

/** Hooks with the owner that registered them: `server` for the server config, `plugin:<name>` for a plugin. */
export interface HookSource {
	readonly owner: string;
	readonly hooks: WriteHooks;
}

/** Hooks in the order they run. May be read on every write, so it should return a cached list. */
export type HookProvider = () => readonly HookSource[] | Promise<readonly HookSource[]>;
