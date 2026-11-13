import type { CodeBlockSettings } from "@monti-cms/core";
import {
	ANCHOR,
	COLLAPSE,
	type CodeColors,
	type CodeRule,
	codeHighlighter,
	type LineEffect,
	lineStarts,
	moveLineEffects,
	ruleRanges,
} from "@monti-cms/core/code";
import { Extension } from "@tiptap/core";
import type { Node as EditorNode } from "@tiptap/pm/model";
import { type EditorState, Plugin, PluginKey, type Transaction } from "@tiptap/pm/state";
import { Decoration, DecorationSet, type EditorView } from "@tiptap/pm/view";
import { markName, nodeName } from "../schema";

/** A code block's attrs as the editor keeps them (`node.attrs.data`, the stored shape of doc 17). */
export type CodeData = {
	language?: string;
	title?: string;
	lineNumbers?: true;
	meta?: string;
	lines?: LineEffect[];
	rules?: CodeRule[];
};

export const dataOf = (node: EditorNode): CodeData => (node.attrs.data ?? {}) as CodeData;

/** The attrs with what is empty left out: the stored shape has no `false`, no empty list and no empty name. */
export function cleanData(data: CodeData): CodeData | null {
	const out: CodeData = {};
	if (data.language) out.language = data.language;
	if (data.title) out.title = data.title;
	if (data.lineNumbers) out.lineNumbers = true;
	if (data.meta) out.meta = data.meta;
	if (data.lines?.length) out.lines = data.lines;
	if (data.rules?.length) out.rules = data.rules;
	return Object.keys(out).length ? out : null;
}

/** Lines picked by their numbers in one block: `pos` is the block's place, `start` to `end - 1` its lines (from 0). */
export type LinePick = { pos: number; start: number; end: number };

/** A code link being made (doc 17): the words of the text and the lines, each picked in turn; "Link" joins them. */
export type LinkDraft = { text?: { from: number; to: number }; lines?: LinePick };

export type CodeToolsState = {
	picked: LinePick | null;
	/** Folds opened or closed in the editor, by block id and the fold's first line; not stored (the site starts from `open`). */
	folds: ReadonlyMap<string, boolean>;
	linking: LinkDraft | null;
	/** The code link the pointer is on: its lines are lit. */
	pointed: { block: string; anchor: string } | null;
	/** The highlighter has coloured more code: draw again. */
	version: number;
};

type Meta =
	| { picked: LinePick | null }
	| { fold: string; open: boolean }
	| { linking: LinkDraft | null }
	| { pointed: CodeToolsState["pointed"] }
	| { coloured: true };

export const codeToolsKey = new PluginKey<CodeToolsState>("montiCodeTools");

export const lineAt = (starts: readonly number[], offset: number) => {
	let line = 0;
	while (line + 1 < starts.length && starts[line + 1] <= offset) line++;
	return line;
};

/** Where line `line` ends in the code (before its `\n`). */
export const lineEnd = (code: string, starts: readonly number[], line: number) =>
	(starts[line + 1] ?? code.length + 1) - 1;

/** The fold's key in the editor's state: the block and the fold's first line. */
export const foldKey = (blockId: string, start: number) => `${blockId}:${start}`;

/** The folds over lines of a block and whether each is open in the editor now. */
export function foldsOf(node: EditorNode, folds: ReadonlyMap<string, boolean>) {
	const blockId = String(node.attrs.blockId ?? "");
	return (dataOf(node).lines ?? [])
		.filter((effect) => effect.name === COLLAPSE && effect.end - effect.start >= 2)
		.map((effect) => ({
			effect,
			open: folds.get(foldKey(blockId, effect.start)) ?? effect.attrs?.open === true,
		}));
}

/** Lines a closed fold hides: every line of it after the first. */
export function hiddenLines(node: EditorNode, folds: ReadonlyMap<string, boolean>) {
	const hidden = new Set<number>();
	for (const { effect, open } of foldsOf(node, folds))
		if (!open) for (let line = effect.start + 1; line < effect.end; line++) hidden.add(line);
	return hidden;
}

// --- Colours ---------------------------------------------------------------------------------------------------------------------------------

type Piece = { from: number; to: number; light?: string; dark?: string };

/** One highlighter per page, opened when the first code block draws, with the site's themes; languages load as blocks need them. */
let colours: Promise<CodeColors> | null = null;
const coloured = new Map<string, Piece[]>();
const asked = new Set<string>();

function colourKey(language: string, code: string) {
	return `${language}\u0000${code}`;
}

function remember(key: string, pieces: Piece[]) {
	coloured.delete(key);
	coloured.set(key, pieces);
	if (coloured.size > 80) {
		const oldest = coloured.keys().next().value;
		if (oldest !== undefined) coloured.delete(oldest);
	}
}

function ask(view: EditorView, settings: CodeBlockSettings, language: string, code: string) {
	const key = colourKey(language, code);
	if (coloured.has(key) || asked.has(key)) return;
	asked.add(key);
	colours ??= codeHighlighter({ themes: settings.themes, languages: settings.languages }, { lazy: true });
	void colours
		.then(async (highlighter) => {
			await highlighter.load(language);
			const pieces: Piece[] = [];
			const starts = lineStarts(code);
			highlighter.lines(code, language).forEach((line, at) => {
				let offset = starts[at] ?? 0;
				for (const token of line) {
					if (token.light || token.dark)
						pieces.push({ from: offset, to: offset + token.text.length, light: token.light, dark: token.dark });
					offset += token.text.length;
				}
			});
			remember(key, pieces);
		})
		.catch(() => remember(key, []))
		.finally(() => {
			asked.delete(key);
			if (!view.isDestroyed)
				view.dispatch(view.state.tr.setMeta(codeToolsKey, { coloured: true }).setMeta("addToHistory", false));
		});
}

// --- Decorations -----------------------------------------------------------------------------------------------------------------------------

/** Every code block of the body with its id's anchors: what a code link may point at. */
export function anchorsByBlock(doc: EditorNode) {
	const anchors = new Map<string, { pos: number; node: EditorNode; effects: LineEffect[] }>();
	doc.descendants((node, pos) => {
		if (node.type.name !== nodeName("codeBlock")) return true;
		anchors.set(String(node.attrs.blockId ?? ""), {
			pos,
			node,
			effects: (dataOf(node).lines ?? []).filter((effect) => effect.name === ANCHOR),
		});
		return false;
	});
	return anchors;
}

function decorations(state: EditorState, settings: CodeBlockSettings, tools: CodeToolsState) {
	const out: Decoration[] = [];
	const codeRef = state.schema.marks[markName("codeRef")];
	const blocks = anchorsByBlock(state.doc);
	const { from: caretFrom, to: caretTo } = state.selection;
	state.doc.descendants((node, pos) => {
		if (node.type.name === nodeName("codeBlock")) {
			const code = node.textContent;
			const base = pos + 1;
			const data = dataOf(node);
			const language = data.language;
			if (language && code) {
				for (const piece of coloured.get(colourKey(language, code)) ?? [])
					out.push(
						Decoration.inline(base + piece.from, base + piece.to, {
							"data-token": "",
							// design-allow: the site's Shiki themes colour each piece at run time
							style: `--shiki-light:${piece.light ?? "inherit"};--shiki-dark:${piece.dark ?? piece.light ?? "inherit"}`,
						}),
					);
			}
			const starts = lineStarts(code);
			for (const rule of data.rules ?? [])
				for (const range of ruleRanges(rule, code))
					out.push(Decoration.inline(base + range.from, base + range.to, { "data-effect": rule.name }));
			for (const effect of data.lines ?? []) {
				const wavy = settings.lineEffects.find((each) => each.name === effect.name)?.editor;
				if (!wavy?.wavy) continue;
				for (let line = effect.start; line < Math.min(effect.end, starts.length); line++) {
					const from = base + (starts[line] ?? 0);
					const to = base + lineEnd(code, starts, line);
					if (to > from)
						out.push(Decoration.inline(from, to, { "data-wavy": wavy.tone === "danger" ? "error" : "warning" }));
				}
			}
			for (const { effect, open } of foldsOf(node, tools.folds)) {
				if (open || effect.end > starts.length) continue;
				const from = base + lineEnd(code, starts, effect.start);
				const to = base + lineEnd(code, starts, effect.end - 1);
				// The caret inside a closed fold would be out of sight: the fold shows while the caret is in it.
				if (caretTo > from && caretFrom <= to) continue;
				out.push(Decoration.inline(from, to, { "data-code-hidden": "" }));
			}
			return false;
		}
		if (node.isText && codeRef) {
			const mark = node.marks.find((each) => each.type === codeRef);
			if (mark) {
				const target = blocks.get(String(mark.attrs.block ?? ""));
				const found = target?.effects.some((effect) => effect.attrs?.id === mark.attrs.anchor);
				if (!found) out.push(Decoration.inline(pos, pos + node.nodeSize, { "data-code-ref-broken": "" }));
			}
		}
		return true;
	});
	const text = tools.linking?.text;
	if (text && text.to > text.from) out.push(Decoration.inline(text.from, text.to, { "data-code-ref-picking": "" }));
	return DecorationSet.create(state.doc, out);
}

/** Asks the highlighter for every block's colours it does not have yet. */
function colourAll(view: EditorView, settings: CodeBlockSettings) {
	view.state.doc.descendants((node) => {
		if (node.type.name !== nodeName("codeBlock")) return true;
		const language = dataOf(node).language;
		const code = node.textContent;
		if (language && code) ask(view, settings, language, code);
		return false;
	});
}

// --- Line effects follow the code -----------------------------------------------------------------------------------------------------------

/** Where the old code and the new one differ: one replaced range, by their common start and end. */
function changed(before: string, after: string) {
	let start = 0;
	while (start < before.length && start < after.length && before[start] === after[start]) start++;
	let end = 0;
	while (
		end < before.length - start &&
		end < after.length - start &&
		before[before.length - 1 - end] === after[after.length - 1 - end]
	)
		end++;
	return { from: start, to: before.length - end, inserted: after.slice(start, after.length - end) };
}

/** A block's line effects and line rules after its code changed (doc 17, 17-2): a line keeps its effects as it moves. */
export function movedData(data: CodeData, before: string, after: string): CodeData {
	const { from, to, inserted } = changed(before, after);
	const lines = moveLineEffects(data.lines ?? [], before, from, to, inserted);
	const lineRules = (data.rules ?? []).map((rule, at) =>
		rule.scope === "line" ? { name: `rule-${at}`, start: rule.line ?? 0, end: (rule.line ?? 0) + 1 } : null,
	);
	const movedRules = moveLineEffects(
		lineRules.filter((each) => each !== null),
		before,
		from,
		to,
		inserted,
	);
	const rules = (data.rules ?? []).flatMap((rule, at) => {
		if (rule.scope !== "line") return [rule];
		const now = movedRules.find((each) => each.name === `rule-${at}`);
		return now ? [{ ...rule, line: now.start }] : [];
	});
	return { ...data, lines, rules };
}

function follow(transactions: readonly Transaction[], before: EditorState, after: EditorState) {
	if (!transactions.some((tr) => tr.docChanged)) return null;
	const old = new Map<string, EditorNode>();
	before.doc.descendants((node) => {
		if (node.type.name !== nodeName("codeBlock")) return true;
		old.set(String(node.attrs.blockId ?? ""), node);
		return false;
	});
	let tr: Transaction | null = null;
	after.doc.descendants((node, pos) => {
		if (node.type.name !== nodeName("codeBlock")) return true;
		const was = old.get(String(node.attrs.blockId ?? ""));
		if (!was || was.textContent === node.textContent) return false;
		const data = dataOf(node);
		if (!data.lines?.length && !data.rules?.some((rule) => rule.scope === "line")) return false;
		// Attrs changed in the same step (an undo puts back both): they are already where they belong.
		if (JSON.stringify(dataOf(was)) !== JSON.stringify(data)) return false;
		const next = cleanData(movedData(data, was.textContent, node.textContent));
		if (JSON.stringify(next) !== JSON.stringify(cleanData(data))) {
			tr ??= after.tr;
			tr.setNodeAttribute(pos, "data", next);
		}
		return false;
	});
	return tr;
}

// --- The plugin ------------------------------------------------------------------------------------------------------------------------------

const mapPick = (pick: LinePick | null, tr: Transaction): LinePick | null => {
	if (!pick) return null;
	const pos = tr.mapping.mapResult(pick.pos);
	return pos.deleted ? null : { ...pick, pos: pos.pos };
};

/**
 * The code blocks' tools in the editor (doc 17): the code's colours, the rules' and warning lines' looks, closed folds, broken code links; lines picked
 * by their numbers and a code link being made; line effects and line rules that follow their lines as the code changes.
 */
export const CodeTools = Extension.create<{ settings: CodeBlockSettings | null }>({
	name: "codeTools",
	addOptions: () => ({ settings: null }),
	addStorage() {
		return { settings: this.options.settings };
	},
	addProseMirrorPlugins() {
		const settings = this.options.settings;
		if (!settings) return [];
		return [
			new Plugin<CodeToolsState>({
				key: codeToolsKey,
				state: {
					init: () => ({ picked: null, folds: new Map(), linking: null, pointed: null, version: 0 }),
					apply(tr, value) {
						const meta = tr.getMeta(codeToolsKey) as Meta | undefined;
						let next: CodeToolsState = value;
						if (tr.docChanged || tr.selectionSet) {
							const linking = value.linking
								? {
										...(value.linking.text
											? {
													text: {
														from: tr.mapping.map(value.linking.text.from),
														to: tr.mapping.map(value.linking.text.to),
													},
												}
											: {}),
										...(value.linking.lines ? { lines: mapPick(value.linking.lines, tr) ?? undefined } : {}),
									}
								: null;
							// A pick by the numbers lasts until the text's selection moves by other means.
							next = { ...value, picked: tr.docChanged || meta ? mapPick(value.picked, tr) : null, linking };
						}
						if (!meta) return next;
						if ("picked" in meta) return { ...next, picked: meta.picked, version: next.version + 1 };
						if ("fold" in meta) {
							const folds = new Map(next.folds);
							folds.set(meta.fold, meta.open);
							return { ...next, folds, version: next.version + 1 };
						}
						if ("linking" in meta) return { ...next, linking: meta.linking, version: next.version + 1 };
						if ("pointed" in meta) return { ...next, pointed: meta.pointed, version: next.version + 1 };
						return { ...next, version: next.version + 1 };
					},
				},
				appendTransaction: (transactions, before, after) => follow(transactions, before, after),
				props: {
					decorations(state) {
						const tools = codeToolsKey.getState(state);
						return tools ? decorations(state, settings, tools) : null;
					},
					handleDOMEvents: {
						mouseover(view, event) {
							const pointed = refAt(event);
							const now = codeToolsKey.getState(view.state)?.pointed ?? null;
							if (JSON.stringify(now) !== JSON.stringify(pointed)) sendCode(view, { pointed });
							return false;
						},
						// A code link is followed with a press where the text cannot be written, and with ⌘ (Ctrl) and a press where it can.
						click(view, event) {
							const ref = refAt(event);
							if (!ref || (view.editable && !(event.metaKey || event.ctrlKey))) return false;
							event.preventDefault();
							followCodeRef(view, ref.block, ref.anchor);
							return true;
						},
					},
				},
				view(view) {
					colourAll(view, settings);
					return { update: (current) => colourAll(current, settings) };
				},
			}),
		];
	},
});

/** Shows the lines a code link points at: scrolls to them, opens a fold that hides them, and lights them for a moment. */
export function followCodeRef(view: EditorView, block: string, anchor: string) {
	const target = anchorsByBlock(view.state.doc).get(block);
	const effect = target?.effects.find((each) => each.attrs?.id === anchor);
	if (!target || !effect) return;
	const tools = codeToolsKey.getState(view.state);
	for (const { effect: fold, open } of foldsOf(target.node, tools?.folds ?? new Map()))
		if (!open && fold.start < effect.start && effect.start < fold.end)
			sendCode(view, { fold: foldKey(block, fold.start), open: true });
	sendCode(view, { pointed: { block, anchor } });
	const dom = view.nodeDOM(target.pos) as HTMLElement | null;
	dom?.querySelector(`[data-slot=code-number][data-line="${effect.start}"]`)?.scrollIntoView({ block: "center" });
	setTimeout(() => {
		if (!view.isDestroyed && codeToolsKey.getState(view.state)?.pointed?.anchor === anchor)
			sendCode(view, { pointed: null });
	}, 1500);
}

/** The code link's target under a pointer event, from the words' element. */
function refAt(event: Event) {
	const target = (event.target as HTMLElement).closest?.("[data-monti-mark=codeRef]");
	if (!target) return null;
	try {
		const attrs = JSON.parse(target.getAttribute("data-monti-attrs") ?? "{}");
		return { block: String(attrs.block ?? ""), anchor: String(attrs.anchor ?? "") };
	} catch {
		return null;
	}
}

/** Sends a change of the tools' state (a pick, a fold, a link being made) without touching the text's history. */
export function sendCode(view: EditorView, meta: Meta) {
	view.dispatch(view.state.tr.setMeta(codeToolsKey, meta).setMeta("addToHistory", false));
}
