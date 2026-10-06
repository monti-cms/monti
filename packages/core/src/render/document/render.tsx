import { type ComponentType, createElement, Fragment, type ReactNode } from "react";
import { ADDED_BLOCKS } from "../../blocks/active";
import type { BlockDefinition } from "../../blocks/define";
import { BLOCK_BY_NAME, fenceBlockOf, TEXT_ALIGN_VALUES } from "../../blocks/derive";
import { type ImageResolveResult, resolveImageUrl } from "../../mdx/image-src";
import { sortMarks } from "../../mdx/registry";
import {
	boundedTableSpan,
	formatTableWidths,
	hasNonGfmHeaderLayout,
	MAX_TABLE_COLUMNS,
	parseTableWidths,
	tableHasMergedCells,
	tableWidths,
} from "../../mdx/table-layout";
import type { CmsMark, CmsNode } from "../../mdx/types";
import { validImageWidth } from "../components/image";
import type { Analysis } from "./analyze";
import { headingLevel } from "./analyze";
import { readAttributes } from "./attributes";
import { type CodeTags, codePreElement, type HighlightedCode, readCodeBlock } from "./code";
import type {
	BlockItem,
	CommonProps,
	ImageProps,
	LooseDocumentComponents,
	RenderContext,
	RenderDocumentOptions,
	StoredNode,
	UnknownProps,
} from "./types";

/**
 * The synchronous half of `renderDocument`: stored nodes → React elements. Everything that needs the whole document or async work
 * (anchors, footnote numbers, highlighting, math) was done before (`analyze.ts`, the pre-pass in `index.tsx`).
 */

/** The blocks the site and its plugins add (a core node such as `image` is not one: the renderer draws it itself). */
const ADDED_BY_NAME: ReadonlyMap<string, BlockDefinition> = new Map(ADDED_BLOCKS.map((block) => [block.name, block]));

// biome-ignore lint/suspicious/noExplicitAny: the component table holds components with different props
type AnyComponent = ComponentType<any>;

/** A merged component table with every core component present. */
export type ResolvedComponents = Required<Omit<LooseDocumentComponents, "marks" | "blocks" | "codeTags">> & {
	readonly marks: Readonly<Record<string, AnyComponent>>;
	readonly blocks: Readonly<Record<string, AnyComponent>>;
	readonly codeTags: CodeTags;
};

export interface RenderInput {
	readonly analysis: Analysis;
	readonly highlighted: ReadonlyMap<CmsNode, HighlightedCode>;
	readonly math: ReadonlyMap<CmsNode, string>;
	readonly components: ResolvedComponents;
	readonly ctx: RenderContext;
	readonly options: RenderDocumentOptions;
}

interface UnknownReport {
	readonly nodes: CmsNode[];
}

const isBlankParagraph = (node: CmsNode): boolean =>
	node.type === "paragraph" &&
	(node.content ?? []).every((child) => child.type === "hardBreak" || (child.type === "text" && !child.text));

/** A paragraph of only line breaks is one blank line per break (at least one), as the serializer writes it. */
const blankLineCount = (node: CmsNode): number =>
	Math.max((node.content ?? []).filter((child) => child.type === "hardBreak").length, 1);

const markKey = (mark: CmsMark) => `${mark.type}:${JSON.stringify(mark.attrs ?? null)}`;

const isHeaderValue = (header: unknown) => header === true || header === "true" || header === "";

const ALIGNS = new Set(["left", "center", "right"]);

const asAlign = (value: unknown): "left" | "center" | "right" | undefined =>
	typeof value === "string" && ALIGNS.has(value) ? (value as "left" | "center" | "right") : undefined;

/** The blocks of a container: a lone blank paragraph is what the editor puts in an empty container, not a blank line, so it is nothing. */
const visibleBlocks = (nodes: readonly CmsNode[] | undefined): readonly CmsNode[] => {
	const list = nodes ?? [];
	const only = list.length === 1 ? list[0] : undefined;
	return only && isBlankParagraph(only) ? [] : list;
};

/** Blank paragraphs at the very end of the document are not content (the serializer does not write them). */
const withoutTrailingBlank = (nodes: readonly CmsNode[]): readonly CmsNode[] => {
	let end = nodes.length;
	while (end > 0 && isBlankParagraph(nodes[end - 1] as CmsNode)) end -= 1;
	return end === nodes.length ? nodes : nodes.slice(0, end);
};

const keyed = (nodes: readonly ReactNode[]): ReactNode[] =>
	nodes.map((node, index) => createElement(Fragment, { key: index }, node));

export const renderDocumentTree = (
	nodes: readonly CmsNode[],
	input: RenderInput,
): { content: ReactNode; unknown: StoredNode[] } => {
	const { analysis, components, ctx, options } = input;
	const report: UnknownReport = { nodes: [] };
	const reported = new Set<CmsNode>();

	const common = (node: CmsNode): CommonProps => ({ blockId: node.id, node, ctx });

	/** Notes that a node reached the fallback. Throws in strict mode. */
	const unknown = (node: CmsNode, reason: UnknownProps["reason"]) => {
		if (reported.has(node)) return;
		reported.add(node);
		report.nodes.push(node);
		if (options.strict) throw new Error(`Unknown content in document (${reason}): ${node.type}`);
		options.onUnknown?.(node);
	};

	const fallback = (
		node: CmsNode,
		kind: UnknownProps["kind"],
		reason: UnknownProps["reason"],
		children?: ReactNode,
	): ReactNode => {
		unknown(node, reason);
		return createElement(components.fallback, { node, kind, reason, children, ctx } satisfies UnknownProps);
	};

	// ---- inline content ------------------------------------------------------------------------------------------------------------

	const resolveLinkHref = (href: unknown): string | undefined => {
		if (typeof href !== "string") return undefined;
		return options.resolveHref ? options.resolveHref(href) : href;
	};

	const applyMark = (mark: CmsMark, children: ReactNode, node: CmsNode): ReactNode => {
		const type = mark.type;
		if (type === "link") {
			const href = resolveLinkHref(mark.attrs?.href);
			const title = typeof mark.attrs?.title === "string" && mark.attrs.title ? mark.attrs.title : undefined;
			const external = typeof href === "string" && /^https?:\/\//.test(href);
			return createElement(components.marks.link as AnyComponent, { href, title, external, children, ctx });
		}
		// A core mark has a component of its own (`bold`, `underline`, `untranslated`), whatever blocks the site defines.
		if (CORE_MARKS.has(type)) return createElement(components.marks[type] as AnyComponent, { children, ctx });
		const definition = BLOCK_BY_NAME.get(type);
		// A mark nobody knows is shown as plain text.
		if (!definition || definition.syntax.kind !== "text") return fallback(node, "mark", "unknown-mark", children);
		const component = components.marks[type];
		if (!component) return fallback(node, "mark", "no-component", children);
		const { props, malformed } = readAttributes(definition, mark.attrs);
		if (malformed.length > 0) return fallback(node, "mark", "malformed", children);
		return createElement(component, { ...props, children, ctx });
	};

	const renderRun = (items: readonly { node: CmsNode; marks: readonly CmsMark[] }[], depth: number): ReactNode[] => {
		const out: ReactNode[] = [];
		let index = 0;
		while (index < items.length) {
			const item = items[index] as { node: CmsNode; marks: readonly CmsMark[] };
			const mark = item.marks[depth];
			if (!mark) {
				out.push(renderInlineNode(item.node));
				index += 1;
				continue;
			}
			// The marks the following nodes share (outermost first) stay open around all of them: `**a *b***` is one `<strong>`.
			let end = index + 1;
			while (end < items.length) {
				const next = items[end]?.marks[depth];
				if (!next || markKey(next) !== markKey(mark)) break;
				end += 1;
			}
			out.push(applyMark(mark, keyed(renderRun(items.slice(index, end), depth + 1)), item.node));
			index = end;
		}
		return out;
	};

	const renderInline = (nodes: readonly CmsNode[] | undefined): ReactNode[] =>
		keyed(
			renderRun(
				(nodes ?? []).map((node) => ({
					node,
					marks: node.type === "text" ? sortMarks(node.marks ?? []) : [],
				})),
				0,
			),
		);

	const renderInlineNode = (node: CmsNode): ReactNode => {
		switch (node.type) {
			case "text":
				return node.text ?? "";
			case "hardBreak":
				return createElement(components.hardBreak, common(node) as never);
			case "footnoteReference": {
				const found = analysis.refs.get(node);
				if (!found) return `[^${String(node.attrs?.label ?? "")}]`;
				return createElement(components.footnoteRef, {
					label: String(node.attrs?.label ?? ""),
					index: found.entry.index,
					refId: found.refId,
					targetId: found.entry.id,
					ctx,
				});
			}
			case "image":
				return renderImage(node, true);
			default:
				return renderBlock(node, true);
		}
	};

	// ---- blocks ------------------------------------------------------------------------------------------------------------------

	const renderBlocks = (nodes: readonly CmsNode[]): ReactNode[] =>
		keyed(visibleBlocks(nodes).map((node) => renderBlock(node, false)));

	/** A paragraph. `lead` is put in front of its text (the checkbox of a task list item). */
	const renderParagraph = (node: CmsNode, lead?: ReactNode): ReactNode => {
		if (isBlankParagraph(node) && lead === undefined) {
			return Array.from({ length: blankLineCount(node) }, (_, index) =>
				createElement(components.hardBreak, { key: index, ...common(node) } as never),
			);
		}
		const text = renderInline(node.content);
		const children = lead === undefined ? text : [lead, ...(text.length > 0 ? [" "] : []), ...text];
		return createElement(components.paragraph, { ...common(node), children } as never);
	};

	const renderHeading = (node: CmsNode): ReactNode => {
		const level = headingLevel(node);
		const id = analysis.slugs.get(node);
		if (level === undefined || id === undefined)
			return fallback(node, "block", "malformed", renderInline(node.content));
		return createElement(components.heading, {
			...common(node),
			level,
			id,
			children: renderInline(node.content),
		} as never);
	};

	const checkbox = (checked: boolean) =>
		createElement("input", { type: "checkbox", disabled: true, defaultChecked: checked });

	const renderListItem = (node: CmsNode, loose: boolean): ReactNode => {
		const checked = typeof node.attrs?.checked === "boolean" ? node.attrs.checked : undefined;
		const head = checked === undefined ? undefined : checkbox(checked);
		const blocks = visibleBlocks(node.content);
		// The checkbox goes in the item's first paragraph (a new one if the item does not start with a paragraph).
		const alone = (lead: ReactNode) =>
			loose ? createElement(components.paragraph, { ...common(node), children: lead } as never) : lead;
		const children: ReactNode[] = [];
		if (blocks.length === 0 && head !== undefined) children.push(alone(head));
		blocks.forEach((block, index) => {
			const lead = index === 0 ? head : undefined;
			if (block.type === "paragraph") {
				if (loose) {
					children.push(renderParagraph(block, lead));
				} else {
					// A tight item shows the text of its paragraph without a `<p>`.
					const text = renderInline(block.content);
					children.push(...(lead === undefined ? [] : [lead, ...(text.length > 0 ? [" "] : [])]), ...text);
				}
				return;
			}
			if (lead !== undefined) children.push(alone(lead));
			children.push(renderBlock(block, false));
		});
		return createElement(components.listItem, { ...common(node), checked, children: keyed(children) } as never);
	};

	const renderList = (node: CmsNode): ReactNode => {
		const items = (node.content ?? []).filter((item) => item.type === "listItem");
		const loose = items.some((item) => (item.content?.length ?? 0) > 1);
		const ordered = node.type === "orderedList";
		const start = typeof node.attrs?.start === "number" ? node.attrs.start : undefined;
		const tasks = items.some((item) => typeof item.attrs?.checked === "boolean");
		const children = keyed(items.map((item) => renderListItem(item, loose)));
		const extra = (node.content ?? []).filter((item) => item.type !== "listItem");
		const rest = extra.map((item) => renderBlock(item, false));
		return createElement(components.list, {
			...common(node),
			ordered,
			start,
			loose,
			tasks,
			children: [...children, ...keyed(rest)],
		} as never);
	};

	const renderTable = (node: CmsNode): ReactNode => {
		const rows = (node.content ?? []).filter((row) => row.type === "tableRow");
		const explicitHeaders = needsHeaderFlags(node);
		const widths = parseTableWidths(formatTableWidths(tableWidths(node)));
		const alignments = Array.isArray(node.attrs?.align) ? node.attrs.align : [];

		const grid: boolean[][] = [];
		const placed = rows.map((row, rowIndex) => {
			let colIndex = 0;
			const cells = (row.content ?? [])
				.filter((cell) => cell.type === "tableCell")
				.map((cell) => {
					while (grid[rowIndex]?.[colIndex]) colIndex += 1;
					const colSpan = boundedTableSpan(cell.attrs?.colspan, MAX_TABLE_COLUMNS - colIndex);
					const rowSpan = boundedTableSpan(cell.attrs?.rowspan, rows.length - rowIndex);
					for (let r = 0; r < rowSpan; r += 1) {
						for (let c = 0; c < colSpan; c += 1) {
							grid[rowIndex + r] ??= [];
							(grid[rowIndex + r] as boolean[])[colIndex + c] = true;
						}
					}
					const result = {
						cell,
						colIndex,
						colSpan,
						rowSpan,
						header: explicitHeaders ? isHeaderValue(cell.attrs?.header) : rowIndex === 0,
					};
					colIndex += colSpan;
					return result;
				});
			return { row, cells, isHeader: rowIndex === 0 && cells.length > 0 && cells.every((cell) => cell.header) };
		});
		const columns = Math.max(0, ...grid.map((row) => row.length));
		const headRow = placed[0];
		// If the whole first row is headers and nothing merges downward, it goes in thead like a GFM table.
		const hasHead = !!headRow?.isHeader && headRow.cells.every((cell) => cell.rowSpan === 1);

		const renderedRows = placed.map(({ row, cells, isHeader }, rowIndex) => {
			const inHead = hasHead && rowIndex === 0;
			const rendered = cells.map(({ cell, colIndex, colSpan, rowSpan, header }) =>
				createElement(components.tableCell, {
					...common(cell),
					as: header ? "th" : "td",
					scope: header ? (isHeader ? "col" : "row") : undefined,
					colSpan,
					rowSpan,
					align: asAlign(alignments[colIndex]),
					firstColumn: colIndex === 0,
					lastColumn: colIndex + colSpan >= columns,
					inHead,
					children: renderInline(cell.content),
				} as never),
			);
			return createElement(components.tableRow, { ...common(row), inHead, children: keyed(rendered) } as never);
		});
		const keyedRows = keyed(renderedRows);
		return createElement(components.table, {
			...common(node),
			columns,
			widths,
			hasHead,
			head: hasHead ? keyedRows[0] : null,
			body: hasHead ? keyedRows.slice(1) : keyedRows,
			children: keyedRows,
		} as never);
	};

	const resolveMedia = (mediaId: string | undefined, src: string | undefined): ImageResolveResult | null =>
		options.imageResolver ? options.imageResolver({ mediaId, src }) : resolveImageUrl(src);

	const renderImage = (node: CmsNode, inline: boolean): ReactNode => {
		const definition = BLOCK_BY_NAME.get("image") as BlockDefinition;
		const { props, malformed } = readAttributes(definition, node.attrs);
		if (malformed.length > 0) return fallback(node, inline ? "inline" : "block", "malformed");
		const mediaId = props.mediaId as string | undefined;
		const src = props.src as string | undefined;
		const resolved = resolveMedia(mediaId || undefined, src || undefined);
		const ok = resolved && "url" in resolved ? resolved : undefined;
		const rotate = Number(props.rotate);
		// A Markdown image has nothing but `src`, `alt` and `title` (what the serializer writes as `![alt](src)`); anything else is an `Image` element.
		const raw = node.attrs ?? {};
		const crop = raw.crop ? String(raw.crop) : undefined;
		const turn = raw.rotate ? String(raw.rotate) : undefined;
		const rich = Boolean(
			raw.mediaId ||
				raw.width ||
				raw.align ||
				raw.caption ||
				raw.decorative === true ||
				raw.decorative === "true" ||
				(crop && crop !== "0,0,100,100") ||
				(turn && turn !== "0"),
		);
		const imageProps: ImageProps = {
			...(common(node) as CommonProps<StoredNode & { type: "image" }>),
			src: ok?.url,
			alt: (props.alt as string | undefined) ?? "",
			title: (props.title as string | undefined) || undefined,
			caption: (props.caption as string | undefined) || undefined,
			decorative: props.decorative === true,
			align: asAlign(props.align) ?? "center",
			width: validImageWidth(props.width as string | undefined),
			crop: (props.crop as string | undefined) || undefined,
			rotate: rotate === 90 || rotate === 180 || rotate === 270 ? rotate : rotate === 0 && props.rotate ? 0 : undefined,
			intrinsic: ok?.width && ok.height ? { width: ok.width, height: ok.height } : undefined,
			failure: ok ? undefined : resolved && "failure" in resolved ? resolved.failure : "unresolved",
			inline,
			plain: !rich,
		};
		return createElement(components.image, imageProps);
	};

	const renderFile = (node: CmsNode): ReactNode => {
		const definition = BLOCK_BY_NAME.get("file") as BlockDefinition;
		const { props, malformed } = readAttributes(definition, node.attrs);
		if (malformed.length > 0) return fallback(node, "block", "malformed");
		const mediaId = (props.mediaId as string | undefined) || undefined;
		const resolved = mediaId ? resolveMedia(mediaId, undefined) : null;
		const ok = resolved && "url" in resolved ? resolved : undefined;
		const rawLabel = (props.label as string | undefined) ?? "";
		const filename = ok?.file?.filename;
		return createElement(components.file, {
			...common(node),
			mediaId,
			label: rawLabel.trim() || filename || "",
			url: ok?.url,
			filename,
			byteSize: ok?.file?.byteSize,
			mimeType: ok?.file?.mimeType,
			failure: ok ? undefined : resolved && "failure" in resolved ? resolved.failure : "unresolved",
		} as never);
	};

	const renderCodeBlock = (node: CmsNode): ReactNode => {
		const { language, code, annotations } = readCodeBlock(node);
		const fence = fenceBlockOf(language);
		if (fence) return renderDefinedBlock(node, fence, code).element;
		const highlighted = input.highlighted.get(node);
		if (!highlighted) return fallback(node, "block", "malformed");
		const tags: CodeTags = components.codeTags;
		return createElement(components.codeBlock, {
			...common(node),
			language: highlighted.language,
			code: highlighted.code,
			title: highlighted.title,
			showLineNumbers: highlighted.showLineNumbers,
			notes: highlighted.notes,
			annotations,
			children: codePreElement(highlighted.pre, tags),
		} as never);
	};

	const renderMath = (node: CmsNode): ReactNode => {
		const html = input.math.get(node);
		if (html === undefined) return fallback(node, "block", "malformed");
		return createElement(components.math, { ...common(node), value: String(node.attrs?.value ?? ""), html } as never);
	};

	/**
	 * A block with a definition (a container, a leaf or a code fence): its attributes become flat props. Returns the element and its rendered content
	 * (without the component around it), so a parent that reads its children (tabs) needs no second render.
	 */
	const renderDefinedBlock = (
		node: CmsNode,
		definition: BlockDefinition,
		source?: string,
	): { element: ReactNode; children: ReactNode } => {
		const kind = definition.syntax.kind;
		const items: BlockItem[] = kind === "container" ? visibleBlocks(node.content).map(renderItem) : [];
		const body = keyed(items.map((item) => item.element));
		const component = components.blocks[definition.name];
		const content = kind === "container" ? body : undefined;
		if (!component) return { element: fallback(node, "block", "no-component", content), children: body };
		const { props, malformed } = readAttributes(definition, node.attrs);
		if (malformed.length > 0) return { element: fallback(node, "block", "malformed", content), children: body };
		const element = createElement(
			component,
			{ ...props, ...common(node), items, ...(source === undefined ? {} : { source }) },
			body,
		);
		return { element, children: body };
	};

	/** A child of a block: its node and what it renders to. */
	const renderItem = (child: CmsNode): BlockItem => {
		const definition = child.type === "codeBlock" ? undefined : ADDED_BY_NAME.get(child.type);
		if (definition && (definition.syntax.kind === "container" || definition.syntax.kind === "leaf")) {
			const { element, children } = renderDefinedBlock(child, definition);
			return { node: child, element, children };
		}
		const element = renderBlock(child, false);
		return { node: child, element, children: element };
	};

	const renderBlock = (node: CmsNode, inline: boolean): ReactNode => {
		switch (node.type) {
			case "paragraph":
				return renderParagraph(node);
			case "heading":
				return renderHeading(node);
			case "blockquote":
				return createElement(components.blockquote, {
					...common(node),
					children: renderBlocks(node.content ?? []),
				} as never);
			case "bulletList":
			case "orderedList":
				return renderList(node);
			case "horizontalRule":
				return createElement(components.horizontalRule, common(node) as never);
			case "codeBlock":
				return renderCodeBlock(node);
			case "image":
				return renderImage(node, inline);
			case "table":
				return renderTable(node);
			case "math":
				return renderMath(node);
			case "footnoteDefinition":
				// Shown once, in the footnote section at the end (if something refers to it).
				return null;
			case "text":
			case "hardBreak":
			case "footnoteReference":
				return renderInlineNode(node);
			case "file":
				return renderFile(node);
			case "text-align": {
				const align = TEXT_ALIGN_VALUES.find((value) => value === node.attrs?.align);
				return createElement(components.textAlign, {
					...common(node),
					align,
					children: renderBlocks(node.content ?? []),
				} as never);
			}
			case "html":
			case "mdxEsm":
			case "mdxExpression":
				return fallback(node, inline ? "inline" : "block", "unknown-node");
			case "mdxJsx":
				return fallback(node, inline ? "inline" : "block", "unknown-node", renderUnknownChildren(node));
			case "listItem":
			case "tableRow":
			case "tableCell":
			case "doc":
				// A node that only makes sense inside its parent: its content is still shown.
				return fallback(node, "block", "unknown-node", renderUnknownChildren(node));
			default: {
				const definition = ADDED_BY_NAME.get(node.type);
				if (definition && (definition.syntax.kind === "container" || definition.syntax.kind === "leaf")) {
					return renderDefinedBlock(node, definition).element;
				}
				return fallback(node, inline ? "inline" : "block", "unknown-node", renderUnknownChildren(node));
			}
		}
	};

	/** The content of an unknown node: blocks if it holds blocks, inline content if it holds text. */
	const renderUnknownChildren = (node: CmsNode): ReactNode => {
		const content = node.content ?? [];
		if (content.length === 0) return undefined;
		const inlineOnly = content.every((child) =>
			["text", "hardBreak", "footnoteReference", "image"].includes(child.type),
		);
		return inlineOnly ? renderInline(content) : renderBlocks(content);
	};

	// ---- footnotes ---------------------------------------------------------------------------------------------------------------

	const backReferences = (entry: Analysis["footnotes"][number]): ReactNode[] => {
		const out: ReactNode[] = [];
		entry.refIds.forEach((refId, index) => {
			const count = index + 1;
			if (out.length > 0) out.push(" ");
			out.push(
				createElement(
					"a",
					{
						key: refId,
						href: `#${refId}`,
						"data-footnote-backref": "",
						"aria-label": ctx.labels.footnoteBack.replace("{ref}", `${entry.index}${count > 1 ? `-${count}` : ""}`),
						className: "data-footnote-backref",
					},
					"↩",
					count > 1 ? createElement("sup", null, String(count)) : null,
				),
			);
		});
		return out;
	};

	const renderFootnotes = (): ReactNode => {
		if (analysis.footnotes.length === 0) return null;
		const items = analysis.footnotes.map((entry) => {
			const blocks = visibleBlocks(entry.definition.content);
			const last = blocks[blocks.length - 1];
			const refs = backReferences(entry);
			const children: ReactNode[] = blocks.slice(0, -1).map((block) => renderBlock(block, false));
			if (last?.type === "paragraph" && !isBlankParagraph(last)) {
				// The links back go at the end of the last paragraph.
				const inline = renderInline(last.content);
				children.push(
					createElement(components.paragraph, { ...common(last), children: [...inline, " ", ...refs] } as never),
				);
			} else {
				if (last) children.push(renderBlock(last, false));
				children.push(...refs);
			}
			return {
				id: entry.id,
				label: entry.label,
				index: entry.index,
				backRefIds: entry.refIds,
				children: keyed(children),
			};
		});
		return createElement(components.footnotes, { items, ctx });
	};

	const body = keyed(withoutTrailingBlank(visibleBlocks(nodes)).map((node) => renderBlock(node, false)));
	const footnotes = renderFootnotes();
	const content = footnotes ? [...body, createElement(Fragment, { key: "footnotes" }, footnotes)] : body;
	return { content: createElement(Fragment, null, ...content), unknown: report.nodes };
};

const CORE_MARKS = new Set([
	"bold",
	"italic",
	"strike",
	"underline",
	"superscript",
	"subscript",
	"code",
	"untranslated",
]);

/**
 * Whether the table's cells say which are headers. A table GFM can write (no merged cells, no widths, the first row the header) has a header
 * first row whatever its cells say; any other table is written as JSX and a cell is a header only when it says so.
 */
const needsHeaderFlags = (node: CmsNode): boolean =>
	tableHasMergedCells(node) || hasNonGfmHeaderLayout(node) || formatTableWidths(tableWidths(node)) !== "";
