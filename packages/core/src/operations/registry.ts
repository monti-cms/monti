import { z } from "zod";
import type { AuthContext } from "../adapters/auth";
import type { Cms } from "../cms";
import { actorOf, withActor } from "../core/actor";
import { CmsError } from "../core/store/errors";
import { assertOperationNamesFree } from "../plugin/collisions";
import type { ServerPlugin } from "../plugin/define";
import type { Site } from "../site";
import type { AnyOperation, OperationKind } from "./define";
import { CORE_OPERATIONS } from "./index";

/** An operation of this instance, ready to hand to the agent: its input schema is made for the site, and its JSON Schema is what the model reads. */
export interface OperationInfo {
	readonly name: string;
	readonly kind: OperationKind;
	readonly describe: string;
	/** The plugin that added it, or `null` for a core operation. */
	readonly plugin: string | null;
	/** The input schema for this site. */
	readonly input: z.ZodType;
	/** `input` as JSON Schema (the side a caller sends). */
	readonly jsonSchema: z.core.JSONSchema.BaseSchema;
}

/** What {@link OperationRunner.run} takes besides the name and the input. */
export interface RunOperationOptions {
	/** The admin to run as. The caller has verified them. */
	readonly auth: AuthContext;
	readonly signal?: AbortSignal;
	/** The message of the `invalid_input` error when the input does not fit the schema. Default `Invalid input`. A route keeps the message it has always answered with. */
	readonly invalidMessage?: string;
}

/** The operations of one instance. */
export interface OperationRunner {
	/** Every operation: the core's, then the plugins' in the order of the site config. A name used twice fails here (a config error), and the failure is not remembered. */
	list(): Promise<readonly OperationInfo[]>;
	/**
	 * Runs the named operation as the given admin: parses `input` with the operation's schema (`invalid_input` with the issues when it does not fit), then runs it
	 * with the admin as the actor of the changes it makes. An unknown name is `not_found`.
	 */
	run(name: string, input: unknown, options: RunOperationOptions): Promise<unknown>;
}

/** `schema` as the JSON Schema a caller writes (`io: "input"`: a field the parse transforms is described by what is sent, not what comes out). */
export const inputJsonSchema = (schema: z.ZodType): z.core.JSONSchema.BaseSchema =>
	z.toJSONSchema(schema, { io: "input" });

/**
 * The operations of an instance: core's and those of the loaded plugins (`ServerPlugin.operations`). `cms` is the instance that owns them; `plugins`
 * loads the server side of the site's plugins.
 */
export function createOperations(parts: {
	readonly site: Site;
	readonly cms: () => Cms;
	readonly plugins: () => Promise<readonly (ServerPlugin & { readonly name: string })[]>;
}): OperationRunner {
	let listed: Promise<readonly (OperationInfo & { readonly operation: AnyOperation })[]> | undefined;

	const build = async () => {
		const owned = [
			...CORE_OPERATIONS.map((operation) => ({ plugin: null, operation })),
			...(await parts.plugins()).flatMap((plugin) =>
				(plugin.operations ?? []).map((operation) => ({ plugin: plugin.name, operation })),
			),
		];
		assertOperationNamesFree(owned.map(({ plugin, operation }) => ({ plugin, name: operation.name })));
		return owned.map(({ plugin, operation }) => {
			const input = operation.input(parts.site);
			return {
				name: operation.name,
				kind: operation.kind,
				describe: operation.describe,
				plugin,
				input,
				jsonSchema: inputJsonSchema(input),
				operation,
			};
		});
	};

	const list = () => {
		listed ??= build().catch((error) => {
			listed = undefined;
			throw error;
		});
		return listed;
	};

	return {
		list: async () => (await list()).map(({ operation: _operation, ...info }) => info),
		run: async (name, input, { auth, signal, invalidMessage }) => {
			const found = (await list()).find((candidate) => candidate.name === name);
			if (!found) throw new CmsError(`Unknown operation "${name}"`, "not_found");
			const parsed = found.input.safeParse(input);
			if (!parsed.success) {
				throw new CmsError(invalidMessage ?? "Invalid input", "invalid_input", { issues: parsed.error.issues });
			}
			return withActor(actorOf(auth), () =>
				found.operation.run(parsed.data, { cms: parts.cms(), auth, ...(signal ? { signal } : {}) }),
			);
		},
	};
}
