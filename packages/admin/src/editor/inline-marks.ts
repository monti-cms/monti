import { createTranslator } from "@monti-cms/core/client";
import { type CodeRule, ruleMatches } from "@monti-cms/core/code-block";
import type { Editor } from "@tiptap/core";
import type { Mark, ResolvedPos } from "@tiptap/pm/model";
import { type EditorState, TextSelection } from "@tiptap/pm/state";
import { Bold, CodeXml, Italic, Strikethrough, Subscript, Superscript, Underline } from "lucide-react";
import { CODE_TOOLTIP_MARK_NAME } from "./code-block/code-tooltip-mark";
import { codeEffectsKey, rulesOf } from "./code-block/effects-plugin";
import { selectedBlocks } from "./drag";
import { editorMessages } from "./messages";
import type { ToolbarItem } from "./toolbar-button";

const t = createTranslator(editorMessages);

export interface InlineMarkTool extends ToolbarItem {
	/** 이 도구가 켜고 끄는 마크 이름. */
	mark: string;
}

const chain = (editor: Editor) => editor.chain().focus();

/** 켜고 끄기만 하는 인라인 효과. 상단 서식 도구와 인라인 버블이 함께 쓴다. */
const MARK_TOOLS: Omit<InlineMarkTool, "isActive">[] = [
	{ mark: "bold", label: "B", title: t("inlineMarks.bold"), icon: Bold, run: (e) => chain(e).toggleBold().run() },
	{
		mark: "italic",
		label: "i",
		title: t("inlineMarks.italic"),
		icon: Italic,
		run: (e) => chain(e).toggleItalic().run(),
	},
	{
		mark: "underline",
		label: "U",
		title: t("inlineMarks.underline"),
		icon: Underline,
		run: (e) => chain(e).toggleUnderline().run(),
	},
	{
		mark: "strike",
		label: "S",
		title: t("inlineMarks.strike"),
		icon: Strikethrough,
		run: (e) => chain(e).toggleStrike().run(),
	},
	{ mark: "code", label: "</>", title: t("inlineMarks.code"), icon: CodeXml, run: (e) => chain(e).toggleCode().run() },
	{
		mark: "superscript",
		label: "x²",
		title: t("inlineMarks.superscript"),
		icon: Superscript,
		run: (e) => chain(e).toggleSuperscript().run(),
	},
	{
		mark: "subscript",
		label: "x₂",
		title: t("inlineMarks.subscript"),
		icon: Subscript,
		run: (e) => chain(e).toggleSubscript().run(),
	},
];

export const INLINE_MARK_TOOLS: InlineMarkTool[] = MARK_TOOLS.map((item) => ({
	...item,
	isActive: (e: Editor) => e.isActive(item.mark),
	// 코드 블록처럼 그 마크를 둘 수 없는 곳에서는 끈다.
	isDisabled: (e: Editor) => !e.can().toggleMark(item.mark),
}));

/** 선택이 들어 있는 글 블록에 둘 수 있는 인라인 도구. 코드 블록은 굵게·기울임·취소선·밑줄만 된다. */
export const allowedMarkTools = (state: EditorState) => {
	const parent = state.selection.$from.parent;
	return INLINE_MARK_TOOLS.filter((tool) => {
		const type = state.schema.marks[tool.mark];
		return !!type && parent.type.allowsMarkType(type);
	});
};

export const allowsMark = (state: EditorState, mark: string) => {
	const type = state.schema.marks[mark];
	return !!type && state.selection.$from.parent.type.allowsMarkType(type);
};

/**
 * 커서를 두면 버블에 보여 줄 마크 순서. 설정이 있는 마크(링크, 확장의 글자 꾸밈, 코드 안 툴팁·글자 접기)를 먼저 보인다.
 * `detailed`는 글자 꾸밈 확장이 내용을 그리는 마크(`EditorMarkExtension.detail`)다.
 */
export const bubbleMarkOrder = (detailed: readonly string[] = []) => [
	"link",
	...detailed,
	CODE_TOOLTIP_MARK_NAME,
	"codeFold",
	...INLINE_MARK_TOOLS.map((tool) => tool.mark),
];

/** 설정이 있어 범위에 버블을 붙이는 마크(링크·코드 안 툴팁). 확장의 글자 꾸밈 내용도 같다. */
export const RANGED_MARKS: readonly string[] = ["link", CODE_TOOLTIP_MARK_NAME];

/** 커서가 걸친 마크 하나와 그 마크가 이어지는 범위. */
export interface ActiveInlineMark {
	name: string;
	from: number;
	to: number;
	attrs: Record<string, unknown>;
}

/** 커서가 걸친 정규식 규칙의 찾은 곳 하나(코드 블록). 규칙이라 이 곳만 따로 지울 수는 없다. */
export interface ActiveCodeRule {
	rule: CodeRule;
	blockPos: number;
	from: number;
	to: number;
	count: number;
}

export type InlineBubbleTarget =
	| { kind: "selection"; from: number; to: number }
	| { kind: "marks"; pos: number; marks: ActiveInlineMark[]; rules: ActiveCodeRule[] };

/** `$pos` 바로 앞(before) 또는 뒤(after) 글자에서 시작해 같은 마크가 이어지는 범위. */
function markRange($pos: ResolvedPos, mark: Mark, side: "before" | "after"): { from: number; to: number } {
	const parent = $pos.parent;
	const index = side === "after" || $pos.textOffset > 0 ? $pos.index() : $pos.index() - 1;
	let first = index;
	let last = index;
	while (first > 0 && mark.isInSet(parent.child(first - 1).marks)) first -= 1;
	while (last < parent.childCount - 1 && mark.isInSet(parent.child(last + 1).marks)) last += 1;
	let from = $pos.start();
	for (let i = 0; i < first; i += 1) from += parent.child(i).nodeSize;
	let to = from;
	for (let i = first; i <= last; i += 1) to += parent.child(i).nodeSize;
	return { from, to };
}

/**
 * 인라인 버블을 띄울 대상.
 * - 글자를 고르면(`selection`) 효과를 적용하는 도구를 띄운다.
 * - 커서가 효과 안이나 끝에 있으면(`marks`) 걸친 효과와 그 범위를 돌려준다(삭제·설정 수정용).
 * 블록(마키) 선택, 셀 선택, 노드 선택, 코드 블록을 넘나드는 선택, 원문 편집 중인 코드 블록에는 띄우지 않는다.
 */
export function inlineBubbleTarget(state: EditorState, detailed: readonly string[] = []): InlineBubbleTarget | null {
	const order = bubbleMarkOrder(detailed);
	const { selection } = state;
	if (!(selection instanceof TextSelection) || selectedBlocks(state)) return null;
	// 코드 블록 줄 번호 칸에서 줄을 골랐거나 본문–코드 잇기 중이면 버블을 띄우지 않는다(메뉴·안내 줄을 쓴다).
	const effects = codeEffectsKey.getState(state);
	if (effects?.picked || effects?.linking) return null;
	const { $from, $to, from, to } = selection;
	const code = $from.parent.type.spec.code || $to.parent.type.spec.code;
	if (code && ($from.parent !== $to.parent || $from.parent.attrs.rawMode === true)) return null;
	if (!selection.empty) return state.doc.textBetween(from, to, " ").trim() ? { kind: "selection", from, to } : null;

	const marks: ActiveInlineMark[] = [];
	for (const side of ["after", "before"] as const) {
		const node = side === "after" ? $from.nodeAfter : $from.nodeBefore;
		for (const mark of node?.marks ?? []) {
			if (!order.includes(mark.type.name) || marks.some((item) => item.name === mark.type.name)) continue;
			marks.push({ name: mark.type.name, attrs: mark.attrs, ...markRange($from, mark, side) });
		}
	}
	const rules = code ? rulesAt($from) : [];
	if (!marks.length && !rules.length) return null;
	marks.sort((a, b) => order.indexOf(a.name) - order.indexOf(b.name));
	return { kind: "marks", pos: from, marks, rules };
}

/** 코드 블록 안 커서(`$pos`)에 걸친 정규식 규칙의 찾은 곳. */
function rulesAt($pos: ResolvedPos): ActiveCodeRule[] {
	const block = $pos.parent;
	const text = block.textContent;
	const offset = $pos.parentOffset;
	const blockPos = $pos.before();
	return rulesOf(block).flatMap((rule) => {
		const matches = ruleMatches(rule, text);
		const hit = matches.find((match) => match.from <= offset && offset <= match.to);
		return hit
			? [{ rule, blockPos, from: blockPos + 1 + hit.from, to: blockPos + 1 + hit.to, count: matches.length }]
			: [];
	});
}

/** 효과 하나를 그 범위 전체에서 지운다. 커서는 그 자리에 둔다. */
export function removeInlineMark(editor: Editor, mark: ActiveInlineMark): boolean {
	const type = editor.schema.marks[mark.name];
	if (!type) return false;
	return editor
		.chain()
		.focus()
		.command(({ tr }) => {
			tr.removeMark(mark.from, mark.to, type);
			return true;
		})
		.run();
}
