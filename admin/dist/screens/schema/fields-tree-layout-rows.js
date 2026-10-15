"use client";
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// The rows of the tab / group layout of the fields tree: a tab row, a group row (both with in-place names) and the drop rows between them.
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { DEFAULT_TAB, useSite, useTranslator } from "@monti-cms/core/client";
import { ArrowDown, ArrowUp, ChevronsDownUp, GripVertical, MoveRight, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cn } from "../../lib/utils/cn.js";
import { Input } from "../../ui/input.js";
import { tabLabel } from "../entries/layout-groups.js";
import { schemaFieldsMessages } from "./fields.messages.js";
import { groupId, tabId } from "./fields-tree-dnd.js";
import { MoveDialog, RowButtons } from "./fields-tree-rows.js";
import { editGroup, moveGroupBy, moveGroupToTab, moveTab, removeGroup, removeTab, renameTab, tabCanRemove, tabCanRename, } from "./layout-model.js";
/** An input that edits a name in place: it changes the tree on Enter or when it loses focus, and Escape gives the old name back. */
function InlineName({ value, label, disabled, inputRef, onCommit, className, maxLength, }) {
    const [draft, setDraft] = useState(value);
    useEffect(() => setDraft(value), [value]);
    const commit = () => {
        if (draft.trim() === "" || draft.trim() === value)
            setDraft(value);
        else
            onCommit(draft.trim());
    };
    return (_jsx(Input, { ref: inputRef, value: draft, "aria-label": label, disabled: disabled, maxLength: maxLength, onChange: (event) => setDraft(event.target.value), onBlur: commit, onKeyDown: (event) => {
            if (event.key === "Enter") {
                event.preventDefault();
                commit();
            }
            else if (event.key === "Escape") {
                setDraft(value);
            }
        }, className: cn("h-7 min-w-0 border-transparent bg-transparent cms-dark:bg-transparent px-1.5 font-semibold text-sm shadow-none", className) }));
}
/** A tab of the panel as a row of the tree: shown for all tabs including the default tab. */
export function TabRow({ ops, index }) {
    const t = useTranslator(schemaFieldsMessages);
    const site = useSite();
    const tab = ops.tree.tabs[index];
    const { setNodeRef, transform, transition } = useSortable({ id: tabId(index), disabled: { draggable: true } });
    const inputRef = useRef(null);
    if (!tab)
        return null;
    const canRename = tabCanRename(ops.tree, index);
    const canRemove = tabCanRemove(ops.tree, index);
    const count = ops.tree.tabs.length;
    const defaultName = tabLabel(site, DEFAULT_TAB);
    const currentName = index === 0 ? (ops.tree.defaultTab ?? defaultName) : tab.name;
    const buttons = [
        {
            label: t("layout.upTab", { name: currentName }),
            icon: ArrowUp,
            disabled: ops.disabled || index < 2,
            onClick: () => ops.change((tree) => moveTab(tree, index, -1)),
        },
        {
            label: t("layout.downTab", { name: currentName }),
            icon: ArrowDown,
            disabled: ops.disabled || index === 0 || index === count - 1,
            onClick: () => ops.change((tree) => moveTab(tree, index, 1)),
        },
        {
            label: t("layout.removeTab", { name: currentName }),
            icon: Trash2,
            destructive: true,
            disabled: ops.disabled || !canRemove,
            onClick: () => ops.change((tree) => removeTab(tree, index)),
        },
    ];
    return (_jsxs("div", { ref: setNodeRef, style: { transform: CSS.Translate.toString(transform), transition }, "data-testid": `tab-${index}`, className: "group/row relative mt-3 flex items-center gap-1 border-y bg-cms-muted py-1.5 pr-5 pl-9 first:mt-0", children: [_jsx(InlineName, { value: currentName, label: t("layout.tabName"), disabled: ops.disabled || !canRename, inputRef: inputRef, maxLength: 20, onCommit: (name) => ops.change((tree) => renameTab(tree, index, name, defaultName)), className: "-ml-1.5 font-semibold" }), _jsx("span", { className: "flex-1" }), !canRename && index > 0 && (_jsx("span", { className: "shrink-0 pr-1 text-cms-muted-foreground text-xs", title: t("layout.tabLocked"), children: t("layout.pluginPlaced") })), _jsx(RowButtons, { buttons: buttons })] }));
}
/** A group of the panel as a row of the tree: its title is edited in place, its fields sit under it. */
export function GroupRow({ ops, tab, block }) {
    const t = useTranslator(schemaFieldsMessages);
    const site = useSite();
    const group = ops.tree.tabs[tab]?.blocks[block];
    const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
        id: groupId(tab, block),
        disabled: ops.disabled,
    });
    const inputRef = useRef(null);
    const [moving, setMoving] = useState(false);
    if (!group || group.title === null)
        return null;
    const ref = { tab, block };
    const count = ops.tree.tabs[tab]?.blocks.length ?? 0;
    const buttons = [
        {
            label: t("layout.collapseToggle", { name: group.title }),
            icon: ChevronsDownUp,
            pressed: group.collapsed === true,
            disabled: ops.disabled,
            onClick: () => ops.change((tree) => editGroup(tree, ref, { collapsed: !group.collapsed })),
        },
        {
            label: t("layout.upGroup", { name: group.title }),
            icon: ArrowUp,
            disabled: ops.disabled || block === 0,
            onClick: () => ops.change((tree) => moveGroupBy(tree, ref, -1)),
        },
        {
            label: t("layout.downGroup", { name: group.title }),
            icon: ArrowDown,
            disabled: ops.disabled || block === count - 1,
            onClick: () => ops.change((tree) => moveGroupBy(tree, ref, 1)),
        },
        ...(ops.showTabs
            ? [
                {
                    label: t("layout.moveGroup", { name: group.title }),
                    icon: MoveRight,
                    disabled: ops.disabled,
                    onClick: () => setMoving(true),
                },
            ]
            : []),
        {
            label: t("layout.removeGroup", { name: group.title }),
            icon: Trash2,
            destructive: true,
            disabled: ops.disabled,
            onClick: () => ops.change((tree) => removeGroup(tree, ref)),
        },
    ];
    return (_jsxs("div", { ref: setNodeRef, style: { transform: CSS.Translate.toString(transform), transition }, className: cn("group/row relative mt-1 border-y bg-cms-muted/30", isDragging && "z-10 bg-cms-card opacity-80"), "data-testid": `group-${tab}-${block}`, children: [_jsxs("div", { className: "flex items-center gap-1 py-0.5 pr-5 pl-9", children: [_jsx(InlineName, { className: "-ml-1.5", value: group.title, label: t("layout.groupTitle"), disabled: ops.disabled, inputRef: inputRef, onCommit: (title) => ops.change((tree) => editGroup(tree, ref, { title })) }), group.collapsed && (_jsx("span", { className: "shrink-0 text-cms-muted-foreground text-xs", children: t("layout.collapsedMark") })), _jsx("span", { className: "flex-1" }), _jsx(RowButtons, { buttons: buttons }), moving && (_jsx(MoveDialog, { title: t("layout.moveGroupTitle", { name: group.title }), destinations: ops.tree.tabs.flatMap((item, at) => at === tab
                            ? []
                            : [
                                {
                                    label: at === 0 ? (ops.tree.defaultTab ?? tabLabel(site, item.name)) : item.name,
                                    run: () => ops.change((tree) => moveGroupToTab(tree, ref, at)),
                                },
                            ]), onClose: () => setMoving(false) }))] }), _jsx("button", { type: "button", ref: setActivatorNodeRef, ...attributes, ...listeners, "aria-label": t("layout.dragGroup", { name: group.title }), disabled: ops.disabled, className: "absolute top-1/2 left-2.5 flex size-5 -translate-y-1/2 cursor-grab touch-none items-center justify-center rounded-sm text-cms-muted-foreground opacity-0 outline-none hover:text-cms-foreground focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-cms-ring/50 disabled:hidden group-hover/row:opacity-100", children: _jsx(GripVertical, { "aria-hidden": true, className: "size-4" }) })] }));
}
/** The place to drop a field into a group that has none, or after the last block of a tab. */
export function DropRow({ id, label, testId }) {
    const { setNodeRef, transform, transition } = useSortable({ id, disabled: { draggable: true } });
    return (_jsx("div", { ref: setNodeRef, style: { transform: CSS.Translate.toString(transform), transition }, className: cn("pr-5 pl-9 text-cms-muted-foreground text-xs", label ? "py-1" : "h-2"), "data-testid": testId, children: label }));
}
