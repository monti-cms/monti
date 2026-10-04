import { ANCHOR, type CodeLineEffect, newEffectId } from "@monti-cms/core/code-block";
import type { MarkType, Node as PmNode } from "@tiptap/pm/model";
import { TextSelection, type Transaction } from "@tiptap/pm/state";
import type { EditorView } from "@tiptap/pm/view";
import { CODE_ANCHOR_REF } from "../added-marks";
import { codeEffectsKey, effectsMeta, type LinkDraft, lineEffectsOf } from "./effects-plugin";

/**
 * 본문–코드 잇기(v2). 본문 글자에 코드 줄을 가리키는 꾸밈(`CODE_ANCHOR_REF`, 예: 블록 확장의 `:code-ref[글자]{to}`)을,
 * 코드 블록 줄에 이름표(`anchor` 줄 효과, `attrs.id`)를 단다. 한쪽을 먼저 고르면 잇기 중이 되고(`linking`),
 * 다른 쪽을 고른 뒤 확인하면 둘을 잇는다. 그 꾸밈이 없는 사이트에서는 아무것도 하지 않는다.
 */

/** 본문 연결 마크와 이름표 속성. */
const anchorMark = (state: { schema: { marks: Record<string, MarkType> } }) =>
	CODE_ANCHOR_REF ? state.schema.marks[CODE_ANCHOR_REF.mark] : undefined;

export interface AnchorInfo {
	id: string;
	blockPos: number;
	start: number;
	end: number;
	title: string;
}

/** 이름표 `id`가 있는 코드 줄. */
export function findAnchor(doc: PmNode, id: string): AnchorInfo | null {
	let found: AnchorInfo | null = null;
	doc.descendants((node, pos) => {
		if (found) return false;
		if (node.type.name !== "codeBlock") return true;
		const effect = lineEffectsOf(node).find((item) => item.name === ANCHOR && item.attrs.id === id);
		if (effect) {
			// 큰따옴표는 \x22로 쓴다(글자 검사기가 정규식 속 홀수 개 따옴표를 문자열 시작으로 읽는다).
			const title = /title=(?:\x22([^\x22]*)\x22|(\S+))/.exec(String(node.attrs.meta ?? ""));
			found = { id, blockPos: pos, start: effect.start, end: effect.end, title: title?.[1] ?? title?.[2] ?? "" };
		}
		return false;
	});
	return found;
}

/** 본문 연결이 가리키는 이름표들. */
function referencedIds(doc: PmNode): Set<string> {
	const ids = new Set<string>();
	doc.descendants((node) => {
		for (const mark of node.marks) {
			if (CODE_ANCHOR_REF && mark.type.name === CODE_ANCHOR_REF.mark)
				ids.add(String(mark.attrs[CODE_ANCHOR_REF.attribute]));
		}
		return true;
	});
	return ids;
}

/** 아직 쓰지 않은 이름(`c1`, `c2`, …). 이름표와 본문 연결 양쪽에서 쓰는 이름을 모두 피한다. */
function nextAnchorId(doc: PmNode): string {
	const used = referencedIds(doc);
	doc.descendants((node) => {
		if (node.type.name !== "codeBlock") return true;
		for (const effect of lineEffectsOf(node)) if (effect.name === ANCHOR) used.add(String(effect.attrs.id));
		return false;
	});
	let index = 1;
	while (used.has(`c${index}`)) index += 1;
	return `c${index}`;
}

/** 어떤 본문 연결도 가리키지 않는 이름표를 지운다(연결을 끊거나 다시 이었을 때). */
function pruneOrphanAnchors(tr: Transaction) {
	const referenced = referencedIds(tr.doc);
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

/** 본문 글자(from~to)를 먼저 골라 잇기를 시작한다. 다음으로 코드 줄을 줄 번호 칸에서 고른다. */
export const startLinkFromText = (view: EditorView, from: number, to: number) =>
	setLinking(view, { kind: "text", from, to });

/** 코드 줄을 먼저 골라 잇기를 시작한다. 다음으로 본문 글자를 드래그해 고른다. */
export const startLinkFromLines = (view: EditorView, blockPos: number, start: number, end: number) =>
	setLinking(view, { kind: "lines", blockPos, start, end });

export const cancelLink = (view: EditorView) => setLinking(view, null);

/** 본문 쪽 범위. 먼저 고른 글자, 아니면 지금 고른 글자(코드 블록 밖, 비어 있지 않은 선택). */
export function linkTextRange(view: EditorView): { from: number; to: number } | null {
	const linking = codeEffectsKey.getState(view.state)?.linking;
	if (linking?.kind === "text") return linking;
	const { selection } = view.state;
	if (!(selection instanceof TextSelection) || selection.empty) return null;
	if (selection.$from.parent.type.spec.code || selection.$to.parent.type.spec.code) return null;
	if (!view.state.doc.textBetween(selection.from, selection.to, " ").trim()) return null;
	return { from: selection.from, to: selection.to };
}

/** 코드 쪽 줄. 먼저 고른 줄, 아니면 줄 번호 칸에서 지금 고른 줄. */
export function linkLines(view: EditorView): { blockPos: number; start: number; end: number } | null {
	const state = codeEffectsKey.getState(view.state);
	if (state?.linking?.kind === "lines") return state.linking;
	return state?.picked ?? null;
}

/** 고른 본문 글자와 코드 줄을 잇는다. 같은 줄 이름표가 있으면 다시 쓴다. */
export function commitLink(view: EditorView): boolean {
	const text = linkTextRange(view);
	const lines = linkLines(view);
	const markType = anchorMark(view.state);
	const block = lines ? view.state.doc.nodeAt(lines.blockPos) : null;
	if (!text || !lines || !markType || !CODE_ANCHOR_REF || !block || block.type.name !== "codeBlock") return false;

	const tr = view.state.tr;
	const effects = lineEffectsOf(block);
	const existing = effects.find(
		(effect) => effect.name === ANCHOR && effect.start === lines.start && effect.end === lines.end,
	);
	const id = existing ? String(existing.attrs.id) : nextAnchorId(view.state.doc);
	if (!existing)
		tr.setNodeMarkup(lines.blockPos, undefined, {
			...block.attrs,
			lineEffects: [
				...effects,
				{ id: newEffectId(), name: ANCHOR, start: lines.start, end: lines.end, attrs: { id } } satisfies CodeLineEffect,
			],
		});
	tr.addMark(text.from, text.to, markType.create({ [CODE_ANCHOR_REF.attribute]: id }));
	pruneOrphanAnchors(tr);
	tr.setSelection(TextSelection.create(tr.doc, text.to));
	tr.setMeta(codeEffectsKey, effectsMeta({ linking: null }));
	view.dispatch(tr.scrollIntoView());
	view.focus();
	return true;
}

/** 본문 연결(from~to)을 끊는다. 더는 가리키는 연결이 없는 줄 이름표도 지운다. */
export function unlinkRef(view: EditorView, from: number, to: number) {
	const markType = anchorMark(view.state);
	if (!markType) return;
	const tr = view.state.tr.removeMark(from, to, markType);
	pruneOrphanAnchors(tr);
	view.dispatch(tr);
}
