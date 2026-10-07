"use client";

import { type CmsAdminComponents, CmsAdminComponentsProvider } from "@monti-cms/admin";
import {
	addedMarkName,
	allowsMark,
	BubbleButton,
	type EditorBubbleProps,
	type EditorMarkDetailProps,
	type EditorMarkExtension,
	MarkTextForm,
	type MarkTextLabels,
	MarkTextPopover,
	removeInlineMark,
} from "@monti-cms/admin/editor";
import { type Translator, useTranslator } from "@monti-cms/core/client";
import type { Editor } from "@tiptap/core";
import { MessageSquareMore, Pencil, X } from "lucide-react";
import { type ReactNode, useMemo } from "react";
import { keywordList } from "../shared/text";
import { tooltipBlock } from "./definition";
import { tooltipMessages } from "./messages";

/** Picks a tooltip message (`useTranslator(tooltipMessages)`). */
type TooltipText = Translator<keyof (typeof tooltipMessages)["messages"]["en"]>;

/** Editor mark name (`cmsTooltip`). */
export const TOOLTIP_MARK = addedMarkName(tooltipBlock.name);
/** Window event the slash menu uses to open the format tool's tooltip input. */
export const OPEN_TOOLTIP_EVENT = "cms:open-tooltip";

const labelsOf = (t: TooltipText): MarkTextLabels => ({
	name: t("label"),
	field: t("content.label"),
	empty: t("field.empty"),
});
const ICON_CLASS = "size-4";

function TooltipToolbarButton({ editor }: { editor: Editor }) {
	const t = useTranslator(tooltipMessages);
	return (
		<MarkTextPopover
			editor={editor}
			mark={TOOLTIP_MARK}
			attribute="content"
			labels={labelsOf(t)}
			icon={<MessageSquareMore className={ICON_CLASS} aria-hidden />}
			openEvent={OPEN_TOOLTIP_EVENT}
		/>
	);
}

/** Expands in the bubble an input that edits the tooltip at the edited `range` if there is one, or the current selection otherwise. */
const openForm = (
	t: TooltipText,
	{ editor, openPanel, closePanel }: EditorBubbleProps,
	form: { active: boolean; initial: string; range?: { from: number; to: number } },
) =>
	openPanel({
		label: t("panel.label"),
		content: (
			<MarkTextForm
				editor={editor}
				mark={TOOLTIP_MARK}
				attribute="content"
				labels={labelsOf(t)}
				active={form.active}
				initial={form.initial}
				range={form.range}
				onDone={closePanel}
			/>
		),
	});

function TooltipBubbleButton(props: EditorBubbleProps) {
	const t = useTranslator(tooltipMessages);
	const { editor } = props;
	// Tooltips on text inside a code block are provided separately by the core code block.
	if (!allowsMark(editor.state, TOOLTIP_MARK)) return null;
	const active = editor.isActive(TOOLTIP_MARK);
	return (
		<BubbleButton
			label={active ? t("edit") : t("add")}
			onClick={() => openForm(t, props, { active, initial: String(editor.getAttributes(TOOLTIP_MARK).content ?? "") })}
		>
			<MessageSquareMore aria-hidden className={ICON_CLASS} />
		</BubbleButton>
	);
}

function TooltipDetail(props: EditorMarkDetailProps) {
	const t = useTranslator(tooltipMessages);
	const { editor, mark, act } = props;
	const content = String(mark.attrs.content ?? "");
	return (
		<>
			<MessageSquareMore aria-hidden className="mx-1 size-4 shrink-0 text-cms-muted-foreground" />
			<span className="max-w-48 truncate px-1 text-cms-muted-foreground text-xs" title={content}>
				{content}
			</span>
			<BubbleButton
				label={t("edit")}
				onClick={() => openForm(t, props, { active: true, initial: content, range: mark })}
			>
				<Pencil aria-hidden className={ICON_CLASS} />
			</BubbleButton>
			<BubbleButton label={t("remove")} onClick={act(() => removeInlineMark(editor, mark))}>
				<X aria-hidden className={ICON_CLASS} />
			</BubbleButton>
		</>
	);
}

/**
 * Editor registration of the tooltip mark in the admin language `t` picks (the slash menu item is text, not a component). Shown with a dotted underline,
 * and text typed right after the end of a tooltip becomes part of it.
 */
export const tooltipMarkExtension = (t: TooltipText): EditorMarkExtension => ({
	inclusive: true,
	render: () => ({ class: "underline decoration-dotted underline-offset-4" }),
	toolbar: { group: "link", Button: TooltipToolbarButton },
	bubble: { group: "link", order: -1, Button: TooltipBubbleButton },
	detail: TooltipDetail,
	insertActions: [
		{
			id: "tooltip",
			title: t("insert.title"),
			description: t("insert.description"),
			icon: MessageSquareMore,
			keywords: ["tooltip", ...keywordList(t("insert.keywords"))],
			run: (editor, range) => {
				// The slash command is typed in an empty paragraph, so there is no selection. Select the sample label to start editing and entering the description.
				const sample = t("insert.text");
				editor.chain().focus().deleteRange(range).insertContent(sample).run();
				const to = editor.state.selection.from;
				editor.commands.setTextSelection({ from: to - sample.length, to });
				window.dispatchEvent(new CustomEvent(OPEN_TOOLTIP_EVENT));
			},
		},
	],
});

/** Registers the tooltip mark's editor display, format tool, bubble, and slash menu in the admin UI. */
export function TooltipProvider({ children }: { children: ReactNode }) {
	const t = useTranslator(tooltipMessages);
	const components = useMemo<CmsAdminComponents>(
		() => ({ marks: { [tooltipBlock.name]: tooltipMarkExtension(t) } }),
		[t],
	);
	return <CmsAdminComponentsProvider components={components}>{children}</CmsAdminComponentsProvider>;
}
