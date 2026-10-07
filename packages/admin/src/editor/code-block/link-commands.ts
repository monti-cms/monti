import type { Site } from "@monti-cms/core/client";
import { ANCHOR, type CodeLineEffect, newEffectId } from "@monti-cms/core/code-block";
import type { MarkType, Node as PmNode } from "@tiptap/pm/model";
import { TextSelection, type Transaction } from "@tiptap/pm/state";
import type { EditorView } from "@tiptap/pm/view";
import { codeAnchorRef } from "../added-marks";
import { codeEffectsKey, effectsMeta, type LinkDraft, lineEffectsOf } from "./effects-plugin";

/**
 * Linking body to code. Attaches a label (`anchor` line effect, `attrs.id`) to a code block line for a decoration on body text that points to a code line (`codeAnchorRef`, e.g. `:code-ref[text]{to}` of a block extension).
 * Picking one side first starts linking (`linking`),
 * and picking the other side then confirming links the two. Sites without that decoration do nothing.
 */

/** Body link mark and label attribute. */
const anchorMark = (site: Site, state: { schema: { marks: Record<string, MarkType> } }) => {
	const anchor = codeAnchorRef(site);
	return anchor ? state.schema.marks[anchor.mark] : undefined;
};

export interface AnchorInfo {
	id: string;
	blockPos: number;
	start: number;
	end: number;
	title: string;
}

/** Code lines that have a label `id`. */
export function findAnchor(doc: PmNode, id: string): AnchorInfo | null {
	let found: AnchorInfo | null = null;
	doc.descendants((node, pos) => {
		if (found) return false;
		if (node.type.name !== "codeBlock") return true;
		const effect = lineEffectsOf(node).find((item) => item.name === ANCHOR && item.attrs.id === id);
		if (effect) {
			// Write a double quote as \x22 (the text checker reads an odd number of quotes inside a regex as the start of a string).
			const title = /title=(?:\x22([^\x22]*)\x22|(\S+))/.exec(String(node.attrs.meta ?? ""));
			found = { id, blockPos: pos, start: effect.start, end: effect.end, title: title?.[1] ?? title?.[2] ?? "" };
		}
		return false;
	});
	return found;
}

/** Labels that body links point to. */
function referencedIds(site: Site, doc: PmNode): Set<string> {
	const anchor = codeAnchorRef(site);
	const ids = new Set<string>();
	doc.descendants((node) => {
		for (const mark of node.marks) {
			if (anchor && mark.type.name === anchor.mark) ids.add(String(mark.attrs[anchor.attribute]));
		}
		return true;
	});
	return ids;
}

/** A name not yet used (`c1`, `c2`, ...). Avoids names used by both labels and body links. */
export function nextAnchorId(site: Site, doc: PmNode): string {
	const used = referencedIds(site, doc);
	doc.descendants((node) => {
		if (node.type.name !== "codeBlock") return true;
		for (const effect of lineEffectsOf(node)) if (effect.name === ANCHOR) used.add(String(effect.attrs.id));
		return false;
	});
	let index = 1;
	while (used.has(`c${index}`)) index += 1;
	return `c${index}`;
}

/** Deletes labels that no body link points to (when a link is removed or re-linked). */
function pruneOrphanAnchors(site: Site, tr: Transaction) {
	const referenced = referencedIds(site, tr.doc);
	const updates: Array<{ pos: number; node: PmNode; lineEffects: CodeLineEffect[] }> = [];
	tr.doc.descendants((node, pos) => {
		if (node.type.name !== "codeBlock") return true;
		const effects = lineEffectsOf(node);
		const kept = effects.filter((effect) => effect.name !== ANCHOR || referenced.has(String(effect.attrs.id)));
		if (kept.length !== effects.length) updates.push({ pos, node, lineEffects: kept });
		return false;
	});
	for (const update of updates)
		tr.setNodeMarkup(update.pos, undefined, { ...update.node.attrs, lineEffects: update.lineEffects });
}

const setLinking = (view: EditorView, linking: LinkDraft | null) =>
	view.dispatch(view.state.tr.setMeta(codeEffectsKey, effectsMeta({ linking })));

/** Starts linking by picking body text (from~to) first. Then pick a code line in the line number column. */
export const startLinkFromText = (view: EditorView, from: number, to: number) =>
	setLinking(view, { kind: "text", from, to });

/** Starts linking by picking a code line first. Then drag to pick body text. */
export const startLinkFromLines = (view: EditorView, blockPos: number, start: number, end: number) =>
	setLinking(view, { kind: "lines", blockPos, start, end });

export const cancelLink = (view: EditorView) => setLinking(view, null);

/** Body-side range. The text picked first, otherwise the currently picked text (outside code blocks, a non-empty selection). */
export function linkTextRange(view: EditorView): { from: number; to: number } | null {
	const linking = codeEffectsKey.getState(view.state)?.linking;
	if (linking?.kind === "text") return linking;
	const { selection } = view.state;
	if (!(selection instanceof TextSelection) || selection.empty) return null;
	if (selection.$from.parent.type.spec.code || selection.$to.parent.type.spec.code) return null;
	if (!view.state.doc.textBetween(selection.from, selection.to, " ").trim()) return null;
	return { from: selection.from, to: selection.to };
}

/** Code-side line. The line picked first, otherwise the line currently picked in the line number column. */
export function linkLines(view: EditorView): { blockPos: number; start: number; end: number } | null {
	const state = codeEffectsKey.getState(view.state);
	if (state?.linking?.kind === "lines") return state.linking;
	return state?.picked ?? null;
}

/** Links the picked body text to the code line. Reuses the label if the same line already has one. */
export function commitLink(site: Site, view: EditorView): boolean {
	const anchor = codeAnchorRef(site);
	const text = linkTextRange(view);
	const lines = linkLines(view);
	const markType = anchorMark(site, view.state);
	const block = lines ? view.state.doc.nodeAt(lines.blockPos) : null;
	if (!text || !lines || !markType || !anchor || !block || block.type.name !== "codeBlock") return false;

	const tr = view.state.tr;
	const effects = lineEffectsOf(block);
	const existing = effects.find(
		(effect) => effect.name === ANCHOR && effect.start === lines.start && effect.end === lines.end,
	);
	const id = existing ? String(existing.attrs.id) : nextAnchorId(site, view.state.doc);
	if (!existing)
		tr.setNodeMarkup(lines.blockPos, undefined, {
			...block.attrs,
			lineEffects: [
				...effects,
				{ id: newEffectId(), name: ANCHOR, start: lines.start, end: lines.end, attrs: { id } } satisfies CodeLineEffect,
			],
		});
	tr.addMark(text.from, text.to, markType.create({ [anchor.attribute]: id }));
	pruneOrphanAnchors(site, tr);
	tr.setSelection(TextSelection.create(tr.doc, text.to));
	tr.setMeta(codeEffectsKey, effectsMeta({ linking: null }));
	view.dispatch(tr.scrollIntoView());
	view.focus();
	return true;
}

/** Removes a body link (from~to). Also removes line labels no link points to anymore. */
export function unlinkRef(site: Site, view: EditorView, from: number, to: number) {
	const markType = anchorMark(site, view.state);
	if (!markType) return;
	const tr = view.state.tr.removeMark(from, to, markType);
	pruneOrphanAnchors(site, tr);
	view.dispatch(tr);
}
