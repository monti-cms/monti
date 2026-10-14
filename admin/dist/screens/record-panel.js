"use client";
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useSite, useTranslator, } from "@monti-cms/core/client";
import { emptyStoredDocument } from "@monti-cms/core/document";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { CmsApiError, errorText } from "../api/client.js";
import { createEntry, entriesKeys, getEntry, updateEntry } from "../api/entries.js";
import { cmsIssueMessage } from "../api/error-message.js";
import { useCmsMutation } from "../api/use-cms-mutation.js";
import { commonMessages } from "../lib/common.messages.js";
import { cn } from "../lib/utils/cn.js";
import { StatusIndicator } from "../ui/status-indicator.js";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs.js";
import { EMPTY_FORM, formFromEntry, formTitle, metadataFromForm, recordTranslationKey, titlePatch, } from "./entries/entry-form.js";
import { RecordLocaleFields, SchemaFields } from "./entries/schema-fields.js";
import { EntryFormProvider } from "./entries/use-field.js";
import { screensMessages } from "./messages.js";
import { useConfirm } from "./shared/confirm-dialog.js";
import { EditorFooter } from "./shared/editor-footer.js";
import { SidePanelHeader } from "./shared/side-panel.js";
import { useDraftEditor } from "./shared/use-draft-editor.js";
/** Whether that locale tab has any per-locale value (`localized: true` text field). The default locale is the field's own value. */
function hasLocaleValues(site, collection, form, locale) {
    return site.recordLocalizedFields(collection).some((field) => {
        const value = locale === site.DEFAULT_LOCALE ? form[field] : form[recordTranslationKey(field, locale)];
        return typeof value === "string" && value.trim() !== "";
    });
}
/**
 * Taxonomy (category, tag, series) edit panel. Opens beside the list. "Save" validates and then applies straight to the public values, and
 * there is no autosave. The panel stays open after saving (for a new item, it switches to open the item the parent created).
 * Closing with unsaved changes asks whether to discard. Each locale tab above shows whether a translation exists, and on other locale tabs only that locale's name and description are edited.
 * A series' post list and slug are the same in all locales, so they are edited on the default locale tab. Unpublished posts can be included too.
 */
export function RecordPanel({ target, onClose, onSaved, onDirtyChange, initial, className, }) {
    const site = useSite();
    const t = useTranslator(screensMessages);
    const tc = useTranslator(commonMessages);
    const initialRef = useRef(initial);
    const [loaded, setLoaded] = useState(null);
    const [locale, setLocale] = useState(site.DEFAULT_LOCALE);
    const [error, setError] = useState(null);
    const { confirmDiscard, dialog } = useConfirm();
    const { collection, id } = target;
    // A new item starts from the blank form (plus the initial values); an existing one from the entry the server returned.
    const empty = useMemo(() => (id ? EMPTY_FORM : { ...EMPTY_FORM, ...initialRef.current }), [id]);
    const savedForm = useMemo(() => (id && loaded ? formFromEntry(site, loaded) : null), [id, loaded, site]);
    const saveMutation = useCmsMutation({
        fn: ({ slug, metadata }, { site }) => id && loaded
            ? updateEntry(site, id, {
                expectedVersion: loaded.version,
                slug: slug || null,
                metadata,
            }, tc("saveFailed"))
            : createEntry(site, { collection, slug: slug || null, metadata, doc: emptyStoredDocument() }, tc("saveFailed")),
        failure: tc("saveFailed"),
        inline: true,
        onSuccess: ({ entry: saved }) => {
            // The panel stays open. Switch to the received item so the next save is based on the new revision.
            if (id)
                setLoaded(saved);
            onSaved(saved);
        },
        onError: (err) => setError(err instanceof CmsApiError && err.issues.length > 0
            ? err.issues.map((issue) => cmsIssueMessage(site, issue)).join("\n")
            : errorText(site, err, tc("saveFailed"))),
    });
    const { draft: form, update, replace, dirty, isNew, } = useDraftEditor({ saved: savedForm, empty, onDirtyChange, saving: saveMutation.isPending });
    const isSaving = saveMutation.isPending;
    const label = site.COLLECTION_DEFINITIONS[collection].label;
    const heading = id ? t("record.edit", { label }) : t("list.add", { label });
    const title = formTitle(site, collection, form);
    /** Hint for the value that will be generated when the slug is empty. If the slug field has no `from`, uses the field's hint text as is. */
    const slugFrom = site.slugFieldOf(collection)?.from;
    const slugHint = slugFrom
        ? t("record.slugHint", { name: site.schemaOf(collection).fields[slugFrom]?.label ?? slugFrom })
        : undefined;
    // The panel keeps the user's edits, so a reload of the entry (after a save, say) must not replace the form: it is filled once per entry.
    const appliedRef = useRef(null);
    // biome-ignore lint/correctness/useExhaustiveDependencies: reset only when another entry is opened
    useEffect(() => {
        appliedRef.current = null;
        setLoaded(null);
        replace(id ? EMPTY_FORM : { ...EMPTY_FORM, ...initialRef.current });
        setLocale(site.DEFAULT_LOCALE);
        setError(null);
    }, [id]);
    const entryQuery = useQuery({
        queryKey: entriesKeys.detail(id ?? ""),
        queryFn: ({ signal }) => getEntry(site, id, signal),
        enabled: Boolean(id),
        gcTime: 0,
        retry: false,
    });
    useEffect(() => {
        const entry = entryQuery.data;
        if (!id || !entry || appliedRef.current === id)
            return;
        appliedRef.current = id;
        setLoaded(entry);
    }, [id, entryQuery.data]);
    const loadError = entryQuery.error ? errorText(site, entryQuery.error, t("record.loadFailed", { label })) : null;
    const setForm = (patch) => update((current) => ({ ...current, ...patch }));
    const close = async () => {
        if (await confirmDiscard(dirty))
            onClose();
    };
    const save = () => {
        if (!title.trim())
            return;
        const built = metadataFromForm(site, { ...form, ...titlePatch(site, collection, title.trim()) }, collection, loaded?.working.metadata ?? {});
        if ("error" in built) {
            setError(built.error);
            return;
        }
        setError(null);
        saveMutation.mutate({
            slug: form.slug.trim() || (id && loaded ? site.slugFromValues(collection, form) : ""),
            metadata: built.metadata,
        });
    };
    return (_jsxs("aside", { "aria-label": heading, className: cn("flex h-full flex-col border-l bg-cms-background text-sm", className), children: [_jsx(SidePanelHeader, { title: heading, onClose: () => void close() }), _jsxs("form", { className: "flex min-h-0 flex-1 flex-col", onSubmit: (event) => {
                    event.preventDefault();
                    save();
                }, children: [_jsx(EntryFormProvider, { value: { collection, form, setForm, disabled: isSaving, entryId: id ?? undefined }, children: _jsxs(Tabs, { value: locale, onValueChange: (value) => setLocale(value), className: "min-h-0 flex-1 gap-0 overflow-hidden", children: [site.ADMIN_TRANSLATIONS && (_jsx(TabsList, { variant: "line", className: "h-10 w-full shrink-0 justify-start gap-4 border-b px-4", children: site.LOCALES.map((option) => {
                                        const filled = hasLocaleValues(site, collection, form, option);
                                        const name = site.localeLabel(option);
                                        return (_jsxs(TabsTrigger, { value: option, "aria-label": option === site.DEFAULT_LOCALE
                                                ? name
                                                : t(filled ? "record.translationOn" : "record.translationOff", { name }), className: "flex-none gap-1.5 px-0 text-xs", children: [name, option !== site.DEFAULT_LOCALE && (_jsx(StatusIndicator, { size: "xs", tone: filled ? "success" : "neutral", shape: filled ? "dot" : "ring" }))] }, option));
                                    }) })), _jsxs("div", { className: "min-h-0 flex-1 overflow-y-auto px-4 py-4", children: [_jsxs(TabsContent, { value: site.DEFAULT_LOCALE, className: "space-y-4", children: [_jsx(SchemaFields, { slugPlaceholder: site.slugFromValues(collection, form) || slugHint }), id && _jsx("p", { className: "text-cms-muted-foreground text-xs", children: t("record.slugChange") })] }), (site.ADMIN_TRANSLATIONS ? site.PREFIXED_LOCALES : []).map((option) => (_jsxs(TabsContent, { value: option, className: "space-y-4", children: [_jsx("p", { className: "text-cms-muted-foreground text-xs leading-relaxed", children: t("record.localeEmpty", { name: site.localeLabel(option) }) }), _jsx(RecordLocaleFields, { collection: collection, locale: option })] }, option)))] })] }) }), _jsx(EditorFooter, { className: "shrink-0 border-t px-4 py-3", 
                        // A new item can be saved as it is (a name may come prefilled); an existing one only once it was changed.
                        dirty: dirty || isNew, saving: isSaving, canSave: Boolean(title.trim()) && !(id && !loaded), error: error ?? loadError, align: "end", onCancel: () => void close() })] }), dialog] }));
}
