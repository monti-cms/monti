import type { Site } from "@monti-cms/core/site";
import { afterEach } from "vitest";
import { backupDatabaseName, type LocalBackupRecord } from "../screens/entries/local-backup";

/**
 * A small in-memory IndexedDB: databases by name, each with one object store of records keyed by `key`. It supports only what `local-backup.ts` uses
 * (open, one transaction with get, put and delete, and listing the databases where `listable`). jsdom has no IndexedDB, so screen tests install this
 * in place of the browser's and the recovery copy goes through the real `local-backup` module.
 */
export class FakeIndexedDB {
	readonly databases_ = new Map<string, Map<string, unknown>>();
	constructor(listable = true) {
		if (!listable) (this as { databases?: unknown }).databases = undefined;
	}
	databases() {
		return Promise.resolve([...this.databases_.keys()].map((name) => ({ name, version: 1 })));
	}
	open(name: string) {
		const request: Record<string, unknown> = {};
		queueMicrotask(() => {
			const created = !this.databases_.has(name);
			if (created) this.databases_.set(name, new Map());
			const records = this.databases_.get(name) as Map<string, unknown>;
			const db = {
				objectStoreNames: { contains: () => !created },
				createObjectStore: () => undefined,
				close: () => undefined,
				transaction: () => {
					const tx: Record<string, unknown> = {};
					const run = (work: () => unknown) => {
						const result: Record<string, unknown> = {};
						queueMicrotask(() => {
							result.result = work();
							queueMicrotask(() => (tx.oncomplete as (() => void) | undefined)?.());
						});
						return result;
					};
					tx.objectStore = () => ({
						get: (key: string) => run(() => records.get(key)),
						put: (record: { key: string }) => run(() => records.set(record.key, record)),
						delete: (key: string) => run(() => records.delete(key)),
					});
					return tx;
				},
			};
			request.result = db;
			if (created) (request.onupgradeneeded as (() => void) | undefined)?.();
			(request.onsuccess as (() => void) | undefined)?.();
		});
		return request;
	}
	recordsOf(name: string) {
		return this.databases_.get(name);
	}
	/** The recovery copy a site keeps under `key`, read straight from its database (`undefined` when there is none). */
	backupOf(site: Site, key: string): LocalBackupRecord | undefined {
		return this.recordsOf(backupDatabaseName(site))?.get(key) as LocalBackupRecord | undefined;
	}
	/** Puts a recovery copy in a site's database, as an earlier visit would have left it. */
	keep(site: Site, record: LocalBackupRecord) {
		const name = backupDatabaseName(site);
		if (!this.databases_.has(name)) this.databases_.set(name, new Map());
		this.databases_.get(name)?.set(record.key, record);
	}
}

/** Installs a fresh fake as `window.indexedDB` and removes it after the test. */
export function installFakeIndexedDB(listable = true): FakeIndexedDB {
	const idb = new FakeIndexedDB(listable);
	Object.defineProperty(window, "indexedDB", { value: idb, configurable: true });
	return idb;
}

afterEach(() => {
	Reflect.deleteProperty(window, "indexedDB");
});
