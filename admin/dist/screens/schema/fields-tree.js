"use client";
import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { DEFAULT_TAB, fieldSetsOf, hasFieldSet, placementsOf, useSite, useTranslator } from "@monti-cms/core/site";
import { Eye, Plus, X } from "lucide-react";
import { useEffect, useState } from "react";
import { booleanCodec, usePreference } from "../../lib/hooks/use-preference.js";
import { cn } from "../../lib/utils/cn.js";
import { Button } from "../../ui/button.js";
import { Panel } from "../../ui/card.js";
import { IconButton } from "../../ui/icon-button.js";
import { PanelResizeHandle, usePanelResize } from "../../ui/panel-resize.js";
import { tabLabel } from "../entries/layout-groups.js";
import { TREE_MAX_WIDTH } from "../shared/layout.js";
import { INSPECTOR_PANEL_RESIZE } from "../shared/side-panel.js";
import { AddFieldDialog } from "./add-field.js";
import { useSchemaEdit } from "./controls.js";
import { FieldSheet } from "./field-sheet.js";
import { schemaFieldsMessages } from "./fields.messages.js";
import { emptyId, endId, groupId, LayoutDnd, tabId } from "./fields-tree-dnd.js";
import { DropRow, GroupRow, TabRow } from "./fields-tree-layout-rows.js";
import { columnsOf, OPTION, REQUIRED, Row, TONE, } from "./fields-tree-rows.js";
import { addGroup, addTab, hasTabLevel, moveOutOfGroup, placeField, placeOf, placeUngrouped, tabProblem, treeOf, withTree, } from "./layout-model.js";
import { LayoutPreview } from "./layout-preview.js";
import { addFieldSet, fieldsOf } from "./schema-model.js";
/**
 * The top-level fields as the properties panel lays them out: tab, then group, then field. Fields are dragged into and out of groups and tabs (the row menus do the
 * same without dragging). Every change writes the tree back as the order of `fields` and `layout` together.
 */
function LayoutTree({ editing, ctx }) {
    const t = useTranslator(schemaFieldsMessages);
    const site = useSite();
    const { disabled } = useSchemaEdit();
    const placements = placementsOf(site.plugins);
    const collection = editing.collection;
    const tree = treeOf(collection, placements);
    const showTabs = hasTabLevel(tree);
    const change = (next) => editing.update((current) => withTree(current, next(treeOf(current, placements))));
    const ops = { change, tree, showTabs, disabled };
    const fields = fieldsOf(collection);
    const rows = [];
    const fieldRow = (name, member, locked) => {
        const here = placeOf(tree, name);
        const inGroup = here !== null && tree.tabs[here.tab]?.blocks[here.block]?.title !== null;
        const destinations = locked
            ? []
            : [
                ...tree.tabs.flatMap((tab, at) => {
                    const currentTabName = at === 0 ? (tree.defaultTab ?? tabLabel(site, tab.name)) : tab.name;
                    return [
                        ...tab.blocks.flatMap((block, g) => block.title === null
                            ? []
                            : [
                                {
                                    label: showTabs ? `${currentTabName} / ${block.title}` : block.title,
                                    disabled: here?.tab === at && here.block === g,
                                    run: () => change((current) => placeField(current, name, at, g)),
                                },
                            ]),
                        {
                            label: showTabs ? `${currentTabName} / ${t("layout.noGroup")}` : t("layout.noGroup"),
                            run: () => change((current) => placeUngrouped(current, name, at)),
                        },
                    ];
                }),
                ...(inGroup
                    ? [{ label: t("layout.moveOut"), run: () => change((current) => moveOutOfGroup(current, name)) }]
                    : []),
            ];
        rows.push({
            id: name,
            node: (_jsx(Row, { ctx: ctx, place: {}, name: name, field: fields[name] ?? {}, prefix: "", childLead: "  ", nested: false, count: 1, top: {
                    member,
                    locked,
                    destinations,
                } }, name)),
        });
    };
    for (const name of tree.pinned) {
        fieldRow(name, false, { kind: "panel" });
    }
    for (const [at, tab] of tree.tabs.entries()) {
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
            fieldRow(name, false, { kind: "plugin", tab: tab.name });
    }
    return (_jsx(LayoutDnd, { ids: rows.map((row) => row.id), change: change, children: rows.map((row) => row.node) }));
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
    const t = useTranslator(schemaFieldsMessages);
    const resize = usePanelResize({ ...INSPECTOR_PANEL_RESIZE, name: "layout-preview", minWidth: 320 });
    return (_jsxs("aside", { "aria-label": t("layout.previewTitle"), style: resize.style, className: "fixed inset-y-0 right-0 z-40 flex w-full flex-col border-l bg-monti-popover sm:w-[var(--panel-width)]", "data-testid": "layout-preview-drawer", children: [_jsx(PanelResizeHandle, { resize: resize }), _jsxs("div", { className: "flex h-11 shrink-0 items-center justify-between border-b pr-2 pl-4", children: [_jsx("h2", { className: "font-medium text-sm", children: t("layout.preview") }), _jsx(Button, { type: "button", variant: "ghost", size: "icon-sm", "aria-label": t("layout.previewClose"), onClick: onClose, children: _jsx(X, { "aria-hidden": true }) })] }), _jsx("div", { className: "flex min-h-0 flex-1 flex-col p-3", children: preview })] }));
}
const PREVIEW_OPEN_CODEC = {
    parse: (raw) => booleanCodec.parse(raw),
    serialize: (value) => booleanCodec.serialize(value === true),
};
/** Whether the preview is open: remembered in this browser (per device); open on a wide window until the writer closes it. */
function usePreviewOpen(wide) {
    const [chosen, setChosen] = usePreference("layout-preview-open", PREVIEW_OPEN_CODEC, null);
    return [chosen ?? wide, setChosen];
}
/**
 * The fields of a collection as one aligned tree in a single card: name and label, kind, and the settings in a few words, one line per field. The top-level
 * fields sit in the tabs and groups of the properties panel, with a preview of that panel beside the tree (or in a side panel on a narrower window). A
 * conditional field lists its choices as branches with their own fields under them. A row opens the field in a sheet on the right.
 */
export function FieldsCard({ editing }) {
    const t = useTranslator(schemaFieldsMessages);
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
    const placements = placementsOf(site.plugins);
    const ctx = {
        editing,
        onOpen: (place, name) => setSheet({ place, name }),
        compact: !showSettings,
    };
    const addTo = (make) => editing.update((current) => withTree(current, make(treeOf(current, placements))));
    const unique = (base, taken) => {
        let name = base;
        for (let n = 2; taken.includes(name); n += 1)
            name = `${base} ${n}`;
        return name;
    };
    const addGroupRow = () => addTo((tree) => addGroup(tree, 0, unique(t("layout.newGroup"), tree.tabs.flatMap((tab) => tab.blocks.flatMap((block) => (block.title === null ? [] : [block.title]))))));
    // A plugin's field set (the SEO fields) is offered until the collection has fields with its roles.
    const offeredSets = fieldSetsOf(site.plugins).filter((set) => !hasFieldSet(set, fields));
    const addSet = (set) => editing.update((current) => addFieldSet(current, set));
    const addTabRow = () => addTo((tree) => {
        const defaultName = tabLabel(site, DEFAULT_TAB);
        const name = unique(t("layout.newTab"), tree.tabs.map((tab, at) => (at === 0 ? (tree.defaultTab ?? defaultName) : tab.name)));
        return tabProblem(tree, name, undefined, defaultName) === null ? addTab(tree, name) : tree;
    });
    const card = (_jsxs(Panel, { ref: cardRef, className: cn("min-w-0 overflow-hidden", TREE_MAX_WIDTH), "data-testid": "fields-card", children: [_jsxs("div", { className: "flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b px-4 py-3.5", children: [_jsxs("div", { className: "min-w-0", children: [_jsxs("h4", { className: "font-semibold text-sm", children: [t("field.title"), " ", _jsx("span", { className: "font-medium text-monti-muted-foreground", children: names.length })] }), _jsx("p", { className: "mt-0.5 truncate text-monti-muted-foreground text-xs", title: t("fields.hint"), children: t("fields.hint") })] }), _jsxs("div", { className: "flex flex-wrap items-center gap-2 whitespace-nowrap", children: [_jsx(IconButton, { label: t("layout.preview"), size: "icon-sm", pressed: previewOpen, onClick: () => setPreviewOpen(!previewOpen), children: _jsx(Eye, { "aria-hidden": true }) }), _jsxs(Button, { type: "button", variant: "secondary", size: "sm", disabled: disabled, onClick: addTabRow, children: [_jsx(Plus, { "aria-hidden": true }), t("layout.addTab")] }), _jsxs(Button, { type: "button", variant: "secondary", size: "sm", disabled: disabled, onClick: addGroupRow, children: [_jsx(Plus, { "aria-hidden": true }), t("layout.addGroup")] }), offeredSets.map((set) => (_jsxs(Button, { type: "button", variant: "secondary", size: "sm", disabled: disabled, onClick: () => addSet(set), children: [_jsx(Plus, { "aria-hidden": true }), t("fields.addSet", { name: set.label })] }, `${set.plugin}:${set.id}`))), _jsxs(Button, { type: "button", variant: "outline", size: "sm", disabled: disabled, onClick: () => setAdding(true), children: [_jsx(Plus, { "aria-hidden": true }), t("field.add")] })] })] }), _jsxs("div", { className: cn(columnsOf(ctx.compact), "border-b py-2 pr-5 pl-9 text-monti-muted-foreground text-xs"), "aria-hidden": true, children: [_jsx("span", { children: t("fields.colField") }), _jsx("span", { children: t("fields.colKind") }), _jsx("span", { className: cn("hidden", !ctx.compact && "block"), children: t("fields.colSettings") })] }), _jsx("div", { className: "py-1.5 pb-2.5", children: names.length === 0 ? (_jsx("p", { className: "px-5 py-3 text-monti-muted-foreground text-xs", children: t("field.none") })) : (_jsx(LayoutTree, { editing: editing, ctx: ctx })) }), _jsxs("div", { className: "flex flex-wrap gap-x-5 gap-y-1 border-t px-5 py-2.5 text-monti-muted-foreground text-xs", children: [_jsxs("span", { children: [_jsx("span", { className: cn("font-mono", REQUIRED), children: "!" }), " ", t("fields.legendRequired")] }), _jsxs("span", { children: [_jsx("span", { className: cn("font-mono", TONE.relation), children: "\u2192" }), " ", t("fields.legendRelation")] }), _jsxs("span", { children: [_jsx("span", { className: cn("font-mono", TONE.backlink), children: "\u2190" }), " ", t("fields.legendBacklink")] }), _jsxs("span", { children: [_jsx("span", { className: cn("font-mono", OPTION), children: "= \"\u2026\"" }), " ", t("fields.legendOption")] }), _jsx("span", { className: "flex-1" }), _jsx("span", { children: t("fields.legendOpen") })] }), adding && (_jsx(AddFieldDialog, { editing: editing, place: {}, onClose: () => setAdding(false), onAdded: () => setAdding(false) })), sheet && (_jsx(FieldSheet, { editing: editing, place: sheet.place, name: sheet.name, onClose: () => setSheet(null) }, `${sheet.name}`))] }));
    const preview = (_jsx(LayoutPreview, { file: file, collection: editing.collectionName, codeCollections: codeCollections, onClose: () => setPreviewOpen(false) }));
    return (_jsxs(_Fragment, { children: [wide && previewOpen ? (_jsxs("div", { className: "grid grid-cols-[minmax(0,1000px)_var(--panel-width)] items-start gap-6", style: sideResize.style, children: [card, _jsxs("div", { className: "sticky top-4 flex h-[min(48rem,calc(100vh-6rem))] flex-col", "data-testid": "layout-preview-side", children: [_jsx(PanelResizeHandle, { resize: sideResize, className: "-left-3.5" }), preview] })] })) : (card), !wide && previewOpen && _jsx(PreviewDrawer, { preview: preview, onClose: () => setPreviewOpen(false) })] }));
}
