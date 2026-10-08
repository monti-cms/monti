import type { LayoutGroup } from "@monti-cms/core/client";
import { type Locale, type SchemaCollection } from "@monti-cms/core/client";
import { type ReactNode } from "react";
import { type SlotRequest } from "../../slots/slots.js";
import { type CmsIssue } from "../api-error-message.js";
import { type IncomingReference } from "./field-inputs.js";
/** Usages of the entry the caller already loaded. A backlink input shows them without fetching again. */
export interface SchemaFieldsReferences {
    items: readonly IncomingReference[];
    loading: boolean;
    refresh: () => void;
}
interface SchemaFieldsProps {
    onSlugChange?: (slug: string) => void;
    onRegenerateSlug?: () => void;
    /** Hint text of the slug input. Used when switching to show the value to be generated when empty. */
    slugPlaceholder?: string;
    /** Do not render this field (when the input lives elsewhere, like the title above the body on the edit screen). */
    omit?: readonly string[];
    /** Whether to show the always-visible description under the field. */
    showDescriptions?: boolean;
    /** Render only this group (splitting per tab in the edit screen's properties panel). All if absent. */
    include?: (group: LayoutGroup) => boolean;
    /** Group title style. `plain` is a small title that does not collapse (the edit screen's properties panel). */
    sections?: "collapsible" | "plain";
    references?: SchemaFieldsReferences;
}
interface FieldRowProps {
    id: string;
    label: string;
    required?: boolean;
    issue?: CmsIssue;
    help?: ReactNode;
    slot?: SlotRequest;
    /** What goes on the right of the label row (character count, etc.). Comes before the slot button. */
    aside?: ReactNode;
    children: ReactNode;
}
/**
 * Label, required mark, error and help of one field. If `slot` exists, a slot button goes next to the label and the result below the input.
 * All inputs in the properties panel use this row.
 */
export declare function FieldRow({ id, label, required, issue, help, slot, aside, children }: FieldRowProps): import("react").JSX.Element;
/**
 * Reads the collection definition and renders property inputs. Follows the group order of the layout (`layout`),
 * and renders fields not in the layout after the last group in declaration order. For a conditional field, shows its dependent input when the condition holds.
 * The values, issues and read-only state come from the nearest `EntryFormProvider`; each field row reads them with `useField`.
 */
export declare function SchemaFields({ onSlugChange, onRegenerateSlug, slugPlaceholder, omit, showDescriptions, include, sections, references, }: SchemaFieldsProps): import("react").JSX.Element;
/**
 * One language's values of a record collection (category, tag, collection). Used by the language tab of the category edit panel.
 * If left empty, that language's page also uses the default language value. Reads the form from the nearest `EntryFormProvider`.
 */
export declare function RecordLocaleFields({ collection, locale }: {
    collection: SchemaCollection;
    locale: Locale;
}): import("react").JSX.Element;
export {};
