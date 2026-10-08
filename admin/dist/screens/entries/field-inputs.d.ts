import type { BacklinkField, ValueField } from "@monti-cms/core/client";
import type { EntryForm, FormValue } from "./entry-form.js";
/** Values an input needs from outside the field. The edit screen fills them. */
export interface FieldContext {
    /** ID of the content being edited. Keeps it from picking itself as a relation target. */
    entryId?: string;
    disabled: boolean;
    /** Language of the content being edited. The AI action next to a field checks slug conflicts in this language. */
    locale?: string;
    /** Translation group ID (original ID). An inverse relation points to the original. */
    groupId?: string;
    /** Usages of this post already loaded by the properties panel. An inverse relation for the same post does not fetch again. */
    incomingReferences?: readonly IncomingReference[];
    incomingReferencesLoading?: boolean;
    refreshIncomingReferences?: () => void;
    /** The saved post (view fields read the original value and language). */
    entry?: import("./entry-form.js").EntryData | null;
}
export interface FieldInputProps {
    /** Collection of the content being edited. */
    collection: string;
    name: string;
    field: ValueField;
    id: string;
    value: FormValue;
    invalid: boolean;
    describedBy?: string;
    context: FieldContext;
    /** All values currently being entered (when other fields such as title or summary are used in hint text). Shared fields of a translation hold the original's values. */
    form: EntryForm;
    onChange: (value: FormValue) => void;
}
export declare const inputClass = "h-8 text-xs md:text-xs";
/** Row count of a multi-line text input (`rows`, 2 if absent) and the minimum height that shows that many rows (text lines + vertical padding). */
export declare function multilineProps(field: {
    readonly rows?: number;
}): {
    rows: number;
    style: {
        minHeight: string;
    };
};
/** Single relation. Typing searches the target entries on the server (best title matches first); pressing shows the first ones. */
export declare function EntryPicker({ field, id, value, invalid, describedBy, context, onChange }: FieldInputProps): import("react").JSX.Element;
/**
 * Ordered multi relation (post targets). Used by collection items.
 * Check posts in the `Add/remove posts` list above to add or remove them (added ones go to the end), and drag in the list below to reorder.
 */
export declare function OrderedEntryList({ field, id, value, context, onChange }: FieldInputProps): import("react").JSX.Element;
export type IncomingReference = {
    state: "working" | "published";
    sourceId: string;
    sourceCollection: string;
    sourceTitle: string | null;
    occurrences: readonly {
        type: string;
        path?: string;
    }[];
};
/**
 * Inverse relation input. E.g. a post's `collection`. Saves the other record's (collection's) multi relation field (`itemIds`)
 * immediately on click, independent of this post's draft and publish. Adding appends to the end; removing removes every slot holding this post.
 * If versions diverge (changed elsewhere first), it re-reads the latest value and tries once more.
 */
export declare function BacklinkInput({ field, targetId, disabled, shared, }: {
    field: BacklinkField;
    /** ID of this post. For a translation, the original's ID (relations point to the original). Absent for a new post. */
    targetId: string | undefined;
    disabled: boolean;
    /** Usages of the same post loaded by the properties panel. If present, use them; after saving, reload with `refresh`. */
    shared?: {
        references: readonly IncomingReference[];
        loading: boolean;
        refresh: () => void;
    };
}): import("react").JSX.Element;
