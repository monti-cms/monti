"use client";
import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { CmsAdminComponentsProvider } from "@monti-cms/admin";
import { addedMarkName, allowsMark, BubbleButton, MarkTextForm, MarkTextPopover, removeInlineMark, } from "@monti-cms/admin/editor";
import { useTranslator } from "@monti-cms/core/client";
import { MessageSquareMore, Pencil, X } from "lucide-react";
import { useMemo } from "react";
import { keywordList } from "../shared/text.js";
import { tooltipBlock } from "./definition.js";
import { tooltipMessages } from "./messages.js";
/** Editor mark name (`cmsTooltip`). */
export const TOOLTIP_MARK = addedMarkName(tooltipBlock.name);
/** Window event the slash menu uses to open the format tool's tooltip input. */
export const OPEN_TOOLTIP_EVENT = "cms:open-tooltip";
const labelsOf = (t) => ({
    name: t("label"),
    field: t("content.label"),
    empty: t("field.empty"),
});
const ICON_CLASS = "size-4";
function TooltipToolbarButton({ editor }) {
    const t = useTranslator(tooltipMessages);
    return (_jsx(MarkTextPopover, { editor: editor, mark: TOOLTIP_MARK, attribute: "content", labels: labelsOf(t), icon: _jsx(MessageSquareMore, { className: ICON_CLASS, "aria-hidden": true }), openEvent: OPEN_TOOLTIP_EVENT }));
}
/** Expands in the bubble an input that edits the tooltip at the edited `range` if there is one, or the current selection otherwise. */
const openForm = (t, { editor, openPanel, closePanel }, form) => openPanel({
    label: t("panel.label"),
    content: (_jsx(MarkTextForm, { editor: editor, mark: TOOLTIP_MARK, attribute: "content", labels: labelsOf(t), active: form.active, initial: form.initial, range: form.range, onDone: closePanel })),
});
function TooltipBubbleButton(props) {
    const t = useTranslator(tooltipMessages);
    const { editor } = props;
    // Tooltips on text inside a code block are provided separately by the core code block.
    if (!allowsMark(editor.state, TOOLTIP_MARK))
        return null;
    const active = editor.isActive(TOOLTIP_MARK);
    return (_jsx(BubbleButton, { label: active ? t("edit") : t("add"), onClick: () => openForm(t, props, { active, initial: String(editor.getAttributes(TOOLTIP_MARK).content ?? "") }), children: _jsx(MessageSquareMore, { "aria-hidden": true, className: ICON_CLASS }) }));
}
function TooltipDetail(props) {
    const t = useTranslator(tooltipMessages);
    const { editor, mark, act } = props;
    const content = String(mark.attrs.content ?? "");
    return (_jsxs(_Fragment, { children: [_jsx(MessageSquareMore, { "aria-hidden": true, className: "mx-1 size-4 shrink-0 text-cms-muted-foreground" }), _jsx("span", { className: "max-w-48 truncate px-1 text-cms-muted-foreground text-xs", title: content, children: content }), _jsx(BubbleButton, { label: t("edit"), onClick: () => openForm(t, props, { active: true, initial: content, range: mark }), children: _jsx(Pencil, { "aria-hidden": true, className: ICON_CLASS }) }), _jsx(BubbleButton, { label: t("remove"), onClick: act(() => removeInlineMark(editor, mark)), children: _jsx(X, { "aria-hidden": true, className: ICON_CLASS }) })] }));
}
/**
 * Editor registration of the tooltip mark in the admin language `t` picks (the slash menu item is text, not a component). Shown with a dotted underline,
 * and text typed right after the end of a tooltip becomes part of it.
 */
export const tooltipMarkExtension = (t) => ({
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
export function TooltipProvider({ children }) {
    const t = useTranslator(tooltipMessages);
    const components = useMemo(() => ({ marks: { [tooltipBlock.name]: tooltipMarkExtension(t) } }), [t]);
    return _jsx(CmsAdminComponentsProvider, { components: components, children: children });
}
