import type { PreparedSnapshot } from "../../../core/types";
import type { ContentStore, Entry } from "../content-store";

/**
 * Test setup helpers. They use the same write paths as production code (`createEntryWithReferences`, `saveWorkingWithReferences`)
 * but can insert raw values that skip snapshot validation (for tests that check only the store contract).
 */

type SeedInput = {
	collection: string;
	slug: string | null;
	metadata: unknown;
	mdx: string;
	schemaVersion?: number;
	contentHash?: string;
	folderId?: string | null;
	locale?: string;
};

const rawSnapshot = (input: Omit<SeedInput, "folderId" | "locale">): PreparedSnapshot =>
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

/** Creates a draft without references. */
export function seedEntry(store: ContentStore, input: SeedInput): Promise<Entry> {
	const { folderId, locale, ...rest } = input;
	return store.createEntryWithReferences({ snapshot: rawSnapshot(rest), references: [], folderId, locale });
}

/** Changes only the draft body and slug, leaving the reference index as is. */
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

/** Moves only the folder, leaving the body as is (same path as production's bulk `folder.move`). */
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
