import type { Cms } from "../cms";
import type { AfterCommit, ContentEvent } from "../core/store";
import type { StoredDocument } from "../doc/stored-document";
import type { PluginContext } from "../plugin/context";
import type { Collection, Issue, PreparedSnapshot } from "./types";

/**
 * Write hooks. The server config (`hooks` of `monti.config.ts`) and plugins (`ServerPlugin.hooks`) register them with the same shape: a list per stage.
 * There are two kinds, and they behave differently:
 *
 * - **Checks before the save** (`transform`, `validate`, `validatePublish`) run inside the request, one after another, and can change or block the write.
 *   A check that throws fails the write with `hook_failed` (naming its owner) and nothing is stored.
 * - **Subscribers after the save** (`afterCommit`) are notified once the change is committed. Each is its own subscriber of the event outbox, with a name,
 *   its own delivery state and its own retries; a failure is retried later and never undoes the write.
 *
 * Every content write runs the same stages (`write-pipeline.ts`):
 *
 * 1. build the input (from the request, or from the stored draft)
 * 2. `transform`: may change the data
 * 3. core preparation: normalization, reference collection, core validation. Always runs, on the transformed data.
 * 4. `validate`: may add failures and warnings
 * 5. publish (and restoring a record), `validatePublish`: may add failures and warnings
 * 6. store commit, one transaction per entry
 * 7. `afterCommit`: delivered from the outbox, at least once
 *
 * Hooks run outside the database transaction and get no database client. The order is the server config's lists first, then the plugins' in config order,
 * and within a list the order it is written in.
 */

/**
 * What a write does. A bulk change to metadata or folder is a `save`, a bulk publish is a `publish`. `restore` is a trashed record coming back
 * (it is published again, with its content unchanged): `validate` and `validatePublish` run for it, `transform` does not.
 */
export type WriteOperation = "create" | "save" | "publish" | "duplicate" | "translate" | "restore";

/** What every hook of the server config gets after its own argument: the instance it runs for. */
export interface ServerScope {
	readonly cms: Cms;
}

/** What every server callback of a plugin gets: the instance, and the plugin's own context (storage, secrets, key slots, cache). */
export interface PluginScope extends ServerScope {
	readonly plugin: PluginContext;
}

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
export type TransformHook<S extends ServerScope = ServerScope> = (
	context: WriteHookContext,
	scope: S,
) => WriteData | undefined | Promise<WriteData | undefined>;

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
export type ValidateHook<S extends ServerScope = ServerScope> = (
	context: ValidationHookContext,
	scope: S,
) => ValidationResult | undefined | Promise<ValidationResult | undefined>;

/** Runs after core preparation, for a publish (single and bulk) and for restoring a record, which publishes it again. */
export type ValidatePublishHook<S extends ServerScope = ServerScope> = ValidateHook<S>;

/**
 * The `afterCommit` hook: a notification after a change is committed, with the scope it runs in (the instance, and for a plugin its own context), so a hook reads
 * its storage, the store or the site without state of its own.
 */
export type AfterCommitHook<S extends ServerScope = ServerScope> = (
	event: ContentEvent,
	scope: S,
) => ReturnType<AfterCommit>;

/**
 * One subscriber after the save: a `name` and the function the outbox delivers each committed change to. The name keys its delivery state
 * (`<owner>:<name>`, e.g. `plugin:git-sync:sync`), so keep it stable: renaming it starts the subscriber over on the changes that are still undelivered.
 * Lowercase letters, digits and `-`, unique within its owner.
 */
export interface AfterCommitSubscriber<S extends ServerScope = ServerScope> {
	readonly name: string;
	readonly run: AfterCommitHook<S>;
}

/**
 * The write hooks of one owner, a list per stage. Every hook gets its own argument, then the scope: `{ cms }` for the server config's hooks,
 * `{ cms, plugin }` for a plugin's (`WriteHooks<PluginScope>`).
 */
export interface WriteHooks<S extends ServerScope = ServerScope> {
	/** Check before the save: changes the data, in order. */
	readonly transform?: readonly TransformHook<S>[];
	/** Check before the save: adds failures (which block the write) and warnings, for every write. */
	readonly validate?: readonly ValidateHook<S>[];
	/** Check before the save: adds failures and warnings, for a publish and for restoring a record. */
	readonly validatePublish?: readonly ValidatePublishHook<S>[];
	/**
	 * Subscribers after the save (create, save, publish, archive, trash, restore, delete): each is delivered every committed change on its own, retried when it
	 * fails. The change stands whatever they do.
	 */
	readonly afterCommit?: readonly AfterCommitSubscriber<S>[];
}

/** One check before the save with its scope given, as the write pipeline calls it. */
export interface BoundHooks {
	readonly transform?: (context: WriteHookContext) => ReturnType<TransformHook>;
	readonly validate?: (context: ValidationHookContext) => ReturnType<ValidateHook>;
	readonly validatePublish?: (context: ValidationHookContext) => ReturnType<ValidateHook>;
}

/** A check before the save with the owner that registered it: `server` for the server config, `plugin:<name>` for a plugin. */
export interface HookSource {
	readonly owner: string;
	readonly hooks: BoundHooks;
}

/**
 * The checks before the save of one owner, one source per hook in the order they run (all its `transform`s, then its `validate`s, then its
 * `validatePublish`es; the pipeline picks a stage at a time). Each gets its scope when it runs, so a development schema reload is seen.
 */
export function checkSources<S extends ServerScope>(owner: string, hooks: WriteHooks<S>, scope: () => S): HookSource[] {
	return [
		...(hooks.transform ?? []).map((hook) => ({
			owner,
			hooks: { transform: (context: WriteHookContext) => hook(context, scope()) },
		})),
		...(hooks.validate ?? []).map((hook) => ({
			owner,
			hooks: { validate: (context: ValidationHookContext) => hook(context, scope()) },
		})),
		...(hooks.validatePublish ?? []).map((hook) => ({
			owner,
			hooks: { validatePublish: (context: ValidationHookContext) => hook(context, scope()) },
		})),
	];
}

const SUBSCRIBER_NAME = /^[a-z][a-z0-9-]*$/;

/** The outbox key of a subscriber after the save: its owner and its name. */
export const subscriberKey = (owner: string, name: string): string => `${owner}:${name}`;

/**
 * The subscribers after the save of one owner, keyed `<owner>:<name>`, each with its scope given when it runs. Throws when a name is not valid or
 * is used twice by the owner.
 */
export function afterCommitSubscribers<S extends ServerScope>(
	owner: string,
	hooks: WriteHooks<S>,
	scope: () => S,
): { readonly name: string; readonly handler: (event: ContentEvent) => ReturnType<AfterCommit> }[] {
	const seen = new Set<string>();
	return (hooks.afterCommit ?? []).map(({ name, run }) => {
		if (!SUBSCRIBER_NAME.test(name)) {
			throw new Error(
				`afterCommit of ${owner}: "${name}" is not a valid subscriber name. Use lowercase letters, digits and "-", starting with a letter.`,
			);
		}
		if (seen.has(name)) {
			throw new Error(
				`afterCommit of ${owner}: the subscriber name "${name}" is used twice. Give each subscriber its own name.`,
			);
		}
		seen.add(name);
		return { name: subscriberKey(owner, name), handler: (event: ContentEvent) => run(event, scope()) };
	});
}

/** Hooks in the order they run. May be read on every write, so it should return a cached list. */
export type HookProvider = () => readonly HookSource[] | Promise<readonly HookSource[]>;
