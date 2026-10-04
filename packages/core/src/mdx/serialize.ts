import { annotationConfig } from "../annotation/code-block/active";
import { fromCodeBlockDocumentToCodeFence } from "../annotation/code-block/document-to-code-fence";
import type { CodeBlockDocument } from "../annotation/code-block/types";
import { ADDED_MARK_BLOCKS } from "../blocks/active";
import type { BlockDefinition } from "../blocks/define";
import { DIRECTIVE_BY_COMPONENT, DIRECTIVE_NAMES, type DirectiveDefinition } from "./directives";
import { serializeFrontmatter } from "./frontmatter";
import { BLOCK_JSX_NAMES, INLINE_JSX_MARKS, sortMarks } from "./registry";
import {
	formatTableWidths,
	hasBalancedLabelBrackets,
	hasNonGfmHeaderLayout,
	tableHasMergedCells,
	tableWidths,
} from "./table-layout";
import type { CmsJsonValue, CmsMark, CmsNode } from "./types";

const usesDirectiveTable = (node: CmsNode) =>
	tableHasMergedCells(node) || hasNonGfmHeaderLayout(node) || formatTableWidths(tableWidths(node)) !== "";

const isIdent = (value: string) => /^[A-Za-z_][\w]*$/.test(value);

const escapeAttr = (value: string) => value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

const escapeText = (value: string, inCode: boolean, inLabel = false) => {
	if (inCode) return value;
	const escaped = value
		.replace(/\\/g, "\\\\")
		.replace(/`/g, "\\`")
		.replace(/\*/g, "\\*")
		.replace(/_/g, "\\_")
		.replace(/\[/g, "\\[")
		.replace(/\{/g, "\\{")
		.replace(/</g, "\\<");
	const unbroken = escapeDirectiveColon(escaped);
	// directive 라벨은 `]`로 닫히므로 라벨 안에서는 `]`를 이스케이프한다(짝이 맞지 않으면 라벨이 깨진다).
	return inLabel ? unbroken.replace(/\]/g, "\\]") : unbroken;
};

const DIRECTIVE_COLON = /(?<!\\):(?=[A-Za-z0-9_\-가-힣:])/g; // cms-allow-korean: Hangul in a name pattern, not UI text
const DIRECTIVE_RUN = /^[A-Za-z0-9_\-가-힣:]+/; // cms-allow-korean: Hangul in a name pattern, not UI text

/**
 * 등록된 지시자 이름이 뒤따르는 `:`를 `\:`로 이스케이프한다(§4.4).
 * 그대로 두면 재파싱 때 지시자로 읽힌다(`:br `, `:u[` 등). 미등록 이름(`:free를`)과
 * 시각·URL의 콜론(`12:30`, `https://`)은 건드리지 않는다. 이미 이스케이프된 `\:`는 둔다.
 */
const escapeDirectiveColon = (value: string): string =>
	value.replace(DIRECTIVE_COLON, (_match: string, offset: number, whole: string) => {
		const run = DIRECTIVE_RUN.exec(whole.slice(offset + 1))?.[0] ?? "";
		return DIRECTIVE_NAMES.has(run) ? "\\:" : ":";
	});
const fenceTicks = (value: string) => {
	const runs = value.match(/`+/g)?.map((run) => run.length) ?? [];
	return Math.max(3, ...runs.map((size) => size + 1), 3);
};

const serializeFence = (language: string, meta: string, value: string) => {
	const ticks = "`".repeat(fenceTicks(value));
	const info = [language, meta].filter((part) => part.length > 0).join(" ");
	return `${ticks}${info}\n${value}\n${ticks}`;
};

const serializeJsValue = (value: CmsJsonValue): string => {
	if (value === null) return "null";
	if (typeof value === "boolean") return value ? "true" : "false";
	if (typeof value === "number") return String(value);
	if (typeof value === "string") return JSON.stringify(value);
	if (Array.isArray(value)) return `[${value.map(serializeJsValue).join(", ")}]`;
	const entries = Object.entries(value).map(([key, item]) => {
		const printedKey = isIdent(key) ? key : JSON.stringify(key);
		return `${printedKey}: ${serializeJsValue(item)}`;
	});
	return `{${entries.join(", ")}}`;
};

const serializeJsxAttribute = (attribute: Record<string, CmsJsonValue>): string => {
	if (attribute.spread) {
		const expression = typeof attribute.expression === "string" ? attribute.expression : "...";
		return `{${expression}}`;
	}
	const name = typeof attribute.name === "string" ? attribute.name : "";
	if (!name) return "";
	if (attribute.expression != null && attribute.value === undefined) {
		return `${name}={${attribute.expression}}`;
	}
	const value = attribute.value;
	if (value === undefined) return name;
	if (typeof value === "string") return `${name}="${escapeAttr(value)}"`;
	return `${name}={${serializeJsValue(value)}}`;
};

const reservedAttrKeys = new Set([
	"name",
	"attributes",
	"language",
	"meta",
	"value",
	"codeDocument",
	"frontmatter",
	"level",
	"src",
	"alt",
	"href",
	"title",
	"checked",
	"start",
]);

const serializeJsxAttrs = (node: CmsNode): string => {
	const attributes = node.attrs?.attributes;
	const parts: string[] = [];
	if (Array.isArray(attributes)) {
		for (const item of attributes) {
			if (!item || typeof item !== "object" || Array.isArray(item)) continue;
			const printed = serializeJsxAttribute(item);
			if (printed) parts.push(printed);
		}
	} else if (node.attrs) {
		for (const [key, value] of Object.entries(node.attrs)) {
			if (reservedAttrKeys.has(key)) continue;
			parts.push(serializeJsxAttribute({ name: key, value }));
		}
	}
	return parts.length > 0 ? ` ${parts.join(" ")}` : "";
};

const jsxName = (node: CmsNode): string => {
	if (typeof node.attrs?.name === "string" && node.attrs.name.length > 0) return node.attrs.name;
	return node.type;
};

/** 더한 글자 꾸밈(블록 확장). mark 이름은 블록 이름이다. */
const ADDED_MARKS: ReadonlyMap<string, BlockDefinition> = new Map(
	ADDED_MARK_BLOCKS.map((block) => [block.name, block]),
);

/** 속성이 붙는 지시자 라벨(`]{…}`) 안의 글. 라벨을 닫는 글자를 이스케이프한다. */
const LABEL_MARKS = new Set(ADDED_MARKS.keys());

/**
 * 더한 글자 꾸밈의 속성(`{이름="값" …}`). 정의의 속성을 정의 순서대로 쓴다. 꼭 있어야 하는 속성(`required`)은 비어도 쓰고,
 * 나머지는 값이 있을 때만 쓴다. 불리언은 참일 때 이름만 쓴다. 속성이 하나도 없으면 `]`만 쓴다.
 */
const markAttrs = (block: BlockDefinition, mark: CmsMark): string => {
	const parts = Object.entries(block.attributes).flatMap(([name, attribute]) => {
		const value = mark.attrs?.[name];
		if (attribute.type === "boolean") return value === true || value === "true" ? [name] : [];
		if (typeof value === "string" && value !== "") return [`${name}="${escapeAttr(value)}"`];
		return attribute.required ? [`${name}="${escapeAttr(value == null ? "" : String(value))}"`] : [];
	});
	return parts.length > 0 ? `{${parts.join(" ")}}` : "";
};

const markKey = (mark: CmsMark) => `${mark.type}:${JSON.stringify(mark.attrs ?? null)}`;

const sortedMarks = (marks: CmsMark[] | undefined): CmsMark[] => sortMarks(marks ?? []);

const openMark = (mark: CmsMark): string => {
	const added = ADDED_MARKS.get(mark.type);
	if (added && added.syntax.kind === "text") return `:${added.syntax.directive}[`;
	switch (mark.type) {
		case "untranslated":
			return ":untranslated[";
		case "underline":
			return ":u[";
		case "superscript":
			return ":sup[";
		case "subscript":
			return ":sub[";
		case "bold":
			return "**";
		case "italic":
			return "*";
		case "strike":
			return "~~";
		case "code":
			return "`";
		case "link":
			return "[";
		default:
			return "";
	}
};

const closeMark = (mark: CmsMark): string => {
	const added = ADDED_MARKS.get(mark.type);
	if (added) return `]${markAttrs(added, mark)}`;
	switch (mark.type) {
		case "underline":
		case "superscript":
		case "subscript":
		case "untranslated":
			return "]";
		case "bold":
			return "**";
		case "italic":
			return "*";
		case "strike":
			return "~~";
		case "code":
			return "`";
		case "link": {
			const href = String(mark.attrs?.href ?? "");
			const title = mark.attrs?.title;
			return typeof title === "string" && title.length > 0 ? `](${href} "${title}")` : `](${href})`;
		}
		default:
			return "";
	}
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === "object" && value !== null && !Array.isArray(value);

/** JSX의 spread 속성은 directive로 표현할 수 없다 → JSX로 남긴다(조용한 손실 금지). */
const hasSpread = (node: CmsNode): boolean =>
	Array.isArray(node.attrs?.attributes) && node.attrs.attributes.some((item) => isRecord(item) && Boolean(item.spread));

/** 노드가 directive로 저장되는지 판정한다. 이름은 컴포넌트 이름(`attrs.name` 또는 `type`)이다. */
const directiveFor = (node: CmsNode): DirectiveDefinition | undefined =>
	hasSpread(node) ? undefined : DIRECTIVE_BY_COMPONENT.get(jsxName(node));

/**
 * directive 속성 문자열(`{name="값"}`). 정의에 있는 속성을 표 순서대로 쓰고, 정의에 없는 속성도 뒤에 붙여 버리지 않는다.
 * 불리언은 참이면 이름만 쓰고 거짓이면 생략한다(§4.4).
 */
const serializeDirectiveAttrs = (node: CmsNode, definition: DirectiveDefinition): string => {
	const attrs = node.attrs ?? {};
	const parts: string[] = [];
	const done = new Set<string>();

	const print = (name: string, value: CmsJsonValue | undefined) => {
		if (done.has(name)) return;
		done.add(name);
		if (definition.attributes[name] === "boolean") {
			// 없는 속성과 거짓은 쓰지 않는다(§4.4). 참일 때만 이름을 쓴다.
			if (value === undefined || value === null || value === false || value === "false") return;
			parts.push(name);
			return;
		}
		if (name === "rotate" && (value === "0" || value === 0 || value === "" || value === undefined || value === null)) {
			return;
		}
		if (name === "crop" && (value === "" || value === "0,0,100,100" || value === undefined || value === null)) {
			return;
		}
		if (name === "title" && (value === "" || value === undefined || value === null)) {
			return;
		}
		if (value === undefined || value === null) return;
		parts.push(`${name}="${escapeAttr(String(value))}"`);
	};

	for (const name of Object.keys(definition.attributes)) print(name, attrs[name]);
	for (const [name, value] of Object.entries(attrs)) {
		if (reservedAttrKeys.has(name)) continue;
		print(name, value);
	}

	return parts.length > 0 ? `{${parts.join(" ")}}` : "";
};

/** 감싼 컨테이너 단계 수. 콜론 수는 `3 + 단계`(§4.4) — 변환기와 같은 식을 쓴다. */
const containerDepth = (node: CmsNode): number => {
	let max = 0;
	for (const child of node.content ?? []) {
		// 병합 표는 4콜론(table) 안에 3콜론(row)을 쓴다. 바깥 컨테이너는 최소 5콜론이어야 한다.
		if (child.type === "table" && usesDirectiveTable(child)) max = Math.max(max, 2);
		const definition = directiveFor(child);
		if (definition?.kind === "container") max = Math.max(max, 1 + containerDepth(child));
		max = Math.max(max, containerDepth(child));
	}
	return max;
};

const serializeDirective = (node: CmsNode, definition: DirectiveDefinition, indent: string): string => {
	const attrs = serializeDirectiveAttrs(node, definition);

	if (definition.kind === "leaf") return `${indent}::${definition.name}${attrs}`;

	if (definition.kind === "text") {
		const label = serializeInlines(node.content ?? [], false, true);
		// `:br`은 빈 라벨이 정본이다(§4.4). 라벨에 내용이 있으면 버리지 않고 보존한다.
		return `${indent}:${definition.name}[${definition.name === "br" && label.length === 0 ? "" : label}]${attrs}`;
	}

	const inner = serializeBlocks(node.content ?? [], "");
	const fence = ":".repeat(3 + containerDepth(node));
	if (inner.length === 0) return `${indent}${fence}${definition.name}${attrs}\n${indent}${fence}`;
	return `${indent}${fence}${definition.name}${attrs}\n${inner}\n${indent}${fence}`;
};

const serializeImage = (node: CmsNode): string => {
	const mediaId = node.attrs?.mediaId;
	const src = node.attrs?.src ? String(node.attrs.src) : "";
	const alt = node.attrs?.alt ? String(node.attrs.alt) : "";
	const width = node.attrs?.width ? String(node.attrs.width) : undefined;
	const align = node.attrs?.align ? String(node.attrs.align) : undefined;
	const caption = node.attrs?.caption ? String(node.attrs.caption) : undefined;
	const crop = node.attrs?.crop ? String(node.attrs.crop) : undefined;
	const hasCrop = crop && crop !== "0,0,100,100";
	const rotate = node.attrs?.rotate ? String(node.attrs.rotate) : undefined;
	const hasRotate = rotate && rotate !== "0";

	const decorative = node.attrs?.decorative === true || node.attrs?.decorative === "true";

	// §4.4: 미디어 참조·크기·정렬·캡션·장식 표시가 있으면 `image` 리프로, 없으면 Markdown 이미지로 저장한다.
	if (mediaId || width || align || caption || decorative || hasCrop || hasRotate) {
		const definition = DIRECTIVE_BY_COMPONENT.get("Image");
		if (definition) return `::image${serializeDirectiveAttrs(node, definition)}`;
	}

	const title = node.attrs?.title;
	if (typeof title === "string" && title.length > 0) return `![${alt}](${src} "${title}")`;
	return `![${alt}](${src})`;
};

const encodeLeadingSpaces = (value: string, inCode: boolean, inLabel = false): string => {
	const match = /^[ \t]+/.exec(value);
	if (!match) return escapeText(value, inCode, inLabel);
	return `${"&#x20;".repeat(match[0].replace(/\t/g, " ").length)}${escapeText(value.slice(match[0].length), inCode, inLabel)}`;
};

const EMPHASIS_MARKS = new Set(["bold", "italic", "strike"]);

/**
 * CommonMark 강조 구분자는 안쪽 첫/끝 글자가 공백·문장부호면 열리거나 닫히지 않는다
 * (`**정적(Static)**과`는 강조가 아니라 별표가 글자로 남는다). 그런 경우만 JSX로 쓴다.
 */
const EMPHASIS_UNSAFE_EDGE = /^[\s\p{P}\p{S}]|[\s\p{P}\p{S}]$/u;

const jsxOpenMark = (mark: CmsMark): string => {
	switch (mark.type) {
		case "bold":
			return "<strong>";
		case "italic":
			return "<em>";
		case "strike":
			return "<del>";
		default:
			return openMark(mark);
	}
};

const jsxCloseMark = (mark: CmsMark): string => {
	switch (mark.type) {
		case "bold":
			return "</strong>";
		case "italic":
			return "</em>";
		case "strike":
			return "</del>";
		default:
			return closeMark(mark);
	}
};

const serializeInlines = (nodes: CmsNode[], asParagraph = false, inLabel = false): string => {
	const out: string[] = [];
	// 열린 마크마다 여는 구분자의 조각 위치와 내용이 시작하는 조각 위치를 기억한다.
	// 닫을 때 내용 앞뒤 글자를 보고 Markdown 강조가 성립하는지 판정한다.
	const active: { mark: CmsMark; openIndex: number; contentIndex: number }[] = [];
	let atLineStart = asParagraph;

	const closeEntry = (entry: { mark: CmsMark; openIndex: number; contentIndex: number }) => {
		if (EMPHASIS_MARKS.has(entry.mark.type)) {
			const content = out.slice(entry.contentIndex).join("");
			if (content.length === 0 || EMPHASIS_UNSAFE_EDGE.test(content)) {
				out[entry.openIndex] = jsxOpenMark(entry.mark);
				out.push(jsxCloseMark(entry.mark));
				return;
			}
		}
		out.push(closeMark(entry.mark));
	};

	const closeTo = (index: number) => {
		while (active.length > index) {
			const entry = active.pop();
			if (entry) closeEntry(entry);
		}
	};

	for (const node of nodes) {
		if (node.type === "hardBreak") {
			// 강제 줄바꿈은 `:br[]`로만 쓴다. `\`+줄바꿈은 원문 줄바꿈을 만들어 `remark-breaks`가
			// 의도하지 않은 `<br>`을 찍으므로 쓰지 않는다(§4.4).
			closeTo(0);
			out.push(":br[]");
			atLineStart = false;
			continue;
		}
		if (node.type === "image") {
			closeTo(0);
			out.push(serializeImage(node));
			continue;
		}
		const directive = directiveFor(node);
		if (directive) {
			closeTo(0);
			out.push(serializeDirective(node, directive, ""));
			continue;
		}
		if (node.type === "mdxJsx" || BLOCK_JSX_NAMES.has(node.type) || INLINE_JSX_MARKS[node.type]) {
			closeTo(0);
			out.push(serializeJsx(node));
			continue;
		}
		if (node.type === "mdxExpression") {
			closeTo(0);
			out.push(`{${String(node.attrs?.value ?? "")}}`);
			continue;
		}
		if (node.type !== "text") {
			closeTo(0);
			if (node.content) out.push(serializeInlines(node.content, false, inLabel));
			else if (node.text) out.push(escapeText(node.text, false, inLabel));
			continue;
		}

		const wanted = sortedMarks(node.marks);
		let same = 0;
		while (
			same < active.length &&
			same < wanted.length &&
			markKey(active[same]?.mark ?? { type: "" }) === markKey(wanted[same] ?? { type: "" })
		) {
			same += 1;
		}
		closeTo(same);
		for (let index = same; index < wanted.length; index += 1) {
			const mark = wanted[index];
			if (!mark) continue;
			const openIndex = out.length;
			out.push(openMark(mark));
			active.push({ mark, openIndex, contentIndex: openIndex + 1 });
		}
		const inCode = wanted.some((mark) => mark.type === "code");
		const text = node.text ?? "";
		out.push(
			atLineStart && !inCode
				? encodeLeadingSpaces(text, inCode, inLabel || wanted.some((mark) => LABEL_MARKS.has(mark.type)))
				: escapeText(text, inCode, inLabel || wanted.some((mark) => LABEL_MARKS.has(mark.type))),
		);
		atLineStart = false;
	}
	closeTo(0);

	const result = out.join("");
	if (!asParagraph) return result;
	// 문단이 `1. `로 시작하면 재파싱 시 순서 목록으로 해석되므로 목록 기호를 이스케이프한다.
	// 단, 백슬래시는 숫자가 아니라 마침표 앞에 붙여야 한다(`1\. `). `\1. `는 숫자를 이스케이프해 문자 그대로 남는다.
	const withEscapedListMarker = result.replace(/^(\s*)(\d+)\.(\s)/, "$1$2\\.$3");
	return withEscapedListMarker.replace(/^(\s*)([>#]|-{1,3}\s|\*{1,3}\s|```)/, "$1\\$2");
};

const serializeCodeBlock = (node: CmsNode, indent: string): string => {
	const attrs = node.attrs ?? {};
	let language = typeof attrs.language === "string" ? attrs.language : "";
	let meta = typeof attrs.meta === "string" ? attrs.meta : "";
	let value = typeof attrs.value === "string" ? attrs.value : "";

	if (value.length === 0 && attrs.codeDocument && typeof attrs.codeDocument === "object") {
		const fence = fromCodeBlockDocumentToCodeFence(
			attrs.codeDocument as unknown as CodeBlockDocument,
			annotationConfig,
		);
		language = fence.lang ?? language;
		meta = fence.meta ?? meta;
		value = fence.value;
	}

	const fence = serializeFence(language, meta, value);
	if (!indent) return fence;
	return fence
		.split("\n")
		.map((line) => indent + line)
		.join("\n");
};

const serializeJsx = (node: CmsNode, indent = ""): string => {
	const name = jsxName(node);
	const attrs = serializeJsxAttrs(node);
	const inner = serializeBlocks(node.content ?? [], "");
	if (!inner) return `${indent}<${name}${attrs} />`;
	return `${indent}<${name}${attrs}>\n\n${inner}\n\n${indent}</${name}>`;
};

const serializeList = (node: CmsNode, indent: string, ordered: boolean): string => {
	const start = typeof node.attrs?.start === "number" ? node.attrs.start : 1;
	return (node.content ?? [])
		.map((item, index) => {
			const checked = item.attrs?.checked;
			const task = typeof checked === "boolean" ? `[${checked ? "x" : " "}] ` : "";
			const marker = ordered ? `${start + index}. ${task}` : `- ${task}`;
			return serializeListItem(item, marker, indent);
		})
		.join("\n");
};

const serializeListItem = (item: CmsNode, marker: string, indent: string): string => {
	const blocks = item.content ?? [];
	const innerIndent = indent + " ".repeat(Math.max(marker.length, 2));
	if (blocks.length === 0) return `${indent}${marker}`.trimEnd();

	const [first, ...rest] = blocks;
	let head = `${indent}${marker}`;
	if (first?.type === "paragraph") {
		head += serializeInlines(first.content ?? [], true);
	} else if (first) {
		head += `\n${serializeBlock(first, innerIndent)}`;
	}

	const extra = rest.map((block) => {
		if (block.type === "paragraph") return `${innerIndent}${serializeInlines(block.content ?? [], true)}`;
		return serializeBlock(block, innerIndent);
	});
	// listItem 안의 블록이 여러 개면(loose list) 빈 줄로 분리해야 문단 경계가 유지된다.
	// 한 줄로 이어 붙이면 재파싱 시 하나의 문단으로 합쳐져 문단 구조가 사라진다.
	return [head, ...extra].join("\n\n");
};

const serializeGfmTable = (node: CmsNode): string => {
	const rows = node.content ?? [];
	const serializedRows = rows.map((row) => {
		const cells = (row.content ?? []).map((cell) => serializeInlines(cell.content ?? []).replace(/\|/g, "\\|"));
		return `| ${cells.join(" | ")} |`;
	});
	if (serializedRows.length === 0) return "";
	const columnCount = rows[0]?.content?.length ?? 1;
	const align = Array.isArray(node.attrs?.align) ? node.attrs.align : [];
	const rule = (value: unknown) =>
		value === "left" ? ":--" : value === "center" ? ":-:" : value === "right" ? "--:" : "---";
	const separator = `| ${Array.from({ length: columnCount }, (_, index) => rule(align[index])).join(" | ")} |`;
	const [header, ...body] = serializedRows;
	return [header, separator, ...body].join("\n");
};

const tableCellAttrs = (cell: CmsNode): string[] => {
	const attrs: string[] = [];
	if (cell.attrs?.header === true || cell.attrs?.header === "true") attrs.push("header");
	const colspan = Number(cell.attrs?.colspan ?? 1);
	if (colspan > 1) attrs.push(`colspan=${colspan}`);
	const rowspan = Number(cell.attrs?.rowspan ?? 1);
	if (rowspan > 1) attrs.push(`rowspan=${rowspan}`);
	return attrs;
};

/** 표 속성(`align`, `widths`)을 저장 순서대로 모은다. */
const tableAttrs = (node: CmsNode): Array<[string, string]> => {
	const attrs: Array<[string, string]> = [];
	const align = tableAlign(node);
	if (align) attrs.push(["align", align]);
	const widths = formatTableWidths(tableWidths(node));
	if (widths) attrs.push(["widths", widths]);
	return attrs;
};

const tableAlign = (node: CmsNode): string => {
	const align = Array.isArray(node.attrs?.align) ? (node.attrs.align as Array<string | null>) : [];
	const value = align.map((v) => v ?? "").join(",");
	return value.replace(/,/g, "").length > 0 ? value : "";
};

// directive 라벨 대괄호가 맞지 않으면 파서가 셀을 잃으므로 같은 의미의 JSX 표로 저장한다.
const serializeJsxTable = (node: CmsNode, rows: string[][]): string => {
	const attrs = tableAttrs(node).map(([name, value]) => ` ${name}="${escapeAttr(value)}"`);
	const lines = [`<Table${attrs.join("")}>`];
	(node.content ?? []).forEach((row, rowIndex) => {
		lines.push("<TableRow>");
		(row.content ?? []).forEach((cell, cellIndex) => {
			const attrs = tableCellAttrs(cell).map((attr) => attr.replace(/=(\d+)$/, '="$1"'));
			lines.push(
				`<TableCell${attrs.length ? ` ${attrs.join(" ")}` : ""}>${rows[rowIndex]?.[cellIndex] ?? ""}</TableCell>`,
			);
		});
		lines.push("</TableRow>");
	});
	lines.push("</Table>");
	return lines.join("\n");
};

const serializeDirectiveTable = (node: CmsNode): string => {
	const rows = node.content ?? [];
	const labels = rows.map((row) =>
		(row.content ?? []).map((cell) => serializeInlines(cell.content ?? [], false, true)),
	);
	if (labels.some((row) => row.some((label) => !hasBalancedLabelBrackets(label)))) {
		return serializeJsxTable(node, labels);
	}
	const attrs = tableAttrs(node).map(([name, value]) => `${name}="${value}"`);
	const lines: string[] = [`::::table${attrs.length ? `{${attrs.join(" ")}}` : ""}`];
	rows.forEach((row, rowIndex) => {
		lines.push(":::row");
		(row.content ?? []).forEach((cell, cellIndex) => {
			const cellAttrs = tableCellAttrs(cell);
			const attrStr = cellAttrs.length > 0 ? `{${cellAttrs.join(" ")}}` : "";
			lines.push(`::cell[${labels[rowIndex]?.[cellIndex] ?? ""}]${attrStr}`);
		});
		lines.push(":::");
	});
	lines.push("::::");
	return lines.join("\n");
};

const serializeTable = (node: CmsNode): string => {
	if (usesDirectiveTable(node)) {
		return serializeDirectiveTable(node);
	}
	return serializeGfmTable(node);
};

const serializeBlock = (node: CmsNode, indent = ""): string => {
	const definition = directiveFor(node);
	if (definition) return serializeDirective(node, definition, indent);

	switch (node.type) {
		case "paragraph":
			return indent + serializeInlines(node.content ?? [], true);
		case "heading": {
			const level = typeof node.attrs?.level === "number" ? node.attrs.level : 2;
			return `${indent}${"#".repeat(level)} ${serializeInlines(node.content ?? [])}`;
		}
		case "codeBlock":
			return serializeCodeBlock(node, indent);
		case "math":
			return `${indent}$$\n${String(node.attrs?.value ?? "")}\n$$`;
		case "bulletList":
			return serializeList(node, indent, false);
		case "orderedList":
			return serializeList(node, indent, true);
		case "table":
			return serializeTable(node)
				.split("\n")
				.map((line) => indent + line)
				.join("\n");
		case "blockquote":
			return serializeBlocks(node.content ?? [], "")
				.split("\n")
				.map((line) => `${indent}>${line ? ` ${line}` : ""}`)
				.join("\n");
		case "horizontalRule":
			return `${indent}---`;
		case "image":
			return indent + serializeImage(node);
		case "html":
			// 여러 줄 원문(되돌린 미등록 지시자 등)은 줄마다 들여 써야 목록 안에서도 같은 블록으로 다시 읽힌다.
			return String(node.attrs?.value ?? "")
				.split("\n")
				.map((line) => (line ? indent + line : line))
				.join("\n");
		case "mdxEsm":
			return indent + String(node.attrs?.value ?? "");
		case "mdxExpression":
			return `${indent}{${String(node.attrs?.value ?? "")}}`;
		case "doc":
			return serializeBlocks(node.content ?? [], indent);
		default:
			if (BLOCK_JSX_NAMES.has(node.type) || node.type === "mdxJsx" || INLINE_JSX_MARKS[node.type]) {
				return serializeJsx(node, indent);
			}
			if (node.content) return serializeBlocks(node.content, indent);
			return "";
	}
};

const serializeBlocks = (nodes: CmsNode[], indent = ""): string =>
	nodes
		.map((node) => serializeBlock(node, indent))
		.filter((block) => block.length > 0)
		.join("\n\n");

export const serialize = (doc: unknown): string => {
	const node = doc as CmsNode;
	const body = serializeBlocks(node.type === "doc" ? (node.content ?? []) : [node]).trimEnd();
	const frontmatter = node.attrs?.frontmatter;
	if (frontmatter && typeof frontmatter === "object" && !Array.isArray(frontmatter)) {
		return `${serializeFrontmatter(frontmatter)}\n${body}\n`;
	}
	return body.length > 0 ? `${body}\n` : "";
};
