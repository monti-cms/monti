"use client";
import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useSite, useTranslator } from "@monti-cms/core/client";
import { useQuery } from "@tanstack/react-query";
import { Lock, Plus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { cn } from "../../lib/utils/cn.js";
import { Alert, AlertDescription, AlertTitle } from "../../ui/alert.js";
import { Badge } from "../../ui/badge.js";
import { Button } from "../../ui/button.js";
import { Input } from "../../ui/input.js";
import { Skeleton } from "../../ui/skeleton.js";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../ui/tabs.js";
import { errorText } from "../admin-api.js";
import { AdminShell } from "../shared/admin-shell.js";
import { useConfirm } from "../shared/confirm-dialog.js";
import { CollectionEditor } from "./collection-editor.js";
import { IssueList, Labeled, Pick, SchemaEditProvider } from "./controls.js";
import { LocalesEditor } from "./locales-editor.js";
import { schemaMessages } from "./messages.js";
import { reloadPage, rememberSaved, takeSavedMessage } from "./reload.js";
import { ReviewDialog } from "./review-dialog.js";
import { fetchSchema, SCHEMA_KEY } from "./schema-api.js";
import { addCollection, collectionsOf, isObj, localesOf, nameProblem, recordRename, removeCollection, sameJson, setCollection, } from "./schema-model.js";
/** Why a schema file may not be edited here, as the key of the sentence that says it. */
const READ_ONLY_KEY = {
    production: "readonly.production",
    no_schema_file: "readonly.noFile",
    not_writable: "readonly.notWritable",
};
function AddCollection({ taken, onAdd, }) {
    const t = useTranslator(schemaMessages);
    const [name, setName] = useState("");
    const [kind, setKind] = useState("document");
    const problem = name === "" ? null : nameProblem(name, taken);
    return (_jsxs("div", { className: "flex flex-wrap items-end gap-2 rounded-lg border border-dashed p-2", "data-testid": "add-collection", children: [_jsx(Labeled, { label: t("collection.newName"), className: "min-w-32 flex-1", children: _jsx(Input, { value: name, "aria-label": t("collection.newName"), placeholder: "article", "aria-invalid": problem ? true : undefined, onChange: (event) => setName(event.target.value) }) }), _jsx(Pick, { label: t("collection.kind"), className: "w-36", value: kind, items: [
                    { value: "document", label: t("collection.kindDocument") },
                    { value: "item", label: t("collection.kindItem") },
                ], onChange: (value) => setKind(value) }), _jsxs(Button, { type: "button", variant: "outline", size: "sm", disabled: name === "" || problem !== null, onClick: () => {
                    onAdd(name, kind);
                    setName("");
                }, children: [_jsx(Plus, { "aria-hidden": true }), t("collection.add")] }), problem && _jsx("p", { className: "w-full text-cms-destructive text-xs", children: t(`name.${problem}`) })] }));
}
/** The parts of the file the screen does not edit: site and admin settings and seed data (shown as they are), and the transforms already recorded. */
function FileInfo({ file }) {
    const t = useTranslator(schemaMessages);
    const migrations = Array.isArray(file.migrations) ? file.migrations : [];
    const rest = ["site", "admin", "seed"].filter((key) => file[key] !== undefined);
    return (_jsxs("div", { className: "flex flex-col gap-4", children: [_jsx("p", { className: "text-cms-muted-foreground text-xs", children: t("file.hint") }), rest.map((key) => (_jsxs("section", { className: "flex flex-col gap-1", children: [_jsx("h4", { className: "font-medium text-sm", children: key }), _jsx("pre", { className: "max-h-64 overflow-auto rounded-md border bg-cms-muted/40 p-2 text-xs", children: JSON.stringify(file[key], null, 2) })] }, key))), _jsxs("section", { className: "flex flex-col gap-1", children: [_jsx("h4", { className: "font-medium text-sm", children: t("file.migrations") }), migrations.length === 0 ? (_jsx("p", { className: "text-cms-muted-foreground text-xs", children: t("file.noMigrations") })) : (_jsx("ul", { className: "flex flex-col gap-1 text-xs", children: migrations.map((migration) => (_jsxs("li", { className: "rounded-md border px-2 py-1", children: [_jsx("code", { children: String(migration.id) }), " ", _jsx("span", { className: "text-cms-muted-foreground", children: String(migration.op) })] }, String(migration.id)))) }))] })] }));
}
function SchemaEditor({ state }) {
    const t = useTranslator(schemaMessages);
    const base = useMemo(() => (isObj(state.schema) ? state.schema : {}), [state.schema]);
    const writable = state.access.writable;
    const [draft, setDraft] = useState(base);
    const [renames, setRenames] = useState([]);
    const [issues, setIssues] = useState([]);
    const [reviewing, setReviewing] = useState(false);
    const [applyFailed, setApplyFailed] = useState(false);
    const [tab, setTab] = useState("collections");
    const collections = collectionsOf(draft);
    const names = Object.keys(collections);
    const [selectedName, setSelected] = useState(names[0]);
    const selected = selectedName && selectedName in collections ? selectedName : names[0];
    const { confirm, dialog } = useConfirm();
    const dirty = !sameJson(draft, base);
    const savedNames = Object.keys(collectionsOf(base));
    useEffect(() => {
        const message = takeSavedMessage();
        if (message)
            toast.success(message);
    }, []);
    useEffect(() => {
        if (!dirty)
            return;
        const warn = (event) => event.preventDefault();
        window.addEventListener("beforeunload", warn);
        return () => window.removeEventListener("beforeunload", warn);
    }, [dirty]);
    const updateFile = (change) => setDraft((current) => change(current));
    const context = useMemo(() => ({
        disabled: !writable,
        vocabulary: state.vocabulary,
        issues,
        collectionNames: names,
        file: draft,
    }), [writable, state.vocabulary, issues, names, draft]);
    const discard = async () => {
        const ok = await confirm({
            title: t("discard.title"),
            description: t("discard.description"),
            confirmLabel: t("discard.confirm"),
            destructive: true,
        });
        if (!ok)
            return;
        setDraft(base);
        setRenames([]);
        setIssues([]);
    };
    const reason = state.access.writable ? null : state.access.reason;
    return (_jsxs(SchemaEditProvider, { value: context, children: [_jsxs("div", { className: "flex min-h-0 flex-1 flex-col", "data-testid": "schema-screen", children: [_jsxs("div", { className: "flex flex-wrap items-center gap-2 border-b px-4 py-2.5 lg:px-5", children: [_jsx("code", { className: "rounded bg-cms-muted px-1.5 py-0.5 text-xs", children: state.file ?? t("status.noFile") }), _jsx(Badge, { variant: "secondary", children: t("status.version", { version: state.schemaVersion }) }), _jsx(Badge, { variant: "outline", children: state.applied ? t("status.applied", { version: state.applied.schemaVersion }) : t("status.notApplied") }), !writable && (_jsxs(Badge, { variant: "outline", className: "gap-1", children: [_jsx(Lock, { "aria-hidden": true }), t("status.readOnly")] })), _jsxs("div", { className: "ml-auto flex items-center gap-2", children: [dirty && writable && (_jsxs(_Fragment, { children: [_jsx(Button, { type: "button", variant: "ghost", size: "sm", onClick: () => void discard(), children: t("actions.discard") }), _jsx("span", { className: "hidden text-cms-muted-foreground text-xs sm:inline", children: t("actions.unsaved") })] })), _jsx(Button, { type: "button", size: "sm", disabled: !writable || !dirty, onClick: () => setReviewing(true), children: t("actions.review") })] })] }), _jsx("div", { className: "min-h-0 flex-1 overflow-y-auto", children: _jsxs("div", { className: "mx-auto flex w-full max-w-5xl flex-col gap-4 px-4 py-4 lg:px-5", children: [reason && (_jsxs(Alert, { layout: "stack", "data-testid": "schema-read-only", children: [_jsx(AlertTitle, { children: t("readonly.title") }), _jsx(AlertDescription, { children: t(READ_ONLY_KEY[reason]) })] })), applyFailed && (_jsx(Alert, { variant: "danger", layout: "stack", children: _jsx(AlertDescription, { children: t("save.applyFailedNote") }) })), state.issues.length > 0 && (_jsxs(Alert, { variant: "danger", layout: "stack", "data-testid": "schema-file-invalid", children: [_jsx(AlertTitle, { children: t("invalid.title") }), _jsxs(AlertDescription, { className: "flex flex-col gap-2", children: [_jsx("span", { children: t("invalid.description") }), _jsx(IssueList, { issues: state.issues })] })] })), issues.length > 0 && !reviewing && (_jsxs(Alert, { variant: "danger", layout: "stack", children: [_jsx(AlertTitle, { children: t("issues.title") }), _jsx(AlertDescription, { children: _jsx(IssueList, { issues: issues }) })] })), state.codeCollections.length > 0 && (_jsx(Alert, { layout: "stack", children: _jsx(AlertDescription, { children: t("code.collections", { names: state.codeCollections.join(", ") }) }) })), state.issues.length === 0 && (_jsxs(Tabs, { value: tab, onValueChange: (value) => typeof value === "string" && setTab(value), children: [_jsxs(TabsList, { className: "w-full justify-start sm:w-fit", children: [_jsx(TabsTrigger, { value: "collections", children: t("tabs.collections") }), _jsx(TabsTrigger, { value: "locales", children: t("tabs.locales") }), _jsx(TabsTrigger, { value: "file", children: t("tabs.file") })] }), _jsx(TabsContent, { value: "collections", className: "pt-3", children: _jsxs("div", { className: "flex flex-col gap-4 lg:flex-row", children: [_jsxs("div", { className: "flex shrink-0 flex-col gap-2 lg:w-52", children: [_jsx("nav", { "aria-label": t("tabs.collections"), className: "flex gap-1 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible lg:pb-0", children: names.map((name) => {
                                                                    const collection = collections[name];
                                                                    const active = name === selected;
                                                                    return (_jsxs(Button, { type: "button", variant: active ? "secondary" : "ghost", size: "sm", "aria-current": active ? "true" : undefined, className: cn("shrink-0 justify-start", active && "font-medium"), onClick: () => setSelected(name), children: [_jsx("span", { className: "truncate", children: String(collection?.label ?? name) }), !savedNames.includes(name) && _jsx(Badge, { variant: "outline", children: t("collection.new") })] }, name));
                                                                }) }), writable && (_jsx(AddCollection, { taken: names, onAdd: (name, kind) => {
                                                                    updateFile((file) => addCollection(file, name, kind));
                                                                    setSelected(name);
                                                                } }))] }), _jsx("div", { className: "min-w-0 flex-1", children: selected && collections[selected] ? (_jsx(CollectionEditor, { name: selected, collection: collections[selected], isNew: !savedNames.includes(selected), onChange: (change) => updateFile((file) => setCollection(file, selected, change)), onRename: (rename) => setRenames((current) => recordRename(current, rename)), onRemove: async () => {
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
                                                            } }, selected)) : (_jsx("p", { className: "text-cms-muted-foreground text-sm", children: t("collection.none") })) })] }) }), _jsx(TabsContent, { value: "locales", className: "pt-3", children: _jsx(LocalesEditor, { file: draft, savedCodes: localesOf(base).map((locale) => locale.code), update: updateFile }) }), _jsx(TabsContent, { value: "file", className: "pt-3", children: _jsx(FileInfo, { file: draft }) })] }))] }) })] }), dialog, state.hash !== null && (_jsx(ReviewDialog, { open: reviewing, onOpenChange: setReviewing, draft: draft, renames: renames, baseHash: state.hash, onIssues: setIssues, onApplyFailed: () => setApplyFailed(true), onSaved: (saved) => {
                    rememberSaved(t("save.done", {
                        version: saved.schemaVersion,
                        transforms: saved.transforms.length,
                        entries: saved.entriesRewritten,
                    }));
                    reloadPage();
                } }))] }));
}
/** The schema settings screen: edits `monti.schema.json` on the development server, shows it read-only everywhere else. */
export function SchemaScreen() {
    const site = useSite();
    const t = useTranslator(schemaMessages);
    const query = useQuery({
        queryKey: SCHEMA_KEY,
        queryFn: ({ signal }) => fetchSchema(site, signal),
        // The file is the truth: a screen that was open while it changed would edit a stale copy.
        staleTime: 0,
        refetchOnWindowFocus: false,
    });
    const error = query.error ? errorText(site, query.error, t("load.failed")) : null;
    return (_jsx(AdminShell, { title: t("title"), sidebar: { activeNav: "schema" }, children: query.data ? (_jsx(SchemaEditor, { state: query.data }, query.data.hash ?? "site")) : (_jsx("div", { className: "flex flex-col gap-3 p-5", children: error ? (_jsx(Alert, { variant: "danger", layout: "stack", children: _jsxs(AlertDescription, { className: "flex items-center gap-3", children: [error, _jsx(Button, { type: "button", variant: "outline", size: "sm", onClick: () => void query.refetch(), children: t("load.retry") })] }) })) : (_jsx(Skeleton, { className: "h-40 w-full" })) })) }));
}
