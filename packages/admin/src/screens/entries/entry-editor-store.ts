import { bodyExcerpt, confirmedSourceState, fillFromBodyLength, type Site } from "@monti-cms/core/client";
import { type StoredDocument, withoutBlockIds } from "@monti-cms/core/document";
import type { BrowserFormat } from "../../browser-format";
import { type EditorError, type EditorResult, editorFailure, toEditorError } from "../../hooks/result";
import { createStateStore, type StateStore } from "../../hooks/store";
import type { TranslatorFor } from "../../translator";
import { CmsApiError, errorText } from "../admin-api";
import type { CmsIssue } from "../api-error-message";
import { nounVars } from "../shared/noun.messages";
import type { EntryEditorClient, EntryStatusAction, RecoveryRecord, RecoveryStore } from "./entry-editor-client";
import {
	copyTitle,
	EMPTY_FORM,
	type EntryData,
	type EntryForm,
	type EntryFormPatch,
	emptyFormOf,
	formFingerprint,
	formFromEntry,
	formText,
	formTitle,
	isTranslationEntry,
	metadataFromForm,
	stringifyTranslation,
	TRANSLATION_FORM_KEY,
	type TranslationSource,
	translationPayload,
	translationSourceOf,
	translationStateFromForm,
} from "./entry-form";
import { upgradeRecoveryRecord } from "./legacy-backup";
import { backupKey } from "./local-backup";
import { entriesMessages } from "./messages";

/** The browser recovery copy is kept once input has paused this long (not written on every input). */
export const RECOVERY_IDLE_MS = 5000;
/** The longest wait for Korean IME composition to end before a save. After that the composition marker is taken as stale and the save goes on. */
export const COMPOSITION_WAIT_MS = 1000;
/** The longest wait for the browser recovery copy before a save. The server save goes through even if browser storage stalls. */
const RECOVERY_WAIT_MS = 1500;

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Where the entry stands against the server.
 *
 * `new`: not created on the server yet. `saved`: the server has what the form holds. `dirty`: changes that only the browser recovery copy
 * has. `local-only`: a save failed because the server could not be reached, so only the browser has the changes. `failed`: a save was refused or
 * the recovery copy is unavailable too. `conflict`: someone else saved first. `session-expired`: sign in again; the changes are safe in the browser.
 *
 * @experimental
 */
export type SaveStatus =
	| "new"
	| "saved"
	| "dirty"
	| "saving"
	| "local-only"
	| "failed"
	| "conflict"
	| "session-expired";

/**
 * What to open: an existing entry, or a new one of a collection (created on the server by the first save or publish).
 *
 * @experimental
 */
export type EntryEditorTarget =
	| { readonly mode: "edit"; readonly entryId: string }
	| { readonly mode: "new"; readonly collection: string; readonly folderId?: string | null };

/**
 * How loading the entry went. The editor never navigates: a `redirect` state tells the UI where this entry is edited instead.
 *
 * @experimental
 */
export type EntryLoadState =
	| { readonly status: "loading" }
	| { readonly status: "ready" }
	/** Item collections (tags, categories and the like) are edited in the small form on the list, not in the document editor. */
	| {
			readonly status: "redirect";
			readonly reason: "item-collection";
			readonly collection: string;
			/** Set when an existing entry was opened. */
			readonly entryId?: string;
	  }
	| { readonly status: "error"; readonly error: EditorError };

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
	// ---- state
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
	readonly slug: { readonly touched: boolean };
	/** The translation source flow. `null` unless the entry is a translation that received the original's body. */
	readonly translation: TranslationView | null;

	// ---- commands
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
	publish(options?: { resetPublishedAt?: boolean }): Promise<EditorResult<PublishOutcome>>;
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
	onSaved?: (entry: EntryData, info: { created: boolean }) => void;
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
export const ENTRY_EDITOR_CORE: unique symbol = Symbol("monti.entryEditorCore");

type Failure = EditorResult<never>;

/** An `EditorError` for something thrown by the client: the server's message, the network text, or `fallback`. */
function failureOf(site: Site, error: unknown, fallback: string): EditorError {
	const base = toEditorError(error, fallback);
	const message = error instanceof CmsApiError ? error.message || fallback : errorText(site, error, fallback);
	return { ...base, message };
}

const failed = (error: EditorError): Failure => ({ ok: false, error });

/** What a document says, without its block ids: two documents with the same key read the same. */
const contentKey = (doc: StoredDocument) => JSON.stringify(withoutBlockIds(doc.content));

/** Save and publish responses carry no translation group info. Keep what was received on load and update only this entry's status. */
function keepTranslationGroup(current: EntryData | null, next: EntryData): Pick<EntryData, "translations" | "source"> {
	const translations = (current?.translations ?? next.translations)?.map((member) =>
		member.id === next.id ? { ...member, status: next.status } : member,
	);
	return { translations, source: current?.source ?? next.source };
}

const statusFailed = (t: TranslatorFor<typeof entriesMessages>): Record<EntryStatusAction, string> => ({
	archive: t("lifecycle.failed.archive"),
	unarchive: t("lifecycle.failed.unarchive"),
	trash: t("lifecycle.failed.trash"),
	restore: t("lifecycle.failed.restore"),
});

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
export function createEntryEditor(config: EntryEditorConfig): EntryEditorCore {
	const { site, adminId, target, client, recoveryStore } = config;
	const t = site.createTranslator(entriesMessages);
	const formats = () => config.formats?.();
	const callbacks = () => config.callbacks();

	const initialCollection = target.mode === "new" ? target.collection : "";
	const initialLoad: EntryLoadState =
		target.mode === "new"
			? site.isItemCollection(target.collection)
				? { status: "redirect", reason: "item-collection", collection: target.collection }
				: { status: "ready" }
			: { status: "loading" };

	// A new entry starts from the empty form of its collection; an entry that is loaded replaces it.
	const emptyForm =
		target.mode === "new" && site.isCollection(target.collection) ? emptyFormOf(site, target.collection) : EMPTY_FORM;

	const store = createStateStore<EntryEditorState>({
		load: initialLoad,
		entry: null,
		collection: initialCollection,
		readOnly: false,
		form: emptyForm,
		saveStatus: "new",
		saveError: null,
		hasUnsavedChanges: false,
		recoveryCopyAvailable: true,
		busy: null,
		publishIssues: [],
		bodyWarnings: [],
		recovery: null,
		conflict: null,
		slugTouched: target.mode === "edit",
	});
	const state = () => store.getState();

	/** What the save loop tracks outside the store. */
	const m = {
		entryId: null as string | null,
		version: 0,
		baseMetadata: {} as Record<string, unknown>,
		/** A translation saves only per-language values. */
		translation: false,
		serverFingerprint: formFingerprint(site, emptyForm),
		changeSeq: 0,
		ackSeq: 0,
		inflight: null as Promise<EditorResult<EntrySaveOutcome>> | null,
		composing: false,
		compositionWaiters: [] as Array<() => void>,
		backupWrite: Promise.resolve() as Promise<void>,
		pendingBackup: null as { snapshot: EntryForm; changeSeq: number } | null,
		backupTimer: null as ReturnType<typeof setTimeout> | null,
		recoveryRecord: null as RecoveryRecord | null,
		generation: 0,
	};

	/** Writes a partial state. A write that changes nothing does not notify. `hasUnsavedChanges` always follows the sequence numbers. */
	const commit = (patch: Partial<EntryEditorState>) => {
		const current = state();
		const next: Partial<EntryEditorState> = { ...patch, hasUnsavedChanges: m.changeSeq > m.ackSeq };
		for (const key of Object.keys(next) as (keyof EntryEditorState)[]) {
			if (!Object.is(current[key], next[key])) {
				store.setState(next);
				return;
			}
		}
	};

	// ---- recovery copy

	const safely = async <T>(task: () => Promise<T>, fallback: T): Promise<T> => {
		try {
			return await task();
		} catch {
			// A store that fails is the same as one that has nothing: the editor keeps working without a recovery copy.
			return fallback;
		}
	};

	/** Waits for a recovery copy write, but not for long: the server save goes through (and is reported) even if browser storage stalls. */
	const settle = (write: Promise<void>) => Promise.race([write, wait(RECOVERY_WAIT_MS)]);

	const queueBackup = (task: () => Promise<void>) => {
		m.backupWrite = m.backupWrite.then(task, task);
		return m.backupWrite;
	};

	const persistBackup = (snapshot: EntryForm, changeSeq: number) => {
		const key = backupKey(adminId, m.entryId, state().collection);
		const record: RecoveryRecord = {
			key,
			entryId: m.entryId ?? "new",
			baseVersion: m.version,
			baseFingerprint: m.serverFingerprint,
			localFingerprint: formFingerprint(site, snapshot),
			snapshot,
			changeSeq,
			savedAt: Date.now(),
		};
		return queueBackup(async () => {
			commit({ recoveryCopyAvailable: await safely(() => recoveryStore.put(record), false) });
		});
	};

	const cancelPendingBackup = () => {
		if (m.backupTimer) clearTimeout(m.backupTimer);
		m.backupTimer = null;
		m.pendingBackup = null;
	};

	/** Writes the pending recovery copy now. */
	const flushPendingBackup = () => {
		const pending = m.pendingBackup;
		cancelPendingBackup();
		if (pending) void persistBackup(pending.snapshot, pending.changeSeq);
		return m.backupWrite;
	};

	const scheduleBackup = (snapshot: EntryForm, changeSeq: number) => {
		m.pendingBackup = { snapshot, changeSeq };
		// If input continues, count again. It is kept only after it stops.
		if (m.backupTimer) clearTimeout(m.backupTimer);
		m.backupTimer = setTimeout(flushPendingBackup, RECOVERY_IDLE_MS);
	};

	const discardBackup = (key: string) => {
		cancelPendingBackup();
		return queueBackup(() => safely(() => recoveryStore.delete(key), undefined));
	};

	/** Waits for Korean IME composition to end. If no end signal comes (the input vanished mid-composition), clears the marker and moves on. */
	const waitForComposition = async () => {
		if (!m.composing) return;
		await Promise.race([new Promise<void>((resolve) => m.compositionWaiters.push(resolve)), wait(COMPOSITION_WAIT_MS)]);
		m.composing = false;
	};

	// ---- baseline

	/** Makes the server's entry the baseline: the form, the version, the metadata to round-trip and the save status all follow it. */
	const applyServerEntry = (loaded: EntryData) => {
		const loadedForm = formFromEntry(site, loaded);
		m.entryId = loaded.id;
		m.version = loaded.version;
		m.baseMetadata = loaded.working.metadata ?? {};
		m.translation = isTranslationEntry(loaded);
		m.serverFingerprint = formFingerprint(site, loadedForm);
		m.changeSeq = 0;
		m.ackSeq = 0;
		cancelPendingBackup();
		commit({
			entry: loaded,
			collection: loaded.collection,
			readOnly: loaded.status === "trashed",
			form: loadedForm,
			saveStatus: "saved",
			saveError: null,
			conflict: null,
		});
	};

	/** Fetches the entry and makes it the baseline. `null` when the entry belongs to an item collection (the load state says so). */
	const fetchAndApply = async (id: string, alive: () => boolean = () => true): Promise<EntryData | null> => {
		const loaded = await client.get(id);
		if (!alive()) return null;
		if (site.isItemCollection(loaded.collection)) {
			commit({
				load: { status: "redirect", reason: "item-collection", collection: loaded.collection, entryId: loaded.id },
			});
			return null;
		}
		applyServerEntry(loaded);
		return loaded;
	};

	// ---- draft

	/** Changes part of the form without the auto-slug rule. Changes are kept in the browser only. */
	const applyForm = (patch: EntryFormPatch) => {
		const current = state();
		const next = { ...current.form, ...patch };
		const fingerprint = formFingerprint(site, next);
		if (fingerprint === formFingerprint(site, current.form)) return;
		m.changeSeq += 1;
		const keepsStatus = current.saveStatus === "conflict" || current.saveStatus === "session-expired";
		if (!m.inflight && fingerprint === m.serverFingerprint) {
			m.ackSeq = m.changeSeq;
			commit({ form: next, ...(keepsStatus ? {} : { saveStatus: m.entryId ? "saved" : "new" }) });
			void discardBackup(backupKey(adminId, m.entryId, current.collection));
			return;
		}
		commit({ form: next, ...(keepsStatus ? {} : { saveStatus: "dirty" }) });
		scheduleBackup(next, m.changeSeq);
	};

	/** If the slug was not edited by hand, regenerates it when the value that the slug field's `from` points to changes. */
	const withAutoSlug = (patch: EntryFormPatch): EntryFormPatch => {
		const { collection, form, slugTouched } = state();
		if (slugTouched || !site.isCollection(collection)) return patch;
		const from = site.slugFieldOf(collection)?.from;
		if (!from || !Object.hasOwn(patch, from)) return patch;
		return { ...patch, slug: site.slugFromValues(collection, { ...form, ...patch }) };
	};

	// ---- save

	const performSave = (): Promise<EditorResult<EntrySaveOutcome>> => {
		if (m.inflight) return m.inflight;
		const current = state();
		if (current.readOnly)
			return Promise.resolve(editorFailure("read_only", t("editor.readOnly", nounVars(site, current.collection))));
		if (current.saveStatus === "conflict") return Promise.resolve(editorFailure("conflict", t("editor.conflict")));
		if (m.entryId && m.changeSeq <= m.ackSeq && current.entry) {
			if (current.saveStatus !== "session-expired") commit({ saveStatus: "saved" });
			return Promise.resolve({ ok: true, value: { entry: current.entry, changed: false } });
		}
		// Saving during composition drops characters. The save paths (`save`, `retry`) first wait for composition to end.
		if (m.composing) {
			const error: EditorError = { code: "invalid_state", message: t("save.composing"), retryable: true };
			commit({ saveError: error });
			return Promise.resolve(failed(error));
		}

		const targetSeq = m.changeSeq;
		const snapshot = current.form;
		const collection = current.collection;
		const built = metadataFromForm(site, snapshot, collection, m.baseMetadata, { translation: m.translation });
		if ("error" in built) {
			const error: EditorError = { code: "validation", message: built.error, retryable: false };
			commit({ saveError: error, saveStatus: "failed" });
			return Promise.resolve(failed(error));
		}
		commit({ saveStatus: "saving" });

		const request = (async (): Promise<EditorResult<EntrySaveOutcome>> => {
			try {
				const isNew = !m.entryId;
				const newKey = backupKey(adminId, null, collection);
				const translation = translationPayload(snapshot);
				const body = {
					slug: snapshot.slug.trim() || null,
					metadata: built.metadata,
					doc: snapshot.doc,
					...(translation ? { translation } : {}),
				};
				const folderId = target.mode === "new" ? target.folderId : null;
				const saved =
					isNew || !m.entryId
						? await client.create({ collection, ...(folderId ? { folderId } : {}), ...body })
						: await client.update(m.entryId, { expectedVersion: m.version, ...body });
				if (isNew) m.entryId = saved.id;
				m.version = saved.version;
				m.baseMetadata = saved.working?.metadata ?? built.metadata;
				m.serverFingerprint = formFingerprint(site, snapshot);
				m.ackSeq = targetSeq;
				const merged: EntryData = { ...saved, ...keepTranslationGroup(state().entry, saved) };
				commit({
					entry: merged,
					readOnly: merged.status === "trashed",
					saveError: null,
					bodyWarnings: saved.warnings ?? [],
				});
				callbacks().onSaved?.(merged, { created: isNew });

				if (formFingerprint(site, state().form) === m.serverFingerprint) {
					m.ackSeq = m.changeSeq;
					commit({ saveStatus: "saved" });
					await settle(discardBackup(backupKey(adminId, m.entryId, collection)));
				} else {
					commit({ saveStatus: "dirty" });
					cancelPendingBackup();
					await settle(persistBackup(state().form, m.changeSeq));
				}
				if (isNew) await settle(discardBackup(newKey));
				return { ok: true, value: { entry: merged, changed: true } };
			} catch (caught) {
				if (caught instanceof CmsApiError) {
					const error = toEditorError(caught, t("saveFailed"));
					if (caught.status === 401) {
						commit({ saveError: error, saveStatus: "session-expired" });
						return failed(error);
					}
					if (caught.status === 409 && caught.code === "conflict" && m.entryId) {
						commit({ saveStatus: "conflict" });
						const server = await client.get(m.entryId).catch(() => null);
						if (server) commit({ conflict: { server, local: snapshot } });
						return failed(error);
					}
					if (caught.status < 500) {
						// Format and validation errors are the same on resend. Fixing the input makes the next save try again.
						commit({ saveError: error, saveStatus: "failed" });
						return failed(error);
					}
				}
				const error: EditorError = {
					...toEditorError(caught, t("save.offline")),
					message: caught instanceof CmsApiError ? caught.message || t("save.offline") : t("save.offline"),
				};
				commit({ saveError: error, saveStatus: state().recoveryCopyAvailable ? "local-only" : "failed" });
				return failed(error);
			} finally {
				m.inflight = null;
			}
		})();
		m.inflight = request;
		return request;
	};

	/** Sent to the server only on an explicit save or publish. */
	const save = async (): Promise<EditorResult<EntrySaveOutcome>> => {
		await Promise.race([flushPendingBackup(), wait(RECOVERY_WAIT_MS)]);
		await waitForComposition();
		let changed = false;
		for (let attempt = 0; attempt < 5; attempt++) {
			if (m.inflight) {
				await m.inflight;
				changed = true;
			}
			const entry = state().entry;
			if (m.entryId && m.changeSeq <= m.ackSeq && entry) return { ok: true, value: { entry, changed } };
			const result = await performSave();
			if (!result.ok) return result;
			changed = changed || result.value.changed;
		}
		const entry = state().entry;
		if (m.entryId && m.changeSeq <= m.ackSeq && entry) return { ok: true, value: { entry, changed } };
		return failed(state().saveError ?? { code: "failed", message: t("saveFailed"), retryable: true });
	};

	const retry = async (): Promise<EditorResult<EntrySaveOutcome>> => {
		const id = m.entryId;
		if (id) {
			try {
				const server = await client.get(id);
				if (server.version !== m.version) {
					commit({ saveStatus: "conflict", conflict: { server, local: state().form } });
					return editorFailure("conflict", t("editor.conflict"));
				}
			} catch (caught) {
				const error = failureOf(site, caught, t("save.offline"));
				if (error.code === "session_expired") {
					commit({ saveError: error, saveStatus: "session-expired" });
					return failed(error);
				}
				commit({ saveError: error, saveStatus: state().recoveryCopyAvailable ? "local-only" : "failed" });
				return failed(error);
			}
		}
		if (state().saveStatus === "session-expired") commit({ saveStatus: "dirty" });
		await waitForComposition();
		return performSave();
	};

	// ---- commands

	const fillFromBody = (): EditorResult<readonly FilledField[]> => {
		const { collection, form } = state();
		const filled: FilledField[] = [];
		// A field filled from the body (`fillFromBody`) that is empty is generated from the body. If there is no body to generate from, it must be entered by hand.
		for (const { name, field } of site.isCollection(collection) ? site.fillFromBodyFields(collection) : []) {
			if (formText(state().form, name).trim()) continue;
			const generated = bodyExcerpt(site, form.doc, fillFromBodyLength(field));
			if (!generated) {
				const issue: CmsIssue = { code: "missing_field", message: field.label, path: name };
				const error: EditorError = {
					code: "validation",
					message: t("fillEmpty", { label: field.label }),
					issues: [issue],
					retryable: false,
				};
				commit({ publishIssues: [issue] });
				return failed(error);
			}
			applyForm({ [name]: generated });
			filled.push({ name, label: field.label });
		}
		return { ok: true, value: filled };
	};

	const publish = async (options: { resetPublishedAt?: boolean } = {}): Promise<EditorResult<PublishOutcome>> => {
		const current = state();
		if (current.readOnly) return editorFailure("read_only", t("editor.readOnly", nounVars(site, current.collection)));
		if (current.busy) return editorFailure("invalid_state", t("editor.busy"));
		if (current.saveStatus === "conflict") return editorFailure("conflict", t("editor.conflict"));
		commit({ busy: "publish", publishIssues: [] });
		try {
			const filled = fillFromBody();
			if (!filled.ok) return filled;
			const saved = await save();
			if (!saved.ok) return saved;
			const id = m.entryId;
			if (!id) return editorFailure("invalid_state", t("editor.unsaved"));
			try {
				const published = await client.publish(id, {
					expectedVersion: m.version,
					...(options.resetPublishedAt ? { resetPublishedAt: true } : {}),
				});
				m.version = published.version;
				const merged: EntryData = { ...published, ...keepTranslationGroup(state().entry, published) };
				commit({ entry: merged, readOnly: merged.status === "trashed", bodyWarnings: published.warnings ?? [] });
				callbacks().onSaved?.(merged, { created: false });
				return { ok: true, value: { entry: merged, warnings: published.warnings ?? [], filled: filled.value } };
			} catch (caught) {
				if (caught instanceof CmsApiError && caught.code === "conflict") {
					const server = await client.get(id).catch(() => null);
					if (server) commit({ conflict: { server, local: state().form } });
					return failed(toEditorError(caught, t("publishFailed")));
				}
				if (caught instanceof CmsApiError && caught.issues.length > 0) {
					commit({ publishIssues: caught.issues });
					return failed(failureOf(site, caught, t("publishFailed")));
				}
				return failed(failureOf(site, caught, t("publishFailed")));
			}
		} finally {
			commit({ busy: null });
		}
	};

	const changeStatus = async (action: EntryStatusAction): Promise<EditorResult<StatusOutcome>> => {
		const current = state();
		const entry = current.entry;
		if (!entry) return editorFailure("invalid_state", t("editor.notLoaded", nounVars(site, state().collection)));
		if (current.busy) return editorFailure("invalid_state", t("editor.busy"));
		if (action !== "restore" && m.changeSeq > m.ackSeq) return editorFailure("invalid_state", t("editor.unsaved"));
		commit({ busy: "status" });
		try {
			await client.changeStatus(entry.id, action, { expectedVersion: m.version });
			// A translation sent to the trash: the UI opens the original instead, so there is nothing to reload.
			if (action === "trash" && isTranslationEntry(entry) && entry.translationGroupId) {
				return { ok: true, value: { entry: null, openEntryId: entry.translationGroupId } };
			}
			const loaded = await fetchAndApply(entry.id);
			if (loaded) callbacks().onSaved?.(loaded, { created: false });
			return { ok: true, value: { entry: loaded } };
		} catch (caught) {
			return failed(failureOf(site, caught, statusFailed(t)[action]));
		} finally {
			commit({ busy: null });
		}
	};

	const duplicate = async (): Promise<EditorResult<EntryData>> => {
		const current = state();
		if (current.saveStatus === "conflict") return editorFailure("conflict", t("editor.conflict"));
		const id = m.entryId;
		if (!id || m.changeSeq > m.ackSeq) return editorFailure("invalid_state", t("editor.unsaved"));
		try {
			const copy = await client.duplicate(id, {
				title: copyTitle(site, current.collection, formTitle(site, current.collection, current.form)),
			});
			return { ok: true, value: copy };
		} catch (caught) {
			return failed(failureOf(site, caught, t("duplicateFailed")));
		}
	};

	const deletePermanently = async (): Promise<EditorResult> => {
		const entry = state().entry;
		if (!entry) return editorFailure("invalid_state", t("editor.notLoaded", nounVars(site, state().collection)));
		try {
			await client.remove(entry.id, { expectedVersion: m.version });
			cancelPendingBackup();
			await queueBackup(() =>
				safely(() => recoveryStore.delete(backupKey(adminId, entry.id, entry.collection)), undefined),
			);
			return { ok: true, value: undefined };
		} catch (caught) {
			return failed(failureOf(site, caught, t("deleteFailed")));
		}
	};

	const restoreRecovery = () => {
		const record = m.recoveryRecord;
		if (!record) return;
		m.recoveryRecord = null;
		commit({ slugTouched: true, recovery: null });
		applyForm({ ...emptyForm, ...record.snapshot });
	};

	const discardRecovery = async () => {
		const record = m.recoveryRecord;
		m.recoveryRecord = null;
		if (record) await queueBackup(() => safely(() => recoveryStore.delete(record.key), undefined));
		commit({ recovery: null });
	};

	const overwriteWithMine = async (): Promise<EditorResult<EntrySaveOutcome>> => {
		const conflict = state().conflict;
		if (!conflict) return editorFailure("invalid_state", t("editor.noConflict"));
		m.version = conflict.server.version;
		m.changeSeq += 1;
		commit({ conflict: null, saveStatus: "dirty" });
		return performSave();
	};

	const reload = async (): Promise<EditorResult<EntryData>> => {
		const id = m.entryId;
		if (!id) return editorFailure("invalid_state", t("editor.notLoaded", nounVars(site, state().collection)));
		if (m.inflight) await m.inflight;
		try {
			const loaded = await fetchAndApply(id);
			if (!loaded) return editorFailure("invalid_state", t("editor.notLoaded", nounVars(site, state().collection)));
			m.recoveryRecord = null;
			commit({ recovery: null });
			await discardBackup(backupKey(adminId, loaded.id, loaded.collection));
			return { ok: true, value: loaded };
		} catch (caught) {
			return failed(failureOf(site, caught, t("loadFailed")));
		}
	};

	const confirmTranslationSource = () => {
		const { entry, readOnly } = state();
		const source = translationSourceOf(site, entry);
		if (!source || readOnly) return;
		applyForm({ [TRANSLATION_FORM_KEY]: stringifyTranslation(confirmedSourceState(source.doc)) });
	};

	// ---- open

	const offerRecovery = (record: RecoveryRecord, server?: EntryData) => {
		m.recoveryRecord = record;
		commit({
			recovery: { kind: server ? "conflict" : "restore", savedAt: record.savedAt, ...(server ? { server } : {}) },
		});
	};

	/** Opens the entry: loads it (or starts a new one) and compares the server's value with the browser recovery copy. */
	const open = async (generation: number) => {
		const alive = () => generation === m.generation;
		if (target.mode === "new") {
			if (site.isItemCollection(target.collection)) return;
			const stored = await safely(() => recoveryStore.get(backupKey(adminId, null, target.collection)), null);
			const backup = stored && upgradeRecoveryRecord(site, stored, undefined, formats());
			if (alive() && backup && backup.localFingerprint !== backup.baseFingerprint) offerRecovery(backup);
			return;
		}
		commit({ load: { status: "loading" } });
		try {
			const loaded = await fetchAndApply(target.entryId, alive);
			if (!loaded || !alive()) return;
			const key = backupKey(adminId, loaded.id, loaded.collection);
			const stored = await safely(() => recoveryStore.get(key), null);
			const backup = stored && upgradeRecoveryRecord(site, stored, loaded.working.doc, formats());
			if (backup && alive()) {
				if (backup.localFingerprint === formFingerprint(site, state().form)) {
					await discardBackup(key);
				} else if (backup.baseVersion === loaded.version) {
					offerRecovery(backup);
				} else {
					// The server also changed after the recovery copy. Tell the user that loading will overwrite it.
					offerRecovery(backup, loaded);
				}
			}
			if (alive()) commit({ load: { status: "ready" } });
		} catch (caught) {
			if (alive()) commit({ load: { status: "error", error: failureOf(site, caught, t("loadFailed")) } });
		}
	};

	// ---- the public value

	const setComposing = (composing: boolean) => {
		m.composing = composing;
		if (!composing) for (const resolve of m.compositionWaiters.splice(0)) resolve();
	};

	const getSnapshot = (): EntryEditorSnapshot => ({
		saveStatus: state().saveStatus,
		saveError: state().saveError,
		entryId: m.entryId,
		version: m.version,
		hasUnsavedChanges: m.changeSeq > m.ackSeq,
	});

	const commands = {
		setForm: (patch: EntryFormPatch) => applyForm(withAutoSlug(patch)),
		setSlug: (slug: string) => {
			commit({ slugTouched: true });
			applyForm({ slug });
		},
		regenerateSlug: () => {
			const { collection, form } = state();
			commit({ slugTouched: false });
			applyForm({ slug: site.isCollection(collection) ? site.slugFromValues(collection, form) : "" });
		},
		setBody: (doc: StoredDocument) => applyForm({ doc }),
		setComposing,
		fillFromBody,
		save,
		retry,
		publish,
		changeStatus,
		duplicate,
		deletePermanently,
		restoreRecovery,
		discardRecovery,
		overwriteWithMine,
		reload,
		confirmTranslationSource,
		getSnapshot,
	};

	let translationCache: { entry: EntryData | null; raw: unknown; value: TranslationView | null } | null = null;
	const translationOf = (entry: EntryData | null, form: EntryForm): TranslationView | null => {
		const raw = form[TRANSLATION_FORM_KEY];
		if (translationCache && translationCache.entry === entry && translationCache.raw === raw)
			return translationCache.value;
		const source = translationSourceOf(site, entry);
		let value: TranslationView | null = null;
		if (source) {
			const confirmed = translationStateFromForm(raw);
			value = {
				source,
				confirmed,
				sourceChanged: typeof raw === "string" && contentKey(source.doc) !== contentKey(confirmed.baseDoc),
			};
		}
		translationCache = { entry, raw, value };
		return value;
	};

	const views = new WeakMap<EntryEditorState, EntryEditor>();
	const view = (current: EntryEditorState): EntryEditor => {
		const cached = views.get(current);
		if (cached) return cached;
		const { slugTouched, ...rest } = current;
		const base: EntryEditor = {
			...rest,
			slug: { touched: slugTouched },
			translation: translationOf(current.entry, current.form),
			...commands,
		};
		const value = Object.assign(base, { [ENTRY_EDITOR_CORE]: core });
		views.set(current, value);
		return value;
	};

	const core: EntryEditorCore = {
		store,
		view,
		start: () => {
			m.generation += 1;
			void open(m.generation);
		},
		stop: () => {
			m.generation += 1;
			void flushPendingBackup();
		},
		flushRecovery: flushPendingBackup,
	};
	return core;
}
