"use client";
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { AttributeInput, BlockSettings, ContainerToolbar, focusInside, SELECTED_RING, selectContainer, useContainerValues, useSelectedChildIndex, } from "@monti-cms/admin/blocks";
import { cn, Switch } from "@monti-cms/admin/kit";
import { createTranslator } from "@monti-cms/core/client";
import { NodeViewContent, NodeViewWrapper } from "@tiptap/react";
import { ChevronRight } from "lucide-react";
import { useEffect, useId, useState } from "react";
import { collapsibleMessages } from "./messages.js";
const t = createTranslator(collapsibleMessages);
/**
 * Collapsible editing view (theme colors). The initial state follows `defaultOpen`, and the arrow next to the title toggles it while editing.
 * It expands automatically when the cursor enters it (arrow keys, undo, find).
 */
export function CollapsibleNodeView(props) {
    const { selected, editor, getPos } = props;
    const [values, setValue] = useContainerValues(props);
    const defaultOpen = values.defaultOpen === true;
    const [open, setOpen] = useState(defaultOpen);
    const selectionInside = useSelectedChildIndex(editor, getPos) !== -1;
    const editable = editor.isEditable;
    const defaultOpenId = useId();
    useEffect(() => {
        if (selectionInside)
            setOpen(true);
    }, [selectionInside]);
    const toggle = () => {
        if (open) {
            // Leaving the cursor inside the hidden body would put text where it cannot be seen. Select the whole collapsible block instead.
            if (selectionInside)
                selectContainer(editor, getPos);
            setOpen(false);
        }
        else {
            setOpen(true);
            focusInside(editor, getPos);
        }
    };
    return (_jsxs(NodeViewWrapper, { "data-cms-container-node": "cmsCollapsible", "data-cms-framed": true, className: cn("group/container relative my-6 rounded-md border bg-cms-background", selected && SELECTED_RING), children: [_jsxs("div", { contentEditable: false, className: cn("not-prose flex w-full items-center gap-2 rounded-md px-3 py-2 font-medium text-cms-foreground text-sm", open && "bg-cms-muted"), children: [_jsx("button", { type: "button", "aria-expanded": open, "aria-label": open ? t("toggle.close") : t("toggle.open"), onClick: toggle, className: "-m-1 rounded p-1 hover:bg-cms-accent", children: _jsx(ChevronRight, { className: cn("size-4 shrink-0 text-cms-muted-foreground transition-transform", open && "rotate-90") }) }), _jsx(AttributeInput, { "aria-label": t("title.aria"), value: typeof values.title === "string" ? values.title : "", placeholder: t("title.placeholder"), readOnly: !editable, onCommit: (title) => setValue("title", title), onEnter: () => {
                            setOpen(true);
                            focusInside(editor, getPos);
                        }, className: "flex-1" })] }), _jsx(NodeViewContent, { className: cn("px-3 pt-2 pb-3 text-cms-foreground", 
                // Set the first and last inner block prose margins to 0 so they do not add to the box padding (for nested custom blocks, the wrapper inside react-renderer holds the margin).
                "[&>[data-node-view-content-react]>:first-child]:mt-0 [&>[data-node-view-content-react]>:last-child]:mb-0", "[&>[data-node-view-content-react]>:first-child>[data-node-view-wrapper]]:mt-0 [&>[data-node-view-content-react]>:last-child>[data-node-view-wrapper]]:mb-0", !open && "hidden"), "data-cms-collapsed": open ? undefined : "" }), editable ? (_jsx(ContainerToolbar, { label: t("toolbar"), children: _jsx(BlockSettings, { children: _jsxs("label", { htmlFor: defaultOpenId, className: "flex items-center justify-between gap-2", children: [_jsx("span", { className: "text-cms-muted-foreground", children: t("defaultOpen.label") }), _jsx(Switch, { id: defaultOpenId, size: "sm", checked: defaultOpen, onCheckedChange: (checked) => setValue("defaultOpen", checked) })] }) }) })) : null] }));
}
