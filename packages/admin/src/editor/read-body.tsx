import type { Block, CodeBlockSettings, Doc, MediaQueryResult } from "@monti-cms/core";
import { languageName, lineStarts } from "@monti-cms/core/code";
import {
	CHECK_MARK_PATH,
	ChangeDot,
	CodeArea,
	CodeAside,
	CodeFrame,
	CodeGround,
	CodeNumber,
	CompareBlock,
	CompareText,
	CompareValues,
	Del,
	EditorBody,
	IconButton,
	Inline,
	Ins,
	StreamCaret,
	Text,
	TextButton,
} from "@monti-cms/ui";
import { ChevronDown, ChevronRight } from "@monti-cms/ui/icons";
import { getSchema } from "@tiptap/core";
import type { DOMOutputSpec, Mark as MarkOf, Node as NodeOf, Schema } from "@tiptap/pm/model";
import {
	Component,
	createElement,
	Fragment,
	type ReactNode,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import { type AdminBlockDefinition, useAdmin } from "../operations/admin-context";
import { useOperation, useRead } from "../operations/use-operation";
import {
	type BlockNames,
	blockWords,
	type CodeChange,
	type Part,
	type ReadMarks,
	valuesOf,
} from "../screens/entry/compare-entries";
import { blockNamesOf } from "../screens/entry/use-block-names";
import type { Catalog, CatalogBlock } from "./catalog";
import {
	type CodeData,
	type CodeRange,
	codeColours,
	codeRanges,
	dataOf,
	foldKey,
	foldsOf,
	hiddenLines,
	looksOf,
	type Piece,
	readColoured,
} from "./code/code-state";
import { docToEditor } from "./convert";
import { footnoteNumbers } from "./footnotes";
import { MarkLooks } from "./mark-looks";
import { ReadCatalog } from "./read-catalog";
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
function useColours(
	settings: CodeBlockSettings | undefined,
	language: string | undefined,
	code: string,
	streaming: boolean,
) {
	const [pieces, setPieces] = useState<Piece[]>([]);
	useEffect(() => {
		// Code still arriving is not coloured, and none of it is remembered: the colours come once the answer is whole.
		if (!settings || !language || !code || streaming) {
			setPieces([]);
			return;
		}
		let gone = false;
		void codeColours(settings, language, code, readColoured).then((found) => {
			if (!gone) setPieces(found);
		});
		return () => {
			gone = true;
		};
	}, [settings, language, code, streaming]);
	return pieces;
}

/** A stretch of a code's text and what is drawn on it: the attributes of the ranges over it (`codeRanges`), its marks, whether its words changed. */
type Stretch = {
	from: number;
	to: number;
	attrs: Record<string, string>;
	wrap?: (inner: ReactNode) => ReactNode;
	changed: boolean;
};

/** What the code's marks draw on a stretch of its text (a tooltip, a fold of words): the same elements the editor draws, from the text node's marks. */
type Wrap = { from: number; to: number; wrap: (inner: ReactNode) => ReactNode };

/** A style as the editor's decorations write it (`--shiki-light:…;font-style:italic`) as the object React takes. */
function colourStyle(text: string) {
	const style: Record<string, string> = {};
	for (const rule of text.split(";")) {
		const at = rule.indexOf(":");
		if (at < 0) continue;
		const name = rule.slice(0, at).trim();
		const value = rule.slice(at + 1).trim();
		if (name.startsWith("--")) style[name] = value;
		else if (name === "font-style") style.fontStyle = value;
		else if (name === "font-weight") style.fontWeight = value;
	}
	return style;
}

function stretches(
	code: string,
	ranges: readonly CodeRange[],
	parts: readonly Range[],
	wraps: readonly Wrap[],
): Stretch[] {
	const edges = new Set<number>([0, code.length]);
	for (const each of [...ranges, ...parts, ...wraps]) {
		edges.add(each.from);
		edges.add(each.to);
	}
	const sorted = [...edges].filter((edge) => edge >= 0 && edge <= code.length).sort((a, b) => a - b);
	const out: Stretch[] = [];
	for (let at = 0; at < sorted.length - 1; at++) {
		const from = sorted[at] as number;
		const to = sorted[at + 1] as number;
		const attrs: Record<string, string> = {};
		for (const range of ranges) if (range.from <= from && to <= range.to) Object.assign(attrs, range.attrs);
		out.push({
			from,
			to,
			attrs,
			wrap: wraps.find((each) => each.from <= from && to <= each.to)?.wrap,
			changed: parts.some((range) => range.changed && range.from <= from && to <= range.to),
		});
	}
	return out;
}

/**
 * A code block read: the editor's frame with its language and file name, its numbers, the lines' effects, the code in the site's colors, and its changed
 * words marked. The text is drawn by the editor's own ranges (`codeRanges`: colors, a rule's styles, a wavy line) and marks (a tooltip, folded words). A
 * closed fold is closed, with the editor's controls to open it: reading includes unfolding.
 */
function ReadCode({
	code,
	data,
	node,
	wraps = [],
	inExplorer = false,
	settings,
	parts,
	change,
	kind,
	streaming = false,
	chat = false,
	caret = false,
}: {
	code: string;
	data: CodeData;
	/** The editor's node of the block, which has the folds; a source read as code has none. */
	node?: NodeOf;
	wraps?: readonly Wrap[];
	inExplorer?: boolean;
	settings?: CodeBlockSettings;
	parts?: readonly Part[];
	change?: CodeChange;
	kind: ReadMark;
	streaming?: boolean;
	/** In an answer: words wrap, at most half the window high, with no numbers, effects or folds (the answer's code is its words). */
	chat?: boolean;
	/** The caret of an answer still arriving, after the code's last character. */
	caret?: boolean;
}) {
	const { t } = useAdmin();
	const [folds, setFolds] = useState<ReadonlyMap<string, boolean>>(new Map());
	const language = data.language;
	const pieces = useColours(settings, language, code, streaming);
	const starts = lineStarts(code);
	const effects = data.lines ?? [];
	const changedLines = new Set(change?.lines ?? []);
	const blockId = String(node?.attrs.blockId ?? "");
	const blockFolds = node && !chat ? foldsOf(node, folds) : [];
	const hidden = node && !chat ? hiddenLines(node, folds) : new Set<number>();
	const rows = starts.map((_, line) => line).filter((line) => !hidden.has(line));
	const toggle = (start: number, open: boolean) => setFolds((was) => new Map(was).set(foldKey(blockId, start), open));
	const ranges: CodeRange[] = [
		...(settings ? codeRanges(code, data, settings, pieces) : []),
		// A closed fold's lines are hidden, as the editor hides them; the offsets of `foldsOf` stand one after the block's start.
		...blockFolds
			.filter((fold) => !fold.shown)
			.map((fold) => ({ from: fold.from - 1, to: fold.to - 1, attrs: { "data-code-hidden": "" } })),
	];
	const all = stretches(code, ranges, parts ? rangesOf(parts) : [], wraps);
	const edgeOf = (line: number) => {
		const around = blockFolds.find(({ effect, shown }) => shown && effect.start <= line && line < effect.end);
		if (!around) return undefined;
		const { effect } = around;
		return line === effect.start ? "start" : line === effect.end - 1 ? "end" : "middle";
	};
	return (
		<div data-block="codeBlock">
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
					compact
					wrap={chat}
					scroll={chat ? "half" : undefined}
					aside={blockFolds
						// A closed fold inside another closed fold has its first line hidden too: only the outer one says what it hides.
						.filter(({ shown, effect }) => !shown && rows.includes(effect.start))
						.map(({ effect }) => (
							<CodeAside key={effect.start} row={rows.indexOf(effect.start)} compact>
								<TextButton size="caption" onClick={() => toggle(effect.start, true)}>
									{t("editor.code.folded", { n: effect.end - effect.start - 1 })}
								</TextButton>
							</CodeAside>
						))}
					gutter={
						chat
							? null
							: rows.map((line) => {
									const look = settings ? looksOf(settings, effects, line) : { tone: undefined, mark: undefined };
									const fold = blockFolds.find(({ effect }) => effect.start === line);
									return (
										<CodeNumber
											compact
											key={line}
											data-line={line}
											number={line + 1}
											tone={look.tone}
											mark={look.mark}
											numbersOff={!data.lineNumbers}
											readOnly
											folds={blockFolds.length > 0}
											edge={edgeOf(line)}
											changed={changedLines.size ? (changedLines.has(line) ? t("compare.codeEffects") : "") : undefined}
											fold={
												fold ? (
													<IconButton
														size="xs"
														label={t(fold.open ? "editor.code.foldFrom" : "editor.code.unfoldFrom", { n: line + 1 })}
														aria-expanded={fold.open}
														onClick={() => toggle(line, !fold.open)}
													>
														{fold.open ? <ChevronDown aria-hidden /> : <ChevronRight aria-hidden />}
													</IconButton>
												) : undefined
											}
										/>
									);
								})
					}
					grounds={
						chat
							? null
							: rows.map((line) => (
									<CodeGround compact key={line} tone={settings ? looksOf(settings, effects, line).tone : undefined} />
								))
					}
				>
					{all.map((stretch) => {
						const text: ReactNode = code.slice(stretch.from, stretch.to);
						const marked = stretch.changed ? <Marked kind={kind}>{text}</Marked> : text;
						const { style, ...attrs } = stretch.attrs;
						return createElement(
							"span",
							{ key: `${stretch.from}:${stretch.to}`, ...attrs, ...(style ? { style: colourStyle(style) } : {}) },
							stretch.wrap ? stretch.wrap(marked) : marked,
						);
					})}
					{caret ? <StreamCaret /> : null}
				</CodeArea>
			</CodeFrame>
		</div>
	);
}

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
			// Only a plain press opens the place here; a press with Cmd, Ctrl, Shift or Alt (a new tab, a new window) is the browser's, as a middle press is.
			onClick: (event: {
				button: number;
				metaKey: boolean;
				ctrlKey: boolean;
				shiftKey: boolean;
				altKey: boolean;
				preventDefault: () => void;
			}) => {
				if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
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
	names: BlockNames | undefined;
	marks: ReadMarks | undefined;
	kind: ReadMark;
	numbers: Map<string, number>;
	onOpen: ((address: string) => void) | undefined;
	t: ReturnType<typeof useAdmin>["t"];
	/** The block whose own words are being drawn, and how far into them the drawing is. */
	cursor: { at: number; ranges: Range[] } | null;
	current: string | null | undefined;
	footnotes: number;
	streaming: boolean;
	chat: boolean;
	/** The last words of the body, where an answer still arriving has its caret. */
	caretAt: NodeOf | null;
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
	return (
		<span key={key}>
			{drawMarks(node, inner, context)}
			{context.caretAt === node ? <StreamCaret /> : null}
		</span>
	);
}

/** The box at a checklist item's start, a mark only (the body is read). */
const checkOf = (checked: boolean, label: string) =>
	createElement(
		"span",
		{
			key: "check",
			"data-check": "",
			role: "checkbox",
			"aria-checked": checked,
			"aria-readonly": true,
			"aria-label": label,
		},
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

/** What a block the admin does not know says: its type after "Unknown block", or only that when it has none. */
const unknownLabel = (t: Context["t"], type: string) =>
	type ? t("editor.unknownBlock", { type }) : t("editor.unknownBlock.bare");

/** A block that cannot be drawn (its drawing threw) is its box, and the rest of the body stands. */
class Guard extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
	state = { failed: false };
	static getDerivedStateFromError() {
		return { failed: true };
	}
	render() {
		return this.state.failed ? this.props.fallback : this.props.children;
	}
}

/** Whether a block is drawn as a box with its name and values (no drawing of the admin's own for it): then its name line is in the box. */
function isBox(block: CatalogBlock, context: Context) {
	const Site = CORE_BLOCKS.has(block.type) ? undefined : context.definitions.get(block.type)?.Site;
	return (
		!Site &&
		(block.type === "image" || block.type === "file" || (block.holds === "nothing" && !CORE_BLOCKS.has(block.type)))
	);
}

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
			const label = unknownLabel(context.t, String(node.attrs.block?.type ?? ""));
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
		const line =
			!isBox(block, context) && values?.some((part) => part.changed) ? (
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
/** The marks of a code's text (a tooltip, folded words), each over the stretch of the code it is on, drawn as the editor draws them. */
function markWraps(node: NodeOf, context: Context): Wrap[] {
	const wraps: Wrap[] = [];
	let at = 0;
	node.forEach((child) => {
		const length = child.text?.length ?? 0;
		if (child.isText && child.marks.length > 0)
			wraps.push({ from: at, to: at + length, wrap: (inner) => drawMarks(child, inner, context) });
		at += length;
	});
	return wraps;
}

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
				node={node}
				wraps={markWraps(node, context)}
				inExplorer={inExplorer}
				settings={context.settings}
				parts={context.marks?.words.get(id)}
				change={context.marks?.code.get(id)}
				kind={context.kind}
				streaming={context.streaming}
				chat={context.chat}
				caret={context.caretAt === node}
			/>
		);
	}
	const Site = CORE_BLOCKS.has(block.type) ? undefined : context.definitions.get(block.type)?.Site;
	if (isBox(block, context))
		return <Box key={key} type={block.type} id={id} label={context.t(block.label)} context={context} />;
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
		// The block as the body holds it, with the blocks it holds: a drawing reads its children's own values (a tab's name, a column count, a file's path).
		const whole: Block = context.blocks.get(id) ?? { id, type: block.type, attrs: data };
		const attrs = whole.attrs ?? data;
		const children = block.holds === "nothing" ? undefined : drawChildren(node, context);
		const drawn = (
			<Guard fallback={<Box type={block.type} id={id} label={context.t(block.label)} context={context} />}>
				{createElement(Site, { block: whole, attrs }, children)}
			</Guard>
		);
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
						streaming={context.streaming}
						chat={context.chat}
					/>
				) : null}
			</div>
		);
	}
	const children = drawChildren(node, context);
	// A list item of a checklist has its box before its words.
	if (block.type === "listItem" && parent.type.name === nodeName("checklist"))
		return elementOf(spec, [checkOf(Boolean(data.checked), node.textContent), ...children], context, key);
	return elementOf(spec, children, context, key);
}

// --- The body --------------------------------------------------------------------------------------------------------------------------------

/** The ids of the library files the blocks show, at any depth. */
function mediaOf(blocks: readonly Block[], found: string[] = []): string[] {
	for (const block of blocks) {
		const media = block.attrs?.media;
		if (typeof media === "string" && media !== "" && !found.includes(media)) found.push(media);
		if (block.children) mediaOf(block.children, found);
	}
	return found;
}

/**
 * Where the caret of an answer still arriving stands: its last text run at any depth, code included. A run in code puts the caret in that code block, after
 * its last character; any other, after the run.
 */
function lastWords(body: NodeOf) {
	let last: NodeOf | null = null;
	body.descendants((node, _at, parent) => {
		if (node.isText) last = parent?.type.name === nodeName("codeBlock") ? parent : node;
		return true;
	});
	return last;
}

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

/**
 * The catalog the bodies read below it are drawn with, read once, with the site's marks' looks mounted once: a screen with many bodies in it (the source
 * cells of a side-by-side translation, the margin cards) reads the catalog, makes the schema and mounts the looks one time, not once per body. Without it
 * a `ReadBody` reads the catalog itself.
 */
export function ReadBodies({ children }: { children: ReactNode }) {
	const kit = useRead<Catalog>("blocks.catalog", {}).data;
	const { run } = useOperation<MediaQueryResult>("media.query");
	const [files, setFiles] = useState<readonly { id: string; name: string }[]>([]);
	// The files the bodies name, asked in the same moment and read together, each once.
	const asked = useRef(new Set<string>());
	const waiting = useRef(new Set<string>());
	const want = useCallback(
		(media: string) => {
			if (asked.current.has(media)) return;
			asked.current.add(media);
			waiting.current.add(media);
			queueMicrotask(async () => {
				const ids = [...waiting.current];
				waiting.current.clear();
				if (ids.length === 0) return;
				const answer = await run({ ids });
				if (answer.ok) setFiles((were) => [...were, ...answer.body.items.map(({ id, name }) => ({ id, name }))]);
			});
		},
		[run],
	);
	const value = useMemo(() => ({ kit: kit ?? null, files, want }), [kit, files, want]);
	return (
		<ReadCatalog.Provider value={value}>
			{children}
			<MarkLooks />
		</ReadCatalog.Provider>
	);
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
	ground = "page",
	streaming = false,
	current,
	files,
	onOpen,
}: {
	doc: Doc;
	marks?: ReadMarks;
	mark?: ReadMark;
	size?: "reading" | "chat" | "card";
	/** In the quieter ink: a source read beside its translation. */
	muted?: boolean;
	/** The ground it stands on: on the tool ground (a source beside its translation) its code and boxes are one step darker. */
	ground?: "page" | "tool";
	/** The text is still arriving (an answer being written): its code is not coloured until it is whole. */
	streaming?: boolean;
	current?: string | null;
	/** The library's files the body shows, to name a picture or a file by its name; read here when not given. */
	files?: readonly { id: string; name: string }[];
	/** Opens a place of the admin an address in the text names (`#/…`); without it such an address is words. */
	onOpen?: (address: string) => void;
}) {
	const { t, blocks: definitions } = useAdmin();
	const shared = useContext(ReadCatalog);
	const own = useRead<Catalog>("blocks.catalog", {}, { skip: shared !== null }).data;
	const kit = (shared ? shared.kit : own) ?? undefined;
	// A picture or a file is named by its file; the files not given with the body are read, as the editor reads them (once for all the bodies under
	// `ReadBodies`).
	const wanted = files || shared ? [] : mediaOf(doc.blocks);
	const read = useRead<MediaQueryResult>("media.query", { ids: wanted }, { skip: wanted.length === 0 }).data?.items;
	const shown = files ?? (shared ? shared.files : read);
	const known = (shown ?? []).map((file) => `${file.id}\u0000${file.name}`).join("\u0001");
	// biome-ignore lint/correctness/useExhaustiveDependencies: the files are followed by what they are (`known`), not by the array's identity
	const names = useMemo(() => (kit ? blockNamesOf(kit, t, shown, shared?.want) : undefined), [kit, t, known]);
	const drawn = useMemo(() => {
		if (doc.blocks.length === 0) return null;
		// Without the catalog (still being read, or it failed) the body is its words, so nothing is left blank.
		if (!kit)
			return doc.blocks.map((block, at) => (
				<p key={block.id}>
					{blockWords(block).text}
					{streaming && at === doc.blocks.length - 1 ? <StreamCaret /> : null}
				</p>
			));
		const schema = schemaOf(kit, definitions);
		const from = (blocks: Block[]) => docToEditor({ ...doc, blocks }, kit);
		// The whole body, or, where one block cannot be made into the editor's nodes, each block by itself: the others are drawn and that one is a box.
		let body: NodeOf | null = null;
		try {
			body = schema.nodeFromJSON(from(doc.blocks));
		} catch {
			body = null;
		}
		const made: { id: string; node: NodeOf | null }[] = [];
		if (body)
			body.forEach((node) => {
				made.push({ id: String(node.attrs.blockId ?? ""), node });
			});
		else
			for (const block of doc.blocks) {
				let node: NodeOf | null = null;
				try {
					node = schema.nodeFromJSON(from([block]).content?.[0] ?? {});
				} catch {
					node = null;
				}
				made.push({ id: block.id, node });
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
			numbers: body ? footnoteNumbers(body) : new Map(),
			onOpen,
			t,
			cursor: null,
			current,
			footnotes: 0,
			streaming,
			chat: size === "chat",
			// The caret of an answer still arriving: after the last character of its last words, in the code when it ends in code.
			caretAt: streaming && body ? lastWords(body) : null,
		};
		const top: ReactNode[] = [];
		const parent = body ?? ({ type: { name: "doc" } } as NodeOf);
		made.forEach(({ id, node }, index) => {
			let block: ReactNode;
			try {
				if (!node) throw new Error("not a block of the editor");
				block = drawNode(node, context, index, parent);
			} catch {
				const type = context.blocks.get(id)?.type ?? "";
				// biome-ignore lint/suspicious/noArrayIndexKey: the blocks of one body, in order
				block = <Box key={index} type={type} id={id} label={unknownLabel(t, type)} context={context} />;
			}
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
	}, [kit, doc, definitions, names, marks, mark, onOpen, t, current, streaming, size]);
	if (!drawn) return null;
	return (
		<>
			<EditorBody readOnly muted={muted} ground={ground} size={size}>
				{drawn}
			</EditorBody>
			{shared ? null : <MarkLooks />}
		</>
	);
}
