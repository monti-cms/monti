import type { Code } from "mdast";
import { annotationConfig } from "../annotation/code-block/active";
import { fromCodeFenceToCodeBlockDocument } from "../annotation/code-block/code-fence-to-document";
import { RAW_SOURCE_PARAGRAPH } from "../syntax/raw-source";
import { splitFrontmatter } from "./frontmatter";
import { attributeRecord, readJsxAttributes } from "./jsx";
import { BLOCK_JSX_NAMES, INLINE_JSX_MARKS, sortMarks } from "./registry";
import {
	boundedTableSpan,
	hasGfmHeaderLayout,
	MAX_TABLE_COLUMNS,
	parseTableWidths,
	tableHasMergedCells,
} from "./table-layout";
import type { CmsJsonValue, CmsMark, CmsMdxAnalysis, CmsNode } from "./types";

type MdastLike = {
	type: string;
	name?: string | null;
	value?: string;
	lang?: string | null;
	meta?: string | null;
	alt?: string | null;
	url?: string;
	title?: string | null;
	depth?: number;
	ordered?: boolean | null;
	start?: number | null;
	checked?: boolean | null;
	align?: Array<string | null> | null;
	children?: MdastLike[];
	attributes?: unknown[];
	data?: Record<string, unknown>;
	identifier?: string;
	label?: string | null;
	position?: { start?: { offset?: number }; end?: { offset?: number } };
};

type MdastDefinition = { url: string; title?: string | null };

/**
 * Definitions of the document being converted, keyed by the normalized identifier of mdast (case-insensitive, collapsed whitespace).
 * The reference forms (`[x][1]`, `[x][]`, `[x]`) are resolved against it so they become the same nodes as inline links and images.
 */
let definitions = new Map<string, MdastDefinition>();

const normalizeLabel = (label: string) => label.trim().replace(/\s+/g, " ").toLowerCase();

const collectDefinitions = (nodes: MdastLike[], into: Map<string, MdastDefinition>) => {
	for (const node of nodes) {
		if (node.type === "definition") {
			const key = normalizeLabel(node.identifier ?? node.label ?? "");
			// As in CommonMark, the first definition of a label wins.
			if (!into.has(key)) into.set(key, { url: node.url ?? "", title: node.title });
		}
		if (node.children) collectDefinitions(node.children, into);
	}
};

const resolveReference = (node: MdastLike): MdastDefinition | undefined =>
	definitions.get(normalizeLabel(node.identifier ?? node.label ?? ""));

const footnoteLabel = (node: MdastLike) => node.label ?? node.identifier ?? "";

/** Body of the document being converted. Offsets in the mdast positions point into it. */
let sourceBody = "";

const FOOTNOTE_MARKER = /\[\^([^\]\s\\]+)\]/g;

/** Whether the `[` at `index` is escaped (preceded by an odd number of backslashes). */
const isEscapedAt = (raw: string, index: number) => {
	let slashes = 0;
	while (raw[index - 1 - slashes] === "\\") slashes += 1;
	return slashes % 2 === 1;
};

/**
 * Text that holds an unescaped `[^label]`. The parser only reads a marker as a reference when a definition exists, so a reference
 * whose definition was removed arrives as plain text. It is turned back into a reference (read from the source, where an escaped `\[^label]` is told apart) so it survives
 * every save and reconnects when the definition is added again. Falls back to plain text if the markers in the text and the source cannot be paired.
 */
const textWithOrphanFootnotes = (node: MdastLike, marks: CmsMark[]): CmsNode[] => {
	const value = node.value ?? "";
	const plain = [textNode(value, marks)];
	if (!value.includes("[^")) return plain;
	const start = node.position?.start?.offset;
	const end = node.position?.end?.offset;
	if (typeof start !== "number" || typeof end !== "number") return plain;
	const raw = sourceBody.slice(start, end);
	const rawMarkers = [...raw.matchAll(FOOTNOTE_MARKER)];
	const valueMarkers = [...value.matchAll(FOOTNOTE_MARKER)];
	if (valueMarkers.length === 0 || rawMarkers.length !== valueMarkers.length) return plain;

	const output: CmsNode[] = [];
	let cursor = 0;
	valueMarkers.forEach((marker, index) => {
		const rawMarker = rawMarkers[index];
		if (!rawMarker || rawMarker[1] !== marker[1] || isEscapedAt(raw, rawMarker.index)) return;
		if (marker.index > cursor) output.push(textNode(value.slice(cursor, marker.index), marks));
		output.push({ type: "footnoteReference", attrs: { label: marker[1] ?? "" } });
		cursor = marker.index + marker[0].length;
	});
	if (cursor === 0) return plain;
	if (cursor < value.length) output.push(textNode(value.slice(cursor), marks));
	return output;
};

const jsonClone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

const textNode = (text: string, marks: CmsMark[]): CmsNode => {
	const node: CmsNode = { type: "text", text };
	if (marks.length > 0) node.marks = sortMarks(marks);
	return node;
};

/** A line break. It carries no marks: marks never span a break (the serializer closes them before it), so a mark on it would only change the hash. */
const HARD_BREAK = (): CmsNode => ({ type: "hardBreak" });

/**
 * An empty `<br />` (no attributes, no content): a line break, whichever notation wrote it (`<br />`, `\` + newline, trailing spaces, a directive).
 * A `br` that holds attributes or content is not a break, so it stays an element and nothing it holds is lost.
 */
const isPlainBreak = (node: MdastLike) =>
	node.name === "br" && (node.attributes ?? []).length === 0 && (node.children ?? []).length === 0;

const isBlockJsx = (node: MdastLike) => {
	if (node.type === "mdxJsxFlowElement") return true;
	if (node.type !== "mdxJsxTextElement") return false;
	return typeof node.name === "string" && BLOCK_JSX_NAMES.has(node.name);
};

const isPhrasing = (node: MdastLike) => {
	if (isBlockJsx(node)) return false;
	return [
		"text",
		"strong",
		"emphasis",
		"delete",
		"inlineCode",
		"break",
		"link",
		"linkReference",
		"inlineMath",
		"image",
		"imageReference",
		"footnoteReference",
		"mdxJsxTextElement",
		"mdxTextExpression",
		"html",
	].includes(node.type);
};

const jsxAttrs = (node: MdastLike): Record<string, CmsJsonValue> => {
	const attributes = readJsxAttributes(node.attributes).map((attribute) => {
		const record: Record<string, CmsJsonValue> = {};
		if (attribute.name) record.name = attribute.name;
		if (attribute.value !== undefined) record.value = attribute.value;
		if (attribute.expression !== undefined) record.expression = attribute.expression;
		if (attribute.spread) record.spread = true;
		return record;
	});
	const record = attributeRecord(readJsxAttributes(node.attributes));
	return {
		...record,
		name: node.name ?? "",
		attributes,
	};
};

const trimTrailingText = (nodes: CmsNode[]): CmsNode[] => {
	const last = nodes.at(-1);
	if (!last || last.type !== "text" || typeof last.text !== "string") return nodes;
	const trimmed = last.text.replace(/[ \t]+$/, "");
	if (trimmed === last.text) return nodes;
	if (trimmed.length === 0) return nodes.slice(0, -1);
	return [...nodes.slice(0, -1), { ...last, text: trimmed }];
};

const mergeText = (nodes: CmsNode[]): CmsNode[] => {
	const merged: CmsNode[] = [];
	for (const node of nodes) {
		if (node.type !== "text" || node.text == null || node.text.length === 0) {
			if (node.type === "text") continue;
			merged.push(node);
			continue;
		}
		const previous = merged.at(-1);
		if (previous?.type === "text" && JSON.stringify(previous.marks ?? null) === JSON.stringify(node.marks ?? null)) {
			previous.text = `${previous.text ?? ""}${node.text}`;
			continue;
		}
		merged.push(node);
	}
	return merged;
};

const convertPhrasing = (nodes: MdastLike[], marks: CmsMark[] = []): CmsNode[] => {
	const output: CmsNode[] = [];
	for (const node of nodes) {
		switch (node.type) {
			case "text":
				output.push(...textWithOrphanFootnotes(node, marks));
				break;
			case "strong":
				output.push(...convertPhrasing(node.children ?? [], [...marks, { type: "bold" }]));
				break;
			case "emphasis":
				output.push(...convertPhrasing(node.children ?? [], [...marks, { type: "italic" }]));
				break;
			case "delete":
				output.push(...convertPhrasing(node.children ?? [], [...marks, { type: "strike" }]));
				break;
			case "inlineCode":
				output.push(textNode(node.value ?? "", [...marks, { type: "code" }]));
				break;
			case "break":
				output.push(HARD_BREAK());
				break;
			case "link": {
				const attrs: Record<string, CmsJsonValue> = { href: node.url ?? "" };
				if (node.title) attrs.title = node.title;
				output.push(...convertPhrasing(node.children ?? [], [...marks, { type: "link", attrs }]));
				break;
			}
			case "linkReference": {
				const definition = resolveReference(node);
				const attrs: Record<string, CmsJsonValue> = { href: definition?.url ?? "" };
				if (definition?.title) attrs.title = definition.title;
				output.push(...convertPhrasing(node.children ?? [], [...marks, { type: "link", attrs }]));
				break;
			}
			case "footnoteReference":
				// An atom: it carries no marks, and the label is kept as written.
				output.push({ type: "footnoteReference", attrs: { label: footnoteLabel(node) } });
				break;
			case "inlineMath":
				output.push(textNode(`$${node.value ?? ""}$`, marks));
				break;
			case "image":
			case "imageReference":
				output.push(imageNode(node));
				break;
			case "mdxJsxTextElement":
				output.push(...convertJsxInline(node, marks));
				break;
			case "mdxTextExpression":
				output.push({ type: "mdxExpression", attrs: { value: node.value ?? "" } });
				break;
			case "html":
				output.push(textNode(node.value ?? "", marks));
				break;
			default:
				if (node.children) output.push(...convertPhrasing(node.children, marks));
				else if (node.value) output.push(textNode(node.value, marks));
		}
	}
	return mergeText(output);
};

const convertJsxInline = (node: MdastLike, marks: CmsMark[]): CmsNode[] => {
	const name = node.name ?? "";
	if (isPlainBreak(node)) return [HARD_BREAK()];
	const markType = INLINE_JSX_MARKS[name];
	if (markType) {
		const attrs = attributeRecord(readJsxAttributes(node.attributes));
		const nextMarks: CmsMark[] =
			Object.keys(attrs).length > 0 ? [...marks, { type: markType, attrs }] : [...marks, { type: markType }];
		return convertPhrasing(node.children ?? [], nextMarks);
	}
	if (BLOCK_JSX_NAMES.has(name)) {
		return [convertJsx(node)];
	}
	return [convertJsx(node)];
};

const imageNode = (node: MdastLike): CmsNode => {
	const definition = node.type === "imageReference" ? resolveReference(node) : node;
	const attrs: Record<string, CmsJsonValue> = {
		src: definition?.url ?? "",
		alt: node.alt ?? "",
	};
	if (definition?.title) attrs.title = definition.title;
	return { type: "image", attrs };
};

/** Fields the code block node owns. A fence meta key with the same name (`value="x"`) must not overwrite them. */
const CODE_BLOCK_OWN_FIELDS = new Set(["language", "meta", "value", "codeDocument"]);

const convertCode = (node: MdastLike): CmsNode => {
	const code: Code = {
		type: "code",
		lang: node.lang ?? undefined,
		meta: node.meta ?? undefined,
		value: node.value ?? "",
	};
	const codeDocument = fromCodeFenceToCodeBlockDocument(code, annotationConfig);
	const attrs: Record<string, CmsJsonValue> = {
		language: node.lang?.trim() || codeDocument.lang,
		meta: node.meta ?? "",
		value: node.value ?? "",
		codeDocument: jsonClone(codeDocument) as unknown as CmsJsonValue,
	};
	for (const [key, value] of Object.entries(codeDocument.meta)) {
		if (!CODE_BLOCK_OWN_FIELDS.has(key)) attrs[key] = value;
	}
	return { type: "codeBlock", attrs };
};

const convertDirectiveTable = (node: MdastLike): CmsNode => {
	const rawAttrs = attributeRecord(readJsxAttributes(node.attributes));
	let align: Array<string | null> | null = null;
	if (typeof rawAttrs.align === "string") {
		align = rawAttrs.align.split(",").map((s) => {
			const trimmed = s.trim();
			return trimmed.length > 0 ? trimmed : null;
		});
	}

	const rows: MdastLike[] = [];
	for (const child of node.children ?? []) {
		if (child.name === "TableRow") {
			rows.push(child);
		} else if (child.type === "paragraph" && child.children) {
			for (const grandChild of child.children) {
				if (grandChild.name === "TableRow") rows.push(grandChild);
			}
		}
	}

	const content: CmsNode[] = rows.map((row, rowIndex) => {
		const cells: MdastLike[] = [];
		for (const child of row.children ?? []) {
			if (child.name === "TableCell") {
				cells.push(child);
			} else if (child.type === "paragraph" && child.children) {
				for (const grandChild of child.children) {
					if (grandChild.name === "TableCell") cells.push(grandChild);
				}
			}
		}

		const tableRow: CmsNode = {
			type: "tableRow",
			content: cells.map((cell) => {
				const cellAttrs = attributeRecord(readJsxAttributes(cell.attributes));
				const attrs: Record<string, CmsJsonValue> = {};
				const colspan = boundedTableSpan(cellAttrs.colspan, MAX_TABLE_COLUMNS);
				const rowspan = boundedTableSpan(cellAttrs.rowspan, rows.length - rowIndex);
				if (colspan > 1) attrs.colspan = colspan;
				if (rowspan > 1) attrs.rowspan = rowspan;
				if (cellAttrs.header === true || cellAttrs.header === "true" || cellAttrs.header === "") {
					attrs.header = true;
				}
				const cellContent = trimTrailingText(convertPhrasing(cell.children ?? []));
				const tableCell: CmsNode = {
					type: "tableCell",
					...(Object.keys(attrs).length > 0 ? { attrs } : {}),
					content: cellContent,
				};
				return tableCell;
			}),
		};
		return tableRow;
	});

	const headerRows = content.map((row) => (row.content ?? []).map((cell) => cell.attrs?.header === true));
	if (!tableHasMergedCells({ content }) && !hasGfmHeaderLayout(headerRows)) {
		// Make the non-GFM header layout of a directive table without merges explicit so that saving does not change it to a GFM first-row header.
		for (const row of content) {
			for (const cell of row.content ?? []) {
				if (cell.attrs?.header !== true) cell.attrs = { ...cell.attrs, header: false };
			}
		}
	}

	const attrs: Record<string, CmsJsonValue> = {};
	if (align?.some((v) => v !== null)) attrs.align = align;
	const widths = parseTableWidths(rawAttrs.widths);
	if (widths.length > 0) attrs.widths = widths;
	return {
		type: "table",
		...(Object.keys(attrs).length > 0 ? { attrs } : {}),
		content,
	};
};

const convertJsx = (node: MdastLike): CmsNode => convertJsxElement(node);

const convertJsxElement = (node: MdastLike): CmsNode => {
	const name = node.name ?? "";
	if (name === "Table") {
		return convertDirectiveTable(node);
	}
	if (name === "Image") {
		const rawAttrs = attributeRecord(readJsxAttributes(node.attributes));
		const attrs: Record<string, CmsJsonValue> = {};
		if (rawAttrs.mediaId) attrs.mediaId = rawAttrs.mediaId;
		if (rawAttrs.src) attrs.src = rawAttrs.src;
		if (rawAttrs.alt !== undefined) attrs.alt = rawAttrs.alt;
		if (rawAttrs.width) attrs.width = rawAttrs.width;
		if (rawAttrs.align) attrs.align = rawAttrs.align;
		if (rawAttrs.caption) attrs.caption = rawAttrs.caption;
		if (rawAttrs.crop) attrs.crop = rawAttrs.crop;
		if (rawAttrs.rotate) attrs.rotate = String(rawAttrs.rotate);
		if (rawAttrs.title) attrs.title = rawAttrs.title;
		// The decorative flag is normalized to a boolean (only true is meaningful).
		if (rawAttrs.decorative === true || rawAttrs.decorative === "true") attrs.decorative = true;
		return { type: "image", attrs };
	}
	const type = name && (BLOCK_JSX_NAMES.has(name) || INLINE_JSX_MARKS[name]) ? name : "mdxJsx";
	const content = convertJsxChildren(node.children ?? []);
	const result: CmsNode = { type, attrs: jsxAttrs(node) };
	if (content.length > 0) result.content = content;
	return result;
};

const convertJsxChildren = (children: MdastLike[]): CmsNode[] => {
	if (children.length === 0) return [];
	if (children.every(isPhrasing)) {
		const content = trimTrailingText(convertPhrasing(children));
		return content.length > 0 ? [{ type: "paragraph", content }] : [];
	}
	return convertBlocks(children);
};

const isEmptyParagraph = (node: CmsNode) => {
	if (node.type !== "paragraph") return false;
	const content = node.content ?? [];
	if (content.length === 0) return true;
	return content.every((child) => child.type === "text" && !child.text);
};

/**
 * A blank line the author kept (the editor makes one by pressing Enter between blocks). It is an empty paragraph, written as a line of only `<br />`
 * and read back from one. Text that merely turns out empty after trimming is not a blank line and is dropped (`isEmptyParagraph` in `convertParagraph`).
 */
const blankLine = (): CmsNode => ({ type: "paragraph", content: [] });

const convertParagraph = (node: MdastLike): CmsNode[] => {
	const children = node.children ?? [];
	const blocks: CmsNode[] = [];
	let inline: MdastLike[] = [];

	const flush = () => {
		if (inline.length === 0) return;
		// A paragraph of only breaks (a directive `:br[]` on a line of its own) is blank lines, as a line of only `<br />` is.
		const breaks = inline.filter(isPlainBreak).length;
		if (breaks > 0 && inline.every((child) => isPlainBreak(child) || (child.type === "text" && !child.value?.trim()))) {
			blocks.push(...inline.filter(isPlainBreak).map(() => blankLine()));
			inline = [];
			return;
		}
		if (inline.length === 1 && (inline[0]?.type === "image" || inline[0]?.type === "imageReference")) {
			blocks.push(imageNode(inline[0]));
			inline = [];
			return;
		}
		const content = trimTrailingText(convertPhrasing(inline));
		inline = [];
		if (content.length === 0) return;
		const paragraph: CmsNode = { type: "paragraph", content };
		if (!isEmptyParagraph(paragraph)) blocks.push(paragraph);
	};

	for (const child of children) {
		if (isBlockJsx(child)) {
			flush();
			blocks.push(convertJsx(child));
			continue;
		}
		inline.push(child);
	}
	flush();
	return blocks;
};

const convertList = (node: MdastLike): CmsNode => {
	const ordered = Boolean(node.ordered);
	const list: CmsNode = {
		type: ordered ? "orderedList" : "bulletList",
		content: (node.children ?? []).map((item) => {
			const listItem: CmsNode = { type: "listItem", content: convertBlocks(item.children ?? []) };
			if (typeof item.checked === "boolean") {
				listItem.attrs = { checked: item.checked };
			}
			return listItem;
		}),
	};
	if (ordered && typeof node.start === "number" && node.start !== 1) {
		list.attrs = { start: node.start };
	}
	return list;
};

const convertTable = (node: MdastLike): CmsNode => {
	// GFM column alignment (`:-:` etc.). If there is no alignment at all, no attribute is set.
	const align = (node.align ?? []).map((value) => value ?? null);
	return {
		type: "table",
		...(align.some((value) => value !== null) ? { attrs: { align } } : {}),
		content: (node.children ?? []).map((row) => ({
			type: "tableRow",
			content: (row.children ?? []).map((cell) => ({
				type: "tableCell",
				content: trimTrailingText(convertPhrasing(cell.children ?? [])),
			})),
		})),
	};
};

const convertBlocks = (nodes: MdastLike[]): CmsNode[] => {
	const output: CmsNode[] = [];
	for (const node of nodes) {
		/** Adds the one block `node` is read as. */
		const add = (block: CmsNode) => output.push(block);
		switch (node.type) {
			case "paragraph":
				// Source a syntax extension turned back into text (an unregistered block directive) is moved to a raw block and written as is. If left as text, escapes pile up on save.
				if (node.data?.[RAW_SOURCE_PARAGRAPH]) {
					add({ type: "html", attrs: { value: node.children?.[0]?.value ?? "" } });
					break;
				}
				output.push(...convertParagraph(node));
				break;
			case "heading":
				add({
					type: "heading",
					attrs: { level: node.depth ?? 2 },
					content: trimTrailingText(convertPhrasing(node.children ?? [])),
				});
				break;
			case "code":
				add(convertCode(node));
				break;
			case "list":
				add(convertList(node));
				break;
			case "table":
				add(convertTable(node));
				break;
			case "blockquote":
				add({ type: "blockquote", content: convertBlocks(node.children ?? []) });
				break;
			case "footnoteDefinition":
				// Kept in place (they usually sit at the end of the source). The content is the definition's own blocks.
				add({
					type: "footnoteDefinition",
					attrs: { label: footnoteLabel(node) },
					content: convertBlocks(node.children ?? []),
				});
				break;
			case "thematicBreak":
				add({ type: "horizontalRule" });
				break;
			case "math":
				add({ type: "math", attrs: { value: node.value ?? "" } });
				break;
			case "image":
			case "imageReference":
				add(imageNode(node));
				break;
			case "mdxJsxFlowElement":
			case "mdxJsxTextElement":
				// A line of only `<br />` is read as a block element: it is a blank line. A `br` that holds attributes or content is not a break, so it is kept in a paragraph.
				if (isPlainBreak(node)) add(blankLine());
				else add(node.name === "br" ? { type: "paragraph", content: [convertJsx(node)] } : convertJsx(node));
				break;
			case "mdxjsEsm":
				add({ type: "mdxEsm", attrs: { value: node.value ?? "" } });
				break;
			case "mdxFlowExpression":
				add({ type: "mdxExpression", attrs: { value: node.value ?? "" } });
				break;
			case "html":
				add({ type: "html", attrs: { value: node.value ?? "" } });
				break;
			default:
				if (node.children && node.children.length > 0) output.push(...convertBlocks(node.children));
				else if (node.value) {
					add({ type: "paragraph", content: [textNode(node.value, [])] });
				}
		}
	}
	return output;
};

/** The working document of an analysis. */
export const toDocument = (analysis: CmsMdxAnalysis): CmsNode => {
	definitions = new Map();
	sourceBody = splitFrontmatter(analysis.source).body;
	if (analysis.tree) collectDefinitions(analysis.tree.children as MdastLike[], definitions);
	// A `definition` node has no children or value, so `convertBlocks` drops it (consumed definitions are written back as inline links).
	const content = analysis.tree ? convertBlocks(analysis.tree.children as MdastLike[]) : [];
	const doc: CmsNode = { type: "doc", content };
	if (analysis.frontmatter) {
		doc.attrs = { frontmatter: analysis.frontmatter };
	}
	return jsonClone(doc);
};
