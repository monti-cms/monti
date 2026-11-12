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
	/** When the write ran, as an ISO string. The engine stamps it. */
	at: string;
	ids: string[];
	collection?: string;
	locale?: string;
	version?: number;
	/** Public paths the change affects, for the site's cache. */
	paths?: string[];
};

/** An event as an operation queues it: the engine adds when. */
export type EmittedEvent = Omit<MontiEvent, "at">;

/**
 * The groups the activity log filters its lines by (doc 13): saving an entry, what the site shows of it, the trash, an import, settings and media. The
 * assistant's work is no group of its own: a line is the assistant's when it came from a conversation.
 */
export const ACTIVITY_KINDS = ["save", "publish", "trash", "import", "settings", "media"] as const;
export type ActivityKind = (typeof ACTIVITY_KINDS)[number];

/**
 * A record a write touched, as the activity log keeps it: its version after the write (`null` when the write removed it) and what it was called
 * then, so the log names an entry that has since been renamed or deleted for good.
 */
export type LoggedRecord = RecordRef & { version: number | null } & RecordLabel;

/** What a record is called in the log, from its record kind: a title, and for an entry its collection, language and address. */
export type RecordLabel = { title?: string; collection?: string; locale?: string; slug?: string };

/** What an operation gets besides its input. */
export interface OperationContext {
	/** The database; inside a write, the write's transaction. */
	db: Kysely<Database> | Transaction<Database>;
	actor: Actor;
	/**
	 * Queues an event. It is stored in the write's transaction and sent only after the write commits. `activity` names the log row its delivery shows on
	 * when that is not this write's own: an undo's events belong to the line it undoes.
	 */
	emit(event: EmittedEvent, options?: { activity?: string }): void;
	/** Marks a record the write creates, so undoing the write removes it. */
	created(ref: RecordRef): void;
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
	/** Refuses the write before it runs (throw `CheckError`). */
	check?: (input: Input, ctx: OperationContext, prepared: Prepared) => Awaitable<void>;
	/** What the write would change. The agent reads it before proposing, and the proposal card shows it. */
	preview?: (input: Input, ctx: OperationContext) => Awaitable<Preview>;
	run: (input: Input, ctx: OperationContext, prepared: Prepared) => Awaitable<Output>;
	/**
	 * Work that waits for the commit and that the caller waits for: sending a delivery again, removing a deleted file's bytes. It gets the write's
	 * output and a context on the database itself (the transaction is over); what it returns, when it returns something, is the output the caller sees.
	 */
	afterCommit?: (output: Output, ctx: OperationContext) => Awaitable<Output | undefined>;
	/**
	 * What was done, as the first line of its line in the activity log: "“First post” published". Every write has one. `records` are the records the
	 * write touched or made, with what each was called.
	 */
	summary?: (input: Input, output: Output, records: LoggedRecord[]) => Message;
	/** Where it happened, as the second line of its line in the log: an entry's address, a collection, "Media · Blog assets". */
	where?: (input: Input, output: Output, records: LoggedRecord[]) => Message | null;
	/**
	 * The group the activity log files the write under, by what it touched when one operation serves two places (a folder of entries, a folder of
	 * files).
	 * `false` keeps the row off the log's lines: the row is still written, but signing in, a list's column widths or a discarded proposal is no change
	 * to the site that a person looks for there. Left out, the line shows under no group.
	 */
	log?: ActivityKind | false | ((input: Input, records: LoggedRecord[]) => ActivityKind);
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
			definition.preview ||
			definition.humanOnly ||
			definition.structure ||
			definition.prepare ||
			definition.afterCommit ||
			definition.where ||
			definition.log !== undefined)
	)
		throw new Error(
			`Operation "${definition.name}" is not a write, so it has no touches, preview, humanOnly, structure, prepare, afterCommit, where or log.`,
		);
	return { ...definition, __operation: true };
}
