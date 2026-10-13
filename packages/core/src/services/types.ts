export * from "../core/types";

import type { EntryStore, LifecycleStore } from "../core/store/ports";

/**
 * Minimum contract a business service requires from the store: a pick of the store ports (`core/store/ports.ts`), so a change to a port reaches the services at once.
 * `resolveLinkTargets` is optional: without it, links keep their address. The PostgreSQL implementation is `ContentStore`.
 */
export type StorePort = Pick<
	EntryStore,
	"getWorkingReferences" | "getWorking" | "publishEntry" | "createEntryWithReferences" | "saveWorkingWithReferences"
> &
	Pick<LifecycleStore, "archiveEntry" | "unarchiveEntry" | "trashEntry"> &
	Partial<Pick<EntryStore, "resolveLinkTargets">>;

/** What a restore needs from the store, on top of `StorePort`. A record is published again on restore, so it needs its prepared draft (`snapshot`). */
export type RestorePort = Pick<LifecycleStore, "restoreEntry">;
