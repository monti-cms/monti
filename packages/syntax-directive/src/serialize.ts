import {
	type BlockDefinition,
	type CmsMark,
	type CmsNode,
	formatTableWidths,
	hasBalancedLabelBrackets,
	hasNonGfmHeaderLayout,
	type SerializeContext,
	type SyntaxMarkWriter,
	type SyntaxNodeWriter,
	tableHasMergedCells,
	tableWidths,
} from "@monti-cms/core/syntax";

/**
 * Writes the directive spelling (`:::name`, `::name`, `:name[label]{attrs}`). Each writer returns `undefined` when the node is not something
 * the directive syntax expresses, so the standard serializer (JSX) takes over.
 */

type DirectiveKind = "container" | "leaf" | "text";

/** A block written as a directive, or `undefined`. A JSX spread attribute and the line break (always `<br />`) stay JSX. */
const directiveBlock = (node: CmsNode, context: SerializeContext): BlockDefinition | undefined => {
	if (context.hasSpread(node)) return undefined;
	const block = context.blocks.byComponent(context.componentName(node));
	if (!block || block.component === "br") return undefined;
	const kind = block.syntax.kind;
	return kind === "container" || kind === "leaf" || kind === "text" ? block : undefined;
};

const directiveName = (block: BlockDefinition): string => (block.syntax as { directive: string }).directive;
const kindOf = (block: BlockDefinition): DirectiveKind => block.syntax.kind as DirectiveKind;

const usesDirectiveTable = (node: CmsNode) =>
	tableHasMergedCells(node) || hasNonGfmHeaderLayout(node) || formatTableWidths(tableWidths(node)) !== "";

const braces = (parts: string[]) => (parts.length > 0 ? `{${parts.join(" ")}}` : "");

/** Number of container levels wrapped. The colon count is `3 + levels` — the same formula as the converter. */
const containerDepth = (node: CmsNode, context: SerializeContext): number => {
	let max = 0;
	for (const child of node.content ?? []) {
		// A merged table uses 3 colons (row) inside 4 colons (table). The outer container needs at least 5 colons.
		if (child.type === "table" && usesDirectiveTable(child)) max = Math.max(max, 2);
		const block = directiveBlock(child, context);
		if (block && kindOf(block) === "container") max = Math.max(max, 1 + containerDepth(child, context));
		max = Math.max(max, containerDepth(child, context));
	}
	return max;
};

/** Any node of a block that has a directive spelling. */
const blockWriter: SyntaxNodeWriter = (node, context) => {
	const block = directiveBlock(node, context);
	if (!block) return undefined;
	const { indent } = context;
	const name = directiveName(block);
	const attrs = braces(context.nodeAttributes(node, block));

	if (kindOf(block) === "leaf") return `${indent}::${name}${attrs}`;
	if (kindOf(block) === "text") {
		return `${indent}:${name}[${context.serializeInlines(node.content ?? [], { label: true })}]${attrs}`;
	}

	const inner = context.serializeBlocks(node.content ?? [], "");
	const fence = ":".repeat(3 + containerDepth(node, context));
	if (inner.length === 0) return `${indent}${fence}${name}${attrs}\n${indent}${fence}`;
	return `${indent}${fence}${name}${attrs}\n${inner}\n${indent}${fence}`;
};

/** A media image with a reference, size, alignment, caption or similar is a `::image` leaf (core offers only those). */
const imageWriter: SyntaxNodeWriter = (node, context) => {
	const block = context.blocks.byComponent("Image");
	if (!block || kindOf(block) !== "leaf") return undefined;
	return `${context.indent}::${directiveName(block)}${braces(context.nodeAttributes(node, block))}`;
};

const tableAttributes = (node: CmsNode): string[] => {
	const attrs: string[] = [];
	const align = Array.isArray(node.attrs?.align) ? (node.attrs.align as Array<string | null>) : [];
	const alignValue = align.map((value) => value ?? "").join(",");
	if (alignValue.replace(/,/g, "").length > 0) attrs.push(`align="${alignValue}"`);
	const widths = formatTableWidths(tableWidths(node));
	if (widths) attrs.push(`widths="${widths}"`);
	return attrs;
};

const cellAttributes = (cell: CmsNode): string[] => {
	const attrs: string[] = [];
	if (cell.attrs?.header === true || cell.attrs?.header === "true") attrs.push("header");
	const colspan = Number(cell.attrs?.colspan ?? 1);
	if (colspan > 1) attrs.push(`colspan=${colspan}`);
	const rowspan = Number(cell.attrs?.rowspan ?? 1);
	if (rowspan > 1) attrs.push(`rowspan=${rowspan}`);
	return attrs;
};

/** A table GFM cannot express (merges, widths, non-GFM headers). Returns `undefined` for the rest and when a label cannot hold its brackets. */
const tableWriter: SyntaxNodeWriter = (node, context) => {
	if (!usesDirectiveTable(node)) return undefined;
	const rows = node.content ?? [];
	const labels = rows.map((row) =>
		(row.content ?? []).map((cell) => context.serializeInlines(cell.content ?? [], { label: true })),
	);
	// If label brackets are unbalanced, the parser loses cells, so the standard serializer stores a JSX table with the same meaning.
	if (labels.some((row) => row.some((label) => !hasBalancedLabelBrackets(label)))) return undefined;

	const attrs = tableAttributes(node);
	const lines: string[] = [`::::table${attrs.length ? `{${attrs.join(" ")}}` : ""}`];
	rows.forEach((row, rowIndex) => {
		lines.push(":::row");
		(row.content ?? []).forEach((cell, cellIndex) => {
			lines.push(`::cell[${labels[rowIndex]?.[cellIndex] ?? ""}]${braces(cellAttributes(cell))}`);
		});
		lines.push(":::");
	});
	lines.push("::::");
	return lines.map((line) => context.indent + line).join("\n");
};

export const directiveNodeWriters: Readonly<Record<string, SyntaxNodeWriter>> = {
	table: tableWriter,
	image: imageWriter,
	"*": blockWriter,
};

const textMark =
	(name: string): SyntaxMarkWriter =>
	(_mark, inner) =>
		`:${name}[${inner}]`;

/** Text marks added by the site (tooltip, color, …): `:name[inner]{attrs}`. The mark type is the block name. */
const addedMarkWriter: SyntaxMarkWriter = (mark: CmsMark, inner, context) => {
	const block = context.blocks.byName(mark.type);
	if (!block || block.syntax.kind !== "text") return undefined;
	return `:${directiveName(block)}[${inner}]${braces(context.markAttributes(mark, block))}`;
};

export const directiveMarkWriters: Readonly<Record<string, SyntaxMarkWriter>> = {
	underline: textMark("u"),
	superscript: textMark("sup"),
	subscript: textMark("sub"),
	untranslated: textMark("untranslated"),
	"*": addedMarkWriter,
};

const LABEL_MARK_TYPES = new Set(Object.keys(directiveMarkWriters));

/** Whether the mark is written as a directive label (`:name[…]`), where a `]` would close the label. */
const isLabelMark = (mark: CmsMark, context: SerializeContext): boolean =>
	LABEL_MARK_TYPES.has(mark.type) || context.blocks.byName(mark.type)?.syntax.kind === "text";

const DIRECTIVE_COLON = /(?<!\\):(?=[A-Za-z0-9_\-가-힣:])/g; // cms-allow-korean: Hangul in a name pattern, not UI text
const DIRECTIVE_RUN = /^[A-Za-z0-9_\-가-힣:]+/; // cms-allow-korean: Hangul in a name pattern, not UI text

const namesOf = new WeakMap<object, ReadonlySet<string>>();
const directiveNames = (context: SerializeContext): ReadonlySet<string> => {
	let names = namesOf.get(context.blocks);
	if (!names) {
		names = new Set(
			context.blocks.list.flatMap((block) => ("directive" in block.syntax ? [block.syntax.directive] : [])),
		);
		namesOf.set(context.blocks, names);
	}
	return names;
};

/**
 * Escapes a `:` followed by a registered directive name as `\:`. This protects text for as long as directives are **read**.
 * Left as is, it would be read as a directive on re-parse (`:u[`, `::image` etc.). Unregistered names (`:free를`) and
 * colons in times and URLs (`12:30`, `https://`) are left alone. An already escaped `\:` is kept.
 */
export const escapeDirectiveColon = (text: string, context: SerializeContext): string => {
	const names = directiveNames(context);
	return text.replace(DIRECTIVE_COLON, (_match: string, offset: number, whole: string) => {
		const run = DIRECTIVE_RUN.exec(whole.slice(offset + 1))?.[0] ?? "";
		return names.has(run) ? "\\:" : ":";
	});
};

/**
 * Text written by the directive writers: the colon escape, and inside a label made by a text directive `]` closes the label, so it is escaped too
 * (core handles it when the label is explicit).
 */
export const escapeDirectiveText = (text: string, context: SerializeContext): string => {
	const colons = escapeDirectiveColon(text, context);
	const inLabel = !context.label && context.marks.some((mark) => isLabelMark(mark, context));
	return inLabel ? colons.replace(/\]/g, "\\]") : colons;
};
