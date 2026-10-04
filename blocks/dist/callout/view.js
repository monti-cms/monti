"use client";
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { AttributeInput, ContainerToolbar, focusInside, SELECTED_RING, ToolbarButton, useContainerValues, } from "@monti-cms/admin/blocks";
import { cn, DropdownMenu, DropdownMenuContent, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuTrigger, } from "@monti-cms/admin/kit";
import { createTranslator } from "@monti-cms/core/client";
import { NodeViewContent, NodeViewWrapper } from "@tiptap/react";
import { calloutBlock } from "./definition.js";
import { calloutMessages } from "./messages.js";
import { CALLOUT_BOX_CLASS, CALLOUT_ICON_BY_VARIANT, getDefaultCalloutTitle } from "./style.js";
const t = createTranslator(calloutMessages);
const VARIANT_OPTIONS = calloutBlock.attributes.variant.options;
const isVariant = (value) => typeof value === "string" && value in VARIANT_OPTIONS;
/** Callout editing view. The title is edited in place, the variant from the block toolbar menu. Colors derive from the theme colors (`styles.css`). */
export function CalloutNodeView(props) {
    const { selected, editor, getPos } = props;
    const [values, setValue] = useContainerValues(props);
    const variant = isVariant(values.variant) ? values.variant : "note";
    const Icon = CALLOUT_ICON_BY_VARIANT[variant];
    const editable = editor.isEditable;
    return (_jsxs(NodeViewWrapper, { "data-cms-container-node": "cmsCallout", "data-cms-framed": true, className: cn("group/container relative my-6 rounded-lg", selected && SELECTED_RING), children: [_jsxs("div", { "data-slot": "callout", "data-variant": variant, role: "note", className: cn(CALLOUT_BOX_CLASS, "not-prose w-full"), children: [_jsxs("div", { className: "flex items-center gap-2", contentEditable: false, children: [_jsx(Icon, { "aria-hidden": true, "data-callout-icon": true, className: "size-4 shrink-0" }), _jsx(AttributeInput, { "aria-label": t("title.aria"), value: typeof values.title === "string" ? values.title : "", placeholder: getDefaultCalloutTitle(variant), readOnly: !editable, onCommit: (title) => setValue("title", title), onEnter: () => focusInside(editor, getPos), onEscape: () => focusInside(editor, getPos), className: "flex-1 font-medium tracking-tight" })] }), _jsx(NodeViewContent, { className: "mt-2 text-current text-sm [&>[data-node-view-content-react]>:first-child>[data-node-view-wrapper]]:mt-0 [&>[data-node-view-content-react]>:last-child>[data-node-view-wrapper]]:mb-0 [&_p]:m-0 [&_p]:leading-relaxed" })] }), editable ? (_jsx(ContainerToolbar, { label: t("toolbar"), children: _jsxs(DropdownMenu, { children: [_jsx(ToolbarButton, { label: t("variant.button", { variant: VARIANT_OPTIONS[variant] }), trigger: (button) => _jsx(DropdownMenuTrigger, { render: button }), children: _jsx(Icon, { "aria-hidden": true }) }), _jsx(DropdownMenuContent, { align: "end", className: "w-40", children: _jsx(DropdownMenuRadioGroup, { value: variant, onValueChange: (next) => setValue("variant", String(next)), children: Object.entries(VARIANT_OPTIONS).map(([key, label]) => {
                                    const OptionIcon = CALLOUT_ICON_BY_VARIANT[key];
                                    return (_jsxs(DropdownMenuRadioItem, { value: key, children: [_jsx(OptionIcon, { "aria-hidden": true }), label] }, key));
                                }) }) })] }) })) : null] }));
}
