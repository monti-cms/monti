import type { z } from "zod";
import type { AuthContext } from "../adapters/auth";
import type { Cms } from "../cms";
import type { Site } from "../site";

/**
 * What an operation does to the site, which decides how the agent may call it (docs/design/agent.md §3):
 * - `read` returns data and changes nothing; the agent calls it freely.
 * - `write` changes the site. The agent never runs it: it only plans the change, which becomes an item of a proposal the admin reviews; applying runs it.
 */
export type OperationKind = "read" | "write";

/** What an operation's `run` gets besides its input: the instance, who is signed in, and a signal that stops a long run. */
export interface OperationContext {
	readonly cms: Cms;
	/** The admin the operation runs as. The runner has already recorded them as the actor of the changes it makes. */
	readonly auth: AuthContext;
	readonly signal?: AbortSignal;
}

/** A name like `entries.list` or `entries.checkPublish`: two or more dotted segments, each starting with a lowercase letter. */
export const OPERATION_NAME = /^[a-z][A-Za-z0-9]*(\.[a-z][A-Za-z0-9]*)+$/;

/** What `defineOperation` takes for a read. */
export interface OperationDefinition<Schema extends z.ZodType, Result> {
	/** Dotted, lowercase-first segments: `<area>.<verb>` (`entries.list`). Unique across the core and every plugin. */
	readonly name: string;
	readonly kind: "read";
	/** For the model: what the operation does, what it returns and when to use it. English, plain and short. The admin screens never show it. */
	readonly describe: string;
	/**
	 * The input schema, made for one site (it can name that site's collections and locales, like `site.api.listEntriesQuerySchema`). It must convert with
	 * `z.toJSONSchema(schema, { io: "input" })`, because the model is given its JSON Schema. The parsed value is what `run` gets.
	 */
	readonly input: (site: Site) => Schema;
	/** The work. Returns a JSON-serialisable result; a failure throws a `CmsError`, which the route turns into its error answer and the agent reads as text. */
	readonly run: (input: z.output<Schema>, context: OperationContext) => Promise<Result> | Result;
}

/** What a write is about: an entry, a media file, a folder. `spot` narrows it inside the target (a field name), so two changes of one entry are told apart. */
export interface WriteTarget {
	readonly kind: "entry" | "media" | "folder";
	readonly id: string;
	readonly spot?: string;
}

/**
 * One change a write operation would make, worked out without making it. The agent's proposal stores it as an item; the review screen and the editor draw it
 * from `preview`; applying hands it back to `apply`. Everything in it is JSON.
 */
export interface WritePlan {
	readonly target: WriteTarget;
	/** The value the target has now and the value it would get (a field's value, a folder id, `"trash"`). */
	readonly preview: { readonly before: unknown; readonly after: unknown };
	/**
	 * Where the target stands now (an entry's version, as text). Applying refuses a target whose base moved since, and undoing leaves alone a target that changed
	 * after it was applied, so a person's later edit is never overwritten.
	 */
	readonly base: string;
	/** What `apply` needs, in the operation's own terms. */
	readonly change: unknown;
}

/** What applying one planned change leaves: the target's base right after the change, and what reverting it needs. */
export interface WriteApplied {
	readonly base: string;
	readonly undo: unknown;
}

/** What `defineOperation` takes for a write. */
export interface WriteOperationDefinition<Schema extends z.ZodType> {
	readonly name: string;
	readonly kind: "write";
	/** For the model: what the change does and when to use it. English, plain and short. */
	readonly describe: string;
	readonly input: (site: Site) => Schema;
	/**
	 * Works out the changes, one per target, with the checks a save from the screen makes, and changes nothing. An input that cannot be done throws a `CmsError`
	 * the model reads.
	 */
	readonly plan: (input: z.output<Schema>, context: OperationContext) => Promise<readonly WritePlan[]>;
	/** Makes one planned change. A target whose base moved since the plan throws a `CmsError` with the code `conflict`. */
	readonly apply: (plan: WritePlan, context: OperationContext) => Promise<WriteApplied>;
	/** Undoes one applied change with what `apply` returned. */
	readonly revert: (plan: WritePlan, undo: unknown, context: OperationContext) => Promise<void>;
	/** Where the target stands now (the same measure as `WritePlan.base`), or `null` when it no longer exists. */
	readonly baseOf: (target: WriteTarget, context: OperationContext) => Promise<string | null>;
}

/** A read operation. Made by {@link defineOperation}. */
export interface ReadOperation<Schema extends z.ZodType = z.ZodType, Result = unknown> {
	readonly name: string;
	readonly kind: "read";
	readonly describe: string;
	readonly input: (site: Site) => Schema;
	readonly run: (input: z.output<Schema>, context: OperationContext) => Promise<Result> | Result;
}

/** A write operation. Made by {@link defineOperation}. */
export interface WriteOperation<Schema extends z.ZodType = z.ZodType> extends WriteOperationDefinition<Schema> {}

/** An operation. Made by {@link defineOperation}. */
export type Operation<Schema extends z.ZodType = z.ZodType, Result = unknown> =
	| ReadOperation<Schema, Result>
	| WriteOperation<Schema>;

/** An operation of any input and result, for lists of them. */
// biome-ignore lint/suspicious/noExplicitAny: a list holds operations of every input and result
export type AnyOperation = ReadOperation<any, any> | WriteOperation<any>;

/**
 * Defines one capability of the admin once. The HTTP route and the agent's tool are both made from it, so they cannot drift:
 *
 * ```ts
 * export const listFolders = defineOperation({
 *   name: "folders.list",
 *   kind: "read",
 *   describe: "The folder tree of one collection.",
 *   input: (site) => z.object({ collection: site.api.folderCollectionSchema }),
 *   run: ({ collection }, { cms }) => cms.store().listFolders({ collection }),
 * });
 * ```
 *
 * Core lists its operations next to its services; a plugin adds its own with `defineServerPlugin({ operations })`. Server only (`@monti-cms/core/server`).
 */
export function defineOperation<const Schema extends z.ZodType, Result>(
	definition: OperationDefinition<Schema, Result>,
): ReadOperation<Schema, Result>;
export function defineOperation<const Schema extends z.ZodType>(
	definition: WriteOperationDefinition<Schema>,
): WriteOperation<Schema>;
export function defineOperation<const Schema extends z.ZodType, Result>(
	definition: OperationDefinition<Schema, Result> | WriteOperationDefinition<Schema>,
): AnyOperation {
	if (!OPERATION_NAME.test(definition.name)) {
		throw new Error(
			`cms operation: invalid name "${definition.name}" (dotted segments that start with a lowercase letter, like "entries.list")`,
		);
	}
	if (!definition.describe.trim()) throw new Error(`cms operation "${definition.name}": describe is empty`);
	return definition;
}
