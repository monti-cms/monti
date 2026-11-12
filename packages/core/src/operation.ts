import type { Kysely, Transaction } from "kysely";
import type { z } from "zod";
import type { Session } from "./auth/session";
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
	/**
	 * More public paths moved than an event lists (`MOVED_PATHS_LIMIT`: a changed language mark on a large site): `paths` is left out, and whoever
	 * keeps the site's pages refreshes all of them.
	 */
	allPaths?: true;
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
	/**
	 * Says the write has written structure (the schema file and the change file `changeId`), for a write that does so only sometimes
	 * (`settings.save`). Such a write has no undo: a structure change is reversed by a new change (doc 00), and putting back only its admin values
	 * would leave them out of step with the structure. If the write then fails and the database rolls back, the files stay: the engine records the
	 * change as saved and not applied, so the admin offers "apply again".
	 */
	changedStructure(changeId: string): void;
	/** The site's schema and, on the dev server, the way to its files. */
	site: Site;
	/** The engine's clock (tests set it). */
	now(): Date;
	/** The signed-in admin's session, from the admin API's cookie; `null` elsewhere (the CLI, the assistant, before sign-in). */
	session: Session | null;
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

export type OperationDefinition<Input, Output, Prepared = undefined> = {
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
	/**
	 * The write changes nothing of the site: it keeps the assistant's own books (a proposal thrown away, an item left out, a conversation removed).
	 * It leaves no row in the activity log and has no undo (docs 00 and 10: what was thrown away is not in the log).
	 */
	bookkeeping?: boolean;
	/**
	 * The name of an input list whose elements the write treats one by one (`ids`). Proposed by the assistant with several, it becomes one proposal
	 * item per element, so a person takes or leaves each (doc 10: every row of the review has its own check).
	 */
	each?: string;
	/**
	 * For a write that changes only the places it names (a patch) and carries the version it read in its input: the same input at newer versions, or
	 * `null` when it cannot follow (it replaces a whole value). Applying a proposal uses it when an earlier item of the same proposal moved the
	 * record on, so two changes of one entry made from one reading both apply. Without it the later item is "changed in the meantime".
	 */
	follows?: (input: Input, versions: Record<string, number>) => Input | null;
	/**
	 * The places a write changes, as paths every operation names the same way (`entry:<id>/title`, `entry:<id>/field/<name>`, `entry:<id>/body` for
	 * a whole body, `entry:<id>/body/<block id>` for one block; see `overlap`). Two waiting items of one proposal cannot change the same place, or
	 * one a place that holds the other's, whatever operations they are: applied one after the other, the second would land on what the first left.
	 * A write that `follows` must name its places: it follows only earlier writes that named theirs.
	 */
	places?: (input: Input) => string[];
	/** It runs without a session: the sign-in operations. Only the admin API offers it, never a tool or a command (doc 15). */
	open?: boolean;
	/** For the model. The admin never sees it. */
	description: string;
	input: z.ZodType<Input>;
	/**
	 * Input fields that hold a secret (a service key). The CLI never takes one as an argument, where the shell's history and the process list would
	 * keep it: it reads it from standard input (`--secret -`).
	 */
	secretInputs?: string[];
	/**
	 * Work a write does before its transaction opens, with nothing held: asking another service (does it take this key?). It reads and asks, never
	 * writes. What it returns goes to `check` and `run`, which run inside the transaction and must make sure what `prepare` read is still so.
	 */
	prepare?: (input: Input, ctx: OperationContext) => Awaitable<Prepared>;
	/** The records the write will change, read before it runs: the engine compares their versions and keeps their snapshots for undo. */
	touches?: (input: Input, ctx: OperationContext) => Awaitable<RecordRef[]>;
	/**
	 * Records the write holds while it runs without their being its own: a structure change holds every collection's admin values, because it
	 * moves a renamed field's label with the field. They are locked and their versions compared like `touches`, so no other write works on them
	 * meanwhile; they are in the write's log and undo only when it changed them (their version moved).
	 */
	holds?: (input: Input, ctx: OperationContext) => Awaitable<RecordRef[]>;
	/** Refuses the write before it runs (throw `CheckError`). */
	check?: (input: Input, ctx: OperationContext, prepared: Prepared) => Awaitable<void>;
	/** What the write would change. The agent reads it before proposing, and the proposal card shows it. */
	preview?: (input: Input, ctx: OperationContext) => Awaitable<Preview>;
	run: (input: Input, ctx: OperationContext, prepared: Prepared) => Awaitable<Output>;
	/** One line for the activity log. Every write has one. */
	summary?: (input: Input, output: Output) => Message;
};

export type Operation<Input = unknown, Output = unknown, Prepared = undefined> = OperationDefinition<
	Input,
	Output,
	Prepared
> & {
	readonly __operation: true;
};

// biome-ignore lint/suspicious/noExplicitAny: a list of operations holds every input and output type.
export type AnyOperation = Operation<any, any, any>;

const NAME = /^[a-z][a-zA-Z]*(\.[a-z][a-zA-Z]*)+$/;

/**
 * Defines one thing Monti can do. One definition gives the admin API route, the agent tool and the CLI command, with the same input check, so no
 * entry point has a way around another's rules.
 */
export function defineOperation<Input, Output, Prepared = undefined>(
	definition: OperationDefinition<Input, Output, Prepared>,
): Operation<Input, Output, Prepared> {
	if (!NAME.test(definition.name))
		throw new Error(`Operation name "${definition.name}" is not "<area>.<verb>" in camel case.`);
	if (definition.kind === "write" && definition.summary === undefined)
		throw new Error(`Write operation "${definition.name}" has no summary for the activity log.`);
	if (
		definition.kind !== "write" &&
		(definition.touches ||
			definition.holds ||
			definition.preview ||
			definition.humanOnly ||
			definition.structure ||
			definition.prepare ||
			definition.bookkeeping ||
			definition.each ||
			definition.follows ||
			definition.places)
	)
		throw new Error(`Operation "${definition.name}" is not a write, so it has none of a write's parts.`);
	return { ...definition, __operation: true };
}

/**
 * Whether two places are the same or one holds the other: `entry:1/body` holds `entry:1/body/b_3`. A place ending in `/*` is somewhere inside
 * its parent without saying where (a block put in): it is held by its parent, and is the same as nothing, so two of them stand side by side.
 */
export function overlap(a: string, b: string): boolean {
	if (a === b) return !a.endsWith("/*");
	return a.startsWith(`${b}/`) || b.startsWith(`${a}/`);
}
