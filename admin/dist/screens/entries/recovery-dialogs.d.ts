import { type EntryData, type EntryForm } from "./entry-form.js";
import type { LocalBackupRecord } from "./local-backup.js";
/** Browser recovery copy found when the edit screen opened. It is a `conflict` if the server has changed since then. */
export type Recovery = {
    kind: "restore";
    backup: LocalBackupRecord<EntryForm>;
} | {
    kind: "conflict";
    backup: LocalBackupRecord<EntryForm>;
    server: EntryData;
};
/** Asks whether to load a browser temporary copy that is not on the server. */
export declare function RecoveryDialog({ recovery, onClose, onKeepServer, onRestore, }: {
    recovery: Recovery | null;
    onClose: () => void;
    onKeepServer: (recovery: Recovery) => void;
    onRestore: (recovery: Recovery) => void;
}): import("react").JSX.Element;
/** When someone saved elsewhere first during autosave or publish. Compare both sides, then copy or pick one. */
export declare function ConflictDialog({ conflict, onClose, onReload, onOverwrite, }: {
    conflict: {
        server: EntryData;
        local: EntryForm;
    } | null;
    onClose: () => void;
    onReload: () => void;
    /** Overwrites the latest server version with my input. */
    onOverwrite: (serverVersion: number) => void;
}): import("react").JSX.Element;
