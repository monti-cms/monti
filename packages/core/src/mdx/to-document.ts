import type { Code } from "mdast";
import { annotationConfig } from "../annotation/code-block/active";
import { fromCodeFenceToCodeBlockDocument } from "../annotation/code-block/code-fence-to-document";
import { attributeRecord, readJsxAttributes } from "./jsx";
import { BLOCK_JSX_NAMES, INLINE_JSX_MARKS, sortMarks } from "./registry";
import { DEMOTED_DIRECTIVE_SOURCE } from "./remark-directives";
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
};

const jsonClone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

const textNode = (text: string, marks: CmsMark[]): CmsNode => {
	const node: CmsNode = { type: "text", text };
	if (marks.length > 0) node.marks = sortMarks(marks);
	return node;
};

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
		"inlineMath",
		"image",
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
				output.push(textNode(node.value ?? "", marks));
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
				output.push({ type: "hardBreak", ...(marks.length > 0 ? { marks: sortMarks(marks) } : {}) });
				break;
			case "link": {
				const attrs: Record<string, CmsJsonValue> = { href: node.url ?? "" };
				if (node.title) attrs.title = node.title;
				output.push(...convertPhrasing(node.children ?? [], [...marks, { type: "link", attrs }]));
				break;
			}
			case "inlineMath":
				output.push(textNode(`$${node.value ?? ""}$`, marks));
				break;
			case "image":
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
	const attrs: Record<string, CmsJsonValue> = {
		src: node.url ?? "",
		alt: node.alt ?? "",
	};
	if (node.title) attrs.title = node.title;
	return { type: "image", attrs };
};

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
		attrs[key] = value;
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

		return {
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
				return {
					type: "tableCell",
					...(Object.keys(attrs).length > 0 ? { attrs } : {}),
					content: cellContent,
				};
			}),
		};
	});

	const headerRows = content.map((row) => (row.content ?? []).map((cell) => cell.attrs?.header === true));
	if (!tableHasMergedCells({ content }) && !hasGfmHeaderLayout(headerRows)) {
		// 병합 없는 directive 표의 비GFM 머리글 배치를 명시해 저장 시 GFM 첫 행 머리글로 바뀌지 않게 한다.
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

const convertJsx = (node: MdastLike): CmsNode => {
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
		// 장식 표시는 불리언으로 정규화한다(참만 의미가 있다 — §4.4).
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

const convertParagraph = (node: MdastLike): CmsNode[] => {
	const children = node.children ?? [];
	const blocks: CmsNode[] = [];
	let inline: MdastLike[] = [];

	const flush = () => {
		if (inline.length === 0) return;
		if (inline.length === 1 && inline[0]?.type === "image") {
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
	// GFM 열 정렬(`:-:` 등). 정렬이 하나도 없으면 속성을 두지 않는다.
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
		switch (node.type) {
			case "paragraph":
				// 미등록 블록 지시자는 원문 블록으로 옮겨 그대로 쓴다(`remark-directives.ts`). 글로 두면 저장할 때 이스케이프가 쌓인다.
				if (node.data?.[DEMOTED_DIRECTIVE_SOURCE]) {
					output.push({ type: "html", attrs: { value: node.children?.[0]?.value ?? "" } });
					break;
				}
				output.push(...convertParagraph(node));
				break;
			case "heading":
				output.push({
					type: "heading",
					attrs: { level: node.depth ?? 2 },
					content: trimTrailingText(convertPhrasing(node.children ?? [])),
				});
				break;
			case "code":
				output.push(convertCode(node));
				break;
			case "list":
				output.push(convertList(node));
				break;
			case "table":
				output.push(convertTable(node));
				break;
			case "blockquote":
				output.push({ type: "blockquote", content: convertBlocks(node.children ?? []) });
				break;
			case "thematicBreak":
				output.push({ type: "horizontalRule" });
				break;
			case "math":
				output.push({ type: "math", attrs: { value: node.value ?? "" } });
				break;
			case "image":
				output.push(imageNode(node));
				break;
			case "mdxJsxFlowElement":
			case "mdxJsxTextElement":
				output.push(convertJsx(node));
				break;
			case "mdxjsEsm":
				output.push({ type: "mdxEsm", attrs: { value: node.value ?? "" } });
				break;
			case "mdxFlowExpression":
				output.push({ type: "mdxExpression", attrs: { value: node.value ?? "" } });
				break;
			case "html":
				output.push({ type: "html", attrs: { value: node.value ?? "" } });
				break;
			default:
				if (node.children && node.children.length > 0) output.push(...convertBlocks(node.children));
				else if (node.value) {
					output.push({ type: "paragraph", content: [textNode(node.value, [])] });
				}
		}
	}
	return output.filter((node) => !isEmptyParagraph(node));
};

export const toDocument = (analysis: CmsMdxAnalysis): CmsNode => {
	const content = analysis.tree ? convertBlocks(analysis.tree.children as MdastLike[]) : [];
	const doc: CmsNode = { type: "doc", content };
	if (analysis.frontmatter) {
		doc.attrs = { frontmatter: analysis.frontmatter };
	}
	return jsonClone(doc);
};
