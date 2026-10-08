import { type Site } from "@monti-cms/core/client";
import { type StoredDocument } from "@monti-cms/core/document";
import type { BrowserFormat } from "../../browser-format.js";
import { type EditorError, type EditorResult } from "../../hooks/result.js";
import { type StateStore } from "../../hooks/store.js";
import type { CmsIssue } from "../api-error-message.js";
import type { EntryEditorClient, EntryStatusAction, RecoveryStore } from "./entry-editor-client.js";
import { type EntryData, type EntryForm, type EntryFormPatch, type TranslationSource, translationStateFromForm } from "./entry-form.js";
/** The browser recovery copy is kept once input has paused this long (not written on every input). */
export declare const RECOVERY_IDLE_MS = 5000;
/** The longest wait for Korean IME composition to end before a save. After that the composition marker is taken as stale and the save goes on. */
export declare const COMPOSITION_WAIT_MS = 1000;
/**
 * Where the entry stands against the server.
 *
 * `new`: not created on the server yet. `saved`: the server has what the form holds. `dirty`: changes that only the browser recovery copy
 * has. `local-only`: a save failed because the server could not be reached, so only the browser has the changes. `failed`: a save was refused or
 * the recovery copy is unavailable too. `conflict`: someone else saved first. `session-expired`: sign in again; the changes are safe in the browser.
 *
 * @experimental
 */
export type SaveStatus = "new" | "saved" | "dirty" | "saving" | "local-only" | "failed" | "conflict" | "session-expired";
/**
 * What to open: an existing entry, or a new one of a collection (created on the server by the first save or publish).
 *
 * @experimental
 */
export type EntryEditorTarget = {
    readonly mode: "edit";
    readonly entryId: string;
} | {
    readonly mode: "new";
    readonly collection: string;
    readonly folderId?: string | null;
};
/**
 * How loading the entry went. The editor never navigates: a `redirect` state tells the UI where this entry is edited instead.
 *
 * @experimental
 */
export type EntryLoadState = {
    readonly status: "loading";
} | {
    readonly status: "ready";
}
/** Item collections (tags, categories and the like) are edited in the small form on the list, not in the document editor. */
 | {
    readonly status: "redirect";
    readonly reason: "item-collection";
    readonly collection: string;
    /** Set when an existing entry was opened. */
    readonly entryId?: string;
} | {
    readonly status: "error";
    readonly error: EditorError;
};
/**
 * A browser recovery copy found when the entry opened. `restore`: the server still has the version the copy was made from. `conflict`: the server changed
 * after the copy was made, so restoring it overwrites the newer server version.
 *
 * @experimental
 */
export interface RecoveryOffer {
    readonly kind: "restore" | "conflict";
    /** When the copy was made (milliseconds since the epoch). */
    readonly savedAt: number;
    /** The server's entry, for `conflict`. */
    readonly server?: EntryData;
}
/**
 * Someone saved the entry elsewhere first. `server` is the latest saved version, `local` what this editor holds.
 *
 * @experimental
 */
export interface ConflictInfo {
    readonly server: EntryData;
    readonly local: EntryForm;
}
/** Result of a save: the entry as the server holds it, and whether anything was sent (`false`: there was nothing to save). */
export interface EntrySaveOutcome {
    readonly entry: EntryData;
    readonly changed: boolean;
}
/**
 * Result of a publish.
 *
 * @experimental
 */
export interface PublishOutcome {
    readonly entry: EntryData;
    readonly warnings: readonly CmsIssue[];
    /** Fields filled from the body (`fillFromBody`) by this publish, with their labels, so a UI can say so. */
    readonly filled: readonly FilledField[];
}
/** A field that was empty and was generated from the body. */
export interface FilledField {
    readonly name: string;
    readonly label: string;
}
/**
 * Result of a status change.
 *
 * @experimental
 */
export interface StatusOutcome {
    /** The entry after the change, as the server holds it. `null` when the editor did not reload it (see `openEntryId`). */
    readonly entry: EntryData | null;
    /** Moving a translation to the trash: the entry the UI should open instead (the original). */
    readonly openEntryId?: string;
}
/** The translation source flow of a translation that received the original's body. */
export interface TranslationView {
    /** The original's body, language and title. */
    readonly source: TranslationSource;
    /** The source the translator last confirmed (an empty document when none). */
    readonly confirmed: ReturnType<typeof translationStateFromForm>;
    /** The source is not the one the translator confirmed. */
    readonly sourceChanged: boolean;
}
/** The state the store holds. {@link EntryEditor} is this plus derived values and commands. */
export interface EntryEditorState {
    load: EntryLoadState;
    entry: EntryData | null;
    collection: string;
    readOnly: boolean;
    form: EntryForm;
    saveStatus: SaveStatus;
    saveError: EditorError | null;
    hasUnsavedChanges: boolean;
    recoveryCopyAvailable: boolean;
    busy: null | "publish" | "status";
    publishIssues: readonly CmsIssue[];
    bodyWarnings: readonly CmsIssue[];
    recovery: RecoveryOffer | null;
    conflict: ConflictInfo | null;
    slugTouched: boolean;
}
/**
 * The latest values without waiting for a render, for an imperative flow (a Cmd+S handler, an "is it saved?" check after an `await`).
 *
 * @experimental
 */
export interface EntryEditorSnapshot {
    readonly saveStatus: SaveStatus;
    readonly saveError: EditorError | null;
    readonly entryId: string | null;
    readonly version: number;
    readonly hasUnsavedChanges: boolean;
}
/**
 * The state and commands of one entry editor. Commands never throw for expected failures and never show a toast, open a dialog or navigate.
 *
 * While editing, only a browser recovery copy is kept (IndexedDB, after input pauses; never sent to the server). The server draft changes
 * only when `save()`, `publish()`, `changeStatus()` or `overwriteWithMine()` runs. This is not a server autosave.
 *
 * @experimental
 */
export interface EntryEditor {
    readonly load: EntryLoadState;
    /** The last server snapshot. It keeps the translation group info across saves and publishes (their responses carry none). */
    readonly entry: EntryData | null;
    /** The entry's collection. Empty until an opened entry has loaded. */
    readonly collection: string;
    /** The entry is in the trash: nothing can be edited or saved until it is restored. */
    readonly readOnly: boolean;
    readonly form: EntryForm;
    readonly saveStatus: SaveStatus;
    /** Why the last save did not go through, until the next save succeeds. */
    readonly saveError: EditorError | null;
    /** The form differs from what the server last saved. */
    readonly hasUnsavedChanges: boolean;
    /** False when the browser could not keep a recovery copy (private browsing, storage quota). */
    readonly recoveryCopyAvailable: boolean;
    /** What runs now: `publish` (including its save) or a status change. A second command of either kind fails with `invalid_state` meanwhile. */
    readonly busy: null | "publish" | "status";
    /** Problems the server (or the fill-from-body check) reported on publish. A field shows those whose `path` is its name. */
    readonly publishIssues: readonly CmsIssue[];
    /**
     * Warnings the server gave for the body in the latest save or publish (a block's own syntax check, for one). They never block. Those with a
     * `position.blockId` are shown next to that block in the editor. Replaced by every save and publish.
     */
    readonly bodyWarnings: readonly CmsIssue[];
    /** A recovery copy found on open that is not on the server. Answer with `restoreRecovery()` or `discardRecovery()`. */
    readonly recovery: RecoveryOffer | null;
    /** Someone saved first. Answer with `overwriteWithMine()` or `reload()`. A save or retry meanwhile fails with `conflict`. */
    readonly conflict: ConflictInfo | null;
    /** The slug was edited by hand, so changing its source field no longer regenerates it. */
    readonly slug: {
        readonly touched: boolean;
    };
    /** The translation source flow. `null` unless the entry is a translation that received the original's body. */
    readonly translation: TranslationView | null;
    /** Changes part of the form. Local only: the browser recovery copy is scheduled, the server is not touched. Regenerates the slug while it is not touched. */
    setForm(patch: EntryFormPatch): void;
    /** Sets the slug by hand: it is touched from now on. */
    setSlug(slug: string): void;
    /** Recomputes the slug from the field its definition names and un-touches it. */
    regenerateSlug(): void;
    /** The body from the body editor or a source panel: the stored document (with block ids), which the next save sends. */
    setBody(doc: StoredDocument): void;
    /** IME guard: a save waits (up to {@link COMPOSITION_WAIT_MS}) until composition ends. */
    setComposing(composing: boolean): void;
    /** Fills the empty `fillFromBody` fields from the body. Fails with `validation` (a `missing_field` issue) when a field has no body to come from. `publish` does this itself. */
    fillFromBody(): EditorResult<readonly FilledField[]>;
    /** Saves the form to the server (POST for a new entry, PATCH with the version otherwise). One request runs at a time. */
    save(): Promise<EditorResult<EntrySaveOutcome>>;
    /** Checks the server's version first, then saves. For a failed, local-only or session-expired entry. */
    retry(): Promise<EditorResult<EntrySaveOutcome>>;
    /** Fills empty body-filled fields, saves, then publishes at the saved version. */
    publish(options?: {
        resetPublishedAt?: boolean;
    }): Promise<EditorResult<PublishOutcome>>;
    /** Archive, unarchive, trash or restore. Fails with `invalid_state` while changes are unsaved (restore excepted). Reloads the entry afterwards. */
    changeStatus(action: EntryStatusAction): Promise<EditorResult<StatusOutcome>>;
    /** Copies the entry (it has to be saved first). */
    duplicate(): Promise<EditorResult<EntryData>>;
    /** Deletes the entry for good, and its recovery copy. */
    deletePermanently(): Promise<EditorResult>;
    /** Puts the offered recovery copy into the form. */
    restoreRecovery(): void;
    /** Keeps the server's version: deletes the offered recovery copy. */
    discardRecovery(): Promise<void>;
    /** Conflict: saves this editor's form on top of the server's latest version. */
    overwriteWithMine(): Promise<EditorResult<EntrySaveOutcome>>;
    /** Loads the server's version into the form and drops the local changes and their recovery copy. Resolves a conflict without a page reload. */
    reload(): Promise<EditorResult<EntryData>>;
    /** The translator confirms the current source: the form records it, so `translation.sourceChanged` goes false. */
    confirmTranslationSource(): void;
    getSnapshot(): EntryEditorSnapshot;
}
export interface EntryEditorCallbacks {
    onSaved?: (entry: EntryData, info: {
        created: boolean;
    }) => void;
}
export interface EntryEditorConfig {
    /** The site the editor works in: its collections, locales and admin language. */
    site: Site;
    adminId: string;
    target: EntryEditorTarget;
    client: EntryEditorClient;
    recoveryStore: RecoveryStore;
    /** The formats the browser can read (`CmsAdminComponents.formats`), asked for when an old recovery copy is opened. */
    formats?: () => Readonly<Record<string, BrowserFormat>> | undefined;
    /** Read when a callback is needed, so the latest render's functions are used. */
    callbacks: () => EntryEditorCallbacks;
}
/** @internal The engine behind {@link EntryEditor}, without React. */
export interface EntryEditorCore {
    readonly store: StateStore<EntryEditorState>;
    /** The public value for a state. The same state gives the same object. */
    view(state: EntryEditorState): EntryEditor;
    /** Starts opening the entry (load, then look for a recovery copy). Safe to call again after `stop()`. */
    start(): void;
    /** Cancels an open in progress and writes the waiting recovery copy. */
    stop(): void;
    /** Writes the waiting recovery copy now (leaving the screen, hiding the tab). */
    flushRecovery(): Promise<void>;
}
/** The marker the view carries so `EntryEditorProvider` can find the engine behind a value `useEntryEditor` returned. */
export declare const ENTRY_EDITOR_CORE: unique symbol;
/**
 * The entry editor's engine: the state machine behind `useEntryEditor`, written without React so it can be driven by a test or another UI.
 *
 * It keeps a form with a browser recovery copy and sends it to the server only when told to. Per entry it holds: the form, its baseline (the last
 * server save), the save status, a recovery copy in the {@link RecoveryStore}, and the conflict and recovery offers.
 *
 * - The recovery copy is written once input pauses for `RECOVERY_IDLE_MS` (browser only, never sent to the server), and right away on `flushRecovery()`
 *   (leaving the screen, hiding the tab) and when a save starts.
 * - One request at a time. Input during a send goes out on the next explicit save.
 * - The recovery copy is kept even on a network or server error. Retries are sent only when the user asks (`retry`).
 * - If the session expires, the recovery copy is kept and the user is guided to sign in again.
 *
 * @internal
 */
export declare function createEntryEditor(config: EntryEditorConfig): EntryEditorCore;
