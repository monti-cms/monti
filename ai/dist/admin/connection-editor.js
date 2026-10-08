"use client";
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { cmsFetch, errorText } from "@monti-cms/admin/api";
import { Alert, AlertDescription, Button, cn, Empty, EmptyContent, EmptyHeader, EmptyMedia, EmptyTitle, Field, FieldGroup, FieldLabel, Input, Skeleton, useConfirm, useDebounced, } from "@monti-cms/admin/kit";
import { cmsApiUrl, useSite, useTranslator } from "@monti-cms/core/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plug, PlugZap, Plus, Save, Trash2 } from "lucide-react";
import { useEffect, useId, useState } from "react";
import { toast } from "sonner";
import { AI_PROVIDER_KINDS, PROVIDER_EXAMPLES, } from "../connection.js";
import { AI_ACTIONS_KEY } from "./ai-slot-provider.js";
import { connectionMessages } from "./connection-editor.messages.js";
import { OptionSelect } from "./custom-editor.js";
import { useLabels } from "./labels.messages.js";
import { ModelCombobox, useModelList } from "./model-combobox.js";
export const AI_SETTINGS_KEY = ["cms", "ai", "settings"];
export function useAiSettings() {
    const site = useSite();
    const t = useTranslator(connectionMessages);
    return useQuery({
        queryKey: AI_SETTINGS_KEY,
        queryFn: ({ signal }) => cmsFetch(site, cmsApiUrl("/v1/ai/settings"), { signal, fallback: t("error.loadList") }),
        // Not re-fetched every time an action is opened. Saving a connection updates the cache from the response.
        staleTime: 60_000,
    });
}
/** Pieces shared by the three tabs of the AI screen. The open-item shape of the list is the same as the admin screen's `OPEN_ITEM`. */
export const OPEN_ITEM = "bg-cms-accent text-cms-accent-foreground";
/** Frame of the detail pane (shared by actions, connections and shared texts). */
export const DETAIL_PANE = "mx-auto flex w-full max-w-3xl flex-col gap-5 p-6 text-sm";
/** Load failure. Reports it in place and allows fetching again. */
export function LoadError({ message, onRetry }) {
    const t = useTranslator(connectionMessages);
    return (_jsxs(Alert, { variant: "danger", className: "m-3 flex w-auto items-center justify-between gap-3", children: [_jsx(AlertDescription, { className: "col-start-auto", children: message }), _jsx(Button, { type: "button", variant: "outline", size: "xs", onClick: onRetry, children: t("action.retry") })] }));
}
/** One list row. Status text to the right of the name, and a dim description below. */
export function ListRow({ title, status, detail, current, onClick, }) {
    return (_jsx("li", { children: _jsxs("button", { type: "button", "aria-current": current ? "true" : undefined, onClick: onClick, className: cn("flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left transition-colors", current ? OPEN_ITEM : "hover:bg-cms-accent/50"), children: [_jsxs("span", { className: "flex w-full items-center gap-2", children: [_jsx("span", { className: "truncate font-medium text-sm", children: title }), status && _jsx("span", { className: "ml-auto shrink-0 text-cms-muted-foreground text-xs", children: status })] }), _jsx("span", { className: "w-full truncate text-cms-muted-foreground text-xs", children: detail })] }) }));
}
/** Placeholder while the list loads. */
export function ListSkeleton({ rows }) {
    return Array.from({ length: rows }, (_, index) => (_jsx("li", { className: "p-3", "aria-hidden": true, children: _jsx(Skeleton, { className: "h-9 w-full" }) }, index)));
}
/** One error line (inside the edit pane). */
export function InlineError({ children }) {
    return (_jsx("p", { role: "alert", className: "text-cms-destructive text-xs", children: children }));
}
/** Time to wait for URL/key input to pause before fetching the model list. */
const LIST_INPUT_DEBOUNCE_MS = 400;
const NEW_DRAFT = { name: "", kind: "chat", url: "", apiKey: undefined, defaultModel: "" };
const draftOf = (provider) => ({
    name: provider.name,
    kind: provider.kind,
    url: provider.url,
    apiKey: undefined,
    defaultModel: provider.defaultModel,
});
const sameDraft = (a, b) => JSON.stringify(a) === JSON.stringify(b);
/**
 * AI screen Connections tab. Keeps several connections (name, mode, URL, key, default model) and lets each action pick which connection to use.
 * The key is stored encrypted by the server, and only the last four characters are shown here.
 * The AI screen holds the open connection (`selected`), because the header's Add connection and tab switching ask about unsaved content.
 */
export function ConnectionManager({ selected, onOpen, onSelectedChange, onDirtyChange, }) {
    const site = useSite();
    const t = useTranslator(connectionMessages);
    const { providerKindLabel } = useLabels();
    const queryClient = useQueryClient();
    const settingsQuery = useAiSettings();
    const settings = settingsQuery.data;
    const applySaved = (saved) => {
        queryClient.setQueryData(AI_SETTINGS_KEY, saved);
        void queryClient.invalidateQueries({ queryKey: AI_ACTIONS_KEY });
    };
    const current = settings?.providers.find((provider) => provider.id === selected) ?? null;
    return (_jsxs("div", { className: "flex min-h-0 flex-1 flex-col", children: [settingsQuery.error && !settings && (_jsx(LoadError, { message: errorText(site, settingsQuery.error, t("error.loadList")), onRetry: () => void settingsQuery.refetch() })), _jsxs("div", { className: "flex min-h-0 flex-1 overflow-hidden", children: [_jsxs("div", { className: "flex w-72 shrink-0 flex-col border-r", children: [settings?.fake && _jsx("p", { className: "border-b px-3 py-2 text-cms-muted-foreground text-xs", children: t("badge.fake") }), _jsx("ul", { className: "min-h-0 flex-1 divide-y overflow-y-auto", "aria-label": t("list.label"), children: settingsQuery.isPending ? (_jsx(ListSkeleton, { rows: 2 })) : settings?.providers.length === 0 ? (_jsx("li", { className: "px-3 py-6 text-center text-cms-muted-foreground text-xs", children: t("list.empty") })) : (settings?.providers.map((provider) => (_jsx(ListRow, { title: provider.name, status: provider.ready ? null : t("status.needsSetup"), detail: `${providerKindLabel(provider.kind)} · ${provider.defaultModel || t("model.none")}`, current: selected === provider.id, onClick: () => onOpen(provider.id) }, provider.id)))) })] }), _jsx("div", { className: "flex min-w-0 flex-1 flex-col overflow-y-auto", children: settings && (selected === "new" || current) ? (_jsx(ProviderEditor, { version: settings.version, provider: current, onSaved: (saved, id) => {
                                applySaved(saved);
                                onSelectedChange(id);
                            }, onDeleted: (saved) => {
                                applySaved(saved);
                                onSelectedChange(null);
                            }, onCancel: () => onSelectedChange(null), onConflict: () => void settingsQuery.refetch(), onDirtyChange: onDirtyChange }, selected ?? "none")) : (settings && (_jsxs(Empty, { className: "flex-1", children: [_jsxs(EmptyHeader, { children: [_jsx(EmptyMedia, { variant: "icon", children: _jsx(Plug, { "aria-hidden": true }) }), _jsx(EmptyTitle, { children: t("empty.title") })] }), _jsx(EmptyContent, { children: _jsxs(Button, { type: "button", size: "sm", onClick: () => onOpen("new"), children: [_jsx(Plus, { "aria-hidden": true }), t("action.add")] }) })] }))) })] })] }));
}
function ProviderEditor({ version, provider, onSaved, onDeleted, onCancel, onConflict, onDirtyChange, }) {
    const site = useSite();
    const t = useTranslator(connectionMessages);
    const { providerKindLabel } = useLabels();
    const initial = provider ? draftOf(provider) : NEW_DRAFT;
    const [draft, setDraft] = useState(initial);
    const [saving, setSaving] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [error, setError] = useState(null);
    const [checking, setChecking] = useState(false);
    const [check, setCheck] = useState(null);
    const { confirm, dialog } = useConfirm();
    const ids = { name: useId(), kind: useId(), url: useId(), key: useId(), model: useId() };
    const set = (patch) => {
        setDraft({ ...draft, ...patch });
        setCheck(null);
    };
    const dirty = provider === null || !sameDraft(draft, initial);
    // A new connection with nothing entered has nothing to discard.
    const unsaved = provider === null ? !sameDraft(draft, NEW_DRAFT) : dirty;
    useEffect(() => onDirtyChange(unsaved), [unsaved, onDirtyChange]);
    useEffect(() => () => onDirtyChange(false), [onDirtyChange]);
    const example = PROVIDER_EXAMPLES[draft.kind];
    // While typing the URL or key the list is not fetched; it is fetched once typing pauses. If the saved key is used as is, it is fetched by connection id.
    const listUrl = useDebounced(draft.url, LIST_INPUT_DEBOUNCE_MS);
    const listKey = useDebounced(typeof draft.apiKey === "string" ? draft.apiKey : undefined, LIST_INPUT_DEBOUNCE_MS);
    const modelSource = draft.kind !== "chat" || !listUrl
        ? null
        : listKey
            ? { url: listUrl, apiKey: listKey }
            : provider?.keyHint && provider.url === listUrl && draft.apiKey === undefined
                ? { providerId: provider.id }
                : null;
    const modelList = useModelList(modelSource);
    const save = async () => {
        setSaving(true);
        setError(null);
        try {
            const json = { expectedVersion: version, provider: draft };
            const saved = provider
                ? await cmsFetch(site, cmsApiUrl(`/v1/ai/providers/${provider.id}`), {
                    method: "PATCH",
                    json,
                    fallback: t("error.save"),
                })
                : await cmsFetch(site, cmsApiUrl("/v1/ai/providers"), {
                    method: "POST",
                    json,
                    fallback: t("error.save"),
                });
            // A new connection is appended to the end of the list.
            const id = provider?.id ?? saved.providers.at(-1)?.id ?? "";
            onSaved(saved, id);
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
        if (!provider)
            return;
        const ok = await confirm({
            title: t("confirm.title"),
            description: t("confirm.description", { name: provider.name }),
            confirmLabel: t("action.delete"),
            destructive: true,
        });
        if (!ok)
            return;
        setDeleting(true);
        setError(null);
        try {
            onDeleted(await cmsFetch(site, cmsApiUrl(`/v1/ai/providers/${provider.id}?expectedVersion=${version}`), {
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
    /** Checks with the current input before saving. If no new key was entered, uses the saved key. */
    const runCheck = async () => {
        setChecking(true);
        try {
            setCheck(await cmsFetch(site, cmsApiUrl("/v1/ai/providers/check"), {
                method: "POST",
                json: { providerId: provider?.id, provider: draft },
                fallback: t("error.check"),
            }));
        }
        catch (checkError) {
            setCheck({ ok: false, message: errorText(site, checkError, t("error.check")) });
        }
        finally {
            setChecking(false);
        }
    };
    return (_jsxs("div", { className: DETAIL_PANE, children: [_jsxs("div", { className: "min-w-0", children: [_jsx("h2", { className: "truncate font-medium text-base", children: (provider ? provider.name : draft.name.trim()) || t("new.title") }), _jsxs("p", { className: "truncate text-cms-muted-foreground text-xs", children: [providerKindLabel(draft.kind), " \u00B7 ", provider?.defaultModel || draft.defaultModel || t("model.none")] })] }), _jsxs(FieldGroup, { className: "gap-5", children: [_jsxs(Field, { children: [_jsx(FieldLabel, { htmlFor: ids.name, children: t("field.name") }), _jsx(Input, { id: ids.name, value: draft.name, placeholder: "OpenRouter", onChange: (event) => set({ name: event.target.value }), className: "h-8 text-xs md:text-xs" })] }), _jsxs(Field, { children: [_jsx(FieldLabel, { htmlFor: ids.kind, children: t("field.kind") }), _jsx(OptionSelect, { id: ids.kind, value: draft.kind, disabled: Boolean(provider), options: AI_PROVIDER_KINDS.map((kind) => ({ value: kind, label: providerKindLabel(kind) })), onChange: (kind) => set({ kind: kind }) })] }), _jsxs(Field, { children: [_jsx(FieldLabel, { htmlFor: ids.url, children: t("field.url") }), _jsx(Input, { id: ids.url, value: draft.url, placeholder: example.url, onChange: (event) => set({ url: event.target.value.trim() }), className: "h-8 font-mono text-xs md:text-xs" })] }), _jsxs(Field, { children: [_jsx(FieldLabel, { htmlFor: ids.key, children: t("field.key") }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsx(Input, { id: ids.key, type: "password", autoComplete: "off", value: typeof draft.apiKey === "string" ? draft.apiKey : "", placeholder: draft.apiKey === null
                                            ? t("key.cleared")
                                            : provider?.keyHint
                                                ? t("key.saved", { hint: provider.keyHint })
                                                : t("field.key"), onChange: (event) => set({ apiKey: event.target.value || undefined }), className: "h-8 font-mono text-xs md:text-xs" }), provider?.keyHint && draft.apiKey !== null && (_jsx(Button, { type: "button", variant: "ghost", size: "xs", onClick: () => set({ apiKey: null }), children: t("action.clear") }))] })] }), _jsxs(Field, { children: [_jsx(FieldLabel, { htmlFor: ids.model, children: t("field.model") }), _jsx(ModelCombobox, { id: ids.model, value: draft.defaultModel, models: modelList.models, loading: modelList.loading, error: modelList.error, placeholder: example.model, onChange: (defaultModel) => set({ defaultModel }) })] })] }), error && _jsx(InlineError, { children: error }), _jsxs("div", { className: "flex flex-wrap items-center gap-2", children: [_jsxs(Button, { type: "button", size: "sm", disabled: saving || !dirty || !draft.name.trim(), onClick: () => void save(), children: [_jsx(Save, { "aria-hidden": true }), saving ? t("action.saving") : t("action.save")] }), !provider && (_jsx(Button, { type: "button", size: "sm", variant: "outline", onClick: onCancel, children: t("action.cancel") })), _jsxs(Button, { type: "button", size: "sm", variant: "outline", disabled: checking || !draft.url || !draft.defaultModel, onClick: () => void runCheck(), children: [_jsx(PlugZap, { "aria-hidden": true }), checking ? t("action.checking") : t("action.check")] }), provider && (_jsxs(Button, { type: "button", size: "sm", variant: "ghost", className: "ml-auto text-cms-destructive hover:bg-cms-destructive/10 hover:text-cms-destructive", disabled: deleting, onClick: () => void remove(), children: [_jsx(Trash2, { "aria-hidden": true }), deleting ? t("action.deleting") : t("action.delete")] }))] }), check && (_jsx("p", { className: cn("text-xs", check.ok ? "text-cms-muted-foreground" : "text-cms-destructive"), role: check.ok ? undefined : "alert", children: check.ok ? t("check.ok", { model: check.model, seconds: (check.ms / 1000).toFixed(1) }) : check.message })), dialog] }));
}
