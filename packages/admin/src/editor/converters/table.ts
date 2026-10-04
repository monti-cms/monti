import type { CmsJsonValue } from "@monti-cms/core/mdx";
import {
	boundedTableSpan,
	formatTableWidths,
	hasGfmHeaderLayout,
	MAX_TABLE_COLUMN_WIDTH,
	MAX_TABLE_COLUMNS,
	parseTableWidths,
	tableCellColumns,
	tableHasMergedCells,
	tableWidths,
} from "@monti-cms/core/mdx";
import { brDirectiveNode } from "./shared";
import type { BlockConverter } from "./types";

const tableAttrs = (align: unknown, widths: Array<number | null>) => {
	const attrs: Record<string, CmsJsonValue> = {};
	if (Array.isArray(align)) attrs.align = align as CmsJsonValue;
	if (widths.length > 0) attrs.widths = widths;
	return Object.keys(attrs).length > 0 ? { attrs } : {};
};

export const tableConverter: BlockConverter = {
	name: "table",
	cmsTypes: ["table"],
	tiptapTypes: ["table"],
	// GFM 표는 셀마다 인라인만 담는다.
	isMappable: (node, ctx) =>
		(node.content ?? []).every(
			(row) =>
				row.type === "tableRow" &&
				(row.content ?? []).every(
					(cell) => cell.type === "tableCell" && (cell.content ?? []).every(ctx.isMappableInline),
				),
		),
	toTiptap: (node, ctx) => {
		const rows = node.content ?? [];
		const hasMerges = tableHasMergedCells(node);
		const widths = tableWidths(node);
		const columns = tableCellColumns(rows.map((row) => row.content ?? []));
		return {
			type: "table",
			...(Array.isArray(node.attrs?.align) ? { attrs: { align: node.attrs.align } } : {}),
			content: rows.map((row, rowIndex) => ({
				type: "tableRow",
				content: (row.content ?? []).map((cell, cellIndex) => {
					const isHeader =
						cell.attrs?.header === true || (!hasMerges && cell.attrs?.header === undefined && rowIndex === 0);
					const colspan = boundedTableSpan(cell.attrs?.colspan, MAX_TABLE_COLUMNS);
					const rowspan = boundedTableSpan(cell.attrs?.rowspan, rows.length - rowIndex);
					const attrs: Record<string, unknown> = {};
					if (colspan > 1) attrs.colspan = colspan;
					if (rowspan > 1) attrs.rowspan = rowspan;
					// 표의 열 너비를 셀이 덮는 열마다 prosemirror-tables의 colwidth로 나눠 준다(0은 자동).
					const start = columns[rowIndex]?.[cellIndex] ?? 0;
					const colwidth = Array.from({ length: colspan }, (_, index) => widths[start + index] ?? 0);
					if (colwidth.some((width) => width > 0)) attrs.colwidth = colwidth;
					return {
						type: isHeader ? "tableHeader" : "tableCell",
						...(Object.keys(attrs).length > 0 ? { attrs } : {}),
						content: [{ type: "paragraph", content: ctx.inlineToTiptap(cell.content ?? []) }],
					};
				}),
			})),
		};
	},
	toCms: (node, ctx) => {
		const rows = node.content ?? [];
		// 병합 셀이 있는지 확인한다. 병합 셀이 있으면 header 속성을 유지하고, 없으면 GFM 규칙을 따른다.
		const hasMerges = tableHasMergedCells(node);
		// 셀의 colwidth를 격자 열 기준 표 너비 목록으로 모은다.
		const columns = tableCellColumns(rows.map((row) => row.content ?? []));
		const collected: Array<number | null> = [];
		rows.forEach((row, rowIndex) => {
			(row.content ?? []).forEach((cell, cellIndex) => {
				const colwidth = Array.isArray(cell.attrs?.colwidth) ? cell.attrs.colwidth : [];
				const start = columns[rowIndex]?.[cellIndex] ?? 0;
				colwidth.forEach((width, index) => {
					if (typeof width === "number" && width > 0)
						collected[start + index] ??= Math.min(MAX_TABLE_COLUMN_WIDTH, Math.round(width));
				});
			});
		});
		const widths = parseTableWidths(formatTableWidths(Array.from(collected)));
		const directive = hasMerges || widths.length > 0;
		const explicitHeaders =
			hasMerges ||
			!hasGfmHeaderLayout(rows.map((row) => (row.content ?? []).map((cell) => cell.type === "tableHeader")));

		return [
			{
				type: "table",
				...tableAttrs(node.attrs?.align, widths),
				content: rows.map((row) => ({
					type: "tableRow",
					content: (row.content ?? []).map((cell) => {
						// 셀 안의 여러 문단은 GFM 표에 담을 수 없어 줄바꿈으로 잇는다.
						const paragraphs = (cell.content ?? []).map((block) => ctx.inlineToCms(block.content));
						const inline = paragraphs.flatMap((content, index) =>
							index === 0 ? content : [brDirectiveNode(), ...content],
						);
						const colspan = Number(cell.attrs?.colspan ?? 1);
						const rowspan = Number(cell.attrs?.rowspan ?? 1);
						const isHeader = cell.type === "tableHeader";
						const attrs: Record<string, CmsJsonValue> = {};
						if (colspan > 1) attrs.colspan = colspan;
						if (rowspan > 1) attrs.rowspan = rowspan;
						// 병합·열 너비 표는 머리글만, 비GFM 머리글 배치는 모든 셀의 머리글 여부를 명시한다.
						// GFM 첫 행 머리글 표는 속성을 비워 기존 바이트를 보존한다.
						if (directive && isHeader) attrs.header = true;
						else if (explicitHeaders && !directive) attrs.header = isHeader;

						return {
							type: "tableCell",
							...(Object.keys(attrs).length > 0 ? { attrs } : {}),
							content: inline,
						};
					}),
				})),
			},
		];
	},
};
