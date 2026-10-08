"use client";
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { cmsFetch, errorText } from "@monti-cms/admin/api";
import { Button, Empty, EmptyContent, EmptyHeader, EmptyMedia, EmptyTitle, Field, FieldGroup, FieldLabel, FieldTitle, IconButton, Input, Textarea, useConfirm, } from "@monti-cms/admin/kit";
import { cmsApiUrl, useSite, useTranslator } from "@monti-cms/core/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Copy, Plus, Quote, RotateCcw, Save, Trash2 } from "lucide-react";
import { useEffect, useId, useState } from "react";
import { toast } from "sonner";
import { DETAIL_PANE, InlineError, ListRow, ListSkeleton, LoadError } from "./connection-editor.js";
import { sharedMessages } from "./shared-editor.messages.js";
export const AI_SHARED_KEY = ["cms", "ai", "shared"];
/** Shape of the instruction and shared text input fields (both are text that goes into instructions). */
export const PROMPT_ROWS = 8;
export const PROMPT_TEXTAREA = "min-h-40 text-xs md:text-xs";
const SHARED_API = cmsApiUrl("/v1/ai/shared");
export function useAiShared() {
    const site = useSite();
    const t = useTranslator(sharedMessages);
    return useQuery({
        queryKey: AI_SHARED_KEY,
        queryFn: ({ signal }) => cmsFetch(site, SHARED_API, { signal, fallback: t("error.load") }),
    });
}
/** Shape to put into instructions. */
const placeholderOf = (key) => `{{shared.${key}}}`;
const detailOf = (t, item) => `${placeholderOf(item.key)}${item.source === "added" ? ` · ${t("detail.added")}` : ""}`;
/**
 * AI screen Shared texts tab. The list and edit pane of texts (e.g. a style guide) that go into the instructions of several actions as `{{shared.key}}`.
 * For a text written in the config, only the content is edited; for a text added by the admin, the name and content are edited or it is deleted. A saved text is used right away by
 * every action run afterwards. The AI screen holds the open text (`selected`), because the header's Add text and tab switching ask about
 * unsaved content.
 */
export function SharedManager({ selected, onOpen, onSelectedChange, onDirtyChange, }) {
    const site = useSite();
    const t = useTranslator(sharedMessages);
    const queryClient = useQueryClient();
    const query = useAiShared();
    const view = query.data;
    const current = view?.items.find((item) => item.key === selected) ?? null;
    const applySaved = (saved) => queryClient.setQueryData(AI_SHARED_KEY, saved);
    return (_jsxs("div", { className: "flex min-h-0 flex-1 flex-col", children: [query.error && !view && (_jsx(LoadError, { message: errorText(site, query.error, t("error.load")), onRetry: () => void query.refetch() })), _jsxs("div", { className: "flex min-h-0 flex-1 overflow-hidden", children: [_jsx("div", { className: "flex w-72 shrink-0 flex-col border-r", children: _jsx("ul", { className: "min-h-0 flex-1 divide-y overflow-y-auto", "aria-label": t("list.label"), children: query.isPending ? (_jsx(ListSkeleton, { rows: 2 })) : view?.items.length === 0 ? (_jsx("li", { className: "px-3 py-6 text-center text-cms-muted-foreground text-xs", children: t("list.empty") })) : (view?.items.map((item) => (_jsx(ListRow, { title: item.label, detail: detailOf(t, item), current: selected === item.key, onClick: () => onOpen(item.key) }, item.key)))) }) }), _jsx("div", { className: "flex min-w-0 flex-1 flex-col overflow-y-auto", children: view && (selected === "new" || current) ? (_jsx(SharedEditor, { version: view.version, item: current, onSaved: (saved, key) => {
                                applySaved(saved);
                                onSelectedChange(key);
                            }, onDeleted: (saved) => {
                                applySaved(saved);
                                onSelectedChange(null);
                            }, onCancel: () => onSelectedChange(null), onConflict: () => void query.refetch(), onDirtyChange: onDirtyChange }, selected ?? "none")) : (view && (_jsxs(Empty, { className: "flex-1", children: [_jsxs(EmptyHeader, { children: [_jsx(EmptyMedia, { variant: "icon", children: _jsx(Quote, { "aria-hidden": true }) }), _jsx(EmptyTitle, { children: t("empty.title") })] }), _jsx(EmptyContent, { children: _jsxs(Button, { type: "button", size: "sm", onClick: () => onOpen("new"), children: [_jsx(Plus, { "aria-hidden": true }), t("action.add")] }) })] }))) })] })] }));
}
const NEW_DRAFT = { key: "", label: "", text: "" };
const sameDraft = (a, b) => a.key === b.key && a.label === b.label && a.text === b.text;
/** Shows the shape to put into instructions and copies it. */
function PlaceholderChip({ shareKey }) {
    const t = useTranslator(sharedMessages);
    const [copied, setCopied] = useState(false);
    const text = placeholderOf(shareKey);
    const copy = async () => {
        try {
            await navigator.clipboard.writeText(text);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
        catch {
            // If the clipboard is unavailable, leave it as is.
        }
    };
    return (_jsxs("div", { className: "flex items-center gap-1", children: [_jsx("code", { className: "rounded-md border bg-cms-muted px-2 py-1 font-mono text-xs", children: text }), _jsx(IconButton, { label: copied ? t("copy.done") : t("copy.label"), size: "icon-xs", onClick: () => void copy(), children: copied ? _jsx(Check, { "aria-hidden": true, className: "text-cms-primary" }) : _jsx(Copy, { "aria-hidden": true }) })] }));
}
function SharedEditor({ version, item, onSaved, onDeleted, onCancel, onConflict, onDirtyChange, }) {
    const site = useSite();
    const t = useTranslator(sharedMessages);
    const initial = item ? { key: item.key, label: item.label, text: item.text } : NEW_DRAFT;
    const [draft, setDraft] = useState(initial);
    const [saving, setSaving] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [error, setError] = useState(null);
    const { confirm, dialog } = useConfirm();
    const ids = { label: useId(), key: useId(), keyTitle: useId(), text: useId() };
    const set = (patch) => setDraft({ ...draft, ...patch });
    const fromConfig = item?.source === "config";
    const dirty = item === null || !sameDraft(draft, initial);
    // A new text with nothing entered has nothing to discard.
    const unsaved = item === null ? !sameDraft(draft, NEW_DRAFT) : dirty;
    useEffect(() => onDirtyChange(unsaved), [unsaved, onDirtyChange]);
    useEffect(() => () => onDirtyChange(false), [onDirtyChange]);
    const save = async () => {
        setSaving(true);
        setError(null);
        try {
            const key = item?.key ?? draft.key.trim();
            const saved = item
                ? await cmsFetch(site, SHARED_API, {
                    method: "PATCH",
                    json: {
                        expectedVersion: version,
                        key,
                        text: draft.text,
                        ...(fromConfig ? {} : { label: draft.label.trim() }),
                    },
                    fallback: t("error.save"),
                })
                : await cmsFetch(site, SHARED_API, {
                    method: "POST",
                    json: { expectedVersion: version, key, label: draft.label.trim(), text: draft.text },
                    fallback: t("error.save"),
                });
            onSaved(saved, key);
            toast.success(t("toast.saved"));
        }
        catch (saveError) {
            setError(errorText(site, saveError, t("error.save")));
            onConflict();
        }
        finally {
            setSaving(false);
        }
    };
    const remove = async () => {
        if (!item)
            return;
        const ok = await confirm({
            title: t("confirm.title"),
            description: t("confirm.description", { name: item.label }),
            confirmLabel: t("action.delete"),
            destructive: true,
        });
        if (!ok)
            return;
        setDeleting(true);
        setError(null);
        try {
            onDeleted(await cmsFetch(site, `${SHARED_API}?key=${encodeURIComponent(item.key)}&expectedVersion=${version}`, {
                method: "DELETE",
                fallback: t("error.delete"),
            }));
            toast.success(t("toast.deleted"));
        }
        catch (deleteError) {
            setError(errorText(site, deleteError, t("error.delete")));
            onConflict();
        }
        finally {
            setDeleting(false);
        }
    };
    const shownKey = item?.key ?? draft.key.trim();
    return (_jsxs("div", { className: DETAIL_PANE, children: [_jsxs("div", { className: "min-w-0", children: [_jsx("h2", { className: "truncate font-medium text-base", children: (item ? item.label : draft.label.trim()) || t("new.title") }), (shownKey || item?.source === "added") && (_jsx("p", { className: "truncate text-cms-muted-foreground text-xs", children: item ? detailOf(t, item) : `${placeholderOf(shownKey)} · ${t("detail.added")}` }))] }), _jsxs(FieldGroup, { className: "gap-5", children: [_jsxs(Field, { children: [_jsx(FieldLabel, { htmlFor: ids.label, children: t("field.name") }), _jsx(Input, { id: ids.label, value: draft.label, maxLength: 40, disabled: fromConfig, onChange: (event) => set({ label: event.target.value }), className: "h-8 text-xs md:text-xs" })] }), item ? (_jsxs(Field, { role: "group", "aria-labelledby": ids.keyTitle, children: [_jsx(FieldTitle, { id: ids.keyTitle, children: t("field.key") }), _jsx(PlaceholderChip, { shareKey: item.key })] })) : (_jsxs(Field, { children: [_jsx(FieldLabel, { htmlFor: ids.key, children: t("field.key") }), _jsx(Input, { id: ids.key, value: draft.key, maxLength: 40, autoComplete: "off", spellCheck: false, onChange: (event) => set({ key: event.target.value.trim() }), className: "h-8 font-mono text-xs md:text-xs" })] })), _jsxs(Field, { children: [_jsx(FieldLabel, { htmlFor: ids.text, children: t("field.content") }), _jsx(Textarea, { id: ids.text, rows: PROMPT_ROWS, value: draft.text, onChange: (event) => set({ text: event.target.value }), className: PROMPT_TEXTAREA })] })] }), error && _jsx(InlineError, { children: error }), _jsxs("div", { className: "flex flex-wrap items-center gap-2", children: [_jsxs(Button, { type: "button", size: "sm", disabled: saving || !dirty || !draft.label.trim() || !draft.key.trim(), onClick: () => void save(), children: [_jsx(Save, { "aria-hidden": true }), saving ? t("action.saving") : t("action.save")] }), !item && (_jsx(Button, { type: "button", size: "sm", variant: "outline", onClick: onCancel, children: t("action.cancel") })), item?.source === "config" && (_jsxs(Button, { type: "button", size: "sm", variant: "outline", disabled: draft.text === item.defaultText, onClick: () => set({ text: item.defaultText }), children: [_jsx(RotateCcw, { "aria-hidden": true }), t("action.resetDefault")] })), item?.source === "added" && (_jsxs(Button, { type: "button", size: "sm", variant: "ghost", className: "ml-auto text-cms-destructive hover:bg-cms-destructive/10 hover:text-cms-destructive", disabled: deleting, onClick: () => void remove(), children: [_jsx(Trash2, { "aria-hidden": true }), deleting ? t("action.deleting") : t("action.delete")] }))] }), dialog] }));
}
