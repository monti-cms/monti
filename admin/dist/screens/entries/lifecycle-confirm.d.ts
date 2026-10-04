import type { IncomingReferenceItem } from "@monti-cms/core/runtime";
import type { ConfirmRequest } from "../shared/confirm-dialog.js";
import { type EntryData } from "./entry-form.js";
/** Status transitions of the edit screen. */
export type LifecycleAction = "archive" | "unarchive" | "trash" | "restore";
/** Transitions that ask first. Only archiving and moving to trash, which take a published post down, ask. Unarchive and restore happen right away. */
export type ConfirmedLifecycleAction = Extract<LifecycleAction, "archive" | "trash">;
/** Name of the transition. Buttons and the "save first" hint use the same words. */
export declare const LIFECYCLE_LABEL: Record<LifecycleAction, string>;
/** Text to announce after the transition finishes. */
export declare const LIFECYCLE_SUCCESS: Record<LifecycleAction, string>;
/** Text to announce when the transition fails. */
export declare const LIFECYCLE_FAILED: Record<LifecycleAction, string>;
/**
 * Confirmation text for transitions that take a published post down. Also tells if the published version is used elsewhere,
 * and that moving the original also moves translations in the same group.
 */
export declare function lifecycleConfirm(action: ConfirmedLifecycleAction, entry: Pick<EntryData, "id" | "translationGroupId" | "translations"> | null, incomingReferences: readonly Pick<IncomingReferenceItem, "state">[]): Omit<ConfirmRequest, "onConfirm">;
