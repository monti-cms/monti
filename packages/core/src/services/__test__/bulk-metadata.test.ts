import { describe, expect, it } from "vitest";
import { contentCollection } from "../../../test/any-site";
import { COLLECTIONS, type Collection } from "../../core/collections";
import { type StoredField, storedField, storedFields } from "../../schema/derive";
import { createBulkService } from "../bulk-service";
import type { PreparedSnapshot, Reference } from "../index";
import { ServiceError } from "../index";

/** 본문 컬렉션의 관계 필드 중 하나짜리(`many` 아님) 또는 여러 개짜리 첫 필드. 이름은 설정에서 찾는다. */
const relationFieldOf = (many: boolean): StoredField => {
	const found = storedFields(contentCollection).find(
		({ field, when }) => !when && field.kind === "relation" && Boolean(field.many) === many,
	);
	if (!found) throw new Error(`bulk-metadata: ${contentCollection} has no ${many ? "many" : "single"} relation field`);
	return found;
};
const single = relationFieldOf(false).name;
const many = relationFieldOf(true).name;
/** 여러 개짜리 관계 필드가 없는 컬렉션(다른 컬렉션에 그 필드로 관계 작업을 하면 항목별 오류). */
const collectionWithoutMany = COLLECTIONS.find((name) => !storedField(name, many)) as Collection;

type Working = {
	collection: Collection;
	slug: string | null;
	metadata: Record<string, unknown>;
	mdx: string;
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
				mdx: params.snapshot.mdx,
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
	mdx: "body",
	version: 3,
	folderId: null,
	...over,
});

describe("M4-TW-1a Bulk metadata ops contract", () => {
	it("rejects unknown op for the whole request", async () => {
		const bulk = createBulkService(newFakeStore({}));
		await expect(bulk.run({ op: "nope", items: [] } as any)).rejects.toThrowError(
			expect.objectContaining({ code: "unknown_op" }),
		);
	});

	it("rejects more than 100 items", async () => {
		const bulk = createBulkService(newFakeStore({}));
		const items = Array.from({ length: 101 }, (_, i) => ({ id: `e-${i}`, expectedVersion: 1 }));
		await expect(
			bulk.run({ op: "relation.add", field: many, items, ids: ["55555555-5555-4555-8555-555555555555"] }),
		).rejects.toThrowError(expect.objectContaining({ code: "too_many_items" }));
	});

	it("returns empty results for empty items", async () => {
		const bulk = createBulkService(newFakeStore({}));
		await expect(
			bulk.run({ op: "relation.add", field: many, items: [], ids: ["55555555-5555-4555-8555-555555555555"] }),
		).resolves.toEqual({ results: [] });
	});

	it("relation.add merges and dedupes, bumping version", async () => {
		const store = newFakeStore({ e1: post() });
		const bulk = createBulkService(store);
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

	it("relation.remove filters; removing absent tag is still ok", async () => {
		const store = newFakeStore({ e1: post() });
		const bulk = createBulkService(store);
		const out = await bulk.run({
			op: "relation.remove",
			field: many,
			items: [{ id: "e1", expectedVersion: 3 }],
			ids: ["33333333-3333-4333-8333-333333333333", "99999999-9999-4999-8999-999999999999"],
		});
		expect(out).toEqual({ results: [{ id: "e1", ok: true, version: 4 }] });
		expect(store.entries.get("e1")?.metadata[many]).toEqual(["44444444-4444-4444-8444-444444444444"]);
	});

	it("a conflict on one item does not touch the others", async () => {
		const store = newFakeStore({ e1: post(), e2: post({ version: 5 }) });
		const bulk = createBulkService(store);
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

	it("missing entry is a per-item error", async () => {
		const store = newFakeStore({ e1: post() });
		const bulk = createBulkService(store);
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

	it("malformed expectedVersion is a per-item error", async () => {
		const store = newFakeStore({ e1: post() });
		const bulk = createBulkService(store);
		const out = await bulk.run({
			op: "relation.add",
			field: many,
			items: [{ id: "e1", expectedVersion: 0 } as any, { id: "e1", expectedVersion: 3 }],
			ids: ["55555555-5555-4555-8555-555555555555"],
		});
		expect(out.results[0]).toEqual({ id: "e1", ok: false, error: "invalid_input" });
		expect(out.results[1]).toEqual({ id: "e1", ok: true, version: 4 });
	});

	it("relation.set replaces; null clears", async () => {
		const store = newFakeStore({ e1: post(), e2: post() });
		const bulk = createBulkService(store);
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

	it("folder.move sets folderId; null moves to root", async () => {
		const store = newFakeStore({ e1: post({ folderId: "f-1" }), e2: post() });
		const bulk = createBulkService(store);
		await bulk.run({ op: "folder.move", items: [{ id: "e1", expectedVersion: 3 }], folderId: "f-2" });
		expect(store.entries.get("e1")?.folderId).toBe("f-2");
		await bulk.run({ op: "folder.move", items: [{ id: "e2", expectedVersion: 3 }], folderId: null });
		expect(store.entries.get("e2")?.folderId).toBeNull();
	});

	it("relation op on a collection without the field is a per-item error", async () => {
		const store = newFakeStore({
			c1: {
				collection: collectionWithoutMany,
				slug: "cat",
				metadata: { title: "Cat" },
				mdx: "",
				version: 1,
				folderId: null,
			},
		});
		const bulk = createBulkService(store);
		const out = await bulk.run({
			op: "relation.add",
			field: many,
			items: [{ id: "c1", expectedVersion: 1 }],
			ids: ["55555555-5555-4555-8555-555555555555"],
		});
		expect(out).toEqual({ results: [{ id: "c1", ok: false, error: "invalid_input" }] });
	});

	it("relation ops reject a non-relation field and a many/single mismatch", async () => {
		const store = newFakeStore({ e1: post(), e2: post(), e3: post() });
		const bulk = createBulkService(store);
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

	it("relation ops need a field and values for the whole request", async () => {
		const bulk = createBulkService(newFakeStore({}));
		await expect(bulk.run({ op: "relation.add", items: [], ids: [] })).rejects.toThrowError(
			expect.objectContaining({ code: "invalid_input" }),
		);
		await expect(bulk.run({ op: "relation.set", field: single, items: [] })).rejects.toThrowError(
			expect.objectContaining({ code: "invalid_input" }),
		);
	});
});
