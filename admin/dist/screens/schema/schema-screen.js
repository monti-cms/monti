"use client";
import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useSite, useTranslator } from "@monti-cms/core/site";
import { useQuery } from "@tanstack/react-query";
import { GripVertical, Lock, Plus } from "lucide-react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import { errorText } from "../../api/client.js";
import { fetchSchema, schemaKeys } from "../../api/schema.js";
import { commonMessages } from "../../lib/common.messages.js";
import { cn } from "../../lib/utils/cn.js";
import { moveWithin } from "../../lib/utils/move-within.js";
import { Alert, AlertDescription, AlertTitle } from "../../ui/alert.js";
import { Badge } from "../../ui/badge.js";
import { Button } from "../../ui/button.js";
import { IconButton } from "../../ui/icon-button.js";
import { Skeleton } from "../../ui/skeleton.js";
import { rememberScroll, takeScroll, useSettingsParam } from "../settings/place.js";
import { discardConfirm, useConfirm } from "../shared/confirm-dialog.js";
import { LoadErrorAlert } from "../shared/load-error-alert.js";
import { PageBody } from "../shared/page-body.js";
import { Section } from "../shared/section.js";
import { useUnsavedGuard } from "../shared/use-unsaved-guard.js";
import { AdminEditor } from "./admin-editor.js";
import { CollectionEditor } from "./collection-editor.js";
import { IssueList, SchemaEditProvider } from "./controls.js";
import { SortableList } from "./fields-tree-dnd.js";
import { describeLiteralIssue } from "./literal-issue.js";
import { LocalesEditor } from "./locales-editor.js";
import { schemaMessages } from "./messages.js";
import { NewCollectionDialog } from "./new-collection-dialog.js";
import { reloadPage, rememberSaved, takeSavedMessage } from "./reload.js";
import { ReviewDialog } from "./review-dialog.js";
import { addCollection, changeCount, collectionsOf, isObj, recordRename, removeCollection, reorderCollections, sameJson, setCollection, settingChanges, } from "./schema-model.js";
import { SiteEditor } from "./site-editor.js";
/** Why a schema file may not be edited here, as the key of the sentence that says it. */
const READ_ONLY_KEY = {
    production: "readonly.production",
    no_schema_file: "readonly.noFile",
    not_writable: "readonly.notWritable",
    has_code: "readonly.hasCode",
};
/** The same reasons in a few words, for the line under the Settings title. */
const READ_ONLY_SHORT_KEY = {
    production: "readonly.short.production",
    no_schema_file: "readonly.short.noFile",
    not_writable: "readonly.short.notWritable",
    has_code: "readonly.short.hasCode",
};
/** The parts of the file the screen does not edit: seed data, the admin text overrides (shown as they are), and the transforms already recorded. Nothing shows when the file has none of them. */
function FileRest({ file }) {
    const t = useTranslator(schemaMessages);
    const migrations = Array.isArray(file.migrations) ? file.migrations : [];
    const messages = isObj(file.admin) ? file.admin.messages : undefined;
    const rest = [
        ...(messages !== undefined ? [[t("file.messages"), messages]] : []),
        ...(file.seed !== undefined ? [["seed", file.seed]] : []),
    ];
    if (rest.length === 0 && migrations.length === 0)
        return null;
    return (_jsxs(_Fragment, { children: [rest.map(([title, value]) => (_jsx(Section, { wide: true, title: title, note: t("file.hint"), children: _jsx("pre", { className: "max-h-64 overflow-auto rounded-md bg-monti-muted/60 p-3 text-xs", children: JSON.stringify(value, null, 2) }) }, title))), migrations.length > 0 && (_jsx(Section, { wide: true, title: t("file.migrations"), children: _jsx("ul", { className: "-my-2 flex flex-col divide-y text-sm", children: migrations.map((migration) => (_jsxs("li", { className: "flex items-center gap-2 py-2", children: [_jsx("code", { className: "text-xs", children: String(migration.id) }), " ", _jsx("span", { className: "text-monti-muted-foreground text-xs", children: String(migration.op) })] }, String(migration.id)))) }) }))] }));
}
/** The chip next to the Settings title: the schema file, and why it is read-only when it is. */
function FileLine({ state, reason }) {
    const t = useTranslator(schemaMessages);
    return (_jsxs("span", { className: "inline-flex items-center gap-1.5 rounded-full border border-monti-border bg-monti-muted/40 px-2.5 py-0.5 font-mono text-monti-muted-foreground text-xs", children: [state.file ?? t("status.noFile"), reason && ` · ${t("status.readOnly")}: ${t(READ_ONLY_SHORT_KEY[reason])}`] }));
}
function CollectionNavItem({ name, collection, active, isNew, writable, onSelect, }) {
    const t = useTranslator(schemaMessages);
    const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
        id: name,
        disabled: !writable,
    });
    const label = String(collection?.label ?? name);
    return (_jsxs("div", { ref: setNodeRef, style: { transform: CSS.Translate.toString(transform), transition }, className: cn("group/row relative flex items-center", isDragging && "z-10 opacity-80"), "data-testid": `collection-nav-${name}`, children: [writable && (_jsx("button", { type: "button", ref: setActivatorNodeRef, ...attributes, ...listeners, "aria-label": t("collection.drag", { name: label }), className: "absolute top-1/2 left-1 z-10 flex size-5 -translate-y-1/2 cursor-grab touch-none items-center justify-center rounded-sm text-monti-muted-foreground opacity-0 outline-none hover:text-monti-foreground focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-monti-ring/50 group-hover/row:opacity-100", children: _jsx(GripVertical, { "aria-hidden": true, className: "size-3.5" }) })), _jsxs("button", { type: "button", "aria-current": active ? "true" : undefined, className: cn("flex h-8 w-full shrink-0 items-center gap-2 rounded-md border border-transparent px-2.5 text-left text-sm outline-none transition-colors hover:bg-monti-muted focus-visible:ring-2 focus-visible:ring-monti-ring/50", writable && "group-focus-within/row:pl-7 group-hover/row:pl-7", active && "border-monti-border bg-monti-card font-medium hover:bg-monti-card"), onClick: onSelect, children: [_jsx("span", { className: "flex-1 truncate", children: label }), isNew && _jsx(Badge, { variant: "outline", children: t("collection.new") }), _jsx("span", { className: "font-normal text-monti-muted-foreground text-xs", children: t(collection?.kind === "item" ? "collection.kindItem" : "collection.kindDocument") })] })] }));
}
function SchemaEditor({ state, tab, actionsSlot, fileSlot, onTab, }) {
    const t = useTranslator(schemaMessages);
    const base = useMemo(() => (isObj(state.schema) ? state.schema : {}), [state.schema]);
    const writable = state.access.writable;
    const [draft, setDraft] = useState(base);
    const [renames, setRenames] = useState([]);
    const [issues, setIssues] = useState([]);
    const [reviewing, setReviewing] = useState(false);
    const [applyFailed, setApplyFailed] = useState(false);
    const [creating, setCreating] = useState(false);
    const collections = collectionsOf(draft);
    const names = Object.keys(collections);
    // Which collection is open and which of its parts live in the address, so a reload after saving comes back to the same place.
    const [selectedName, setSelectedName] = useSettingsParam("collection");
    const [section, setSection] = useSettingsParam("section");
    const setSelected = (name) => {
        setSelectedName(name);
        setSection(undefined);
    };
    const scroller = useRef(null);
    const selected = selectedName && selectedName in collections ? selectedName : names[0];
    const tc = useTranslator(commonMessages);
    const { confirm, dialog } = useConfirm();
    const dirty = !sameJson(draft, base);
    const { dialog: guardDialog } = useUnsavedGuard(dirty);
    const pending = changeCount(base, draft);
    const savedNames = Object.keys(collectionsOf(base));
    useEffect(() => {
        const message = takeSavedMessage();
        if (message)
            toast.success(message);
    }, []);
    // After the reload that follows a save, scroll back to where the writer was.
    useLayoutEffect(() => {
        const top = takeScroll();
        if (top !== null && scroller.current)
            scroller.current.scrollTop = top;
    }, []);
    const updateFile = (change) => setDraft((current) => change(current));
    const context = useMemo(() => ({
        disabled: !writable,
        vocabulary: state.vocabulary,
        issues,
        collectionNames: names,
        codeCollections: state.codeCollections,
        file: draft,
    }), [writable, state.vocabulary, issues, names, state.codeCollections, draft]);
    const discard = async () => {
        const ok = await confirm(discardConfirm(tc));
        if (!ok)
            return;
        setDraft(base);
        setRenames([]);
        setIssues([]);
    };
    const actions = (_jsxs(_Fragment, { children: [!writable && (_jsxs(Badge, { variant: "outline", className: "gap-1", children: [_jsx(Lock, { "aria-hidden": true }), t("status.readOnly")] })), dirty && writable && (_jsxs(_Fragment, { children: [_jsx(Button, { type: "button", variant: "ghost", size: "sm", onClick: () => void discard(), children: t("actions.discard") }), _jsx("span", { className: "hidden text-monti-muted-foreground text-xs sm:inline", children: t("header.pending", { count: pending }) })] })), _jsx(Button, { type: "button", variant: dirty && writable ? "default" : "outline", size: "sm", disabled: !writable || !dirty, onClick: () => setReviewing(true), children: dirty && writable ? t("actions.review") : t("actions.noChanges") })] }));
    const reason = state.access.writable
        ? null
        : (state.access.reason ?? null);
    return (_jsxs(SchemaEditProvider, { value: context, children: [_jsxs("div", { className: "flex min-h-0 flex-1 flex-col", "data-testid": "schema-screen", children: [fileSlot ? createPortal(_jsx(FileLine, { state: state, reason: reason }), fileSlot) : null, actions && actionsSlot !== undefined
                        ? actionsSlot
                            ? createPortal(actions, actionsSlot)
                            : null
                        : actions && (_jsx("div", { className: "flex items-center justify-end gap-2.5 border-b bg-monti-background px-4 py-2 lg:px-10", children: actions })), _jsx("div", { ref: scroller, className: "min-h-0 flex-1 overflow-y-auto", children: _jsxs(PageBody, { wide: tab === "collections", children: [reason && (_jsxs(Alert, { layout: "stack", "data-testid": "schema-read-only", children: [_jsx(AlertTitle, { children: t("readonly.title") }), _jsxs(AlertDescription, { className: "flex flex-col gap-1", children: [_jsx("span", { children: t(READ_ONLY_KEY[reason]) }), reason === "has_code" && (state.access.issue || state.access.detail) && (_jsx("code", { className: "text-xs", "data-testid": "schema-code-detail", children: state.access.issue ? describeLiteralIssue(t, state.access.issue) : state.access.detail }))] })] })), writable && state.comments && (_jsx(Alert, { layout: "stack", "data-testid": "schema-comments-note", children: _jsx(AlertDescription, { children: t("comments.note") }) })), applyFailed && (_jsx(Alert, { variant: "destructive", layout: "stack", children: _jsx(AlertDescription, { children: t("save.applyFailedNote") }) })), state.issues.length > 0 && (_jsxs(Alert, { variant: "destructive", layout: "stack", "data-testid": "schema-file-invalid", children: [_jsx(AlertTitle, { children: t("invalid.title") }), _jsxs(AlertDescription, { className: "flex flex-col gap-2", children: [_jsx("span", { children: t("invalid.description") }), _jsx(IssueList, { issues: state.issues })] })] })), issues.length > 0 && !reviewing && (_jsxs(Alert, { variant: "destructive", layout: "stack", children: [_jsx(AlertTitle, { children: t("issues.title") }), _jsx(AlertDescription, { children: _jsx(IssueList, { issues: issues }) })] })), state.codeCollections.length > 0 && (_jsx(Alert, { layout: "stack", children: _jsx(AlertDescription, { children: t("code.collections", { names: state.codeCollections.join(", ") }) }) })), state.issues.length === 0 && (_jsxs(_Fragment, { children: [tab === "collections" && (_jsxs("div", { className: "flex flex-col gap-6 lg:flex-row lg:gap-8", children: [_jsxs("div", { className: "flex shrink-0 flex-col gap-0.5 lg:w-56", children: [_jsxs("div", { className: "flex items-center justify-between pb-2 pl-2.5", children: [_jsxs("span", { className: "font-medium text-monti-muted-foreground text-xs", children: [t("collection.railTitle"), " ", names.length] }), writable && (_jsx(IconButton, { label: t("collection.create"), size: "icon-xs", onClick: () => setCreating(true), children: _jsx(Plus, { "aria-hidden": true }) }))] }), _jsx("nav", { "aria-label": t("tabs.collections"), className: "flex gap-1 overflow-x-auto pb-1 lg:flex-col lg:gap-0.5 lg:overflow-visible lg:pb-0", children: _jsx(SortableList, { items: names, onDragEnd: (from, to) => {
                                                                    const fromIndex = names.indexOf(from);
                                                                    const toIndex = names.indexOf(to);
                                                                    if (fromIndex !== -1 && toIndex !== -1) {
                                                                        updateFile((file) => reorderCollections(file, moveWithin(names, fromIndex, toIndex)));
                                                                    }
                                                                }, children: names.map((name) => (_jsx(CollectionNavItem, { name: name, collection: collections[name], active: name === selected, isNew: !savedNames.includes(name), writable: writable, onSelect: () => setSelected(name) }, name))) }) })] }), _jsx("div", { className: "min-w-0 flex-1", children: selected && collections[selected] ? (_jsx(CollectionEditor, { name: selected, section: section, onSection: setSection, collection: collections[selected], isNew: !savedNames.includes(selected), onChange: (change) => updateFile((file) => setCollection(file, selected, change)), onRename: (rename) => setRenames((current) => recordRename(current, rename)), onFileChange: updateFile, onRemove: async () => {
                                                            if (savedNames.includes(selected)) {
                                                                const ok = await confirm({
                                                                    title: t("collection.removeTitle", { name: selected }),
                                                                    description: t("collection.removeDescription"),
                                                                    confirmLabel: t("collection.remove"),
                                                                    destructive: true,
                                                                });
                                                                if (!ok)
                                                                    return;
                                                            }
                                                            updateFile((file) => removeCollection(file, selected));
                                                        } }, selected)) : (_jsx("p", { className: "text-monti-muted-foreground text-sm", children: t("collection.none") })) })] })), tab === "locales" && _jsx(LocalesEditor, { file: draft, update: updateFile }), tab === "site" && _jsx(SiteEditor, { file: draft, siteUrl: state.siteUrl, update: updateFile }), tab === "admin" && (_jsxs("div", { className: "flex flex-col gap-12", children: [_jsx(AdminEditor, { file: draft, update: updateFile }), _jsx(FileRest, { file: draft })] }))] }))] }) })] }), dialog, guardDialog, _jsx(NewCollectionDialog, { open: creating, onOpenChange: setCreating, taken: names, onCreate: (id, kind, path, label) => {
                    updateFile((file) => addCollection(file, id, kind, path, label));
                    setSelected(id);
                    if (tab !== "collections")
                        onTab?.("collections");
                    setCreating(false);
                } }), state.hash !== null && (_jsx(ReviewDialog, { open: reviewing, onOpenChange: setReviewing, draft: draft, renames: renames, settings: settingChanges(base, draft), baseHash: state.hash, onIssues: setIssues, onApplyFailed: () => setApplyFailed(true), onSaved: (saved) => {
                    rememberScroll(scroller.current?.scrollTop ?? 0);
                    rememberSaved(t("save.done", {
                        transforms: saved.transforms.length,
                        entries: saved.entriesRewritten,
                    }));
                    reloadPage();
                } }))] }));
}
/** The schema file editor: edits `monti.schema.ts` on the development server, shows it read-only everywhere else. `tab` is the Settings tab being shown. */
export function SchemaSettings({ tab, actionsSlot, fileSlot, onTab, }) {
    const site = useSite();
    const t = useTranslator(schemaMessages);
    const query = useQuery({
        queryKey: schemaKeys.state(),
        queryFn: ({ signal }) => fetchSchema(site, signal),
        // The file is the truth: a screen that was open while it changed would edit a stale copy.
        staleTime: 0,
        refetchOnWindowFocus: false,
    });
    const error = query.error ? errorText(site, query.error, t("load.failed")) : null;
    if (query.data)
        return (_jsx(SchemaEditor, { state: query.data, tab: tab, actionsSlot: actionsSlot, fileSlot: fileSlot, onTab: onTab }, query.data.hash ?? "site"));
    return (_jsx("div", { className: "flex flex-col gap-3 p-4 lg:p-10", children: error ? (_jsx(LoadErrorAlert, { message: error, onRetry: () => void query.refetch() })) : (_jsx(Skeleton, { className: "h-40 w-full" })) }));
}
