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
export type MontiClient<R extends ResourceTree> = {
	[K in keyof R]: R[K] extends ReadOperation<infer I, infer O> | WriteOperation<infer I, infer O>
		? (input: I) => Promise<O>
		: R[K] extends ResourceTree
			? MontiClient<R[K]>
			: never;
};

export type Monti<R extends ResourceTree = ResourceTree> = MontiClient<R> & {
	/** Adds a subscriber to committed writes; the returned function removes it. */
	onEvent(listener: EventListener): () => void;
};
