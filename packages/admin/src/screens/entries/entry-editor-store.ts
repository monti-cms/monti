import { bodyExcerpt, confirmedSourceState, fillFromBodyLength } from "@monti-cms/core/client";
import { type StoredDocument, withoutBlockIds } from "@monti-cms/core/document";
import { CmsApiError, isConflict } from "../../api/client";
import type { CmsIssue } from "../../api/error-message";
import { type EditorError, type EditorResult, editorFailure, toEditorError } from "../../hooks/result";
import { createStateStore } from "../../hooks/store";
import { commonMessages } from "../../lib/common.messages";
import { nounVars } from "../shared/noun.messages";
import { createLifecycle } from "./entry-editor-lifecycle";
import { createRecovery } from "./entry-editor-recovery-state";
import { failed, failureOf, keepTranslationGroup, wait } from "./entry-editor-results";
import type {
	EditorContext,
	EditorMutable,
	EntryEditor,
	EntryEditorConfig,
	EntryEditorCore,
	EntryEditorSnapshot,
	EntryEditorState,
	EntryLoadState,
	EntrySaveOutcome,
	FilledField,
	TranslationView,
} from "./entry-editor-types";
import {
	EMPTY_FORM,
	type EntryData,
	type EntryForm,
	type EntryFormPatch,
	emptyFormOf,
	formFingerprint,
	formFromEntry,
	formText,
	isTranslationEntry,
	metadataFromForm,
	stringifyTranslation,
	TRANSLATION_FORM_KEY,
	translationPayload,
	translationSourceOf,
	translationStateFromForm,
} from "./entry-form";
import { backupKey } from "./local-backup";
import { entriesMessages } from "./messages";

// The entry editor's engine: the form against the server (baseline, draft, save) and the public value. Recovery copies and lifecycle commands live in their own modules.

/** The longest wait for Korean IME composition to end before a save. After that the composition marker is taken as stale and the save goes on. */
export const COMPOSITION_WAIT_MS = 1000;

/** The marker the view carries so `EntryEditorProvider` can find the engine behind a value `useEntryEditor` returned. */
export const ENTRY_EDITOR_CORE: unique symbol = Symbol("monti.entryEditorCore");

/** What a document says, without its block ids: two documents with the same key read the same. */
const contentKey = (doc: StoredDocument) => JSON.stringify(withoutBlockIds(doc.content));

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
	const tc = site.createTranslator(commonMessages);
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

	const m: EditorMutable = {
		entryId: null,
		version: 0,
		baseMetadata: {},
		translation: false,
		serverFingerprint: formFingerprint(site, emptyForm),
		changeSeq: 0,
		ackSeq: 0,
		inflight: null,
		composing: false,
		compositionWaiters: [],
		backupWrite: Promise.resolve(),
		pendingBackup: null,
		backupTimer: null,
		recoveryRecord: null,
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

	const ctx: EditorContext = {
		site,
		adminId,
		target,
		client,
		recoveryStore,
		t,
		tc,
		callbacks,
		emptyForm,
		m,
		state,
		commit,
	};
	const recovery = createRecovery(ctx);
	const { settle, persistBackup, cancelPendingBackup, flushPendingBackup, scheduleBackup, discardBackup } = recovery;

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
				const { entry: saved, warnings } =
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
					bodyWarnings: warnings,
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
					const error = toEditorError(caught, tc("saveFailed"));
					if (caught.status === 401) {
						commit({ saveError: error, saveStatus: "session-expired" });
						return failed(error);
					}
					if (isConflict(caught) && m.entryId) {
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
		await recovery.flushBeforeSave();
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
		return failed(state().saveError ?? { code: "failed", message: tc("saveFailed"), retryable: true });
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

	const restoreRecovery = recovery.restoreRecovery(applyForm);
	const { discardRecovery } = recovery;

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

	const { publish, changeStatus, duplicate, deletePermanently } = createLifecycle(ctx, {
		fillFromBody,
		save,
		fetchAndApply,
		recovery,
	});

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
			void recovery.open(m.generation, fetchAndApply);
		},
		stop: () => {
			m.generation += 1;
			void flushPendingBackup();
		},
		flushRecovery: flushPendingBackup,
	};
	return core;
}
