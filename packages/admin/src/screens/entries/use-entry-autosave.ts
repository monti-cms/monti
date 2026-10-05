"use client";

import { adminEntryEditHref, cmsApiUrl, withBasePath } from "@monti-cms/core/client";
import type { StoredDocument } from "@monti-cms/core/mdx";
import { useCallback, useEffect, useRef, useState } from "react";
import { CmsApiError, cmsFetch } from "../admin-api";
import {
	type EntryData,
	type EntryForm,
	type EntryFormPatch,
	formFingerprint,
	isTranslationEntry,
	metadataFromForm,
	translationPayload,
} from "./entry-form";
import { backupKey, deleteLocalBackup, saveLocalBackup } from "./local-backup";
import { t } from "./translate";

/** Browser temporary save keeps the last state once input has paused this long (not written on every input). */
export const BACKUP_IDLE_MS = 5000;
/** Maximum time to wait for Korean IME composition to end before saving. After that, the composition marker is assumed stale and it saves anyway. */
export const COMPOSITION_WAIT_MS = 1000;
/** Maximum time to wait for the browser temporary save before saving. The server save goes through even if browser storage stalls. */
const BACKUP_WAIT_MS = 1500;

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Save status. */
export type SaveStatus =
	| "new"
	| "saved"
	| "dirty"
	| "saving"
	| "local-only"
	| "failed"
	| "conflict"
	| "session-expired";

export const SAVE_STATUS_LABELS: Record<SaveStatus, string> = {
	new: t("save.new"),
	saved: t("save.saved"),
	dirty: t("save.dirty"),
	saving: t("save.saving"),
	"local-only": t("save.local-only"),
	failed: t("save.failed"),
	conflict: t("save.conflict"),
	"session-expired": t("save.session-expired"),
};

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
	/**
	 * The stored document of a body, with the editor's block ids, when the editor made exactly that MDX. The save then sends the document
	 * (`doc`) instead of the MDX, so every block keeps its id; otherwise the MDX is sent and the server pairs blocks with the stored body.
	 */
	documentOf?: (mdx: string) => StoredDocument | null | undefined;
}

/** The body of a save request: the editor's document when it made this MDX, otherwise the MDX. */
const bodyPayload = (mdx: string, doc: StoredDocument | null | undefined): { mdx: string } | { doc: StoredDocument } =>
	doc ? { doc } : { mdx };

/**
 * While editing, only a browser recovery copy is kept; an explicit save or publish saves the server draft.
 *
 * - The recovery copy is kept as the last state once input pauses and `BACKUP_IDLE_MS` passes (browser only, never sent to the server).
 *   It is kept right away, without waiting, when leaving the screen, hiding the tab or pressing save.
 * - One request at a time. Input during a send goes out on the next explicit save.
 * - The recovery copy is kept even on a network or server error. Retries are sent only when the user presses retry.
 * - If the session expires, the recovery copy is kept and the user is guided to sign in again.
 */
export function useEntryAutosave({
	adminId,
	collection,
	entry,
	initialForm,
	enabled,
	newEntryFolderId,
	onSaved,
	onConflict,
	documentOf,
}: Options) {
	const [form, setFormState] = useState<EntryForm>(initialForm);
	const [status, setStatus] = useState<SaveStatus>(entry ? "saved" : "new");
	const [lastError, setLastErrorState] = useState<string | null>(null);
	/** Also held in a ref so the reason can be read in the same function right after saving (the render value lags one tick). */
	const lastErrorRef = useRef<string | null>(null);
	const setLastError = useCallback((message: string | null) => {
		lastErrorRef.current = message;
		setLastErrorState(message);
	}, []);
	const [backupAvailable, setBackupAvailable] = useState(true);

	const formRef = useRef(initialForm);
	const entryIdRef = useRef<string | null>(entry?.id ?? null);
	const versionRef = useRef(entry?.version ?? 0);
	const baseMetadataRef = useRef<Record<string, unknown>>(entry?.working.metadata ?? {});
	/** A translation saves only per-language values. */
	const translationRef = useRef(isTranslationEntry(entry));
	const serverFingerprintRef = useRef(formFingerprint(initialForm));
	const changeSeqRef = useRef(0);
	const ackSeqRef = useRef(0);
	const inflightRef = useRef<Promise<boolean> | null>(null);
	const composingRef = useRef(false);
	const compositionWaitersRef = useRef<Array<() => void>>([]);
	const backupWriteRef = useRef<Promise<void>>(Promise.resolve());
	const statusRef = useRef<SaveStatus>(entry ? "saved" : "new");
	const enabledRef = useRef(enabled);
	enabledRef.current = enabled;
	const callbacksRef = useRef({ onSaved, onConflict, documentOf });
	callbacksRef.current = { onSaved, onConflict, documentOf };

	const updateStatus = useCallback((next: SaveStatus) => {
		statusRef.current = next;
		setStatus(next);
	}, []);

	const queueBackup = useCallback((task: () => Promise<void>) => {
		backupWriteRef.current = backupWriteRef.current.then(task, task);
		return backupWriteRef.current;
	}, []);

	/** After load or reload, sets the baseline to the server value. */
	const resetFromServer = useCallback(
		(loaded: EntryData, loadedForm: EntryForm) => {
			entryIdRef.current = loaded.id;
			versionRef.current = loaded.version;
			baseMetadataRef.current = loaded.working.metadata ?? {};
			translationRef.current = isTranslationEntry(loaded);
			serverFingerprintRef.current = formFingerprint(loadedForm);
			formRef.current = loadedForm;
			setFormState(loadedForm);
			changeSeqRef.current = 0;
			ackSeqRef.current = 0;
			setLastError(null);
			updateStatus("saved");
		},
		[updateStatus, setLastError],
	);

	const currentKey = () => backupKey(adminId, entryIdRef.current, collection);
	const persistBackup = useCallback(
		(snapshot: EntryForm, changeSeq: number) => {
			const key = backupKey(adminId, entryIdRef.current, collection);
			const record = {
				key,
				entryId: entryIdRef.current ?? "new",
				baseVersion: versionRef.current,
				baseFingerprint: serverFingerprintRef.current,
				localFingerprint: formFingerprint(snapshot),
				snapshot: snapshot as unknown as Record<string, unknown>,
				changeSeq,
				savedAt: Date.now(),
			};
			return queueBackup(async () => setBackupAvailable(await saveLocalBackup(record)));
		},
		[adminId, collection, queueBackup],
	);
	const pendingBackupRef = useRef<{ snapshot: EntryForm; changeSeq: number } | null>(null);
	const backupTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const cancelPendingBackup = useCallback(() => {
		if (backupTimerRef.current) clearTimeout(backupTimerRef.current);
		backupTimerRef.current = null;
		pendingBackupRef.current = null;
	}, []);
	/** Keeps the pending recovery copy now. */
	const flushPendingBackup = useCallback(() => {
		const pending = pendingBackupRef.current;
		cancelPendingBackup();
		if (pending) void persistBackup(pending.snapshot, pending.changeSeq);
		return backupWriteRef.current;
	}, [cancelPendingBackup, persistBackup]);
	const scheduleBackup = useCallback(
		(snapshot: EntryForm, changeSeq: number) => {
			pendingBackupRef.current = { snapshot, changeSeq };
			// If input continues, count again. It is kept only after it stops.
			if (backupTimerRef.current) clearTimeout(backupTimerRef.current);
			backupTimerRef.current = setTimeout(flushPendingBackup, BACKUP_IDLE_MS);
		},
		[flushPendingBackup],
	);
	const discardBackup = useCallback(
		(key: string) => {
			cancelPendingBackup();
			return queueBackup(() => deleteLocalBackup(key));
		},
		[cancelPendingBackup, queueBackup],
	);

	/** Waits for Korean IME composition to end. If no end signal comes (e.g. the input vanished mid-composition), clears the marker and moves on. */
	const waitForComposition = useCallback(async () => {
		if (!composingRef.current) return;
		await Promise.race([
			new Promise<void>((resolve) => compositionWaitersRef.current.push(resolve)),
			wait(COMPOSITION_WAIT_MS),
		]);
		composingRef.current = false;
	}, []);

	// biome-ignore lint/correctness/useExhaustiveDependencies: save loop reads refs; explicit save is invoked from current render
	const performSave = useCallback((): Promise<boolean> => {
		if (inflightRef.current) return inflightRef.current;
		if (!enabledRef.current) return Promise.resolve(false);
		if (statusRef.current === "conflict") return Promise.resolve(false);
		if (entryIdRef.current && changeSeqRef.current <= ackSeqRef.current) {
			if (statusRef.current !== "session-expired") updateStatus("saved");
			return Promise.resolve(true);
		}
		// Saving during composition drops characters. The save paths (`flush`, `retry`) first wait for composition to end.
		if (composingRef.current) {
			setLastError(t("save.composing"));
			return Promise.resolve(false);
		}

		const targetSeq = changeSeqRef.current;
		const snapshot = formRef.current;
		const built = metadataFromForm(snapshot, collection, baseMetadataRef.current, {
			translation: translationRef.current,
		});
		if ("error" in built) {
			setLastError(built.error);
			updateStatus("failed");
			return Promise.resolve(false);
		}
		updateStatus("saving");

		const request = (async (): Promise<boolean> => {
			try {
				const isNew = !entryIdRef.current;
				const newKey = backupKey(adminId, null, collection);
				const saved = await cmsFetch<EntryData>(
					isNew ? cmsApiUrl("/v1/entries") : cmsApiUrl(`/v1/entries/${entryIdRef.current}`),
					{
						method: isNew ? "POST" : "PATCH",
						json: {
							...(isNew
								? { collection, ...(newEntryFolderId ? { folderId: newEntryFolderId } : {}) }
								: { expectedVersion: versionRef.current }),
							slug: snapshot.slug.trim() || null,
							metadata: built.metadata,
							...bodyPayload(snapshot.mdx, callbacksRef.current.documentOf?.(snapshot.mdx)),
							...(translationPayload(snapshot) ? { translation: translationPayload(snapshot) } : {}),
						},
						fallback: t("saveFailed"),
					},
				);
				if (isNew) {
					entryIdRef.current = saved.id;
					// Change only the URL to the edit URL without remounting the screen.
					window.history.replaceState({ ...window.history.state }, "", withBasePath(adminEntryEditHref(saved.id)));
				}
				versionRef.current = saved.version;
				baseMetadataRef.current = saved.working?.metadata ?? built.metadata;
				serverFingerprintRef.current = formFingerprint(snapshot);
				ackSeqRef.current = targetSeq;
				setLastError(null);
				callbacksRef.current.onSaved(saved);

				if (formFingerprint(formRef.current) === serverFingerprintRef.current) {
					ackSeqRef.current = changeSeqRef.current;
					updateStatus("saved");
					await discardBackup(currentKey());
				} else {
					updateStatus("dirty");
					cancelPendingBackup();
					await persistBackup(formRef.current, changeSeqRef.current);
				}
				if (isNew) await discardBackup(newKey);
				return true;
			} catch (error) {
				if (error instanceof CmsApiError) {
					if (error.status === 401) {
						setLastError(error.message);
						updateStatus("session-expired");
						return false;
					}
					if (error.status === 409 && error.code === "conflict" && entryIdRef.current) {
						updateStatus("conflict");
						const server = await cmsFetch<EntryData>(cmsApiUrl(`/v1/entries/${entryIdRef.current}`)).catch(() => null);
						if (server) callbacksRef.current.onConflict(server, snapshot);
						return false;
					}
					if (error.status < 500) {
						// Format and validation errors are the same on resend. Fixing the input makes the next save try again.
						setLastError(error.message);
						updateStatus("failed");
						return false;
					}
				}
				setLastError(error instanceof CmsApiError ? error.message : t("save.offline"));
				updateStatus(backupAvailable ? "local-only" : "failed");
				return false;
			} finally {
				inflightRef.current = null;
			}
		})();
		inflightRef.current = request;
		return request;
	}, [
		adminId,
		collection,
		backupAvailable,
		cancelPendingBackup,
		discardBackup,
		newEntryFolderId,
		persistBackup,
		updateStatus,
	]);

	/** When the user presses retry, checks the server version first and saves again. */
	const retry = useCallback(
		async (verify = true): Promise<boolean> => {
			if (verify && entryIdRef.current) {
				try {
					const server = await cmsFetch<EntryData>(cmsApiUrl(`/v1/entries/${entryIdRef.current}`));
					if (server.version !== versionRef.current) {
						updateStatus("conflict");
						callbacksRef.current.onConflict(server, formRef.current);
						return false;
					}
				} catch (error) {
					if (error instanceof CmsApiError && error.status === 401) {
						updateStatus("session-expired");
						return false;
					}
					updateStatus(backupAvailable ? "local-only" : "failed");
					return false;
				}
			}
			if (statusRef.current === "session-expired") updateStatus("dirty");
			await waitForComposition();
			return performSave();
		},
		[backupAvailable, performSave, updateStatus, waitForComposition],
	);

	/** Changes part of the form. Changes are kept in the browser only. */
	const setForm = useCallback(
		(patch: EntryFormPatch) => {
			const next = { ...formRef.current, ...patch };
			const fingerprint = formFingerprint(next);
			if (fingerprint === formFingerprint(formRef.current)) return;
			formRef.current = next;
			setFormState(next);
			changeSeqRef.current += 1;
			if (!inflightRef.current && fingerprint === serverFingerprintRef.current) {
				ackSeqRef.current = changeSeqRef.current;
				if (statusRef.current !== "conflict" && statusRef.current !== "session-expired") {
					updateStatus(entryIdRef.current ? "saved" : "new");
				}
				void discardBackup(backupKey(adminId, entryIdRef.current, collection));
				return;
			}
			if (statusRef.current !== "conflict" && statusRef.current !== "session-expired") updateStatus("dirty");
			scheduleBackup(next, changeSeqRef.current);
		},
		[adminId, collection, discardBackup, scheduleBackup, updateStatus],
	);

	/** Sent to the server only on explicit save or publish. */
	const flush = useCallback(async (): Promise<boolean> => {
		await Promise.race([flushPendingBackup(), wait(BACKUP_WAIT_MS)]);
		await waitForComposition();
		for (let attempt = 0; attempt < 5; attempt++) {
			if (inflightRef.current) await inflightRef.current;
			if (entryIdRef.current && changeSeqRef.current <= ackSeqRef.current) return true;
			if (!(await performSave())) return false;
		}
		return Boolean(entryIdRef.current && changeSeqRef.current <= ackSeqRef.current);
	}, [flushPendingBackup, performSave, waitForComposition]);

	// When leaving the screen or hiding the tab, keep the pending recovery copy right away.
	useEffect(() => {
		const onHide = () => {
			if (document.visibilityState === "hidden") void flushPendingBackup();
		};
		const onPageHide = () => void flushPendingBackup();
		document.addEventListener("visibilitychange", onHide);
		window.addEventListener("pagehide", onPageHide);
		return () => {
			document.removeEventListener("visibilitychange", onHide);
			window.removeEventListener("pagehide", onPageHide);
			void flushPendingBackup();
		};
	}, [flushPendingBackup]);

	const setComposing = useCallback((composing: boolean) => {
		composingRef.current = composing;
		if (!composing) {
			for (const resolve of compositionWaitersRef.current.splice(0)) resolve();
		}
	}, []);

	// Warn on page leave if there are changes not saved to the server.
	useEffect(() => {
		if (status === "saved" || status === "new") return;
		const warn = (event: BeforeUnloadEvent) => {
			event.preventDefault();
			event.returnValue = "";
		};
		window.addEventListener("beforeunload", warn);
		return () => window.removeEventListener("beforeunload", warn);
	}, [status]);

	return {
		form,
		status,
		lastError,
		backupAvailable,
		setForm,
		flush,
		retry,
		setComposing,
		resetFromServer,
		/** If "overwrite with mine" is chosen in conflict resolution, saves again based on the server version. */
		overwriteWithLocal: (serverVersion: number) => {
			versionRef.current = serverVersion;
			updateStatus("dirty");
			changeSeqRef.current += 1;
			return performSave();
		},
		getEntryId: () => entryIdRef.current,
		/** Reason for the last save failure and the save status (latest values, without waiting for a render). */
		getLastError: () => lastErrorRef.current,
		getStatus: () => statusRef.current,
		getVersion: () => versionRef.current,
		setVersion: (version: number) => {
			versionRef.current = version;
		},
		hasPendingChanges: () => changeSeqRef.current > ackSeqRef.current,
	};
}
