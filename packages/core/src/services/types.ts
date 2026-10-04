import type { PreparedSnapshot, Reference, WorkingCopy } from "../core/types";

export * from "../core/types";

/** 업무 서비스가 저장소에 요구하는 최소 계약. PostgreSQL 구현은 `ContentStore`다. */
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
