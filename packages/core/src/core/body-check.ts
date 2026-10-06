import type { BlockDefinition } from "../blocks/define";
import { BLOCK_BY_NAME, invalidOptionAttributes } from "../blocks/derive";
import { createTranslator } from "../i18n";
import type { StoredDocument } from "../mdx/stored-document";
import { MAX_TABLE_COLUMNS } from "../mdx/table-layout";
import type { CmsImageSource, CmsJsonValue, CmsMark, CmsNode } from "../mdx/types";
import { CodeRefCollector } from "./code-refs";
import { isUuid } from "./ids";
import { parseInternalLink } from "./links";
import { coreMessages } from "./messages";
import type { BodyPosition, InternalLinkSource, Issue } from "./types";

/**
 * The checks of a stored document that run before it is saved or published: what its blocks need (required, unknown and invalid attributes),
 * the references it holds (media, internal links, code line labels, footnotes), table merges and translation notes left in it.
 * It reads the stored document only, never MDX text, so it checks a body the same whichever notation or API it came from. Positions are the
 * `blockId` of the block a finding is in.
 */

export interface DocumentCheck {
	/** Findings that block publishing, in body order. */
	readonly issues: Issue[];
	/** Notices that do not block publishing. */
	readonly warnings: Issue[];
	/** Registered media the body uses (valid ids only), one entry per use. */
	readonly mediaReferences: { readonly mediaId: string; readonly position: BodyPosition }[];
	readonly imageSources: CmsImageSource[];
	readonly internalLinks: InternalLinkSource[];
	/** Whether the body holds an `unparsed` node. */
	readonly unparsed: boolean;
	/**
	 * Whether the references of the body cannot be trusted: it is unparsed, or a reference in it is missing or malformed (an image with no source,
	 * a media id that is not an id). The references of the draft it replaces then stay (marked stale) and no new ones are taken from it.
	 */
	readonly incomplete: boolean;
}

const tCore = createTranslator(coreMessages);

const position = (blockId: string | undefined): BodyPosition => (blockId === undefined ? {} : { blockId });

/** Maximum rows/columns one merged cell can span. Same as the column limit of tables in the editor and the public render. */
const MAX_TABLE_SPAN = MAX_TABLE_COLUMNS;

/** The block definition a node or mark type is stored as (a table row and a cell are stored as `tableRow` and `tableCell`). */
const BLOCK_OF_TYPE: ReadonlyMap<string, BlockDefinition | undefined> = new Map([
	["tableRow", BLOCK_BY_NAME.get("row")],
	["tableCell", BLOCK_BY_NAME.get("cell")],
]);
const blockOfType = (type: string): BlockDefinition | undefined =>
	BLOCK_OF_TYPE.has(type) ? BLOCK_OF_TYPE.get(type) : BLOCK_BY_NAME.get(type);

/** Blocks written as elements (containers, leaves and text blocks) have attribute rules; code fences and math do not. */
const hasAttributeRules = (block: BlockDefinition) =>
	block.syntax.kind === "container" || block.syntax.kind === "leaf" || block.syntax.kind === "text";

/** A cell's `colspan`/`rowspan`. 1 if absent; a value that is not a positive integer is returned as invalid. */
function readSpan(cell: CmsNode, key: "colspan" | "rowspan"): { span: number } | { invalid: string } {
	const raw = cell.attrs?.[key];
	if (raw === undefined) return { span: 1 };
	if (typeof raw === "number") return Number.isInteger(raw) && raw >= 1 ? { span: raw } : { invalid: String(raw) };
	if (typeof raw !== "string") return { invalid: String(raw) };
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

/** Checks table cell merges (colspan/rowspan) and grid structure, and warns about invalid spans. */
function checkTableSpans(table: CmsNode, at: BodyPosition, warnings: Issue[]) {
	const rows = (table.content ?? []).filter((child) => child.type === "tableRow");
	const totalRows = rows.length;
	if (totalRows === 0) return;

	const grid: boolean[][] = Array.from({ length: totalRows }, () => []);
	let hasSpanIssue = false;
	const warn = (reason: TableSpanReason, params: Record<string, string | number> = {}) => {
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
		if (!row) continue;
		const cells = (row.content ?? []).filter((child) => child.type === "tableCell");
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

			// Limit so that a huge span in a document from outside cannot blow up the grid computation.
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

/** The label of a footnote as a definition is found by it: case-insensitive, runs of whitespace collapsed. */
const footnoteIdentifier = (label: string) => label.trim().replace(/\s+/g, " ").toLowerCase();

const labelOf = (node: CmsNode) => (typeof node.attrs?.label === "string" ? node.attrs.label : "");

/** Marks the run of which is told apart by type and attributes, so one decorated stretch of text counts once however many text nodes it is split into. */
const markKey = (mark: CmsMark) => `${mark.type}|${JSON.stringify(mark.attrs ?? null)}`;

/**
 * Checks a stored document. Block attribute rules and the like only block publishing; a draft save is never blocked by them.
 */
export function checkDocument(doc: StoredDocument): DocumentCheck {
	const issues: Issue[] = [];
	const warnings: Issue[] = [];
	const mediaReferences: DocumentCheck["mediaReferences"] = [];
	const imageSources: CmsImageSource[] = [];
	const internalLinks: InternalLinkSource[] = [];
	const codeRefs = new CodeRefCollector();
	let unparsed = false;
	let incomplete = false;

	const footnoteReferences: { label: string; at: BodyPosition }[] = [];
	const footnoteDefinitions: { identifier: string; label: string; at: BodyPosition }[] = [];
	/** Translation hint text left in a translation. It is not visible on the public screen, so it must not be published as is. */
	const untranslated: BodyPosition[] = [];

	/** Block attribute rules of a block (node) or text decoration (mark): required, unknown, invalid and child-valued attributes. */
	const checkAttributes = (
		type: string,
		attrs: Readonly<Record<string, CmsJsonValue>> | undefined,
		at: BodyPosition,
		children?: readonly CmsNode[],
	) => {
		const block = blockOfType(type);
		if (!block || !hasAttributeRules(block)) return;

		for (const [key, attribute] of Object.entries(block.attributes)) {
			if (!attribute.required) continue;
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
			if (!childKey) continue;
			const value = attrs?.[key];
			if (typeof value !== "string" || !value) continue;
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
	const addMediaReference = (mediaId: string, at: BodyPosition) => {
		if (!isUuid(mediaId)) {
			issues.push({ code: "invalid_reference_id", position: at });
			incomplete = true;
		} else mediaReferences.push({ mediaId, position: at });
	};

	/** A reference ID attribute: missing or empty is `missing_media_id`; a value that is not text is an invalid reference. */
	const referenceId = (value: CmsJsonValue | undefined): { id: string } | { problem: string } =>
		value === undefined || value === null || value === ""
			? { problem: "missing_media_id" }
			: typeof value !== "string"
				? { problem: "invalid_reference_id" }
				: { id: value };

	const checkImage = (node: CmsNode, at: BodyPosition) => {
		// An image uses either `mediaId` (registered media) or `src` (external address).
		// Only `mediaId` goes to the reference table. `src` is an external address, not a reference.
		const attrs = node.attrs ?? {};
		const mediaId = attrs.mediaId;
		const useMedia = mediaId !== undefined && mediaId !== null && mediaId !== "";
		const reference = referenceId(useMedia ? mediaId : attrs.src);
		if ("problem" in reference) {
			issues.push({ code: reference.problem, position: at });
			incomplete = true;
		} else if (useMedia) addMediaReference(reference.id, at);

		const media = typeof mediaId === "string" && mediaId ? mediaId : undefined;
		const src = typeof attrs.src === "string" && attrs.src ? attrs.src : undefined;
		if (media || src) imageSources.push({ ...(media ? { mediaId: media } : { src }), position: at });

		// A missing alt on a new image that needs a description (registered media) must be fixed before publishing.
		// External or relative-path images (`src`) from migrated content are handled in the migration report, so they are not blocked.
		const alt = attrs.alt;
		if (attrs.decorative !== true && useMedia && (typeof alt !== "string" || !alt.trim())) {
			issues.push({ code: "missing_image_alt", path: "body", position: at });
		}
	};

	/** Attached file card. `mediaId` is required. */
	const checkFile = (node: CmsNode, at: BodyPosition) => {
		const reference = referenceId(node.attrs?.mediaId);
		if ("problem" in reference) {
			issues.push({ code: reference.problem, position: at });
			incomplete = true;
		} else addMediaReference(reference.id, at);
	};

	/** One stretch of decorated text: a link, a translation note, or a text block such as a tooltip. */
	const checkMark = (mark: CmsMark, at: BodyPosition) => {
		if (mark.type === "link") {
			const href = mark.attrs?.href;
			const parsed = typeof href === "string" ? parseInternalLink(href) : null;
			if (parsed) internalLinks.push({ ...parsed, position: at });
			return;
		}
		if (mark.type === "untranslated") untranslated.push(at);
		checkAttributes(mark.type, mark.attrs, at);
		codeRefs.addBlock(mark.type, mark.attrs, at);
	};

	/**
	 * The text marks of one parent. Text split into several nodes by other marks is one stretch, and a line break or a footnote reference
	 * inside it does not end it, so a mark is checked once however it was written.
	 */
	const checkMarks = (children: readonly CmsNode[], at: BodyPosition) => {
		const open = new Set<string>();
		for (const child of children) {
			if (child.text === undefined) {
				if (child.type === "hardBreak" || child.type === "footnoteReference") continue;
				open.clear();
				continue;
			}
			const marks = new Map((child.marks ?? []).map((mark) => [markKey(mark), mark] as const));
			for (const key of open) if (!marks.has(key)) open.delete(key);
			for (const [key, mark] of marks) {
				if (open.has(key)) continue;
				open.add(key);
				checkMark(mark, at);
			}
		}
	};

	const visit = (node: CmsNode, parentId: string | undefined) => {
		if (node.text !== undefined) return;
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
				checkTableSpans(node, at, warnings);
				break;
			default:
		}
		if (node.type !== "unparsed") {
			checkAttributes(node.type, node.attrs, at, node.content);
			codeRefs.addBlock(node.type, node.attrs, at);
		}

		const children = node.content ?? [];
		checkMarks(children, at);
		for (const child of children) visit(child, blockId);
	};
	for (const node of doc.content) visit(node, undefined);

	// Footnote problems never block publishing, but they leave a dangling marker or a stray note on the public page.
	const referenced = new Set(footnoteReferences.map((reference) => footnoteIdentifier(reference.label)));
	const defined = new Set<string>();
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
		} else if (!referenced.has(definition.identifier)) {
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
		if (defined.has(footnoteIdentifier(reference.label))) continue;
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

	return { issues, warnings, mediaReferences, imageSources, internalLinks, unparsed, incomplete };
}

/** Whether a document has nothing a reader would see: no blocks, or only blank paragraphs. */
export const isEmptyDocument = (doc: StoredDocument): boolean =>
	doc.content.every(
		(node) =>
			node.type === "paragraph" &&
			(node.content ?? []).every((child) => child.text !== undefined && child.text.trim() === ""),
	);
