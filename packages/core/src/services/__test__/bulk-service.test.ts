import { describe, expect, it } from "vitest";
import { contentCollection } from "../../../test/any-site";
import { testSite } from "../../../test/site";
import { docOf } from "../../../test/stored-content";
import type { Collection } from "../../core/collections";
import type { StoredDocument } from "../../doc/stored-document";
import { STORED_DOCUMENT_VERSION } from "../../doc/stored-document";
import type { StoredField } from "../../schema/derive";
import { createBulkService } from "../bulk-service";
import type { PreparedSnapshot, Reference } from "../index";
import { ServiceError } from "../index";

/** Bulk status change. */

type EntryState = {
	version: number;
	status: "draft" | "published" | "archived" | "trashed";
	brokenRef?: boolean;
	usedBy?: { entryId: string; title: string | null; collection: string; state: string }[];
};

/** An error with `code` and `details`, like the store's `CmsError`. */
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
		/** A publish reads the draft first (the write pipeline prepares it before the store commits). */
		async getWorking(params: { entryId: string }) {
			const found = entries.get(params.entryId);
			if (!found) throw new ServiceError("not_found");
			return {
				collection: contentCollection,
				slug: "bulk-publish",
				metadata: { title: "Title" },
				doc: docOf("Body"),
				version: found.version,
				folderId: null,
			};
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

describe("Bulk lifecycle ops contract", () => {
	it("LIST-C5 archive bumps version per item", async () => {
		const store = newFakeLifecycleStore({ e1: { version: 2, status: "draft" } });
		const bulk = createBulkService(store as never, { site: testSite });
		const out = await bulk.run({ op: "archive", items: [{ id: "e1", expectedVersion: 2 }] });
		expect(out).toEqual({ results: [{ id: "e1", ok: true, version: 3 }] });
		expect(store.entries.get("e1")?.status).toBe("archived");
	});

	it("LIST-C5 unarchive and trash dispatch to their own primitives", async () => {
		const store = newFakeLifecycleStore({
			e1: { version: 1, status: "archived" },
			e2: { version: 4, status: "draft" },
		});
		const bulk = createBulkService(store as never, { site: testSite });
		await expect(bulk.run({ op: "unarchive", items: [{ id: "e1", expectedVersion: 1 }] })).resolves.toEqual({
			results: [{ id: "e1", ok: true, version: 2 }],
		});
		await expect(bulk.run({ op: "trash", items: [{ id: "e2", expectedVersion: 4 }] })).resolves.toEqual({
			results: [{ id: "e2", ok: true, version: 5 }],
		});
		expect(store.entries.get("e1")?.status).toBe("draft");
		expect(store.entries.get("e2")?.status).toBe("trashed");
	});

	it("LIST-C2 conflict and missing entries are per-item errors", async () => {
		const store = newFakeLifecycleStore({ e1: { version: 2, status: "draft" } });
		const bulk = createBulkService(store as never, { site: testSite });
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

	it("LIST-C2 publish passes validation failures through per item", async () => {
		const store = newFakeLifecycleStore({
			e1: { version: 2, status: "draft" },
			e2: { version: 2, status: "draft", brokenRef: true },
		});
		const bulk = createBulkService(store as never, { site: testSite });
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

describe("bulk permanentDelete", () => {
	it("TRASH-D2 deletes only trashed, unreferenced items and names the blocking usages per item", async () => {
		const usage = { entryId: "p9", title: "참조하는 글", collection: contentCollection, state: "working" };
		const store = newFakeLifecycleStore({
			gone: { version: 3, status: "trashed" },
			used: { version: 1, status: "trashed", usedBy: [usage] },
			live: { version: 2, status: "draft" },
		});
		const bulk = createBulkService(store as never, { site: testSite });
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

	it("TRASH-D9 reports a stale version as a per-item conflict", async () => {
		const store = newFakeLifecycleStore({ t1: { version: 5, status: "trashed" } });
		const out = await createBulkService(store as never, { site: testSite }).run({
			op: "permanentDelete",
			items: [{ id: "t1", expectedVersion: 4 }],
		});
		expect(out.results).toEqual([{ id: "t1", ok: false, error: "conflict" }]);
		expect(store.entries.has("t1")).toBe(true);
	});

	it("TRASH-E2 treats an item already removed earlier in the same request as deleted (source took its translations)", async () => {
		const store = newFakeLifecycleStore({ source: { version: 2, status: "trashed" } });
		const out = await createBulkService(store as never, { site: testSite }).run({
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

/** The first single-value (not `many`) or multi-value relation field among the body collection's relation fields. The name is looked up from the config. */
const relationFieldOf = (many: boolean): StoredField => {
	const found = testSite
		.storedFields(contentCollection)
		.find(({ field, when }) => !when && field.kind === "relation" && Boolean(field.many) === many);
	if (!found) throw new Error(`bulk-metadata: ${contentCollection} has no ${many ? "many" : "single"} relation field`);
	return found;
};
const single = relationFieldOf(false).name;
const many = relationFieldOf(true).name;
/** A collection with no multi-value relation field (a relation operation on another collection with that field gives a per-item error). */
const collectionWithoutMany = testSite.COLLECTIONS.find((name) => !testSite.storedField(name, many)) as Collection;

type Working = {
	collection: Collection;
	slug: string | null;
	metadata: Record<string, unknown>;
	doc: StoredDocument;
	version: number;
	folderId: string | null;
};

const newFakeStore = (seed: Record<string, Working>) => {
	const entries = new Map<string, Working>(Object.entries(seed));
	return {
		entries,
		async getWorkingReferences() {
			return [] as Reference[];
		},
		async archiveEntry() {
			throw new ServiceError("invalid_input");
		},
		async unarchiveEntry() {
			throw new ServiceError("invalid_input");
		},
		async trashEntry() {
			throw new ServiceError("invalid_input");
		},
		async publishEntry() {
			throw new ServiceError("invalid_input");
		},
		async permanentDeleteEntry() {
			throw new ServiceError("invalid_input");
		},
		async getWorking(params: { entryId: string }) {
			const found = entries.get(params.entryId);
			if (!found) throw new ServiceError("not_found");
			return found;
		},
		async createEntryWithReferences() {
			throw new ServiceError("invalid_input");
		},
		async saveWorkingWithReferences(params: {
			entryId: string;
			expectedVersion: number;
			snapshot: PreparedSnapshot;
			folderId?: string | null;
		}) {
			const found = entries.get(params.entryId);
			if (!found) throw new ServiceError("not_found");
			if (params.expectedVersion !== found.version) throw new ServiceError("conflict");
			const next: Working = {
				collection: params.snapshot.collection as Working["collection"],
				slug: params.snapshot.slug,
				metadata: params.snapshot.metadata as Record<string, unknown>,
				doc: params.snapshot.doc,
				version: found.version + 1,
				folderId: params.folderId === undefined ? found.folderId : params.folderId,
			};
			entries.set(params.entryId, next);
			return { version: next.version };
		},
	};
};

const post = (over: Partial<Working> = {}): Working => ({
	collection: contentCollection,
	slug: "hello",
	metadata: {
		title: "Hello",
		[single]: "11111111-1111-4111-8111-111111111111",
		[many]: ["33333333-3333-4333-8333-333333333333", "44444444-4444-4444-8444-444444444444"],
	},
	doc: docOf("body"),
	version: 3,
	folderId: null,
	...over,
});

describe("Bulk metadata ops contract", () => {
	it("LIST-C3 rejects unknown op for the whole request", async () => {
		const bulk = createBulkService(newFakeStore({}) as never, { site: testSite });
		await expect(bulk.run({ op: "nope", items: [] } as never)).rejects.toThrowError(
			expect.objectContaining({ code: "unknown_op" }),
		);
	});

	it("LIST-C3 rejects more than 100 items", async () => {
		const bulk = createBulkService(newFakeStore({}) as never, { site: testSite });
		const items = Array.from({ length: 101 }, (_, i) => ({ id: `e-${i}`, expectedVersion: 1 }));
		await expect(
			bulk.run({ op: "relation.add", field: many, items, ids: ["55555555-5555-4555-8555-555555555555"] }),
		).rejects.toThrowError(expect.objectContaining({ code: "too_many_items" }));
	});

	it("LIST-C2 returns empty results for empty items", async () => {
		const bulk = createBulkService(newFakeStore({}) as never, { site: testSite });
		await expect(
			bulk.run({ op: "relation.add", field: many, items: [], ids: ["55555555-5555-4555-8555-555555555555"] }),
		).resolves.toEqual({ results: [] });
	});

	it("LIST-C1 relation.add merges and dedupes, bumping version", async () => {
		const store = newFakeStore({ e1: post() });
		const bulk = createBulkService(store as never, { site: testSite });
		const out = await bulk.run({
			op: "relation.add",
			field: many,
			items: [{ id: "e1", expectedVersion: 3 }],
			ids: ["44444444-4444-4444-8444-444444444444", "55555555-5555-4555-8555-555555555555"],
		});
		expect(out).toEqual({ results: [{ id: "e1", ok: true, version: 4 }] });
		expect(store.entries.get("e1")?.metadata[many]).toEqual([
			"33333333-3333-4333-8333-333333333333",
			"44444444-4444-4444-8444-444444444444",
			"55555555-5555-4555-8555-555555555555",
		]);
	});

	it("LIST-C1 relation.remove filters; removing absent tag is still ok", async () => {
		const store = newFakeStore({ e1: post() });
		const bulk = createBulkService(store as never, { site: testSite });
		const out = await bulk.run({
			op: "relation.remove",
			field: many,
			items: [{ id: "e1", expectedVersion: 3 }],
			ids: ["33333333-3333-4333-8333-333333333333", "99999999-9999-4999-8999-999999999999"],
		});
		expect(out).toEqual({ results: [{ id: "e1", ok: true, version: 4 }] });
		expect(store.entries.get("e1")?.metadata[many]).toEqual(["44444444-4444-4444-8444-444444444444"]);
	});

	it("LIST-C2 a conflict on one item does not touch the others", async () => {
		const store = newFakeStore({ e1: post(), e2: post({ version: 5 }) });
		const bulk = createBulkService(store as never, { site: testSite });
		const out = await bulk.run({
			op: "relation.add",
			field: many,
			items: [
				{ id: "e1", expectedVersion: 3 },
				{ id: "e2", expectedVersion: 999 },
			],
			ids: ["55555555-5555-4555-8555-555555555555"],
		});
		expect(out).toEqual({
			results: [
				{ id: "e1", ok: true, version: 4 },
				{ id: "e2", ok: false, error: "conflict" },
			],
		});
		expect(store.entries.get("e1")?.metadata[many]).toContain("55555555-5555-4555-8555-555555555555");
		expect(store.entries.get("e2")?.metadata[many]).not.toContain("55555555-5555-4555-8555-555555555555");
	});

	it("LIST-C2 missing entry is a per-item error", async () => {
		const store = newFakeStore({ e1: post() });
		const bulk = createBulkService(store as never, { site: testSite });
		const out = await bulk.run({
			op: "relation.add",
			field: many,
			items: [
				{ id: "ghost", expectedVersion: 1 },
				{ id: "e1", expectedVersion: 3 },
			],
			ids: ["55555555-5555-4555-8555-555555555555"],
		});
		expect(out.results[0]).toEqual({ id: "ghost", ok: false, error: "not_found" });
		expect(out.results[1]).toEqual({ id: "e1", ok: true, version: 4 });
	});

	it("LIST-C2 malformed expectedVersion is a per-item error", async () => {
		const store = newFakeStore({ e1: post() });
		const bulk = createBulkService(store as never, { site: testSite });
		const out = await bulk.run({
			op: "relation.add",
			field: many,
			items: [{ id: "e1", expectedVersion: 0 } as never, { id: "e1", expectedVersion: 3 }],
			ids: ["55555555-5555-4555-8555-555555555555"],
		});
		expect(out.results[0]).toEqual({ id: "e1", ok: false, error: "invalid_input" });
		expect(out.results[1]).toEqual({ id: "e1", ok: true, version: 4 });
	});

	it("LIST-C1 relation.set replaces; null clears", async () => {
		const store = newFakeStore({ e1: post(), e2: post() });
		const bulk = createBulkService(store as never, { site: testSite });
		await bulk.run({
			op: "relation.set",
			field: single,
			items: [{ id: "e1", expectedVersion: 3 }],
			id: "22222222-2222-4222-8222-222222222222",
		});
		expect(store.entries.get("e1")?.metadata[single]).toBe("22222222-2222-4222-8222-222222222222");
		await bulk.run({ op: "relation.set", field: single, items: [{ id: "e2", expectedVersion: 3 }], id: null });
		expect(store.entries.get("e2")?.metadata[single]).toBeUndefined();
	});

	it("LIST-C5 folder.move sets folderId; null moves to root", async () => {
		const store = newFakeStore({ e1: post({ folderId: "f-1" }), e2: post() });
		const bulk = createBulkService(store as never, { site: testSite });
		await bulk.run({ op: "folder.move", items: [{ id: "e1", expectedVersion: 3 }], folderId: "f-2" });
		expect(store.entries.get("e1")?.folderId).toBe("f-2");
		await bulk.run({ op: "folder.move", items: [{ id: "e2", expectedVersion: 3 }], folderId: null });
		expect(store.entries.get("e2")?.folderId).toBeNull();
	});

	it("LIST-C3 relation op on a collection without the field is a per-item error", async () => {
		const store = newFakeStore({
			c1: {
				collection: collectionWithoutMany,
				slug: "cat",
				metadata: { title: "Cat" },
				doc: docOf(""),
				version: 1,
				folderId: null,
			},
		});
		const bulk = createBulkService(store as never, { site: testSite });
		const out = await bulk.run({
			op: "relation.add",
			field: many,
			items: [{ id: "c1", expectedVersion: 1 }],
			ids: ["55555555-5555-4555-8555-555555555555"],
		});
		expect(out).toEqual({ results: [{ id: "c1", ok: false, error: "invalid_input" }] });
	});

	it("LIST-C3 relation ops reject a non-relation field and a many/single mismatch", async () => {
		const store = newFakeStore({ e1: post(), e2: post(), e3: post() });
		const bulk = createBulkService(store as never, { site: testSite });
		const out = await bulk.run({
			op: "relation.add",
			field: "title",
			items: [{ id: "e1", expectedVersion: 3 }],
			ids: ["55555555-5555-4555-8555-555555555555"],
		});
		expect(out.results).toEqual([{ id: "e1", ok: false, error: "invalid_input" }]);
		const singleOut = await bulk.run({
			op: "relation.add",
			field: single,
			items: [{ id: "e2", expectedVersion: 3 }],
			ids: ["55555555-5555-4555-8555-555555555555"],
		});
		expect(singleOut.results).toEqual([{ id: "e2", ok: false, error: "invalid_input" }]);
		const manyOut = await bulk.run({
			op: "relation.set",
			field: many,
			items: [{ id: "e3", expectedVersion: 3 }],
			id: "55555555-5555-4555-8555-555555555555",
		});
		expect(manyOut.results).toEqual([{ id: "e3", ok: false, error: "invalid_input" }]);
	});

	it("LIST-C3 relation ops need a field and values for the whole request", async () => {
		const bulk = createBulkService(newFakeStore({}) as never, { site: testSite });
		await expect(bulk.run({ op: "relation.add", items: [], ids: [] })).rejects.toThrowError(
			expect.objectContaining({ code: "invalid_input" }),
		);
		await expect(bulk.run({ op: "relation.set", field: single, items: [] })).rejects.toThrowError(
			expect.objectContaining({ code: "invalid_input" }),
		);
	});
});

describe("image warnings of a publish", () => {
	const mediaId = "987e4567-e89b-12d3-a456-426614174000";

	/** A store holding one draft whose body is a single image of the media `mediaId`. Publishing just reports the next version. */
	const store = () => ({
		async getWorkingReferences() {
			return [] as Reference[];
		},
		async getWorking() {
			return {
				collection: contentCollection,
				slug: "hello",
				metadata: { title: "Hello" },
				doc: {
					type: "doc",
					version: STORED_DOCUMENT_VERSION,
					content: [{ type: "image", attrs: { mediaId, alt: "a" } }],
				},
				version: 3,
				folderId: null,
				locale: null,
			};
		},
		async publishEntry() {
			return { version: 4 };
		},
	});

	const pending = { getMediaAsset: async () => ({ status: "pending", storageKey: null }) };
	const imageNotReady = expect.objectContaining({ code: "image_media_not_ready", message: "pending" });

	it("WRITE-P1 a bulk publish reports the same warnings per item", async () => {
		const bulk = createBulkService(store() as never, { site: testSite, imageChecks: pending });
		const { results } = await bulk.run({ op: "publish", items: [{ id: "e1", expectedVersion: 3 }] });
		expect(results).toEqual([
			expect.objectContaining({ id: "e1", ok: true, warnings: expect.arrayContaining([imageNotReady]) }),
		]);
	});
});
