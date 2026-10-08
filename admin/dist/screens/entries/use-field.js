"use client";
import { jsx as _jsx } from "react/jsx-runtime";
import { useSite } from "@monti-cms/core/client";
import { createContext, useCallback, useContext, useLayoutEffect, useMemo, useState } from "react";
import { assignStateSilently, createStateStore, notifyStateStore, useStoreSelector, } from "../../hooks/store.js";
import { cmsIssueMessage } from "../api-error-message.js";
import { formTitle } from "./entry-form.js";
const EntryFormContext = createContext(null);
const NO_ISSUES = [];
/** Keeps the previous array when the new one holds the same issues, so a caller that builds `[]` on every render does not wake every field. */
function stableIssues(previous, next) {
    return previous.length === next.length && previous.every((issue, index) => issue === next[index]) ? previous : next;
}
/**
 * Shares one entry's form state with the fields below it. This is the lower layer: it needs no entry editor, so a panel that keeps its own
 * form state (a record panel) uses it as well. `useField` reads from it.
 *
 * The values are kept in a store: a field re-renders when its own value, error or read-only state changes, not when the form as a whole does.
 * Children that the parent keeps the same element for are therefore not re-rendered while another field is typed in.
 *
 * @experimental
 */
export function EntryFormProvider({ value, children }) {
    const [holder] = useState(() => {
        const setFormRef = { current: value.setForm };
        const store = createStateStore({
            collection: value.collection,
            form: value.form,
            // Stable for the life of the provider, so a field's `setValue` keeps its identity.
            setForm: (patch) => setFormRef.current(patch),
            issues: value.issues ?? NO_ISSUES,
            disabled: Boolean(value.disabled),
            entryId: value.entryId,
            locale: value.locale,
            entry: value.entry ?? null,
            locked: value.locked,
        });
        return { store, setFormRef, version: 0, notified: 0 };
    });
    const { store } = holder;
    const state = store.getState();
    const changed = assignStateSilently(store, {
        collection: value.collection,
        form: value.form,
        setForm: state.setForm,
        issues: stableIssues(state.issues, value.issues ?? NO_ISSUES),
        disabled: Boolean(value.disabled),
        entryId: value.entryId,
        locale: value.locale,
        entry: value.entry ?? null,
        locked: value.locked,
    });
    if (changed)
        holder.version += 1;
    useLayoutEffect(() => {
        holder.setFormRef.current = value.setForm;
        if (holder.notified === holder.version)
            return;
        holder.notified = holder.version;
        notifyStateStore(store);
    });
    return _jsx(EntryFormContext.Provider, { value: store, children: children });
}
/** The store of the nearest {@link EntryFormProvider}. Internal: the default field UI uses it for what `useField` does not cover. */
export function useEntryFormStore() {
    const store = useContext(EntryFormContext);
    if (!store)
        throw new Error("useField needs an EntryFormProvider above it.");
    return store;
}
/** Subscribes to one slice of the form state. The selector must return a stable value. */
export function useEntryFormSelector(selector) {
    return useStoreSelector(useEntryFormStore(), selector);
}
const fieldId = (name) => `cms-${name}`;
/** The definition of a field by name (nested fields of a conditional field included) and whether a translation shares it. */
function resolveField(site, collection, name) {
    const fields = site.schemaOf(collection).fields;
    const own = fields[name];
    if (own?.kind === "slug")
        return { definition: own, lockable: false };
    const stored = site.storedField(collection, name);
    if (!stored)
        return { definition: undefined, lockable: false };
    // A field that depends on a conditional field follows that field's `localized`.
    const owner = stored.when ? fields[stored.when.field] : own;
    return { definition: stored.field, lockable: !owner?.localized };
}
/**
 * The value, change, error, read-only state, ids and slot request of one form field, for a field UI of your own. The component re-renders only
 * when this field changes.
 *
 * Must be used below an `EntryFormProvider` (the entry editor and the record panel provide one). The label row, the layout and the slot button
 * are yours to draw: pass `slotRequest` to `useSlotActions` for the actions attached to the field.
 *
 * @experimental
 */
export function useField(name) {
    const site = useSite();
    const store = useEntryFormStore();
    const collection = useStoreSelector(store, (state) => state.collection);
    const { definition, lockable } = useMemo(() => resolveField(site, collection, name), [site, collection, name]);
    const locked = useStoreSelector(store, (state) => lockable && Boolean(state.locked));
    const lockedNote = useStoreSelector(store, (state) => (lockable ? state.locked?.note : undefined));
    const disabled = useStoreSelector(store, (state) => state.disabled);
    const stored = useStoreSelector(store, (state) => (lockable && state.locked ? state.locked.values : state.form)[name]);
    const issues = useStoreSelector(store, (state) => state.issues);
    const entryId = useStoreSelector(store, (state) => state.entryId);
    const locale = useStoreSelector(store, (state) => state.locale);
    const readOnly = disabled || locked;
    const value = (stored ?? null);
    const setValue = useCallback((next) => {
        if (readOnly)
            return;
        store.getState().setForm({ [name]: next });
    }, [store, name, readOnly]);
    const errors = useMemo(() => locked
        ? []
        : issues
            .filter((issue) => issue.path === name)
            .map((issue) => ({ code: issue.code, message: cmsIssueMessage(site, issue), issue })), [issues, name, locked, site]);
    const slotRequest = useMemo(() => {
        if (locked)
            return null;
        return {
            slot: "field",
            target: name,
            collection,
            scope: entryId ?? "new",
            disabled,
            getContext: () => {
                const { form } = store.getState();
                const current = form[name];
                return {
                    collection,
                    locale,
                    entryId,
                    title: formTitle(site, collection, form),
                    summary: summaryOf(site, collection, form),
                    body: form.doc,
                    current: Array.isArray(current) ? current : typeof current === "string" ? current : undefined,
                };
            },
            apply: (next, mode) => {
                const { form, setForm } = store.getState();
                if (mode === "append") {
                    const current = form[name];
                    const list = Array.isArray(current) ? current : [];
                    if (!list.includes(next))
                        setForm({ [name]: [...list, next] });
                }
                else
                    setForm({ [name]: next });
            },
        };
    }, [store, locked, name, collection, entryId, locale, disabled, site]);
    const error = errors[0] ?? null;
    const ids = useMemo(() => ({ input: fieldId(name), error: `${fieldId(name)}-error` }), [name]);
    const inputProps = useMemo(() => ({
        id: ids.input,
        ...(error ? { "aria-invalid": true, "aria-describedby": ids.error } : {}),
        ...(readOnly ? { disabled: true } : {}),
    }), [ids, error, readOnly]);
    return useMemo(() => ({
        name,
        definition,
        label: definition?.label ?? name,
        description: definition?.description,
        required: Boolean(definition && "required" in definition && definition.required) && !locked,
        hidden: Boolean(definition && "hidden" in definition && definition.hidden),
        value,
        setValue,
        readOnly,
        readOnlyReason: locked ? "locked" : disabled ? "disabled" : null,
        lockedNote,
        error,
        errors,
        invalid: error !== null,
        ids,
        inputProps,
        slotRequest,
    }), [
        name,
        definition,
        value,
        setValue,
        readOnly,
        locked,
        disabled,
        lockedNote,
        error,
        errors,
        ids,
        inputProps,
        slotRequest,
    ]);
}
function summaryOf(site, collection, form) {
    return site.roleValue(collection, "summary", form) || undefined;
}
