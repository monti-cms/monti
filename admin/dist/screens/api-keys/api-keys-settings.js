"use client";
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { cmsApiUrl, useSite, useTranslator, } from "@monti-cms/core/client";
import { useQueryClient } from "@tanstack/react-query";
import { KeyRound, Pencil, Plus, RefreshCw, Trash2, Unplug } from "lucide-react";
import { useId, useState } from "react";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "../../ui/alert.js";
import { Badge } from "../../ui/badge.js";
import { Button } from "../../ui/button.js";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../../ui/dialog.js";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle } from "../../ui/empty.js";
import { FieldError } from "../../ui/field.js";
import { Input } from "../../ui/input.js";
import { Skeleton } from "../../ui/skeleton.js";
import { cmsFetch, errorText } from "../admin-api.js";
import { Labeled } from "../schema/controls.js";
import { Section } from "../schema/section.js";
import { MoreActionsButton } from "../shared/action-menu.js";
import { PageActions } from "../shared/admin-shell.js";
import { ConfirmDialog } from "../shared/confirm-dialog.js";
import { PageBody } from "../shared/page-body.js";
import { ApiKeyField, choiceReady } from "./api-key-field.js";
import { API_KEYS_KEY, useApiKeys } from "./api-keys-api.js";
import { apiKeysMessages } from "./messages.js";
/** Assigns a key to a plugin slot, or clears it (`none`). A typed key is saved in the same request. */
async function putSlot(site, plugin, slot, key, fallback) {
    return cmsFetch(site, cmsApiUrl("/v1/api-keys/slots"), { method: "PUT", json: { plugin, slot, key }, fallback });
}
/** The API keys page: one card with a row per key, the one primary action ("Add key") in the page header, and the dialogs to add, rename, replace and delete. */
export function ApiKeysSettings() {
    const t = useTranslator(apiKeysMessages);
    const site = useSite();
    const query = useApiKeys();
    const queryClient = useQueryClient();
    const [editing, setEditing] = useState(null);
    const [slotEditing, setSlotEditing] = useState(null);
    const [confirmRequest, setConfirmRequest] = useState(null);
    const refresh = () => queryClient.invalidateQueries({ queryKey: API_KEYS_KEY });
    const list = query.data;
    const askDelete = (key) => {
        const used = key.uses.length > 0;
        setConfirmRequest({
            title: t("delete.title", { name: key.name }),
            description: used ? (_jsxs("div", { className: "flex flex-col gap-2", children: [_jsx("p", { children: t("delete.usedDescription", { count: key.uses.length }) }), _jsx("ul", { className: "list-disc pl-5", "data-testid": "delete-dependents", children: key.uses.map((use) => (_jsx("li", { children: use.label }, `${use.plugin}:${use.ref}`))) })] })) : (t("delete.unusedDescription")),
            confirmLabel: t("delete.confirm"),
            destructive: true,
            onConfirm: async () => {
                try {
                    await cmsFetch(site, cmsApiUrl(`/v1/api-keys/${key.id}?expectedVersion=${key.version}${used ? "&force=true" : ""}`), { method: "DELETE", fallback: t("error.delete") });
                    toast.success(t("toast.deleted"));
                }
                catch (error) {
                    toast.error(errorText(site, error, t("error.delete")));
                }
                await refresh();
            },
        });
    };
    const clearSlot = async (plugin, slot, label) => {
        try {
            await putSlot(site, plugin, slot, { use: "none" }, t("error.save"));
            toast.success(t("toast.slotCleared", { label }));
        }
        catch (error) {
            toast.error(errorText(site, error, t("error.save")));
        }
        await refresh();
    };
    const rowMenu = (key) => [
        { kind: "item", label: t("menu.rename"), icon: Pencil, onSelect: () => setEditing({ mode: "rename", key }) },
        { kind: "item", label: t("menu.replace"), icon: RefreshCw, onSelect: () => setEditing({ mode: "replace", key }) },
        ...key.slots.map((use) => ({
            kind: "item",
            label: t("menu.clearSlot", { label: use.label }),
            icon: Unplug,
            onSelect: () => void clearSlot(use.plugin, use.ref, use.label),
        })),
        { kind: "separator" },
        { kind: "item", label: t("menu.delete"), icon: Trash2, destructive: true, onSelect: () => askDelete(key) },
    ];
    return (_jsxs(PageBody, { "data-testid": "api-keys-settings", children: [_jsx(PageActions, { children: _jsxs(Button, { type: "button", size: "sm", disabled: !list?.secretsAvailable, onClick: () => setEditing({ mode: "add" }), children: [_jsx(Plus, { "aria-hidden": true }), t("add")] }) }), list && !list.secretsAvailable && (_jsxs(Alert, { variant: "danger", layout: "stack", children: [_jsx(AlertTitle, { children: t("secret.title") }), _jsx(AlertDescription, { children: t("secret.description") })] })), _jsx(Section, { wide: true, card: false, title: t("title"), description: t("description"), note: t("note"), children: _jsxs("div", { className: "overflow-hidden rounded-lg border bg-cms-card", children: [_jsx("div", { className: "flex items-center justify-between gap-3 border-b px-4 py-3", children: _jsx("span", { className: "text-cms-muted-foreground text-sm", children: list
                                    ? [
                                        t("count.keys", { count: list.items.length }),
                                        ...(list.slots.some((slot) => !slot.key)
                                            ? [t("count.needed", { count: list.slots.filter((slot) => !slot.key).length })]
                                            : []),
                                    ].join(" · ")
                                    : "\u00a0" }) }), _jsx(KeyRows, { query: query, menu: rowMenu, onAssign: setSlotEditing, onRetry: () => void query.refetch() })] }) }), editing && (_jsx(KeyDialog, { editing: editing, taken: (list?.items ?? []).filter((item) => editing.mode === "add" || item.id !== editing.key.id), onClose: () => setEditing(null), onSaved: () => void refresh() }, editing.mode === "add" ? "add" : `${editing.mode}:${editing.key.id}`)), slotEditing && (_jsx(SlotDialog, { slot: slotEditing, onClose: () => setSlotEditing(null), onSaved: () => void refresh() }, `${slotEditing.plugin}:${slotEditing.slot}`)), _jsx(ConfirmDialog, { request: confirmRequest, onClose: () => setConfirmRequest(null) })] }));
}
function KeyRows({ query, menu, onAssign, onRetry, }) {
    const t = useTranslator(apiKeysMessages);
    const site = useSite();
    const list = query.data;
    if (!list) {
        if (query.error) {
            return (_jsxs(Alert, { variant: "danger", className: "m-3 flex w-auto items-center justify-between gap-3", children: [_jsx(AlertDescription, { className: "col-start-auto", children: errorText(site, query.error, t("load.failed")) }), _jsx(Button, { type: "button", variant: "outline", size: "xs", onClick: onRetry, children: t("load.retry") })] }));
        }
        return _jsx(Skeleton, { className: "m-4 h-12" });
    }
    const emptySlots = list.slots.filter((slot) => !slot.key);
    if (list.items.length === 0 && list.slots.length === 0) {
        return (_jsxs(Empty, { children: [_jsxs(EmptyHeader, { children: [_jsx(EmptyMedia, { variant: "icon", children: _jsx(KeyRound, { "aria-hidden": true }) }), _jsx(EmptyTitle, { children: t("empty.title") })] }), _jsx("p", { className: "text-cms-muted-foreground text-sm", children: t("empty.description") })] }));
    }
    return (_jsxs("ul", { className: "divide-y", "aria-label": t("title"), children: [list.items.map((key) => (_jsxs("li", { className: "flex items-center gap-3.5 px-4 py-3", "data-testid": `api-key-${key.name}`, children: [_jsxs("div", { className: "min-w-0 flex-1", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("span", { className: "truncate font-medium text-sm", children: key.name }), !key.readable && (_jsx(Badge, { variant: "destructive", title: t("row.unreadableHint"), children: t("row.unreadable") }))] }), _jsx("p", { className: "mt-0.5 truncate text-cms-muted-foreground text-xs", children: !key.readable
                                    ? t("row.unreadableHint")
                                    : key.uses.length > 0
                                        ? t("row.usedBy", { uses: key.uses.map((use) => use.label).join(", ") })
                                        : t("row.unused") })] }), _jsxs("span", { className: "shrink-0 font-mono text-cms-muted-foreground text-xs", title: key.tail ? t("row.mask", { tail: key.tail }) : t("row.maskShort"), children: ["••••", key.tail] }), _jsx(MoreActionsButton, { label: t("row.menu", { name: key.name }), actions: menu(key) })] }, key.id))), emptySlots.map((slot) => (_jsxs("li", { className: "flex items-center gap-3.5 px-4 py-3", "data-testid": `api-key-slot-${slot.plugin}-${slot.slot}`, children: [_jsx("div", { className: "min-w-0 flex-1", children: _jsxs("div", { className: "flex items-center gap-2", children: [_jsx("span", { className: "truncate font-medium text-sm", children: slot.label }), _jsx("span", { className: "text-cms-muted-foreground text-xs", children: t("slot.empty") })] }) }), _jsx(Button, { type: "button", variant: "outline", size: "xs", disabled: !list.secretsAvailable, onClick: () => onAssign(slot), children: t("slot.assign") })] }, `${slot.plugin}:${slot.slot}`)))] }));
}
/** Pick a saved key or enter a new one for a plugin's key slot; a typed key is saved together with the assignment. */
function SlotDialog({ slot, onClose, onSaved }) {
    const t = useTranslator(apiKeysMessages);
    const site = useSite();
    const query = useApiKeys();
    const hasKeys = (query.data?.items.length ?? 0) > 0;
    const [choice, setChoice] = useState(null);
    const current = choice ?? (hasKeys ? { use: "saved", keyId: query.data?.items[0]?.id ?? "" } : { use: "new", value: "" });
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(null);
    const save = async () => {
        setSaving(true);
        setError(null);
        try {
            await putSlot(site, slot.plugin, slot.slot, current, t("error.save"));
            toast.success(t("toast.slotAssigned"));
            onSaved();
            onClose();
        }
        catch (saveError) {
            setError(errorText(site, saveError, t("error.save")));
        }
        finally {
            setSaving(false);
        }
    };
    return (_jsx(Dialog, { open: true, onOpenChange: (open) => !open && onClose(), children: _jsx(DialogContent, { "data-testid": "api-key-slot-dialog", children: _jsxs("form", { className: "grid gap-5", onSubmit: (event) => {
                    event.preventDefault();
                    void save();
                }, children: [_jsxs(DialogHeader, { children: [_jsx(DialogTitle, { children: t("slot.dialog.title", { label: slot.label }) }), _jsx(DialogDescription, { children: t("slot.dialog.description") })] }), _jsx(ApiKeyField, { value: current, onChange: setChoice, baseName: slot.service }), error && (_jsx("p", { role: "alert", className: "text-cms-destructive text-xs", children: error })), _jsxs(DialogFooter, { children: [_jsx(Button, { type: "button", variant: "outline", onClick: onClose, children: t("dialog.cancel") }), _jsx(Button, { type: "submit", disabled: !choiceReady(current) || saving, children: saving ? t("dialog.saving") : t("slot.dialog.confirm") })] })] }) }) }));
}
function KeyDialog({ editing, taken, onClose, onSaved, }) {
    const t = useTranslator(apiKeysMessages);
    const site = useSite();
    const nameId = useId();
    const valueId = useId();
    const key = editing.mode === "add" ? null : editing.key;
    const [name, setName] = useState(key?.name ?? "");
    const [value, setValue] = useState("");
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(null);
    const needsName = editing.mode !== "replace";
    const needsValue = editing.mode !== "rename";
    const nameTaken = needsName && taken.some((item) => item.name.toLowerCase() === name.trim().toLowerCase());
    const ready = (!needsName || (name.trim() !== "" && !nameTaken)) && (!needsValue || value.trim() !== "");
    const save = async () => {
        if (!ready || saving)
            return;
        setSaving(true);
        setError(null);
        try {
            if (key) {
                await cmsFetch(site, cmsApiUrl(`/v1/api-keys/${key.id}`), {
                    method: "PATCH",
                    json: {
                        expectedVersion: key.version,
                        ...(editing.mode === "rename" ? { name: name.trim() } : { value: value.trim() }),
                    },
                    fallback: t("error.save"),
                });
            }
            else {
                await cmsFetch(site, cmsApiUrl("/v1/api-keys"), {
                    method: "POST",
                    json: { name: name.trim(), value: value.trim() },
                    fallback: t("error.save"),
                });
            }
            toast.success(t(editing.mode === "add" ? "toast.added" : editing.mode === "rename" ? "toast.renamed" : "toast.replaced"));
            onSaved();
            onClose();
        }
        catch (saveError) {
            setError(errorText(site, saveError, t("error.save")));
            onSaved();
        }
        finally {
            setSaving(false);
        }
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
                }, children: [_jsxs(DialogHeader, { children: [_jsx(DialogTitle, { children: title }), _jsx(DialogDescription, { children: description })] }), needsName && (_jsxs(Labeled, { label: t("field.name"), htmlFor: nameId, children: [_jsx(Input, { id: nameId, value: name, autoComplete: "off", placeholder: t("field.namePlaceholder"), "aria-invalid": nameTaken ? true : undefined, onChange: (event) => setName(event.target.value) }), nameTaken && _jsx(FieldError, { className: "text-xs", children: t("field.nameTaken") })] })), needsValue && (_jsx(Labeled, { label: t("field.value"), htmlFor: valueId, children: _jsx(Input, { id: valueId, type: "password", autoComplete: "off", className: "font-mono", value: value, placeholder: t("field.valuePlaceholder"), onChange: (event) => setValue(event.target.value) }) })), error && (_jsx("p", { role: "alert", className: "text-cms-destructive text-xs", children: error })), _jsxs(DialogFooter, { children: [_jsx(Button, { type: "button", variant: "outline", onClick: onClose, children: t("dialog.cancel") }), _jsx(Button, { type: "submit", disabled: !ready || saving, children: saving
                                    ? t("dialog.saving")
                                    : t(editing.mode === "add"
                                        ? "dialog.add.confirm"
                                        : editing.mode === "rename"
                                            ? "dialog.rename.confirm"
                                            : "dialog.replace.confirm") })] })] }) }) }));
}
