"use client";
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useSite, useTranslator } from "@monti-cms/core/client";
import { KeyRound, Pencil, Plus, RefreshCw, Trash2, Unplug } from "lucide-react";
import { useId, useState } from "react";
import { apiKeysKeys, createApiKey, deleteApiKey, putApiKeySlot, updateApiKey, useApiKeys } from "../../api/api-keys.js";
import { errorText } from "../../api/client.js";
import { useCmsMutation } from "../../api/use-cms-mutation.js";
import { Alert, AlertDescription, AlertTitle } from "../../ui/alert.js";
import { Badge } from "../../ui/badge.js";
import { Button } from "../../ui/button.js";
import { Panel } from "../../ui/card.js";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "../../ui/dialog.js";
import { DialogFormFooter } from "../../ui/dialog-form-footer.js";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "../../ui/empty.js";
import { FieldError } from "../../ui/field.js";
import { Input } from "../../ui/input.js";
import { Skeleton } from "../../ui/skeleton.js";
import { MoreActionsButton } from "../shared/action-menu.js";
import { PageActions } from "../shared/admin-shell.js";
import { useConfirm } from "../shared/confirm-dialog.js";
import { Labeled } from "../shared/labeled.js";
import { LoadErrorAlert } from "../shared/load-error-alert.js";
import { PageBody } from "../shared/page-body.js";
import { Section } from "../shared/section.js";
import { ApiKeyField, choiceReady } from "./api-key-field.js";
import { apiKeysMessages } from "./messages.js";
/** The API keys page: one card with a row per key, the one primary action ("Add key") in the page header, and the dialogs to add, rename, replace and delete. */
export function ApiKeysSettings() {
    const t = useTranslator(apiKeysMessages);
    const query = useApiKeys();
    const [editing, setEditing] = useState(null);
    const [slotEditing, setSlotEditing] = useState(null);
    const { confirm, dialog } = useConfirm();
    const remove = useCmsMutation({
        fn: (key, { site }) => deleteApiKey(site, key, { force: key.uses.length > 0, fallback: t("error.delete") }),
        success: t("toast.deleted"),
        failure: t("error.delete"),
        invalidate: [apiKeysKeys.all],
    });
    const clearSlot = useCmsMutation({
        fn: ({ plugin, slot }, { site }) => putApiKeySlot(site, plugin, slot, { use: "none" }, t("error.save")),
        success: (_result, { label }) => t("toast.slotCleared", { label }),
        failure: t("error.save"),
        invalidate: [apiKeysKeys.all],
    });
    const list = query.data;
    const askDelete = async (key) => {
        const used = key.uses.length > 0;
        const ok = await confirm({
            title: t("delete.title", { name: key.name }),
            description: used ? (_jsxs("div", { className: "flex flex-col gap-2", children: [_jsx("p", { children: t("delete.usedDescription", { count: key.uses.length }) }), _jsx("ul", { className: "list-disc pl-5", "data-testid": "delete-dependents", children: key.uses.map((use) => (_jsx("li", { children: use.label }, `${use.plugin}:${use.ref}`))) })] })) : (t("delete.unusedDescription")),
            confirmLabel: t("delete.confirm"),
            destructive: true,
        });
        // A failure is toasted by the mutation.
        if (ok)
            await remove.mutateAsync(key).catch(() => { });
    };
    const rowMenu = (key) => [
        { kind: "item", label: t("menu.rename"), icon: Pencil, onSelect: () => setEditing({ mode: "rename", key }) },
        { kind: "item", label: t("menu.replace"), icon: RefreshCw, onSelect: () => setEditing({ mode: "replace", key }) },
        ...key.slots.map((use) => ({
            kind: "item",
            label: t("menu.clearSlot", { label: use.label }),
            icon: Unplug,
            onSelect: () => clearSlot.mutate({ plugin: use.plugin, slot: use.ref, label: use.label }),
        })),
        { kind: "separator" },
        { kind: "item", label: t("menu.delete"), icon: Trash2, destructive: true, onSelect: () => askDelete(key) },
    ];
    return (_jsxs(PageBody, { "data-testid": "api-keys-settings", children: [_jsx(PageActions, { children: _jsxs(Button, { type: "button", size: "sm", disabled: !list?.secretsAvailable, onClick: () => setEditing({ mode: "add" }), children: [_jsx(Plus, { "aria-hidden": true }), t("add")] }) }), list && !list.secretsAvailable && (_jsxs(Alert, { variant: "destructive", layout: "stack", children: [_jsx(AlertTitle, { children: t("secret.title") }), _jsx(AlertDescription, { children: t("secret.description") })] })), _jsx(Section, { wide: true, card: false, title: t("title"), description: t("description"), note: t("note"), children: _jsxs(Panel, { className: "overflow-hidden", children: [_jsx("div", { className: "flex items-center justify-between gap-3 border-b px-4 py-3", children: _jsx("span", { className: "text-cms-muted-foreground text-sm", children: list
                                    ? [
                                        t("count.keys", { count: list.items.length }),
                                        ...(list.slots.some((slot) => !slot.key)
                                            ? [t("count.needed", { count: list.slots.filter((slot) => !slot.key).length })]
                                            : []),
                                    ].join(" · ")
                                    : "\u00a0" }) }), _jsx(KeyRows, { query: query, menu: rowMenu, onAssign: setSlotEditing, onRetry: () => void query.refetch(), onAdd: () => setEditing({ mode: "add" }) })] }) }), editing && (_jsx(KeyDialog, { editing: editing, taken: (list?.items ?? []).filter((item) => editing.mode === "add" || item.id !== editing.key.id), onClose: () => setEditing(null) }, editing.mode === "add" ? "add" : `${editing.mode}:${editing.key.id}`)), slotEditing && (_jsx(SlotDialog, { slot: slotEditing, onClose: () => setSlotEditing(null) }, `${slotEditing.plugin}:${slotEditing.slot}`)), dialog] }));
}
function KeyRows({ query, menu, onAssign, onRetry, onAdd, }) {
    const t = useTranslator(apiKeysMessages);
    const site = useSite();
    const list = query.data;
    if (!list) {
        if (query.error) {
            return (_jsx(LoadErrorAlert, { message: errorText(site, query.error, t("load.failed")), onRetry: onRetry, className: "m-3 w-auto" }));
        }
        return _jsx(Skeleton, { className: "m-4 h-12" });
    }
    const emptySlots = list.slots.filter((slot) => !slot.key);
    if (list.items.length === 0 && list.slots.length === 0) {
        return (_jsxs(Empty, { children: [_jsxs(EmptyHeader, { children: [_jsx(EmptyMedia, { variant: "icon", children: _jsx(KeyRound, { "aria-hidden": true }) }), _jsx(EmptyTitle, { children: t("empty.title") }), _jsx(EmptyDescription, { children: t("empty.description") })] }), _jsx(EmptyContent, { children: _jsxs(Button, { type: "button", size: "sm", variant: "outline", disabled: !list.secretsAvailable, onClick: onAdd, children: [_jsx(Plus, { "aria-hidden": true }), t("add")] }) })] }));
    }
    return (_jsxs("ul", { className: "divide-y", "aria-label": t("title"), children: [list.items.map((key) => (_jsxs("li", { className: "flex items-center gap-3.5 px-4 py-3", "data-testid": `api-key-${key.name}`, children: [_jsxs("div", { className: "min-w-0 flex-1", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("span", { className: "truncate font-medium text-sm", children: key.name }), !key.readable && (_jsx(Badge, { variant: "destructive", title: t("row.unreadableHint"), children: t("row.unreadable") }))] }), _jsx("p", { className: "mt-0.5 truncate text-cms-muted-foreground text-xs", children: !key.readable
                                    ? t("row.unreadableHint")
                                    : key.uses.length > 0
                                        ? t("row.usedBy", { uses: key.uses.map((use) => use.label).join(", ") })
                                        : t("row.unused") })] }), _jsxs("span", { className: "shrink-0 font-mono text-cms-muted-foreground text-xs", title: key.tail ? t("row.mask", { tail: key.tail }) : t("row.maskShort"), children: ["••••", key.tail] }), _jsx(MoreActionsButton, { label: t("row.menu", { name: key.name }), actions: menu(key) })] }, key.id))), emptySlots.map((slot) => (_jsxs("li", { className: "flex items-center gap-3.5 px-4 py-3", "data-testid": `api-key-slot-${slot.plugin}-${slot.slot}`, children: [_jsx("div", { className: "min-w-0 flex-1", children: _jsxs("div", { className: "flex items-center gap-2", children: [_jsx("span", { className: "truncate font-medium text-sm", children: slot.label }), _jsx("span", { className: "text-cms-muted-foreground text-xs", children: t("slot.empty") })] }) }), _jsx(Button, { type: "button", variant: "outline", size: "xs", disabled: !list.secretsAvailable, onClick: () => onAssign(slot), children: t("slot.assign") })] }, `${slot.plugin}:${slot.slot}`)))] }));
}
/** Pick a saved key or enter a new one for a plugin's key slot; a typed key is saved together with the assignment. */
function SlotDialog({ slot, onClose }) {
    const t = useTranslator(apiKeysMessages);
    const site = useSite();
    const query = useApiKeys();
    const hasKeys = (query.data?.items.length ?? 0) > 0;
    const [choice, setChoice] = useState(null);
    const current = choice ?? (hasKeys ? { use: "saved", keyId: query.data?.items[0]?.id ?? "" } : { use: "new", value: "" });
    const [error, setError] = useState(null);
    const assign = useCmsMutation({
        fn: (choice, { site }) => putApiKeySlot(site, slot.plugin, slot.slot, choice, t("error.save")),
        success: t("toast.slotAssigned"),
        failure: t("error.save"),
        inline: true,
        invalidate: [apiKeysKeys.all],
        onSuccess: onClose,
        onError: (saveError) => setError(errorText(site, saveError, t("error.save"))),
    });
    const saving = assign.isPending;
    const save = () => {
        setError(null);
        assign.mutate(current);
    };
    return (_jsx(Dialog, { open: true, onOpenChange: (open) => !open && onClose(), children: _jsx(DialogContent, { "data-testid": "api-key-slot-dialog", children: _jsxs("form", { className: "grid gap-5", onSubmit: (event) => {
                    event.preventDefault();
                    void save();
                }, children: [_jsxs(DialogHeader, { children: [_jsx(DialogTitle, { children: t("slot.dialog.title", { label: slot.label }) }), _jsx(DialogDescription, { children: t("slot.dialog.description") })] }), _jsx(ApiKeyField, { value: current, onChange: setChoice, baseName: slot.service }), error && _jsx(FieldError, { children: error }), _jsx(DialogFormFooter, { onCancel: onClose, busy: saving, disabled: !choiceReady(current), submitLabel: t("slot.dialog.confirm") })] }) }) }));
}
function KeyDialog({ editing, taken, onClose, }) {
    const t = useTranslator(apiKeysMessages);
    const site = useSite();
    const nameId = useId();
    const valueId = useId();
    const key = editing.mode === "add" ? null : editing.key;
    const [name, setName] = useState(key?.name ?? "");
    const [value, setValue] = useState("");
    const [error, setError] = useState(null);
    const needsName = editing.mode !== "replace";
    const needsValue = editing.mode !== "rename";
    const nameTaken = needsName && taken.some((item) => item.name.toLowerCase() === name.trim().toLowerCase());
    const ready = (!needsName || (name.trim() !== "" && !nameTaken)) && (!needsValue || value.trim() !== "");
    const saveKey = useCmsMutation({
        // biome-ignore lint/suspicious/noConfusingVoidType: a mutation without variables, so `mutate()` takes no argument
        fn: (_, { site }) => {
            if (!key)
                return createApiKey(site, { name: name.trim(), value: value.trim() }, t("error.save"));
            return updateApiKey(site, key.id, {
                expectedVersion: key.version,
                ...(editing.mode === "rename" ? { name: name.trim() } : { value: value.trim() }),
            }, t("error.save"));
        },
        success: t(editing.mode === "add" ? "toast.added" : editing.mode === "rename" ? "toast.renamed" : "toast.replaced"),
        failure: t("error.save"),
        inline: true,
        // A failed save can mean the key changed meanwhile, so the list is refetched either way.
        invalidate: [apiKeysKeys.all],
        onSuccess: onClose,
        onError: (saveError) => setError(errorText(site, saveError, t("error.save"))),
    });
    const saving = saveKey.isPending;
    const save = () => {
        if (!ready || saving)
            return;
        setError(null);
        saveKey.mutate();
    };
    const title = editing.mode === "add"
        ? t("dialog.add.title")
        : editing.mode === "rename"
            ? t("dialog.rename.title")
            : t("dialog.replace.title", { name: editing.key.name });
    const description = editing.mode === "add"
        ? t("dialog.add.description")
        : editing.mode === "rename"
            ? t("dialog.rename.description")
            : t("dialog.replace.description");
    return (_jsx(Dialog, { open: true, onOpenChange: (open) => !open && onClose(), children: _jsx(DialogContent, { "data-testid": "api-key-dialog", children: _jsxs("form", { className: "grid gap-5", onSubmit: (event) => {
                    event.preventDefault();
                    void save();
                }, children: [_jsxs(DialogHeader, { children: [_jsx(DialogTitle, { children: title }), _jsx(DialogDescription, { children: description })] }), needsName && (_jsxs(Labeled, { label: t("field.name"), htmlFor: nameId, children: [_jsx(Input, { id: nameId, value: name, autoComplete: "off", placeholder: t("field.namePlaceholder"), "aria-invalid": nameTaken ? true : undefined, onChange: (event) => setName(event.target.value) }), nameTaken && _jsx(FieldError, { className: "text-xs", children: t("field.nameTaken") })] })), needsValue && (_jsx(Labeled, { label: t("field.value"), htmlFor: valueId, children: _jsx(Input, { id: valueId, type: "password", autoComplete: "off", className: "font-mono", value: value, placeholder: t("field.valuePlaceholder"), onChange: (event) => setValue(event.target.value) }) })), error && _jsx(FieldError, { children: error }), _jsx(DialogFormFooter, { onCancel: onClose, busy: saving, disabled: !ready, submitLabel: t(editing.mode === "add"
                            ? "dialog.add.confirm"
                            : editing.mode === "rename"
                                ? "dialog.rename.confirm"
                                : "dialog.replace.confirm") })] }) }) }));
}
