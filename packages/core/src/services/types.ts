import type { PreparedSnapshot, Reference, WorkingCopy } from "../core/types";

export * from "../core/types";

/** Minimum contract a business service requires from the store. The PostgreSQL implementation is `ContentStore`. */
export interface StorePort<T = unknown> {
	getWorkingReferences(params: { entryId: string }): Promise<Reference[]>;
	getWorking(params: { entryId: string }): Promise<WorkingCopy>;
	/**
	 * The entries the addresses of internal body links (`/posts/slug`, default language) point to, as translation group ids. The write pipeline turns a
	 * link by address into a link by id with it. Without it, links keep their address.
	 */
	resolveLinkTargets?(params: {
		addresses: readonly { collection: string; slug: string }[];
	}): Promise<{ collection: string; slug: string; entryId: string }[]>;
	archiveEntry(params: { id: string; expectedVersion: number }): Promise<{ version: number }>;
	unarchiveEntry(params: { id: string; expectedVersion: number }): Promise<{ version: number }>;
	trashEntry(params: { id: string; expectedVersion: number }): Promise<{ version: number }>;
	/** Publishes the saved draft. `snapshot` is the draft as the write pipeline prepared it; the store only checks it against rows it locks. */
	publishEntry(params: {
		id: string;
		expectedVersion: number;
		snapshot: PreparedSnapshot;
		resetPublishedAt?: boolean;
	}): Promise<{ version: number }>;

	createEntryWithReferences(params: {
		snapshot: PreparedSnapshot;
		references: readonly Reference[];
		folderId?: string | null;
		publishImmediately?: boolean;
		locale?: string;
		translationOf?: string;
	}): Promise<T>;
	saveWorkingWithReferences(params: {
		entryId: string;
		expectedVersion: number;
		snapshot: PreparedSnapshot;
		references: readonly Reference[];
		folderId?: string | null;
		publishImmediately?: boolean;
		resetPublishedAt?: boolean;
	}): Promise<T>;
}

/** What a restore needs from the store, on top of `StorePort`. A record is published again on restore, so it needs its prepared draft (`snapshot`). */
export interface RestorePort<T = unknown> {
	restoreEntry(params: { id: string; expectedVersion: number; snapshot?: PreparedSnapshot }): Promise<T>;
}
