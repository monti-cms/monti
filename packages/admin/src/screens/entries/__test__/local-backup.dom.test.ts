import type { CmsConfig } from "@monti-cms/core";
import { createSite } from "@monti-cms/core/site";
import { beforeEach, describe, expect, it } from "vitest";
import { testConfig } from "../../../../../core/test/site";
import { type FakeIndexedDB, installFakeIndexedDB } from "../../../test/fake-indexed-db";
import { localRecoveryStoreOf } from "../entry-editor-client";
import {
	backupDatabaseName,
	deleteLocalBackup,
	getLocalBackup,
	type LocalBackupRecord,
	saveLocalBackup,
} from "../local-backup";

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
beforeEach(() => {
	idb = installFakeIndexedDB();
});

describe("browser recovery copy per site", () => {
	it("WRITE-R4 keeps two sites on one origin apart, even for the same key", async () => {
		await saveLocalBackup(record("u1:e1", "블로그"), blog);
		await saveLocalBackup(record("u1:e1", "상점"), shop);
		expect((await getLocalBackup("u1:e1", blog))?.snapshot).toEqual({ title: "블로그" });
		expect((await getLocalBackup("u1:e1", shop))?.snapshot).toEqual({ title: "상점" });
		await deleteLocalBackup("u1:e1", blog);
		expect(await getLocalBackup("u1:e1", blog)).toBeNull();
		expect(await getLocalBackup("u1:e1", shop)).not.toBeNull();
	});

	it("WRITE-W15 reports that recovery is unavailable when the browser has no IndexedDB", async () => {
		Reflect.deleteProperty(window, "indexedDB");
		expect(await saveLocalBackup(record("u1:e1"), blog)).toBe(false);
		expect(await getLocalBackup("u1:e1", blog)).toBeNull();
	});

	it("WRITE-R4 the recovery store of a site reads and writes that site's database", async () => {
		const store = localRecoveryStoreOf(shop);
		expect(await store.put(record("u1:e1") as never)).toBe(true);
		expect(idb.recordsOf(backupDatabaseName(shop))?.has("u1:e1")).toBe(true);
		expect(await store.get("u1:e1")).not.toBeNull();
		await store.delete("u1:e1");
		expect(await store.get("u1:e1")).toBeNull();
	});
});
