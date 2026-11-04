import type { Kysely, Transaction } from "kysely";
import type { z } from "zod";
import type { Database } from "./db/schema";
import type { Site } from "./site";

/**
 * Who called an operation. The admin screen and the CLI run writes at once; the assistant's writes become proposal items, and when the admin applies
 * them they run with the actor `assistant`, so the activity log tells the two apart.
 */
export type Actor = "admin" | "assistant" | "cli" | { plugin: string };

/**
 * - `read`: reads; anyone runs it at once.
 * - `write`: changes data; the assistant only proposes it.
 * - `screen`: moves the admin screen (filter a list, open an entry). The browser runs it; the server never does, and no data changes.
 */
export type OperationKind = "read" | "write" | "screen";

/** A record an operation reads or writes, named by its record kind (`defineRecordKind`) and id. */
export type RecordRef = { kind: string; id: string };

/** The key of a record in a version map: `"entry:abc"`. */
export const recordKey = (ref: RecordRef) => `${ref.kind}:${ref.id}`;

/**
 * A message the screen shows in the admin's language: a dictionary key and its values. The activity log keeps it as data, so changing the admin
 * language changes the old rows too.
 */
export type Message = { key: string; values?: Record<string, string | number> };

/** Something that happened to the site, sent to every receiver (webhooks, plugins) after the write that caused it commits. */
export type MontiEvent = {
	type: string;
	ids: string[];
	collection?: string;
	locale?: string;
	version?: number;
	/** Public paths the change affects, for the site's cache. */
	paths?: string[];
};

/** What an operation gets besides its input. */
export interface OperationContext {
	/** The database; inside a write, the write's transaction. */
	db: Kysely<Database> | Transaction<Database>;
	actor: Actor;
	/** Queues an event. It is stored in the write's transaction and sent only after the write commits. */
	emit(event: MontiEvent): void;
	/** Marks a record the write creates, so undoing the write removes it. */
	created(ref: RecordRef): void;
	/** The site's schema and, on the dev server, the way to its files. */
	site: Site;
	/** The engine's clock (tests set it). */
	now(): Date;
}

/** What a write would change, without writing it. */
export type Preview = {
	/** One line for the proposal card: "9 posts · move to folder". */
	summary: Message;
	/** Records that would change. */
	changes: RecordRef[];
	/** Records that would be left alone, with why. */
	blocked?: { ref: RecordRef; reason: Message }[];
};

type Awaitable<T> = T | Promise<T>;

export type OperationDefinition<Input, Output> = {
	/** `<area>.<verb>`, as the feature docs name it: `entries.publish`. */
	name: string;
	kind: OperationKind;
	/** Only a person may run it (permanent delete, emptying the trash). It is never an agent tool. */
	humanOnly?: boolean;
	/**
	 * It writes structure values (`monti.schema.ts`), so it runs only on the dev server: on the live site no entry point offers it. It has no undo; a
	 * structure change is reversed by a new change (doc 00).
	 */
	structure?: boolean;
	/** For the model. The admin never sees it. */
	description: string;
	input: z.ZodType<Input>;
	/** The records the write will change, read before it runs: the engine compares their versions and keeps their snapshots for undo. */
	touches?: (input: Input, ctx: OperationContext) => Awaitable<RecordRef[]>;
	/** Refuses the write before it runs (throw `CheckError`). */
	check?: (input: Input, ctx: OperationContext) => Awaitable<void>;
	/** What the write would change. The agent reads it before proposing, and the proposal card shows it. */
	preview?: (input: Input, ctx: OperationContext) => Awaitable<Preview>;
	run: (input: Input, ctx: OperationContext) => Awaitable<Output>;
	/** One line for the activity log. Every write has one. */
	summary?: (input: Input, output: Output) => Message;
};

export type Operation<Input = unknown, Output = unknown> = OperationDefinition<Input, Output> & {
	readonly __operation: true;
};

// biome-ignore lint/suspicious/noExplicitAny: a list of operations holds every input and output type.
export type AnyOperation = Operation<any, any>;

const NAME = /^[a-z][a-zA-Z]*(\.[a-z][a-zA-Z]*)+$/;

/**
 * Defines one thing Monti can do. One definition gives the admin API route, the agent tool and the CLI command, with the same input check, so no
 * entry point has a way around another's rules.
 */
export function defineOperation<Input, Output>(
	definition: OperationDefinition<Input, Output>,
): Operation<Input, Output> {
	if (!NAME.test(definition.name))
		throw new Error(`Operation name "${definition.name}" is not "<area>.<verb>" in camel case.`);
	if (definition.kind === "write" && definition.summary === undefined)
		throw new Error(`Write operation "${definition.name}" has no summary for the activity log.`);
	if (
		definition.kind !== "write" &&
		(definition.touches || definition.preview || definition.humanOnly || definition.structure)
	)
		throw new Error(
			`Operation "${definition.name}" is not a write, so it has no touches, preview, humanOnly or structure.`,
		);
	return { ...definition, __operation: true };
}
