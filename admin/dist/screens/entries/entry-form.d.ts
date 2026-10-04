import { type TranslationState } from "@monti-cms/core/client";
/** The value of one form input. Text, single relation, select and date are strings (a single relation is `null` when empty); multi relations are arrays. */
export type FormValue = string | string[] | null;
/**
 * Draft values the edit screen handles. Fields other than title, slug and body come from the collection definition and
 * are stored flat, keyed by field name. Date fields hold the `datetime-local` input value (in the configured time zone).
 */
export type EntryForm = {
    title: string;
    slug: string;
    mdx: string;
} & {
    [field: string]: FormValue;
};
/** Partial form change. Only the given keys are changed. */
export type EntryFormPatch = {
    readonly [field: string]: FormValue;
};
export declare const EMPTY_FORM: EntryForm;
/**
 * Title of a duplicate (by library convention the title field is named `title`). Appends a "copy" suffix to the source title and trims the source part
 * if it would exceed the title field's `max`.
 */
export declare function copyTitle(collection: string, title: string | null | undefined): string;
/** Content in the same translation group. */
export interface TranslationMember {
    id: string;
    locale: string;
    status: EntryData["status"];
    isSource: boolean;
    title: string | null;
    workingSlug: string | null;
}
export interface EntryData {
    id: string;
    collection: string;
    /** Content language and translation group ID. For the original, the group ID is its own ID. */
    locale?: string;
    translationGroupId?: string;
    translations?: TranslationMember[];
    /** For a translation, the latest draft metadata of the original. Shown read-only as the shared values. */
    source?: {
        id: string;
        locale: string;
        status: EntryData["status"];
        workingSlug: string | null;
        metadata: Record<string, unknown>;
        /** Latest draft body of the original (translation screen). */
        mdx?: string;
    };
    status: "draft" | "published" | "archived" | "trashed";
    version: number;
    folderId: string | null;
    publishedAt?: string;
    workingSlug: string | null;
    publishedSlug: string | null;
    working: {
        metadata: Record<string, unknown>;
        mdx: string;
        translation?: TranslationState | null;
    };
    published?: {
        metadata: Record<string, unknown>;
        mdx: string;
    };
}
/** Reads a form value as a string. Empty string if missing or an array. */
export declare const formText: (form: EntryForm, name: string) => string;
/** Reads a form value as a string array. */
export declare const formList: (form: EntryForm, name: string) => string[];
/** Whether this is a translation. A translation handles only per-language values as the form. */
export declare const isTranslationEntry: (entry: Pick<EntryData, "id" | "translationGroupId"> | null | undefined) => boolean;
/** The original shown on the translation screen. Only present for a translation that received the original body. */
export interface TranslationSource {
    mdx: string;
    locale: string;
    title: string;
}
/** For a translation, the original's body, language and title. Used by the source pane, the title hint and AI translation. */
export declare function translationSourceOf(entry: EntryData | null): TranslationSource | null;
/** Form key holding the translation state. Starts with `$` so it never collides with a stored field name. The value is a JSON string. */
export declare const TRANSLATION_FORM_KEY = "$translation";
/** JSON string of the translation state. Fixes the key order so the fingerprint matches values from the server (JSONB reorders keys). */
export declare const stringifyTranslation: (state: TranslationState) => string;
/** Form value -> translation state. If missing or malformed, nothing is treated as confirmed (empty `baseSource`). */
export declare const translationStateFromForm: (value: FormValue | undefined) => TranslationState;
/** Form value -> `translation` of the save request. Not sent if it is not a translation (no key). */
export declare const translationPayload: (form: EntryForm) => TranslationState | undefined;
export declare function formFromEntry(entry: EntryData): EntryForm;
/** Form key for per-language values of a record collection. E.g. `title@en`. */
export declare const recordTranslationKey: (field: string, locale: string) => string;
/** Converts original metadata to form values. Used when the translation's properties panel shows shared values read-only. */
export declare function formFromSourceMetadata(collection: string, metadata: Record<string, unknown>): EntryForm;
/** Fingerprint for comparing form values. Compares the recovery copy with the server-saved one. */
export declare const formFingerprint: (form: EntryForm) => string;
/**
 * Form -> stored metadata. Rules come from the collection definition.
 *
 * - Required text (title) is stored as typed. For optional text and relations, an empty value removes the key so the public page falls back to the default.
 * - Optional fields are not newly written when they hold the default. Already stored values are updated as is.
 * - Values attached to a conditional field are kept only when the condition holds.
 * - Fields that render no input (`hidden`) do not touch the stored value. Keys not in the definition are not added.
 */
export declare function metadataFromForm(form: EntryForm, collection: string, base?: Record<string, unknown>, options?: {
    translation?: boolean;
}): {
    metadata: Record<string, unknown>;
} | {
    error: string;
};
