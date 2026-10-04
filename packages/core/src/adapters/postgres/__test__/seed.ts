import type { PreparedSnapshot } from "../../../core/types";
import type { ContentStore, Entry } from "../content-store";

/**
 * 테스트 준비용 도우미. 운영 코드와 같은 쓰기 경로(`createEntryWithReferences`·`saveWorkingWithReferences`)를
 * 쓰되, 스냅샷 검증을 거치지 않은 원시 값을 넣을 수 있다(저장소 계약만 시험하는 테스트용).
 */

type SeedInput = {
	collection: string;
	slug: string | null;
	metadata: unknown;
	mdx: string;
	schemaVersion?: number;
	contentHash?: string;
	folderId?: string | null;
};

const rawSnapshot = (input: Omit<SeedInput, "folderId">): PreparedSnapshot =>
	({
		collection: input.collection,
		slug: input.slug,
		metadata: input.metadata,
		mdx: input.mdx,
		schemaVersion: input.schemaVersion ?? 1,
		contentHash: input.contentHash ?? `seed-${Math.random().toString(36).slice(2)}`,
		references: [],
		issues: [],
		imageSources: [],
	}) as unknown as PreparedSnapshot;

/** 참조 없이 초안을 만든다. */
export function seedEntry(store: ContentStore, input: SeedInput): Promise<Entry> {
	const { folderId, ...rest } = input;
	return store.createEntryWithReferences({ snapshot: rawSnapshot(rest), references: [], folderId });
}

/** 참조 인덱스는 그대로 두고 초안 본문·slug만 바꾼다. */
export async function seedSave(
	store: ContentStore,
	entryId: string,
	input: Omit<SeedInput, "collection" | "slug"> & { expectedVersion: number; slug?: string | null },
): Promise<Entry> {
	const current = await store.getEntry(entryId);
	const references = await store.getWorkingReferences({ entryId });
	return store.saveWorkingWithReferences({
		entryId,
		expectedVersion: input.expectedVersion,
		snapshot: rawSnapshot({
			collection: current.collection,
			slug: input.slug !== undefined ? input.slug : current.workingSlug,
			metadata: input.metadata,
			mdx: input.mdx,
			schemaVersion: input.schemaVersion,
			contentHash: input.contentHash,
		}),
		references,
		...(input.folderId !== undefined ? { folderId: input.folderId } : {}),
	});
}

/** 본문은 그대로 두고 폴더만 옮긴다(운영의 일괄 `folder.move`와 같은 경로). */
export async function moveToFolder(
	store: ContentStore,
	params: { entryId: string; folderId: string | null; expectedVersion: number },
): Promise<Entry> {
	const current = await store.getEntry(params.entryId);
	const references = await store.getWorkingReferences({ entryId: params.entryId });
	return store.saveWorkingWithReferences({
		entryId: params.entryId,
		expectedVersion: params.expectedVersion,
		snapshot: rawSnapshot({
			collection: current.collection,
			slug: current.workingSlug,
			metadata: current.working.metadata,
			mdx: current.working.mdx,
			schemaVersion: current.working.schemaVersion,
			contentHash: current.working.contentHash,
		}),
		references,
		folderId: params.folderId,
	});
}
