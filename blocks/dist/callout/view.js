"use client";
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { AttributeInput, ContainerToolbar, ToolbarButton } from "@monti-cms/admin/blocks";
import { BlockFrame, Content, useBlockEditor } from "@monti-cms/admin/hooks";
import { cn, DropdownMenu, DropdownMenuContent, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuTrigger, } from "@monti-cms/admin/kit";
import { useTranslator } from "@monti-cms/core/client";
import { calloutMessages } from "./messages.js";
import { CALLOUT_BOX_CLASS, CALLOUT_ICON_BY_VARIANT, getDefaultCalloutTitle } from "./style.js";
const VARIANTS = ["note", "tip", "info", "warning", "danger"];
const isVariant = (value) => typeof value === "string" && VARIANTS.includes(value);
/** Callout editing view. The title is edited in place, the variant from the block toolbar menu. Colors derive from the theme colors (`styles.css`). */
export function CalloutNodeView() {
    const t = useTranslator(calloutMessages);
    const VARIANT_OPTIONS = Object.fromEntries(VARIANTS.map((key) => [key, t(`option.${key}`)]));
    const block = useBlockEditor();
    const { values, editable } = block;
    const setValue = block.setValue;
    const variant = isVariant(values.variant) ? values.variant : "note";
    const Icon = CALLOUT_ICON_BY_VARIANT[variant];
    return (_jsxs(BlockFrame, { className: "my-6 rounded-lg", children: [_jsxs("div", { "data-slot": "callout", "data-variant": variant, role: "note", className: cn(CALLOUT_BOX_CLASS, "not-prose w-full"), children: [_jsxs("div", { className: "flex items-center gap-2", contentEditable: false, children: [_jsx(Icon, { "aria-hidden": true, "data-callout-icon": true, className: "size-4 shrink-0" }), _jsx(AttributeInput, { "aria-label": t("title.aria"), value: typeof values.title === "string" ? values.title : "", placeholder: getDefaultCalloutTitle(variant), readOnly: !editable, onCommit: (title) => setValue("title", title), onEnter: () => block.focus(), onEscape: () => block.focus(), className: "flex-1 font-medium tracking-tight" })] }), _jsx(Content, { className: "mt-2 text-current text-sm [&>*>:first-child>[data-node-view-wrapper]]:mt-0 [&>*>:last-child>[data-node-view-wrapper]]:mb-0 [&_p]:m-0 [&_p]:leading-relaxed" })] }), editable ? (_jsx(ContainerToolbar, { label: t("toolbar"), children: _jsxs(DropdownMenu, { children: [_jsx(ToolbarButton, { label: t("variant.button", { variant: VARIANT_OPTIONS[variant] }), trigger: (button) => _jsx(DropdownMenuTrigger, { render: button }), children: _jsx(Icon, { "aria-hidden": true }) }), _jsx(DropdownMenuContent, { align: "end", className: "w-40", children: _jsx(DropdownMenuRadioGroup, { value: variant, onValueChange: (next) => setValue("variant", String(next)), children: Object.entries(VARIANT_OPTIONS).map(([key, label]) => {
                                    const OptionIcon = CALLOUT_ICON_BY_VARIANT[key];
                                    return (_jsxs(DropdownMenuRadioItem, { value: key, children: [_jsx(OptionIcon, { "aria-hidden": true }), label] }, key));
                                }) }) })] }) })) : null] }));
}
