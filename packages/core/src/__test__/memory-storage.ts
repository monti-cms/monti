import type { StorageAdapter } from "../engine/types";

interface FileInfo {
	mime: string;
	size: number;
}

export interface MemoryStorage extends StorageAdapter {
	/** Puts a file in the storage as if it had been uploaded. */
	seed(key: string, info: FileInfo): void;
	/** The `ticket` calls in call order. */
	tickets: { key: string; info: FileInfo }[];
	/** The keys `remove` was called with, in call order. */
	removed: string[];
}

/** A storage adapter in memory for the tests: `url(key)` is `memory://<key>` and a ticket's url is `memory://upload/<key>`. */
export function createMemoryStorage(): MemoryStorage {
	const files = new Map<string, FileInfo>();
	const tickets: { key: string; info: FileInfo }[] = [];
	const removed: string[] = [];
	return {
		tickets,
		removed,
		seed: (key, info) => {
			files.set(key, info);
		},
		ticket: async (key, info) => {
			tickets.push({ key, info });
			return { url: `memory://upload/${key}`, headers: { "content-type": info.mime } };
		},
		stat: async (key) => files.get(key) ?? null,
		url: (key) => `memory://${key}`,
		remove: async (key) => {
			removed.push(key);
			files.delete(key);
		},
	};
}
