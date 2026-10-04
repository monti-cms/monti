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
	/** Name of the mark this tool toggles. */
	mark: string;
}

const chain = (editor: Editor) => editor.chain().focus();

/** Inline effects that only toggle on and off. Shared by the top formatting tools and the inline bubble. */
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
	// Turned off where the mark cannot be placed, such as in a code block.
	isDisabled: (e: Editor) => !e.can().toggleMark(item.mark),
}));

/** Inline tools available on the text block containing the selection. A code block only gets bold, italic, strikethrough and underline. */
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
 * Order of marks shown in the bubble when the cursor is placed. Marks with settings (links, extension text styles, in-code tooltips and text folds) come first.
 * `detailed` is a mark whose content a text-style extension draws (`EditorMarkExtension.detail`).
 */
export const bubbleMarkOrder = (detailed: readonly string[] = []) => [
	"link",
	...detailed,
	CODE_TOOLTIP_MARK_NAME,
	"codeFold",
	...INLINE_MARK_TOOLS.map((tool) => tool.mark),
];

/** Marks with settings that attach the bubble to a range (links, in-code tooltips). Content of extension text styles is the same. */
export const RANGED_MARKS: readonly string[] = ["link", CODE_TOOLTIP_MARK_NAME];

/** One mark the cursor touches and the range it spans. */
export interface ActiveInlineMark {
	name: string;
	from: number;
	to: number;
	attrs: Record<string, unknown>;
}

/** One match of a regex rule the cursor touches (code block). Being a rule, this single match cannot be removed on its own. */
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

/** Range where the same mark continues, starting from the character just before (before) or after (after) `$pos`. */
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
 * Target for showing the inline bubble.
 * - When text is selected (`selection`), shows the tools that apply effects.
 * - When the cursor is inside or at the end of an effect (`marks`), returns the touched effects and their ranges (for removing and editing settings).
 * Not shown for block (marquee) selection, cell selection, node selection, selection spanning code blocks, or a code block in raw-source editing.
 */
export function inlineBubbleTarget(state: EditorState, detailed: readonly string[] = []): InlineBubbleTarget | null {
	const order = bubbleMarkOrder(detailed);
	const { selection } = state;
	if (!(selection instanceof TextSelection) || selectedBlocks(state)) return null;
	// The bubble is not shown when lines are picked in the code block line number gutter or while linking body text to code (the menu and guide line are used).
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

/** Match of a regex rule that the cursor inside a code block (`$pos`) touches. */
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

/** Removes one effect over its whole range. The cursor stays in place. */
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
