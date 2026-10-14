"use client";
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { errorText, useCmsMutation } from "@monti-cms/admin/api";
import { Button, commonMessages, DETAIL_PANE_FRAME, EditorFooter, EmptyState, Field, FieldGroup, FieldLabel, FieldTitle, IconButton, Input, ListPane, ListRow, LoadErrorAlert, MasterDetail, Textarea, useConfirm, useDraftEditor, } from "@monti-cms/admin/kit";
import { useSite, useTranslator } from "@monti-cms/core/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Copy, Plus, Quote, RotateCcw, Save } from "lucide-react";
import { useId, useState } from "react";
import { aiKeys, createAiShared, deleteAiShared, getAiShared, updateAiShared } from "./api.js";
import { sharedMessages } from "./shared-editor.messages.js";
/** Shape of the instruction and shared text input fields (both are text that goes into instructions). */
export const PROMPT_ROWS = 8;
export const PROMPT_TEXTAREA = "min-h-40 text-xs md:text-xs";
export function useAiShared() {
    const site = useSite();
    const t = useTranslator(sharedMessages);
    return useQuery({
        queryKey: aiKeys.shared(),
        queryFn: ({ signal }) => getAiShared(site, { signal, fallback: t("error.load") }),
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
    const applySaved = (saved) => queryClient.setQueryData(aiKeys.shared(), saved);
    return (_jsxs("div", { className: "flex min-h-0 flex-1 flex-col", children: [query.error && !view && (_jsx(LoadErrorAlert, { className: "m-3", message: errorText(site, query.error, t("error.load")), onRetry: () => void query.refetch() })), _jsx(MasterDetail, { list: _jsx(ListPane, { label: t("list.label"), loading: query.isPending, skeletonRows: 2, empty: view?.items.length === 0 ? _jsx(EmptyState, { compact: true, title: t("list.empty") }) : null, children: view?.items.map((item) => (_jsx(ListRow, { title: item.label, detail: detailOf(t, item), current: selected === item.key, onClick: () => onOpen(item.key) }, item.key))) }), children: view && (selected === "new" || current) ? (_jsx(SharedEditor, { version: view.version, item: current, onSaved: (saved, key) => {
                        applySaved(saved);
                        onSelectedChange(key);
                    }, onDeleted: (saved) => {
                        applySaved(saved);
                        onSelectedChange(null);
                    }, onCancel: () => onSelectedChange(null), onConflict: () => void query.refetch(), onDirtyChange: onDirtyChange }, selected ?? "none")) : (view && (_jsx(EmptyState, { icon: Quote, title: t("empty.title"), action: { label: t("action.add"), onClick: () => onOpen("new"), icon: Plus } }))) })] }));
}
const NEW_DRAFT = { key: "", label: "", text: "" };
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
    const tc = useTranslator(commonMessages);
    const [error, setError] = useState(null);
    const { confirm, dialog } = useConfirm();
    const ids = { label: useId(), key: useId(), keyTitle: useId(), text: useId() };
    const { draft, update: set, dirty, } = useDraftEditor({
        saved: item ? { key: item.key, label: item.label, text: item.text } : null,
        empty: NEW_DRAFT,
        onDirtyChange,
    });
    const fromConfig = item?.source === "config";
    const saveMutation = useCmsMutation({
        fn: (_, { site }) => {
            const key = item?.key ?? draft.key.trim();
            return item
                ? updateAiShared(site, {
                    expectedVersion: version,
                    key,
                    text: draft.text,
                    ...(fromConfig ? {} : { label: draft.label.trim() }),
                }, tc("saveFailed"))
                : createAiShared(site, { expectedVersion: version, key, label: draft.label.trim(), text: draft.text }, tc("saveFailed"));
        },
        success: tc("saved"),
        failure: tc("saveFailed"),
        inline: true,
        onSuccess: (saved) => onSaved(saved, item?.key ?? draft.key.trim()),
        onError: (saveError) => {
            setError(errorText(site, saveError, tc("saveFailed")));
            onConflict();
        },
    });
    const deleteMutation = useCmsMutation({
        fn: (target, { site }) => deleteAiShared(site, target.key, version, tc("deleteFailed")),
        success: tc("deleted"),
        failure: tc("deleteFailed"),
        inline: true,
        onSuccess: (saved) => onDeleted(saved),
        onError: (deleteError) => {
            setError(errorText(site, deleteError, tc("deleteFailed")));
            onConflict();
        },
    });
    const saving = saveMutation.isPending;
    const deleting = deleteMutation.isPending;
    const save = () => {
        setError(null);
        saveMutation.mutate(undefined);
    };
    const remove = async () => {
        if (!item)
            return;
        const ok = await confirm({
            title: t("confirm.title"),
            description: t("confirm.description", { name: item.label }),
            confirmLabel: tc("delete"),
            destructive: true,
        });
        if (!ok)
            return;
        setError(null);
        deleteMutation.mutate(item);
    };
    const shownKey = item?.key ?? draft.key.trim();
    return (_jsxs("div", { className: DETAIL_PANE_FRAME, children: [_jsxs("div", { className: "min-w-0", children: [_jsx("h2", { className: "truncate font-medium text-base", children: (item ? item.label : draft.label.trim()) || t("new.title") }), (shownKey || item?.source === "added") && (_jsx("p", { className: "truncate text-cms-muted-foreground text-xs", children: item ? detailOf(t, item) : `${placeholderOf(shownKey)} · ${t("detail.added")}` }))] }), _jsxs(FieldGroup, { className: "gap-5", children: [_jsxs(Field, { children: [_jsx(FieldLabel, { htmlFor: ids.label, children: t("field.name") }), _jsx(Input, { id: ids.label, value: draft.label, maxLength: 40, disabled: fromConfig, onChange: (event) => set({ label: event.target.value }), className: "h-8 text-xs md:text-xs" })] }), item ? (_jsxs(Field, { role: "group", "aria-labelledby": ids.keyTitle, children: [_jsx(FieldTitle, { id: ids.keyTitle, children: t("field.key") }), _jsx(PlaceholderChip, { shareKey: item.key })] })) : (_jsxs(Field, { children: [_jsx(FieldLabel, { htmlFor: ids.key, children: t("field.key") }), _jsx(Input, { id: ids.key, value: draft.key, maxLength: 40, autoComplete: "off", spellCheck: false, onChange: (event) => set({ key: event.target.value.trim() }), className: "h-8 font-mono text-xs md:text-xs" })] })), _jsxs(Field, { children: [_jsx(FieldLabel, { htmlFor: ids.text, children: t("field.content") }), _jsx(Textarea, { id: ids.text, rows: PROMPT_ROWS, value: draft.text, onChange: (event) => set({ text: event.target.value }), className: PROMPT_TEXTAREA })] })] }), _jsx(EditorFooter, { dirty: dirty, saving: saving, deleting: deleting, canSave: Boolean(draft.label.trim() && draft.key.trim()), error: error, saveIcon: _jsx(Save, { "aria-hidden": true }), onSave: save, onCancel: item ? undefined : onCancel, onDelete: item?.source === "added" ? () => void remove() : undefined, children: item?.source === "config" && (_jsxs(Button, { type: "button", size: "sm", variant: "outline", disabled: draft.text === item.defaultText, onClick: () => set({ text: item.defaultText }), children: [_jsx(RotateCcw, { "aria-hidden": true }), t("action.resetDefault")] })) }), dialog] }));
}
