import type { ContentChangeKind } from "./events";
import type { Entry } from "./types";

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
	permanentDeleteEntry(params: { id: string; expectedVersion: number }): Promise<void>;
}

/**
 * Wraps the store's mutation functions so `dispatch` is called with the entry id after each commit. The store has already written the events of the change
 * in its own transaction (the outbox), so `dispatch` only delivers them. If it throws, the committed change stays and the request does not fail (the
 * error is logged), and the undelivered events are found by the next retry.
 */
export function withEventDispatch<S extends ChangingStore>(store: S, dispatch: (entryId: string) => Promise<void>): S {
	const notify = async (entryId: string) => {
		try {
			await dispatch(entryId);
		} catch (error) {
			console.error("[cms] event delivery failed", entryId, error);
		}
	};
	// A proxy, not a copy: the store may itself be a proxy that answers any name (the lazy adapter store), which a spread would not see.
	const overrides = new Map<PropertyKey, unknown>();
	for (const method of Object.keys(ENTRY_CHANGES)) {
		const original = (store as unknown as Record<string, unknown>)[method];
		if (typeof original !== "function") continue;
		overrides.set(method, async (...args: unknown[]) => {
			const entry = (await original.apply(store, args)) as Entry;
			await notify(entry.id);
			return entry;
		});
	}
	const deleteEntry = store.permanentDeleteEntry;
	if (typeof deleteEntry === "function") {
		overrides.set("permanentDeleteEntry", async (params: { id: string; expectedVersion: number }) => {
			await deleteEntry.call(store, params);
			await notify(params.id);
		});
	}
	return new Proxy(store, {
		get: (target, name) => (overrides.has(name) ? overrides.get(name) : Reflect.get(target, name)),
	});
}
