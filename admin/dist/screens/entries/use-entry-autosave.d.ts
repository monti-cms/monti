import { type EntryData, type EntryForm, type EntryFormPatch } from "./entry-form.js";
/** Browser temporary save keeps the last state once input has paused this long (not written on every input). */
export declare const BACKUP_IDLE_MS = 5000;
/** Maximum time to wait for Korean IME composition to end before saving. After that, the composition marker is assumed stale and it saves anyway. */
export declare const COMPOSITION_WAIT_MS = 1000;
/** Save status. */
export type SaveStatus = "new" | "saved" | "dirty" | "saving" | "local-only" | "failed" | "conflict" | "session-expired";
export declare const SAVE_STATUS_LABELS: Record<SaveStatus, string>;
interface Options {
    adminId: string;
    collection: string;
    /** The loaded item. `null` for a new post, created on explicit save or publish. */
    entry: EntryData | null;
    initialForm: EntryForm;
    /** False for states that must not be saved, like trash. */
    enabled: boolean;
    /** Folder to put a new post in on its first save (location opened from the list). */
    newEntryFolderId?: string | null;
    onSaved: (entry: EntryData) => void;
    onConflict: (server: EntryData, local: EntryForm) => void;
}
/**
 * While editing, only a browser recovery copy is kept; an explicit save or publish saves the server draft.
 *
 * - The recovery copy is kept as the last state once input pauses and `BACKUP_IDLE_MS` passes (browser only, never sent to the server).
 *   It is kept right away, without waiting, when leaving the screen, hiding the tab or pressing save.
 * - One request at a time. Input during a send goes out on the next explicit save.
 * - The recovery copy is kept even on a network or server error. Retries are sent only when the user presses retry.
 * - If the session expires, the recovery copy is kept and the user is guided to sign in again.
 */
export declare function useEntryAutosave({ adminId, collection, entry, initialForm, enabled, newEntryFolderId, onSaved, onConflict, }: Options): {
    form: EntryForm;
    status: SaveStatus;
    lastError: string | null;
    backupAvailable: boolean;
    setForm: (patch: EntryFormPatch) => void;
    flush: () => Promise<boolean>;
    retry: (verify?: boolean) => Promise<boolean>;
    setComposing: (composing: boolean) => void;
    resetFromServer: (loaded: EntryData, loadedForm: EntryForm) => void;
    /** If "overwrite with mine" is chosen in conflict resolution, saves again based on the server version. */
    overwriteWithLocal: (serverVersion: number) => Promise<boolean>;
    getEntryId: () => string | null;
    /** Reason for the last save failure and the save status (latest values, without waiting for a render). */
    getLastError: () => string | null;
    getStatus: () => SaveStatus;
    getVersion: () => number;
    setVersion: (version: number) => void;
    hasPendingChanges: () => boolean;
};
export {};
