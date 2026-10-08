import type { IncomingReferenceItem } from "@monti-cms/core/runtime";
interface InspectorPanelProps {
    incomingReferences: IncomingReferenceItem[];
    isLoadingIncomingReferences: boolean;
    onRefreshIncomingReferences: () => void;
    onSlugChange: (slug: string) => void;
    onRegenerateSlug: () => void;
    onClose: () => void;
    /** Moves focus to this field (jump to a publish problem). Calls `onFocused` once moved. */
    focusPath?: string | null;
    onFocused?: () => void;
}
/**
 * Properties panel on the right of the edit screen. Splits tabs by group/field `tab` and fixes the inner width so inputs
 * do not shift or overflow when it opens/closes or the window width changes.
 *
 * Reads the collection, issues, entry and disabled state from the `EntryFormProvider` above it (the entry editor provides one).
 */
export declare function InspectorPanel({ incomingReferences, isLoadingIncomingReferences, onRefreshIncomingReferences, onSlugChange, onRegenerateSlug, onClose, focusPath, onFocused, }: InspectorPanelProps): import("react").JSX.Element;
export {};
