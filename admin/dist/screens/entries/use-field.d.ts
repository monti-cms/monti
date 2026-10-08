import type { SlugField, ValueField } from "@monti-cms/core/client";
import { type SchemaCollection } from "@monti-cms/core/client";
import { type ReactNode } from "react";
import { type StateStore } from "../../hooks/store.js";
import type { SlotRequest } from "../../slots/registry.js";
import { type CmsIssue } from "../api-error-message.js";
import { type EntryData, type EntryForm, type EntryFormPatch, type FormValue } from "./entry-form.js";
/**
 * One problem found in a field. `message` is the localized text to show as it is. Branch on `code`, never on the text.
 *
 * @experimental
 */
export interface FieldError {
    readonly code?: string;
    readonly message: string;
    /** The issue as the server reported it (`position` and the like). */
    readonly issue: CmsIssue;
}
/**
 * Everything a field UI needs, from {@link useField}. The component that holds it re-renders only when something of this field changes:
 * typing in another field does not touch it.
 *
 * @experimental
 */
export interface FieldState<V extends FormValue = FormValue> {
    /** The field name, as in the collection definition. A key that is not a schema field (a language tab key of a record) works too: `definition` is then undefined. */
    readonly name: string;
    /** The field in the collection definition. A conditional field's name gives its choice field. */
    readonly definition: ValueField | SlugField | undefined;
    readonly label: string;
    readonly description: string | undefined;
    readonly required: boolean;
    readonly hidden: boolean;
    readonly value: V;
    /** Changes this field only. Does nothing while `readOnly`. */
    setValue(next: V): void;
    /** Not editable now: the entry is disabled (trash, saving) or the field is shared on a translation. */
    readonly readOnly: boolean;
    /** `locked`: a field shared by the translation group, which shows the original's value. `disabled`: the whole form is disabled. */
    readonly readOnlyReason: "disabled" | "locked" | null;
    /** The note shown with a locked field (where the original is), if any. */
    readonly lockedNote: ReactNode;
    /** The first problem found in this field, if any. Never set on a locked field. */
    readonly error: FieldError | null;
    /** Every problem found in this field. */
    readonly errors: readonly FieldError[];
    readonly invalid: boolean;
    /** Ids for the label (`input`) and the error text (`error`), so the control and its messages are linked. */
    readonly ids: {
        readonly input: string;
        readonly error: string;
    };
    /** Spread on the input. `aria-describedby` is set only while there is an error to describe. */
    readonly inputProps: {
        readonly id: string;
        readonly "aria-invalid"?: true;
        readonly "aria-describedby"?: string;
        readonly disabled?: true;
    };
    /**
     * The request for the slot next to this field (AI and other actions). Pass it to `useSlotActions`. `null` on a locked field, where no
     * action is placed. Its context and `apply` read the form when the action runs, not when it renders.
     */
    readonly slotRequest: SlotRequest | null;
}
/**
 * What {@link EntryFormProvider} shares with the fields below it. The owner of the form state (the entry editor, a record panel)
 * passes its current values and the function that changes them.
 *
 * @experimental
 */
export interface EntryFormValue {
    readonly collection: SchemaCollection;
    readonly form: EntryForm;
    /** Applies a partial change: only the given keys change. Keys the form does not edit (values of removed fields) are left alone. */
    readonly setForm: (patch: EntryFormPatch) => void;
    /** Problems the server reported (publish failures). A field shows those whose `path` is its name. */
    readonly issues?: readonly CmsIssue[];
    /** The whole form is not editable now (trash, saving). */
    readonly disabled?: boolean;
    /** The id of the entry being edited. Absent on a new entry. */
    readonly entryId?: string;
    /** Language of the entry being edited. */
    readonly locale?: string;
    /** The saved entry. */
    readonly entry?: EntryData | null;
    /** Translation editing: fields shared by the translation group show `values` (the original's) read-only, with `note` beside them. */
    readonly locked?: {
        readonly values: EntryForm;
        readonly note: ReactNode;
    };
}
/** What the fields read. A store, so a field subscribes to its own slice. */
interface EntryFormState {
    collection: SchemaCollection;
    form: EntryForm;
    setForm: (patch: EntryFormPatch) => void;
    issues: readonly CmsIssue[];
    disabled: boolean;
    entryId: string | undefined;
    locale: string | undefined;
    entry: EntryData | null;
    locked: {
        readonly values: EntryForm;
        readonly note: ReactNode;
    } | undefined;
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
export declare function EntryFormProvider({ value, children }: {
    value: EntryFormValue;
    children: ReactNode;
}): import("react").JSX.Element;
/** The store of the nearest {@link EntryFormProvider}. Internal: the default field UI uses it for what `useField` does not cover. */
export declare function useEntryFormStore(): StateStore<EntryFormState>;
/** Subscribes to one slice of the form state. The selector must return a stable value. */
export declare function useEntryFormSelector<T>(selector: (state: EntryFormState) => T): T;
/**
 * The value, change, error, read-only state, ids and slot request of one form field, for a field UI of your own. The component re-renders only
 * when this field changes.
 *
 * Must be used below an `EntryFormProvider` (the entry editor and the record panel provide one). The label row, the layout and the slot button
 * are yours to draw: pass `slotRequest` to `useSlotActions` for the actions attached to the field.
 *
 * @experimental
 */
export declare function useField<V extends FormValue = FormValue>(name: string): FieldState<V>;
export {};
