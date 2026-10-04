import type { IncomingReferenceItem } from "@monti-cms/core/runtime";
import type { CmsIssue } from "../api-error-message.js";
import { type EntryData, type EntryForm, type EntryFormPatch } from "./entry-form.js";
interface InspectorPanelProps {
    collection: string;
    form: EntryForm;
    disabled: boolean;
    publishIssues?: CmsIssue[];
    entry: EntryData | null;
    incomingReferences: IncomingReferenceItem[];
    isLoadingIncomingReferences: boolean;
    onRefreshIncomingReferences: () => void;
    onSlugChange: (slug: string) => void;
    onRegenerateSlug: () => void;
    onChange: (patch: EntryFormPatch) => void;
    onClose: () => void;
    /** Moves focus to this field (jump to a publish problem). Calls `onFocused` once moved. */
    focusPath?: string | null;
    onFocused?: () => void;
}
/**
 * Properties panel on the right of the edit screen. Splits tabs by group/field `tab` and fixes the inner width so inputs
 * do not shift or overflow when it opens/closes or the window width changes.
 */
export declare function InspectorPanel({ collection, form, disabled, publishIssues, entry, incomingReferences, isLoadingIncomingReferences, onRefreshIncomingReferences, onSlugChange, onRegenerateSlug, onChange, onClose, focusPath, onFocused, }: InspectorPanelProps): import("react").JSX.Element;
export {};
