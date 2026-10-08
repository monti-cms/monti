"use client";
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { cmsApiUrl, useSite, useTranslator, } from "@monti-cms/core/client";
import { emptyStoredDocument } from "@monti-cms/core/document";
import { useEffect, useRef, useState } from "react";
import { cn } from "../lib/utils/cn.js";
import { Button } from "../ui/button.js";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs.js";
import { CmsApiError, cmsFetch, errorText } from "./admin-api.js";
import { cmsIssueMessage } from "./api-error-message.js";
import { EMPTY_FORM, formFromEntry, formTitle, metadataFromForm, recordTranslationKey, titlePatch, } from "./entries/entry-form.js";
import { RecordLocaleFields, SchemaFields } from "./entries/schema-fields.js";
import { EntryFormProvider } from "./entries/use-field.js";
import { screensMessages } from "./messages.js";
import { useConfirm } from "./shared/confirm-dialog.js";
import { SidePanelHeader } from "./shared/side-panel.js";
/** Whether that locale tab has any per-locale value (`localized: true` text field). The default locale is the field's own value. */
function hasLocaleValues(site, collection, form, locale) {
    return site.recordLocalizedFields(collection).some((field) => {
        const value = locale === site.DEFAULT_LOCALE ? form[field] : form[recordTranslationKey(field, locale)];
        return typeof value === "string" && value.trim() !== "";
    });
}
/**
 * Taxonomy (category, tag, series) edit panel. Opens beside the list. `저장` validates and then applies straight to the public values, and
 * there is no autosave. The panel stays open after saving (for a new item, it switches to open the item the parent created).
 * Closing with unsaved changes asks whether to discard. Each locale tab above shows whether a translation exists, and on other locale tabs only that locale's name and description are edited.
 * A series' post list and slug are the same in all locales, so they are edited on the default locale tab. Unpublished posts can be included too.
 */
export function RecordPanel({ target, onClose, onSaved, onDirtyChange, initial, className, }) {
    const site = useSite();
    const t = useTranslator(screensMessages);
    const initialRef = useRef(initial);
    const [loaded, setLoaded] = useState(null);
    const [form, setFormState] = useState(EMPTY_FORM);
    const [locale, setLocale] = useState(site.DEFAULT_LOCALE);
    const [error, setError] = useState(null);
    const [isSaving, setIsSaving] = useState(false);
    const [isDirty, setIsDirty] = useState(false);
    const { confirmDiscard, dialog } = useConfirm();
    const { collection, id } = target;
    const label = site.COLLECTION_DEFINITIONS[collection].label;
    const heading = id ? t("record.edit", { label }) : t("list.add", { label });
    const title = formTitle(site, collection, form);
    /** Hint for the value that will be generated when the slug is empty. If the slug field has no `from`, uses the field's hint text as is. */
    const slugFrom = site.slugFieldOf(collection)?.from;
    const slugHint = slugFrom
        ? t("record.slugHint", { name: site.schemaOf(collection).fields[slugFrom]?.label ?? slugFrom })
        : undefined;
    useEffect(() => {
        setLoaded(null);
        setFormState(id ? EMPTY_FORM : { ...EMPTY_FORM, ...initialRef.current });
        setLocale(site.DEFAULT_LOCALE);
        setError(null);
        setIsDirty(false);
        if (!id)
            return;
        let cancelled = false;
        cmsFetch(site, cmsApiUrl(`/v1/entries/${id}`))
            .then((entry) => {
            if (cancelled)
                return;
            setLoaded(entry);
            setFormState(formFromEntry(site, entry));
        })
            .catch((err) => {
            if (!cancelled)
                setError(errorText(site, err, t("record.loadFailed", { label })));
        });
        return () => {
            cancelled = true;
        };
    }, [id, label, site, t]);
    useEffect(() => onDirtyChange?.(isDirty), [isDirty, onDirtyChange]);
    const setForm = (patch) => {
        setFormState((current) => ({ ...current, ...patch }));
        setIsDirty(true);
    };
    const close = async () => {
        if (await confirmDiscard(isDirty))
            onClose();
    };
    const save = async () => {
        if (!title.trim())
            return;
        const built = metadataFromForm(site, { ...form, ...titlePatch(site, collection, title.trim()) }, collection, loaded?.working.metadata ?? {});
        if ("error" in built) {
            setError(built.error);
            return;
        }
        setIsSaving(true);
        setError(null);
        try {
            const { entry: saved } = id && loaded
                ? await cmsFetch(site, cmsApiUrl(`/v1/entries/${id}`), {
                    method: "PATCH",
                    json: {
                        expectedVersion: loaded.version,
                        slug: form.slug.trim() || site.slugFromValues(collection, form) || null,
                        metadata: built.metadata,
                    },
                    fallback: t("record.saveFailed"),
                })
                : await cmsFetch(site, cmsApiUrl("/v1/entries"), {
                    method: "POST",
                    json: {
                        collection,
                        slug: form.slug.trim() || null,
                        metadata: built.metadata,
                        doc: emptyStoredDocument(),
                    },
                    fallback: t("record.saveFailed"),
                });
            // The panel stays open. Switch to the received item so the next save is based on the new revision.
            if (id)
                setLoaded(saved);
            setIsDirty(false);
            onSaved(saved);
        }
        catch (err) {
            setError(err instanceof CmsApiError && err.issues.length > 0
                ? err.issues.map((issue) => cmsIssueMessage(site, issue)).join("\n")
                : errorText(site, err, t("record.saveFailed")));
        }
        finally {
            setIsSaving(false);
        }
    };
    return (_jsxs("aside", { "aria-label": heading, className: cn("flex h-full flex-col border-l bg-cms-background text-sm", className), children: [_jsx(SidePanelHeader, { title: heading, onClose: () => void close() }), _jsxs("form", { className: "flex min-h-0 flex-1 flex-col", onSubmit: (event) => {
                    event.preventDefault();
                    void save();
                }, children: [_jsx(EntryFormProvider, { value: { collection, form, setForm, disabled: isSaving, entryId: id ?? undefined }, children: _jsxs(Tabs, { value: locale, onValueChange: (value) => setLocale(value), className: "min-h-0 flex-1 gap-0 overflow-hidden", children: [site.ADMIN_TRANSLATIONS && (_jsx(TabsList, { variant: "line", className: "h-10 w-full shrink-0 justify-start gap-4 border-b px-4", children: site.LOCALES.map((option) => {
                                        const filled = hasLocaleValues(site, collection, form, option);
                                        const name = site.localeLabel(option);
                                        return (_jsxs(TabsTrigger, { value: option, "aria-label": option === site.DEFAULT_LOCALE
                                                ? name
                                                : t(filled ? "record.translationOn" : "record.translationOff", { name }), className: "flex-none gap-1.5 px-0 text-xs", children: [name, option !== site.DEFAULT_LOCALE && (_jsx("span", { "aria-hidden": true, className: cn("size-1.5 rounded-full", filled ? "bg-emerald-500" : "border border-cms-muted-foreground/50") }))] }, option));
                                    }) })), _jsxs("div", { className: "min-h-0 flex-1 overflow-y-auto px-4 py-4", children: [_jsxs(TabsContent, { value: site.DEFAULT_LOCALE, className: "space-y-4", children: [_jsx(SchemaFields, { slugPlaceholder: site.slugFromValues(collection, form) || slugHint }), id && _jsx("p", { className: "text-cms-muted-foreground text-xs", children: t("record.slugChange") })] }), (site.ADMIN_TRANSLATIONS ? site.PREFIXED_LOCALES : []).map((option) => (_jsxs(TabsContent, { value: option, className: "space-y-4", children: [_jsx("p", { className: "text-cms-muted-foreground text-xs leading-relaxed", children: t("record.localeEmpty", { name: site.localeLabel(option) }) }), _jsx(RecordLocaleFields, { collection: collection, locale: option })] }, option)))] })] }) }), _jsxs("div", { className: "shrink-0 space-y-2 border-t px-4 py-3", children: [error && (_jsx("p", { role: "alert", className: "whitespace-pre-wrap text-cms-destructive text-xs", children: error })), _jsxs("div", { className: "flex justify-end gap-2", children: [_jsx(Button, { type: "button", variant: "outline", size: "sm", onClick: () => void close(), children: t("common.cancel") }), _jsx(Button, { type: "submit", size: "sm", disabled: !title.trim() || isSaving || Boolean(id && !loaded), children: isSaving ? t("common.saving") : t("common.save") })] })] })] }), dialog] }));
}
