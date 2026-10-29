"use client";

import { ChatOperational, Close, Edit } from "@carbon/icons-react";
import { type AdminComponents, type Site, type Translator, useTranslator } from "@monti-cms/admin";
import {
	addedMarkName,
	allowsMark,
	BubbleButton,
	type EditorBubbleProps,
	type EditorMarkDetailProps,
	type EditorMarkExtension,
	MarkTextForm,
	type MarkTextLabels,
	removeInlineMark,
	runFormatItem,
} from "@monti-cms/admin/editor";
import { Box, Icon, Text } from "@monti-cms/admin/kit";
import { keywordList } from "../shared/text";
import { tooltipBlock } from "./definition";
import { tooltipMessages } from "./messages";

/** Picks a tooltip message (`useTranslator(tooltipMessages)`). */
type TooltipText = Translator<keyof (typeof tooltipMessages)["messages"]["en"]>;

/** Editor mark name (`cmsTooltip`). */
export const TOOLTIP_MARK = addedMarkName(tooltipBlock.name);
/** Name of the tooltip's row under the ⋯ of the format card; the slash menu item runs it by this name (`runFormatItem`). */
export const TOOLTIP_FORMAT = "tooltip";

const labelsOf = (t: TooltipText): MarkTextLabels => ({
	name: t("label"),
	field: t("content.label"),
	empty: t("field.empty"),
});

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

function TooltipDetail(props: EditorMarkDetailProps) {
	const t = useTranslator(tooltipMessages);
	const { editor, mark, act } = props;
	const content = String(mark.attrs.content ?? "");
	return (
		<>
			<Box as="span" paddingX={4} shrink={false}>
				<Icon icon={ChatOperational} size="sm" tone="muted" />
			</Box>
			<Box paddingX={4} maxWidth="menu">
				<Text as="div" variant="caption" tone="muted" truncate title={content}>
					{content}
				</Text>
			</Box>
			<BubbleButton
				label={t("edit")}
				onClick={() => openForm(t, props, { active: true, initial: content, range: mark })}
			>
				<Edit aria-hidden />
			</BubbleButton>
			<BubbleButton label={t("remove")} onClick={act(() => removeInlineMark(editor, mark))}>
				<Close aria-hidden />
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
	formatItems: [
		{
			id: TOOLTIP_FORMAT,
			label: (editor) => (editor.isActive(TOOLTIP_MARK) ? t("edit") : t("add")),
			icon: ChatOperational,
			// Tooltips on text inside a code block are provided separately by the core code block.
			isAvailable: ({ editor }) => allowsMark(editor.state, TOOLTIP_MARK),
			isActive: (editor) => editor.isActive(TOOLTIP_MARK),
			run: (props) => {
				const active = props.editor.isActive(TOOLTIP_MARK);
				openForm(t, props, { active, initial: String(props.editor.getAttributes(TOOLTIP_MARK).content ?? "") });
			},
		},
	],
	detail: TooltipDetail,
	insertActions: [
		{
			id: "tooltip",
			title: t("insert.title"),
			description: t("insert.description"),
			icon: ChatOperational,
			keywords: ["tooltip", ...keywordList(t("insert.keywords"))],
			run: (editor, range) => {
				// The slash command is typed in an empty paragraph, so there is no selection. Select the sample label and open the tooltip's input on it.
				const sample = t("insert.text");
				editor.chain().focus().deleteRange(range).insertContent(sample).run();
				const to = editor.state.selection.from;
				editor.commands.setTextSelection({ from: to - sample.length, to });
				runFormatItem(TOOLTIP_FORMAT);
			},
		},
	],
});

/** The tooltip mark's editor display, format row, bubble content and slash menu, in the admin language of the site. */
export const tooltipComponents = (site: Site): AdminComponents => ({
	marks: { [tooltipBlock.name]: tooltipMarkExtension(site.createTranslator(tooltipMessages)) },
});
