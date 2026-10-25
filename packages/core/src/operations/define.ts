import type { z } from "zod";
import type { AuthContext } from "../adapters/auth";
import type { Cms } from "../cms";
import type { Site } from "../site";

/**
 * What an operation does to the site, which decides how the agent may call it:
 * - `read` returns data and changes nothing; the agent calls it freely.
 * - `write` (a change the admin reviews first), `code` (a pull request) and `editor` (a suggestion in the open entry) arrive in later phases of the admin agent.
 */
export type OperationKind = "read" | "write" | "code" | "editor";

/** What an operation's `run` gets besides its input: the instance, who is signed in, and a signal that stops a long run. */
export interface OperationContext {
	readonly cms: Cms;
	/** The admin the operation runs as. The runner has already recorded them as the actor of the changes it makes. */
	readonly auth: AuthContext;
	readonly signal?: AbortSignal;
}

/** A name like `entries.list` or `entries.checkPublish`: two or more dotted segments, each starting with a lowercase letter. */
export const OPERATION_NAME = /^[a-z][A-Za-z0-9]*(\.[a-z][A-Za-z0-9]*)+$/;

/** What `defineOperation` takes. */
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

/** An operation. Made by {@link defineOperation}. */
export interface Operation<Schema extends z.ZodType = z.ZodType, Result = unknown> {
	readonly name: string;
	readonly kind: OperationKind;
	readonly describe: string;
	readonly input: (site: Site) => Schema;
	readonly run: (input: z.output<Schema>, context: OperationContext) => Promise<Result> | Result;
}

/** An operation of any input and result, for lists of them. */
// biome-ignore lint/suspicious/noExplicitAny: a list holds operations of every input and result
export type AnyOperation = Operation<any, any>;

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
): Operation<Schema, Result> {
	if (!OPERATION_NAME.test(definition.name)) {
		throw new Error(
			`cms operation: invalid name "${definition.name}" (dotted segments that start with a lowercase letter, like "entries.list")`,
		);
	}
	if (!definition.describe.trim()) throw new Error(`cms operation "${definition.name}": describe is empty`);
	return definition;
}
