import type { Kysely, Transaction } from "kysely";
import type { z } from "zod";
import type { Database } from "../db/types";
import type { BlockDefinition, MarkDefinition } from "../rich-text/types";

/** The shape of the user schema (`monti.schema.ts`): the content languages and the collections with their fields. */
export interface Schema {
	locales: string[];
	collections: Record<string, CollectionSchema>;
}

interface CollectionSchema {
	fields: Record<string, FieldSchema>;
}

interface FieldSchema {
	type: string;
}

/** The site settings (`monti.config.ts`). */
export interface MontiConfig {
	name: string;
	/** Whether this is a dev server: only a dev server changes the schema and the config. */
	dev?: boolean;
	/** Block types added to the built-in ones; one with a built-in's `type` replaces it. */
	blocks?: BlockDefinition[];
	/** Mark types added to the built-in ones; one with a built-in's `type` replaces it. */
	marks?: MarkDefinition[];
}

/** The schema and config the engine starts with, and the files it writes their changes to. */
export interface MontiState {
	schema: Schema;
	config: MontiConfig;
	schemaFile: string;
	configFile: string;
}

/** What a read's `run` gets: the database, outside any transaction when the read is called directly. */
export interface ReadContext {
	db: Kysely<Database> | Transaction<Database>;
	schema: Schema;
	config: MontiConfig;
}

/** What a write's `run` gets: a write always runs inside a transaction. */
export interface WriteContext extends ReadContext {
	db: Transaction<Database>;
	/** Changes the transaction's copy of the schema; written to the shared state and the file after the commit. */
	setSchema: (schema: Schema) => void;
	/** Changes the transaction's copy of the site name; written to the shared state and the file after the commit. */
	setConfig: (config: Pick<MontiConfig, "name">) => void;
}

/** One transaction's copy of the schema and config: its changes reach the shared state and the files only on `commit`. */
export interface Stage {
	context(db: Transaction<Database>): WriteContext;
	/** Writes the copy's changes to the shared state and the files, in the order they were made. */
	commit(): Promise<void>;
}

export interface ReadOperation<TInput, TOutput> {
	kind: "read";
	input: z.ZodType<TInput>;
	run(input: TInput, ctx: ReadContext): Promise<TOutput>;
}

export interface WriteOperation<TInput, TOutput> {
	kind: "write";
	input: z.ZodType<TInput>;
	run(input: TInput, ctx: WriteContext): Promise<TOutput>;
}

export type Operation = ReadOperation<unknown, unknown> | WriteOperation<unknown, unknown>;

/** The resource tree: its key path to an operation (`entries.get`) is the operation's name. */
export interface ResourceTree {
	[key: string]: Operation | ResourceTree;
}

export type ErrorCode = "BAD_REQUEST" | "UNAUTHORIZED" | "FORBIDDEN" | "NOT_FOUND" | "CONFLICT";

/** Sent to the subscribers after a write commits. */
export interface MontiEvent<TInput = unknown, TOutput = unknown> {
	/** The operation's key path in the resource tree, e.g. "entries.publish". */
	operation: string;
	input: TInput;
	output: TOutput;
}

export type EventListener = (event: MontiEvent) => void | Promise<void>;

/** The calls of a resource tree: each operation becomes `(input) => Promise<output>` at the same key path. */
export type MontiClient<R extends ResourceTree> = { [K in keyof R]: ClientNode<R[K]> };

/** One node of `MontiClient`, mapped member by member so a node typed `Operation | ResourceTree` maps too. */
type ClientNode<N> = N extends ReadOperation<infer I, infer O> | WriteOperation<infer I, infer O>
	? (input: I) => Promise<O>
	: N extends ResourceTree
		? MontiClient<N>
		: never;

/** The writes of a resource tree only, at the same key paths: what a `dryRun` block gets. */
export type MontiWriteClient<R extends ResourceTree> = {
	[K in keyof R as R[K] extends { kind: "read" } ? never : K]: WriteClientNode<R[K]>;
};

/** One node of `MontiWriteClient`, mapped member by member like `ClientNode`. */
type WriteClientNode<N> =
	N extends WriteOperation<infer I, infer O>
		? (input: I) => Promise<O>
		: N extends ResourceTree
			? MontiWriteClient<N>
			: never;

export type Monti<R extends ResourceTree = ResourceTree> = MontiClient<R> & {
	/** Runs the block's calls in one transaction; their events are sent in call order once it commits. */
	transaction<T>(fn: (tx: MontiClient<R>) => Promise<T>): Promise<T>;
	/** Runs the block's writes as they would run, then rolls them back: no event is sent. */
	dryRun<T>(fn: (tx: MontiWriteClient<R>) => Promise<T>): Promise<T>;
	/** Adds a subscriber to committed writes; the returned function removes it. */
	onEvent(listener: EventListener): () => void;
};

/** An external service whose keys the key store keeps: `check` resolves when `secret` connects and rejects when not. */
export interface KeyServiceDefinition {
	service: string;
	check(secret: string): Promise<void>;
}

/** A server plugin: the operations it adds to the resource tree, its key services and its subscriber to committed writes. */
export interface Plugin {
	name: string;
	operations?: Record<string, Record<string, Operation>>;
	keyServices?: KeyServiceDefinition[];
	onEvent?: (event: MontiEvent, ctx: { monti: Monti }) => void | Promise<void>;
}
