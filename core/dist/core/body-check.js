import { invalidOptionAttributes } from "../blocks/derive.js";
import { entryIdOfMark } from "../doc/entry-links.js";
import { MAX_TABLE_COLUMNS } from "../doc/table-layout.js";
import { disallowedInDocument } from "../schema/allowed.js";
import { CodeRefCollector } from "./code-refs.js";
import { isUuid } from "./ids.js";
import { coreMessages } from "./messages.js";
const position = (blockId) => (blockId === undefined ? {} : { blockId });
/** Maximum rows/columns one merged cell can span. Same as the column limit of tables in the editor and the public render. */
const MAX_TABLE_SPAN = MAX_TABLE_COLUMNS;
/** Blocks written as elements (containers, leaves and text blocks) have attribute rules; code fences and math do not. */
const hasAttributeRules = (block) => block.syntax.kind === "container" || block.syntax.kind === "leaf" || block.syntax.kind === "text";
/** A cell's `colspan`/`rowspan`. 1 if absent; a value that is not a positive integer is returned as invalid. */
function readSpan(cell, key) {
    const raw = cell.attrs?.[key];
    if (raw === undefined)
        return { span: 1 };
    if (typeof raw === "number")
        return Number.isInteger(raw) && raw >= 1 ? { span: raw } : { invalid: String(raw) };
    if (typeof raw !== "string")
        return { invalid: String(raw) };
    const parsed = Number.parseInt(raw, 10);
    return Number.isNaN(parsed) || parsed < 1 || String(parsed) !== raw.trim() ? { invalid: raw } : { span: parsed };
}
/** Checks table cell merges (colspan/rowspan) and grid structure, and warns about invalid spans. */
function checkTableSpans(tCore, table, at, warnings) {
    const rows = (table.content ?? []).filter((child) => child.type === "tableRow");
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
            path: "body",
            position: at,
        });
        hasSpanIssue = true;
    };
    for (let r = 0; r < totalRows; r += 1) {
        const row = rows[r];
        if (!row)
            continue;
        const cells = (row.content ?? []).filter((child) => child.type === "tableCell");
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
            // Limit so that a huge span in a document from outside cannot blow up the grid computation.
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
/** The label of a footnote as a definition is found by it: case-insensitive, runs of whitespace collapsed. */
const footnoteIdentifier = (label) => label.trim().replace(/\s+/g, " ").toLowerCase();
const labelOf = (node) => (typeof node.attrs?.label === "string" ? node.attrs.label : "");
/** Marks the run of which is told apart by type and attributes, so one decorated stretch of text counts once however many text nodes it is split into. */
const markKey = (mark) => `${mark.type}|${JSON.stringify(mark.attrs ?? null)}`;
/**
 * The notice for a block or mark the body's allowed list does not list (`disallowed_block`, `disallowed_mark`). It names the block or mark, the heading
 * level for a heading, and the block it is in.
 */
export const disallowedIssue = (item) => ({
    code: item.kind === "block" ? "disallowed_block" : "disallowed_mark",
    message: item.level === undefined ? item.name : `${item.name} ${item.level}`,
    params: item.level === undefined ? { name: item.name } : { name: item.name, level: item.level },
    path: "body",
    position: position(item.blockId),
});
/**
 * Checks a stored document. Block attribute rules and the like only block publishing; a draft save is never blocked by them.
 * `allowed` is the allowed list of the collection's body: a block or mark it does not list is reported as a warning (the content is kept as it is).
 */
export function checkDocument(site, doc, allowed) {
    const tCore = site.createTranslator(coreMessages);
    const { BLOCK_BY_NAME } = site;
    /** The block definition a node or mark type is stored as (a table row and a cell are stored as `tableRow` and `tableCell`). */
    const blockOfType = (type) => type === "tableRow"
        ? BLOCK_BY_NAME.get("row")
        : type === "tableCell"
            ? BLOCK_BY_NAME.get("cell")
            : BLOCK_BY_NAME.get(type);
    const issues = [];
    const warnings = [];
    const mediaReferences = [];
    const imageSources = [];
    const internalLinks = [];
    const entryLinks = [];
    const codeRefs = new CodeRefCollector(BLOCK_BY_NAME);
    let unparsed = false;
    let incomplete = false;
    const footnoteReferences = [];
    const footnoteDefinitions = [];
    /** Translation hint text left in a translation. It is not visible on the public screen, so it must not be published as is. */
    const untranslated = [];
    /** Block attribute rules of a block (node) or text decoration (mark): required, unknown, invalid and child-valued attributes. */
    const checkAttributes = (type, attrs, at, children) => {
        const block = blockOfType(type);
        if (!block || !hasAttributeRules(block))
            return;
        for (const [key, attribute] of Object.entries(block.attributes)) {
            if (!attribute.required)
                continue;
            const value = attrs?.[key];
            if (typeof value !== "string" || value.trim() === "") {
                issues.push({ code: "missing_block_attribute", message: `${block.name}.${key}`, path: "body", position: at });
            }
        }
        for (const key of Object.keys(attrs ?? {})) {
            if (!Object.hasOwn(block.attributes, key)) {
                warnings.push({ code: "unknown_block_attribute", message: `${block.name}.${key}`, path: "body", position: at });
            }
        }
        // Attributes with a fixed set of choices (alignment, callout kind, etc.) accept only the values from the block definition.
        const values = Object.fromEntries(Object.keys(block.attributes).map((key) => [key, attrs?.[key]]));
        for (const key of invalidOptionAttributes(block, values)) {
            issues.push({
                code: "invalid_block_attribute",
                message: `${block.name}.${key}=${String(values[key])}`,
                path: "body",
                position: at,
            });
        }
        // Attributes that must be one of a child block's values (e.g. the initially open tab → tab name).
        for (const [key, attribute] of Object.entries(block.attributes)) {
            const childKey = attribute.childValue;
            if (!childKey)
                continue;
            const value = attrs?.[key];
            if (typeof value !== "string" || !value)
                continue;
            const childTypes = new Set(block.children?.blocks ?? []);
            const childValues = (children ?? []).flatMap((child) => {
                const childValue = childTypes.has(child.type) ? child.attrs?.[childKey] : undefined;
                return typeof childValue === "string" ? [childValue] : [];
            });
            if (!childValues.includes(value)) {
                issues.push({
                    code: "invalid_block_attribute",
                    message: `${block.name}.${key}=${value}`,
                    path: "body",
                    position: at,
                });
            }
        }
    };
    /** Collected as registered-media references. A non-UUID is a body error. Kept as a reference so a file in use is not deleted. */
    const addMediaReference = (mediaId, at) => {
        if (!isUuid(mediaId)) {
            issues.push({ code: "invalid_reference_id", position: at });
            incomplete = true;
        }
        else
            mediaReferences.push({ mediaId, position: at });
    };
    /** A reference ID attribute: missing or empty is `missing_media_id`; a value that is not text is an invalid reference. */
    const referenceId = (value) => value === undefined || value === null || value === ""
        ? { problem: "missing_media_id" }
        : typeof value !== "string"
            ? { problem: "invalid_reference_id" }
            : { id: value };
    const checkImage = (node, at) => {
        // An image uses either `mediaId` (registered media) or `src` (external address).
        // Only `mediaId` goes to the reference table. `src` is an external address, not a reference.
        const attrs = node.attrs ?? {};
        const mediaId = attrs.mediaId;
        const useMedia = mediaId !== undefined && mediaId !== null && mediaId !== "";
        const reference = referenceId(useMedia ? mediaId : attrs.src);
        if ("problem" in reference) {
            issues.push({ code: reference.problem, position: at });
            incomplete = true;
        }
        else if (useMedia)
            addMediaReference(reference.id, at);
        const media = typeof mediaId === "string" && mediaId ? mediaId : undefined;
        const src = typeof attrs.src === "string" && attrs.src ? attrs.src : undefined;
        if (media || src)
            imageSources.push({ ...(media ? { mediaId: media } : { src }), position: at });
        // A missing alt on a new image that needs a description (registered media) must be fixed before publishing.
        // External or relative-path images (`src`) from migrated content are handled in the migration report, so they are not blocked.
        const alt = attrs.alt;
        if (attrs.decorative !== true && useMedia && (typeof alt !== "string" || !alt.trim())) {
            issues.push({ code: "missing_image_alt", path: "body", position: at });
        }
    };
    /** Attached file card. `mediaId` is required. */
    const checkFile = (node, at) => {
        const reference = referenceId(node.attrs?.mediaId);
        if ("problem" in reference) {
            issues.push({ code: reference.problem, position: at });
            incomplete = true;
        }
        else
            addMediaReference(reference.id, at);
    };
    /** One stretch of decorated text: a link, a translation note, or a text block such as a tooltip. */
    const checkMark = (mark, at) => {
        if (mark.type === "link") {
            const entryId = entryIdOfMark(mark);
            if (entryId) {
                // A link by id is a reference like a relation. An id that is not an id is a body error (the references of such a body cannot be trusted).
                if (isUuid(entryId))
                    entryLinks.push({ entryId, position: at });
                else {
                    issues.push({ code: "invalid_reference_id", position: at });
                    incomplete = true;
                }
                return;
            }
            const href = mark.attrs?.href;
            const parsed = typeof href === "string" ? site.parseInternalLink(href) : null;
            if (parsed)
                internalLinks.push({ ...parsed, position: at });
            return;
        }
        if (mark.type === "untranslated")
            untranslated.push(at);
        checkAttributes(mark.type, mark.attrs, at);
        codeRefs.addBlock(mark.type, mark.attrs, at);
    };
    /**
     * The text marks of one parent. Text split into several nodes by other marks is one stretch, and a line break or a footnote reference
     * inside it does not end it, so a mark is checked once however it was written.
     */
    const checkMarks = (children, at) => {
        const open = new Set();
        for (const child of children) {
            if (child.text === undefined) {
                if (child.type === "hardBreak" || child.type === "footnoteReference")
                    continue;
                open.clear();
                continue;
            }
            const marks = new Map((child.marks ?? []).map((mark) => [markKey(mark), mark]));
            for (const key of open)
                if (!marks.has(key))
                    open.delete(key);
            for (const [key, mark] of marks) {
                if (open.has(key))
                    continue;
                open.add(key);
                checkMark(mark, at);
            }
        }
    };
    const visit = (node, parentId) => {
        if (node.text !== undefined)
            return;
        const blockId = node.id ?? parentId;
        const at = position(blockId);
        switch (node.type) {
            case "unparsed":
                unparsed = true;
                incomplete = true;
                issues.push({ code: "unparsed_body", path: "body", position: at });
                break;
            case "image":
                checkImage(node, at);
                break;
            case "file":
                checkFile(node, at);
                break;
            case "codeBlock":
                codeRefs.addCode(node.attrs, at);
                break;
            case "footnoteReference":
                footnoteReferences.push({ label: labelOf(node), at });
                break;
            case "footnoteDefinition":
                footnoteDefinitions.push({ identifier: footnoteIdentifier(labelOf(node)), label: labelOf(node), at });
                break;
            case "table":
                checkTableSpans(tCore, node, at, warnings);
                break;
            default:
        }
        if (node.type !== "unparsed") {
            checkAttributes(node.type, node.attrs, at, node.content);
            codeRefs.addBlock(node.type, node.attrs, at);
        }
        const children = node.content ?? [];
        checkMarks(children, at);
        for (const child of children)
            visit(child, blockId);
    };
    for (const node of doc.content)
        visit(node, undefined);
    // Blocks and marks the body does not allow stay in the draft; they are reported, never blocking.
    for (const item of disallowedInDocument(site, allowed, doc))
        warnings.push(disallowedIssue(item));
    // Footnote problems never block publishing, but they leave a dangling marker or a stray note on the public page.
    const referenced = new Set(footnoteReferences.map((reference) => footnoteIdentifier(reference.label)));
    const defined = new Set();
    for (const definition of footnoteDefinitions) {
        const params = { label: definition.label };
        if (defined.has(definition.identifier)) {
            warnings.push({
                code: "footnote_definition_duplicate",
                message: definition.label,
                params,
                path: "body",
                position: definition.at,
            });
        }
        else if (!referenced.has(definition.identifier)) {
            warnings.push({
                code: "footnote_definition_unused",
                message: definition.label,
                params,
                path: "body",
                position: definition.at,
            });
        }
        defined.add(definition.identifier);
    }
    // A marker without a definition leaves a dangling `[^label]` on the page.
    for (const reference of footnoteReferences) {
        if (defined.has(footnoteIdentifier(reference.label)))
            continue;
        warnings.push({
            code: "footnote_definition_missing",
            message: reference.label,
            params: { label: reference.label },
            path: "body",
            position: reference.at,
        });
    }
    // Links to code lines are checked only in a body that is complete: a body that could not be read may have lost the code block a link points to.
    if (!incomplete) {
        const codeRefIssues = codeRefs.check();
        issues.push(...codeRefIssues.issues);
        warnings.push(...codeRefIssues.warnings);
    }
    const firstUntranslated = untranslated[0];
    if (firstUntranslated) {
        issues.push({
            code: "untranslated_text",
            position: firstUntranslated,
            message: tCore("untranslatedCount", { count: untranslated.length }),
            params: { count: untranslated.length },
        });
    }
    return { issues, warnings, mediaReferences, imageSources, internalLinks, entryLinks, unparsed, incomplete };
}
/** Whether a document has nothing a reader would see: no blocks, or only blank paragraphs. */
export const isEmptyDocument = (doc) => doc.content.every((node) => node.type === "paragraph" &&
    (node.content ?? []).every((child) => child.text !== undefined && child.text.trim() === ""));
