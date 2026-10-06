import type { Entry, EntryStatus } from "./types";

/** Kind of change the store made. */
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
 * Post-save notification. Delivered only after the transaction commits (changes rolled back by failure or conflict are not reported).
 * Used by cache refresh, webhooks, and search indexing. Archiving, trashing, or restoring a source also changes its translations, so `translationGroupId` covers the whole group.
 */
export interface ContentChange {
	readonly kind: ContentChangeKind;
	readonly entryId: string;
	readonly collection: string;
	readonly locale: string;
	readonly translationGroupId: string;
	/** State after the change. For a deletion, the last state. */
	readonly status: EntryStatus;
	/** Public URL (if a published version exists). */
	readonly publishedSlug: string | null;
	/** Draft URL. */
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

/** Changes that return an entry, and their notification kinds. */
const ENTRY_CHANGES = {
	createEntryWithReferences: "created",
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
 * Wraps the store's mutation functions so `afterCommit` is called after the commit. If the notification fails, the committed change stays
 * and the request does not fail (the error is only logged).
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
