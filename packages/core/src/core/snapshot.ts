import { BLOCK_BY_NAME, invalidOptionAttributes } from "../blocks/derive";
import { createTranslator } from "../i18n";
import { blockSpansOf } from "../mdx/block-spans";
import { DIRECTIVE_BY_COMPONENT } from "../mdx/directives";
import { splitFrontmatter } from "../mdx/frontmatter";
import { isAllowedImageSrc } from "../mdx/image-src";
import {
	type Body,
	bodyFromDocument,
	bodyFromMdx,
	readStoredDocument,
	type StoredDocument,
} from "../mdx/stored-document";
import { MAX_TABLE_COLUMNS } from "../mdx/table-layout";
import type { CmsBodyPosition, CmsImageSource } from "../mdx/types";
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
import { CodeRefCollector } from "./code-refs";
import { COLLECTION_DEFINITIONS, isCollection } from "./collections";
import { computeContentHash, sortKeys } from "./content-hash";
import { isUuid } from "./ids";
import { parseInternalLink } from "./links";
import { PREFIXED_LOCALES } from "./locales";
import { coreMessages } from "./messages";
import { normalizeSlugInput } from "./slug";
import { parseTranslationState } from "./translation/state";
import {
	type Collection,
	type InternalLinkSource,
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

export const MAX_MDX_BYTES = 2 * 1024 * 1024;
/** A stored document given instead of MDX (JSON spells the same body out at a few times the size). */
export const MAX_DOC_BYTES = 8 * 1024 * 1024;
export const MAX_METADATA_BYTES = 256 * 1024;

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

/** Keys a service input must have: the body is `doc` when that key is present, otherwise `mdx`. */
export const serviceInputKeys = (input: unknown): readonly string[] => [
	"collection",
	"slug",
	"metadata",
	input !== null && typeof input === "object" && Object.hasOwn(input, "doc") ? "doc" : "mdx",
];

/** The body of a service input in both forms. Blocks inherit their ids from `previous`, the body being replaced, where the input has none. */
const inputBody = (input: ServiceInput, previous: StoredDocument | null | undefined): Body => {
	if (input.doc !== undefined) {
		let size: number;
		try {
			size = Buffer.byteLength(JSON.stringify(input.doc) ?? "", "utf8");
		} catch {
			throw new ServiceError("invalid_input");
		}
		if (size > MAX_DOC_BYTES) throw new ServiceError("mdx_too_large");
		const doc = readStoredDocument(input.doc);
		if (!doc) throw new ServiceError("invalid_input");
		const body = bodyFromDocument(doc, undefined, { previous });
		if (Buffer.byteLength(body.mdx, "utf8") > MAX_MDX_BYTES) throw new ServiceError("mdx_too_large");
		return body;
	}
	if (typeof input.mdx !== "string") throw new ServiceError("invalid_input");
	if (Buffer.byteLength(input.mdx, "utf8") > MAX_MDX_BYTES) throw new ServiceError("mdx_too_large");
	return bodyFromMdx(input.mdx, undefined, { previous });
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

type MdxNode = {
	type?: unknown;
	name?: unknown;
	url?: unknown;
	identifier?: unknown;
	label?: unknown;
	lang?: unknown;
	meta?: unknown;
	value?: unknown;
	attributes?: unknown;
	children?: unknown;
	position?: {
		start?: { line?: unknown; column?: unknown; offset?: unknown };
		end?: { offset?: unknown };
	};
};
type MdxAttribute = { type?: unknown; name?: unknown; value?: unknown };

const isMdxNode = (node: unknown): node is MdxNode => typeof node === "object" && node !== null;
const isJsxElement = (node: MdxNode) => node.type === "mdxJsxFlowElement" || node.type === "mdxJsxTextElement";

const readAttr = (node: MdxNode, key: string): MdxAttribute | undefined =>
	(Array.isArray(node.attributes) ? node.attributes : []).find(
		(a: unknown): a is MdxAttribute => isMdxNode(a) && (a as MdxAttribute).name === key,
	);

/** The attribute's string value if present; `true` for value-less attributes like `{decorative}`. */
const readAttrValue = (node: MdxNode, key: string): string | true | undefined => {
	const attr = readAttr(node, key);
	if (!attr) return undefined;
	if (attr.value === null || attr.value === undefined) return true;
	return typeof attr.value === "string" ? attr.value : undefined;
};

function findNamedJsxChildren(node: MdxNode, name: string): MdxNode[] {
	const found: MdxNode[] = [];
	const walk = (children: unknown) => {
		for (const child of Array.isArray(children) ? children : []) {
			if (!isMdxNode(child)) continue;
			if (isJsxElement(child) && child.name === name) {
				found.push(child);
			} else if (child.type === "paragraph" && Array.isArray(child.children)) {
				walk(child.children);
			}
		}
	};
	walk(node.children);
	return found;
}

const tCore = createTranslator(coreMessages);

/** Maximum rows/columns one merged cell can span. Same as the column limit of tables in the editor and the public render. */
const MAX_TABLE_SPAN = MAX_TABLE_COLUMNS;

/** A cell's `colspan`/`rowspan`. 1 if absent or not a string; a value that is not a positive integer is returned as invalid. */
function readSpan(cell: MdxNode, key: "colspan" | "rowspan"): { span: number } | { invalid: string } {
	const raw = readAttrValue(cell, key);
	if (typeof raw !== "string") return { span: 1 };
	const parsed = Number.parseInt(raw, 10);
	return Number.isNaN(parsed) || parsed < 1 || String(parsed) !== raw.trim() ? { invalid: raw } : { span: parsed };
}

type TableSpanReason =
	| "invalid_colspan"
	| "invalid_rowspan"
	| "rowspan_overflow"
	| "span_too_large"
	| "span_overlap"
	| "ragged_rows";

/**
 * Checks table cell merges (colspan/rowspan) and grid structure, and warns about invalid spans.
 */
function checkTableSpans(tableNode: MdxNode, position: CmsBodyPosition, warnings: Issue[]) {
	const rows = findNamedJsxChildren(tableNode, "TableRow");
	const totalRows = rows.length;
	if (totalRows === 0) return;

	const grid: boolean[][] = Array.from({ length: totalRows }, () => []);
	let hasSpanIssue = false;
	const warn = (reason: TableSpanReason, params: Record<string, string | number> = {}) => {
		warnings.push({
			code: "invalid_table_span",
			message: tCore(`table.${reason}`, params),
			params: { reason, ...params },
			path: "mdx",
			position,
		});
		hasSpanIssue = true;
	};

	for (let r = 0; r < totalRows; r += 1) {
		const row = rows[r];
		if (!row) continue;
		const cells = findNamedJsxChildren(row, "TableCell");
		let c = 0;

		for (const cell of cells) {
			while (grid[r]?.[c]) {
				c += 1;
			}

			let cs = 1;
			const colspan = readSpan(cell, "colspan");
			if ("invalid" in colspan) warn("invalid_colspan", { value: colspan.invalid });
			else cs = colspan.span;

			let rs = 1;
			const rowspan = readSpan(cell, "rowspan");
			if ("invalid" in rowspan) warn("invalid_rowspan", { value: rowspan.invalid });
			else rs = rowspan.span;

			// Limit so that a huge span from external MDX cannot blow up the grid computation.
			const overflowsRows = r + rs > totalRows;
			if (cs > MAX_TABLE_SPAN || rs > MAX_TABLE_SPAN || c + cs > MAX_TABLE_SPAN || overflowsRows) {
				if (overflowsRows) warn("rowspan_overflow", { rowspan: rs, rows: totalRows });
				else warn("span_too_large", { max: MAX_TABLE_SPAN });
				continue;
			}

			let overlap = false;
			for (let dr = 0; dr < rs; dr += 1) {
				for (let dc = 0; dc < cs; dc += 1) {
					const covered = grid[r + dr];
					if (!covered) continue;
					if (covered[c + dc]) overlap = true;
					covered[c + dc] = true;
				}
			}
			if (overlap) warn("span_overlap");

			c += cs;
		}
	}

	if (!hasSpanIssue) {
		const maxWidth = Math.max(...grid.map((row) => row.length), 0);
		const hasGapOrMismatch = grid.some((row) => {
			if (row.length !== maxWidth) return true;
			for (let i = 0; i < maxWidth; i += 1) {
				if (!row[i]) return true;
			}
			return false;
		});
		if (hasGapOrMismatch) {
			warn("ragged_rows");
		}
	}
}

/**
 * Block attribute rules. Blocks only publishing; draft saves and visual editing are not blocked.
 * The storage syntax (directive) and the read-compatible JSX are parsed with the same component names, so they are checked only once.
 */
function checkBlockAttributes(node: MdxNode, position: CmsBodyPosition, issues: Issue[], warnings: Issue[]) {
	const name = typeof node.name === "string" ? node.name : "";
	const definition = DIRECTIVE_BY_COMPONENT.get(name);
	if (!definition) return;

	for (const key of definition.required) {
		const value = readAttrValue(node, key);
		if (typeof value !== "string" || value.trim() === "") {
			issues.push({ code: "missing_block_attribute", message: `${definition.name}.${key}`, path: "mdx", position });
		}
	}
	for (const attr of Array.isArray(node.attributes) ? node.attributes : []) {
		const attrName = isMdxNode(attr) ? (attr as MdxAttribute).name : undefined;
		if (typeof attrName === "string" && !Object.hasOwn(definition.attributes, attrName)) {
			warnings.push({
				code: "unknown_block_attribute",
				message: `${definition.name}.${attrName}`,
				path: "mdx",
				position,
			});
		}
	}

	// Attributes with a fixed set of choices (alignment, callout kind, etc.) accept only the values from the block definition.
	const block = BLOCK_BY_NAME.get(definition.name);
	if (block) {
		const values = Object.fromEntries(Object.keys(block.attributes).map((key) => [key, readAttrValue(node, key)]));
		for (const key of invalidOptionAttributes(block, values)) {
			issues.push({
				code: "invalid_block_attribute",
				message: `${definition.name}.${key}=${String(values[key])}`,
				path: "mdx",
				position,
			});
		}
	}

	// Attributes that must be one of a child block's values (e.g. the initially open tab → tab name).
	for (const [key, attribute] of Object.entries(block?.attributes ?? {})) {
		const childKey = attribute.childValue;
		if (!block || !childKey) continue;
		const value = readAttrValue(node, key);
		if (typeof value !== "string" || !value) continue;
		const childComponents = new Set(
			(block.children?.blocks ?? []).flatMap((child) => BLOCK_BY_NAME.get(child)?.component ?? []),
		);
		const values: string[] = [];
		const collect = (children: unknown) => {
			for (const child of Array.isArray(children) ? children : []) {
				if (!isMdxNode(child)) continue;
				if (isJsxElement(child) && childComponents.has(String(child.name ?? ""))) {
					const childValue = readAttrValue(child, childKey);
					if (typeof childValue === "string") values.push(childValue);
				} else if (child.type === "paragraph") {
					collect(child.children);
				}
			}
		};
		collect(node.children);
		if (!values.includes(value)) {
			issues.push({ code: "invalid_block_attribute", message: `${block.name}.${key}=${value}`, path: "mdx", position });
		}
	}

	if (name === "Table") {
		checkTableSpans(node, position, warnings);
	}

	if (name === "Image") {
		const decorative = readAttrValue(node, "decorative") === true;
		const alt = readAttrValue(node, "alt");
		// A missing alt on a new image that needs a description (registered media) must be fixed before publishing.
		// External or relative-path images (`src`) from migrated content are handled in the migration report, so they are not blocked.
		if (!decorative && readAttr(node, "mediaId") && (typeof alt !== "string" || !alt.trim())) {
			issues.push({ code: "missing_image_alt", path: "mdx", position });
		}
	}
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

	// The body is checked as it will be stored (written from its document), so issue positions point into the stored text.
	const body = inputBody(input, options?.previousDoc);
	const { analysis } = body;
	const mdxIssues: Issue[] = analysis.errors.map((e) => ({
		code: "mdx_error",
		message: e.message,
		params: { reason: e.code, ...e.params },
		position: e.position,
	}));
	let mdxHasError = analysis.errors.length > 0;
	const blockIssues: Issue[] = [];
	const warnings: Issue[] = metadataWarnings(rawCollection, metadata);

	const mdxRefsToAdd: { kind: ReferenceKind; targetId: string; occ: ReferenceOccurrence }[] = [];
	const imageSources: CmsImageSource[] = [];
	const internalLinks: InternalLinkSource[] = [];

	// Found when the first position needs it: a body with nothing to report never pays for it.
	let blockSpans: ReturnType<typeof blockSpansOf> | undefined;
	const blockIdAt = (offset: number) => {
		blockSpans ??= blockSpansOf(analysis, body.doc);
		return blockSpans.blockIdAt(offset);
	};
	/** Where a node starts in the stored MDX, and the block of the stored document it is in (none when the body has no document). */
	const positionOf = (node: MdxNode): CmsBodyPosition => {
		const pos = node.position?.start;
		const blockId = typeof pos?.offset === "number" ? blockIdAt(pos.offset) : undefined;
		return {
			line: (typeof pos?.line === "number" ? pos.line : 1) + analysis.sourceLineOffset,
			column: typeof pos?.column === "number" ? pos.column : 1,
			...(blockId === undefined ? {} : { blockId }),
		};
	};

	const definitions = new Map<string, string>();
	const collectDefinitions = (node: unknown) => {
		if (!isMdxNode(node)) return;
		if (node.type === "definition" && typeof node.identifier === "string" && typeof node.url === "string") {
			definitions.set(node.identifier, node.url);
		}
		if (Array.isArray(node.children)) node.children.forEach(collectDefinitions);
	};
	collectDefinitions(analysis.tree);

	const addInternalLink = (url: unknown, node: MdxNode) => {
		if (typeof url !== "string") return;
		const parsed = parseInternalLink(url);
		if (parsed) internalLinks.push({ ...parsed, position: positionOf(node) });
	};

	const addMdxError = (code: string, position: CmsBodyPosition) => {
		mdxIssues.push({ code, position });
		mdxHasError = true;
	};

	/** Text of a reference ID attribute. Missing or empty is `missing_media_id`; an expression (`{...}`) is a `dynamic_reference_id` issue. */
	const staticReferenceId = (attr: MdxAttribute | undefined): { id: string } | { problem: string } =>
		!attr || attr.value === null || attr.value === undefined || attr.value === ""
			? { problem: "missing_media_id" }
			: typeof attr.value !== "string"
				? { problem: "dynamic_reference_id" }
				: { id: attr.value };

	/** Collected as registered-media references. A non-UUID is a body error. Kept as a reference so a file in use is not deleted. */
	const addMediaReference = (mediaId: string, position: CmsBodyPosition) => {
		if (!isUuid(mediaId)) addMdxError("invalid_reference_id", position);
		else mdxRefsToAdd.push({ kind: "media", targetId: mediaId, occ: { type: "mdx", ...position } });
	};

	const collectImage = (node: MdxNode) => {
		// An image uses either `mediaId` (registered media) or `src` (external address).
		// Only `mediaId` goes to the reference table. `src` is an external address, not a reference.
		const mediaIdAttr = readAttr(node, "mediaId");
		const srcAttr = readAttr(node, "src");
		const attr = mediaIdAttr ?? srcAttr;
		const position = positionOf(node);

		const reference = staticReferenceId(attr);
		if ("problem" in reference) addMdxError(reference.problem, position);
		else if (attr === mediaIdAttr) addMediaReference(reference.id, position);

		const mediaId = typeof mediaIdAttr?.value === "string" ? mediaIdAttr.value : undefined;
		const src = typeof srcAttr?.value === "string" ? srcAttr.value : undefined;
		if (mediaId || src) imageSources.push({ ...(mediaId ? { mediaId } : { src }), position });
	};

	/** Attached file card. `mediaId` is required. */
	const collectFile = (node: MdxNode) => {
		const attr = readAttr(node, "mediaId");
		const position = positionOf(node);
		const reference = staticReferenceId(attr);
		if ("problem" in reference) addMdxError(reference.problem, position);
		else addMediaReference(reference.id, position);
	};

	// Footnotes: a definition is found by its normalized identifier (case-insensitive), the label is reported as written.
	const footnoteReferences = new Set<string>();
	const footnoteDefinitions: { identifier: string; label: string; node: MdxNode }[] = [];
	const textNodes: MdxNode[] = [];
	const { body: mdxBody } = splitFrontmatter(body.mdx);
	const footnoteIdentifier = (label: string) => label.trim().replace(/\s+/g, " ").toLowerCase();

	/** Translation hint text left in a translation. It is not visible on the public screen, so it must not be published as is. */
	const untranslated: CmsBodyPosition[] = [];
	const codeRefs = new CodeRefCollector();
	const traverse = (node: unknown) => {
		if (!isMdxNode(node)) return;
		if (node.type === "link") {
			addInternalLink(node.url, node);
		} else if (node.type === "linkReference" && typeof node.identifier === "string") {
			addInternalLink(definitions.get(node.identifier), node);
		}
		if (node.type === "image" && typeof node.url === "string" && node.url) {
			// A Markdown image is an external `src` like `<Image src>` (a plain one is stored as Markdown), so it gets the same source check.
			imageSources.push({ src: node.url, position: positionOf(node) });
		}
		if (node.type === "footnoteReference" && typeof node.identifier === "string") {
			footnoteReferences.add(node.identifier);
		} else if (node.type === "footnoteDefinition" && typeof node.identifier === "string") {
			footnoteDefinitions.push({
				identifier: node.identifier,
				label: typeof node.label === "string" ? node.label : node.identifier,
				node,
			});
		} else if (node.type === "text") {
			textNodes.push(node);
		} else if (node.type === "code") {
			codeRefs.addCode(node, positionOf(node));
		}
		if (isJsxElement(node)) {
			// `ContentLink` has been retired — `analyze` rejects it if it remains in the body.
			if (node.name === "Image") collectImage(node);
			if (node.name === "File") collectFile(node);
			if (node.name === "Untranslated") untranslated.push(positionOf(node));
			checkBlockAttributes(node, positionOf(node), blockIssues, warnings);
			if (typeof node.name === "string") {
				codeRefs.addElement(node.name, (key) => readAttrValue(node, key), positionOf(node));
			}
		}
		if (Array.isArray(node.children)) node.children.forEach(traverse);
	};
	traverse(analysis.tree);

	// Footnote problems never block publishing, but they leave a dangling marker or a stray note on the public page.
	const seenDefinitions = new Set<string>();
	for (const definition of footnoteDefinitions) {
		const params = { label: definition.label };
		if (seenDefinitions.has(definition.identifier)) {
			warnings.push({
				code: "footnote_definition_duplicate",
				message: definition.label,
				params,
				path: "mdx",
				position: positionOf(definition.node),
			});
		} else if (!footnoteReferences.has(definition.identifier)) {
			warnings.push({
				code: "footnote_definition_unused",
				message: definition.label,
				params,
				path: "mdx",
				position: positionOf(definition.node),
			});
		}
		seenDefinitions.add(definition.identifier);
	}
	// A marker without a definition is not parsed as a reference (it stays as text), so it is found in the raw text of text nodes.
	// The raw source is read so that an escaped marker (`\[^a]`) is not reported.
	for (const node of textNodes) {
		const start = node.position?.start?.offset;
		const end = node.position?.end?.offset;
		if (typeof start !== "number" || typeof end !== "number") continue;
		for (const match of mdxBody.slice(start, end).matchAll(/(?<!\\)\[\^([^\]\s\\]+)\]/g)) {
			const label = match[1] ?? "";
			if (seenDefinitions.has(footnoteIdentifier(label))) continue;
			warnings.push({
				code: "footnote_definition_missing",
				message: label,
				params: { label },
				path: "mdx",
				position: positionOf(node),
			});
		}
	}

	// Links to code lines are checked only in a body that parsed: an error may have cut the code block a link points to.
	if (!mdxHasError) {
		const codeRefIssues = codeRefs.check();
		blockIssues.push(...codeRefIssues.issues);
		warnings.push(...codeRefIssues.warnings);
	}

	if (mdxHasError) {
		// For a body that could not be analyzed, past body references stay stale. Past references come only from the repository.
		for (const ref of options?.previousReferences ?? []) {
			for (const occ of ref.occurrences) {
				if (occ.type !== "metadata") collector.add(ref.kind, ref.targetId, { ...occ }, true);
			}
		}
	} else {
		for (const item of mdxRefsToAdd) collector.add(item.kind, item.targetId, item.occ, false);
	}

	const issues: Issue[] = [...mdxIssues, ...blockIssues];
	const firstUntranslated = untranslated[0];
	if (firstUntranslated) {
		issues.push({
			code: "untranslated_text",
			position: firstUntranslated,
			message: tCore("untranslatedCount", { count: untranslated.length }),
			params: { count: untranslated.length },
		});
	}
	if (analysis.frontmatter !== null) {
		issues.push({ code: "frontmatter_present", path: "frontmatter", position: { line: 1, column: 1 } });
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
		mdx: body.mdx,
		doc: body.doc,
		schemaVersion,
		contentHash: computeContentHash(metadata, body.mdx, schemaVersion, analysis),
		references: Object.freeze(
			collector.refs.map((ref) =>
				Object.freeze({ ...ref, occurrences: Object.freeze(ref.occurrences.map((o) => Object.freeze({ ...o }))) }),
			),
		),
		issues: freeze(issues),
		warnings: freeze(warnings),
		internalLinks: Object.freeze(
			internalLinks.map((link) => Object.freeze({ ...link, position: Object.freeze({ ...link.position }) })),
		),
		imageSources: freeze(imageSources),
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
 * Collects only the image warnings to include in the publish response. **Non-blocking**; if computation fails it returns an empty array.
 *
 * For media that is `ready` with a `storageKey`, if `headStorageKey` is provided, the actual object in storage is checked once more.
 * If it is missing, an `image_media_missing_in_storage` warning is added. On an infrastructure error it falls back to the DB decision.
 */
export async function imageWarningsForPublish(input: {
	collection: Collection;
	slug: string | null;
	metadata: { readonly [key: string]: unknown };
	mdx: string;
	getMediaAsset: (id: string) => Promise<{ status?: string; storageKey?: string | null } | null>;
	headStorageKey?: (storageKey: string) => Promise<boolean>;
}): Promise<Issue[]> {
	try {
		const snapshot = await prepareSnapshot(
			{
				collection: input.collection,
				slug: input.slug,
				metadata: input.metadata,
				mdx: input.mdx,
			} as ServiceInput,
			{ previousMetadata: input.metadata },
		);
		const mediaIds = [
			...new Set(snapshot.imageSources.map((s) => s.mediaId).filter((v): v is string => typeof v === "string")),
		];
		const media: ResolvedTargets["media"] = [];
		for (const id of mediaIds) {
			const row = await input.getMediaAsset(id);
			if (row) media.push({ id, status: row.status, storageKey: row.storageKey ?? null });
		}
		const warnings = [...(snapshot.warnings ?? []), ...imageWarnings(snapshot.imageSources, media)];
		if (input.headStorageKey) {
			const byId = new Map(media.map((row) => [row.id, row]));
			for (const source of snapshot.imageSources) {
				const row = source.mediaId ? byId.get(source.mediaId) : undefined;
				if (row?.status !== "ready" || !row.storageKey) continue;
				const exists = await input.headStorageKey(row.storageKey).catch(() => true);
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
	const occurrenceIssue = (code: string, occurrence: ReferenceOccurrence | undefined, message?: string): Issue => ({
		code,
		...(message ? { message } : {}),
		...(occurrence?.type === "mdx"
			? {
					position: {
						line: occurrence.line,
						column: occurrence.column,
						...(occurrence.blockId === undefined ? {} : { blockId: occurrence.blockId }),
					},
				}
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
	if (schemaOf(snapshot.collection).body && snapshot.mdx.trim() === "") {
		issues.push({ code: "empty_body", path: "mdx", position: { line: 1, column: 1 } });
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
			for (const occurrence of occurrences) issues.push(occurrenceIssue(code, occurrence, ref.targetId));
		};

		if (ref.kind === "media") {
			if (!resolved.media.some((m) => m.id === ref.targetId)) addForAll("unresolved_media");
			continue;
		}

		const target = resolved.targets.find((t) => t.id === ref.targetId);
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
			issues.push({ code: "unresolved_internal_link", message: source.url, path: "mdx", position: source.position });
		} else if (target.addressType === "reservation" || !target.isPublished) {
			issues.push({ code: "unpublished_internal_link", message: source.url, path: "mdx", position: source.position });
		}
	}

	// Image resolution failures and attributes not in the definition are only warnings — they do not change `ready`.
	return {
		ready: issues.length === 0,
		issues,
		warnings: [...(snapshot.warnings ?? []), ...imageWarnings(snapshot.imageSources, resolved.media)],
	};
}
