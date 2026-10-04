"use client";
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { AttributeInput, blockNodeName, ContainerToolbar, childPos, focusInside, SELECTED_RING, ToolbarButton, useContainerValues, useSelectedChildIndex, valuesOf, withValue, } from "@monti-cms/admin/blocks";
import { cn } from "@monti-cms/admin/kit";
import { createTranslator } from "@monti-cms/core/client";
import { NodeViewContent, NodeViewWrapper } from "@tiptap/react";
import { PencilLine, Plus, Star, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { tabBlock, tabsBlock as tabsDefinition } from "./definition.js";
import { tabsMessages } from "./messages.js";
const t = createTranslator(tabsMessages);
const MIN_TABS = tabsDefinition.children.min;
const MAX_TABS = tabsDefinition.children.max;
/**
 * Keeps only the selected tab and hides the other tab bodies. Child tabs are direct children of the contentDOM (`data-node-view-content-react`).
 * Write the strings out literally so Tailwind can find the classes (up to 8, the definition's `children.max`).
 */
const SHOW_ONLY_TAB = [
    "[&>[data-node-view-content-react]>:not(:nth-child(1))]:hidden",
    "[&>[data-node-view-content-react]>:not(:nth-child(2))]:hidden",
    "[&>[data-node-view-content-react]>:not(:nth-child(3))]:hidden",
    "[&>[data-node-view-content-react]>:not(:nth-child(4))]:hidden",
    "[&>[data-node-view-content-react]>:not(:nth-child(5))]:hidden",
    "[&>[data-node-view-content-react]>:not(:nth-child(6))]:hidden",
    "[&>[data-node-view-content-react]>:not(:nth-child(7))]:hidden",
    "[&>[data-node-view-content-react]>:not(:nth-child(8))]:hidden",
];
// Look of the editor tab bar (theme colors). The public page tab look is decided by the site.
const TAB_TRIGGER = "relative inline-flex h-[calc(100%-1px)] items-center justify-center gap-1 whitespace-nowrap rounded-md border border-transparent px-2 py-1 font-medium text-cms-foreground/60 text-sm transition-all hover:text-cms-foreground cms-dark:text-cms-muted-foreground cms-dark:hover:text-cms-foreground";
const TAB_TRIGGER_ACTIVE = "border-cms-border! bg-cms-background text-cms-foreground shadow-sm cms-dark:border-cms-input cms-dark:bg-cms-input/30 cms-dark:text-cms-foreground";
const labelOf = (values) => (typeof values.label === "string" ? values.label : "");
/**
 * Shows only the tab bar and the selected tab's body, like the public page. The body is edited in place.
 * Clicking a tab moves the cursor to that tab's body, and entering another tab's body with the arrow keys opens that tab.
 * Tab names, the initially open tab, adding, and deleting are done from the block toolbar.
 */
export function TabsNodeView(props) {
    const { node, selected, editor, getPos } = props;
    const [values] = useContainerValues(props);
    const labels = Array.from({ length: node.childCount }, (_, index) => labelOf(valuesOf(node.child(index))));
    const defaultLabel = typeof values.defaultValue === "string" ? values.defaultValue : "";
    const defaultIndex = Math.max(0, labels.indexOf(defaultLabel));
    const [active, setActive] = useState(defaultIndex);
    const [renaming, setRenaming] = useState(null);
    const selectedIndex = useSelectedChildIndex(editor, getPos);
    const current = Math.min(active, node.childCount - 1);
    const editable = editor.isEditable;
    useEffect(() => {
        if (selectedIndex !== -1)
            setActive(selectedIndex);
    }, [selectedIndex]);
    const openTab = (index) => {
        setActive(index);
        focusInside(editor, getPos, index);
    };
    const renameTab = (index, label) => {
        const pos = getPos();
        if (typeof pos !== "number")
            return;
        editor
            .chain()
            .command(({ tr }) => {
            const parent = tr.doc.nodeAt(pos);
            const child = parent?.maybeChild(index);
            if (!parent || !child)
                return false;
            const previous = labelOf(valuesOf(child));
            tr.setNodeMarkup(childPos(parent, pos, index), undefined, {
                ...child.attrs,
                values: withValue(valuesOf(child), "label", label),
            });
            // The initially open tab is referenced by name. Renaming a tab updates it too (based on the current document, not render time).
            const parentValues = valuesOf(parent);
            if (parentValues.defaultValue && parentValues.defaultValue === previous)
                tr.setNodeMarkup(pos, undefined, {
                    ...parent.attrs,
                    values: withValue(parentValues, "defaultValue", label),
                });
            return true;
        })
            .run();
    };
    const addTab = () => {
        const pos = getPos();
        if (typeof pos !== "number" || node.childCount >= MAX_TABS)
            return;
        let number = node.childCount + 1;
        while (labels.includes(t("tab.newName", { number })))
            number += 1;
        editor.commands.insertContentAt(pos + node.nodeSize - 1, {
            type: blockNodeName(tabBlock),
            attrs: { values: { label: t("tab.newName", { number }) } },
            content: [{ type: "paragraph" }],
        });
        openTab(node.childCount);
    };
    const removeTab = (index) => {
        const pos = getPos();
        if (typeof pos !== "number" || node.childCount <= MIN_TABS)
            return;
        const from = childPos(node, pos, index);
        editor
            .chain()
            .command(({ tr }) => {
            tr.delete(from, from + node.child(index).nodeSize);
            if (defaultLabel && defaultLabel === labels[index])
                tr.setNodeMarkup(pos, undefined, { ...node.attrs, values: withValue(values, "defaultValue", "") });
            return true;
        })
            .run();
        openTab(Math.max(0, index - 1));
    };
    const toggleDefault = (index) => {
        const pos = getPos();
        if (typeof pos !== "number")
            return;
        // The first tab opens first even without being specified. Clicking an already specified tab again clears the specification.
        const next = index === 0 || index === defaultIndex ? "" : (labels[index] ?? "");
        editor.view.dispatch(editor.state.tr.setNodeMarkup(pos, undefined, { ...node.attrs, values: withValue(values, "defaultValue", next) }));
    };
    return (_jsxs(NodeViewWrapper, { "data-cms-container-node": "cmsTabs", "data-cms-framed": true, className: cn("group/container relative my-6 rounded-lg", selected && SELECTED_RING), children: [_jsx("div", { contentEditable: false, className: "not-prose", children: _jsxs("div", { role: "tablist", "aria-label": t("list"), className: "relative inline-flex h-9 w-fit max-w-full items-center rounded-lg rounded-b-none border bg-cms-muted p-[3px] text-cms-muted-foreground", children: [labels.map((label, index) => renaming === index ? (_jsx("div", { className: cn(TAB_TRIGGER, TAB_TRIGGER_ACTIVE), children: _jsx(AttributeInput, { "aria-label": t("rename.aria"), value: label, required: true, autoFocus: true, size: Math.max(4, label.length + 1), onCommit: (next) => renameTab(index, next), onEnter: () => {
                                    setRenaming(null);
                                    openTab(index);
                                }, onEscape: () => setRenaming(null), onBlur: () => setRenaming(null), className: "text-center" }) }, index)) : (_jsx("button", { type: "button", role: "tab", "aria-selected": index === current, className: cn(TAB_TRIGGER, index === current && TAB_TRIGGER_ACTIVE), onClick: () => openTab(index), children: label || t("untitled") }, index))), _jsx("span", { className: "pointer-events-none absolute right-0 -bottom-1 left-0 inline-block h-1 bg-cms-muted" })] }) }), _jsx(NodeViewContent, { className: cn("rounded-b-lg rounded-tr-lg border bg-cms-muted px-4 py-3 text-sm", SHOW_ONLY_TAB[current]) }), editable ? (_jsxs(ContainerToolbar, { label: t("toolbar"), children: [_jsx(ToolbarButton, { label: t("add"), disabled: node.childCount >= MAX_TABS, onClick: addTab, children: _jsx(Plus, { "aria-hidden": true }) }), _jsx(ToolbarButton, { label: t("rename"), onClick: () => setRenaming(current), children: _jsx(PencilLine, { "aria-hidden": true }) }), _jsx(ToolbarButton, { label: t("default"), pressed: current === defaultIndex, onClick: () => toggleDefault(current), children: _jsx(Star, { "aria-hidden": true, className: cn(current === defaultIndex && "fill-current") }) }), _jsx(ToolbarButton, { label: t("delete"), destructive: true, disabled: node.childCount <= MIN_TABS, onClick: () => removeTab(current), children: _jsx(Trash2, { "aria-hidden": true }) })] })) : null] }));
}
/** One tab. The parent (tab bar and body box) handles the look, and this view only provides the body slot. */
export function TabNodeView() {
    return (_jsx(NodeViewWrapper, { "data-cms-container-node": "cmsTab", children: _jsx(NodeViewContent, { className: "[&>[data-node-view-content-react]>:first-child]:mt-0 [&>[data-node-view-content-react]>:last-child]:mb-0" }) }));
}
