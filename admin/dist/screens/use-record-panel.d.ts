import type { RecordTarget } from "./record-panel.js";
import type { ListMode } from "./use-entry-list.js";
/**
 * The taxonomy item (record) panel beside the list: which item is open, whether it has unsaved changes, and the guards around that. The panel
 * reports its own dirty state; this hook decides when it may be replaced or closed.
 * `confirmDiscard` is the list's confirm dialog, passed in so the screen renders a single set of dialogs.
 */
export declare function useRecordPanel({ collection, mode, confirmDiscard, }: {
    collection: string;
    mode: ListMode;
    confirmDiscard: (dirty: boolean) => Promise<boolean>;
}): {
    recordTarget: RecordTarget | null;
    openRecord: (target: RecordTarget) => Promise<void>;
    showRecord: (target: RecordTarget) => void;
    closeRecord: () => void;
    setRecordDirty: (dirty: boolean) => void;
    guardDialog: import("react").ReactNode;
};
