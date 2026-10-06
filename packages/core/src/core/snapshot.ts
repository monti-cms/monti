import { assignBlockIds } from "../doc/block-ids";
import { isAllowedImageSrc } from "../doc/image-src";
import { canonicalDocument, readStoredDocument, type StoredDocument } from "../doc/stored-document";
import type { CmsImageSource } from "../doc/types";
import { importText } from "../format/convert";
import { type FormatRegistry, NO_FORMATS } from "../format/registry";
import {
	fieldValueError,
	metadataReferences,
	missingRequiredIssues,
	normalizeRecordTranslations,
	orphanedMetadataKeys,
	RECORD_TRANSLATIONS_KEY,
	relationRule,
	schemaOf,
	storedField,
	unknownSelectValues,
} from "../schema/derive";
import { checkDocument, isEmptyDocument } from "./body-check";
import { COLLECTION_DEFINITIONS, isCollection } from "./collections";
import { computeContentHash, sortKeys } from "./content-hash";
import { MAX_DOC_BYTES, MAX_METADATA_BYTES, MAX_TEXT_BYTES } from "./limits";
import { LINKABLE_COLLECTIONS } from "./links";
import { DEFAULT_LOCALE, PREFIXED_LOCALES } from "./locales";
import { normalizeSlugInput } from "./slug";
import { parseTranslationState } from "./translation/state";
import {
	type Collection,
	type Issue,
	type MetadataValue,
	type PreparedSnapshot,
	type Reference,
	type ReferenceKind,
	type ReferenceOccurrence,
	type ResolvedTargets,
	ServiceError,
	type ServiceInput,
} from "./types";

/**
 * Snapshot preparation and publish validation. Pure rules; knows nothing about the DB or HTTP.
 * The service (draft save) and the repository implementation (re-validation inside the publish transaction) use the same rules.
 */

export { MAX_DOC_BYTES, MAX_METADATA_BYTES, MAX_TEXT_BYTES };

export { computeContentHash };

class ReferenceCollector {
	refs: { kind: ReferenceKind; targetId: string; isStale: boolean; occurrences: ReferenceOccurrence[] }[] = [];

	add(kind: ReferenceKind, targetId: string, occurrence: ReferenceOccurrence, isStale = false) {
		let ref = this.refs.find((r) => r.kind === kind && r.targetId === targetId);
		if (!ref) {
			ref = { kind, targetId, isStale, occurrences: [] };
			this.refs.push(ref);
		} else if (isStale) {
			ref.isStale = true;
		}
		ref.occurrences.push(occurrence);
	}
}

/** Collects metadata relation fields as references, in collection-definition order. Preserves order and duplicates. */
function addMetadataReferences(
	collector: ReferenceCollector,
	collection: Collection,
	metadata: PreparedSnapshot["metadata"],
) {
	for (const ref of metadataReferences(collection, metadata)) {
		collector.add(ref.kind, ref.targetId, {
			type: "metadata",
			path: ref.path,
			...(ref.ordinal === undefined ? {} : { ordinal: ref.ordinal }),
		});
	}
}

/** Is this a plain object with exactly the allowed keys? Getters and inherited properties are rejected. */
export function validateExactRecord(
	value: unknown,
	expectedKeys: readonly string[],
): asserts value is Record<string, unknown> {
	if (!value || typeof value !== "object" || Array.isArray(value)) {
		throw new ServiceError("invalid_input");
	}
	const proto = Object.getPrototypeOf(value);
	if (proto !== Object.prototype && proto !== null) {
		throw new ServiceError("invalid_input");
	}

	const keys = Reflect.ownKeys(value);
	const expectedSet = new Set(expectedKeys);
	if (keys.length !== expectedSet.size) {
		throw new ServiceError("invalid_input");
	}

	for (const key of keys) {
		if (typeof key !== "string" || !expectedSet.has(key)) {
			throw new ServiceError("invalid_input");
		}
		const desc = Object.getOwnPropertyDescriptor(value, key);
		if (!desc || !desc.enumerable || "get" in desc || "set" in desc || !("value" in desc)) {
			throw new ServiceError("invalid_input");
		}
	}
}

/** Keys a service input must have: the body is `doc`, or `body` with its `format`. */
export const serviceInputKeys = (input: unknown): readonly string[] => [
	"collection",
	"slug",
	"metadata",
	...(input !== null && typeof input === "object" && Object.hasOwn(input, "doc") ? ["doc"] : ["body", "format"]),
];

/** What reading the body of a service input gives: the document, and the findings about a text that could not become one. */
export interface InputBody {
	readonly doc: StoredDocument;
	/** For a body given as text that the format could not read: why (`mdx_error`, `frontmatter_present`), with the line and column in that text. */
	readonly importIssues: Issue[];
	/** Warnings about a text that was read, but not kept as written (a code annotation that reaches past the code). */
	readonly importWarnings?: Issue[];
}

/**
 * The body of a service input given as a stored document: taken as given (checked in shape, put in its canonical form). Blocks inherit their ids from
 * `previous`, the body being replaced, where the input has none.
 */
export const documentInputBody = (input: ServiceInput, previous: StoredDocument | null | undefined): InputBody => {
	let size: number;
	try {
		size = Buffer.byteLength(JSON.stringify(input.doc) ?? "", "utf8");
	} catch {
		throw new ServiceError("invalid_input");
	}
	if (size > MAX_DOC_BYTES) throw new ServiceError("body_too_large");
	const read = readStoredDocument(input.doc);
	if (!read) throw new ServiceError("invalid_input");
	const doc = canonicalDocument(read);
	return {
		doc: { ...doc, content: assignBlockIds(doc.content, [previous?.content]) },
		importIssues: [],
	};
};

/** What `readInputBody` needs to read a text: the formats and the language of the body. Without `formats`, only the built-in ones. */
export interface TextImport {
	readonly formats?: FormatRegistry;
	readonly locale?: string;
	readonly entryId?: string;
}

/**
 * The body of a service input as a document: the one given, or the text read by its format. A text the format rejects becomes a document of one
 * `unparsed` node that keeps it (with the reasons as `importIssues`): a draft can hold it, and `unparsed_body` blocks publishing it.
 */
export const readInputBody = async (
	input: ServiceInput,
	previous: StoredDocument | null | undefined,
	options: TextImport = {},
): Promise<InputBody> => {
	if (input.doc !== undefined) return documentInputBody(input, previous);
	if (typeof input.body !== "string" || typeof input.format !== "string") throw new ServiceError("invalid_input");
	const imported = await importText(options.formats ?? NO_FORMATS, input.format, input.body, {
		locale: options.locale ?? DEFAULT_LOCALE,
		entryId: options.entryId,
		previous,
	});
	return { doc: imported.doc, importIssues: imported.issues, importWarnings: imported.warnings };
};

/**
 * Field value error. The error code is the same regardless of field name. Exceeding the length limit (`field_too_long`) is reported through the issue (`issues`)'s
 * `path` (field name) and `message` (field label) (the admin screen shows it as "<label> is too long.").
 */
function fieldValueServiceError(code: string, path: string, label: string | undefined): ServiceError {
	if (code !== "field_too_long") return new ServiceError(code);
	return new ServiceError(code, [{ code, path, ...(label ? { message: label } : {}) }]);
}

/** A metadata value in its storage shape: a string, or a plain array of strings (`type` fixes which one when the field is known). */
function readStoredValue(v: unknown, type?: string): MetadataValue {
	if (type === "string" || (type === undefined && typeof v === "string")) {
		if (typeof v !== "string") throw new ServiceError("invalid_metadata_type");
		return v;
	}
	if (!Array.isArray(v) || Object.getPrototypeOf(v) !== Array.prototype) {
		throw new ServiceError("invalid_metadata_type");
	}
	if (Reflect.ownKeys(v).length !== v.length + 1) throw new ServiceError("invalid_metadata_type");
	for (let i = 0; i < v.length; i++) {
		const desc = Object.getOwnPropertyDescriptor(v, String(i));
		if (!desc || desc.get || desc.set) throw new ServiceError("invalid_metadata_type");
		if (typeof v[i] !== "string") throw new ServiceError("invalid_metadata_type");
	}
	return Object.freeze([...(v as string[])]);
}

/**
 * Non-blocking warnings about values the schema no longer describes: the value of a removed field (`orphaned_metadata_key`) and a select value that is
 * no longer an option (`unknown_select_value`, with the value in `message`). Both are kept in the stored metadata; the path is the field key.
 */
function metadataWarnings(collection: Collection, metadata: Record<string, MetadataValue>): Issue[] {
	return [
		...orphanedMetadataKeys(collection, metadata).map((key): Issue => ({ code: "orphaned_metadata_key", path: key })),
		...unknownSelectValues(collection, metadata).flatMap(({ path, values }) =>
			values.map((value): Issue => ({ code: "unknown_select_value", path, message: value, params: { value } })),
		),
	];
}

function validateMetadata(
	collection: Collection,
	raw: unknown,
	previous: { readonly [key: string]: unknown } = {},
): Record<string, MetadataValue> {
	if (
		!raw ||
		typeof raw !== "object" ||
		Array.isArray(raw) ||
		(Object.getPrototypeOf(raw) !== Object.prototype && Object.getPrototypeOf(raw) !== null)
	) {
		throw new ServiceError("invalid_input");
	}
	for (const key of Reflect.ownKeys(raw)) {
		if (typeof key !== "string") throw new ServiceError("invalid_input");
		const desc = Object.getOwnPropertyDescriptor(raw, key);
		if (!desc?.enumerable || desc.get || desc.set) throw new ServiceError("invalid_input");
	}
	const input = raw as Record<string, unknown>;

	// Allowed keys, storage format and value rules come from the collection definition.
	const rules = COLLECTION_DEFINITIONS[collection].fields;
	const metadata: Record<string, MetadataValue> = {};
	for (const [k, v] of Object.entries(input)) {
		if (k === RECORD_TRANSLATIONS_KEY) {
			// Per-locale names of a record collection. The default-locale value lives in the field itself.
			const normalized = normalizeRecordTranslations(collection, v, PREFIXED_LOCALES);
			if ("error" in normalized) {
				const { error, path, label } = normalized;
				throw path ? fieldValueServiceError(error, path, label) : new ServiceError(error);
			}
			if (Object.keys(normalized.value).length > 0) metadata[k] = normalized.value;
			continue;
		}
		const stored = storedField(collection, k);
		if (!stored || !Object.hasOwn(rules, k)) {
			// The value of a field the site has removed: kept as stored, with only its storage shape checked.
			// A key the entry does not already hold is new, so it is not a removed field but a mistake.
			if (k === "__proto__" || !Object.hasOwn(previous, k)) throw new ServiceError("invalid_metadata_key");
			metadata[k] = readStoredValue(v);
			continue;
		}
		metadata[k] = readStoredValue(v, rules[k]);

		// A select value that is no longer an option is kept too (a warning at publish, never an error).
		if (stored.field.kind === "select") continue;
		const value = metadata[k];
		const error = typeof value === "string" || Array.isArray(value) ? fieldValueError(stored.field, value) : null;
		if (error) throw fieldValueServiceError(error, k, stored.field.label);
	}

	if (Buffer.byteLength(JSON.stringify(sortKeys(metadata)), "utf8") > MAX_METADATA_BYTES) {
		throw new ServiceError("metadata_too_large");
	}
	return metadata;
}

export async function prepareSnapshot(
	input: ServiceInput,
	options?: {
		schemaVersion?: number;
		previousReferences?: readonly Reference[];
		/** The stored document this body replaces (the current draft). Its block ids carry over to the blocks that pair with them. */
		previousDoc?: StoredDocument | null;
		/**
		 * The metadata stored for this entry (the current draft). A key the schema no longer has is kept only if it is stored here
		 * (a schema change orphaned it); a new unknown key is rejected. A new entry has none.
		 */
		previousMetadata?: { readonly [key: string]: unknown };
		/** Reading a body given as text: the formats (default: the built-in ones), the language of the body, the entry it is written to. */
		import?: TextImport;
		/** What the write pipeline already found while reading the body, when it read the text itself (the input then holds the document). */
		imported?: { readonly issues: readonly Issue[]; readonly warnings: readonly Issue[] };
	},
): Promise<PreparedSnapshot> {
	if (!input || typeof input !== "object" || Array.isArray(input)) {
		throw new ServiceError("invalid_input");
	}
	validateExactRecord(input, [
		...serviceInputKeys(input),
		...(input.folderId === undefined ? [] : ["folderId"]),
		...(input.translation === undefined ? [] : ["translation"]),
	]);
	const translation = input.translation === undefined ? undefined : parseTranslationState(input.translation);
	if (input.translation !== undefined && translation === undefined) throw new ServiceError("invalid_input");

	const rawCollection: unknown = input.collection;
	if (typeof rawCollection !== "string") throw new ServiceError("invalid_input");
	if (!isCollection(rawCollection)) throw new ServiceError("unknown_collection");

	if (input.slug !== undefined && input.slug !== null && typeof input.slug !== "string") {
		throw new ServiceError("invalid_input");
	}
	const normalizedSlug = normalizeSlugInput(input.slug);
	if ("error" in normalizedSlug) throw new ServiceError(normalizedSlug.error);
	const slug = normalizedSlug.slug;

	const metadata = validateMetadata(rawCollection, input.metadata, options?.previousMetadata);

	const collector = new ReferenceCollector();
	addMetadataReferences(collector, rawCollection, metadata);

	// The body is a document: given as one, or read from text (a text that could not be read is one `unparsed` node).
	const body = await readInputBody(input, options?.previousDoc, options?.import);
	const { doc } = body;
	const check = checkDocument(doc);
	const warnings: Issue[] = [
		...metadataWarnings(rawCollection, metadata),
		...(options?.imported?.warnings ?? []),
		...(body.importWarnings ?? []),
		...check.warnings,
	];
	const issues: Issue[] = [...(options?.imported?.issues ?? []), ...body.importIssues, ...check.issues];

	if (check.incomplete) {
		// For a body whose references cannot be trusted (unparsed, or a reference in it is missing or malformed), past body references stay stale.
		// Past references come only from the repository.
		for (const ref of options?.previousReferences ?? []) {
			for (const occ of ref.occurrences) {
				if (occ.type !== "metadata") collector.add(ref.kind, ref.targetId, { ...occ }, true);
			}
		}
	} else {
		for (const item of check.entryLinks) {
			collector.add("entry", item.entryId, {
				type: "body",
				...(item.position.blockId === undefined ? {} : { blockId: item.position.blockId }),
			});
		}
		for (const item of check.mediaReferences) {
			collector.add("media", item.mediaId, {
				type: "body",
				...(item.position.blockId === undefined ? {} : { blockId: item.position.blockId }),
			});
		}
	}

	let schemaVersion = 1;
	if (options?.schemaVersion !== undefined) {
		if (!Number.isInteger(options.schemaVersion) || options.schemaVersion <= 0) {
			throw new ServiceError("invalid_input");
		}
		schemaVersion = options.schemaVersion;
	}

	const freeze = <T extends object>(items: T[]) => Object.freeze(items.map((item) => Object.freeze({ ...item })));

	return Object.freeze({
		collection: rawCollection,
		slug,
		metadata: Object.freeze(metadata),
		doc,
		schemaVersion,
		contentHash: computeContentHash(metadata, doc, schemaVersion),
		references: Object.freeze(
			collector.refs.map((ref) =>
				Object.freeze({ ...ref, occurrences: Object.freeze(ref.occurrences.map((o) => Object.freeze({ ...o }))) }),
			),
		),
		issues: freeze(issues),
		warnings: freeze(warnings),
		internalLinks: Object.freeze(
			check.internalLinks.map((link) => Object.freeze({ ...link, position: Object.freeze({ ...link.position }) })),
		),
		imageSources: freeze(check.imageSources),
		...(translation === undefined ? {} : { translation }),
	});
}

/**
 * Image warnings. **Non-blocking**; they do not stop publishing.
 *
 * Only the 3 cases that actually occur with normal data are checked: (1) a media row exists but is not `ready`,
 * (2) `ready` but no storage key, so it cannot be resolved, (3) an external `src` hits an allow rule.
 * **A missing media row is not a warning case** — the FK/CHECK on `entry_references` and
 * `unresolved_media` in `validateForPublish` block it first (media integrity contract).
 */
const imageWarnings = (sources: readonly CmsImageSource[], media: ResolvedTargets["media"]): Issue[] => {
	const warnings: Issue[] = [];
	for (const source of sources) {
		if (source.src !== undefined) {
			if (!isAllowedImageSrc(source.src)) {
				warnings.push({ code: "image_src_not_allowed", message: source.src, position: source.position });
			}
			continue;
		}
		const row = source.mediaId === undefined ? undefined : media.find((m) => m.id === source.mediaId);
		if (!row) continue;
		if (row.status !== undefined && row.status !== "ready") {
			warnings.push({ code: "image_media_not_ready", message: row.status, position: source.position });
		} else if (row.storageKey !== undefined && !row.storageKey) {
			warnings.push({ code: "image_media_unresolved", position: source.position });
		}
	}
	return warnings;
};

/**
 * Collects only the image warnings to include in the publish response, for a snapshot the write pipeline prepared. **Non-blocking**; if computation fails it returns an empty array.
 *
 * For media that is `ready` with a `storageKey`, if `headStorageKey` is provided, the actual object in storage is checked once more.
 * If it is missing, an `image_media_missing_in_storage` warning is added. On an infrastructure error it falls back to the DB decision.
 */
export async function imageWarningsForSnapshot(
	snapshot: PreparedSnapshot,
	resolvers: {
		getMediaAsset: (id: string) => Promise<{ status?: string; storageKey?: string | null } | null>;
		headStorageKey?: (storageKey: string) => Promise<boolean>;
	},
): Promise<Issue[]> {
	try {
		const mediaIds = [
			...new Set(snapshot.imageSources.map((s) => s.mediaId).filter((v): v is string => typeof v === "string")),
		];
		const media: ResolvedTargets["media"] = [];
		for (const id of mediaIds) {
			const row = await resolvers.getMediaAsset(id);
			if (row) media.push({ id, status: row.status, storageKey: row.storageKey ?? null });
		}
		const warnings = [...(snapshot.warnings ?? []), ...imageWarnings(snapshot.imageSources, media)];
		if (resolvers.headStorageKey) {
			const byId = new Map(media.map((row) => [row.id, row]));
			for (const source of snapshot.imageSources) {
				const row = source.mediaId ? byId.get(source.mediaId) : undefined;
				if (row?.status !== "ready" || !row.storageKey) continue;
				const exists = await resolvers.headStorageKey(row.storageKey).catch(() => true);
				if (!exists) {
					warnings.push({ code: "image_media_missing_in_storage", message: row.storageKey, position: source.position });
				}
			}
		}
		return warnings;
	} catch {
		return [];
	}
}

export function validateForPublish(
	snapshot: PreparedSnapshot,
	resolved: ResolvedTargets,
): { ready: boolean; issues: Issue[]; warnings: Issue[] } {
	const issues: Issue[] = [...snapshot.issues];
	/**
	 * A link to an entry that is not published (a draft, or one in the trash) does not block publishing: links are resolved when the page is read, and an
	 * unresolved one is drawn as plain text until the target is published. It would also make two new posts that link to each other impossible to publish.
	 */
	const linkWarnings: Issue[] = [];
	const occurrenceIssue = (code: string, occurrence: ReferenceOccurrence | undefined, message?: string): Issue => ({
		code,
		...(message ? { message } : {}),
		...(occurrence?.type === "body"
			? { position: occurrence.blockId === undefined ? {} : { blockId: occurrence.blockId } }
			: occurrence?.type === "metadata"
				? { path: occurrence.path, ...(occurrence.ordinal === undefined ? {} : { ordinal: occurrence.ordinal }) }
				: {}),
	});

	issues.push(
		...missingRequiredIssues(snapshot.collection, snapshot, { localizedOnly: Boolean(resolved.translation) }),
	);
	if (resolved.translation && !resolved.translation.sourcePublished) {
		// The public screen's category, tags and publish date come from the source.
		issues.push({ code: "source_not_published", path: "translationGroupId" });
	}
	// Only collections that use a body (`body`) reject an empty body.
	if (schemaOf(snapshot.collection).body && isEmptyDocument(snapshot.doc)) {
		issues.push({ code: "empty_body", path: "body" });
	}

	// Metadata relations are always checked regardless of the snapshot's reference list (so nothing leaks even if the caller sends empty references).
	const metadataRefs = new ReferenceCollector();
	addMetadataReferences(metadataRefs, snapshot.collection, snapshot.metadata);
	const occurrenceKey = (kind: string, target: string, o: ReferenceOccurrence) =>
		`${kind}|${target}|${JSON.stringify(o)}`;
	const seen = new Set(
		snapshot.references.flatMap((ref) => ref.occurrences.map((o) => occurrenceKey(ref.kind, ref.targetId, o))),
	);
	const references: Reference[] = [...snapshot.references];
	for (const ref of metadataRefs.refs) {
		const missing = ref.occurrences.filter((o) => !seen.has(occurrenceKey(ref.kind, ref.targetId, o)));
		if (missing.length > 0) references.push({ ...ref, occurrences: missing });
	}

	for (const ref of references) {
		const occurrences = ref.occurrences.length > 0 ? ref.occurrences : [undefined];
		const addForAll = (code: string) => {
			for (const occurrence of ref.kind === "entry" ? occurrences.filter((item) => item?.type !== "body") : occurrences)
				issues.push(occurrenceIssue(code, occurrence, ref.targetId));
		};

		if (ref.kind === "media") {
			if (!resolved.media.some((m) => m.id === ref.targetId)) addForAll("unresolved_media");
			continue;
		}

		const target = resolved.targets.find((t) => t.id === ref.targetId);
		// A body occurrence of an entry is a link by id. It has its own codes (the same ones a link by address has), and the target must be a source
		// entry of a collection with a public path.
		const bodyOccurrences = occurrences.filter((occurrence) => occurrence?.type === "body");
		if (bodyOccurrences.length > 0) {
			const reachable =
				target && target.isSource !== false && LINKABLE_COLLECTIONS.includes(target.collection as Collection);
			for (const occurrence of bodyOccurrences) {
				if (!reachable) issues.push(occurrenceIssue("unresolved_internal_link", occurrence, ref.targetId));
				else if (!target.isPublished)
					linkWarnings.push(occurrenceIssue("unpublished_internal_link", occurrence, ref.targetId));
			}
			if (occurrences.every((occurrence) => occurrence?.type === "body")) continue;
		}
		if (!target) {
			addForAll("unresolved_reference");
			continue;
		}
		// The expected target collection and whether unpublished targets are allowed come from the relation field definition. References not attached to a field are not checked against a collection.
		const rule = ref.occurrences
			.map((o) => (o.type === "metadata" ? relationRule(snapshot.collection, o.path) : undefined))
			.find((found) => found !== undefined);
		if (rule && target.collection !== rule.to) {
			addForAll("invalid_reference_collection");
			continue;
		}
		// A compilation may also contain posts that are not published yet. They are only excluded from the public list.
		if (!target.isPublished && !rule?.allowUnpublished) addForAll("unpublished_reference");
	}

	for (const [index, source] of (snapshot.internalLinks ?? []).entries()) {
		const target = resolved.internalLinks?.[index];
		if (!target || target.addressType === "missing" || target.addressType === "deleted") {
			issues.push({ code: "unresolved_internal_link", message: source.url, path: "body", position: source.position });
		} else if (target.addressType === "reservation" || !target.isPublished) {
			linkWarnings.push({
				code: "unpublished_internal_link",
				message: source.url,
				path: "body",
				position: source.position,
			});
		}
	}

	// Image resolution failures and attributes not in the definition are only warnings — they do not change `ready`.
	return {
		ready: issues.length === 0,
		issues,
		warnings: [...(snapshot.warnings ?? []), ...linkWarnings, ...imageWarnings(snapshot.imageSources, resolved.media)],
	};
}
