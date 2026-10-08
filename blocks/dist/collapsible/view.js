"use client";
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { AttributeInput, BlockSettings, ContainerToolbar } from "@monti-cms/admin/blocks";
import { BlockFrame, Content, useBlockEditor } from "@monti-cms/admin/hooks";
import { cn, Switch } from "@monti-cms/admin/kit";
import { useTranslator } from "@monti-cms/core/client";
import { ChevronRight } from "lucide-react";
import { useEffect, useId, useState } from "react";
import { collapsibleMessages } from "./messages.js";
/**
 * Collapsible editing view (theme colors). The initial state follows `defaultOpen`, and the arrow next to the title toggles it while editing.
 * It expands automatically when the cursor enters it (arrow keys, undo, find).
 */
export function CollapsibleNodeView() {
    const t = useTranslator(collapsibleMessages);
    const block = useBlockEditor();
    const { values, editable, setValue } = block;
    const defaultOpen = values.defaultOpen === true;
    const [open, setOpen] = useState(defaultOpen);
    const selectionInside = block.focusedChild !== null;
    const defaultOpenId = useId();
    useEffect(() => {
        if (selectionInside)
            setOpen(true);
    }, [selectionInside]);
    const toggle = () => {
        if (open) {
            // Leaving the cursor inside the hidden body would put text where it cannot be seen. Select the whole collapsible block instead.
            if (selectionInside)
                block.select();
            setOpen(false);
        }
        else {
            setOpen(true);
            block.focus();
        }
    };
    return (_jsxs(BlockFrame, { className: "my-6 rounded-md border bg-cms-background", children: [_jsxs("div", { contentEditable: false, className: cn("not-prose flex w-full items-center gap-2 rounded-md px-3 py-2 font-medium text-cms-foreground text-sm", open && "bg-cms-muted"), children: [_jsx("button", { type: "button", "aria-expanded": open, "aria-label": open ? t("toggle.close") : t("toggle.open"), onClick: toggle, className: "-m-1 rounded p-1 hover:bg-cms-accent", children: _jsx(ChevronRight, { className: cn("size-4 shrink-0 text-cms-muted-foreground transition-transform", open && "rotate-90") }) }), _jsx(AttributeInput, { "aria-label": t("title.aria"), value: typeof values.title === "string" ? values.title : "", placeholder: t("title.placeholder"), readOnly: !editable, onCommit: (title) => setValue("title", title), onEnter: () => {
                            setOpen(true);
                            block.focus();
                        }, className: "flex-1" })] }), _jsx(Content, { className: cn("px-3 pt-2 pb-3 text-cms-foreground", 
                // Set the first and last inner block prose margins to 0 so they do not add to the box padding (for nested custom blocks, the wrapper inside react-renderer holds the margin).
                "[&>*>:first-child]:mt-0 [&>*>:last-child]:mb-0", "[&>*>:first-child>[data-node-view-wrapper]]:mt-0 [&>*>:last-child>[data-node-view-wrapper]]:mb-0", !open && "hidden"), "data-cms-collapsed": open ? undefined : "" }), editable ? (_jsx(ContainerToolbar, { label: t("toolbar"), children: _jsx(BlockSettings, { children: _jsxs("label", { htmlFor: defaultOpenId, className: "flex items-center justify-between gap-2", children: [_jsx("span", { className: "text-cms-muted-foreground", children: t("defaultOpen.label") }), _jsx(Switch, { id: defaultOpenId, size: "sm", checked: defaultOpen, onCheckedChange: (checked) => setValue("defaultOpen", checked) })] }) }) })) : null] }));
}
