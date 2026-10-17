import type { Cms } from "../cms";
import type { AfterCommit, ContentChangeKind, ContentEvent } from "../core/store";
import type { StoredDocument } from "../doc/stored-document";
import type { PluginContext } from "../plugin/context";
import type { Collection, Issue, PreparedSnapshot } from "./types";

/**
 * What a plugin (or the server config) reacts to: `on: { <target>: { <event>: [subscribers] } }`, the same shape in `defineConfig({ on })` and in
 * `defineServerPlugin({ on })`. An event name says what kind it is:
 *
 * - **`before…`** events run inside the action, before it happens, one after another, and are the only ones that may change or block it
 *   (`entry.beforeValidate` changes the data, `entry.beforeSave` and `entry.beforePublish` add failures and warnings). A subscriber that throws
 *   fails the write with `hook_failed` (naming its owner) and nothing is stored.
 * - **Past-tense** events (`entry.published`, `keySlot.changed`) are notifications after the fact and never block or undo anything. The entry ones are
 *   **durable**: each `{ name, run }` is its own subscriber of the event outbox, with its own delivery state and retries, and a failure is retried later.
 *   `keySlot.changed` is immediate: a plain function, run once, and a failure is logged.
 *
 * Every content write runs the same stages (`write-pipeline.ts`):
 *
 * 1. build the input (from the request, or from the stored draft)
 * 2. `entry.beforeValidate`: may change the data
 * 3. core preparation: normalization, reference collection, core validation. Always runs, on the changed data.
 * 4. `entry.beforeSave`: may add failures and warnings
 * 5. publish (and restoring a record), `entry.beforePublish`: may add failures and warnings
 * 6. store commit, one transaction per entry
 * 7. the durable entry events (`created`, `saved`, `published`, ..., `changed`): delivered from the outbox, at least once
 *
 * Subscribers run outside the database transaction and get no database client. The order is the server config's lists first, then the plugins' in
 * config order, and within a list the order it is written in.
 */

/**
 * What a write does. A bulk change to metadata or folder is a `save`, a bulk publish is a `publish`. `restore` is a trashed record coming back
 * (it is published again, with its content unchanged): `beforeSave` and `beforePublish` run for it, `beforeValidate` does not.
 */
export type WriteOperation = "create" | "save" | "publish" | "duplicate" | "translate" | "restore";

/** What every subscriber of the server config gets after its own argument: the instance it runs for. */
export interface ServerScope {
	readonly cms: Cms;
}

/** What every server callback of a plugin gets: the instance, and the plugin's own context (storage, secrets, key slots, cache). */
export interface PluginScope extends ServerScope {
	readonly plugin: PluginContext;
}

/** Read-only context every entry write subscriber gets. The data is a copy: changing it does not change the write unless a `beforeValidate` returns it. */
export interface WriteHookContext {
	readonly operation: WriteOperation;
	readonly collection: Collection;
	/** The entry being changed. Absent while the entry is being created (`create`, `duplicate`, `translate`). */
	readonly entryId?: string;
	/** Content locale of the entry. */
	readonly locale: string;
	/** The address (slug) the write gives the entry, `null` when it gives none. A `beforeValidate` can change it (`WriteData.slug`). */
	readonly slug: string | null;
	readonly metadata: { readonly [key: string]: unknown };
	/** The body as a stored document (one `unparsed` node when the body could not become a document, which only a draft can be). */
	readonly doc: StoredDocument;
}

/** The data a `beforeValidate` receives and returns. */
export interface WriteData {
	readonly metadata: { readonly [key: string]: unknown };
	readonly doc: StoredDocument;
	/** The address of the entry. Leave it out of a `beforeValidate`'s result to keep it; return a string to change it (core still checks and normalises it). */
	readonly slug?: string | null;
}

/**
 * `entry.beforeValidate`: runs before core preparation. Returns the data to prepare, or nothing to keep it as it is. The result still goes through normalization,
 * reference collection and validation, so it cannot get anything past core checks.
 */
export type BeforeValidate<S extends ServerScope = ServerScope> = (
	context: WriteHookContext,
	scope: S,
) => WriteData | undefined | Promise<WriteData | undefined>;

/** The context of `beforeSave` and `beforePublish`: the data as prepared, and the prepared snapshot (a copy). */
export interface ValidationHookContext extends WriteHookContext {
	readonly snapshot: PreparedSnapshot;
}

/** What validation adds. It can only add: the core issues and warnings always stay. */
export interface ValidationResult {
	/** Failures. Any of them blocks the write (`validation_failed`, or `publish_validation_failed` for `beforePublish`). */
	readonly issues?: readonly Issue[];
	/** Notices that do not block. They come back with the write's result. */
	readonly warnings?: readonly Issue[];
}

/** `entry.beforeSave`: runs after core preparation, for every write. May block it. */
export type BeforeSave<S extends ServerScope = ServerScope> = (
	context: ValidationHookContext,
	scope: S,
) => ValidationResult | undefined | Promise<ValidationResult | undefined>;

/** `entry.beforePublish`: runs after core preparation, for a publish (single and bulk) and for restoring a record, which publishes it again. May block it. */
export type BeforePublish<S extends ServerScope = ServerScope> = BeforeSave<S>;

/**
 * A durable entry event handler: a notification after a change is committed, with the scope it runs in (the instance, and for a plugin its own context),
 * so it reads its storage, the store or the site without state of its own.
 */
export type EntryEventHandler<S extends ServerScope = ServerScope> = (
	event: ContentEvent,
	scope: S,
) => ReturnType<AfterCommit>;

/**
 * One durable subscriber of an entry event: a `name` and the function the outbox delivers each committed change of that kind to. The name keys its
 * delivery state (`<owner>:<name>`, e.g. `plugin:git-sync:sync`), so keep it stable: renaming it starts the subscriber over on the changes that are still
 * undelivered. Lowercase letters, digits and `-`, unique within its owner (across all the lists of `entry`).
 */
export interface EntrySubscriber<S extends ServerScope = ServerScope> {
	readonly name: string;
	readonly run: EntryEventHandler<S>;
}

/** The kinds of committed change, one durable event each (`entry.created`, `entry.saved`, ...). */
export const ENTRY_CHANGE_KINDS: readonly ContentChangeKind[] = [
	"created",
	"saved",
	"published",
	"archived",
	"unarchived",
	"trashed",
	"restored",
	"deleted",
];

/** The events of the `entry` target: every content write (create, save, publish, bulk, import, the AI plugin). */
export interface EntryEvents<S extends ServerScope = ServerScope> {
	/** Before the save, may change the data: runs before core preparation, in order, and returns the data to prepare. */
	readonly beforeValidate?: readonly BeforeValidate<S>[];
	/** Before the save, may block it: adds failures (which block the write) and warnings, for every write. */
	readonly beforeSave?: readonly BeforeSave<S>[];
	/** Before the save, may block it: adds failures and warnings, for a publish and for restoring a record. */
	readonly beforePublish?: readonly BeforePublish<S>[];
	/** After the commit, durable: a draft was created (create, duplicate, translate). */
	readonly created?: readonly EntrySubscriber<S>[];
	/** After the commit, durable: a draft was saved. */
	readonly saved?: readonly EntrySubscriber<S>[];
	/** After the commit, durable: an entry was published. */
	readonly published?: readonly EntrySubscriber<S>[];
	/** After the commit, durable: an entry was archived. */
	readonly archived?: readonly EntrySubscriber<S>[];
	/** After the commit, durable: an entry was unarchived. */
	readonly unarchived?: readonly EntrySubscriber<S>[];
	/** After the commit, durable: an entry was moved to the trash. */
	readonly trashed?: readonly EntrySubscriber<S>[];
	/** After the commit, durable: an entry came back from the trash. */
	readonly restored?: readonly EntrySubscriber<S>[];
	/** After the commit, durable: an entry was deleted for good. */
	readonly deleted?: readonly EntrySubscriber<S>[];
	/** After the commit, durable: any of the changes above (`event.kind` says which). For a subscriber that wants every change. */
	readonly changed?: readonly EntrySubscriber<S>[];
}

/** The server events of one owner: the server config's `on` (`{ cms }` scope) or a plugin's. */
export interface ServerEvents<S extends ServerScope = ServerScope> {
	readonly entry?: EntryEvents<S>;
}

/** What `keySlot.changed` tells: the slot of the plugin that was assigned or cleared. */
export interface KeySlotChange {
	readonly slot: string;
}

/**
 * `keySlot.changed`: a key was assigned to a slot of this plugin or the slot was cleared, and the change is saved. Immediate and not blocking; use it for
 * work that waits for the key (a sync that was held back for lack of a token). Not called for changes made inside `cms.transaction`.
 */
export type KeySlotChanged = (event: KeySlotChange, scope: PluginScope) => Promise<void> | void;

/** The events of a plugin's server side (`defineServerPlugin({ on })`): the server ones with the plugin's scope, and `keySlot`. */
export interface PluginEvents extends ServerEvents<PluginScope> {
	readonly keySlot?: {
		readonly changed?: readonly KeySlotChanged[];
	};
}

/** One subscriber before the save with its scope given, as the write pipeline calls it. */
export interface BoundHooks {
	readonly beforeValidate?: (context: WriteHookContext) => ReturnType<BeforeValidate>;
	readonly beforeSave?: (context: ValidationHookContext) => ReturnType<BeforeSave>;
	readonly beforePublish?: (context: ValidationHookContext) => ReturnType<BeforeSave>;
}

/** A subscriber before the save with the owner that registered it: `server` for the server config, `plugin:<name>` for a plugin. */
export interface HookSource {
	readonly owner: string;
	readonly hooks: BoundHooks;
}

/**
 * The `before…` subscribers of one owner, one source per subscriber in the order they run (all its `beforeValidate`s, then its `beforeSave`s, then its
 * `beforePublish`es; the pipeline picks a stage at a time). Each gets its scope when it runs, so a development schema reload is seen.
 */
export function beforeSources<S extends ServerScope>(
	owner: string,
	events: ServerEvents<S>,
	scope: () => S,
): HookSource[] {
	const entry = events.entry;
	if (!entry) return [];
	return [
		...(entry.beforeValidate ?? []).map((hook) => ({
			owner,
			hooks: { beforeValidate: (context: WriteHookContext) => hook(context, scope()) },
		})),
		...(entry.beforeSave ?? []).map((hook) => ({
			owner,
			hooks: { beforeSave: (context: ValidationHookContext) => hook(context, scope()) },
		})),
		...(entry.beforePublish ?? []).map((hook) => ({
			owner,
			hooks: { beforePublish: (context: ValidationHookContext) => hook(context, scope()) },
		})),
	];
}

const SUBSCRIBER_NAME = /^[a-z][a-z0-9-]*$/;

/** The outbox key of a durable subscriber: its owner and its name. */
export const subscriberKey = (owner: string, name: string): string => `${owner}:${name}`;

/** One durable subscriber as the dispatcher takes it: the outbox key, the kinds of change it is delivered, and the function with its scope given. */
export interface BoundSubscriber {
	readonly name: string;
	readonly kinds: readonly ContentChangeKind[];
	readonly handler: (event: ContentEvent) => ReturnType<AfterCommit>;
}

/**
 * The durable subscribers of one owner, keyed `<owner>:<name>`, each with its scope given when it runs. A subscriber listed under a kind is delivered only
 * the changes of that kind (the outbox makes no delivery rows for the others); under `changed` it gets every kind. Throws when a name is not valid or
 * is used twice by the owner.
 */
export function entrySubscribers<S extends ServerScope>(
	owner: string,
	events: ServerEvents<S>,
	scope: () => S,
): BoundSubscriber[] {
	const entry = events.entry;
	if (!entry) return [];
	const seen = new Set<string>();
	const out: BoundSubscriber[] = [];
	const lists: [string, readonly ContentChangeKind[]][] = [
		...ENTRY_CHANGE_KINDS.map((kind): [string, readonly ContentChangeKind[]] => [kind, [kind]]),
		["changed", ENTRY_CHANGE_KINDS],
	];
	for (const [event, kinds] of lists) {
		for (const { name, run } of (entry as Record<string, readonly EntrySubscriber<S>[] | undefined>)[event] ?? []) {
			if (!SUBSCRIBER_NAME.test(name)) {
				throw new Error(
					`on.entry.${event} of ${owner}: "${name}" is not a valid subscriber name. Use lowercase letters, digits and "-", starting with a letter.`,
				);
			}
			if (seen.has(name)) {
				throw new Error(
					`on.entry of ${owner}: the subscriber name "${name}" is used twice. Give each subscriber its own name (a subscriber is delivered only the kind it is listed under).`,
				);
			}
			seen.add(name);
			out.push({ name: subscriberKey(owner, name), kinds, handler: (change: ContentEvent) => run(change, scope()) });
		}
	}
	return out;
}

/** The `before…` subscribers in the order they run. May be read on every write, so it should return a cached list. */
export type HookProvider = () => readonly HookSource[] | Promise<readonly HookSource[]>;
