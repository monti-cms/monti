import type { EditorContext } from "./entry-editor-types.js";
import { type EntryData, type EntryForm, type EntryFormPatch } from "./entry-form.js";
/** The browser recovery copy is kept once input has paused this long (not written on every input). */
export declare const RECOVERY_IDLE_MS = 5000;
export declare function createRecovery(ctx: EditorContext): {
    safely: <T>(task: () => Promise<T>, fallback: T) => Promise<T>;
    settle: (write: Promise<void>) => Promise<void>;
    queueBackup: (task: () => Promise<void>) => Promise<void>;
    persistBackup: (snapshot: EntryForm, changeSeq: number) => Promise<void>;
    cancelPendingBackup: () => void;
    flushPendingBackup: () => Promise<void>;
    scheduleBackup: (snapshot: EntryForm, changeSeq: number) => void;
    discardBackup: (key: string) => Promise<void>;
    flushBeforeSave: () => Promise<void>;
    restoreRecovery: (applyForm: (patch: EntryFormPatch) => void) => () => void;
    discardRecovery: () => Promise<void>;
    open: (generation: number, fetchAndApply: (id: string, alive: () => boolean) => Promise<EntryData | null>) => Promise<void>;
};
export type Recovery = ReturnType<typeof createRecovery>;
