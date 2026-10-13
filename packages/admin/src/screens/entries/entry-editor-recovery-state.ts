import type { Site } from "@monti-cms/core/client";
import { readStoredDocument } from "@monti-cms/core/document";
import type { RecoveryRecord } from "./entry-editor-client";
import { failureOf, wait } from "./entry-editor-results";
import type { EditorContext } from "./entry-editor-types";
import { type EntryData, type EntryForm, type EntryFormPatch, formFingerprint } from "./entry-form";
import { backupKey } from "./local-backup";

// The entry editor's browser recovery copy: when it is written, how a save waits for it, and what is offered when an entry opens.

/** The browser recovery copy is kept once input has paused this long (not written on every input). */
export const RECOVERY_IDLE_MS = 5000;
/** The longest wait for the browser recovery copy before a save. The server save goes through even if browser storage stalls. */
const RECOVERY_WAIT_MS = 1500;

/**
 * The recovery copy with its body checked and lifted to the current document version, and its fingerprint worked out again so it compares with the form the way the
 * editor makes it. A copy without a readable body is not offered.
 */
function checkedRecovery(site: Site, record: RecoveryRecord): RecoveryRecord | null {
	const doc = readStoredDocument((record.snapshot as { doc?: unknown }).doc, site);
	if (!doc) return null;
	const snapshot = { ...record.snapshot, doc } as EntryForm;
	return { ...record, snapshot, localFingerprint: formFingerprint(site, snapshot) };
}

export function createRecovery(ctx: EditorContext) {
	const { site, adminId, target, t, recoveryStore, m, state, commit } = ctx;

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

	/** A save starts by writing the waiting recovery copy, without waiting long for it. */
	const flushBeforeSave = async () => {
		await Promise.race([flushPendingBackup(), wait(RECOVERY_WAIT_MS)]);
	};

	const restoreRecovery = (applyForm: (patch: EntryFormPatch) => void) => () => {
		const record = m.recoveryRecord;
		if (!record) return;
		m.recoveryRecord = null;
		commit({ slugTouched: true, recovery: null });
		applyForm({ ...ctx.emptyForm, ...record.snapshot });
	};

	const discardRecovery = async () => {
		const record = m.recoveryRecord;
		m.recoveryRecord = null;
		if (record) await queueBackup(() => safely(() => recoveryStore.delete(record.key), undefined));
		commit({ recovery: null });
	};

	const offerRecovery = (record: RecoveryRecord, server?: EntryData) => {
		m.recoveryRecord = record;
		commit({
			recovery: { kind: server ? "conflict" : "restore", savedAt: record.savedAt, ...(server ? { server } : {}) },
		});
	};

	/** Opens the entry: loads it (or starts a new one) and compares the server's value with the browser recovery copy. */
	const open = async (
		generation: number,
		fetchAndApply: (id: string, alive: () => boolean) => Promise<EntryData | null>,
	) => {
		const alive = () => generation === m.generation;
		if (target.mode === "new") {
			if (site.isItemCollection(target.collection)) return;
			const stored = await safely(() => recoveryStore.get(backupKey(adminId, null, target.collection)), null);
			const backup = stored && checkedRecovery(site, stored);
			if (alive() && backup && backup.localFingerprint !== backup.baseFingerprint) offerRecovery(backup);
			return;
		}
		commit({ load: { status: "loading" } });
		try {
			const loaded = await fetchAndApply(target.entryId, alive);
			if (!loaded || !alive()) return;
			const key = backupKey(adminId, loaded.id, loaded.collection);
			const stored = await safely(() => recoveryStore.get(key), null);
			const backup = stored && checkedRecovery(site, stored);
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

	return {
		safely,
		settle,
		queueBackup,
		persistBackup,
		cancelPendingBackup,
		flushPendingBackup,
		scheduleBackup,
		discardBackup,
		flushBeforeSave,
		restoreRecovery,
		discardRecovery,
		open,
	};
}

export type Recovery = ReturnType<typeof createRecovery>;
