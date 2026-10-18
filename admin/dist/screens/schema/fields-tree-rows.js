"use client";
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// The rows of the fields tree: a field row (with the branches of a conditional field), its icon buttons and move dialog.
// Dragging itself lives in fields-tree-dnd.tsx; the tab and group rows of the layout in fields-tree-layout-rows.tsx.
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useTranslator } from "@monti-cms/core/site";
import { ArrowDown, ArrowUp, GripVertical, MoveRight, Trash2 } from "lucide-react";
import { useState } from "react";
import { cn } from "../../lib/utils/cn.js";
import { Button } from "../../ui/button.js";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../../ui/dialog.js";
import { IconButton } from "../../ui/icon-button.js";
import { useIssuesUnder, useSchemaEdit } from "./controls.js";
import { branchFields, summarizeField } from "./field-summary.js";
import { schemaFieldsMessages } from "./fields.messages.js";
import { SortableList } from "./fields-tree-dnd.js";
import { schemaMessages } from "./messages.js";
import { moveField, optionsOf, removeBlock, removeField, reorderField, } from "./schema-model.js";
/** The colour of a kind token in the tree: one family per meaning, light and dark. */
export const TONE = {
    text: "text-monti-muted-foreground",
    slug: "text-[#0F766E] monti-dark:text-[#5EEAD4]",
    relation: "text-[#2563EB] monti-dark:text-[#93C5FD]",
    backlink: "text-[#0F766E] monti-dark:text-[#5EEAD4]",
    select: "text-[#7C3AED] monti-dark:text-[#C4B5FD]",
    conditional: "text-[#9A3412] monti-dark:text-[#FDBA74]",
    media: "text-[#15803D] monti-dark:text-[#86EFAC]",
    view: "text-monti-muted-foreground/70",
};
export const REQUIRED = "text-[#B45309] monti-dark:text-[#FCD34D]";
export const OPTION = "text-[#9A3412] monti-dark:text-[#FDBA74]";
const COLUMNS = "grid grid-cols-[minmax(0,300px)_8.75rem_minmax(0,1fr)] items-center gap-x-4";
/** Two columns only, for when the preview takes the room beside the tree. */
const COLUMNS_COMPACT = "grid grid-cols-[minmax(0,360px)_8.75rem] items-center gap-x-4";
export const columnsOf = (compact) => (compact ? COLUMNS_COMPACT : COLUMNS);
export function RowButtons({ buttons }) {
    return (_jsx("div", { className: "absolute top-1/2 right-2 flex -translate-y-1/2 items-center gap-0.5 rounded-md bg-monti-card/95 opacity-0 focus-within:opacity-100 group-focus-within/row:opacity-100 group-hover/row:opacity-100 [@media(hover:none)]:opacity-100", children: buttons.map((button) => (_jsx(IconButton, { label: button.label, size: "icon-xs", destructive: button.destructive, pressed: button.pressed, disabled: button.disabled, title: button.title, onClick: button.onClick, children: _jsx(button.icon, { "aria-hidden": true }) }, button.label))) }));
}
/** Where a row can go, as a list to pick from. */
export function MoveDialog({ title, destinations, onClose, }) {
    return (_jsx(Dialog, { open: true, onOpenChange: (open) => !open && onClose(), children: _jsxs(DialogContent, { className: "max-w-sm", "data-testid": "move-dialog", children: [_jsx(DialogHeader, { children: _jsx(DialogTitle, { children: title }) }), _jsx("ul", { className: "flex max-h-80 flex-col gap-1 overflow-y-auto", children: destinations.map((destination) => (_jsx("li", { children: _jsx(Button, { type: "button", variant: "ghost", size: "sm", className: "w-full justify-start", disabled: destination.disabled, onClick: () => {
                                destination.run();
                                onClose();
                            }, children: destination.label }) }, destination.label))) })] }) }));
}
export function Row({ ctx, place, name, field, prefix, childLead, nested, index, count, top, }) {
    const t = useTranslator(schemaFieldsMessages);
    const ts = useTranslator(schemaMessages);
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
            label: ts("row.up", { name }),
            icon: ArrowUp,
            disabled: disabled || (top ? !top.canUp || locked !== null : index === 0),
            onClick: () => (top ? top.up() : editing.update((collection) => moveField(collection, place, name, -1))),
        },
        {
            label: ts("row.down", { name }),
            icon: ArrowDown,
            disabled: disabled || (top ? !top.canDown || locked !== null : index === count - 1),
            onClick: () => (top ? top.down() : editing.update((collection) => moveField(collection, place, name, 1))),
        },
        ...(top && !locked
            ? [{ label: t("layout.move", { name }), icon: MoveRight, disabled, onClick: () => setMoving(true) }]
            : []),
        {
            label: ts("row.remove", { name }),
            icon: Trash2,
            destructive: true,
            disabled: disabled || blocked !== null,
            onClick: () => editing.update((collection) => removeField(collection, place, name)),
        },
    ];
    const options = field.kind === "conditional" ? Object.keys(optionsOf(field)) : [];
    return (_jsxs("div", { ref: setNodeRef, style: { transform: CSS.Translate.toString(transform), transition }, className: cn("relative", isDragging && "z-10 bg-monti-card opacity-80"), "data-testid": `field-${name}`, children: [_jsxs("div", { className: "group/row relative", children: [_jsxs("div", { role: "button", tabIndex: 0, "aria-label": t("field.toggle", { name }), onClick: open, onKeyDown: onKeyDown, className: cn(columnsOf(ctx.compact), "min-h-[30px] cursor-pointer py-1.5 pr-5 pl-9 outline-none hover:bg-monti-muted/60 focus-visible:bg-monti-muted/60 focus-visible:ring-2 focus-visible:ring-monti-ring/50 focus-visible:ring-inset", nested && "bg-monti-muted/20"), children: [_jsxs("div", { className: "flex min-w-0 items-center", children: [_jsx("span", { "aria-hidden": true, className: "whitespace-pre font-mono text-[13px] text-monti-muted-foreground/40", children: prefix }), _jsx("span", { className: "max-w-[70%] shrink-0 truncate font-mono text-[13px]", title: name, children: name }), label && (_jsx("span", { className: "ml-2 min-w-0 truncate text-monti-muted-foreground text-xs", title: label, children: label })), locked?.kind === "panel" && (_jsx("span", { className: "ml-2 shrink-0 text-monti-muted-foreground/80 text-xs", title: t("layout.notInPanel.title"), children: t("layout.notInPanel") })), locked?.kind === "plugin" && (_jsx("span", { className: "ml-2 shrink-0 text-monti-muted-foreground/80 text-xs", title: t("layout.pluginPlaced.title", { tab: locked.tab }), children: t("layout.pluginPlaced") })), issues.length > 0 && (_jsx("span", { role: "img", "aria-label": t("field.problems", { count: issues.length }), className: "ml-2 size-1.5 shrink-0 rounded-full bg-monti-destructive" }))] }), _jsxs("div", { className: "whitespace-nowrap font-mono text-xs", children: [_jsx("span", { className: TONE[summary.tone], children: summary.token }), summary.required && (_jsxs("span", { className: REQUIRED, title: t("field.requiredBadge"), children: [" ", "!"] }))] }), _jsxs("div", { className: cn("hidden min-w-0 truncate pr-8 font-mono text-monti-muted-foreground text-xs", !ctx.compact && "block"), children: [summary.isTitle && (_jsxs("span", { "data-testid": "title-badge", children: [t("sum.title"), summary.detail ? " · " : ""] })), summary.detail] })] }), _jsx("button", { type: "button", ref: setActivatorNodeRef, ...attributes, ...listeners, "aria-label": t("fields.drag", { name }), disabled: noDrag, className: "absolute top-1/2 left-2.5 flex size-5 -translate-y-1/2 cursor-grab touch-none items-center justify-center rounded-sm text-monti-muted-foreground opacity-0 outline-none hover:text-monti-foreground focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-monti-ring/50 disabled:hidden group-hover/row:opacity-100", children: _jsx(GripVertical, { "aria-hidden": true, className: "size-4" }) }), _jsx(RowButtons, { buttons: buttons }), moving && top && (_jsx(MoveDialog, { title: t("layout.moveTitle", { name }), destinations: top.destinations, onClose: () => setMoving(false) }))] }), options.map((option, at) => {
                const last = at === options.length - 1;
                const children = branchFields(field, option);
                return (_jsxs("div", { children: [_jsxs("div", { className: cn(columnsOf(ctx.compact), "min-h-[30px] py-1.5 pr-5 pl-9"), children: [_jsxs("div", { className: "flex min-w-0 items-center", children: [_jsxs("span", { "aria-hidden": true, className: "whitespace-pre font-mono text-[13px] text-monti-muted-foreground/40", children: [childLead, last ? "└ " : "├ "] }), _jsxs("span", { className: cn("font-mono text-[13px]", OPTION), children: ["= \"", option, "\""] })] }), _jsx("div", {}), _jsx("div", { className: cn("hidden truncate font-mono text-monti-muted-foreground text-xs", !ctx.compact && "block"), children: Object.keys(children).length === 0 ? t("fields.noExtra") : "" })] }), Object.keys(children).length > 0 && (_jsx(FieldGroup, { ctx: ctx, place: { branch: { field: name, option } }, fields: children, lead: childLead + (last ? "   " : "│  "), nested: true }))] }, option));
            })] }));
}
/** One list of fields (the top level, or the fields of one option): rows that can be dragged within the list. */
export function FieldGroup({ ctx, place, fields, lead, nested, }) {
    const names = Object.keys(fields);
    const onReorder = (from, to) => ctx.editing.update((collection) => reorderField(collection, place, from, to));
    return (_jsx(SortableList, { items: names, onDragEnd: onReorder, children: names.map((name, index) => {
            const last = index === names.length - 1;
            const prefix = lead === null ? "" : lead + (last ? "└ " : "├ ");
            const childLead = lead === null ? "  " : lead + (last ? "   " : "│  ");
            return (_jsx(Row, { ctx: ctx, place: place, name: name, field: fields[name] ?? {}, prefix: prefix, childLead: childLead, nested: nested, index: index, count: names.length }, name));
        }) }));
}
