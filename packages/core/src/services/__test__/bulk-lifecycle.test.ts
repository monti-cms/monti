import { describe, expect, it } from "vitest";
import { createBulkService } from "../bulk-service";
import type { Reference } from "../index";
import { ServiceError } from "../index";

/** TW-1b: 일괄 상태 변경. */

type EntryState = {
	version: number;
	status: "draft" | "published" | "archived" | "trashed";
	brokenRef?: boolean;
	usedBy?: { entryId: string; title: string | null; collection: string; state: string }[];
};

/** 저장소의 `CmsError`처럼 `code`와 `details`를 가진 오류. */
class FakeStoreError extends Error {
	constructor(
		public readonly code: string,
		public readonly details?: unknown,
	) {
		super(code);
	}
}

const newFakeLifecycleStore = (seed: Record<string, EntryState>) => {
	const entries = new Map<string, EntryState>(Object.entries(seed));
	const bump = (entryId: string, expectedVersion: number, status: EntryState["status"]) => {
		const found = entries.get(entryId);
		if (!found) throw new ServiceError("not_found");
		if (expectedVersion !== found.version) throw new ServiceError("conflict");
		if (status === "published" && found.brokenRef) throw new ServiceError("invalid_reference");
		const next = { ...found, version: found.version + 1, status };
		entries.set(entryId, next);
		return { version: next.version };
	};
	return {
		entries,
		async getWorkingReferences() {
			return [] as Reference[];
		},
		async getWorking() {
			throw new ServiceError("invalid_input");
		},
		async createEntryWithReferences() {
			throw new ServiceError("invalid_input");
		},
		async saveWorkingWithReferences() {
			throw new ServiceError("invalid_input");
		},
		async archiveEntry(params: { id: string; expectedVersion: number }) {
			return bump(params.id, params.expectedVersion, "archived");
		},
		async unarchiveEntry(params: { id: string; expectedVersion: number }) {
			return bump(params.id, params.expectedVersion, "draft");
		},
		async trashEntry(params: { id: string; expectedVersion: number }) {
			return bump(params.id, params.expectedVersion, "trashed");
		},
		async publishEntry(params: { id: string; expectedVersion: number }) {
			return bump(params.id, params.expectedVersion, "published");
		},
		async permanentDeleteEntry(params: { id: string; expectedVersion: number }) {
			const found = entries.get(params.id);
			if (!found) throw new ServiceError("not_found");
			if (params.expectedVersion !== found.version) throw new ServiceError("conflict");
			if (found.status !== "trashed") throw new FakeStoreError("invalid_status");
			if (found.usedBy?.length) throw new FakeStoreError("in_use", { usages: found.usedBy });
			entries.delete(params.id);
		},
	};
};

describe("M4-TW-1b Bulk lifecycle ops contract", () => {
	it("archive bumps version per item", async () => {
		const store = newFakeLifecycleStore({ e1: { version: 2, status: "draft" } });
		const bulk = createBulkService(store);
		const out = await bulk.run({ op: "archive", items: [{ id: "e1", expectedVersion: 2 }] });
		expect(out).toEqual({ results: [{ id: "e1", ok: true, version: 3 }] });
		expect(store.entries.get("e1")?.status).toBe("archived");
	});

	it("unarchive and trash dispatch to their own primitives", async () => {
		const store = newFakeLifecycleStore({
			e1: { version: 1, status: "archived" },
			e2: { version: 4, status: "draft" },
		});
		const bulk = createBulkService(store);
		await expect(bulk.run({ op: "unarchive", items: [{ id: "e1", expectedVersion: 1 }] })).resolves.toEqual({
			results: [{ id: "e1", ok: true, version: 2 }],
		});
		await expect(bulk.run({ op: "trash", items: [{ id: "e2", expectedVersion: 4 }] })).resolves.toEqual({
			results: [{ id: "e2", ok: true, version: 5 }],
		});
		expect(store.entries.get("e1")?.status).toBe("draft");
		expect(store.entries.get("e2")?.status).toBe("trashed");
	});

	it("conflict and missing entries are per-item errors", async () => {
		const store = newFakeLifecycleStore({ e1: { version: 2, status: "draft" } });
		const bulk = createBulkService(store);
		const out = await bulk.run({
			op: "archive",
			items: [
				{ id: "e1", expectedVersion: 2 },
				{ id: "e1", expectedVersion: 2 },
				{ id: "ghost", expectedVersion: 1 },
			],
		});
		expect(out).toEqual({
			results: [
				{ id: "e1", ok: true, version: 3 },
				{ id: "e1", ok: false, error: "conflict" },
				{ id: "ghost", ok: false, error: "not_found" },
			],
		});
	});

	it("publish passes validation failures through per item", async () => {
		const store = newFakeLifecycleStore({
			e1: { version: 2, status: "draft" },
			e2: { version: 2, status: "draft", brokenRef: true },
		});
		const bulk = createBulkService(store);
		const out = await bulk.run({
			op: "publish",
			items: [
				{ id: "e1", expectedVersion: 2 },
				{ id: "e2", expectedVersion: 2 },
			],
		});
		expect(out).toEqual({
			results: [
				{ id: "e1", ok: true, version: 3 },
				{ id: "e2", ok: false, error: "invalid_reference" },
			],
		});
	});
});

describe("v2 A3 bulk permanentDelete", () => {
	it("deletes only trashed, unreferenced items and names the blocking usages per item", async () => {
		const usage = { entryId: "p9", title: "참조하는 글", collection: "post", state: "working" };
		const store = newFakeLifecycleStore({
			gone: { version: 3, status: "trashed" },
			used: { version: 1, status: "trashed", usedBy: [usage] },
			live: { version: 2, status: "draft" },
		});
		const bulk = createBulkService(store);
		const out = await bulk.run({
			op: "permanentDelete",
			items: [
				{ id: "gone", expectedVersion: 3 },
				{ id: "used", expectedVersion: 1 },
				{ id: "live", expectedVersion: 2 },
			],
		});
		expect(out.results).toEqual([
			{ id: "gone", ok: true, version: 3 },
			{ id: "used", ok: false, error: "in_use", usages: [usage] },
			{ id: "live", ok: false, error: "invalid_status" },
		]);
		expect(store.entries.has("gone")).toBe(false);
		expect(store.entries.has("used")).toBe(true);
		expect(store.entries.has("live")).toBe(true);
	});

	it("reports a stale version as a per-item conflict", async () => {
		const store = newFakeLifecycleStore({ t1: { version: 5, status: "trashed" } });
		const out = await createBulkService(store).run({
			op: "permanentDelete",
			items: [{ id: "t1", expectedVersion: 4 }],
		});
		expect(out.results).toEqual([{ id: "t1", ok: false, error: "conflict" }]);
		expect(store.entries.has("t1")).toBe(true);
	});

	it("treats an item already removed earlier in the same request as deleted (source took its translations, v3)", async () => {
		const store = newFakeLifecycleStore({ source: { version: 2, status: "trashed" } });
		const out = await createBulkService(store).run({
			op: "permanentDelete",
			items: [
				{ id: "source", expectedVersion: 2 },
				{ id: "translation-removed-with-source", expectedVersion: 3 },
			],
		});
		expect(out.results).toEqual([
			{ id: "source", ok: true, version: 2 },
			{ id: "translation-removed-with-source", ok: true, version: 3 },
		]);
	});
});
