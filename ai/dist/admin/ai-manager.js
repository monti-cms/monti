"use client";
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { errorText, useCmsMutation } from "@monti-cms/admin/api";
import { Button, Checkbox, cn, commonMessages, DETAIL_PANE_FRAME, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, EditorFooter, EmptyState, Field, FieldError, FieldGroup, FieldLabel, FieldTitle, IconButton, Input, isComposingKey, Label, ListPane, ListRow, LoadErrorAlert, MasterDetail, PageActions, PageTabs, Switch, Tabs, TabsContent, TabsTrigger, Textarea, useConfirm, useDraftEditor, useHydratedQuery, useUnsavedGuard, } from "@monti-cms/admin/kit";
import { SLOT_CHIP } from "@monti-cms/admin/slots";
import { useSite, useTranslator } from "@monti-cms/core/client";
import { useQueryClient } from "@tanstack/react-query";
import { Eye, EyeOff, Plug, Plus, Quote, RotateCcw, Save, Sparkles, Trash2, X } from "lucide-react";
import { useCallback, useId, useState } from "react";
import { draftCustomView } from "../action-view.js";
import { ADDABLE_CHECKS, checkKey } from "../definition.js";
import { aiManagerMessages } from "./ai-manager.messages.js";
import { runAiAction, useAiActions } from "./ai-slot-provider.js";
import { missingRequired, SampleInputs, sampleDefaults, sampleFields, sampleRun } from "./ai-test-sample.js";
import { aiKeys, createAiAction, deleteAiAction, updateAiAction } from "./api.js";
import { ConnectionManager, useAiSettings } from "./connection-editor.js";
import { CustomBaseFields, NEW_CUSTOM_BASE, OptionSelect } from "./custom-editor.js";
import { useLabels } from "./labels.messages.js";
import { ModelCombobox, useModelList } from "./model-combobox.js";
import { PROMPT_ROWS, PROMPT_TEXTAREA, SnippetManager, useAiSnippets } from "./snippet-editor.js";
/** Visible name of the attach target. For a field, it is the name in the collection definition. */
function usePlaceLabel() {
    const site = useSite();
    const t = useTranslator(aiManagerMessages);
    const { slotLabel, slotTargetLabel } = useLabels();
    return (action) => {
        const attach = action.attach[0];
        if (!attach)
            return t("place.direct");
        switch (attach.slot) {
            case "field": {
                for (const collection of site.COLLECTIONS) {
                    const field = site.schemaOf(collection).fields[attach.field];
                    if (field)
                        return `${slotLabel("field")} · ${field.label}`;
                }
                return `${slotLabel("field")} · ${attach.field}`;
            }
            case "translation":
            case "selection":
            case "insert":
                return slotLabel(attach.slot);
            case "block":
                return `${slotLabel("block")} · ${site.BLOCK_BY_NAME.get(attach.block)?.label ?? attach.block}`;
            default: {
                return `${slotLabel(attach.slot)} · ${slotTargetLabel(attach.slot, attach.target)}`;
            }
        }
    };
}
const editableOf = (action) => ({
    enabled: action.enabled,
    hidden: action.hidden,
    label: action.label,
    askInstruction: action.askInstruction,
    instant: action.instant,
    providerId: action.providerId,
    modelName: action.modelName,
    prompt: action.prompt,
    send: action.send,
    threshold: action.threshold,
    maxCount: action.maxCount,
    checks: action.checks,
});
const draftOfFeature = (feature) => ({
    feature,
    spec: editableOf(feature),
    ...(feature.custom ? { base: feature.custom } : {}),
});
/** Two drafts read the same when the edited values and the action's version are the same. A different version means the server's copy moved on. */
const sameFeatureDraft = (a, b) => a === b ||
    (a !== null &&
        b !== null &&
        a.feature.key === b.feature.key &&
        a.feature.version === b.feature.version &&
        JSON.stringify({ spec: a.spec, base: a.base }) === JSON.stringify({ spec: b.spec, base: b.base }));
const EMPTY_SAMPLE = { values: {}, request: "" };
/**
 * Admin AI screen. The Actions tab lists actions defined in code and actions created in the screen; for each action you edit enabled, ask-for-request,
 * connection, model, content to send, instructions and checks, then test before saving. The Connections tab stores several service URLs, keys and default models.
 * The Prompt snippets tab edits and adds the text that goes into `{{snippet.key}}` in instructions. All three tabs are a list + a detail pane.
 * Opening another item or tab with unsaved content asks whether to discard it.
 */
export function AiManager() {
    const site = useSite();
    const t = useTranslator(aiManagerMessages);
    const tc = useTranslator(commonMessages);
    const { engineLabel } = useLabels();
    const placeLabel = usePlaceLabel();
    const queryClient = useQueryClient();
    // The layout's AI slot provider asks for the same list, so it can be in the cache before this page hydrates.
    const featuresQuery = useHydratedQuery(useAiActions());
    const _settingsQuery = useAiSettings();
    const _snippetsQuery = useAiSnippets();
    const features = featuresQuery.data?.items ?? [];
    const usable = new Set(featuresQuery.data?.usable ?? []);
    const [tab, setTab] = useState("features");
    /** The action opened for editing, as it was at open time. If `isNew`, it is a new screen action not yet saved (saving creates it). */
    const [opened, setOpened] = useState(null);
    const [formError, setFormError] = useState(null);
    /** The open connection. The header's Add connection changes it, so it lives outside the Connections tab. */
    const [connection, setConnection] = useState(null);
    const [connectionDirty, setConnectionDirty] = useState(false);
    /** The open prompt snippet. The header's Add snippet changes it, so it lives outside the Prompt snippets tab. */
    const [snippet, setSnippet] = useState(null);
    const [snippetDirty, setSnippetDirty] = useState(false);
    const { confirm, confirmDiscard, dialog } = useConfirm();
    const replaceInCache = (feature) => queryClient.setQueryData(aiKeys.actions(), (data) => data ? { ...data, items: data.items.map((item) => (item.key === feature.key ? feature : item)) } : data);
    const removeMutation = useCmsMutation({
        fn: (feature, { site }) => deleteAiAction(site, feature.key, feature.version, tc("deleteFailed")),
        success: tc("deleted"),
        failure: tc("deleteFailed"),
        inline: true,
        onSuccess: (_result, feature) => {
            queryClient.setQueryData(aiKeys.actions(), (data) => data ? { ...data, items: data.items.filter((item) => item.key !== feature.key) } : data);
            setOpened(null);
        },
        onError: (error) => setFormError(errorText(site, error, tc("deleteFailed"))),
    });
    const saveMutation = useCmsMutation({
        fn: (current, { site }) => current.isNew && current.base
            ? createAiAction(site, { base: { ...current.base, label: current.base.label.trim() }, value: current.spec }, tc("saveFailed"))
            : updateAiAction(site, current.feature.key, {
                expectedVersion: current.feature.version,
                value: current.spec,
                ...(current.base ? { base: { ...current.base, label: current.base.label.trim() } } : {}),
            }, tc("saveFailed")),
        success: tc("saved"),
        failure: tc("saveFailed"),
        inline: true,
        invalidate: [aiKeys.actions()],
        onSuccess: (saved, current) => {
            if (current.isNew && current.base) {
                queryClient.setQueryData(aiKeys.actions(), (data) => data ? { ...data, items: [...data.items, saved] } : data);
            }
            else
                replaceInCache(saved);
            open(saved);
        },
        onError: (error) => setFormError(errorText(site, error, tc("saveFailed"))),
    });
    const saving = saveMutation.isPending;
    const deleting = removeMutation.isPending;
    const [showHidden, setShowHidden] = useState(false);
    const quickPatchMutation = useCmsMutation({
        fn: ({ feature, patch }, { site }) => updateAiAction(site, feature.key, {
            expectedVersion: feature.version,
            value: patch,
        }, tc("saveFailed")),
        failure: tc("saveFailed"),
        inline: true,
        invalidate: [aiKeys.actions()],
        onSuccess: (saved) => {
            replaceInCache(saved);
            if (editing && !editing.isNew && editing.feature.key === saved.key) {
                setOpened({ saved: draftOfFeature(saved), isNew: false });
            }
        },
        onError: (error) => setFormError(errorText(site, error, tc("saveFailed"))),
    });
    const handleToggle = (feature, enabled) => {
        if (editing && !editing.isNew && editing.feature.key === feature.key) {
            changeDraft((draft) => ({ ...draft, spec: { ...draft.spec, enabled } }));
        }
        queryClient.setQueryData(aiKeys.actions(), (data) => data
            ? {
                ...data,
                items: data.items.map((item) => (item.key === feature.key ? { ...item, enabled } : item)),
            }
            : data);
        quickPatchMutation.mutate({ feature, patch: { enabled } });
    };
    const handleToggleHidden = (feature, hidden) => {
        if (editing && !editing.isNew && editing.feature.key === feature.key) {
            changeDraft((draft) => ({ ...draft, spec: { ...draft.spec, hidden } }));
        }
        queryClient.setQueryData(aiKeys.actions(), (data) => data
            ? {
                ...data,
                items: data.items.map((item) => (item.key === feature.key ? { ...item, hidden } : item)),
            }
            : data);
        quickPatchMutation.mutate({ feature, patch: { hidden } });
    };
    const restoreAllHidden = async () => {
        const hiddenFeatures = features.filter((f) => f.hidden);
        for (const f of hiddenFeatures) {
            await updateAiAction(site, f.key, {
                expectedVersion: f.version,
                value: { hidden: false },
            });
        }
        void queryClient.invalidateQueries({ queryKey: aiKeys.actions() });
    };
    // The draft follows what was opened; a closed editor holds no draft.
    const editor = useDraftEditor({
        saved: opened && !opened.isNew ? opened.saved : null,
        empty: opened?.isNew ? opened.saved : null,
        equals: sameFeatureDraft,
        saving,
        deleting,
    });
    // Until the draft catches up with a newly opened action, show the action as opened.
    const shown = opened ? (editor.draft ?? opened.saved) : null;
    const editing = opened && shown ? { ...shown, isNew: opened.isNew } : null;
    const featureDirty = opened !== null && editor.dirty;
    // A link that leaves the screen (the sidebar) asks first while any open editor has changes.
    const { dialog: guardDialog } = useUnsavedGuard(featureDirty || connectionDirty || snippetDirty);
    const changeDraft = (change) => editor.update((draft) => change(draft ?? opened.saved));
    /** Opens without asking (e.g. after saving). */
    const open = (feature) => {
        setOpened({ saved: draftOfFeature(feature), isNew: false });
        setFormError(null);
    };
    /** Opens from the list. If there is unsaved content, asks first. */
    const openFeature = async (feature) => {
        if (editing && !editing.isNew && editing.feature.key === feature.key)
            return;
        if (await confirmDiscard(featureDirty))
            open(feature);
    };
    /** Opens a new screen action on the right. Saving after editing basic info, connection, instructions, etc. creates it. */
    const startNew = async () => {
        if (!(await confirmDiscard(featureDirty)))
            return;
        const base = NEW_CUSTOM_BASE(site);
        const feature = draftCustomView(site, base);
        setOpened({ saved: { feature, spec: editableOf(feature), base }, isNew: true });
        setFormError(null);
    };
    const openConnection = async (id) => {
        if (id === connection)
            return;
        if (await confirmDiscard(connectionDirty))
            setConnection(id);
    };
    const openSnippet = async (key) => {
        if (key === snippet)
            return;
        if (await confirmDiscard(snippetDirty))
            setSnippet(key);
    };
    /** Switches tabs. Closing the Connections or Prompt snippets tab discards the input, so it asks if there is unsaved content. */
    const changeTab = async (next) => {
        const dirty = (tab === "connections" && connectionDirty) || (tab === "snippets" && snippetDirty);
        if (await confirmDiscard(dirty))
            setTab(next);
    };
    /**
     * Changes the basic info of a screen action. Changing the attach target, result shape or mode changes the inputs and checks, so the screen shape is rebuilt,
     * while the edited enabled, ask-for-request, insert-directly and instructions are kept (connection and model are also kept if the mode is unchanged).
     */
    const changeBase = (base) => {
        if (!editing)
            return;
        const { label: _before, ...restBefore } = editing.base ?? base;
        const { label: _after, ...restAfter } = base;
        if (JSON.stringify(restBefore) === JSON.stringify(restAfter)) {
            changeDraft((draft) => ({ ...draft, base }));
            return;
        }
        const draft = draftCustomView(site, base);
        const feature = editing.isNew
            ? draft
            : { ...draft, key: editing.feature.key, version: editing.feature.version, updatedAt: editing.feature.updatedAt };
        const sameEngine = feature.engine === editing.feature.engine;
        const { spec } = editing;
        changeDraft(() => ({
            base,
            feature,
            spec: {
                ...editableOf(feature),
                enabled: spec.enabled,
                askInstruction: spec.askInstruction,
                instant: spec.instant,
                prompt: spec.prompt,
                ...(sameEngine ? { providerId: spec.providerId, modelName: spec.modelName } : {}),
            },
        }));
    };
    const remove = async (feature) => {
        const ok = await confirm({
            title: t("remove.title"),
            description: t("remove.description", { label: feature.label }),
            confirmLabel: tc("delete"),
            destructive: true,
        });
        if (!ok)
            return;
        setFormError(null);
        removeMutation.mutate(feature);
    };
    const save = () => {
        if (!editing)
            return;
        setFormError(null);
        saveMutation.mutate(editing);
    };
    const onConnectionDirty = useCallback((dirty) => setConnectionDirty(dirty), []);
    const onSnippetDirty = useCallback((dirty) => setSnippetDirty(dirty), []);
    const headerActions = tab === "features" ? (_jsxs(Button, { type: "button", size: "sm", onClick: () => void startNew(), children: [_jsx(Plus, { "aria-hidden": true }), t("add.feature")] })) : tab === "connections" ? (_jsxs(Button, { type: "button", size: "sm", onClick: () => void openConnection("new"), children: [_jsx(Plus, { "aria-hidden": true }), t("add.connection")] })) : (_jsxs(Button, { type: "button", size: "sm", onClick: () => void openSnippet("new"), children: [_jsx(Plus, { "aria-hidden": true }), t("add.snippet")] }));
    return (_jsxs("div", { className: "flex min-h-0 flex-1 flex-col overflow-hidden", children: [_jsx(PageActions, { children: headerActions }), _jsxs(Tabs, { value: tab, onValueChange: (value) => void changeTab(value), className: "flex min-h-0 flex-1 flex-col gap-0", children: [_jsxs(PageTabs, { children: [_jsxs(TabsTrigger, { value: "features", className: "flex-none px-0 text-xs", children: [_jsx(Sparkles, { "aria-hidden": true }), t("tab.features")] }), _jsxs(TabsTrigger, { value: "connections", className: "flex-none px-0 text-xs", children: [_jsx(Plug, { "aria-hidden": true }), t("tab.connections")] }), _jsxs(TabsTrigger, { value: "snippets", className: "flex-none px-0 text-xs", children: [_jsx(Quote, { "aria-hidden": true }), t("tab.snippets")] })] }), _jsxs(TabsContent, { value: "features", className: "flex min-h-0 flex-1 flex-col", children: [featuresQuery.error && !featuresQuery.data && (_jsx(LoadErrorAlert, { className: "m-3", message: errorText(site, featuresQuery.error, t("list.loadFailed")), onRetry: () => void featuresQuery.refetch() })), _jsx(MasterDetail, { list: _jsx(ListPane, { label: t("list.label"), loading: featuresQuery.isPending, skeletonRows: 4, empty: featuresQuery.data && features.length === 0 && !editing?.isNew ? (_jsx(EmptyState, { compact: true, title: t("list.empty") })) : null, children: [
                                        ...features
                                            .filter((feature) => !feature.hidden)
                                            .map((feature) => (_jsx(ListRow, { title: feature.label, status: !feature.enabled
                                                ? t("status.off")
                                                : usable.has(feature.key)
                                                    ? null
                                                    : t("status.needsConnection"), detail: `${placeLabel(feature)} · ${engineLabel(feature.engine)}${feature.custom ? ` · ${t("detail.custom")}` : ""}`, 
                                            // While a new unsaved action is open, no other row in the list is shown as open.
                                            current: editing !== null && !editing.isNew && editing.feature.key === feature.key, onClick: () => void openFeature(feature), trailing: _jsx(Switch, { size: "sm", checked: feature.enabled, "aria-label": t("toggle.enableAction", { label: feature.label }), onClick: (e) => e.stopPropagation(), onCheckedChange: (checked) => handleToggle(feature, checked) }), actions: feature.custom
                                                ? [
                                                    {
                                                        kind: "item",
                                                        label: tc("delete"),
                                                        icon: Trash2,
                                                        onSelect: () => void remove(feature),
                                                        destructive: true,
                                                    },
                                                ]
                                                : [
                                                    {
                                                        kind: "item",
                                                        label: t("action.hide"),
                                                        icon: EyeOff,
                                                        onSelect: () => handleToggleHidden(feature, true),
                                                    },
                                                ], actionsLabel: feature.label }, feature.key))),
                                        ...(showHidden
                                            ? features
                                                .filter((feature) => feature.hidden)
                                                .map((feature) => (_jsx(ListRow, { title: feature.label, status: t("status.hidden"), detail: `${placeLabel(feature)} · ${engineLabel(feature.engine)}`, current: editing !== null && !editing.isNew && editing.feature.key === feature.key, onClick: () => void openFeature(feature), trailing: _jsx(Switch, { size: "sm", checked: feature.enabled, "aria-label": t("toggle.enableAction", { label: feature.label }), onClick: (e) => e.stopPropagation(), onCheckedChange: (checked) => handleToggle(feature, checked) }), actions: [
                                                    {
                                                        kind: "item",
                                                        label: t("action.unhide"),
                                                        icon: Eye,
                                                        onSelect: () => handleToggleHidden(feature, false),
                                                    },
                                                ], actionsLabel: feature.label }, feature.key)))
                                            : []),
                                        ...(editing?.isNew
                                            ? [
                                                _jsx(ListRow, { title: editing.base?.label.trim() || t("title.new"), status: t("status.unsaved"), detail: `${placeLabel(editing.feature)} · ${engineLabel(editing.feature.engine)}`, current: true, onClick: () => { } }, "new"),
                                            ]
                                            : []),
                                        ...(features.some((feature) => feature.hidden)
                                            ? [
                                                _jsxs("li", { className: "flex items-center justify-between border-t p-2", children: [_jsx(Button, { type: "button", size: "xs", variant: "ghost", className: "text-cms-muted-foreground hover:text-cms-foreground", onClick: () => setShowHidden(!showHidden), children: showHidden
                                                                ? t("list.hideHidden", {
                                                                    count: features.filter((feature) => feature.hidden).length,
                                                                })
                                                                : t("list.showHidden", {
                                                                    count: features.filter((feature) => feature.hidden).length,
                                                                }) }), showHidden && (_jsxs(Button, { type: "button", size: "xs", variant: "outline", onClick: () => void restoreAllHidden(), children: [_jsx(RotateCcw, { "aria-hidden": true }), t("button.restoreHidden")] }))] }, "hidden-toggle"),
                                            ]
                                            : []),
                                    ] }), children: editing ? (_jsx(FeatureEditor, { feature: editing.feature, spec: editing.spec, saving: saving, deleting: deleting, dirty: featureDirty, error: formError, onChange: (spec) => changeDraft((draft) => ({ ...draft, spec })), onSave: () => void save(), custom: editing.base
                                        ? {
                                            base: editing.base,
                                            onBaseChange: changeBase,
                                            isNew: editing.isNew === true,
                                            onCancel: () => setOpened(null),
                                            onDelete: () => void remove(editing.feature),
                                        }
                                        : undefined }, editing.isNew ? "new" : editing.feature.key)) : (featuresQuery.data && (_jsx(EmptyState, { icon: Sparkles, title: t("empty.pick"), action: { label: t("add.feature"), onClick: () => void startNew(), icon: Plus } }))) })] }), _jsx(TabsContent, { value: "snippets", className: "flex min-h-0 flex-1 flex-col", children: _jsx(SnippetManager, { selected: snippet, onOpen: (key) => void openSnippet(key), onSelectedChange: setSnippet, onDirtyChange: onSnippetDirty }) }), _jsx(TabsContent, { value: "connections", className: "flex min-h-0 flex-1 flex-col", children: _jsx(ConnectionManager, { selected: connection, onOpen: (id) => void openConnection(id), onSelectedChange: setConnection, onDirtyChange: onConnectionDirty }) })] }), dialog, guardDialog] }));
}
/** Chip input for the allowed values check. Users can add tags by typing and pressing Enter or comma, and remove tags with backspace or clicking x. */
function OneOfInput({ items, disabled, onChange, }) {
    const t = useTranslator(aiManagerMessages);
    const [input, setInput] = useState("");
    const addItem = (value) => {
        const trimmed = value.trim();
        if (trimmed && !items.includes(trimmed)) {
            onChange([...items, trimmed]);
            setInput("");
        }
    };
    const removeItem = (index) => {
        onChange(items.filter((_, i) => i !== index));
    };
    const handleKeyDown = (event) => {
        if (isComposingKey(event))
            return;
        if (event.key === "Enter" || event.key === ",") {
            event.preventDefault();
            addItem(input);
        }
        else if (event.key === "Backspace" && !input && items.length > 0) {
            removeItem(items.length - 1);
        }
    };
    return (_jsxs("div", { className: cn("flex min-h-8 flex-1 flex-wrap items-center gap-1.5 rounded-md border border-cms-input bg-cms-background p-1 text-xs shadow-sm transition-colors focus-within:ring-1 focus-within:ring-cms-ring", disabled && "cursor-not-allowed opacity-50"), children: [items.map((item, index) => (_jsxs("span", { className: "inline-flex items-center gap-1 rounded bg-cms-muted px-2 py-0.5 font-mono text-cms-foreground text-xs", children: [_jsx("span", { className: "max-w-40 truncate", children: item }), !disabled && (_jsx("button", { type: "button", "aria-label": t("check.oneOfRemove", { item }), onClick: () => removeItem(index), className: "rounded-sm opacity-70 hover:opacity-100 focus:outline-none", children: _jsx(X, { className: "size-3", "aria-hidden": true }) }))] }, item))), !disabled && (_jsx("input", { type: "text", value: input, placeholder: items.length === 0 ? t("check.oneOfPlaceholder") : "", onChange: (e) => setInput(e.target.value), onKeyDown: handleKeyDown, onBlur: () => {
                    if (input.trim())
                        addItem(input);
                }, className: "h-6 min-w-28 flex-1 border-0 bg-transparent px-1 font-mono text-xs shadow-none outline-none placeholder:text-cms-muted-foreground/60 focus:ring-0" }))] }));
}
/** One check row. Toggle it on/off; edit a regex for format, a character count for length, or a value list for one-of. Added checks can be deleted. */
function CheckRow({ check, label, onChange, onRemove, }) {
    const t = useTranslator(aiManagerMessages);
    const id = useId();
    return (_jsxs("li", { className: cn("flex min-h-8 gap-2", check.kind === "oneOf" ? "items-start pt-0.5" : "items-center"), children: [_jsx(Switch, { id: id, size: "sm", checked: check.enabled, onCheckedChange: (enabled) => onChange({ ...check, enabled }) }), _jsx(Label, { htmlFor: id, className: cn("shrink-0 font-normal text-xs", check.kind === "oneOf" ? "w-28 pt-1.5" : "w-28"), children: label }), check.kind === "pattern" && (_jsx(Input, { "aria-label": t("check.pattern"), value: check.pattern, disabled: !check.enabled, onChange: (event) => onChange({ ...check, pattern: event.target.value }), className: "h-8 min-w-0 flex-1 font-mono text-xs" })), check.kind === "maxLength" && (_jsxs("span", { className: "flex items-center gap-2", children: [_jsx(Input, { type: "number", "aria-label": t("check.maxChars"), min: 1, max: 5000, value: check.max, disabled: !check.enabled, onChange: (event) => onChange({ ...check, max: Math.min(5000, Math.max(1, Number(event.target.value) || 1)) }), className: "h-8 w-20 text-xs" }), _jsx("span", { className: "text-cms-muted-foreground", children: t("check.charsOrLess") })] })), check.kind === "oneOf" && (_jsx(OneOfInput, { items: check.items, disabled: !check.enabled, onChange: (items) => onChange({ ...check, items }) })), onRemove && (_jsx(IconButton, { label: t("check.remove", { label }), size: "icon-xs", destructive: true, onClick: onRemove, className: cn("ml-auto", check.kind === "oneOf" && "mt-1"), children: _jsx(Trash2, { "aria-hidden": true }) }))] }));
}
function FeatureEditor({ feature, spec, saving, deleting, dirty, error, onChange, onSave, custom, }) {
    const site = useSite();
    const t = useTranslator(aiManagerMessages);
    const { checkLabel, engineLabel } = useLabels();
    const placeLabel = usePlaceLabel();
    const ids = {
        name: useId(),
        provider: useId(),
        prompt: useId(),
        threshold: useId(),
        sendTitle: useId(),
        checksTitle: useId(),
    };
    const deciding = feature.engine === "decide";
    const settings = useAiSettings().data;
    const kind = deciding ? "decisions" : "chat";
    const providers = (settings?.providers ?? []).filter((provider) => provider.kind === kind);
    const chosen = spec.providerId
        ? providers.find((provider) => provider.id === spec.providerId)
        : providers.find((provider) => provider.ready);
    const canRun = Boolean(settings?.fake) || Boolean(chosen?.url && chosen.key?.readable && (spec.modelName || chosen.defaultModel));
    // Model list of the selected generation connection. A list that was fetched once is remembered and not fetched again.
    const modelList = useModelList(!deciding && chosen?.key?.readable ? { providerId: chosen.id } : null);
    const [sample, setSample] = useState(EMPTY_SAMPLE);
    const [test, setTest] = useState(null);
    const set = (patch) => onChange({ ...spec, ...patch });
    // Defaults of a code action. Reset to default only reverts the input fields (enabled stays as is); saving is a separate click.
    const defaults = custom ? null : feature.defaults;
    const atDefaults = defaults !== null &&
        JSON.stringify({ ...defaults, enabled: spec.enabled, hidden: spec.hidden }) === JSON.stringify(spec);
    // Checks that can be added: those among format, length and one-of that are not present yet. An MDX result (body fragment) gets no character checks.
    const addableChecks = Object.keys(ADDABLE_CHECKS).filter((kind) => feature.result !== "mdx" && feature.result !== "note" && !spec.checks.some((check) => check.kind === kind));
    const uses = (input) => spec.send.includes(input);
    const inputs = Object.entries(feature.input).filter(([, input]) => input.kind !== "locale" && !(deciding && input.kind === "image"));
    const providerOptions = [
        { value: "", label: t("connection.first", { engine: engineLabel(feature.engine) }) },
        ...(spec.providerId && !providers.some((provider) => provider.id === spec.providerId)
            ? [{ value: spec.providerId, label: t("connection.deleted") }]
            : []),
        ...providers.map((provider) => ({ value: provider.id, label: provider.name })),
    ];
    const sampleInputs = sampleFields(feature, spec.send);
    const sampleStart = sampleDefaults(site, feature);
    const testRunning = test?.status === "running";
    const testDisabled = !canRun || testRunning || missingRequired(sampleInputs, sample.values, sampleStart);
    const runTest = async () => {
        if (testDisabled)
            return;
        setTest({ status: "running" });
        try {
            // A screen action is tested with the basic info being edited (including a new action not yet saved).
            const options = {
                draft: spec,
                request: spec.askInstruction ? sample.request : undefined,
                ...(custom ? { draftBase: { ...custom.base, label: custom.base.label.trim() || t("title.new") } } : {}),
            };
            const { input, env } = sampleRun(feature, sampleInputs, sample.values, sampleStart);
            setTest({ status: "done", result: await runAiAction(site, feature.key, input, { ...options, env }) });
        }
        catch (runError) {
            setTest({ status: "error", message: errorText(site, runError, t("test.failed")) });
        }
    };
    return (_jsxs("div", { className: DETAIL_PANE_FRAME, children: [_jsxs("div", { className: "flex flex-wrap items-center gap-x-4 gap-y-2", children: [_jsxs("div", { className: "min-w-0 flex-1", children: [_jsx("h2", { className: "truncate font-medium text-base", children: (custom ? custom.base.label.trim() : spec.label?.trim() || feature.label) || t("title.new") }), _jsxs("p", { className: "truncate text-cms-muted-foreground text-xs", children: [placeLabel(feature), " \u00B7 ", engineLabel(feature.engine)] })] }), _jsxs(Label, { className: "font-normal text-xs", children: [_jsx(Switch, { size: "sm", checked: spec.enabled, onCheckedChange: (enabled) => set({ enabled }) }), t("toggle.on")] }), _jsxs(Label, { className: "font-normal text-xs", children: [_jsx(Switch, { size: "sm", checked: spec.askInstruction, onCheckedChange: (askInstruction) => set({ askInstruction }) }), t("toggle.ask")] }), feature.apply !== "none" && (feature.result === "candidates" || feature.result === "text") && (_jsxs(Label, { className: "font-normal text-xs", children: [_jsx(Switch, { size: "sm", checked: spec.instant, onCheckedChange: (instant) => set({ instant }) }), t("toggle.instant")] }))] }), custom ? (_jsx("section", { "aria-label": t("section.basics"), className: "rounded-md border p-3", children: _jsx(CustomBaseFields, { base: custom.base, onChange: custom.onBaseChange }) })) : (_jsx("section", { "aria-label": t("section.basics"), className: "rounded-md border p-3", children: _jsxs(Field, { children: [_jsx(FieldLabel, { htmlFor: ids.name, children: t("field.name") }), _jsx(Input, { id: ids.name, value: spec.label ?? feature.label, maxLength: 60, placeholder: feature.defaults?.label ?? feature.label, onChange: (event) => set({ label: event.target.value }), className: "h-8 text-xs md:text-xs" })] }) })), _jsxs(FieldGroup, { className: "gap-5", children: [_jsxs(Field, { children: [_jsx(FieldLabel, { htmlFor: ids.provider, children: t("field.connection") }), _jsxs("div", { className: "flex min-w-0 items-center gap-2", children: [_jsx(OptionSelect, { id: ids.provider, value: spec.providerId ?? "", options: providerOptions, onChange: (value) => set({ providerId: value || null, modelName: "" }) }), _jsx(ModelCombobox, { "aria-label": t("field.model"), value: spec.modelName, models: modelList.models, loading: modelList.loading, error: modelList.error, placeholder: chosen?.defaultModel || t("field.defaultModel"), onChange: (modelName) => set({ modelName }) })] })] }), inputs.length > 0 && (_jsxs(Field, { role: "group", "aria-labelledby": ids.sendTitle, children: [_jsx(FieldTitle, { id: ids.sendTitle, children: t("field.send") }), _jsx("div", { className: "flex flex-wrap gap-3", children: inputs.map(([name, input]) => (_jsxs(Label, { className: "font-normal text-xs", children: [_jsx(Checkbox, { checked: uses(name) || input.required, disabled: input.required, onCheckedChange: (checked) => set({
                                                send: checked === true ? [...spec.send, name] : spec.send.filter((item) => item !== name),
                                            }) }), input.label] }, name))) })] })), deciding && (_jsxs(Field, { children: [_jsx(FieldLabel, { htmlFor: ids.threshold, children: t("field.threshold") }), _jsxs("div", { className: "flex items-center gap-2 text-xs", children: [_jsx(Input, { id: ids.threshold, type: "number", min: 1, max: 99, value: Math.round(spec.threshold * 100), onChange: (event) => set({ threshold: Math.min(99, Math.max(1, Number(event.target.value) || 1)) / 100 }), className: "h-8 w-20 text-xs md:text-xs" }), _jsx("span", { className: "text-cms-muted-foreground", children: t("field.percentOrMore") }), _jsx(Input, { type: "number", "aria-label": t("field.maxCount"), min: 1, max: 20, value: spec.maxCount, onChange: (event) => set({ maxCount: Math.min(20, Math.max(1, Number(event.target.value) || 1)) }), className: "ml-3 h-8 w-16 text-xs md:text-xs" }), _jsx("span", { className: "text-cms-muted-foreground", children: t("field.countUpTo") })] })] })), _jsxs(Field, { role: "group", "aria-labelledby": ids.checksTitle, children: [_jsx(FieldTitle, { id: ids.checksTitle, children: t("field.checks") }), _jsxs("div", { className: "flex flex-col gap-1.5 text-xs", children: [_jsx("ul", { className: "flex flex-col gap-1.5", "aria-label": t("field.checks"), children: spec.checks.map((check, index) => (_jsx(CheckRow, { check: check, label: check.kind === "code" ? (feature.validatorLabels[check.name] ?? check.name) : checkLabel(check.kind), onChange: (next) => set({ checks: spec.checks.map((item, i) => (i === index ? next : item)) }), onRemove: feature.definedChecks.includes(checkKey(check))
                                                ? undefined
                                                : () => set({ checks: spec.checks.filter((_, i) => i !== index) }) }, checkKey(check)))) }), addableChecks.length > 0 && (_jsxs(DropdownMenu, { children: [_jsxs(DropdownMenuTrigger, { render: _jsx(Button, { type: "button", size: "xs", variant: "ghost", className: "self-start text-cms-muted-foreground" }), children: [_jsx(Plus, { "aria-hidden": true }), t("field.addCheck")] }), _jsx(DropdownMenuContent, { align: "start", className: "min-w-32", children: addableChecks.map((kind) => (_jsxs(DropdownMenuItem, { onClick: () => set({ checks: [...spec.checks, ADDABLE_CHECKS[kind]] }), children: [_jsx(Plus, { "aria-hidden": true }), checkLabel(kind)] }, kind))) })] }))] })] }), _jsxs(Field, { children: [_jsx(FieldLabel, { htmlFor: ids.prompt, children: deciding ? t("field.criteria") : t("field.prompt") }), _jsx(Textarea, { id: ids.prompt, rows: PROMPT_ROWS, value: spec.prompt, onChange: (event) => set({ prompt: event.target.value }), className: PROMPT_TEXTAREA })] })] }), _jsxs(EditorFooter, { dirty: dirty, saving: saving, deleting: deleting, canSave: !(custom?.isNew === true && !custom.base.label.trim()), error: error, saveIcon: _jsx(Save, { "aria-hidden": true }), onSave: onSave, onCancel: custom?.isNew ? custom.onCancel : undefined, onDelete: custom && !custom.isNew ? custom.onDelete : undefined, children: [!custom && (_jsxs(Button, { type: "button", size: "sm", variant: "outline", onClick: () => set({ hidden: !spec.hidden }), children: [spec.hidden ? _jsx(Eye, { "aria-hidden": true }) : _jsx(EyeOff, { "aria-hidden": true }), spec.hidden ? t("button.unhide") : t("button.hide")] })), defaults && (_jsxs(Button, { type: "button", size: "sm", variant: "outline", disabled: atDefaults, onClick: () => onChange({ ...defaults, enabled: spec.enabled, hidden: false }), children: [_jsx(RotateCcw, { "aria-hidden": true }), t("button.reset")] })), !custom?.isNew && (_jsx("span", { className: "flex-1 text-right text-cms-muted-foreground text-xs", children: feature.updatedAt
                            ? t("meta.edited", {
                                time: new Date(feature.updatedAt).toLocaleString(site.ADMIN_LOCALE, { timeZone: site.CMS_TIME_ZONE }),
                            })
                            : t("meta.default") }))] }), _jsxs("section", { className: "flex flex-col gap-2 rounded-md border bg-cms-muted/30 p-3 text-xs", "aria-label": t("test.title"), children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("span", { className: "font-medium", children: t("test.title") }), _jsxs(Button, { type: "button", size: "xs", variant: "outline", className: "ml-auto", disabled: testDisabled, onClick: () => void runTest(), children: [_jsx(Sparkles, { "aria-hidden": true }), testRunning ? t("test.running") : t("test.run")] })] }), spec.askInstruction && (_jsx(Textarea, { "aria-label": t("test.request"), placeholder: t("test.request"), rows: 2, value: sample.request, onChange: (event) => setSample({ ...sample, request: event.target.value }), onKeyDown: (event) => {
                            // Enter inserts a newline; Cmd/Ctrl+Enter runs.
                            if (event.key === "Enter" && (event.metaKey || event.ctrlKey) && !isComposingKey(event)) {
                                event.preventDefault();
                                void runTest();
                            }
                        }, className: "min-h-14 resize-y bg-cms-background text-xs md:text-xs" })), _jsx(SampleInputs, { fields: sampleInputs, values: sample.values, defaults: sampleStart, onChange: (name, value) => setSample({ ...sample, values: { ...sample.values, [name]: value } }) }), test?.status === "error" && _jsx(FieldError, { children: test.message }), test?.status === "done" &&
                        (test.result.kind === "candidates" ? (test.result.items.length === 0 ? (_jsx("p", { className: "text-cms-muted-foreground", children: t("test.noResults") })) : (_jsx("ul", { className: "flex flex-wrap gap-1", children: test.result.items.map((item) => (_jsxs("li", { className: SLOT_CHIP, children: [_jsx("span", { className: "truncate", children: item.label }), item.detail && _jsx("span", { className: "shrink-0 text-cms-muted-foreground", children: item.detail })] }, item.value))) }))) : (_jsx("p", { className: "whitespace-pre-wrap rounded border bg-cms-background p-2", children: test.result.text })))] })] }));
}
