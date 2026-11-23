import type { Kysely, Transaction } from "kysely";
import type { z } from "zod";
import type { Database, Migration } from "../db/types";
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
export interface MontiConfig<R extends ResourceTree = Record<never, never>> {
	name: string;
	/** Whether this is a dev server: only a dev server changes the schema and the config. */
	dev?: boolean;
	/** Block types added to the built-in ones; one with a built-in's `type` replaces it. */
	blocks?: BlockDefinition[];
	/** Mark types added to the built-in ones; one with a built-in's `type` replaces it. */
	marks?: MarkDefinition[];
	/** Where the media files live; without it the media resource is refused. */
	storage?: StorageAdapter;
	/** The server plugins, in the order their migrations run. */
	plugins?: Plugin<R>[];
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
export interface MontiState<R extends ResourceTree = Record<never, never>> {
	schema: Schema;
	config: MontiConfig<R>;
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
	/**
	 * 트랜잭션의 스키마 사본을 바꾸고, 차례를 받은 뒤의 이전 스키마를 돌려준다. 다른 스키마·설정 변경과 차례를 지키며, 커밋
	 * 뒤 공유 상태와 파일에 반영된다. 받은 스키마는 사본으로 담는다.
	 */
	setSchema: (schema: Schema) => Promise<Schema>;
	/** 트랜잭션의 사이트 이름 사본을 바꾼다. 다른 스키마·설정 변경과 차례를 지키며, 커밋 뒤 공유 상태와 파일에 반영된다. */
	setConfig: (config: Pick<MontiConfig, "name">) => Promise<void>;
}

/** One transaction's copy of the schema and config: its changes reach the shared state and the files only on `commit`. */
export interface Stage {
	context(db: Transaction<Database>): WriteContext;
	/** 커밋 전에 바뀐 파일의 자리를 확인하고 새 내용을 임시 파일로 써 둔다. 쓸 수 없으면 던져 트랜잭션을 롤백시킨다. */
	prepare(): Promise<void>;
	/** 커밋 뒤 임시 파일을 제자리로 바꾸고 사본의 변경을 공유 상태에 반영한다. 바꾼 순서대로. */
	commit(): Promise<void>;
	/** 남은 임시 파일을 지우고 차례를 넘긴다. 커밋·롤백·`dryRun`과 상관없이 끝에 부른다. */
	release(): Promise<void>;
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

export type Monti<R extends ResourceTree = Record<never, never>> = MontiClient<R> & {
	/**
	 * 콜백의 호출들을 한 트랜잭션에서 실행하고, 커밋된 뒤 그 이벤트를 호출 순서대로 통지한다. `trx`는 그 트랜잭션의 DB다:
	 * 플러그인은 `trx`로 자기 테이블을 Operation 쓰기와 함께 커밋한다. `trx`로 직접 실행한 쿼리의 DB 오류는 콜백이 잡아도
	 * 트랜잭션을 실패시킨다.
	 */
	transaction<T>(fn: (tx: MontiClient<R>, trx: Transaction<Database>) => Promise<T>): Promise<T>;
	/** 콜백의 쓰기를 실제와 같이 실행한 뒤 롤백한다: 이벤트를 통지하지 않는다. `trx`는 `transaction`의 것과 같다. */
	dryRun<T>(fn: (tx: MontiWriteClient<R>, trx: Transaction<Database>) => Promise<T>): Promise<T>;
	/** Adds a subscriber to committed writes; the returned function removes it. */
	onEvent(listener: EventListener): () => void;
	/** Every operation of the resource tree, plugin operations included. */
	spec(): OperationSpec[];
};

/** One operation in `monti.spec()`: its key path, whether it reads or writes, and its input as JSON Schema. */
export interface OperationSpec {
	name: string;
	kind: Operation["kind"];
	input: Record<string, unknown>;
}

/** An external service whose keys the key store keeps: `check` resolves when `secret` connects and rejects when not. */
export interface KeyServiceDefinition {
	service: string;
	check(secret: string): Promise<void>;
}

/**
 * A server plugin: the operations it adds to the resource tree, its key services, the migrations of its tables and its
 * subscriber to committed writes.
 */
export interface Plugin<R extends ResourceTree = Record<never, never>> {
	name: string;
	operations?: Record<string, Record<string, Operation>>;
	keyServices?: KeyServiceDefinition[];
	/** core의 단계 다음에 배열 순서대로 한 번씩, 플러그인의 `name`을 출처(`source`)로 삼아 실행한다. */
	migrations?: Migration[];
	onEvent?(event: MontiEvent, ctx: { monti: Monti<R> }): void | Promise<void>;
}
