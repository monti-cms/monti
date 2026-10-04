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
import { createTranslator } from "@monti-cms/core/client";
import type { Editor } from "@tiptap/core";
import { MessageSquareMore, Pencil, X } from "lucide-react";
import type { ReactNode } from "react";
import { keywordList } from "../shared/text";
import { tooltipBlock } from "./definition";
import { tooltipMessages } from "./messages";

const t = createTranslator(tooltipMessages);

/** Editor mark name (`cmsTooltip`). */
export const TOOLTIP_MARK = addedMarkName(tooltipBlock.name);
/** Window event the slash menu uses to open the format tool's tooltip input. */
export const OPEN_TOOLTIP_EVENT = "cms:open-tooltip";

const LABELS: MarkTextLabels = { name: t("label"), field: t("content.label"), empty: t("field.empty") };
const ICON_CLASS = "size-4";

function TooltipToolbarButton({ editor }: { editor: Editor }) {
	return (
		<MarkTextPopover
			editor={editor}
			mark={TOOLTIP_MARK}
			attribute="content"
			labels={LABELS}
			icon={<MessageSquareMore className={ICON_CLASS} aria-hidden />}
			openEvent={OPEN_TOOLTIP_EVENT}
		/>
	);
}

/** Expands in the bubble an input that edits the tooltip at the edited `range` if there is one, or the current selection otherwise. */
const openForm = (
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
				labels={LABELS}
				active={form.active}
				initial={form.initial}
				range={form.range}
				onDone={closePanel}
			/>
		),
	});

function TooltipBubbleButton(props: EditorBubbleProps) {
	const { editor } = props;
	// Tooltips on text inside a code block are provided separately by the core code block.
	if (!allowsMark(editor.state, TOOLTIP_MARK)) return null;
	const active = editor.isActive(TOOLTIP_MARK);
	return (
		<BubbleButton
			label={active ? t("edit") : t("add")}
			onClick={() => openForm(props, { active, initial: String(editor.getAttributes(TOOLTIP_MARK).content ?? "") })}
		>
			<MessageSquareMore aria-hidden className={ICON_CLASS} />
		</BubbleButton>
	);
}

function TooltipDetail(props: EditorMarkDetailProps) {
	const { editor, mark, act } = props;
	const content = String(mark.attrs.content ?? "");
	return (
		<>
			<MessageSquareMore aria-hidden className="mx-1 size-4 shrink-0 text-cms-muted-foreground" />
			<span className="max-w-48 truncate px-1 text-cms-muted-foreground text-xs" title={content}>
				{content}
			</span>
			<BubbleButton label={t("edit")} onClick={() => openForm(props, { active: true, initial: content, range: mark })}>
				<Pencil aria-hidden className={ICON_CLASS} />
			</BubbleButton>
			<BubbleButton label={t("remove")} onClick={act(() => removeInlineMark(editor, mark))}>
				<X aria-hidden className={ICON_CLASS} />
			</BubbleButton>
		</>
	);
}

/** Editor registration of the tooltip mark. Shown with a dotted underline, and text typed right after the end of a tooltip becomes part of it. */
export const tooltipMarkExtension: EditorMarkExtension = {
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
};

const components: CmsAdminComponents = { marks: { [tooltipBlock.name]: tooltipMarkExtension } };

/** Registers the tooltip mark's editor display, format tool, bubble, and slash menu in the admin UI. */
export function TooltipProvider({ children }: { children: ReactNode }) {
	return <CmsAdminComponentsProvider components={components}>{children}</CmsAdminComponentsProvider>;
}
