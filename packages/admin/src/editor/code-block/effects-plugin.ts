import type { Site } from "@monti-cms/core/client";
import {
	ANCHOR,
	COLLAPSE,
	type CodeLineEffect,
	type CodeRule,
	charEffectByName,
	lineAt,
	lineRange,
	lineStarts,
	ruleMatches,
} from "@monti-cms/core/code-block";
import type { Node as PmNode } from "@tiptap/pm/model";
import { Plugin, PluginKey, TextSelection, type Transaction } from "@tiptap/pm/state";
import { Mapping } from "@tiptap/pm/transform";
import { Decoration, DecorationSet, type EditorView } from "@tiptap/pm/view";
import type { TranslatorFor } from "../../translator";
import { codeAnchorRef } from "../added-marks";
import { codeBlockMessages } from "./messages";

/**
 * Shows a code block's line effects, regex rules and folding in the editor.
 *
 * - Warning and error lines get a wavy underline; text matched by a rule is painted in that effect's style (plus a faint background).
 * - Line folds and text folds actually collapse, as on the public page. The initial state follows the `open` attribute; the state toggled while editing
 *   lives only in this plugin's state (`overrides`) and is not saved. A fold opens by itself when the cursor enters it.
 * - When text is edited, line numbers of line effects and line rules move along with the text (appendTransaction).
 * Line backgrounds (highlight, add, remove) and the line number gutter are drawn by the NodeView (code-block-view.tsx).
 */
export interface CodeEffectsState {
	/** Fold open state. `c:<line effect id>`, `m:<document position>` (text folds and rule folds). */
	overrides: Map<string, boolean>;
	/** Lines picked in the line number gutter (code block position, [start, end) lines). Cleared when the selection changes by other means. */
	picked: LinePick | null;
	/** While linking text to code, the side picked first (body text or a code line). Picking and confirming the other side links them. */
	linking: LinkDraft | null;
	/** Line name of the body link (`data-code-ref`, `codeAnchorRef`) under the mouse. That line is highlighted and the rest are dimmed. */
	hoverRef: string | null;
	version: number;
}

export type LinkDraft =
	| { kind: "text"; from: number; to: number }
	| { kind: "lines"; blockPos: number; start: number; end: number };

export interface LinePick {
	blockPos: number;
	start: number;
	end: number;
}

type EffectsMeta =
	| { key: string; open: boolean }
	| { pick: LinePick | null }
	| { linking: LinkDraft | null }
	| { hoverRef: string | null };

/** Transaction meta that changes the plugin state (used by the link commands). */
export const effectsMeta = (meta: EffectsMeta) => meta;

export const codeEffectsKey = new PluginKey<CodeEffectsState>("cmsCodeEffects");

export interface FoldRegion {
	key: string;
	kind: "collapse" | "fold";
	/** Document range [from, to) to hide. A line fold runs from the end of the first line to the end of the last line (the first line stays visible). */
	from: number;
	to: number;
	open: boolean;
	defaultOpen: boolean;
	/** Number of lines hidden by a line fold. */
	hiddenLines: number;
	startLine?: number;
	endLine?: number;
}

export const lineEffectsOf = (node: PmNode): CodeLineEffect[] =>
	Array.isArray(node.attrs.lineEffects) ? (node.attrs.lineEffects as CodeLineEffect[]) : [];
export const rulesOf = (node: PmNode): CodeRule[] =>
	Array.isArray(node.attrs.rules) ? (node.attrs.rules as CodeRule[]) : [];

/** Range that a text fold mark spans (in code text). */
function foldMarkRanges(node: PmNode): Array<{ from: number; to: number; open: boolean }> {
	const ranges: Array<{ from: number; to: number; open: boolean }> = [];
	node.forEach((child, offset) => {
		const mark = child.marks.find((item) => item.type.name === "codeFold");
		if (!mark) return;
		const last = ranges[ranges.length - 1];
		const open = mark.attrs.open === true;
		if (last && last.to === offset && last.open === open) last.to = offset + child.nodeSize;
		else ranges.push({ from: offset, to: offset + child.nodeSize, open });
	});
	return ranges;
}

/** Fold ranges of the code block (document position `pos`). */
export function foldRegions(node: PmNode, pos: number, overrides: ReadonlyMap<string, boolean>): FoldRegion[] {
	if (node.attrs.rawMode) return [];
	const base = pos + 1;
	const text = node.textContent;
	const starts = lineStarts(text);
	const regions: FoldRegion[] = [];
	// A text fold mark and a rule that fold the same place count as one (same key).
	const push = (region: Omit<FoldRegion, "open">) => {
		if (regions.some((other) => other.key === region.key)) return;
		regions.push({ ...region, open: overrides.get(region.key) ?? region.defaultOpen });
	};

	for (const effect of lineEffectsOf(node)) {
		if (effect.name !== COLLAPSE || effect.end - effect.start < 2 || effect.end > starts.length) continue;
		push({
			key: `c:${effect.id}`,
			kind: "collapse",
			from: base + lineRange(text, starts, effect.start).to,
			to: base + lineRange(text, starts, effect.end - 1).to,
			defaultOpen: effect.attrs.open === true,
			hiddenLines: effect.end - effect.start - 1,
			startLine: effect.start,
			endLine: effect.end,
		});
	}
	for (const range of foldMarkRanges(node))
		push({
			key: `m:${base + range.from}`,
			kind: "fold",
			from: base + range.from,
			to: base + range.to,
			// In the editor, text folds are kept open so the text can be edited. `open` is the initial state on the public page.
			defaultOpen: true,
			hiddenLines: 0,
		});
	for (const rule of rulesOf(node)) {
		if (rule.name !== "fold") continue;
		for (const match of ruleMatches(rule, text, starts))
			push({
				key: `m:${base + match.from}`,
				kind: "fold",
				from: base + match.from,
				to: base + match.to,
				defaultOpen: true,
				hiddenLines: 0,
			});
	}
	return regions;
}

/** Ranges that are shown folded (not inside another folded range). */
export function visibleClosedRegions(regions: readonly FoldRegion[]): FoldRegion[] {
	const closed = regions.filter((region) => !region.open && region.to > region.from);
	return closed.filter(
		(region) =>
			!closed.some(
				(other) =>
					other !== region &&
					other.from <= region.from &&
					region.to <= other.to &&
					other.to - other.from > region.to - region.from,
			),
	);
}

/** Whether the cursor is inside folded, hidden text. For a line fold, the end of the last hidden line also counts as inside. */
const hidesPosition = (region: FoldRegion, head: number) =>
	region.kind === "collapse" ? region.from < head && head <= region.to : region.from < head && head < region.to;

/**
 * Marks lines `start` to `end` of the code block (`blockPos`) as picked in the line number gutter.
 * Text is not selected (it is not painted like a drag selection). Only the cursor is placed before the first line; the picked lines are shown by the line background.
 */
export function pickLines(view: EditorView, blockPos: number, start: number, end: number) {
	const node = view.state.doc.nodeAt(blockPos);
	if (!node || node.type.name !== "codeBlock") return;
	const text = node.textContent;
	const from = blockPos + 1 + lineRange(text, lineStarts(text), start).from;
	view.dispatch(
		view.state.tr
			.setSelection(TextSelection.create(view.state.doc, from))
			.setMeta(codeEffectsKey, { pick: { blockPos, start, end } } satisfies EffectsMeta),
	);
	view.focus();
}

/** Removes a rule (its effect disappears everywhere it matched). */
export function removeRule(view: EditorView, blockPos: number, ruleId: string) {
	const node = view.state.doc.nodeAt(blockPos);
	if (!node || node.type.name !== "codeBlock") return;
	const rules = rulesOf(node).filter((rule) => rule.id !== ruleId);
	view.dispatch(view.state.tr.setNodeMarkup(blockPos, undefined, { ...node.attrs, rules }));
}

/** Removes a rule and leaves the same effect as a text mark at every place it currently matches (so each can be removed one by one). */
export function expandRule(view: EditorView, blockPos: number, ruleId: string) {
	const node = view.state.doc.nodeAt(blockPos);
	const rule = node ? rulesOf(node).find((item) => item.id === ruleId) : undefined;
	const markName = rule ? charEffectByName(rule.name)?.mark : undefined;
	const type = markName ? view.state.schema.marks[markName] : undefined;
	if (!node || !rule || !type) return;
	const attrs =
		rule.name === "Tooltip"
			? { content: String(rule.attrs.content ?? "") }
			: rule.name === "fold"
				? { open: rule.attrs.open === true }
				: null;
	const tr = view.state.tr;
	for (const match of ruleMatches(rule, node.textContent))
		tr.addMark(blockPos + 1 + match.from, blockPos + 1 + match.to, type.create(attrs));
	tr.setNodeMarkup(blockPos, undefined, { ...node.attrs, rules: rulesOf(node).filter((item) => item.id !== ruleId) });
	view.dispatch(tr);
}

/** Toggles a fold. When folding, if the cursor would be hidden, it moves to before the fold. */
export function setFoldOpen(view: EditorView, region: FoldRegion, open: boolean) {
	const tr = view.state.tr.setMeta(codeEffectsKey, { key: region.key, open } satisfies EffectsMeta);
	if (!open && hidesPosition(region, view.state.selection.head))
		tr.setSelection(TextSelection.create(tr.doc, region.from));
	view.dispatch(tr);
}

/** Style of text matched by a rule. A faint background shows it came from a rule (the text cannot be clicked to edit). */
const RULE_CLASS: Record<string, string> = {
	strong: "font-bold",
	em: "italic",
	del: "line-through",
	u: "underline underline-offset-4",
	Tooltip: "underline decoration-dotted underline-offset-4",
	fold: "rounded-sm outline-1 outline-cms-muted-foreground/50 outline-dashed -outline-offset-1",
};

function foldWidget(t: TranslatorFor<typeof codeBlockMessages>, region: FoldRegion) {
	return Decoration.widget(
		region.from,
		(view) => {
			const button = document.createElement("button");
			button.type = "button";
			button.contentEditable = "false";
			button.dataset.codeFoldToggle = region.kind;
			button.className =
				"mx-0.5 inline-flex h-5 items-center rounded bg-cms-muted px-1 align-middle font-sans text-cms-muted-foreground text-xs leading-none hover:bg-cms-accent hover:text-cms-foreground";
			button.textContent = region.kind === "collapse" ? `⋯ ${t("fold.lines", { count: region.hiddenLines })}` : "…";
			button.title =
				region.kind === "collapse" ? t("fold.expandLines", { count: region.hiddenLines }) : t("fold.expandText");
			button.setAttribute("aria-label", button.title);
			button.addEventListener("mousedown", (event) => {
				event.preventDefault();
				event.stopPropagation();
				setFoldOpen(view, region, true);
			});
			return button;
		},
		{ side: 1, key: `fold:${region.key}:${region.hiddenLines}`, ignoreSelection: true, stopEvent: () => true },
	);
}

function blockDecorations(
	t: TranslatorFor<typeof codeBlockMessages>,
	node: PmNode,
	pos: number,
	overrides: ReadonlyMap<string, boolean>,
): Decoration[] {
	if (node.attrs.rawMode) return [];
	const base = pos + 1;
	const text = node.textContent;
	const starts = lineStarts(text);
	const decorations: Decoration[] = [];

	for (const rule of rulesOf(node)) {
		const style = RULE_CLASS[rule.name];
		if (!style) continue;
		const label = charEffectByName(rule.name)?.label ?? rule.name;
		const title =
			rule.name === "Tooltip"
				? String(rule.attrs.content ?? "")
				: t("rule.title", { label, pattern: rule.pattern, flags: rule.flags });
		for (const match of ruleMatches(rule, text, starts))
			decorations.push(
				Decoration.inline(base + match.from, base + match.to, {
					class: `${style} bg-sky-500/10`,
					title,
					"data-code-rule": rule.id,
				}),
			);
	}

	for (const region of visibleClosedRegions(foldRegions(node, pos, overrides))) {
		decorations.push(Decoration.inline(region.from, region.to, { class: "hidden" }));
		decorations.push(foldWidget(t, region));
	}
	return decorations;
}

/** Line labels of every code line in the document (ids of `anchor` line effects). */
export function anchorIds(doc: PmNode): Set<string> {
	const ids = new Set<string>();
	doc.descendants((node) => {
		if (node.type.name !== "codeBlock") return true;
		for (const effect of lineEffectsOf(node))
			if (effect.name === ANCHOR && typeof effect.attrs.id === "string") ids.add(effect.attrs.id);
		return false;
	});
	return ids;
}

/** If the line of the body link under the mouse is in this code block, dims the other lines. */
function hoverDecorations(node: PmNode, pos: number, id: string): Decoration[] {
	const anchor = lineEffectsOf(node).find((effect) => effect.name === ANCHOR && effect.attrs.id === id);
	if (!anchor) return [];
	const text = node.textContent;
	const starts = lineStarts(text);
	const decorations: Decoration[] = [];
	for (let line = 0; line < starts.length; line += 1) {
		if (anchor.start <= line && line < anchor.end) continue;
		const range = lineRange(text, starts, line);
		if (range.to > range.from)
			decorations.push(Decoration.inline(pos + 1 + range.from, pos + 1 + range.to, { class: "opacity-35" }));
	}
	return decorations;
}

/** Moves old line numbers to new ones following text changes. */
function remapLineEffects(
	oldNode: PmNode,
	oldPos: number,
	newNode: PmNode,
	newPos: number,
	mapping: Mapping,
): { lineEffects: CodeLineEffect[]; rules: CodeRule[] } {
	const oldText = oldNode.textContent;
	const oldStarts = lineStarts(oldText);
	const newText = newNode.textContent;
	const newStarts = lineStarts(newText);
	const toNewLine = (oldOffset: number, assoc: -1 | 1) => {
		const mapped = mapping.map(oldPos + 1 + oldOffset, assoc) - (newPos + 1);
		return lineAt(newStarts, Math.max(0, Math.min(newText.length, mapped)));
	};

	const lineEffects = lineEffectsOf(oldNode)
		.map((effect) => {
			if (effect.start >= oldStarts.length) return null;
			const first = lineRange(oldText, oldStarts, effect.start).from;
			const last = lineRange(oldText, oldStarts, Math.min(effect.end, oldStarts.length) - 1).to;
			// If all text of an effect line was deleted, the effect is deleted too (it is not moved onto the next line).
			const head = mapping.mapResult(oldPos + 1 + first, 1);
			const tail = mapping.mapResult(oldPos + 1 + last, -1);
			if (last > first && head.deletedAfter && tail.deletedBefore && head.pos >= tail.pos) return null;
			const start = toNewLine(first, 1);
			const end = toNewLine(last, -1) + 1;
			return end > start ? { ...effect, start, end } : null;
		})
		.filter((effect): effect is CodeLineEffect => effect !== null);

	const rules = rulesOf(oldNode).map((rule) =>
		rule.scope === "char" && rule.line !== undefined && rule.line < oldStarts.length
			? { ...rule, line: toNewLine(lineRange(oldText, oldStarts, rule.line).from, 1) }
			: rule,
	);
	return { lineEffects, rules };
}

const sameJson = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

export function createCodeEffectsPlugin(site: Site): Plugin<CodeEffectsState> {
	const t = site.createTranslator(codeBlockMessages);
	const anchor = codeAnchorRef(site);
	return new Plugin<CodeEffectsState>({
		key: codeEffectsKey,
		state: {
			init: () => ({ overrides: new Map(), picked: null, linking: null, hoverRef: null, version: 0 }),
			apply(tr, value, _oldState, newState) {
				let overrides = value.overrides;
				let changed = false;
				if (tr.docChanged && [...overrides.keys()].some((key) => key.startsWith("m:"))) {
					const next = new Map<string, boolean>();
					for (const [key, open] of overrides) {
						if (!key.startsWith("m:")) {
							next.set(key, open);
							continue;
						}
						const mapped = tr.mapping.mapResult(Number(key.slice(2)), 1);
						if (!mapped.deleted) next.set(`m:${mapped.pos}`, open);
					}
					overrides = next;
					changed = true;
				}
				const meta = tr.getMeta(codeEffectsKey) as EffectsMeta | undefined;
				if (meta && "key" in meta) {
					if (!changed) overrides = new Map(overrides);
					overrides.set(meta.key, meta.open);
					changed = true;
				}
				// The line-number gutter reports picking lines together with the selection. Changing the selection by other means clears it.
				let picked = value.picked;
				if (meta && "pick" in meta) picked = meta.pick;
				else if (picked && tr.selectionSet) picked = null;
				else if (picked && tr.docChanged) {
					// Map the position before the block with a forward bias. Changing the effect (setNodeMarkup) replaces the whole block, so the back side would become "deleted".
					const mapped = tr.mapping.mapResult(picked.blockPos, -1);
					picked = mapped.deleted ? null : { ...picked, blockPos: mapped.pos };
				}
				if (picked !== value.picked) changed = true;

				let linking = value.linking;
				if (meta && "linking" in meta) linking = meta.linking;
				else if (linking && tr.docChanged) {
					if (linking.kind === "text") {
						const from = tr.mapping.map(linking.from, 1);
						const to = tr.mapping.map(linking.to, -1);
						linking = to > from ? { ...linking, from, to } : null;
					} else {
						const mapped = tr.mapping.mapResult(linking.blockPos, -1);
						linking = mapped.deleted ? null : { ...linking, blockPos: mapped.pos };
					}
				}
				if (linking !== value.linking) changed = true;

				const hoverRef = meta && "hoverRef" in meta ? meta.hoverRef : value.hoverRef;
				if (hoverRef !== value.hoverRef) changed = true;
				// Open the fold when the cursor enters a folded, hidden place (arrow keys, undo, etc.).
				const { $head, head } = newState.selection;
				for (let depth = $head.depth; depth > 0; depth -= 1) {
					const node = $head.node(depth);
					if (node.type.name !== "codeBlock") continue;
					for (const region of foldRegions(node, $head.before(depth), overrides)) {
						if (region.open || !hidesPosition(region, head)) continue;
						if (!changed) overrides = new Map(overrides);
						overrides.set(region.key, true);
						changed = true;
					}
					break;
				}
				return changed ? { overrides, picked, linking, hoverRef, version: value.version + 1 } : value;
			},
		},
		props: {
			decorations(state) {
				const plugin = codeEffectsKey.getState(state);
				const overrides = plugin?.overrides ?? new Map<string, boolean>();
				const decorations: Decoration[] = [];
				const anchors = anchorIds(state.doc);
				state.doc.descendants((node, pos) => {
					if (node.type.name === "codeBlock") {
						decorations.push(...blockDecorations(t, node, pos, overrides));
						if (plugin?.hoverRef) decorations.push(...hoverDecorations(node, pos, plugin.hoverRef));
						return false;
					}
					// A body link with no linked line is flagged with a red wavy underline.
					const ref = node.isText && anchor ? node.marks.find((mark) => mark.type.name === anchor.mark) : undefined;
					if (ref && anchor && !anchors.has(String(ref.attrs[anchor.attribute])))
						decorations.push(
							Decoration.inline(pos, pos + node.nodeSize, {
								class: "decoration-wavy decoration-red-500",
								title: t("anchor.missing"),
							}),
						);
					return true;
				});
				// While linking (body text picked first), paint the picked text.
				if (plugin?.linking?.kind === "text")
					decorations.push(
						Decoration.inline(plugin.linking.from, plugin.linking.to, { class: "rounded-sm bg-cms-primary/15" }),
					);
				return decorations.length ? DecorationSet.create(state.doc, decorations) : DecorationSet.empty;
			},
			handleKeyDown(view, event) {
				if (event.key !== "Escape" || !codeEffectsKey.getState(view.state)?.linking) return false;
				view.dispatch(view.state.tr.setMeta(codeEffectsKey, effectsMeta({ linking: null })));
				return true;
			},
			handleDOMEvents: {
				// Hovering a body link highlights the linked code line (same as the public page).
				mouseover(view, event) {
					const target = event.target instanceof Element ? event.target.closest("[data-code-ref]") : null;
					const id = target?.getAttribute("data-code-ref") || null;
					if (id !== (codeEffectsKey.getState(view.state)?.hoverRef ?? null))
						view.dispatch(view.state.tr.setMeta(codeEffectsKey, effectsMeta({ hoverRef: id })));
					return false;
				},
				mouseleave(view) {
					if (codeEffectsKey.getState(view.state)?.hoverRef)
						view.dispatch(view.state.tr.setMeta(codeEffectsKey, effectsMeta({ hoverRef: null })));
					return false;
				},
			},
		},
		appendTransaction(transactions, oldState, newState) {
			if (!transactions.some((tr) => tr.docChanged)) return null;
			const mapping = new Mapping();
			for (const tr of transactions) mapping.appendMapping(tr.mapping);

			let update: Transaction | null = null;
			oldState.doc.descendants((oldNode, oldPos) => {
				if (oldNode.type.name !== "codeBlock") return true;
				if (!lineEffectsOf(oldNode).length && !rulesOf(oldNode).some((rule) => rule.scope === "char")) return false;
				const mapped = mapping.mapResult(oldPos, 1);
				if (mapped.deleted) return false;
				const newNode = newState.doc.nodeAt(mapped.pos);
				if (!newNode || newNode.type.name !== "codeBlock" || newNode.textContent === oldNode.textContent) return false;
				// If attributes were newly set in the same transaction (block replacement, effect edit), those attributes are authoritative.
				if (
					!sameJson(newNode.attrs.lineEffects, oldNode.attrs.lineEffects) ||
					!sameJson(newNode.attrs.rules, oldNode.attrs.rules)
				)
					return false;
				const next = remapLineEffects(oldNode, oldPos, newNode, mapped.pos, mapping);
				if (sameJson(next.lineEffects, newNode.attrs.lineEffects) && sameJson(next.rules, newNode.attrs.rules))
					return false;
				update ??= newState.tr;
				update.setNodeMarkup(mapped.pos, undefined, { ...newNode.attrs, ...next });
				return false;
			});
			return update;
		},
	});
}
