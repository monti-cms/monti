"use client";
import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { closestCenter, DndContext, KeyboardSensor, PointerSensor, useSensor, useSensors, } from "@dnd-kit/core";
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy, } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useSite, useTranslator } from "@monti-cms/core/client";
import { ArrowDown, ArrowUp, ChevronsDownUp, Eye, GripVertical, MoveRight, Plus, Trash2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cn } from "../../lib/utils/cn.js";
import { readPreference, writePreference } from "../../lib/utils/site-storage.js";
import { Button } from "../../ui/button.js";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../../ui/dialog.js";
import { IconButton } from "../../ui/icon-button.js";
import { Input } from "../../ui/input.js";
import { PanelResizeHandle, usePanelResize } from "../../ui/panel-resize.js";
import { defaultTab } from "../entries/layout-groups.js";
import { INSPECTOR_PANEL_RESIZE } from "../shared/side-panel.js";
import { AddFieldDialog } from "./add-field.js";
import { useIssuesUnder, useSchemaEdit } from "./controls.js";
import { FieldSheet } from "./field-sheet.js";
import { branchFields, summarizeField } from "./field-summary.js";
import { addGroup, addTab, dropFieldOnField, editGroup, hasTabLevel, moveFieldBy, moveGroup, moveGroupBy, moveGroupToTab, moveOutOfGroup, moveTab, noPanelReason, ownTabOf, placeField, placeOf, placeUngrouped, removeGroup, removeTab, renameTab, tabIsEditable, tabProblem, treeOf, withTree, } from "./layout-model.js";
import { LayoutPreview } from "./layout-preview.js";
import { schemaMessages } from "./messages.js";
import { fieldsOf, moveField, optionsOf, removeBlock, removeField, reorderField, } from "./schema-model.js";
/** The colour of a kind token in the tree: one family per meaning, light and dark. */
const TONE = {
    text: "text-cms-muted-foreground",
    slug: "text-[#0F766E] cms-dark:text-[#5EEAD4]",
    relation: "text-[#2563EB] cms-dark:text-[#93C5FD]",
    backlink: "text-[#0F766E] cms-dark:text-[#5EEAD4]",
    select: "text-[#7C3AED] cms-dark:text-[#C4B5FD]",
    conditional: "text-[#9A3412] cms-dark:text-[#FDBA74]",
    media: "text-[#15803D] cms-dark:text-[#86EFAC]",
    view: "text-cms-muted-foreground/70",
};
const REQUIRED = "text-[#B45309] cms-dark:text-[#FCD34D]";
const OPTION = "text-[#9A3412] cms-dark:text-[#FDBA74]";
const COLUMNS = "grid grid-cols-[minmax(0,300px)_8.75rem_minmax(0,1fr)] items-center gap-x-4";
/** Two columns only, for when the preview takes the room beside the tree. */
const COLUMNS_COMPACT = "grid grid-cols-[minmax(0,360px)_8.75rem] items-center gap-x-4";
const columnsOf = (compact) => (compact ? COLUMNS_COMPACT : COLUMNS);
function RowButtons({ buttons }) {
    return (_jsx("div", { className: "absolute top-1/2 right-2 flex -translate-y-1/2 items-center gap-0.5 rounded-md bg-cms-card/95 opacity-0 focus-within:opacity-100 group-focus-within/row:opacity-100 group-hover/row:opacity-100 [@media(hover:none)]:opacity-100", children: buttons.map((button) => (_jsx(IconButton, { label: button.label, size: "icon-xs", destructive: button.destructive, pressed: button.pressed, disabled: button.disabled, onClick: button.onClick, children: _jsx(button.icon, { "aria-hidden": true }) }, button.label))) }));
}
/** Where a row can go, as a list to pick from. */
function MoveDialog({ title, destinations, onClose, }) {
    return (_jsx(Dialog, { open: true, onOpenChange: (open) => !open && onClose(), children: _jsxs(DialogContent, { className: "max-w-sm", "data-testid": "move-dialog", children: [_jsx(DialogHeader, { children: _jsx(DialogTitle, { children: title }) }), _jsx("ul", { className: "flex max-h-80 flex-col gap-1 overflow-y-auto", children: destinations.map((destination) => (_jsx("li", { children: _jsx(Button, { type: "button", variant: "ghost", size: "sm", className: "w-full justify-start", disabled: destination.disabled, onClick: () => {
                                destination.run();
                                onClose();
                            }, children: destination.label }) }, destination.label))) })] }) }));
}
function Row({ ctx, place, name, field, prefix, childLead, nested, index, count, top, }) {
    const t = useTranslator(schemaMessages);
    const { disabled, file } = useSchemaEdit();
    const { editing } = ctx;
    const summary = summarizeField(t, name, field, editing.collection, file, !place.branch);
    const path = place.branch
        ? `collections.${editing.collectionName}.fields.${place.branch.field}.values.${place.branch.option}.${name}`
        : `collections.${editing.collectionName}.fields.${name}`;
    const issues = useIssuesUnder(path);
    const label = typeof field.label === "string" ? field.label : "";
    const blocked = removeBlock(editing.collection, place, name);
    const locked = top?.locked ?? null;
    // A field in a conditional branch only reorders within its branch, so a branch with one field has nothing to drag.
    const noDrag = disabled || locked !== null || (place.branch !== undefined && count < 2);
    const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
        id: name,
        disabled: noDrag,
    });
    const open = () => ctx.onOpen(place, name);
    const onKeyDown = (event) => {
        if (event.target !== event.currentTarget)
            return;
        if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            open();
        }
    };
    const [moving, setMoving] = useState(false);
    const buttons = [
        {
            label: t("row.up", { name }),
            icon: ArrowUp,
            disabled: disabled || (top ? !top.canUp || locked !== null : index === 0),
            onClick: () => (top ? top.up() : editing.update((collection) => moveField(collection, place, name, -1))),
        },
        {
            label: t("row.down", { name }),
            icon: ArrowDown,
            disabled: disabled || (top ? !top.canDown || locked !== null : index === count - 1),
            onClick: () => (top ? top.down() : editing.update((collection) => moveField(collection, place, name, 1))),
        },
        ...(top && !locked
            ? [{ label: t("layout.move", { name }), icon: MoveRight, disabled, onClick: () => setMoving(true) }]
            : []),
        {
            label: t("row.remove", { name }),
            icon: Trash2,
            destructive: true,
            disabled: disabled || blocked !== null,
            onClick: () => editing.update((collection) => removeField(collection, place, name)),
        },
    ];
    const options = field.kind === "conditional" ? Object.keys(optionsOf(field)) : [];
    return (_jsxs("div", { ref: setNodeRef, style: { transform: CSS.Translate.toString(transform), transition }, className: cn("relative", isDragging && "z-10 bg-cms-card opacity-80"), "data-testid": `field-${name}`, children: [_jsxs("div", { className: "group/row relative", children: [_jsxs("div", { role: "button", tabIndex: 0, "aria-label": t("field.toggle", { name }), onClick: open, onKeyDown: onKeyDown, className: cn(columnsOf(ctx.compact), "min-h-[30px] cursor-pointer pr-5 pl-9 outline-none hover:bg-cms-muted/60 focus-visible:bg-cms-muted/60 focus-visible:ring-2 focus-visible:ring-cms-ring/50 focus-visible:ring-inset", nested && "bg-cms-muted/20"), children: [_jsxs("div", { className: "flex min-w-0 items-center", children: [_jsx("span", { "aria-hidden": true, className: "whitespace-pre font-mono text-[13px] text-cms-muted-foreground/40", children: prefix }), _jsx("span", { className: "max-w-[70%] shrink-0 truncate font-mono text-[13px]", title: name, children: name }), label && (_jsx("span", { className: "ml-2 min-w-0 truncate text-cms-muted-foreground text-xs", title: label, children: label })), locked?.kind === "panel" && (_jsx("span", { className: "ml-2 shrink-0 text-cms-muted-foreground/80 text-xs", title: t(locked.reason === "title" ? "layout.notInPanel.title" : "layout.notInPanel.hidden"), children: t("layout.notInPanel") })), locked?.kind === "plugin" && (_jsx("span", { className: "ml-2 shrink-0 text-cms-muted-foreground/80 text-xs", title: t("layout.pluginPlaced.title", { tab: locked.tab }), children: t("layout.pluginPlaced") })), issues.length > 0 && (_jsx("span", { role: "img", "aria-label": t("field.problems", { count: issues.length }), className: "ml-2 size-1.5 shrink-0 rounded-full bg-cms-destructive" }))] }), _jsxs("div", { className: "whitespace-nowrap font-mono text-xs", children: [_jsx("span", { className: TONE[summary.tone], children: summary.token }), summary.required && (_jsxs("span", { className: REQUIRED, title: t("field.requiredBadge"), children: [" ", "!"] }))] }), _jsxs("div", { className: cn("hidden min-w-0 truncate pr-8 font-mono text-cms-muted-foreground text-xs", !ctx.compact && "block"), children: [summary.isTitle && (_jsxs("span", { "data-testid": "title-badge", children: [t("sum.title"), summary.detail ? " · " : ""] })), summary.detail] })] }), _jsx("button", { type: "button", ref: setActivatorNodeRef, ...attributes, ...listeners, "aria-label": t("fields.drag", { name }), disabled: noDrag, className: "absolute top-1/2 left-2.5 flex size-5 -translate-y-1/2 cursor-grab touch-none items-center justify-center rounded-sm text-cms-muted-foreground opacity-0 outline-none hover:text-cms-foreground focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-cms-ring/50 disabled:hidden group-hover/row:opacity-100", children: _jsx(GripVertical, { "aria-hidden": true, className: "size-4" }) }), _jsx(RowButtons, { buttons: buttons }), moving && top && (_jsx(MoveDialog, { title: t("layout.moveTitle", { name }), destinations: top.destinations, onClose: () => setMoving(false) }))] }), options.map((option, at) => {
                const last = at === options.length - 1;
                const children = branchFields(field, option);
                return (_jsxs("div", { children: [_jsxs("div", { className: cn(columnsOf(ctx.compact), "min-h-[30px] pr-5 pl-9"), children: [_jsxs("div", { className: "flex min-w-0 items-center", children: [_jsxs("span", { "aria-hidden": true, className: "whitespace-pre font-mono text-[13px] text-cms-muted-foreground/40", children: [childLead, last ? "└ " : "├ "] }), _jsxs("span", { className: cn("font-mono text-[13px]", OPTION), children: ["= \"", option, "\""] })] }), _jsx("div", {}), _jsx("div", { className: cn("hidden truncate font-mono text-cms-muted-foreground text-xs", !ctx.compact && "block"), children: Object.keys(children).length === 0 ? t("fields.noExtra") : "" })] }), Object.keys(children).length > 0 && (_jsx(FieldGroup, { ctx: ctx, place: { branch: { field: name, option } }, fields: children, lead: childLead + (last ? "   " : "│  "), nested: true }))] }, option));
            })] }));
}
/** One list of fields (the top level, or the fields of one option): rows that can be dragged within the list. */
function FieldGroup({ ctx, place, fields, lead, nested, }) {
    const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }), useSensor(KeyboardSensor));
    const names = Object.keys(fields);
    const onDragEnd = ({ active, over }) => {
        if (!over || active.id === over.id)
            return;
        ctx.editing.update((collection) => reorderField(collection, place, String(active.id), String(over.id)));
    };
    return (_jsx(DndContext, { sensors: sensors, collisionDetection: closestCenter, onDragEnd: onDragEnd, children: _jsx(SortableContext, { items: names, strategy: verticalListSortingStrategy, children: names.map((name, index) => {
                const last = index === names.length - 1;
                const prefix = lead === null ? "" : lead + (last ? "└ " : "├ ");
                const childLead = lead === null ? "  " : lead + (last ? "   " : "│  ");
                return (_jsx(Row, { ctx: ctx, place: place, name: name, field: fields[name] ?? {}, prefix: prefix, childLead: childLead, nested: nested, index: index, count: names.length }, name));
            }) }) }));
}
/** An input that edits a name in place: it changes the tree on Enter or when it loses focus, and Escape gives the old name back. */
function InlineName({ value, label, disabled, inputRef, onCommit, className, }) {
    const [draft, setDraft] = useState(value);
    useEffect(() => setDraft(value), [value]);
    const commit = () => {
        if (draft.trim() === "" || draft.trim() === value)
            setDraft(value);
        else
            onCommit(draft.trim());
    };
    return (_jsx(Input, { ref: inputRef, value: draft, "aria-label": label, disabled: disabled, onChange: (event) => setDraft(event.target.value), onBlur: commit, onKeyDown: (event) => {
            if (event.key === "Enter") {
                event.preventDefault();
                commit();
            }
            else if (event.key === "Escape") {
                setDraft(value);
            }
        }, className: cn("h-7 min-w-0 border-transparent bg-transparent px-1.5 font-semibold text-sm shadow-none", className) }));
}
const groupId = (tab, block) => `group:${tab}:${block}`;
const emptyId = (tab, block) => `empty:${tab}:${block}`;
const tabId = (tab) => `tab:${tab}`;
const endId = (tab) => `end:${tab}`;
const parseBlockId = (id, kind) => {
    const match = new RegExp(`^${kind}:(\\d+):(\\d+)$`).exec(id);
    return match ? { tab: Number(match[1]), block: Number(match[2]) } : null;
};
const parseTabId = (id) => {
    const match = /^(?:tab|end):(\d+)$/.exec(id);
    return match ? Number(match[1]) : null;
};
/** A tab of the panel as a row of the tree: only drawn once the collection has more than the default tab. */
function TabRow({ ops, index }) {
    const t = useTranslator(schemaMessages);
    const tab = ops.tree.tabs[index];
    const { setNodeRef, transform, transition } = useSortable({ id: tabId(index), disabled: { draggable: true } });
    const inputRef = useRef(null);
    if (!tab)
        return null;
    const editable = tabIsEditable(ops.tree, index);
    const count = ops.tree.tabs.length;
    const buttons = [
        {
            label: t("layout.upTab", { name: tab.name }),
            icon: ArrowUp,
            disabled: ops.disabled || index < 2,
            onClick: () => ops.change((tree) => moveTab(tree, index, -1)),
        },
        {
            label: t("layout.downTab", { name: tab.name }),
            icon: ArrowDown,
            disabled: ops.disabled || index === 0 || index === count - 1,
            onClick: () => ops.change((tree) => moveTab(tree, index, 1)),
        },
        {
            label: t("layout.removeTab", { name: tab.name }),
            icon: Trash2,
            destructive: true,
            disabled: ops.disabled || !editable,
            onClick: () => ops.change((tree) => removeTab(tree, index)),
        },
    ];
    return (_jsxs("div", { ref: setNodeRef, style: { transform: CSS.Translate.toString(transform), transition }, "data-testid": `tab-${index}`, className: "group/row relative mt-3 flex items-center gap-1 border-y bg-cms-muted py-1.5 pr-5 pl-9 first:mt-0", children: [_jsx(InlineName, { value: tab.name, label: t("layout.tabName"), disabled: ops.disabled || !editable, inputRef: inputRef, onCommit: (name) => ops.change((tree) => renameTab(tree, index, name)), className: "-ml-1.5 font-semibold" }), _jsx("span", { className: "flex-1" }), !editable && index > 0 && (_jsx("span", { className: "shrink-0 pr-1 text-cms-muted-foreground text-xs", title: t("layout.tabLocked"), children: t("layout.pluginPlaced") })), _jsx(RowButtons, { buttons: buttons })] }));
}
/** A group of the panel as a row of the tree: its title is edited in place, its fields sit under it. */
function GroupRow({ ops, tab, block }) {
    const t = useTranslator(schemaMessages);
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
    return (_jsxs("div", { ref: setNodeRef, style: { transform: CSS.Translate.toString(transform), transition }, className: cn("group/row relative mt-1 border-y bg-cms-muted/30", isDragging && "z-10 bg-cms-card opacity-80"), "data-testid": `group-${tab}-${block}`, children: [_jsxs("div", { className: "flex items-center gap-1 py-0.5 pr-5 pl-9", children: [_jsx(InlineName, { className: "-ml-1.5", value: group.title, label: t("layout.groupTitle"), disabled: ops.disabled, inputRef: inputRef, onCommit: (title) => ops.change((tree) => editGroup(tree, ref, { title })) }), group.collapsed && (_jsx("span", { className: "shrink-0 text-cms-muted-foreground text-xs", children: t("layout.collapsedMark") })), _jsx("span", { className: "flex-1" }), _jsx(RowButtons, { buttons: buttons }), moving && (_jsx(MoveDialog, { title: t("layout.moveGroupTitle", { name: group.title }), destinations: ops.tree.tabs.flatMap((item, at) => at === tab ? [] : [{ label: item.name, run: () => ops.change((tree) => moveGroupToTab(tree, ref, at)) }]), onClose: () => setMoving(false) }))] }), _jsx("button", { type: "button", ref: setActivatorNodeRef, ...attributes, ...listeners, "aria-label": t("layout.dragGroup", { name: group.title }), disabled: ops.disabled, className: "absolute top-1/2 left-2.5 flex size-5 -translate-y-1/2 cursor-grab touch-none items-center justify-center rounded-sm text-cms-muted-foreground opacity-0 outline-none hover:text-cms-foreground focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-cms-ring/50 disabled:hidden group-hover/row:opacity-100", children: _jsx(GripVertical, { "aria-hidden": true, className: "size-4" }) })] }));
}
/** The place to drop a field into a group that has none, or after the last block of a tab. */
function DropRow({ id, label, testId }) {
    const { setNodeRef, transform, transition } = useSortable({ id, disabled: { draggable: true } });
    return (_jsx("div", { ref: setNodeRef, style: { transform: CSS.Translate.toString(transform), transition }, className: cn("pr-5 pl-9 text-cms-muted-foreground text-xs", label ? "py-1" : "h-2"), "data-testid": testId, children: label }));
}
/**
 * The top-level fields as the properties panel lays them out: tab, then group, then field. Fields are dragged into and out of groups and tabs (the row menus do the
 * same without dragging). Every change writes the tree back as the order of `fields` and `layout` together.
 */
function LayoutTree({ editing, ctx }) {
    const t = useTranslator(schemaMessages);
    const site = useSite();
    const { disabled } = useSchemaEdit();
    const first = defaultTab(site);
    const collection = editing.collection;
    const tree = treeOf(collection, first);
    const showTabs = hasTabLevel(tree);
    const change = (next) => editing.update((current) => withTree(current, next(treeOf(current, first))));
    const ops = { change, tree, showTabs, disabled };
    const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
    const fields = fieldsOf(collection);
    const rows = [];
    const fieldRow = (name, member, locked) => {
        const here = placeOf(tree, name);
        const inGroup = here !== null && tree.tabs[here.tab]?.blocks[here.block]?.title !== null;
        const moveUp = locked ? tree : moveFieldBy(tree, name, -1);
        const moveDown = locked ? tree : moveFieldBy(tree, name, 1);
        const same = (other) => JSON.stringify(other) === JSON.stringify(tree);
        const destinations = locked
            ? []
            : [
                ...tree.tabs.flatMap((tab, at) => [
                    ...tab.blocks.flatMap((block, g) => block.title === null
                        ? []
                        : [
                            {
                                label: showTabs ? `${tab.name} / ${block.title}` : block.title,
                                disabled: here?.tab === at && here.block === g,
                                run: () => change((current) => placeField(current, name, at, g)),
                            },
                        ]),
                    {
                        label: showTabs ? `${tab.name} / ${t("layout.noGroup")}` : t("layout.noGroup"),
                        run: () => change((current) => placeUngrouped(current, name, at)),
                    },
                ]),
                ...(inGroup
                    ? [{ label: t("layout.moveOut"), run: () => change((current) => moveOutOfGroup(current, name)) }]
                    : []),
            ];
        rows.push({
            id: name,
            node: (_jsx(Row, { ctx: ctx, place: {}, name: name, field: fields[name] ?? {}, prefix: "", childLead: "  ", nested: false, index: 0, count: 1, top: {
                    member,
                    locked,
                    destinations,
                    up: () => change((current) => moveFieldBy(current, name, -1)),
                    down: () => change((current) => moveFieldBy(current, name, 1)),
                    canUp: !same(moveUp),
                    canDown: !same(moveDown),
                } }, name)),
        });
    };
    for (const name of tree.pinned) {
        fieldRow(name, false, { kind: "panel", reason: noPanelReason(collection, name) ?? "hidden" });
    }
    for (const [at, tab] of tree.tabs.entries()) {
        if (showTabs)
            rows.push({ id: tabId(at), node: _jsx(TabRow, { ops: ops, index: at }, tabId(at)) });
        for (const [b, block] of tab.blocks.entries()) {
            if (block.title === null) {
                for (const name of block.fields)
                    fieldRow(name, false, null);
                continue;
            }
            rows.push({
                id: groupId(at, b),
                node: _jsx(GroupRow, { ops: ops, tab: at, block: b }, groupId(at, b)),
            });
            if (block.fields.length === 0) {
                rows.push({
                    id: emptyId(at, b),
                    node: (_jsx(DropRow, { id: emptyId(at, b), label: t("layout.emptyGroup"), testId: `empty-${at}-${b}` }, emptyId(at, b))),
                });
            }
            for (const name of block.fields)
                fieldRow(name, true, null);
        }
        rows.push({
            id: endId(at),
            node: _jsx(DropRow, { id: endId(at), testId: `end-${at}` }, endId(at)),
        });
        for (const name of tab.locked)
            fieldRow(name, false, { kind: "plugin", tab: ownTabOf(collection, name) ?? tab.name });
    }
    const onDragEnd = ({ active, over }) => {
        if (!over || active.id === over.id)
            return;
        const from = String(active.id);
        const to = String(over.id);
        change((current) => {
            const group = parseBlockId(from, "group");
            const toGroup = parseBlockId(to, "group");
            const toEmpty = parseBlockId(to, "empty");
            const toTab = parseTabId(to);
            if (group) {
                if (toGroup)
                    return moveGroup(current, group, toGroup);
                if (toEmpty)
                    return moveGroup(current, group, toEmpty);
                if (toTab !== null)
                    return moveGroup(current, group, { tab: toTab, block: Number.MAX_SAFE_INTEGER });
                const place = placeOf(current, to);
                return place ? moveGroup(current, group, { tab: place.tab, block: place.block }) : current;
            }
            // A field dropped on a group's title leaves its group for the place just before that group.
            if (toGroup)
                return placeUngrouped(current, from, toGroup.tab, toGroup.block);
            if (toEmpty)
                return placeField(current, from, toEmpty.tab, toEmpty.block);
            if (toTab !== null)
                return placeUngrouped(current, from, toTab, to.startsWith("end:") ? undefined : 0);
            return dropFieldOnField(current, from, to);
        });
    };
    return (_jsx(DndContext, { sensors: sensors, collisionDetection: closestCenter, onDragEnd: onDragEnd, children: _jsx(SortableContext, { items: rows.map((row) => row.id), strategy: verticalListSortingStrategy, children: rows.map((row) => row.node) }) }));
}
const WIDE_QUERY = "(min-width: 1280px)";
/** The width of an element, followed as it changes; `null` until it is measured. Give the element the returned ref callback: it follows the element if React replaces it. */
function useElementWidth() {
    const [element, setElement] = useState(null);
    const [width, setWidth] = useState(null);
    useEffect(() => {
        if (!element || typeof ResizeObserver === "undefined")
            return;
        setWidth(element.getBoundingClientRect().width);
        const observer = new ResizeObserver(([entry]) => entry && setWidth(entry.contentRect.width));
        observer.observe(element);
        return () => observer.disconnect();
    }, [element]);
    return [setElement, width];
}
/** The tree shows its settings column from this card width on; narrower, it keeps the name and kind readable. */
const SETTINGS_MIN_WIDTH = 760;
/** Whether the window is wide enough for the preview to sit beside the tree. */
function useWide() {
    const [wide, setWide] = useState(false);
    useEffect(() => {
        const media = window.matchMedia?.(WIDE_QUERY);
        if (!media)
            return;
        const update = () => setWide(media.matches);
        update();
        media.addEventListener?.("change", update);
        return () => media.removeEventListener?.("change", update);
    }, []);
    return wide;
}
/** The preview on a narrower window: a panel on the right that the writer can widen, with the tree still reachable beside it. */
function PreviewDrawer({ preview, onClose }) {
    const t = useTranslator(schemaMessages);
    const resize = usePanelResize({ ...INSPECTOR_PANEL_RESIZE, name: "layout-preview", minWidth: 320 });
    return (_jsxs("aside", { "aria-label": t("layout.previewTitle"), style: resize.style, className: "fixed inset-y-0 right-0 z-40 flex w-full flex-col border-l bg-cms-popover sm:w-[var(--panel-width)]", "data-testid": "layout-preview-drawer", children: [_jsx(PanelResizeHandle, { resize: resize }), _jsxs("div", { className: "flex h-11 shrink-0 items-center justify-between border-b pr-2 pl-4", children: [_jsx("h2", { className: "font-medium text-sm", children: t("layout.preview") }), _jsx(Button, { type: "button", variant: "ghost", size: "icon-sm", "aria-label": t("layout.previewClose"), onClick: onClose, children: _jsx(X, { "aria-hidden": true }) })] }), _jsx("div", { className: "flex min-h-0 flex-1 flex-col p-3", children: preview })] }));
}
/** Whether the preview is open: remembered in this browser; open on a wide window until the writer closes it. */
function usePreviewOpen(wide) {
    const site = useSite();
    const [chosen, setChosen] = useState(null);
    useEffect(() => {
        const saved = readPreference(site, "layout-preview-open");
        setChosen(saved === "1" ? true : saved === "0" ? false : null);
    }, [site]);
    return [
        chosen ?? wide,
        (open) => {
            setChosen(open);
            writePreference(site, "layout-preview-open", open ? "1" : "0");
        },
    ];
}
/**
 * The fields of a collection as one aligned tree in a single card: name and label, kind, and the settings in a few words, one line per field. The top-level
 * fields sit in the tabs and groups of the properties panel, with a preview of that panel beside the tree (or in a side panel on a narrower window). A
 * conditional field lists its choices as branches with their own fields under them. A row opens the field in a sheet on the right.
 */
export function FieldsCard({ editing }) {
    const t = useTranslator(schemaMessages);
    const site = useSite();
    const { disabled } = useSchemaEdit();
    const fields = fieldsOf(editing.collection);
    const names = Object.keys(fields);
    const [sheet, setSheet] = useState(null);
    const [adding, setAdding] = useState(false);
    const wide = useWide();
    const [cardRef, cardWidth] = useElementWidth();
    const showSettings = cardWidth === null || cardWidth >= SETTINGS_MIN_WIDTH;
    const [previewOpen, setPreviewOpen] = usePreviewOpen(wide);
    const sideResize = usePanelResize({ ...INSPECTOR_PANEL_RESIZE, name: "layout-preview-side", minWidth: 320 });
    const { file, codeCollections } = useSchemaEdit();
    const first = defaultTab(site);
    const ctx = {
        editing,
        onOpen: (place, name) => setSheet({ place, name }),
        compact: !showSettings,
    };
    const addTo = (make) => editing.update((current) => withTree(current, make(treeOf(current, first))));
    const unique = (base, taken) => {
        let name = base;
        for (let n = 2; taken.includes(name); n += 1)
            name = `${base} ${n}`;
        return name;
    };
    const addGroupRow = () => addTo((tree) => addGroup(tree, 0, unique(t("layout.newGroup"), tree.tabs.flatMap((tab) => tab.blocks.flatMap((block) => (block.title === null ? [] : [block.title]))))));
    const addTabRow = () => addTo((tree) => {
        const name = unique(t("layout.newTab"), tree.tabs.map((tab) => tab.name));
        return tabProblem(tree, name) === null ? addTab(tree, name) : tree;
    });
    const card = (_jsxs("section", { ref: cardRef, className: "min-w-0 max-w-[1000px] overflow-hidden rounded-lg border bg-cms-card", "data-testid": "fields-card", children: [_jsxs("div", { className: "flex items-center justify-between gap-4 border-b px-4 py-3.5", children: [_jsxs("div", { className: "min-w-0", children: [_jsxs("h4", { className: "font-semibold text-sm", children: [t("field.title"), " ", _jsx("span", { className: "font-medium text-cms-muted-foreground", children: names.length })] }), _jsx("p", { className: "mt-0.5 truncate text-cms-muted-foreground text-xs", title: t("fields.hint"), children: t("fields.hint") })] }), _jsxs("div", { className: "flex shrink-0 items-center gap-2 whitespace-nowrap", children: [_jsx(IconButton, { label: t("layout.preview"), size: "icon-sm", pressed: previewOpen, onClick: () => setPreviewOpen(!previewOpen), children: _jsx(Eye, { "aria-hidden": true }) }), _jsxs(Button, { type: "button", variant: "secondary", size: "sm", disabled: disabled, onClick: addTabRow, children: [_jsx(Plus, { "aria-hidden": true }), t("layout.addTab")] }), _jsxs(Button, { type: "button", variant: "secondary", size: "sm", disabled: disabled, onClick: addGroupRow, children: [_jsx(Plus, { "aria-hidden": true }), t("layout.addGroup")] }), _jsxs(Button, { type: "button", variant: "outline", size: "sm", disabled: disabled, onClick: () => setAdding(true), children: [_jsx(Plus, { "aria-hidden": true }), t("field.add")] })] })] }), _jsxs("div", { className: cn(columnsOf(ctx.compact), "border-b py-2 pr-5 pl-9 text-cms-muted-foreground text-xs"), "aria-hidden": true, children: [_jsx("span", { children: t("fields.colField") }), _jsx("span", { children: t("fields.colKind") }), _jsx("span", { className: cn("hidden", !ctx.compact && "block"), children: t("fields.colSettings") })] }), _jsx("div", { className: "py-1.5 pb-2.5", children: names.length === 0 ? (_jsx("p", { className: "px-5 py-3 text-cms-muted-foreground text-xs", children: t("field.none") })) : (_jsx(LayoutTree, { editing: editing, ctx: ctx })) }), _jsxs("div", { className: "flex flex-wrap gap-x-5 gap-y-1 border-t px-5 py-2.5 text-cms-muted-foreground text-xs", children: [_jsxs("span", { children: [_jsx("span", { className: cn("font-mono", REQUIRED), children: "!" }), " ", t("fields.legendRequired")] }), _jsxs("span", { children: [_jsx("span", { className: cn("font-mono", TONE.relation), children: "\u2192" }), " ", t("fields.legendRelation")] }), _jsxs("span", { children: [_jsx("span", { className: cn("font-mono", TONE.backlink), children: "\u2190" }), " ", t("fields.legendBacklink")] }), _jsxs("span", { children: [_jsx("span", { className: cn("font-mono", OPTION), children: "= \"\u2026\"" }), " ", t("fields.legendOption")] }), _jsx("span", { className: "flex-1" }), _jsx("span", { children: t("fields.legendOpen") })] }), adding && (_jsx(AddFieldDialog, { editing: editing, place: {}, onClose: () => setAdding(false), onAdded: (name) => {
                    setAdding(false);
                    setSheet({ place: {}, name });
                } })), sheet && (_jsx(FieldSheet, { editing: editing, place: sheet.place, name: sheet.name, onClose: () => setSheet(null) }, `${sheet.name}`))] }));
    const preview = (_jsx(LayoutPreview, { file: file, collection: editing.collectionName, codeCollections: codeCollections, onClose: () => setPreviewOpen(false) }));
    return (_jsxs(_Fragment, { children: [wide && previewOpen ? (_jsxs("div", { className: "grid grid-cols-[minmax(0,1000px)_var(--panel-width)] items-start gap-6", style: sideResize.style, children: [card, _jsxs("div", { className: "sticky top-4 flex h-[min(48rem,calc(100vh-6rem))] flex-col", "data-testid": "layout-preview-side", children: [_jsx(PanelResizeHandle, { resize: sideResize, className: "-left-3.5" }), preview] })] })) : (card), !wide && previewOpen && _jsx(PreviewDrawer, { preview: preview, onClose: () => setPreviewOpen(false) })] }));
}
