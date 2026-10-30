import type { CmsConfig } from "@monti-cms/core";
import { createSite } from "@monti-cms/core/site";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { testConfig } from "../../../../../core/test/site";
import { localRecoveryStoreOf } from "../entry-editor-client";
import {
	backupDatabaseName,
	deleteLocalBackup,
	getLocalBackup,
	type LocalBackupRecord,
	saveLocalBackup,
} from "../local-backup";

/**
 * A small in-memory IndexedDB: databases by name, each with one object store of records keyed by `key`. It supports only what `local-backup.ts` uses
 * (open, one transaction with get, put and delete, and listing the databases where `listable`).
 */
class FakeIndexedDB {
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
}

const siteOf = (name: string) => createSite({ ...testConfig, site: { ...testConfig.site, name } } as CmsConfig);
const blog = siteOf("Blog");
const shop = siteOf("Shop");

const record = (key: string, title = "내용"): LocalBackupRecord => ({
	key,
	entryId: key.split(":")[1] ?? "x",
	baseVersion: 3,
	baseFingerprint: "base",
	localFingerprint: "local",
	snapshot: { title },
	changeSeq: 1,
	savedAt: 1_700_000_000_000,
});

let idb: FakeIndexedDB;
const install = (listable = true) => {
	idb = new FakeIndexedDB(listable);
	Object.defineProperty(window, "indexedDB", { value: idb, configurable: true });
};
beforeEach(() => install());
afterEach(() => {
	Reflect.deleteProperty(window, "indexedDB");
});

describe("browser recovery copy per site", () => {
	it("keeps a site's copies in a database named after the site and its admin path", async () => {
		expect(backupDatabaseName(blog)).toBe(`cms_backup:Blog${blog.ADMIN_PATH}`);
		await saveLocalBackup(record("u1:e1"), blog);
		expect(idb.recordsOf(backupDatabaseName(blog))?.has("u1:e1")).toBe(true);
	});

	it("keeps two sites on one origin apart, even for the same key", async () => {
		await saveLocalBackup(record("u1:e1", "블로그"), blog);
		await saveLocalBackup(record("u1:e1", "상점"), shop);
		expect((await getLocalBackup("u1:e1", blog))?.snapshot).toEqual({ title: "블로그" });
		expect((await getLocalBackup("u1:e1", shop))?.snapshot).toEqual({ title: "상점" });
		await deleteLocalBackup("u1:e1", blog);
		expect(await getLocalBackup("u1:e1", blog)).toBeNull();
		expect(await getLocalBackup("u1:e1", shop)).not.toBeNull();
	});

	it("reports that recovery is unavailable when the browser has no IndexedDB", async () => {
		Reflect.deleteProperty(window, "indexedDB");
		expect(await saveLocalBackup(record("u1:e1"), blog)).toBe(false);
		expect(await getLocalBackup("u1:e1", blog)).toBeNull();
	});

	it("the recovery store of a site reads and writes that site's database", async () => {
		const store = localRecoveryStoreOf(shop);
		expect(await store.put(record("u1:e1") as never)).toBe(true);
		expect(idb.recordsOf(backupDatabaseName(shop))?.has("u1:e1")).toBe(true);
		expect(await store.get("u1:e1")).not.toBeNull();
		await store.delete("u1:e1");
		expect(await store.get("u1:e1")).toBeNull();
	});
});
