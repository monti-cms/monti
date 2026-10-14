import type { EntryStatusAction } from "../../api/entries.js";
import { type EditorResult } from "../../hooks/result.js";
import type { Recovery } from "./entry-editor-recovery-state.js";
import type { EditorContext, EntrySaveOutcome, FilledField, PublishOutcome, StatusOutcome } from "./entry-editor-types.js";
import { type EntryData } from "./entry-form.js";
/** The parts of the engine the lifecycle commands lean on. */
export interface LifecycleDeps {
    fillFromBody(): EditorResult<readonly FilledField[]>;
    save(): Promise<EditorResult<EntrySaveOutcome>>;
    fetchAndApply(id: string): Promise<EntryData | null>;
    recovery: Pick<Recovery, "cancelPendingBackup" | "queueBackup" | "safely">;
}
export declare function createLifecycle(ctx: EditorContext, deps: LifecycleDeps): {
    publish: (options?: {
        resetPublishedAt?: boolean;
    }) => Promise<EditorResult<PublishOutcome>>;
    changeStatus: (action: EntryStatusAction) => Promise<EditorResult<StatusOutcome>>;
    duplicate: () => Promise<EditorResult<EntryData>>;
    deletePermanently: () => Promise<EditorResult>;
};
