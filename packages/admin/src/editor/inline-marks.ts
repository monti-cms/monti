import type { Site } from "@monti-cms/core/client";
import { type CodeRule, ruleMatches } from "@monti-cms/core/code-block";
import type { Editor } from "@tiptap/core";
import type { Mark, ResolvedPos } from "@tiptap/pm/model";
import { type EditorState, TextSelection } from "@tiptap/pm/state";
import { Bold, CodeXml, Italic, Strikethrough, Subscript, Superscript, Underline } from "lucide-react";
import type { TranslatorFor } from "../translator";
import { allowanceOfState } from "./allowed-extension";
import { CODE_TOOLTIP_MARK_NAME } from "./code-block/code-tooltip-mark";
import { codeEffectsKey, rulesOf } from "./code-block/effects-plugin";
import { selectedBlocks } from "./drag";
import { editorMessages } from "./messages";
import type { ToolbarItem } from "./toolbar-button";

/** Names of the marks of the inline tools, in the order the tools are shown. */
export const INLINE_MARK_NAMES = ["bold", "italic", "underline", "strike", "code", "superscript", "subscript"] as const;

export interface InlineMarkTool extends ToolbarItem {
	/** Name of the mark this tool toggles. */
	mark: string;
}

const chain = (editor: Editor) => editor.chain().focus();

/** Inline effects that only toggle on and off. Shared by the top formatting tools and the inline bubble. */
const markTools = (t: TranslatorFor<typeof editorMessages>): Omit<InlineMarkTool, "isActive">[] => [
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

/** Marks inside code that the site's `codeBlock.features` switches off as a group or one by one (`textStyles`, `tooltip`, `fold`). */
const codeMarkFeatures = (site: Site): Record<string, () => boolean> => ({
	bold: () => site.CODE_BLOCK_FEATURES.textStyles,
	italic: () => site.CODE_BLOCK_FEATURES.textStyles,
	strike: () => site.CODE_BLOCK_FEATURES.textStyles,
	underline: () => site.CODE_BLOCK_FEATURES.textStyles,
	[CODE_TOOLTIP_MARK_NAME]: () => site.CODE_BLOCK_FEATURES.tooltip,
	codeFold: () => site.CODE_BLOCK_FEATURES.fold,
});

/** Whether the mark is on the selection (all of a range, or at the cursor). */
const markOnSelection = (state: EditorState, mark: string) => {
	const type = state.schema.marks[mark];
	if (!type) return false;
	const { empty, $from, from, to } = state.selection;
	return empty ? !!type.isInSet(state.storedMarks ?? $from.marks()) : state.doc.rangeHasMark(from, to, type);
};

/**
 * Whether the editor offers the tool for this mark at the selection. The marks the body's allowed list does not allow are hidden, and so are the code block
 * tools that the site turned off (`codeBlock.features`), only inside code. A mark already on the selection stays offered so it can be removed.
 */
export const offersMarkTool = (site: Site, state: EditorState, mark: string) => {
	// The body's allowed list: a mark it does not allow is not offered, unless it is already on the selection (so it can be removed).
	if (!allowanceOfState(state).allowsEditorMark(mark) && !markOnSelection(state, mark)) return false;
	if (!state.selection.$from.parent.type.spec.code) return true;
	return codeMarkFeatures(site)[mark]?.() !== false || markOnSelection(state, mark);
};

/** The inline tools of a site (their text follows the site's admin language, and which of them work in code follows `codeBlock.features`). */
export const inlineMarkTools = (site: Site): InlineMarkTool[] =>
	markTools(site.createTranslator(editorMessages)).map((item) => ({
		...item,
		isActive: (e: Editor) => e.isActive(item.mark),
		// Turned off where the mark cannot be placed, such as in a code block (and where the site turned the tool off).
		isDisabled: (e: Editor) => !e.can().toggleMark(item.mark) || !offersMarkTool(site, e.state, item.mark),
	}));

/** Inline tools available on the text block containing the selection. A code block only gets bold, italic, strikethrough and underline (when the site offers them). */
export const allowedMarkTools = (site: Site, state: EditorState) => {
	const parent = state.selection.$from.parent;
	return inlineMarkTools(site).filter((tool) => {
		const type = state.schema.marks[tool.mark];
		return !!type && parent.type.allowsMarkType(type) && offersMarkTool(site, state, tool.mark);
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
	...INLINE_MARK_NAMES,
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
