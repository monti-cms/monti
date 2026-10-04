import type { Entry, EntryStatus } from "./types";

/** 저장소가 바꾼 것의 종류. */
export type ContentChangeKind =
	| "created"
	| "saved"
	| "published"
	| "archived"
	| "unarchived"
	| "trashed"
	| "restored"
	| "deleted";

/**
 * 저장 뒤 알림(M14-7). 트랜잭션이 커밋된 뒤에만 온다(실패·충돌로 되돌린 변경은 오지 않는다).
 * 캐시 갱신·웹훅·검색 색인이 쓴다. 원문의 보관·휴지통·복원은 번역본도 함께 바꾸므로 `translationGroupId`로 묶음 전체를 다룬다.
 */
export interface ContentChange {
	readonly kind: ContentChangeKind;
	readonly entryId: string;
	readonly collection: string;
	readonly locale: string;
	readonly translationGroupId: string;
	/** 바뀐 뒤 상태. 지웠으면 마지막 상태다. */
	readonly status: EntryStatus;
	/** 공개 주소(공개본이 있으면). */
	readonly publishedSlug: string | null;
	/** 초안 주소. */
	readonly workingSlug: string | null;
}

export type AfterCommit = (change: ContentChange) => void | Promise<void>;

const changeOf = (kind: ContentChangeKind, entry: Entry): ContentChange => ({
	kind,
	entryId: entry.id,
	collection: entry.collection,
	locale: entry.locale,
	translationGroupId: entry.translationGroupId,
	status: entry.status,
	publishedSlug: entry.publishedSlug,
	workingSlug: entry.workingSlug,
});

/** 글을 돌려주는 변경과 그 알림 종류. */
const ENTRY_CHANGES = {
	createEntryWithReferences: "created",
	duplicateEntry: "created",
	saveWorkingWithReferences: "saved",
	publishEntry: "published",
	archiveEntry: "archived",
	unarchiveEntry: "unarchived",
	trashEntry: "trashed",
	restoreEntry: "restored",
} as const satisfies Record<string, ContentChangeKind>;

interface ChangingStore {
	getEntry(id: string): Promise<Entry>;
	permanentDeleteEntry(params: { id: string; expectedVersion: number }): Promise<void>;
}

/**
 * 저장소의 변경 함수가 커밋된 뒤 `afterCommit`을 부르게 감싼다. 알림이 실패해도 이미 커밋한 변경은 그대로이고 요청도 실패하지 않는다
 * (오류는 로그로만 남긴다).
 */
export function withAfterCommit<S extends ChangingStore>(store: S, afterCommit: AfterCommit): S {
	const notify = async (change: ContentChange) => {
		try {
			await afterCommit(change);
		} catch (error) {
			console.error("[cms] afterCommit failed", change.kind, change.entryId, error);
		}
	};
	const wrapped: Record<string, unknown> = { ...(store as unknown as Record<string, unknown>) };
	for (const [method, kind] of Object.entries(ENTRY_CHANGES)) {
		const original = (store as unknown as Record<string, unknown>)[method];
		if (typeof original !== "function") continue;
		wrapped[method] = async (...args: unknown[]) => {
			const entry = (await original.apply(store, args)) as Entry;
			await notify(changeOf(kind, entry));
			return entry;
		};
	}
	wrapped.permanentDeleteEntry = async (params: { id: string; expectedVersion: number }) => {
		const before = await store.getEntry(params.id).catch(() => null);
		await store.permanentDeleteEntry(params);
		if (before) await notify(changeOf("deleted", before));
	};
	return wrapped as unknown as S;
}
