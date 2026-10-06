import { isDeepStrictEqual } from "node:util";
import { isCollection } from "../core/collections";
import { inputBody, prepareSnapshot } from "../core/snapshot";
import { readStoredDocument } from "../mdx/stored-document";
import type { HookProvider, HookSource, ValidationResult, WriteData, WriteHookContext, WriteOperation } from "./hooks";
import { type Issue, type PreparedSnapshot, ServiceError, type ServiceInput } from "./types";

/**
 * The one place content is prepared for a write. Create, save, publish (single and bulk), duplicate, translation and bulk metadata or folder
 * changes all build their input and call `run`, so a rule or hook added here applies to every one of them. The store never prepares content.
 *
 * Stages: `transform` hooks, core preparation (`prepareSnapshot`, always on the transformed data), `validate` hooks, and for a publish
 * `validatePublish` hooks. The store commit and `afterCommit` come after, in the caller and the store.
 */

type PrepareOptions = NonNullable<Parameters<typeof prepareSnapshot>[1]>;

export interface WriteRequest {
	readonly operation: WriteOperation;
	/** The entry being changed. Absent while it is being created. */
	readonly entryId?: string;
	/** Content locale of the entry. */
	readonly locale: string;
	/** The input as it came in (a request, or built from the stored draft). Its shape is checked by core preparation. */
	readonly input: ServiceInput;
	/** What the write replaces: references, document (block ids carry over) and metadata (kept keys the schema no longer has) of the current draft. */
	readonly prepare?: PrepareOptions;
	/**
	 * Do not run `transform` hooks. For a change that publishes a draft without changing it (restoring a record): validation still runs,
	 * so a restriction on publishing cannot be bypassed.
	 */
	readonly skipTransform?: boolean;
}

export interface WriteResult {
	/** Core preparation of the (transformed) input. */
	readonly snapshot: PreparedSnapshot;
	/** Warnings added by `validate` and `validatePublish` hooks. */
	readonly warnings: readonly Issue[];
	/** Whether a `transform` hook changed the data. */
	readonly transformed: boolean;
}

export interface WritePipelineOptions {
	readonly hooks?: HookProvider;
}

const NO_HOOKS: HookProvider = () => [];

/** A hook that throws (or returns something that is not its contract) fails the write. The error names the owner and the hook, never the hook's own message. */
const hookFailed = (source: HookSource, hook: string, error?: unknown): ServiceError => {
	if (error !== undefined) console.error(`[cms] ${hook} hook of ${source.owner} failed`, error);
	return new ServiceError("hook_failed", [
		{
			code: "hook_failed",
			message: `${hook} hook of ${source.owner} failed`,
			params: { hook, owner: source.owner },
		},
	]);
};

const callHook = async <R>(source: HookSource, hook: string, run: () => R | Promise<R>): Promise<R> => {
	try {
		return await run();
	} catch (error) {
		throw hookFailed(source, hook, error);
	}
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === "object" && value !== null && !Array.isArray(value);

/** Hooks get copies, so changing what they received cannot change the write. `undefined` when the value cannot be copied. */
const copyOf = <T>(value: T): T | undefined => {
	try {
		return structuredClone(value);
	} catch {
		return undefined;
	}
};

const readIssues = (source: HookSource, hook: string, value: unknown): readonly Issue[] => {
	if (value === undefined) return [];
	if (
		!Array.isArray(value) ||
		value.some((issue) => !isRecord(issue) || typeof issue.code !== "string" || !issue.code)
	) {
		throw hookFailed(source, hook);
	}
	return value as readonly Issue[];
};

const readValidation = (source: HookSource, hook: string, result: unknown): Required<ValidationResult> => {
	if (result === undefined || result === null) return { issues: [], warnings: [] };
	if (!isRecord(result)) throw hookFailed(source, hook);
	return { issues: readIssues(source, hook, result.issues), warnings: readIssues(source, hook, result.warnings) };
};

export function createWritePipeline(options: WritePipelineOptions = {}) {
	const provider = options.hooks ?? NO_HOOKS;

	/**
	 * Runs the transforms in order, each on the previous one's result. The original input is kept when nothing changed (an MDX body stays
	 * MDX), and only what a hook changed is replaced. Input that core preparation will reject is left alone for it to reject.
	 */
	const transform = async (
		sources: readonly HookSource[],
		request: WriteRequest,
	): Promise<{ input: ServiceInput; transformed: boolean }> => {
		const unchanged = { input: request.input, transformed: false };
		const hooks = sources.filter((source) => source.hooks.transform);
		const { input } = request;
		if (hooks.length === 0 || !isRecord(input) || !isRecord(input.metadata) || !isCollection(input.collection))
			return unchanged;
		let body: ReturnType<typeof inputBody>;
		try {
			body = inputBody(input, request.prepare?.previousDoc);
		} catch (error) {
			if (error instanceof ServiceError) return unchanged;
			throw error;
		}
		const original = copyOf<WriteData>({ metadata: input.metadata, doc: body.doc });
		if (!original) return unchanged;

		let data: WriteData = original;
		for (const source of hooks) {
			const hook = source.hooks.transform;
			const context = copyOf<WriteHookContext>({
				operation: request.operation,
				collection: input.collection,
				...(request.entryId === undefined ? {} : { entryId: request.entryId }),
				locale: request.locale,
				metadata: data.metadata,
				doc: data.doc,
			});
			if (!hook || !context) continue;
			const result = await callHook(source, "transform", () => hook(context));
			if (result === undefined || result === null) continue;
			if (!isRecord(result) || !isRecord(result.metadata)) throw hookFailed(source, "transform");
			let doc = data.doc;
			if (result.doc !== undefined) {
				// A body that is not a document cannot be turned into one by a hook, and a document cannot be taken away.
				const read = result.doc === null ? null : (readStoredDocument(result.doc) ?? undefined);
				if (read === undefined || (read === null && data.doc !== null)) throw hookFailed(source, "transform");
				doc = read;
			}
			data = { metadata: result.metadata, doc };
		}

		const metadataChanged = !isDeepStrictEqual(data.metadata, original.metadata);
		const docChanged = !isDeepStrictEqual(data.doc, original.doc);
		if (!metadataChanged && !docChanged) return unchanged;
		const { mdx: _mdx, ...rest } = input as ServiceInput & { mdx?: string };
		return {
			input: {
				...rest,
				metadata: metadataChanged ? data.metadata : input.metadata,
				...(docChanged ? { doc: data.doc } : input.doc === undefined ? { mdx: input.mdx } : {}),
			} as ServiceInput,
			transformed: true,
		};
	};

	const validate = async (
		sources: readonly HookSource[],
		hook: "validate" | "validatePublish",
		request: WriteRequest,
		snapshot: PreparedSnapshot,
	): Promise<Required<ValidationResult>> => {
		const issues: Issue[] = [];
		const warnings: Issue[] = [];
		for (const source of sources) {
			const run = source.hooks[hook];
			if (!run) continue;
			const copy = copyOf(snapshot);
			if (!copy) throw hookFailed(source, hook);
			const result = await callHook(source, hook, () =>
				run({
					operation: request.operation,
					collection: copy.collection,
					...(request.entryId === undefined ? {} : { entryId: request.entryId }),
					locale: request.locale,
					metadata: copy.metadata,
					doc: copy.doc,
					snapshot: copy,
				}),
			);
			const read = readValidation(source, hook, result);
			issues.push(...read.issues);
			warnings.push(...read.warnings);
		}
		return { issues, warnings };
	};

	return {
		/**
		 * Prepares a write. Throws a `ServiceError` when core preparation rejects the input, when a hook fails (`hook_failed`) or when a
		 * hook's validation adds failures (`validation_failed`, `publish_validation_failed`). Nothing is stored here.
		 */
		run: async (request: WriteRequest): Promise<WriteResult> => {
			const sources = await provider();
			const { input, transformed } = request.skipTransform
				? { input: request.input, transformed: false }
				: await transform(sources, request);
			const snapshot = await prepareSnapshot(input, request.prepare);
			if (sources.length === 0) return { snapshot, warnings: [], transformed };

			const warnings: Issue[] = [];
			const added = await validate(sources, "validate", request, snapshot);
			if (added.issues.length > 0) throw new ServiceError("validation_failed", added.issues);
			warnings.push(...added.warnings);

			if (request.operation === "publish" || request.operation === "restore") {
				const publish = await validate(sources, "validatePublish", request, snapshot);
				// The issues core preparation found are blockers of a publish too, and are shown with the added ones.
				if (publish.issues.length > 0) {
					throw new ServiceError("publish_validation_failed", [...snapshot.issues, ...publish.issues]);
				}
				warnings.push(...publish.warnings);
			}
			return { snapshot, warnings, transformed };
		},
	};
}

export type WritePipeline = ReturnType<typeof createWritePipeline>;
