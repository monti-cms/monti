import type { Block, CodeBlockSettings, Doc } from "@monti-cms/core";
import { languageName, lineStarts } from "@monti-cms/core/code";
import {
	CHECK_MARK_PATH,
	ChangeDot,
	CodeArea,
	CodeFrame,
	CodeGround,
	CodeNumber,
	CodeToken,
	CompareBlock,
	CompareText,
	CompareValues,
	Del,
	EditorBody,
	Inline,
	Ins,
	Text,
} from "@monti-cms/ui";
import { getSchema } from "@tiptap/core";
import type { DOMOutputSpec, Mark as MarkOf, Node as NodeOf, Schema } from "@tiptap/pm/model";
import { createElement, Fragment, type ReactNode, useEffect, useMemo, useState } from "react";
import { type AdminBlockDefinition, useAdmin } from "../operations/admin-context";
import { useRead } from "../operations/use-operation";
import { type CodeChange, type Part, type ReadMarks, valuesOf } from "../screens/entry/compare-entries";
import { useBlockNames } from "../screens/entry/use-block-names";
import type { Catalog, CatalogBlock } from "./catalog";
import { type CodeData, codeColours, dataOf, looksOf, type Piece } from "./code/code-state";
import { docToEditor } from "./convert";
import { footnoteNumbers } from "./footnotes";
import { MarkLooks } from "./mark-looks";
import { bodyExtensions, nodeName, UNKNOWN } from "./schema";

/**
 * How the words that differ are marked over a body: `changed` on the highlight (two versions of one entry, the same on both sides), `source` an
 * underline in the warning color (a translation's source, changed since it was translated; `was` the words it had before, faint and struck through),
 * `added` and `removed` in the blue pencil (what a proposal puts in and takes out).
 */
export type ReadMark = "changed" | "source" | "was" | "added" | "removed";

/** The cores' blocks: drawn by the editor's own elements, never by a site's drawing. */
const CORE_BLOCKS = new Set([
	"paragraph",
	"heading",
	"bulletList",
	"orderedList",
	"checklist",
	"listItem",
	"quote",
	"codeBlock",
	"divider",
	"footnote",
	"table",
	"image",
	"file",
]);

/** A word of changed text, in the way the screen marks changes. */
function Marked({ kind, children }: { kind: ReadMark; children: ReactNode }) {
	if (kind === "added") return <Ins>{children}</Ins>;
	if (kind === "removed") return <Del>{children}</Del>;
	return (
		<CompareText changed source={kind === "source" || kind === "was"} removed={kind === "was"}>
			{children}
		</CompareText>
	);
}

/** Parts as the ranges they cover in the text they were made from. */
type Range = { from: number; to: number; changed: boolean };
function rangesOf(parts: readonly Part[]): Range[] {
	let at = 0;
	return parts.map((part) => {
		const range = { from: at, to: at + part.text.length, changed: part.changed };
		at = range.to;
		return range;
	});
}

/** A run of text with its changed words marked: the words that differ in `parts`, whole as text where they do not. */
function Words({ parts, kind }: { parts: readonly Part[]; kind: ReadMark }) {
	return parts.map((part, index) =>
		part.changed ? (
			// biome-ignore lint/suspicious/noArrayIndexKey: the parts of one text, in order; they never move.
			<Marked key={index} kind={kind}>
				{part.text}
			</Marked>
		) : (
			// biome-ignore lint/suspicious/noArrayIndexKey: the parts of one text, in order; they never move.
			<span key={index}>{part.text}</span>
		),
	);
}

// --- Code ------------------------------------------------------------------------------------------------------------------------------------

/** A code's colours, as the editor's block gets them (`codeColours`): none until the highlighter answers, none for a language it does not know. */
function useColours(settings: CodeBlockSettings | undefined, language: string | undefined, code: string) {
	const [pieces, setPieces] = useState<Piece[]>([]);
	useEffect(() => {
		if (!settings || !language || !code) {
			setPieces([]);
			return;
		}
		let gone = false;
		void codeColours(settings, language, code).then((found) => {
			if (!gone) setPieces(found);
		});
		return () => {
			gone = true;
		};
	}, [settings, language, code]);
	return pieces;
}

/** One stretch of a code with what it is drawn with: its colour, and whether its words changed. */
type Stretch = { from: number; to: number; piece?: Piece; changed: boolean };

function stretches(code: string, pieces: readonly Piece[], ranges: readonly Range[]): Stretch[] {
	const edges = new Set<number>([0, code.length]);
	for (const piece of pieces) {
		edges.add(piece.from);
		edges.add(piece.to);
	}
	for (const range of ranges) {
		edges.add(range.from);
		edges.add(range.to);
	}
	const sorted = [...edges].filter((edge) => edge >= 0 && edge <= code.length).sort((a, b) => a - b);
	const out: Stretch[] = [];
	for (let at = 0; at < sorted.length - 1; at++) {
		const from = sorted[at] as number;
		const to = sorted[at + 1] as number;
		out.push({
			from,
			to,
			piece: pieces.find((piece) => piece.from <= from && to <= piece.to),
			changed: ranges.some((range) => range.changed && range.from <= from && to <= range.to),
		});
	}
	return out;
}

/**
 * A code block read: the editor's frame with its language and file name, its numbers, the lines' effects, the code in the site's colors, and its changed
 * words marked. A closed fold is not closed here: every line is shown.
 */
function ReadCode({
	code,
	data,
	inExplorer = false,
	settings,
	parts,
	change,
	kind,
}: {
	code: string;
	data: CodeData;
	inExplorer?: boolean;
	settings?: CodeBlockSettings;
	parts?: readonly Part[];
	change?: CodeChange;
	kind: ReadMark;
}) {
	const { t } = useAdmin();
	const language = data.language;
	const pieces = useColours(settings, language, code);
	const starts = lineStarts(code);
	const effects = data.lines ?? [];
	const changedLines = new Set(change?.lines ?? []);
	const all = stretches(code, pieces, parts ? rangesOf(parts) : []);
	const wavyOf = (line: number) => {
		for (const effect of effects) {
			if (effect.start > line || line >= effect.end) continue;
			const wavy = settings?.lineEffects.find((each) => each.name === effect.name)?.editor;
			if (wavy?.wavy) return wavy.tone === "danger" ? "error" : "warning";
		}
		return undefined;
	};
	const drawn = (stretch: Stretch, from: number, to: number, key: string) => {
		let node: ReactNode = code.slice(from, to);
		if (stretch.changed) node = <Marked kind={kind}>{node}</Marked>;
		if (stretch.piece) {
			const { fontWeight, fontStyle } = fontOf(stretch.piece.fontStyle);
			if (fontWeight) node = <b>{node}</b>;
			if (fontStyle) node = <i>{node}</i>;
			node = (
				<CodeToken light={stretch.piece.light} dark={stretch.piece.dark}>
					{node}
				</CodeToken>
			);
		}
		return <span key={key}>{node}</span>;
	};
	const lines = starts.map((start, line) => {
		const end = line + 1 < starts.length ? (starts[line + 1] as number) - 1 : code.length;
		const inLine = all.flatMap((stretch) =>
			stretch.to > start && stretch.from < end
				? [{ stretch, from: Math.max(stretch.from, start), to: Math.min(stretch.to, end) }]
				: [],
		);
		return { start, end, inLine, wavy: wavyOf(line) };
	});
	return (
		<CodeFrame
			head={
				<Inline gap={8} minWidth={0}>
					<Text variant="caption" tone="muted">
						{language ? languageName(language) : t("editor.code.plain")}
					</Text>
					{data.title && !inExplorer ? (
						<Text variant="caption" mono truncate>
							{data.title}
						</Text>
					) : null}
					{change?.language || change?.title ? <ChangeDot label={t("compare.codeHead")} /> : null}
				</Inline>
			}
		>
			<CodeArea
				gutter={lines.map((_, line) => {
					const look = settings ? looksOf(settings, effects, line) : { tone: undefined, mark: undefined };
					return (
						<CodeNumber
							// biome-ignore lint/suspicious/noArrayIndexKey: the lines of one code, in order
							key={line}
							data-line={line}
							number={line + 1}
							tone={look.tone}
							mark={look.mark}
							numbersOff={!data.lineNumbers}
							readOnly
							changed={changedLines.size ? (changedLines.has(line) ? t("compare.codeEffects") : "") : undefined}
						/>
					);
				})}
				grounds={lines.map((_, line) => (
					// biome-ignore lint/suspicious/noArrayIndexKey: the lines of one code, in order
					<CodeGround key={line} tone={settings ? looksOf(settings, effects, line).tone : undefined} />
				))}
			>
				{lines.map((line, at) => (
					// biome-ignore lint/suspicious/noArrayIndexKey: the lines of one code, in order
					<span key={at}>
						<span data-wavy={line.wavy}>
							{line.inLine.map(({ stretch, from, to }) => drawn(stretch, from, to, `${from}:${to}`))}
						</span>
						{at < lines.length - 1 ? "\n" : null}
					</span>
				))}
			</CodeArea>
		</CodeFrame>
	);
}

const fontOf = (fontStyle: number | undefined) => ({
	// The highlighter's bit flags: italic 1, bold 2.
	fontStyle: ((fontStyle ?? 0) & 1) !== 0,
	fontWeight: ((fontStyle ?? 0) & 2) !== 0,
});

// --- Elements --------------------------------------------------------------------------------------------------------------------------------

/** A style the editor's elements give: a table's column has its width in percent, nothing else is styled inline. */
function styleOf(text: string) {
	const width = /^\s*width:\s*([\d.]+%)\s*;?\s*$/.exec(text)?.[1];
	return width ? { width } : undefined;
}

const PROPS: Record<string, string> = {
	class: "className",
	colspan: "colSpan",
	rowspan: "rowSpan",
	tabindex: "tabIndex",
};

/** What the page does with an address: its own places open in the admin, a site's address in a tab of its own, the rest stays words. */
function addressProps(href: unknown, onOpen: ((address: string) => void) | undefined): Record<string, unknown> {
	if (typeof href !== "string") return {};
	if (href.startsWith("#/") && onOpen)
		return {
			href,
			onClick: (event: { preventDefault: () => void }) => {
				event.preventDefault();
				onOpen(href);
			},
		};
	// `noreferrer`: the page it opens is not told where the person came from.
	if (/^https?:\/\//i.test(href)) return { href, target: "_blank", rel: "noopener noreferrer" };
	return {};
}

type Context = {
	schema: Schema;
	byType: Map<string, CatalogBlock>;
	definitions: ReadonlyMap<string, AdminBlockDefinition>;
	settings: CodeBlockSettings | undefined;
	blocks: Map<string, Block>;
	names: ReturnType<typeof useBlockNames>;
	marks: ReadMarks | undefined;
	kind: ReadMark;
	numbers: Map<string, number>;
	onOpen: ((address: string) => void) | undefined;
	t: ReturnType<typeof useAdmin>["t"];
	/** The block whose own words are being drawn, and how far into them the drawing is. */
	cursor: { at: number; ranges: Range[] } | null;
	current: string | null | undefined;
	footnotes: number;
};

/** What an element says, with `content` where its hole is. The one place a block's element is made: the editor's own `renderHTML`. */
function elementOf(spec: DOMOutputSpec, content: ReactNode, context: Context, key?: string | number): ReactNode {
	if (typeof spec === "string") return spec;
	if (!Array.isArray(spec)) return null;
	const [tag, ...rest] = spec as [string, ...unknown[]];
	const given = rest[0];
	const own =
		given !== null && typeof given === "object" && !Array.isArray(given)
			? (rest.shift() as Record<string, unknown>)
			: {};
	const props: Record<string, unknown> = { key };
	for (const [name, value] of Object.entries(own)) {
		if (value === null || value === undefined || value === false) continue;
		if (name === "style" && typeof value === "string") props.style = styleOf(value);
		else if (name === "contenteditable") continue;
		else props[PROPS[name] ?? name] = value;
	}
	if (tag === "a") {
		delete props.href;
		delete props.target;
		delete props.rel;
		Object.assign(props, addressProps(own.href, context.onOpen));
	}
	const children = (rest as unknown[]).map((child, at) =>
		child === 0 ? content : elementOf(child as DOMOutputSpec, content, context, at),
	);
	return createElement(tag, props, ...children);
}

const drawMarks = (node: NodeOf, inner: ReactNode, context: Context) =>
	[...node.marks].reverse().reduce<ReactNode>((drawn, mark: MarkOf) => {
		const spec = mark.type.spec.toDOM?.(mark, true);
		return spec ? elementOf(spec, drawn, context) : drawn;
	}, inner);

function drawText(node: NodeOf, context: Context, key: number) {
	const text = node.text ?? "";
	const cursor = context.cursor;
	let inner: ReactNode = text;
	if (cursor) {
		const from = cursor.at;
		const to = from + text.length;
		const cut = cursor.ranges.filter((range) => range.to > from && range.from < to);
		if (cut.some((range) => range.changed))
			inner = cut.map((range) => {
				const piece = text.slice(Math.max(range.from, from) - from, Math.min(range.to, to) - from);
				return range.changed ? (
					<Marked key={`${range.from}:${range.to}`} kind={context.kind}>
						{piece}
					</Marked>
				) : (
					<span key={`${range.from}:${range.to}`}>{piece}</span>
				);
			});
		cursor.at = to;
	}
	return <span key={key}>{drawMarks(node, inner, context)}</span>;
}

/** The box at a checklist item's start, a mark only (the body is read). */
const checkOf = (checked: boolean, label: string) =>
	createElement(
		"span",
		{ key: "check", "data-check": "", role: "checkbox", "aria-checked": checked, "aria-label": label },
		createElement(
			"span",
			{ "data-check-box": "" },
			createElement(
				"svg",
				{ viewBox: "0 0 14 14", fill: "none", stroke: "currentColor", strokeWidth: 1.5, "aria-hidden": true },
				createElement("path", { d: CHECK_MARK_PATH }),
			),
		),
	);

/** The words of a box block, and its name line's marks when the body is read against another. */
function Box({ type, id, label, context }: { type: string; id: string; label: string; context: Context }) {
	const block = context.blocks.get(id);
	const parts = context.marks?.values.get(id);
	const said = block ? valuesOf(block, context.names) : undefined;
	return (
		<div data-whole="" data-box="" data-block={type}>
			{parts ? <Words parts={parts} kind={context.kind} /> : (said ?? label)}
		</div>
	);
}

function drawChildren(node: NodeOf, context: Context): ReactNode[] {
	const out: ReactNode[] = [];
	node.forEach((child, _, index) => {
		const cursor = context.cursor;
		// A table's words are its cells in order: " | " between the cells of a row, a line between its rows (`ownText`).
		if (cursor && index > 0) {
			if (node.type.name === "tableRow") cursor.at += 3;
			if (node.type.name === "table") cursor.at += 1;
		}
		out.push(child.isText ? drawText(child, context, index) : drawNode(child, context, index, node));
	});
	return out;
}

/** The marks over a block's own words, read from the marks the screen gave. */
function drawNode(node: NodeOf, context: Context, key: number, parent: NodeOf): ReactNode {
	const name = node.type.name;
	const id = String(node.attrs.blockId ?? "");
	const outer = context.cursor;
	if (id) {
		const parts = context.marks?.words.get(id);
		context.cursor = parts ? { at: 0, ranges: rangesOf(parts) } : null;
	}
	try {
		if (name === UNKNOWN) {
			const label = context.t("editor.unknownBlock", { type: String(node.attrs.block?.type ?? "") });
			return <Box key={key} type={String(node.attrs.block?.type ?? "")} id={id} label={label} context={context} />;
		}
		if (name === "hardBreak" && context.cursor) context.cursor.at += 1;
		const block = context.byType.get(name);
		const spec = node.type.spec.toDOM?.(node);
		if (name === "footnoteRef") {
			const n = context.numbers.get(String(node.attrs.id)) ?? "";
			return elementOf(
				["sup", { "data-footnote-ref": String(node.attrs.id ?? ""), "data-n": String(n) }],
				null,
				context,
				key,
			);
		}
		if (!block || !spec) return elementOf(spec ?? ["span", 0], drawChildren(node, context), context, key);
		const values = id ? context.marks?.values.get(id) : undefined;
		const line = values?.some((part) => part.changed) ? (
			<CompareValues key={`${key}:values`}>
				<Words parts={values} kind={context.kind} />
			</CompareValues>
		) : null;
		const drawn = drawBlock(node, block, spec, context, key, parent);
		return line ? (
			<Fragment key={key}>
				{line}
				{drawn}
			</Fragment>
		) : (
			drawn
		);
	} finally {
		context.cursor = outer;
	}
}

/** One block of the catalog as an element: the core's by the editor's own `renderHTML`, a site's block by its drawing, or a box with its name. */
function drawBlock(
	node: NodeOf,
	block: CatalogBlock,
	spec: DOMOutputSpec,
	context: Context,
	key: number,
	parent: NodeOf,
) {
	const id = String(node.attrs.blockId ?? "");
	const data = (node.attrs.data ?? {}) as Record<string, unknown>;
	if (block.type === "codeBlock") {
		const inExplorer = parent.type.name === nodeName("codeExplorer");
		return (
			<ReadCode
				key={key}
				code={node.textContent}
				data={dataOf(node)}
				inExplorer={inExplorer}
				settings={context.settings}
				parts={context.marks?.words.get(id)}
				change={context.marks?.code.get(id)}
				kind={context.kind}
			/>
		);
	}
	const Site = CORE_BLOCKS.has(block.type) ? undefined : context.definitions.get(block.type)?.Site;
	if (
		!Site &&
		(block.type === "image" || block.type === "file" || (block.holds === "nothing" && !CORE_BLOCKS.has(block.type)))
	) {
		return <Box key={key} type={block.type} id={id} label={context.t(block.label)} context={context} />;
	}
	if (block.type === "divider" || block.type === "table")
		return elementOf(spec, drawChildren(node, context), context, key);
	if (block.type === "footnote") {
		const n = context.numbers.get(String(data.id ?? ""));
		const first = context.footnotes++ === 0;
		const props = {
			"data-footnote": String(data.id ?? ""),
			"data-n": String(n ?? ""),
			...(first ? { "data-footnotes-start": "" } : {}),
		};
		return elementOf(["div", props, 0], drawChildren(node, context), context, key);
	}
	if (Site) {
		const source = block.fence ? String(data[block.fence.attr] ?? "") : "";
		const words = context.marks?.words.get(id);
		const attrs = context.blocks.get(id)?.attrs ?? data;
		const children = block.holds === "nothing" ? undefined : drawChildren(node, context);
		const drawn = createElement(Site, { block: { id, type: block.type, attrs }, attrs }, children);
		return (
			<div key={key} data-block={block.type}>
				{drawn}
				{block.fence && words?.some((part) => part.changed) ? (
					<ReadCode
						code={source}
						data={{ language: block.fence.language }}
						settings={context.settings}
						parts={words}
						kind={context.kind}
					/>
				) : null}
			</div>
		);
	}
	const children = drawChildren(node, context);
	// A list item of a checklist has its box before its words.
	if (block.type === "listItem" && parent.type.name === nodeName("checklist"))
		return elementOf(
			spec,
			[checkOf(Boolean(data.checked), context.t("editor.checklist.done")), ...children],
			context,
			key,
		);
	return elementOf(spec, children, context, key);
}

// --- The body --------------------------------------------------------------------------------------------------------------------------------

/** One schema for the site's blocks, shared by every body read: made once per catalog. */
const schemas = new WeakMap<Catalog, WeakMap<ReadonlyMap<string, AdminBlockDefinition>, Schema>>();
function schemaOf(kit: Catalog, definitions: ReadonlyMap<string, AdminBlockDefinition>) {
	const byDefinitions = schemas.get(kit) ?? new WeakMap<ReadonlyMap<string, AdminBlockDefinition>, Schema>();
	schemas.set(kit, byDefinitions);
	let schema = byDefinitions.get(definitions);
	if (!schema) {
		schema = getSchema(bodyExtensions(kit, (block) => block.type, definitions));
		byDefinitions.set(definitions, schema);
	}
	return schema;
}

const byIdOf = (doc: Doc) => {
	const found = new Map<string, Block>();
	const walk = (blocks: Block[]) => {
		for (const block of blocks) {
			found.set(block.id, block);
			if (block.children) walk(block.children);
		}
	};
	walk(doc.blocks);
	return found;
};

/**
 * A body that is only read: the comparison of two copies, a change a proposal makes, the source beside a translation, an answer of the assistant. It
 * is drawn as the editor draws the body: the editor's own schema makes each block's element (`renderHTML`), under the editor's body classes
 * (`EditorBody`); a code block is the editor's frame and the site's colors; a site's block is its own drawing, and a block the admin has no drawing
 * for is the box with its name. Nothing in it is written or picked. `marks` paint over it where it differs from another body, in the way `mark` says;
 * `current` (the id of a top-level block, or `null`) sets each top-level block in a `CompareBlock` and puts that one on the block ground.
 */
export function ReadBody({
	doc,
	marks,
	mark = "changed",
	size = "reading",
	muted = false,
	current,
	files,
	onOpen,
}: {
	doc: Doc;
	marks?: ReadMarks;
	mark?: ReadMark;
	size?: "reading" | "chat";
	/** In the quieter ink: a source read beside its translation. */
	muted?: boolean;
	current?: string | null;
	/** The library's files the body shows, to name a picture or a file by its name. */
	files?: readonly { id: string; name: string }[];
	/** Opens a place of the admin an address in the text names (`#/…`); without it such an address is words. */
	onOpen?: (address: string) => void;
}) {
	const { t, blocks: definitions } = useAdmin();
	const kit = useRead<Catalog>("blocks.catalog", {}).data;
	const names = useBlockNames(files);
	const drawn = useMemo(() => {
		if (!kit || doc.blocks.length === 0) return null;
		const schema = schemaOf(kit, definitions);
		let body: NodeOf;
		try {
			body = schema.nodeFromJSON(docToEditor(doc, kit));
		} catch {
			return null;
		}
		const context: Context = {
			schema,
			byType: new Map(kit.blocks.map((block) => [nodeName(block.type), block])),
			definitions,
			settings: kit.code,
			blocks: byIdOf(doc),
			names,
			marks,
			kind: mark,
			numbers: footnoteNumbers(body),
			onOpen,
			t,
			cursor: null,
			current,
			footnotes: 0,
		};
		const top: ReactNode[] = [];
		body.forEach((node, _, index) => {
			const id = String(node.attrs.blockId ?? "");
			const block = drawNode(node, context, index, body);
			top.push(
				current === undefined ? (
					block
				) : (
					<CompareBlock key={id || index} data-block={id} current={id === current}>
						{block}
					</CompareBlock>
				),
			);
		});
		return top;
	}, [kit, doc, definitions, names, marks, mark, onOpen, t, current]);
	if (!drawn) return null;
	return (
		<EditorBody readOnly muted={muted} size={size}>
			{drawn}
			<MarkLooks />
		</EditorBody>
	);
}
