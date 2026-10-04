import { createTranslator } from "@monti-cms/core/client";
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
import { CODE_ANCHOR_REF } from "../added-marks";
import { codeBlockMessages } from "./messages";

const t = createTranslator(codeBlockMessages);

/**
 * 코드 블록의 줄 효과·정규식 규칙·접기를 에디터에 보인다(v2 C5 코드 블록 재개발).
 *
 * - 경고·오류 줄은 물결 밑줄, 규칙이 찾은 글자는 그 효과 모양(+옅은 배경)으로 칠한다.
 * - 줄 접기·글자 접기는 공개 화면처럼 실제로 접는다. 처음 모습은 `open` 속성을 따르고, 편집 중 여닫은 상태는
 *   이 플러그인 상태(`overrides`)에만 둔다(저장하지 않는다). 커서가 접힌 곳에 들어가면 저절로 펼친다.
 * - 글자를 고치면 줄 효과와 줄 규칙의 줄 번호를 글자를 따라 옮긴다(appendTransaction).
 * 줄 배경(강조·추가·삭제)과 줄 번호 칸은 NodeView(code-block-view.tsx)가 그린다.
 */
export interface CodeEffectsState {
	/** 접기 열림 상태. `c:<줄 효과 id>`, `m:<문서 위치>`(글자 접기·규칙 접기). */
	overrides: Map<string, boolean>;
	/** 줄 번호 칸에서 고른 줄(코드 블록 위치, [start, end) 줄). 다른 방법으로 선택을 바꾸면 풀린다. */
	picked: LinePick | null;
	/** 본문–코드 잇기 중이면 먼저 고른 쪽(본문 글자 또는 코드 줄). 다른 쪽을 고르고 확인하면 잇는다. */
	linking: LinkDraft | null;
	/** 마우스를 올린 본문 연결(`data-code-ref`, `CODE_ANCHOR_REF`)의 줄 이름. 그 줄을 강조하고 나머지를 흐린다. */
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

/** 플러그인 상태를 바꾸는 트랜잭션 메타(잇기 명령이 쓴다). */
export const effectsMeta = (meta: EffectsMeta) => meta;

export const codeEffectsKey = new PluginKey<CodeEffectsState>("cmsCodeEffects");

export interface FoldRegion {
	key: string;
	kind: "collapse" | "fold";
	/** 숨길 문서 범위 [from, to). 줄 접기는 첫 줄 끝부터 마지막 줄 끝까지다(첫 줄은 보인다). */
	from: number;
	to: number;
	open: boolean;
	defaultOpen: boolean;
	/** 줄 접기가 숨기는 줄 수. */
	hiddenLines: number;
	startLine?: number;
	endLine?: number;
}

export const lineEffectsOf = (node: PmNode): CodeLineEffect[] =>
	Array.isArray(node.attrs.lineEffects) ? (node.attrs.lineEffects as CodeLineEffect[]) : [];
export const rulesOf = (node: PmNode): CodeRule[] =>
	Array.isArray(node.attrs.rules) ? (node.attrs.rules as CodeRule[]) : [];

/** 글자 접기 마크가 이어지는 범위(코드 텍스트 기준). */
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

/** 코드 블록(문서 위치 `pos`)의 접기 범위들. */
export function foldRegions(node: PmNode, pos: number, overrides: ReadonlyMap<string, boolean>): FoldRegion[] {
	if (node.attrs.rawMode) return [];
	const base = pos + 1;
	const text = node.textContent;
	const starts = lineStarts(text);
	const regions: FoldRegion[] = [];
	// 글자 접기 마크와 규칙이 같은 자리를 접으면 하나로 본다(같은 key).
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
			// 에디터에서는 글자 접기를 펼쳐 둔다(글자를 고칠 수 있게). `open`은 공개 화면의 처음 모습이다.
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

/** 접힌 채 보이는(다른 접힌 범위 안에 들어 있지 않은) 범위들. */
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

/** 커서가 접혀 숨은 글자 안에 있는지. 줄 접기는 숨은 마지막 줄의 끝도 안이다. */
const hidesPosition = (region: FoldRegion, head: number) =>
	region.kind === "collapse" ? region.from < head && head <= region.to : region.from < head && head < region.to;

/**
 * 코드 블록(`blockPos`)의 `start`~`end` 줄을 줄 번호 칸에서 고른 것으로 표시한다.
 * 글자는 고르지 않는다(끌어 고른 것처럼 칠하지 않는다). 커서만 첫 줄 앞에 두고, 고른 줄은 줄 배경으로 보인다.
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

/** 규칙 하나를 지운다(찾은 곳 모두에서 효과가 사라진다). */
export function removeRule(view: EditorView, blockPos: number, ruleId: string) {
	const node = view.state.doc.nodeAt(blockPos);
	if (!node || node.type.name !== "codeBlock") return;
	const rules = rulesOf(node).filter((rule) => rule.id !== ruleId);
	view.dispatch(view.state.tr.setNodeMarkup(blockPos, undefined, { ...node.attrs, rules }));
}

/** 규칙을 지우고, 지금 찾은 곳마다 같은 효과를 글자 마크로 남긴다(하나씩 지울 수 있게). */
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

/** 접기를 여닫는다. 접을 때 커서가 숨을 곳에 있으면 접는 곳 앞으로 옮긴다. */
export function setFoldOpen(view: EditorView, region: FoldRegion, open: boolean) {
	const tr = view.state.tr.setMeta(codeEffectsKey, { key: region.key, open } satisfies EffectsMeta);
	if (!open && hidesPosition(region, view.state.selection.head))
		tr.setSelection(TextSelection.create(tr.doc, region.from));
	view.dispatch(tr);
}

/** 규칙이 찾은 글자의 모양. 규칙에서 온 것임을 옅은 배경으로 알린다(글자를 눌러 고칠 수 없다). */
const RULE_CLASS: Record<string, string> = {
	strong: "font-bold",
	em: "italic",
	del: "line-through",
	u: "underline underline-offset-4",
	Tooltip: "underline decoration-dotted underline-offset-4",
	fold: "rounded-sm outline-1 outline-cms-muted-foreground/50 outline-dashed -outline-offset-1",
};

function foldWidget(region: FoldRegion) {
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

function blockDecorations(node: PmNode, pos: number, overrides: ReadonlyMap<string, boolean>): Decoration[] {
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
		decorations.push(foldWidget(region));
	}
	return decorations;
}

/** 문서의 모든 코드 줄 이름표(`anchor` 줄 효과의 id). */
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

/** 마우스를 올린 본문 연결의 줄이 이 코드 블록에 있으면, 나머지 줄을 흐린다. */
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

/** 옛 줄 번호를 글자 변경을 따라 새 줄 번호로 옮긴다. */
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
			// 효과 줄의 글자를 모두 지웠으면 효과도 지운다(다음 줄로 옮겨 붙이지 않는다).
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

export function createCodeEffectsPlugin(): Plugin<CodeEffectsState> {
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
				// 줄 고르기는 줄 번호 칸이 선택과 함께 알린다. 다른 방법으로 선택을 바꾸면 푼다.
				let picked = value.picked;
				if (meta && "pick" in meta) picked = meta.pick;
				else if (picked && tr.selectionSet) picked = null;
				else if (picked && tr.docChanged) {
					// 블록 앞 위치를 앞쪽에 붙여 옮긴다. 효과를 바꾸면(setNodeMarkup) 블록이 통째로 바뀌어 뒤쪽은 "지워짐"이 된다.
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
				// 커서가 접혀 숨은 곳에 들어가면(방향키·되돌리기 등) 펼친다.
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
						decorations.push(...blockDecorations(node, pos, overrides));
						if (plugin?.hoverRef) decorations.push(...hoverDecorations(node, pos, plugin.hoverRef));
						return false;
					}
					// 연결된 줄이 없는 본문 연결은 빨간 물결 밑줄로 알린다.
					const ref =
						node.isText && CODE_ANCHOR_REF
							? node.marks.find((mark) => mark.type.name === CODE_ANCHOR_REF?.mark)
							: undefined;
					if (ref && CODE_ANCHOR_REF && !anchors.has(String(ref.attrs[CODE_ANCHOR_REF.attribute])))
						decorations.push(
							Decoration.inline(pos, pos + node.nodeSize, {
								class: "decoration-wavy decoration-red-500",
								title: t("anchor.missing"),
							}),
						);
					return true;
				});
				// 잇기 중(본문을 먼저 고름)이면 고른 글자를 칠해 둔다.
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
				// 본문 연결에 마우스를 올리면 연결된 코드 줄을 강조한다(공개 화면과 같다).
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
				// 같은 트랜잭션에서 속성을 새로 넣었으면(블록 교체·효과 편집) 그 속성이 정본이다.
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
