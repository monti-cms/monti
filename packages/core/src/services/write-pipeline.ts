import { isDeepStrictEqual } from "node:util";
import { validateBlocks } from "../core/block-validate";
import { type ImportNormalizers, type MediaUrlResolver, normalizeImportedDoc } from "../core/import-normalize";
import { type LinkResolver, linkAddressKey } from "../core/link-ids";
import { documentInputBody, prepareSnapshot, readInputBody } from "../core/snapshot";
import { readStoredDocument } from "../doc/stored-document";
import { type FormatRegistry, NO_FORMATS } from "../format/registry";
import type { Site } from "../site";
import type { HookProvider, HookSource, ValidationResult, WriteData, WriteHookContext, WriteOperation } from "./hooks";
import { type Issue, type PreparedSnapshot, ServiceError, type ServiceInput, type StorePort } from "./types";

/**
 * The one place content is prepared for a write. Create, save, publish (single and bulk), duplicate, translation and bulk metadata or folder
 * changes all build their input and call `run`, so a rule or hook added here applies to every one of them. The store never prepares content.
 *
 * Stages: `transform` hooks, core preparation (`prepareSnapshot`, always on the transformed data), the `validate` of each block
 * (warnings only), `validate` hooks, and for a publish
 * `validatePublish` hooks. The store commit and `afterCommit` come after, in the caller and the store.
 */

type PrepareOptions = Omit<NonNullable<Parameters<typeof prepareSnapshot>[2]>, "import" | "imported">;

const defaultFormats = async (): Promise<FormatRegistry> => NO_FORMATS;

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
	/** Warnings of the blocks' own `validate`, and of the `validate` and `validatePublish` hooks. */
	readonly warnings: readonly Issue[];
	/** Whether a `transform` hook changed the data. */
	readonly transformed: boolean;
}

export interface WritePipelineOptions {
	/** The site the writes are for: its collections, blocks and links decide how a body and its metadata are checked. */
	readonly site: Site;
	readonly hooks?: HookProvider;
	/** The formats a body given as text can be in. Without it, only the built-in ones. */
	readonly formats?: () => Promise<FormatRegistry>;
	/** Looks up the entries internal links point to. Without it, links keep the address they were written with. */
	readonly links?: LinkResolver;
	/** Looks up the registered media files image URLs point to. Without it, images keep the URL they were written with. */
	readonly media?: MediaUrlResolver;
}

const NO_HOOKS: HookProvider = () => [];

/** The link resolver of a store, when it can look up addresses. */
export const linkResolverOf = (site: Site, store: Pick<StorePort, "resolveLinkTargets">): LinkResolver | undefined =>
	store.resolveLinkTargets
		? async (addresses) =>
				new Map(
					(await store.resolveLinkTargets?.({ addresses }))?.map((found) => [
						linkAddressKey(site, found),
						found.entryId,
					]),
				)
		: undefined;

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

export function createWritePipeline(options: WritePipelineOptions) {
	const { site } = options;
	const provider = options.hooks ?? NO_HOOKS;

	/**
	 * Reads the body of the input into a document, once: a text is read by its format, a document is checked. The input that goes on has the document
	 * in place of the text, so transforms, normalisation and preparation all see a document. What reading the text found (a text the format could not read,
	 * warnings about what was not kept) goes to preparation as it is. Input that preparation will reject is left alone for it to reject.
	 */
	const readBody = async (
		request: WriteRequest,
	): Promise<{ input: ServiceInput; imported: { issues: Issue[]; warnings: Issue[] } | undefined }> => {
		const { input } = request;
		if (!isRecord(input) || !isRecord(input.metadata) || !site.isCollection(input.collection))
			return { input, imported: undefined };
		if (input.doc === undefined && typeof input.body !== "string") return { input, imported: undefined };
		const formats = await (options.formats ?? defaultFormats)();
		const body = await readInputBody(site, input, request.prepare?.previousDoc, {
			formats,
			locale: request.locale,
			entryId: request.entryId,
		});
		const {
			body: _body,
			format: _format,
			doc: _doc,
			...rest
		} = input as ServiceInput & { body?: string; format?: string };
		return {
			input: { ...rest, doc: body.doc } as ServiceInput,
			imported: { issues: body.importIssues, warnings: body.importWarnings ?? [] },
		};
	};

	/**
	 * Runs the transforms in order, each on the previous one's result. The input is kept when nothing changed, and only what a hook changed is replaced.
	 * Input that core preparation will reject is left alone for it to reject.
	 */
	const transform = async (
		sources: readonly HookSource[],
		request: WriteRequest,
		given: ServiceInput,
	): Promise<{ input: ServiceInput; transformed: boolean }> => {
		const unchanged = { input: given, transformed: false };
		const hooks = sources.filter((source) => source.hooks.transform);
		const input = given;
		if (hooks.length === 0 || !isRecord(input) || !isRecord(input.metadata) || !site.isCollection(input.collection))
			return unchanged;
		if (input.doc === undefined) return unchanged;
		let body: ReturnType<typeof documentInputBody>;
		try {
			body = documentInputBody(site, input, request.prepare?.previousDoc);
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
				// What a hook returns as the body must be a stored document.
				const read = readStoredDocument(result.doc, site);
				if (!read) throw hookFailed(source, "transform");
				doc = read;
			}
			data = { metadata: result.metadata, doc };
		}

		const metadataChanged = !isDeepStrictEqual(data.metadata, original.metadata);
		const docChanged = !isDeepStrictEqual(data.doc, original.doc);
		if (!metadataChanged && !docChanged) return unchanged;
		return {
			input: {
				...input,
				metadata: metadataChanged ? data.metadata : input.metadata,
				...(docChanged ? { doc: data.doc } : {}),
			} as ServiceInput,
			transformed: true,
		};
	};

	/**
	 * Core's normalisation of an imported body, whatever format or API it came from: a link written as the address of this site's content
	 * (`/posts/slug`) becomes a link by entry id, and an image written with the public URL of a registered media file becomes a registered image.
	 * What nobody holds stays as written. The input is returned as it is when nothing changes.
	 */
	const normalize = async (request: WriteRequest, input: ServiceInput): Promise<ServiceInput> => {
		const normalizers: ImportNormalizers = { links: options.links, media: options.media };
		if (!normalizers.links && !normalizers.media) return input;
		if (!isRecord(input) || !site.isCollection(input.collection) || input.doc === undefined) return input;
		let body: ReturnType<typeof documentInputBody>;
		try {
			body = documentInputBody(site, input, request.prepare?.previousDoc);
		} catch (error) {
			// Core preparation rejects it with the same error.
			if (error instanceof ServiceError) return input;
			throw error;
		}
		const doc = await normalizeImportedDoc(site, body.doc, normalizers);
		if (doc === body.doc) return input;
		return { ...input, doc } as ServiceInput;
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
			const read = await readBody(request);
			const { input, transformed } = request.skipTransform
				? { input: read.input, transformed: false }
				: await transform(sources, request, read.input);
			const snapshot = await prepareSnapshot(site, await normalize(request, input), {
				...request.prepare,
				...(read.imported ? { imported: read.imported } : {}),
			});
			// The blocks check their own syntax (`validate` of a block definition). Findings are warnings, never blockers.
			const warnings: Issue[] = await validateBlocks(site, snapshot.doc, {
				locale: request.locale,
				operation: request.operation,
			});
			if (sources.length === 0) return { snapshot, warnings, transformed };

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
