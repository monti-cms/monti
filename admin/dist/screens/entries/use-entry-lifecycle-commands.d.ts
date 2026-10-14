import type { IncomingReferenceItem } from "@monti-cms/core/runtime";
import { type CmsIssue } from "../../api/error-message.js";
import type { EntryEditor } from "./entry-editor-types.js";
import { type ConfirmedLifecycleAction, type LifecycleAction } from "./lifecycle-confirm.js";
interface EntryLifecycleCommandsInput {
    editor: EntryEditor;
    incomingItems: IncomingReferenceItem[];
    refreshIncoming: (targetId: string) => Promise<void>;
    /** Brings the user to the place a publish warning points at. */
    focusIssue: (issue: CmsIssue) => void;
    /** Whether the translation source changed since the translator last confirmed it. */
    sourceChanged: boolean;
}
export type EntryLifecycleCommands = ReturnType<typeof useEntryLifecycleCommands>;
export declare function useEntryLifecycleCommands({ editor, incomingItems, refreshIncoming, focusIssue, sourceChanged, }: EntryLifecycleCommandsInput): {
    isPublishing: boolean;
    isSubmitting: boolean;
    confirmDialog: import("react").JSX.Element;
    handleSaveNow: () => Promise<void>;
    handlePreview: (href: string) => Promise<void>;
    handlePublish: ({ resetPublishedAt }?: {
        resetPublishedAt?: boolean;
    }) => Promise<void>;
    runLifecycle: (action: LifecycleAction) => Promise<void>;
    confirmLifecycle: (action: ConfirmedLifecycleAction) => Promise<void>;
    confirmPermanentDelete: () => Promise<void>;
    handleDuplicate: () => Promise<void>;
};
export {};
