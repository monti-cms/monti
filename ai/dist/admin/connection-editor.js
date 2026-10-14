"use client";
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { errorText, useCmsMutation } from "@monti-cms/admin/api";
import { ApiKeyField, Button, choiceReady, commonMessages, DETAIL_PANE_FRAME, EditorFooter, EmptyState, Field, FieldError, FieldGroup, FieldLabel, Input, ListPane, ListRow, LoadErrorAlert, MasterDetail, useConfirm, useDebounced, useDraftEditor, } from "@monti-cms/admin/kit";
import { useSite, useTranslator } from "@monti-cms/core/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plug, PlugZap, Plus, Save } from "lucide-react";
import { useId, useState } from "react";
import { AI_PROVIDER_KINDS, PROVIDER_EXAMPLES, } from "../connection.js";
import { aiKeys, checkAiProvider, createAiProvider, deleteAiProvider, getAiSettings, updateAiProvider, } from "./api.js";
import { connectionMessages } from "./connection-editor.messages.js";
import { OptionSelect } from "./custom-editor.js";
import { useLabels } from "./labels.messages.js";
import { ModelCombobox, useModelList } from "./model-combobox.js";
export function useAiSettings() {
    const site = useSite();
    const t = useTranslator(connectionMessages);
    return useQuery({
        queryKey: aiKeys.settings(),
        queryFn: ({ signal }) => getAiSettings(site, { signal, fallback: t("error.loadList") }),
        // Not re-fetched every time an action is opened. Saving a connection updates the cache from the response.
        staleTime: 60_000,
    });
}
/** Time to wait for URL/key input to pause before fetching the model list. */
const LIST_INPUT_DEBOUNCE_MS = 400;
const NEW_DRAFT = { name: "", kind: "chat", url: "", key: { use: "new", value: "" }, defaultModel: "" };
const draftOf = (provider) => ({
    name: provider.name,
    kind: provider.kind,
    url: provider.url,
    key: provider.key ? { use: "saved", keyId: provider.key.id } : { use: "new", value: "" },
    defaultModel: provider.defaultModel,
});
/** The draft as the server takes it: a new key with nothing typed yet is left out, so the connection keeps the key it had. */
const payload = ({ key, ...rest }) => (choiceReady(key) && key.use !== "none" ? { ...rest, key } : rest);
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
        queryClient.setQueryData(aiKeys.settings(), saved);
        void queryClient.invalidateQueries({ queryKey: aiKeys.actions() });
    };
    const current = settings?.providers.find((provider) => provider.id === selected) ?? null;
    return (_jsxs("div", { className: "flex min-h-0 flex-1 flex-col", children: [settingsQuery.error && !settings && (_jsx(LoadErrorAlert, { className: "m-3", message: errorText(site, settingsQuery.error, t("error.loadList")), onRetry: () => void settingsQuery.refetch() })), _jsx(MasterDetail, { list: _jsx(ListPane, { label: t("list.label"), loading: settingsQuery.isPending, skeletonRows: 2, header: settings?.fake && (_jsx("p", { className: "border-b px-3 py-2 text-cms-muted-foreground text-xs", children: t("badge.fake") })), empty: settings?.providers.length === 0 ? _jsx(EmptyState, { compact: true, title: t("list.empty") }) : null, children: settings?.providers.map((provider) => (_jsx(ListRow, { title: provider.name, status: provider.ready ? null : t("status.needsSetup"), detail: `${providerKindLabel(provider.kind)} · ${provider.defaultModel || t("model.none")}`, current: selected === provider.id, onClick: () => onOpen(provider.id) }, provider.id))) }), children: settings && (selected === "new" || current) ? (_jsx(ProviderEditor, { version: settings.version, provider: current, onSaved: (saved, id) => {
                        applySaved(saved);
                        onSelectedChange(id);
                    }, onDeleted: (saved) => {
                        applySaved(saved);
                        onSelectedChange(null);
                    }, onCancel: () => onSelectedChange(null), onConflict: () => void settingsQuery.refetch(), onDirtyChange: onDirtyChange }, selected ?? "none")) : (settings && (_jsx(EmptyState, { icon: Plug, title: t("empty.title"), action: { label: t("action.add"), onClick: () => onOpen("new"), icon: Plus } }))) })] }));
}
function ProviderEditor({ version, provider, onSaved, onDeleted, onCancel, onConflict, onDirtyChange, }) {
    const site = useSite();
    const t = useTranslator(connectionMessages);
    const tc = useTranslator(commonMessages);
    const { providerKindLabel } = useLabels();
    const [error, setError] = useState(null);
    const [check, setCheck] = useState(null);
    const { confirm, dialog } = useConfirm();
    const ids = { name: useId(), kind: useId(), url: useId(), model: useId() };
    const editor = useDraftEditor({ saved: provider ? draftOf(provider) : null, empty: NEW_DRAFT, onDirtyChange });
    const { draft, dirty } = editor;
    const set = (patch) => {
        editor.update(patch);
        setCheck(null);
    };
    const example = PROVIDER_EXAMPLES[draft.kind];
    // While typing the URL or key the list is not fetched; it is fetched once typing pauses. If the saved key is used as is, it is fetched by connection id.
    const listUrl = useDebounced(draft.url, LIST_INPUT_DEBOUNCE_MS);
    const typedKey = useDebounced(draft.key.use === "new" ? draft.key.value : undefined, LIST_INPUT_DEBOUNCE_MS);
    const modelSource = draft.kind !== "chat" || !listUrl
        ? null
        : typedKey
            ? { url: listUrl, apiKey: typedKey }
            : draft.key.use === "saved"
                ? { url: listUrl, keyId: draft.key.keyId }
                : null;
    const modelList = useModelList(modelSource);
    const saveMutation = useCmsMutation({
        fn: (_, { site }) => {
            const json = { expectedVersion: version, provider: payload(draft) };
            return provider
                ? updateAiProvider(site, provider.id, json, tc("saveFailed"))
                : createAiProvider(site, json, tc("saveFailed"));
        },
        success: tc("saved"),
        failure: tc("saveFailed"),
        inline: true,
        onSuccess: (saved) => {
            // A new connection is appended to the end of the list.
            onSaved(saved, provider?.id ?? saved.providers.at(-1)?.id ?? "");
        },
        onError: (saveError) => {
            setError(errorText(site, saveError, tc("saveFailed")));
            onConflict();
        },
    });
    const deleteMutation = useCmsMutation({
        fn: (target, { site }) => deleteAiProvider(site, target.id, version, tc("deleteFailed")),
        success: tc("deleted"),
        failure: tc("deleteFailed"),
        inline: true,
        onSuccess: (saved) => onDeleted(saved),
        onError: (deleteError) => {
            setError(errorText(site, deleteError, tc("deleteFailed")));
            onConflict();
        },
    });
    /** Checks with the current input before saving. If no new key was entered, uses the saved key. */
    const checkMutation = useCmsMutation({
        fn: (_, { site }) => checkAiProvider(site, { providerId: provider?.id, provider: payload(draft) }, t("error.check")),
        failure: t("error.check"),
        inline: true,
        onSuccess: setCheck,
        onError: (checkError) => setCheck({ ok: false, message: errorText(site, checkError, t("error.check")) }),
    });
    const saving = saveMutation.isPending;
    const deleting = deleteMutation.isPending;
    const checking = checkMutation.isPending;
    const save = () => {
        setError(null);
        saveMutation.mutate(undefined);
    };
    const remove = async () => {
        if (!provider)
            return;
        const ok = await confirm({
            title: t("confirm.title"),
            description: t("confirm.description", { name: provider.name }),
            confirmLabel: tc("delete"),
            destructive: true,
        });
        if (!ok)
            return;
        setError(null);
        deleteMutation.mutate(provider);
    };
    const runCheck = () => checkMutation.mutate(undefined);
    return (_jsxs("div", { className: DETAIL_PANE_FRAME, children: [_jsxs("div", { className: "min-w-0", children: [_jsx("h2", { className: "truncate font-medium text-base", children: (provider ? provider.name : draft.name.trim()) || t("new.title") }), _jsxs("p", { className: "truncate text-cms-muted-foreground text-xs", children: [providerKindLabel(draft.kind), " \u00B7 ", provider?.defaultModel || draft.defaultModel || t("model.none")] })] }), _jsxs(FieldGroup, { className: "gap-5", children: [_jsxs(Field, { children: [_jsx(FieldLabel, { htmlFor: ids.name, children: t("field.name") }), _jsx(Input, { id: ids.name, value: draft.name, placeholder: "OpenRouter", onChange: (event) => set({ name: event.target.value }), className: "h-8 text-xs md:text-xs" })] }), _jsxs(Field, { children: [_jsx(FieldLabel, { htmlFor: ids.kind, children: t("field.kind") }), _jsx(OptionSelect, { id: ids.kind, value: draft.kind, disabled: Boolean(provider), options: AI_PROVIDER_KINDS.map((kind) => ({ value: kind, label: providerKindLabel(kind) })), onChange: (kind) => set({ kind: kind }) })] }), _jsxs(Field, { children: [_jsx(FieldLabel, { htmlFor: ids.url, children: t("field.url") }), _jsx(Input, { id: ids.url, value: draft.url, placeholder: example.url, onChange: (event) => set({ url: event.target.value.trim() }), className: "h-8 font-mono text-xs md:text-xs" })] }), _jsx(ApiKeyField, { label: t("field.key"), baseName: draft.name.trim() || "API", value: draft.key, onChange: (key) => set({ key }) }), _jsxs(Field, { children: [_jsx(FieldLabel, { htmlFor: ids.model, children: t("field.model") }), _jsx(ModelCombobox, { id: ids.model, value: draft.defaultModel, models: modelList.models, loading: modelList.loading, error: modelList.error, placeholder: example.model, onChange: (defaultModel) => set({ defaultModel }) })] })] }), _jsx(EditorFooter, { dirty: dirty, saving: saving, deleting: deleting, canSave: Boolean(draft.name.trim()), error: error, saveIcon: _jsx(Save, { "aria-hidden": true }), onSave: save, onCancel: provider ? undefined : onCancel, onDelete: provider ? () => void remove() : undefined, children: _jsxs(Button, { type: "button", size: "sm", variant: "outline", disabled: checking || !draft.url || !draft.defaultModel, onClick: () => void runCheck(), children: [_jsx(PlugZap, { "aria-hidden": true }), checking ? t("action.checking") : t("action.check")] }) }), check &&
                (check.ok ? (_jsx("p", { className: "text-cms-muted-foreground text-xs", children: t("check.ok", { model: check.model, seconds: (check.ms / 1000).toFixed(1) }) })) : (_jsx(FieldError, { children: check.message }))), dialog] }));
}
