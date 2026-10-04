import type { PreparedSnapshot, Reference, WorkingCopy } from "../core/types";

export * from "../core/types";

/** Minimum contract a business service requires from the store. The PostgreSQL implementation is `ContentStore`. */
export interface StorePort<T = unknown> {
	getWorkingReferences(params: { entryId: string }): Promise<Reference[]>;
	getWorking(params: { entryId: string }): Promise<WorkingCopy>;
	archiveEntry(params: { id: string; expectedVersion: number }): Promise<{ version: number }>;
	unarchiveEntry(params: { id: string; expectedVersion: number }): Promise<{ version: number }>;
	trashEntry(params: { id: string; expectedVersion: number }): Promise<{ version: number }>;
	publishEntry(params: { id: string; expectedVersion: number }): Promise<{ version: number }>;

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
	}): Promise<T>;
}
