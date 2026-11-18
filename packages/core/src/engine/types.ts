import type { Kysely, Transaction } from "kysely";
import type { z } from "zod";
import type { Database } from "../db/types";

/** What a read's `run` gets: the database, outside any transaction when the read is called directly. */
export interface ReadContext {
	db: Kysely<Database> | Transaction<Database>;
}

/** What a write's `run` gets: a write always runs inside a transaction. */
export interface WriteContext extends ReadContext {
	db: Transaction<Database>;
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
