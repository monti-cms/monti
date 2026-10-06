import { docOfText } from "../../../doc/__test__/doc-text";
import type { StoredDocument } from "../../../doc/stored-document";
import { createContentService } from "../../../services/content-service";
import type { PreparedSnapshot } from "../../types";
import type { ContentStore, Entry } from "..";

/**
 * Test setup helpers. They use the same write paths as production code (`createEntryWithReferences`, `saveWorkingWithReferences`)
 * but can insert raw values that skip snapshot validation (for tests that check only the store contract).
 */

type SeedInput = {
	collection: string;
	slug: string | null;
	metadata: unknown;
	/** The body as plain text (read by `docOfText`) unless `doc` is given. */
	text?: string;
	doc?: StoredDocument;
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
		doc: input.doc ?? docOfText(input.text ?? ""),
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
			text: input.text,
			doc: input.doc,
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
			doc: current.working.doc,
			schemaVersion: current.working.schemaVersion,
			contentHash: current.working.contentHash,
		}),
		references,
		folderId: params.folderId,
	});
}

/**
 * Publishes the saved draft the way production does: the draft goes through the write pipeline (no hooks) and the store commits the prepared snapshot.
 * The store does not prepare content, so a store test that publishes goes through here.
 */
export async function publishDraft(
	store: ContentStore,
	params: { id: string; expectedVersion: number; resetPublishedAt?: boolean },
): Promise<Entry> {
	return (await createContentService<Entry>(store).publish(params)).entry;
}

/** Restores a trashed entry the way production does (a record is prepared by the pipeline first). */
export function restoreDraft(store: ContentStore, params: { id: string; expectedVersion: number }): Promise<Entry> {
	return createContentService<Entry>(store).restore(params);
}

/** Duplicates a draft the way production does (through the write pipeline). */
export function duplicateDraft(store: ContentStore, params: { id: string; title?: string }): Promise<Entry> {
	return createContentService<Entry>(store).duplicate(params);
}
