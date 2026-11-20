import type { Kysely, Transaction } from "kysely";
import type { z } from "zod";
import type { Database } from "../db/types";
import type { BlockDefinition, MarkDefinition } from "../rich-text/types";

/** The shape of the user schema (`monti.schema.ts`): the content languages and the collections with their fields. */
export interface Schema {
	locales: string[];
	collections: Record<string, CollectionSchema>;
}

/** A collection: `body` gives its entries a rich-text body; `label` and `description` are shown in the admin. */
export interface CollectionSchema {
	body?: boolean;
	label?: string;
	description?: string;
	fields: Record<string, FieldSchema>;
}

/** What every field may set, whatever its `type`. */
interface FieldMeta {
	required?: boolean;
	label?: string;
	description?: string;
}

interface TextField extends FieldMeta {
	type: "text";
	max?: number;
}

interface NumberField extends FieldMeta {
	type: "number";
}

interface BooleanField extends FieldMeta {
	type: "boolean";
}

interface DateField extends FieldMeta {
	type: "date";
}

interface SelectField extends FieldMeta {
	type: "select";
	options: string[];
	many?: boolean;
}

interface MediaField extends FieldMeta {
	type: "media";
	many?: boolean;
}

interface RelationField extends FieldMeta {
	type: "relation";
	/** The collection the field points to. */
	to: string;
	many?: boolean;
}

/** A field that holds one value: every type but `conditional`. */
export type ValueFieldSchema =
	| TextField
	| NumberField
	| BooleanField
	| DateField
	| SelectField
	| MediaField
	| RelationField;

/** A field whose sub-fields depend on the chosen option; the sub-fields hold values only, so it does not nest. */
interface ConditionalFieldSchema extends FieldMeta {
	type: "conditional";
	options: Record<string, { fields: Record<string, ValueFieldSchema> }>;
}

export type FieldSchema = ValueFieldSchema | ConditionalFieldSchema;

/** The site settings (`monti.config.ts`). */
export interface MontiConfig {
	name: string;
	/** Whether this is a dev server: only a dev server changes the schema and the config. */
	dev?: boolean;
	/** Block types added to the built-in ones; one with a built-in's `type` replaces it. */
	blocks?: BlockDefinition[];
	/** Mark types added to the built-in ones; one with a built-in's `type` replaces it. */
	marks?: MarkDefinition[];
	/** Where the media files live; without it the media resource is refused. */
	storage?: StorageAdapter;
}

/**
 * The object store of the media files. Which MIME types and sizes it accepts is the adapter's own policy: `ticket`
 * rejects what it does not accept.
 */
export interface StorageAdapter {
	/** A one-time upload to `key`: the client sends the file to `url` with `headers`. */
	ticket(key: string, info: { mime: string; size: number }): Promise<{ url: string; headers: Record<string, string> }>;
	/** The uploaded file at `key`, or null when there is none. */
	stat(key: string): Promise<{ mime: string; size: number } | null>;
	/** Where the file at `key` is read from. */
	url(key: string): string;
	/**
	 * Removes the file at `key`; a key with no file is a success. The adapter turns only the provider's exact not-found
	 * error into a success: permission, auth and network errors are thrown.
	 */
	remove(key: string): Promise<void>;
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
	/** The same adapter as `config.storage`. */
	storage?: StorageAdapter;
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
	? Call<I, O>
	: N extends ResourceTree
		? MontiClient<N>
		: never;

/** One operation's call: an input that accepts `undefined` or `{}` may be left out (`Record<never, never>` is `{}`). */
type Call<I, O> = [undefined] extends [I]
	? (input?: I) => Promise<O>
	: Record<never, never> extends I
		? (input?: I) => Promise<O>
		: (input: I) => Promise<O>;

/** The writes of a resource tree only, at the same key paths: what a `dryRun` callback gets. */
export type MontiWriteClient<R extends ResourceTree> = {
	[K in keyof R as R[K] extends { kind: "read" } ? never : K]: WriteClientNode<R[K]>;
};

/** One node of `MontiWriteClient`, mapped member by member like `ClientNode`. */
type WriteClientNode<N> =
	N extends WriteOperation<infer I, infer O> ? Call<I, O> : N extends ResourceTree ? MontiWriteClient<N> : never;

export type Monti<R extends ResourceTree = ResourceTree> = MontiClient<R> & {
	/** Runs the callback's calls in one transaction; their events are sent in call order once it commits. */
	transaction<T>(fn: (tx: MontiClient<R>) => Promise<T>): Promise<T>;
	/** Runs the callback's writes as they would run, then rolls them back: no event is sent. */
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
