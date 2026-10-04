"use client";

import { adminEntryEditHref, cmsApiUrl, withBasePath } from "@monti-cms/core/client";
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

/** 브라우저 임시 저장은 입력이 멈추고 이만큼 지나면 마지막 상태 하나를 남긴다(입력마다 쓰지 않는다). */
export const BACKUP_IDLE_MS = 5000;
/** 저장 전에 한글 조합이 끝나기를 기다리는 최대 시간. 지나면 조합 표시가 남은 것으로 보고 그냥 저장한다. */
export const COMPOSITION_WAIT_MS = 1000;
/** 저장 전에 브라우저 임시 저장을 기다리는 최대 시간. 브라우저 저장소가 멈춰도 서버 저장은 간다. */
const BACKUP_WAIT_MS = 1500;

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** §5.1 저장 상태. */
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
	/** 불러온 항목. 새 글이면 `null`이고 명시적으로 저장하거나 발행할 때 만든다. */
	entry: EntryData | null;
	initialForm: EntryForm;
	/** 휴지통처럼 저장하면 안 되는 상태면 false다. */
	enabled: boolean;
	/** 새 글을 처음 저장할 때 넣을 폴더(목록에서 연 위치). */
	newEntryFolderId?: string | null;
	onSaved: (entry: EntryData) => void;
	onConflict: (server: EntryData, local: EntryForm) => void;
}

/**
 * 편집 중에는 브라우저 복구본만 남기고, 명시적 저장·발행 시 서버 초안을 저장한다.
 *
 * - 복구본은 입력이 멈추고 `BACKUP_IDLE_MS`가 지나면 마지막 상태로 남긴다(브라우저에만, 서버에는 보내지 않는다).
 *   화면을 떠나거나 탭을 숨기거나 저장 버튼을 누르면 기다리지 않고 바로 남긴다.
 * - 요청은 한 번에 하나다. 전송 중 새 입력은 다음 명시적 저장 때 보낸다.
 * - 네트워크·서버 오류가 나도 복구본을 남긴다. 재시도는 사용자가 누를 때만 보낸다.
 * - 세션이 만료되면 복구본을 유지하고 다시 로그인하게 안내한다.
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
}: Options) {
	const [form, setFormState] = useState<EntryForm>(initialForm);
	const [status, setStatus] = useState<SaveStatus>(entry ? "saved" : "new");
	const [lastError, setLastErrorState] = useState<string | null>(null);
	/** 저장 직후 같은 함수 안에서 이유를 읽을 수 있게 ref에도 둔다(렌더 값은 한 박자 늦다). */
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
	/** 번역본은 언어별 값만 저장한다(v2 B4). */
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
	const callbacksRef = useRef({ onSaved, onConflict });
	callbacksRef.current = { onSaved, onConflict };

	const updateStatus = useCallback((next: SaveStatus) => {
		statusRef.current = next;
		setStatus(next);
	}, []);

	const queueBackup = useCallback((task: () => Promise<void>) => {
		backupWriteRef.current = backupWriteRef.current.then(task, task);
		return backupWriteRef.current;
	}, []);

	/** 불러오기·재적재 뒤 기준값을 서버 값으로 맞춘다. */
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
	/** 기다리는 복구본을 지금 남긴다. */
	const flushPendingBackup = useCallback(() => {
		const pending = pendingBackupRef.current;
		cancelPendingBackup();
		if (pending) void persistBackup(pending.snapshot, pending.changeSeq);
		return backupWriteRef.current;
	}, [cancelPendingBackup, persistBackup]);
	const scheduleBackup = useCallback(
		(snapshot: EntryForm, changeSeq: number) => {
			pendingBackupRef.current = { snapshot, changeSeq };
			// 입력이 이어지면 다시 센다. 멈추고 나서야 남긴다.
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

	/** 한글 조합이 끝나기를 기다린다. 끝 신호가 오지 않으면(입력칸이 조합 중에 사라진 경우 등) 표시를 지우고 넘어간다. */
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
		// 조합 중 저장은 글자 누락을 만든다. 저장 경로(`flush`·`retry`)는 조합이 끝나기를 먼저 기다린다.
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
							mdx: snapshot.mdx,
							...(translationPayload(snapshot) ? { translation: translationPayload(snapshot) } : {}),
						},
						fallback: t("saveFailed"),
					},
				);
				if (isNew) {
					entryIdRef.current = saved.id;
					// 화면을 다시 마운트하지 않고 주소만 편집 주소로 바꾼다.
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
						// 형식·검증 오류는 다시 보내도 같다. 입력을 고치면 다음 저장이 다시 시도한다.
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

	/** 사용자가 재시도를 누르면 서버 버전을 먼저 확인하고 다시 저장한다. */
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

	/** 폼 일부를 바꾼다. 변경사항은 브라우저에만 남긴다. */
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

	/** 명시적으로 저장하거나 발행할 때만 서버에 보낸다. */
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

	// 화면을 떠나거나 탭을 숨기면 기다리던 복구본을 바로 남긴다.
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

	// 서버에 저장되지 않은 변경이 있으면 페이지 이탈을 경고한다.
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
		/** 충돌 해결에서 “내 내용으로 덮어쓰기”를 고른 경우 서버 버전을 기준으로 다시 저장한다. */
		overwriteWithLocal: (serverVersion: number) => {
			versionRef.current = serverVersion;
			updateStatus("dirty");
			changeSeqRef.current += 1;
			return performSave();
		},
		getEntryId: () => entryIdRef.current,
		/** 마지막 저장 실패 이유와 저장 상태(렌더를 기다리지 않은 최신 값). */
		getLastError: () => lastErrorRef.current,
		getStatus: () => statusRef.current,
		getVersion: () => versionRef.current,
		setVersion: (version: number) => {
			versionRef.current = version;
		},
		hasPendingChanges: () => changeSeqRef.current > ackSeqRef.current,
	};
}
