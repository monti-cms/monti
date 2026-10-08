import { parseTranslationState, RECORD_TRANSLATIONS_KEY, } from "@monti-cms/core/client";
import { emptyStoredDocument, STORED_DOCUMENT_VERSION } from "@monti-cms/core/document";
import { documentKey } from "../../editor/document-key.js";
import { entriesMessages } from "./messages.js";
export const EMPTY_FORM = { slug: "", doc: emptyStoredDocument() };
/** The form of a new entry of that collection: the title (under the name of its title field, '') and the address are empty. */
export const emptyFormOf = (site, collection) => ({
    ...EMPTY_FORM,
    [titleKeyOf(site, collection)]: "",
});
/** The form key (and metadata key) of the title of a collection: the name of its title field. */
export const titleKeyOf = (site, collection) => site.titleField(collection).name;
/** The title in a form of that collection. */
export const formTitle = (site, collection, form) => formText(form, titleKeyOf(site, collection));
/** A form patch that sets the title of that collection. */
export const titlePatch = (site, collection, title) => ({
    [titleKeyOf(site, collection)]: title,
});
/**
 * Title of a duplicate. Appends a "copy" suffix to the source title and trims the source part
 * if it would exceed the title field's `max`.
 */
export function copyTitle(site, collection, title) {
    const t = site.createTranslator(entriesMessages);
    // The suffix added to a duplicate's title and the name for an untitled source are screen text, so the admin screen decides them, not the repository.
    const copySuffix = t("copy.suffix");
    const base = title?.trim() ? title : t("untitled");
    const field = site.isCollection(collection) ? site.titleField(collection).field : undefined;
    const max = field?.kind === "text" ? field.max : undefined;
    const room = max === undefined ? Number.POSITIVE_INFINITY : max - Array.from(copySuffix).length;
    const chars = Array.from(base);
    if (room <= 0)
        return chars.slice(0, max).join("");
    return `${chars.length > room ? chars.slice(0, room).join("") : base}${copySuffix}`;
}
const text = (value) => (typeof value === "string" ? value : "");
/** Reads a form value as a string. Empty string if missing or an array. */
export const formText = (form, name) => text(form[name]);
/** Reads a form value as a string array. */
export const formList = (form, name) => {
    const value = form[name];
    return Array.isArray(value) ? value : [];
};
/** Whether this is a translation. A translation handles only per-language values as the form. */
export const isTranslationEntry = (entry) => Boolean(entry?.translationGroupId && entry.translationGroupId !== entry.id);
/** For a translation, the original's body, language and title. Used by the source pane, the title hint and AI translation. */
export function translationSourceOf(site, entry) {
    if (!entry || !isTranslationEntry(entry) || !entry.source?.doc)
        return null;
    return {
        doc: entry.source.doc,
        locale: entry.source.locale,
        title: site.titleOfValues(entry.collection, entry.source.metadata) ?? "",
    };
}
/** Stored fields the form handles. For a translation, only fields that are `localized` in the definition (shared values belong to the original). */
const fieldsOf = (site, collection, translation = false) => {
    if (!site.isCollection(collection))
        return [];
    const fields = site.storedFields(collection);
    if (!translation)
        return fields;
    const { own, inherit } = site.localizedFieldNames(collection);
    return fields.filter(({ name }) => own.includes(name) || inherit.includes(name));
};
/** Form key holding the translation state. Starts with `$` so it never collides with a stored field name. The value is a JSON string. */
export const TRANSLATION_FORM_KEY = "$translation";
/**
 * JSON string of the translation state. Fixes the key order (also inside the document) so the fingerprint matches values from the server
 * (JSONB reorders keys). A document that is not a valid stored document is left out.
 */
export const stringifyTranslation = (state) => JSON.stringify(parseTranslationState(state) ?? UNCONFIRMED_TRANSLATION);
/** The state of a translation that has confirmed nothing: an empty source. */
const UNCONFIRMED_TRANSLATION = {
    version: 4,
    baseDoc: { type: "doc", version: STORED_DOCUMENT_VERSION, content: [] },
};
/** Form value -> translation state. If missing or malformed, nothing is treated as confirmed (an empty source document). */
export const translationStateFromForm = (value) => {
    if (typeof value === "string") {
        try {
            const parsed = parseTranslationState(JSON.parse(value));
            if (parsed)
                return parsed;
        }
        catch {
            // A corrupted value is treated as unconfirmed.
        }
    }
    return UNCONFIRMED_TRANSLATION;
};
/** Form value -> `translation` of the save request. Not sent if it is not a translation (no key). */
export const translationPayload = (form) => {
    const value = form[TRANSLATION_FORM_KEY];
    if (typeof value !== "string")
        return undefined;
    return translationStateFromForm(value);
};
/** Stored value -> input value. */
function toFormValue({ field }, value) {
    switch (field.kind) {
        case "text":
        case "media":
            return text(value);
        case "relation":
            if (field.many)
                return Array.isArray(value) ? value.filter((id) => typeof id === "string") : [];
            return text(value) || null;
        case "select":
            // A value that is no longer an option is shown as it is stored: the input marks it, and saving keeps it.
            return typeof value === "string" && value !== "" ? value : field.defaultValue;
    }
}
export function formFromEntry(site, entry) {
    const metadata = entry.working.metadata ?? {};
    const form = { slug: entry.workingSlug ?? "", doc: entry.working.doc };
    for (const stored of fieldsOf(site, entry.collection, isTranslationEntry(entry))) {
        if (stored.field.hidden)
            continue;
        form[stored.name] = toFormValue(stored, metadata[stored.name]);
    }
    Object.assign(form, recordTranslationsToForm(site, entry.collection, metadata));
    // A translation also handles translation state as the form, so autosave, recovery and conflict comparison see it along with the body.
    if (isTranslationEntry(entry)) {
        // If it is not a valid state, use an empty source so "source changed" is shown. A state of an older version is read as version 4.
        form[TRANSLATION_FORM_KEY] = stringifyTranslation(parseTranslationState(entry.working.translation) ?? UNCONFIRMED_TRANSLATION);
    }
    return form;
}
/** Form key for per-language values of a record collection. E.g. `title@en`. */
export const recordTranslationKey = (field, locale) => `${field}@${locale}`;
function recordTranslationsToForm(site, collection, metadata) {
    if (!site.isCollection(collection))
        return {};
    const translations = (metadata[RECORD_TRANSLATIONS_KEY] ?? {});
    const values = {};
    for (const field of site.recordLocalizedFields(collection)) {
        for (const locale of site.PREFIXED_LOCALES)
            values[recordTranslationKey(field, locale)] = text(translations[locale]?.[field]);
    }
    return values;
}
/** Converts original metadata to form values. Used when the translation's properties panel shows shared values read-only. */
export function formFromSourceMetadata(site, collection, metadata) {
    const form = { slug: "", doc: emptyStoredDocument() };
    for (const stored of fieldsOf(site, collection)) {
        if (stored.field.hidden)
            continue;
        form[stored.name] = toFormValue(stored, metadata[stored.name]);
    }
    return form;
}
/**
 * Fingerprint for comparing form values. Compares the recovery copy with the server-saved one. The body counts by what it says (`documentKey`): the same
 * body made by the editor, the source panel or the server is the same, whatever the block ids and the order of keys (the form's own keys are sorted too, so a
 * recovery copy that was upgraded from an older shape compares like any other).
 */
export const formFingerprint = (site, form) => JSON.stringify(Object.fromEntries(Object.keys(form)
    .sort()
    .map((key) => [key, key === "doc" ? documentKey(site, form.doc) : form[key]])));
/**
 * Form -> stored metadata. Rules come from the collection definition.
 *
 * - Required text (title) is stored as typed. For optional text and relations, an empty value removes the key so the public page falls back to the default.
 * - Optional fields are not newly written when they hold the default. Already stored values are updated as is.
 * - Values attached to a conditional field are kept only when the condition holds.
 * - Fields that render no input (`hidden`) do not touch the stored value. Keys not in the definition are not added.
 * - Values of removed fields (keys of `base` that are not in the definition) and a select value that is no longer an option stay as stored.
 */
export function metadataFromForm(site, form, collection, base = {}, options = {}) {
    const fields = fieldsOf(site, collection, options.translation);
    const metadata = {};
    // The form has no input for the value of a removed field, so it goes back as stored instead of being dropped.
    if (site.isCollection(collection)) {
        for (const key of Object.keys(base)) {
            if (site.isOrphanedMetadataKey(collection, key))
                metadata[key] = base[key];
        }
    }
    for (const { name } of fields) {
        if (Object.hasOwn(base, name))
            metadata[name] = base[name];
    }
    const values = { ...form };
    for (const { name, field, when } of fields) {
        if (field.hidden)
            continue;
        const active = !when || values[when.field] === when.value;
        const value = values[name];
        if (!active) {
            delete metadata[name];
            continue;
        }
        switch (field.kind) {
            case "text":
            case "media": {
                const raw = text(value);
                if (field.required)
                    metadata[name] = raw;
                else if (raw.trim())
                    metadata[name] = raw.trim();
                else
                    delete metadata[name];
                break;
            }
            case "relation":
                if (field.many) {
                    if (Array.isArray(value) && value.length > 0)
                        metadata[name] = value;
                    else
                        delete metadata[name];
                }
                else if (typeof value === "string" && value.trim())
                    metadata[name] = value.trim();
                else
                    delete metadata[name];
                break;
            case "select": {
                // An option the site removed stays while it is the stored value; it is never replaced by the default.
                const stored = typeof value === "string" && value !== "" && Object.hasOwn(base, name) && base[name] === value;
                const selected = typeof value === "string" && (Object.hasOwn(field.options, value) || stored) ? value : field.defaultValue;
                if (selected !== field.defaultValue || Object.hasOwn(base, name))
                    metadata[name] = selected;
                else
                    delete metadata[name];
                break;
            }
        }
    }
    // Per-language name and description of a record collection. Empty languages are not added.
    const localizedRecordFields = site.isCollection(collection)
        ? site.recordLocalizedFields(collection)
        : [];
    if (localizedRecordFields.length > 0) {
        const translations = {};
        for (const locale of site.PREFIXED_LOCALES) {
            for (const field of localizedRecordFields) {
                const value = text(values[recordTranslationKey(field, locale)]).trim();
                if (value)
                    translations[locale] = { ...translations[locale], [field]: value };
            }
        }
        if (Object.keys(translations).length > 0)
            metadata[RECORD_TRANSLATIONS_KEY] = translations;
        else
            delete metadata[RECORD_TRANSLATIONS_KEY];
    }
    return { metadata };
}
