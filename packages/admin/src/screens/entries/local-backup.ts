import { cmsConfig } from "@monti-cms/core/client";

/**
 * 브라우저 복구본(§5.1). IndexedDB에 편집 중인 최신 입력을 남긴다.
 *
 * - 키는 `관리자 ID:콘텐츠 ID`(새 글은 `관리자 ID:new:컬렉션`)라 다른 계정의 복구본과 섞이지 않는다.
 * - 저장에 실패하면(사생활 보호 모드·저장 공간 거부 등) `false`를 돌려 화면이 복구 불가를 정확히 표시하게 한다.
 */

/** 복구본 DB 이름. IndexedDB는 사이트 주소(origin)마다 따로라 사이트 이름을 붙이지 않는다. */
const DB_NAME = "cms_backup";
/** 예전 DB 이름(사이트 설정 `admin.legacyBackupNames`). 이 이름으로 남은 복구본도 읽고 지운다(새로 만들지는 않는다). */
const LEGACY_DB_NAMES: readonly string[] = cmsConfig.admin?.legacyBackupNames ?? [];
const STORE_NAME = "backups";
const DB_VERSION = 1;

export interface LocalBackupRecord<Snapshot = Record<string, unknown>> {
	key: string;
	entryId: string;
	/** 복구본을 만들 때 기준으로 삼은 서버 버전. */
	baseVersion: number;
	baseFingerprint: string;
	localFingerprint: string;
	snapshot: Snapshot;
	changeSeq: number;
	savedAt: number;
}

export const backupKey = (adminId: string, entryId: string | null, collection: string) =>
	entryId ? `${adminId}:${entryId}` : `${adminId}:new:${collection}`;

/** DB를 연다. `create`가 거짓이면 없는 DB를 만들지 않고 실패한다(예전 DB 읽기). */
function openDB(name: string, create: boolean): Promise<IDBDatabase> {
	return new Promise((resolve, reject) => {
		if (typeof window === "undefined" || !window.indexedDB) {
			reject(new Error("IndexedDB not available"));
			return;
		}
		const request = window.indexedDB.open(name, DB_VERSION);
		request.onupgradeneeded = (event) => {
			// 처음 만드는 중인데 만들지 않을 DB면 되돌린다(만들던 DB도 남지 않는다).
			if (!create && event.oldVersion === 0) {
				request.transaction?.abort();
				return;
			}
			const db = request.result;
			if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME, { keyPath: "key" });
		};
		request.onsuccess = () => resolve(request.result);
		request.onerror = () => reject(request.error);
	});
}

async function run<T>(
	name: string,
	mode: IDBTransactionMode,
	action: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
	const db = await openDB(name, name === DB_NAME);
	return new Promise<T>((resolve, reject) => {
		const tx = db.transaction(STORE_NAME, mode);
		const request = action(tx.objectStore(STORE_NAME));
		tx.oncomplete = () => resolve(request.result);
		tx.onerror = () => reject(tx.error);
		tx.onabort = () => reject(tx.error);
	});
}

/** 복구본을 남긴다. 실패하면 `false`다. */
export async function saveLocalBackup(record: LocalBackupRecord): Promise<boolean> {
	try {
		await run(DB_NAME, "readwrite", (store) => store.put(record));
		return true;
	} catch {
		return false;
	}
}

export async function getLocalBackup<Snapshot = Record<string, unknown>>(
	key: string,
): Promise<LocalBackupRecord<Snapshot> | null> {
	for (const name of [DB_NAME, ...LEGACY_DB_NAMES]) {
		try {
			const record = (await run(name, "readonly", (store) => store.get(key))) as
				| LocalBackupRecord<Snapshot>
				| undefined;
			if (record) return record;
		} catch {
			// 이 DB를 쓸 수 없으면 다음 DB를 본다.
		}
	}
	return null;
}

export async function deleteLocalBackup(key: string): Promise<void> {
	for (const name of [DB_NAME, ...LEGACY_DB_NAMES]) {
		try {
			await run(name, "readwrite", (store) => store.delete(key));
		} catch {
			// 지우지 못한 복구본은 다음에 열 때 서버와 같으면 다시 지운다.
		}
	}
}
