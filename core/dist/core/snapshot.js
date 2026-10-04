import { createHash } from "node:crypto";
import { BLOCK_BY_NAME, invalidOptionAttributes } from "../blocks/derive.js";
import { createTranslator } from "../i18n/index.js";
import { analyze } from "../mdx/analyze.js";
import { DIRECTIVE_BY_COMPONENT } from "../mdx/directives.js";
import { isAllowedImageSrc } from "../mdx/image-src.js";
import { MAX_TABLE_COLUMNS } from "../mdx/table-layout.js";
import { fieldValueError, metadataReferences, missingRequiredIssues, normalizeRecordTranslations, RECORD_TRANSLATIONS_KEY, relationRule, schemaOf, storedField, } from "../schema/derive.js";
import { COLLECTION_DEFINITIONS, isCollection } from "./collections.js";
import { isUuid } from "./ids.js";
import { parseInternalLink } from "./links.js";
import { PREFIXED_LOCALES } from "./locales.js";
import { coreMessages } from "./messages.js";
import { normalizeSlugInput } from "./slug.js";
import { parseTranslationState } from "./translation/state.js";
import { ServiceError, } from "./types.js";
/**
 * Snapshot preparation and publish validation. Pure rules; knows nothing about the DB or HTTP.
 * The service (draft save) and the repository implementation (re-validation inside the publish transaction) use the same rules.
 */
export const MAX_MDX_BYTES = 2 * 1024 * 1024;
export const MAX_METADATA_BYTES = 256 * 1024;
const isJsonArray = (value) => Array.isArray(value);
function sortKeys(obj) {
    if (obj === null || typeof obj !== "object")
        return obj;
    if (isJsonArray(obj))
        return obj.map(sortKeys);
    const record = obj;
    return Object.keys(record)
        .sort()
        .reduce((acc, key) => {
        const val = record[key];
        if (val !== undefined)
            acc[key] = sortKeys(val);
        return acc;
    }, {});
}
/** Content hash of a snapshot. The same metadata and body give the same value regardless of key order. */
export function computeContentHash(metadata, mdx, schemaVersion = 1) {
    const tuple = ["cms-snapshot-v1", schemaVersion, sortKeys(metadata), mdx];
    return createHash("sha256").update(JSON.stringify(tuple)).digest("hex");
}
class ReferenceCollector {
    refs = [];
    add(kind, targetId, occurrence, isStale = false) {
        let ref = this.refs.find((r) => r.kind === kind && r.targetId === targetId);
        if (!ref) {
            ref = { kind, targetId, isStale, occurrences: [] };
            this.refs.push(ref);
        }
        else if (isStale) {
            ref.isStale = true;
        }
        ref.occurrences.push(occurrence);
    }
}
/** Collects metadata relation fields as references, in collection-definition order. Preserves order and duplicates. */
function addMetadataReferences(collector, collection, metadata) {
    for (const ref of metadataReferences(collection, metadata)) {
        collector.add(ref.kind, ref.targetId, {
            type: "metadata",
            path: ref.path,
            ...(ref.ordinal === undefined ? {} : { ordinal: ref.ordinal }),
        });
    }
}
/** Is this a plain object with exactly the allowed keys? Getters and inherited properties are rejected. */
export function validateExactRecord(value, expectedKeys) {
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
export const SERVICE_INPUT_KEYS = ["collection", "slug", "metadata", "mdx"];
/**
 * Field value error. The error code is the same regardless of field name. Exceeding the length limit (`field_too_long`) is reported through the issue (`issues`)'s
 * `path` (field name) and `message` (field label) (the admin screen shows it as "<label> is too long.").
 */
function fieldValueServiceError(code, path, label) {
    if (code !== "field_too_long")
        return new ServiceError(code);
    return new ServiceError(code, [{ code, path, ...(label ? { message: label } : {}) }]);
}
function validateMetadata(collection, raw) {
    if (!raw ||
        typeof raw !== "object" ||
        Array.isArray(raw) ||
        (Object.getPrototypeOf(raw) !== Object.prototype && Object.getPrototypeOf(raw) !== null)) {
        throw new ServiceError("invalid_input");
    }
    for (const key of Reflect.ownKeys(raw)) {
        if (typeof key !== "string")
            throw new ServiceError("invalid_input");
        const desc = Object.getOwnPropertyDescriptor(raw, key);
        if (!desc?.enumerable || desc.get || desc.set)
            throw new ServiceError("invalid_input");
    }
    const input = raw;
    // Allowed keys, storage format and value rules come from the collection definition.
    const rules = COLLECTION_DEFINITIONS[collection].fields;
    const metadata = {};
    for (const [k, v] of Object.entries(input)) {
        if (k === RECORD_TRANSLATIONS_KEY) {
            // Per-locale names of a record collection. The default-locale value lives in the field itself.
            const normalized = normalizeRecordTranslations(collection, v, PREFIXED_LOCALES);
            if ("error" in normalized) {
                const { error, path, label } = normalized;
                throw path ? fieldValueServiceError(error, path, label) : new ServiceError(error);
            }
            if (Object.keys(normalized.value).length > 0)
                metadata[k] = normalized.value;
            continue;
        }
        const stored = storedField(collection, k);
        if (!stored || !Object.hasOwn(rules, k))
            throw new ServiceError("invalid_metadata_key");
        if (rules[k] === "string") {
            if (typeof v !== "string")
                throw new ServiceError("invalid_metadata_type");
            metadata[k] = v;
        }
        else {
            if (!Array.isArray(v) || Object.getPrototypeOf(v) !== Array.prototype) {
                throw new ServiceError("invalid_metadata_type");
            }
            if (Reflect.ownKeys(v).length !== v.length + 1)
                throw new ServiceError("invalid_metadata_type");
            for (let i = 0; i < v.length; i++) {
                const desc = Object.getOwnPropertyDescriptor(v, String(i));
                if (!desc || desc.get || desc.set)
                    throw new ServiceError("invalid_metadata_type");
                if (typeof v[i] !== "string")
                    throw new ServiceError("invalid_metadata_type");
            }
            metadata[k] = Object.freeze([...v]);
        }
        const value = metadata[k];
        const error = typeof value === "string" || Array.isArray(value) ? fieldValueError(stored.field, value) : null;
        if (error)
            throw fieldValueServiceError(error, k, stored.field.label);
    }
    if (Buffer.byteLength(JSON.stringify(sortKeys(metadata)), "utf8") > MAX_METADATA_BYTES) {
        throw new ServiceError("metadata_too_large");
    }
    return metadata;
}
const isMdxNode = (node) => typeof node === "object" && node !== null;
const isJsxElement = (node) => node.type === "mdxJsxFlowElement" || node.type === "mdxJsxTextElement";
const readAttr = (node, key) => (Array.isArray(node.attributes) ? node.attributes : []).find((a) => isMdxNode(a) && a.name === key);
/** The attribute's string value if present; `true` for value-less attributes like `{decorative}`. */
const readAttrValue = (node, key) => {
    const attr = readAttr(node, key);
    if (!attr)
        return undefined;
    if (attr.value === null || attr.value === undefined)
        return true;
    return typeof attr.value === "string" ? attr.value : undefined;
};
function findNamedJsxChildren(node, name) {
    const found = [];
    const walk = (children) => {
        for (const child of Array.isArray(children) ? children : []) {
            if (!isMdxNode(child))
                continue;
            if (isJsxElement(child) && child.name === name) {
                found.push(child);
            }
            else if (child.type === "paragraph" && Array.isArray(child.children)) {
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
function readSpan(cell, key) {
    const raw = readAttrValue(cell, key);
    if (typeof raw !== "string")
        return { span: 1 };
    const parsed = Number.parseInt(raw, 10);
    return Number.isNaN(parsed) || parsed < 1 || String(parsed) !== raw.trim() ? { invalid: raw } : { span: parsed };
}
/**
 * Checks table cell merges (colspan/rowspan) and grid structure, and warns about invalid spans.
 */
function checkTableSpans(tableNode, position, warnings) {
    const rows = findNamedJsxChildren(tableNode, "TableRow");
    const totalRows = rows.length;
    if (totalRows === 0)
        return;
    const grid = Array.from({ length: totalRows }, () => []);
    let hasSpanIssue = false;
    const warn = (reason, params = {}) => {
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
        if (!row)
            continue;
        const cells = findNamedJsxChildren(row, "TableCell");
        let c = 0;
        for (const cell of cells) {
            while (grid[r]?.[c]) {
                c += 1;
            }
            let cs = 1;
            const colspan = readSpan(cell, "colspan");
            if ("invalid" in colspan)
                warn("invalid_colspan", { value: colspan.invalid });
            else
                cs = colspan.span;
            let rs = 1;
            const rowspan = readSpan(cell, "rowspan");
            if ("invalid" in rowspan)
                warn("invalid_rowspan", { value: rowspan.invalid });
            else
                rs = rowspan.span;
            // Limit so that a huge span from external MDX cannot blow up the grid computation.
            const overflowsRows = r + rs > totalRows;
            if (cs > MAX_TABLE_SPAN || rs > MAX_TABLE_SPAN || c + cs > MAX_TABLE_SPAN || overflowsRows) {
                if (overflowsRows)
                    warn("rowspan_overflow", { rowspan: rs, rows: totalRows });
                else
                    warn("span_too_large", { max: MAX_TABLE_SPAN });
                continue;
            }
            let overlap = false;
            for (let dr = 0; dr < rs; dr += 1) {
                for (let dc = 0; dc < cs; dc += 1) {
                    const covered = grid[r + dr];
                    if (!covered)
                        continue;
                    if (covered[c + dc])
                        overlap = true;
                    covered[c + dc] = true;
                }
            }
            if (overlap)
                warn("span_overlap");
            c += cs;
        }
    }
    if (!hasSpanIssue) {
        const maxWidth = Math.max(...grid.map((row) => row.length), 0);
        const hasGapOrMismatch = grid.some((row) => {
            if (row.length !== maxWidth)
                return true;
            for (let i = 0; i < maxWidth; i += 1) {
                if (!row[i])
                    return true;
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
function checkBlockAttributes(node, position, issues, warnings) {
    const name = typeof node.name === "string" ? node.name : "";
    const definition = DIRECTIVE_BY_COMPONENT.get(name);
    if (!definition)
        return;
    for (const key of definition.required) {
        const value = readAttrValue(node, key);
        if (typeof value !== "string" || value.trim() === "") {
            issues.push({ code: "missing_block_attribute", message: `${definition.name}.${key}`, path: "mdx", position });
        }
    }
    for (const attr of Array.isArray(node.attributes) ? node.attributes : []) {
        const attrName = isMdxNode(attr) ? attr.name : undefined;
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
        if (!block || !childKey)
            continue;
        const value = readAttrValue(node, key);
        if (typeof value !== "string" || !value)
            continue;
        const childComponents = new Set((block.children?.blocks ?? []).flatMap((child) => BLOCK_BY_NAME.get(child)?.component ?? []));
        const values = [];
        const collect = (children) => {
            for (const child of Array.isArray(children) ? children : []) {
                if (!isMdxNode(child))
                    continue;
                if (isJsxElement(child) && childComponents.has(String(child.name ?? ""))) {
                    const childValue = readAttrValue(child, childKey);
                    if (typeof childValue === "string")
                        values.push(childValue);
                }
                else if (child.type === "paragraph") {
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
export async function prepareSnapshot(input, options) {
    if (!input || typeof input !== "object" || Array.isArray(input)) {
        throw new ServiceError("invalid_input");
    }
    validateExactRecord(input, [
        ...SERVICE_INPUT_KEYS,
        ...(input.folderId === undefined ? [] : ["folderId"]),
        ...(input.translation === undefined ? [] : ["translation"]),
    ]);
    const translation = input.translation === undefined ? undefined : parseTranslationState(input.translation);
    if (input.translation !== undefined && translation === undefined)
        throw new ServiceError("invalid_input");
    const rawCollection = input.collection;
    if (typeof rawCollection !== "string")
        throw new ServiceError("invalid_input");
    if (!isCollection(rawCollection))
        throw new ServiceError("unknown_collection");
    if (input.slug !== undefined && input.slug !== null && typeof input.slug !== "string") {
        throw new ServiceError("invalid_input");
    }
    if (typeof input.mdx !== "string")
        throw new ServiceError("invalid_input");
    if (Buffer.byteLength(input.mdx, "utf8") > MAX_MDX_BYTES)
        throw new ServiceError("mdx_too_large");
    const normalizedSlug = normalizeSlugInput(input.slug);
    if ("error" in normalizedSlug)
        throw new ServiceError(normalizedSlug.error);
    const slug = normalizedSlug.slug;
    const metadata = validateMetadata(rawCollection, input.metadata);
    const collector = new ReferenceCollector();
    addMetadataReferences(collector, rawCollection, metadata);
    const analysis = analyze(input.mdx);
    const mdxIssues = analysis.errors.map((e) => ({
        code: "mdx_error",
        message: e.message,
        params: { reason: e.code, ...e.params },
        position: e.position,
    }));
    let mdxHasError = analysis.errors.length > 0;
    const blockIssues = [];
    const warnings = [];
    const mdxRefsToAdd = [];
    const imageSources = [];
    const internalLinks = [];
    const positionOf = (node) => {
        const pos = node.position?.start;
        return {
            line: (typeof pos?.line === "number" ? pos.line : 1) + analysis.sourceLineOffset,
            column: typeof pos?.column === "number" ? pos.column : 1,
        };
    };
    const definitions = new Map();
    const collectDefinitions = (node) => {
        if (!isMdxNode(node))
            return;
        if (node.type === "definition" && typeof node.identifier === "string" && typeof node.url === "string") {
            definitions.set(node.identifier, node.url);
        }
        if (Array.isArray(node.children))
            node.children.forEach(collectDefinitions);
    };
    collectDefinitions(analysis.tree);
    const addInternalLink = (url, node) => {
        if (typeof url !== "string")
            return;
        const parsed = parseInternalLink(url);
        if (parsed)
            internalLinks.push({ ...parsed, position: positionOf(node) });
    };
    const addMdxError = (code, position) => {
        mdxIssues.push({ code, position });
        mdxHasError = true;
    };
    /** Text of a reference ID attribute. Missing or empty is `missing_media_id`; an expression (`{...}`) is a `dynamic_reference_id` issue. */
    const staticReferenceId = (attr) => !attr || attr.value === null || attr.value === undefined || attr.value === ""
        ? { problem: "missing_media_id" }
        : typeof attr.value !== "string"
            ? { problem: "dynamic_reference_id" }
            : { id: attr.value };
    /** Collected as registered-media references. A non-UUID is a body error. Kept as a reference so a file in use is not deleted. */
    const addMediaReference = (mediaId, position) => {
        if (!isUuid(mediaId))
            addMdxError("invalid_reference_id", position);
        else
            mdxRefsToAdd.push({ kind: "media", targetId: mediaId, occ: { type: "mdx", ...position } });
    };
    const collectImage = (node) => {
        // An image uses either `mediaId` (registered media) or `src` (external address).
        // Only `mediaId` goes to the reference table. `src` is an external address, not a reference.
        const mediaIdAttr = readAttr(node, "mediaId");
        const srcAttr = readAttr(node, "src");
        const attr = mediaIdAttr ?? srcAttr;
        const position = positionOf(node);
        const reference = staticReferenceId(attr);
        if ("problem" in reference)
            addMdxError(reference.problem, position);
        else if (attr === mediaIdAttr)
            addMediaReference(reference.id, position);
        const mediaId = typeof mediaIdAttr?.value === "string" ? mediaIdAttr.value : undefined;
        const src = typeof srcAttr?.value === "string" ? srcAttr.value : undefined;
        if (mediaId || src)
            imageSources.push({ ...(mediaId ? { mediaId } : { src }), position });
    };
    /** Attached file card. `mediaId` is required. */
    const collectFile = (node) => {
        const attr = readAttr(node, "mediaId");
        const position = positionOf(node);
        const reference = staticReferenceId(attr);
        if ("problem" in reference)
            addMdxError(reference.problem, position);
        else
            addMediaReference(reference.id, position);
    };
    /** Translation hint text left in a translation. It is not visible on the public screen, so it must not be published as is. */
    const untranslated = [];
    const traverse = (node) => {
        if (!isMdxNode(node))
            return;
        if (node.type === "link") {
            addInternalLink(node.url, node);
        }
        else if (node.type === "linkReference" && typeof node.identifier === "string") {
            addInternalLink(definitions.get(node.identifier), node);
        }
        if (isJsxElement(node)) {
            // `ContentLink` has been retired — `analyze` rejects it if it remains in the body.
            if (node.name === "Image")
                collectImage(node);
            if (node.name === "File")
                collectFile(node);
            if (node.name === "Untranslated")
                untranslated.push(positionOf(node));
            checkBlockAttributes(node, positionOf(node), blockIssues, warnings);
        }
        if (Array.isArray(node.children))
            node.children.forEach(traverse);
    };
    traverse(analysis.tree);
    if (mdxHasError) {
        // For a body that could not be analyzed, past body references stay stale. Past references come only from the repository.
        for (const ref of options?.previousReferences ?? []) {
            for (const occ of ref.occurrences) {
                if (occ.type !== "metadata")
                    collector.add(ref.kind, ref.targetId, { ...occ }, true);
            }
        }
    }
    else {
        for (const item of mdxRefsToAdd)
            collector.add(item.kind, item.targetId, item.occ, false);
    }
    const issues = [...mdxIssues, ...blockIssues];
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
    const freeze = (items) => Object.freeze(items.map((item) => Object.freeze({ ...item })));
    return Object.freeze({
        collection: rawCollection,
        slug,
        metadata: Object.freeze(metadata),
        mdx: input.mdx,
        schemaVersion,
        contentHash: computeContentHash(metadata, input.mdx, schemaVersion),
        references: Object.freeze(collector.refs.map((ref) => Object.freeze({ ...ref, occurrences: Object.freeze(ref.occurrences.map((o) => Object.freeze({ ...o }))) }))),
        issues: freeze(issues),
        warnings: freeze(warnings),
        internalLinks: Object.freeze(internalLinks.map((link) => Object.freeze({ ...link, position: Object.freeze({ ...link.position }) }))),
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
const imageWarnings = (sources, media) => {
    const warnings = [];
    for (const source of sources) {
        if (source.src !== undefined) {
            if (!isAllowedImageSrc(source.src)) {
                warnings.push({ code: "image_src_not_allowed", message: source.src, position: source.position });
            }
            continue;
        }
        const row = source.mediaId === undefined ? undefined : media.find((m) => m.id === source.mediaId);
        if (!row)
            continue;
        if (row.status !== undefined && row.status !== "ready") {
            warnings.push({ code: "image_media_not_ready", message: row.status, position: source.position });
        }
        else if (row.storageKey !== undefined && !row.storageKey) {
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
export async function imageWarningsForPublish(input) {
    try {
        const snapshot = await prepareSnapshot({
            collection: input.collection,
            slug: input.slug,
            metadata: input.metadata,
            mdx: input.mdx,
        });
        const mediaIds = [
            ...new Set(snapshot.imageSources.map((s) => s.mediaId).filter((v) => typeof v === "string")),
        ];
        const media = [];
        for (const id of mediaIds) {
            const row = await input.getMediaAsset(id);
            if (row)
                media.push({ id, status: row.status, storageKey: row.storageKey ?? null });
        }
        const warnings = [...(snapshot.warnings ?? []), ...imageWarnings(snapshot.imageSources, media)];
        if (input.headStorageKey) {
            const byId = new Map(media.map((row) => [row.id, row]));
            for (const source of snapshot.imageSources) {
                const row = source.mediaId ? byId.get(source.mediaId) : undefined;
                if (row?.status !== "ready" || !row.storageKey)
                    continue;
                const exists = await input.headStorageKey(row.storageKey).catch(() => true);
                if (!exists) {
                    warnings.push({ code: "image_media_missing_in_storage", message: row.storageKey, position: source.position });
                }
            }
        }
        return warnings;
    }
    catch {
        return [];
    }
}
export function validateForPublish(snapshot, resolved) {
    const issues = [...snapshot.issues];
    const occurrenceIssue = (code, occurrence, message) => ({
        code,
        ...(message ? { message } : {}),
        ...(occurrence?.type === "mdx"
            ? { position: { line: occurrence.line, column: occurrence.column } }
            : occurrence?.type === "metadata"
                ? { path: occurrence.path, ...(occurrence.ordinal === undefined ? {} : { ordinal: occurrence.ordinal }) }
                : {}),
    });
    issues.push(...missingRequiredIssues(snapshot.collection, snapshot, { localizedOnly: Boolean(resolved.translation) }));
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
    const occurrenceKey = (kind, target, o) => `${kind}|${target}|${JSON.stringify(o)}`;
    const seen = new Set(snapshot.references.flatMap((ref) => ref.occurrences.map((o) => occurrenceKey(ref.kind, ref.targetId, o))));
    const references = [...snapshot.references];
    for (const ref of metadataRefs.refs) {
        const missing = ref.occurrences.filter((o) => !seen.has(occurrenceKey(ref.kind, ref.targetId, o)));
        if (missing.length > 0)
            references.push({ ...ref, occurrences: missing });
    }
    for (const ref of references) {
        const occurrences = ref.occurrences.length > 0 ? ref.occurrences : [undefined];
        const addForAll = (code) => {
            for (const occurrence of occurrences)
                issues.push(occurrenceIssue(code, occurrence, ref.targetId));
        };
        if (ref.kind === "media") {
            if (!resolved.media.some((m) => m.id === ref.targetId))
                addForAll("unresolved_media");
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
        if (!target.isPublished && !rule?.allowUnpublished)
            addForAll("unpublished_reference");
    }
    for (const [index, source] of (snapshot.internalLinks ?? []).entries()) {
        const target = resolved.internalLinks?.[index];
        if (!target || target.addressType === "missing" || target.addressType === "deleted") {
            issues.push({ code: "unresolved_internal_link", message: source.url, path: "mdx", position: source.position });
        }
        else if (target.addressType === "reservation" || !target.isPublished) {
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
