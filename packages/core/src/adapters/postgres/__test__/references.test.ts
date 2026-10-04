import { randomUUID } from "node:crypto";
import type { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
	contentCollection,
	fillRequiredMetadata,
	recordCollection,
	recordRelationField,
} from "../../../../test/any-site";
import { type Collection, isItemCollection } from "../../../core/collections";
import { storedFields } from "../../../schema/derive";
import type { PreparedSnapshot, Reference, StorePort } from "../../../services";
import type { Entry } from "../content-store";
import { CmsError, createContentStore, migrateContentStore } from "../content-store";
import { seedEntry } from "./seed";
import { closeGlobalPool, createIsolatedTestPool, dropIsolatedTestPool } from "./test-database";

type ExtendedStore = ReturnType<typeof createContentStore> & StorePort<Entry>;

/**
 * 본문 컬렉션이 항목 컬렉션을 가리키는 관계 필드. 여러 개를 고르는 필드를 먼저 쓴다(순번 `ordinal`까지 시험한다).
 * 컬렉션·필드 이름은 지금 설정에서 찾는다(`test/any-site.ts`).
 */
const relation = (() => {
	for (const { name, field, when } of storedFields(contentCollection)) {
		if (!when && field.kind === "relation" && field.many && isItemCollection(field.to)) {
			return { name, to: field.to as Collection, many: true };
		}
	}
	return recordRelationField(contentCollection);
})();
/** 참조 대상을 만드는 항목 컬렉션과 참조 위치(메타데이터 경로). 저장소 계약만 보는 테스트는 이름만 쓴다. */
const targetCollection = relation?.to ?? recordCollection;
const relationPath = relation?.name ?? "relationId";

function buildSnapshot(overrides: Partial<PreparedSnapshot> = {}): PreparedSnapshot {
	const refs = overrides.references || [];
	return {
		collection: contentCollection,
		slug: `test-slug-${Math.random().toString(36).slice(2, 8)}`,
		metadata: { title: "Test" },
		mdx: "Test content",
		schemaVersion: 1,
		contentHash: `hash-${Math.random().toString(36).slice(2, 8)}`,
		issues: [],
		imageSources: [],
		...overrides,
		references: refs,
	};
}

function buildReference(overrides: Partial<Reference> = {}): Reference {
	return {
		kind: "entry",
		targetId: "00000000-0000-0000-0000-000000000000",
		isStale: false,
		occurrences: [{ type: "metadata", path: relationPath }],
		...overrides,
	};
}

describe("ContentStore References (M2-TW-3 RED tests)", () => {
	let pool: Pool;
	let schemaName: string;
	let store: ExtendedStore;

	beforeAll(async () => {
		const isolated = await createIsolatedTestPool();
		pool = isolated.pool;
		schemaName = isolated.schemaName;

		await migrateContentStore(pool, { schema: schemaName });
		store = createContentStore(pool, { schema: schemaName }) as unknown as ExtendedStore;
	});

	afterAll(async () => {
		if (pool && schemaName) {
			await dropIsolatedTestPool(pool, schemaName);
		}
		await closeGlobalPool();
	});

	it.skipIf(!relation)("returns working and current published incoming references separately", async () => {
		if (!relation) return;
		// 공개하려면 발행 필수값이 있어야 한다. 이 테스트만 빠진 필수값을 채우는 저장소를 쓴다.
		const filled = createContentStore(pool, { schema: schemaName });
		fillRequiredMetadata(filled);
		const target = await seedEntry(store, {
			collection: relation.to,
			slug: `incoming-tag-${randomUUID()}`,
			metadata: { title: "Reference tag" },
			mdx: "",
			schemaVersion: 1,
			contentHash: `tag-${randomUUID()}`,
		});
		if (target.status !== "published") await store.publishEntry({ id: target.id, expectedVersion: target.version });

		const occurrence = relation.many
			? { type: "metadata" as const, path: relation.name, ordinal: 0 }
			: { type: "metadata" as const, path: relation.name };
		const value = relation.many ? [target.id] : target.id;
		const reference = buildReference({ kind: "entry", targetId: target.id, occurrences: [occurrence] });
		const source = await filled.createEntryWithReferences({
			snapshot: buildSnapshot({
				slug: `incoming-memo-${randomUUID()}`,
				metadata: { title: "Published title", [relation.name]: value },
				references: [reference],
			}),
			references: [reference],
		});
		const published = await store.publishEntry({ id: source.id, expectedVersion: source.version });
		const draftSlug = `incoming-draft-${randomUUID()}`;
		await filled.saveWorkingWithReferences({
			entryId: source.id,
			expectedVersion: published.version,
			snapshot: buildSnapshot({
				slug: draftSlug,
				metadata: { title: "Draft title", [relation.name]: value },
				references: [reference],
			}),
			references: [reference],
		});

		const incoming = await store.getIncomingReferences({ targetId: target.id });
		expect(incoming).toHaveLength(2);
		expect(incoming).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					state: "working",
					sourceTitle: "Draft title",
					sourceSlug: draftSlug,
					occurrences: [occurrence],
				}),
				expect.objectContaining({
					state: "published",
					sourceTitle: "Published title",
					sourceSlug: source.workingSlug,
					occurrences: [occurrence],
				}),
			]),
		);
	});

	it("create atomically persists working snapshot + normalized working references, including multiple occurrences", async () => {
		const targetCat = await seedEntry(store, {
			collection: targetCollection,
			slug: "cat-1",
			metadata: {},
			mdx: "",
			schemaVersion: 1,
			contentHash: "c1",
		});
		const targetTag = await seedEntry(store, {
			collection: targetCollection,
			slug: "tag-1",
			metadata: {},
			mdx: "",
			schemaVersion: 1,
			contentHash: "t1",
		});

		const ref1 = buildReference({
			kind: "entry",
			targetId: targetCat.id,
			isStale: true,
			occurrences: [
				{ type: "metadata", path: relationPath },
				{ type: "mdx", line: 1, column: 5 },
			],
		});
		const ref2 = buildReference({
			kind: "entry",
			targetId: targetTag.id,
			isStale: false,
			occurrences: [{ type: "metadata", path: relationPath, ordinal: 0 }],
		});

		const snapshot = buildSnapshot({
			slug: "create-refs",
			contentHash: "fixed-hash",
			mdx: "fixed-mdx",
			schemaVersion: 2,
			metadata: { test: "val" },
			references: [ref2, ref1],
		});

		const entry = await store.createEntryWithReferences({ snapshot, references: [ref2, ref1] });
		expect(entry.id).toBeDefined();

		const refs = await store.getWorkingReferences({ entryId: entry.id });
		expect(refs).toHaveLength(2);

		const sortedExpected = [ref1, ref2].sort(
			(a, b) => a.kind.localeCompare(b.kind) || a.targetId.localeCompare(b.targetId),
		);
		const sortedActual = [...refs].sort((a, b) => a.kind.localeCompare(b.kind) || a.targetId.localeCompare(b.targetId));
		expect(sortedActual).toEqual(sortedExpected);

		const saved = await store.getEntry(entry.id);
		expect(saved.working.metadata).toEqual(snapshot.metadata);
		expect(saved.working.mdx).toEqual(snapshot.mdx);
		expect(saved.working.schemaVersion).toEqual(snapshot.schemaVersion);
		expect(saved.working.contentHash).toEqual(snapshot.contentHash);
		expect(saved.workingSlug).toEqual(snapshot.slug);
	});

	it("save atomically replaces the complete working reference set (removes old/adds new), increments numeric version, and stores matching body/slug", async () => {
		const targetOld = await seedEntry(store, {
			collection: targetCollection,
			slug: "old-tag",
			metadata: {},
			mdx: "",
			schemaVersion: 1,
			contentHash: "1",
		});
		const targetNew = await seedEntry(store, {
			collection: targetCollection,
			slug: "new-cat",
			metadata: {},
			mdx: "",
			schemaVersion: 1,
			contentHash: "2",
		});

		const refOld = buildReference({ kind: "entry", targetId: targetOld.id });
		const snapshot1 = buildSnapshot({ slug: "save-refs-1", references: [refOld] });
		const entry1 = await store.createEntryWithReferences({ snapshot: snapshot1, references: [refOld] });

		const refNew = buildReference({ kind: "entry", targetId: targetNew.id });
		const snapshot2 = buildSnapshot({
			slug: "save-refs-2",
			metadata: { title: "Updated" },
			contentHash: "hash-2",
			mdx: "updated",
			schemaVersion: 3,
			references: [refNew],
		});

		const entry2 = await store.saveWorkingWithReferences({
			entryId: entry1.id,
			expectedVersion: entry1.version,
			snapshot: snapshot2,
			references: [refNew],
		});

		expect(entry2.version).toBe(entry1.version + 1);
		expect(entry2.workingSlug).toBe("save-refs-2");
		expect(entry2.working.metadata).toEqual(snapshot2.metadata);
		expect(entry2.working.mdx).toEqual(snapshot2.mdx);
		expect(entry2.working.contentHash).toEqual(snapshot2.contentHash);
		expect(entry2.working.schemaVersion).toEqual(snapshot2.schemaVersion);

		const refs = await store.getWorkingReferences({ entryId: entry1.id });
		expect(refs).toHaveLength(1);
		expect(refs[0]).toEqual(refNew);
	});

	it("stale references and occurrences survive exact DB roundtrip", async () => {
		const target = await seedEntry(store, {
			collection: targetCollection,
			slug: "cat-stale",
			metadata: {},
			mdx: "",
			schemaVersion: 1,
			contentHash: "1",
		});

		const ref = buildReference({
			targetId: target.id,
			isStale: true,
			occurrences: [
				{ type: "metadata", path: "test" },
				{ type: "mdx", line: 5, column: 10 },
			],
		});
		const snapshot = buildSnapshot({ references: [ref] });
		const entry = await store.createEntryWithReferences({ snapshot, references: [ref] });

		const refs = await store.getWorkingReferences({ entryId: entry.id });
		expect(refs[0]).toEqual(ref);
	});

	it("reference-only mutation is a real optimistic-version mutation (increments version) and stale flag updates", async () => {
		const target = await seedEntry(store, {
			collection: targetCollection,
			slug: "cat-ref-only",
			metadata: {},
			mdx: "",
			schemaVersion: 1,
			contentHash: "1",
		});
		const ref1 = buildReference({ targetId: target.id, isStale: false });
		const snapshot1 = buildSnapshot({ references: [ref1] });
		const entry1 = await store.createEntryWithReferences({ snapshot: snapshot1, references: [ref1] });

		const ref2 = buildReference({ targetId: target.id, isStale: true });
		const snapshot2 = { ...snapshot1, references: [ref2] };
		const entry2 = await store.saveWorkingWithReferences({
			entryId: entry1.id,
			expectedVersion: entry1.version,
			snapshot: snapshot2,
			references: [ref2],
		});

		expect(entry2.version).toBe(entry1.version + 1);
		expect(entry2.working).toEqual(entry1.working);

		const refs = await store.getWorkingReferences({ entryId: entry1.id });
		expect(refs[0].isStale).toBe(true);

		let conflictErr: unknown;
		try {
			const snapshot3 = buildSnapshot({ references: [] });
			await store.saveWorkingWithReferences({
				entryId: entry1.id,
				expectedVersion: entry1.version,
				snapshot: snapshot3,
				references: [],
			});
		} catch (e) {
			conflictErr = e;
		}
		expect(conflictErr).toBeDefined();
		expect(conflictErr).toBeInstanceOf(CmsError);
		expect((conflictErr as CmsError).code).toBe("conflict");
		expect((conflictErr as CmsError).serverVersion).toBe(entry2.version);
	});

	it("optimistic version conflict preserves prior working snapshot, slug and refs", async () => {
		const target1 = await seedEntry(store, {
			collection: targetCollection,
			slug: "cat-opt-1",
			metadata: {},
			mdx: "",
			schemaVersion: 1,
			contentHash: "1",
		});
		const target2 = await seedEntry(store, {
			collection: targetCollection,
			slug: "cat-opt-2",
			metadata: {},
			mdx: "",
			schemaVersion: 1,
			contentHash: "2",
		});

		const ref1 = buildReference({ targetId: target1.id });
		const snapshot1 = buildSnapshot({
			slug: "conflict-1",
			contentHash: "opt-hash",
			mdx: "opt-mdx",
			references: [ref1],
		});
		const entry1 = await store.createEntryWithReferences({ snapshot: snapshot1, references: [ref1] });
		const priorRefs = await store.getWorkingReferences({ entryId: entry1.id });

		const ref2 = buildReference({ targetId: target2.id });
		const snapshot2 = buildSnapshot({
			slug: "conflict-2",
			contentHash: "opt-hash-2",
			mdx: "opt-mdx-2",
			references: [ref2],
		});

		let err: unknown;
		try {
			await store.saveWorkingWithReferences({
				entryId: entry1.id,
				expectedVersion: entry1.version - 1,
				snapshot: snapshot2,
				references: [ref2],
			});
		} catch (e) {
			err = e;
		}
		expect(err).toBeDefined();
		expect(err).toBeInstanceOf(CmsError);
		expect((err as CmsError).code).toBe("conflict");
		expect((err as CmsError).serverVersion).toBe(entry1.version);

		const saved = await store.getEntry(entry1.id);
		expect(saved.version).toBe(entry1.version);
		expect(saved.workingSlug).toBe(entry1.workingSlug);
		expect(saved.working).toEqual(entry1.working);

		const refs = await store.getWorkingReferences({ entryId: entry1.id });
		expect(refs).toEqual(priorRefs);
	});

	it("create rollback: invalid/nonexistent entry target causes failure and leaves zero matching entry or reference rows", async () => {
		const nonexistentId = randomUUID();
		const ref1 = buildReference({ kind: "entry", targetId: nonexistentId });
		const snapshot1 = buildSnapshot({ slug: "create-invalid-target", references: [ref1] });

		let err: unknown;
		try {
			await store.createEntryWithReferences({ snapshot: snapshot1, references: [ref1] });
		} catch (e) {
			err = e;
		}
		expect(err).toBeDefined();

		const entryCount = await pool.query(
			`SELECT COUNT(*) as count FROM "${schemaName}".entries WHERE working_slug = $1`,
			[snapshot1.slug],
		);
		expect(entryCount.rows[0].count).toBe("0");

		const bodyCount = await pool.query(
			`SELECT COUNT(*) as count FROM "${schemaName}".entry_bodies b JOIN "${schemaName}".entries e ON e.id = b.entry_id WHERE e.working_slug = $1`,
			[snapshot1.slug],
		);
		expect(bodyCount.rows[0].count).toBe("0");

		const addressCount = await pool.query(
			`SELECT COUNT(*) as count FROM "${schemaName}".content_addresses WHERE collection = $1 AND slug = $2`,
			[snapshot1.collection, snapshot1.slug],
		);
		expect(addressCount.rows[0].count).toBe("0");

		const refSourceCount = await pool.query(
			`SELECT COUNT(*) as count FROM "${schemaName}".entry_references r JOIN "${schemaName}".entries e ON e.id = r.entry_id WHERE e.working_slug = $1`,
			[snapshot1.slug],
		);
		expect(refSourceCount.rows[0].count).toBe("0");

		const refTargetCount = await pool.query(
			`SELECT COUNT(*) as count FROM "${schemaName}".entry_references WHERE target_entry_id = $1`,
			[nonexistentId],
		);
		expect(refTargetCount.rows[0].count).toBe("0");
	});

	it("save rollback: invalid/nonexistent entry target causes failure and fully rolls back body/version/working slug/reference replacement", async () => {
		const targetReal = await seedEntry(store, {
			collection: targetCollection,
			slug: "cat-real-1",
			metadata: {},
			mdx: "",
			schemaVersion: 1,
			contentHash: "1",
		});

		const ref1 = buildReference({ kind: "entry", targetId: targetReal.id });
		const snapshot1 = buildSnapshot({ slug: "valid-target", contentHash: "hash1", mdx: "mdx1", references: [ref1] });
		const entry1 = await store.createEntryWithReferences({ snapshot: snapshot1, references: [ref1] });
		const priorRefs = await store.getWorkingReferences({ entryId: entry1.id });

		const nonexistentId = randomUUID();
		const ref2 = buildReference({ kind: "entry", targetId: nonexistentId });
		const snapshot2 = buildSnapshot({ slug: "invalid-target", contentHash: "hash2", mdx: "mdx2", references: [ref2] });

		let err: unknown;
		try {
			await store.saveWorkingWithReferences({
				entryId: entry1.id,
				expectedVersion: entry1.version,
				snapshot: snapshot2,
				references: [ref2],
			});
		} catch (e) {
			err = e;
		}
		expect(err).toBeDefined();

		const saved = await store.getEntry(entry1.id);
		expect(saved.version).toBe(entry1.version);
		expect(saved.workingSlug).toBe(entry1.workingSlug);
		expect(saved.working).toEqual(entry1.working);

		const refs = await store.getWorkingReferences({ entryId: entry1.id });
		expect(refs).toEqual(priorRefs);
	});

	it("create/save working slug collision is normalized to CmsError code slug_conflict and transaction rollback leaves no partial create or preserves existing saved state respectively", async () => {
		const targetReal = await seedEntry(store, {
			collection: targetCollection,
			slug: "cat-real-2",
			metadata: {},
			mdx: "",
			schemaVersion: 1,
			contentHash: "1",
		});

		const snapshot1 = buildSnapshot({ slug: "collision-slug", references: [] });
		const _entry1 = await store.createEntryWithReferences({ snapshot: snapshot1, references: [] });

		const snapshot2 = buildSnapshot({ slug: "collision-slug", references: [] });
		let err1: unknown;
		try {
			await store.createEntryWithReferences({ snapshot: snapshot2, references: [] });
		} catch (e) {
			err1 = e;
		}
		expect(err1).toBeInstanceOf(CmsError);
		expect((err1 as CmsError).code).toBe("slug_conflict");

		const countRes = await pool.query(`SELECT COUNT(*) as count FROM "${schemaName}".entries WHERE working_slug = $1`, [
			"collision-slug",
		]);
		expect(countRes.rows[0].count).toBe("1");

		const ref3 = buildReference({ targetId: targetReal.id });
		const snapshot3 = buildSnapshot({
			slug: "safe-slug",
			contentHash: "safe-hash",
			mdx: "safe-mdx",
			references: [ref3],
		});
		const entry3 = await store.createEntryWithReferences({ snapshot: snapshot3, references: [ref3] });
		const priorRefs3 = await store.getWorkingReferences({ entryId: entry3.id });

		let err2: unknown;
		try {
			const snapshotCollision = buildSnapshot({
				slug: "collision-slug",
				contentHash: "col-hash",
				mdx: "col-mdx",
				references: [],
			});
			await store.saveWorkingWithReferences({
				entryId: entry3.id,
				expectedVersion: entry3.version,
				snapshot: snapshotCollision,
				references: [],
			});
		} catch (e) {
			err2 = e;
		}
		expect(err2).toBeInstanceOf(CmsError);
		expect((err2 as CmsError).code).toBe("slug_conflict");

		const saved3 = await store.getEntry(entry3.id);
		expect(saved3.version).toBe(entry3.version);
		expect(saved3.workingSlug).toBe(entry3.workingSlug);
		expect(saved3.working).toEqual(entry3.working);

		const currentRefs = await store.getWorkingReferences({ entryId: entry3.id });
		expect(currentRefs).toEqual(priorRefs3);
	});

	it("references are isolated per source entry", async () => {
		const target1 = await seedEntry(store, {
			collection: targetCollection,
			slug: "cat-iso-1",
			metadata: {},
			mdx: "",
			schemaVersion: 1,
			contentHash: "1",
		});
		const target2 = await seedEntry(store, {
			collection: targetCollection,
			slug: "cat-iso-2",
			metadata: {},
			mdx: "",
			schemaVersion: 1,
			contentHash: "2",
		});

		const ref1 = buildReference({ targetId: target1.id });
		const snapshot1 = buildSnapshot({ references: [ref1] });
		const entry1 = await store.createEntryWithReferences({ snapshot: snapshot1, references: [ref1] });

		const ref2 = buildReference({ targetId: target2.id });
		const snapshot2 = buildSnapshot({ references: [ref2] });
		const entry2 = await store.createEntryWithReferences({ snapshot: snapshot2, references: [ref2] });

		const refs1 = await store.getWorkingReferences({ entryId: entry1.id });
		expect(refs1).toHaveLength(1);
		expect(refs1[0].targetId).toBe(target1.id);

		const refs2 = await store.getWorkingReferences({ entryId: entry2.id });
		expect(refs2).toHaveLength(1);
		expect(refs2[0].targetId).toBe(target2.id);
	});

	it("successful nonempty -> empty save: replaces refs with empty array and increments version", async () => {
		const targetReal = await seedEntry(store, {
			collection: targetCollection,
			slug: "empty-save-cat",
			metadata: {},
			mdx: "",
			schemaVersion: 1,
			contentHash: "1",
		});
		const ref1 = buildReference({ kind: "entry", targetId: targetReal.id });
		const snapshot1 = buildSnapshot({ slug: "empty-save-1", references: [ref1] });
		const entry1 = await store.createEntryWithReferences({ snapshot: snapshot1, references: [ref1] });

		const snapshot2 = buildSnapshot({
			slug: "empty-save-2",
			metadata: { title: "Cleared" },
			mdx: "cleared content",
			schemaVersion: 2,
			contentHash: "hash-empty-2",
			references: [],
		});
		const entry2 = await store.saveWorkingWithReferences({
			entryId: entry1.id,
			expectedVersion: entry1.version,
			snapshot: snapshot2,
			references: [],
		});
		expect(entry2.version).toBe(entry1.version + 1);
		expect(entry2.workingSlug).toBe("empty-save-2");
		expect(entry2.working.metadata).toEqual(snapshot2.metadata);
		expect(entry2.working.mdx).toEqual(snapshot2.mdx);
		expect(entry2.working.schemaVersion).toEqual(snapshot2.schemaVersion);
		expect(entry2.working.contentHash).toEqual(snapshot2.contentHash);

		const currentRefs = await store.getWorkingReferences({ entryId: entry1.id });
		expect(currentRefs).toHaveLength(0);
	});

	it("explicit DB FK contract: entry_references has a foreign key to entries covering target_entry_id", async () => {
		const res = await pool.query(
			`
			SELECT con.conname
			FROM pg_catalog.pg_constraint con
			JOIN pg_catalog.pg_class cl ON con.conrelid = cl.oid
			JOIN pg_catalog.pg_namespace ns ON cl.relnamespace = ns.oid
			JOIN pg_catalog.pg_class fcl ON con.confrelid = fcl.oid
			JOIN pg_catalog.pg_namespace fns ON fcl.relnamespace = fns.oid
			JOIN pg_catalog.pg_attribute a ON a.attrelid = cl.oid AND a.attnum = ANY(con.conkey)
			JOIN pg_catalog.pg_attribute fa ON fa.attrelid = fcl.oid AND fa.attnum = ANY(con.confkey)
			WHERE con.contype = 'f'
			  AND ns.nspname = $1
			  AND cl.relname = 'entry_references'
			  AND a.attname = 'target_entry_id'
			  AND fns.nspname = $1
			  AND fcl.relname = 'entries'
			  AND fa.attname = 'id'
			`,
			[schemaName],
		);
		expect(res.rows.length).toBeGreaterThanOrEqual(1);
	});

	it("identical snapshot + identical refs no-op save: timestamps and version remain unchanged", async () => {
		const targetReal = await seedEntry(store, {
			collection: targetCollection,
			slug: "noop-cat",
			metadata: {},
			mdx: "",
			schemaVersion: 1,
			contentHash: "1",
		});
		const ref1 = buildReference({ kind: "entry", targetId: targetReal.id });
		const snapshot1 = buildSnapshot({ slug: "noop-save", references: [ref1] });
		const entry1 = await store.createEntryWithReferences({ snapshot: snapshot1, references: [ref1] });

		const entry2 = await store.saveWorkingWithReferences({
			entryId: entry1.id,
			expectedVersion: entry1.version,
			snapshot: snapshot1,
			references: [ref1],
		});

		expect(entry2.version).toBe(entry1.version);
		expect(entry2.updatedAt).toEqual(entry1.updatedAt);
		expect(entry2.working.updatedAt).toEqual(entry1.working.updatedAt);
		expect(entry2.workingSlug).toBe(entry1.workingSlug);
		expect(entry2.working).toEqual(entry1.working);

		const currentRefs = await store.getWorkingReferences({ entryId: entry1.id });
		expect(currentRefs).toHaveLength(1);
		expect(currentRefs[0]).toEqual(ref1);
	});

	it("collection mismatch on save rejects with CmsError invalid_input and leaves working entry and references unchanged", async () => {
		const targetReal = await seedEntry(store, {
			collection: targetCollection,
			slug: `target-${randomUUID()}`,
			metadata: {},
			mdx: "",
			schemaVersion: 1,
			contentHash: "1",
		});
		const ref1 = buildReference({ kind: "entry", targetId: targetReal.id });
		const snapshot1 = buildSnapshot({ collection: contentCollection, slug: "mismatch-source", references: [ref1] });
		const entry1 = await store.createEntryWithReferences({ snapshot: snapshot1, references: [ref1] });
		const priorRefs = await store.getWorkingReferences({ entryId: entry1.id });
		const priorAddresses = await pool.query(
			`SELECT collection, slug, entry_id, type FROM "${schemaName}".content_addresses WHERE entry_id = $1 ORDER BY collection, slug`,
			[entry1.id],
		);

		const ref2 = buildReference({ kind: "entry", targetId: targetReal.id });
		const snapshot2 = buildSnapshot({
			collection: targetCollection,
			slug: "mismatch-changed",
			contentHash: "changed-hash",
			mdx: "changed-mdx",
			references: [ref2],
		});

		let err: unknown;
		try {
			await store.saveWorkingWithReferences({
				entryId: entry1.id,
				expectedVersion: entry1.version,
				snapshot: snapshot2,
				references: [ref2],
			});
		} catch (e) {
			err = e;
		}
		expect(err).toBeDefined();
		expect(err).toBeInstanceOf(CmsError);
		expect((err as CmsError).code).toBe("invalid_input");

		const saved = await store.getEntry(entry1.id);
		expect(saved.collection).toBe(contentCollection);
		expect(saved.version).toBe(entry1.version);
		expect(saved.workingSlug).toBe(entry1.workingSlug);
		expect(saved.working).toEqual(entry1.working);
		expect(saved.updatedAt).toEqual(entry1.updatedAt);
		expect(saved.working.updatedAt).toEqual(entry1.working.updatedAt);

		const currentAddresses = await pool.query(
			`SELECT collection, slug, entry_id, type FROM "${schemaName}".content_addresses WHERE entry_id = $1 ORDER BY collection, slug`,
			[entry1.id],
		);
		expect(currentAddresses.rows).toEqual(priorAddresses.rows);

		const currentRefs = await store.getWorkingReferences({ entryId: entry1.id });
		expect(currentRefs).toEqual(priorRefs);
	});

	it("DB CHECK binds target_id to target_entry_id for entry kinds, rejecting mismatched identities", async () => {
		const source = await seedEntry(store, {
			collection: contentCollection,
			slug: `source-${randomUUID()}`,
			metadata: {},
			mdx: "",
			schemaVersion: 1,
			contentHash: "src",
		});
		const targetA = await seedEntry(store, {
			collection: targetCollection,
			slug: `target-a-${randomUUID()}`,
			metadata: {},
			mdx: "",
			schemaVersion: 1,
			contentHash: "ta",
		});
		const targetB = await seedEntry(store, {
			collection: targetCollection,
			slug: `target-b-${randomUUID()}`,
			metadata: {},
			mdx: "",
			schemaVersion: 1,
			contentHash: "tb",
		});

		let err: unknown;
		try {
			await pool.query(
				`INSERT INTO "${schemaName}".entry_references (entry_id, state, kind, target_id, target_entry_id, is_stale, occurrences)
				 VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)`,
				[source.id, "working", "entry", targetA.id, targetB.id, false, JSON.stringify([])],
			);
		} catch (e) {
			err = e;
		}
		expect(err).toBeDefined();

		const res = await pool.query(`SELECT COUNT(*) as count FROM "${schemaName}".entry_references WHERE entry_id = $1`, [
			source.id,
		]);
		expect(res.rows[0].count).toBe("0");
	});

	it("media reference enforces DB identity via media_assets table, rejects invalid/mismatched targets, and roundtrips valid references", async () => {
		const fkRes = await pool.query(
			`
			SELECT con.conname
			FROM pg_catalog.pg_constraint con
			JOIN pg_catalog.pg_class cl ON con.conrelid = cl.oid
			JOIN pg_catalog.pg_namespace ns ON cl.relnamespace = ns.oid
			JOIN pg_catalog.pg_class fcl ON con.confrelid = fcl.oid
			JOIN pg_catalog.pg_namespace fns ON fcl.relnamespace = fns.oid
			JOIN pg_catalog.pg_attribute a ON a.attrelid = cl.oid AND a.attnum = ANY(con.conkey)
			JOIN pg_catalog.pg_attribute fa ON fa.attrelid = fcl.oid AND fa.attnum = ANY(con.confkey)
			WHERE con.contype = 'f'
			  AND ns.nspname = $1
			  AND cl.relname = 'entry_references'
			  AND a.attname = 'target_media_id'
			  AND fns.nspname = $1
			  AND fcl.relname = 'media_assets'
			  AND fa.attname = 'id'
			`,
			[schemaName],
		);
		expect(fkRes.rows.length).toBeGreaterThanOrEqual(1);

		const checkRes = await pool.query(
			`
			SELECT con.conname, pg_get_constraintdef(con.oid) as def
			FROM pg_catalog.pg_constraint con
			JOIN pg_catalog.pg_class cl ON con.conrelid = cl.oid
			JOIN pg_catalog.pg_namespace ns ON cl.relnamespace = ns.oid
			WHERE con.contype = 'c'
			  AND ns.nspname = $1
			  AND cl.relname = 'entry_references'
			`,
			[schemaName],
		);
		const hasMediaCheck = checkRes.rows.some(
			(row) =>
				row.def.toLowerCase().includes("target_media_id") &&
				row.def.toLowerCase().includes("media") &&
				row.def.toLowerCase().includes("target_id"),
		);
		expect(hasMediaCheck).toBe(true);

		const source = await seedEntry(store, {
			collection: contentCollection,
			slug: `media-src-${randomUUID()}`,
			metadata: {},
			mdx: "",
			schemaVersion: 1,
			contentHash: "m-src",
		});

		const mediaIdA = randomUUID();
		const mediaIdB = randomUUID();
		await pool.query(`INSERT INTO "${schemaName}".media_assets (id) VALUES ($1), ($2)`, [mediaIdA, mediaIdB]);

		let nullMediaErr: unknown;
		try {
			await pool.query(
				`INSERT INTO "${schemaName}".entry_references (entry_id, state, kind, target_id, target_media_id, target_entry_id, is_stale, occurrences)
				 VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)`,
				[source.id, "working", "media", mediaIdA, null, null, false, JSON.stringify([])],
			);
		} catch (e) {
			nullMediaErr = e;
		}
		expect(nullMediaErr).toBeDefined();

		const preMismatchCount = await pool.query(
			`SELECT COUNT(*) as count FROM "${schemaName}".entry_references WHERE entry_id = $1`,
			[source.id],
		);
		expect(preMismatchCount.rows[0].count).toBe("0");

		let insertErr: unknown;
		try {
			await pool.query(
				`INSERT INTO "${schemaName}".entry_references (entry_id, state, kind, target_id, target_media_id, target_entry_id, is_stale, occurrences)
				 VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)`,
				[source.id, "working", "media", mediaIdA, mediaIdB, null, false, JSON.stringify([])],
			);
		} catch (e) {
			insertErr = e;
		}
		expect(insertErr).toBeDefined();

		const nonexistentMediaId = randomUUID();
		const refInvalid = buildReference({ kind: "media", targetId: nonexistentMediaId });
		const snapshotInvalid = buildSnapshot({ slug: `media-invalid-${randomUUID()}`, references: [refInvalid] });

		let createErr: unknown;
		try {
			await store.createEntryWithReferences({ snapshot: snapshotInvalid, references: [refInvalid] });
		} catch (e) {
			createErr = e;
		}
		expect(createErr).toBeDefined();

		const entryCount = await pool.query(
			`SELECT COUNT(*) as count FROM "${schemaName}".entries WHERE working_slug = $1`,
			[snapshotInvalid.slug],
		);
		expect(entryCount.rows[0].count).toBe("0");

		const validMediaId = randomUUID();
		await pool.query(`INSERT INTO "${schemaName}".media_assets (id) VALUES ($1)`, [validMediaId]);

		const refValid = buildReference({ kind: "media", targetId: validMediaId });
		const snapshotValid = buildSnapshot({ slug: `media-valid-${randomUUID()}`, references: [refValid] });

		const entryValid = await store.createEntryWithReferences({ snapshot: snapshotValid, references: [refValid] });
		expect(entryValid.id).toBeDefined();

		const refs = await store.getWorkingReferences({ entryId: entryValid.id });
		expect(refs).toHaveLength(1);
		expect(refs[0]).toEqual(refValid);

		const validMediaId2 = randomUUID();
		await pool.query(`INSERT INTO "${schemaName}".media_assets (id) VALUES ($1)`, [validMediaId2]);

		const refValid2 = buildReference({
			kind: "media",
			targetId: validMediaId2,
			occurrences: [{ type: "metadata", path: "bannerId" }],
		});
		const snapshotValid2 = buildSnapshot({
			collection: contentCollection,
			slug: `media-valid-2-${randomUUID()}`,
			metadata: { title: "Media 2" },
			mdx: "Updated media content",
			schemaVersion: 2,
			contentHash: "hash-media-2",
			references: [refValid2],
		});

		const entryUpdated = await store.saveWorkingWithReferences({
			entryId: entryValid.id,
			expectedVersion: entryValid.version,
			snapshot: snapshotValid2,
			references: [refValid2],
		});

		expect(entryUpdated.version).toBe(entryValid.version + 1);
		expect(entryUpdated.workingSlug).toBe(snapshotValid2.slug);
		expect(entryUpdated.working.metadata).toEqual(snapshotValid2.metadata);
		expect(entryUpdated.working.mdx).toEqual(snapshotValid2.mdx);
		expect(entryUpdated.working.schemaVersion).toEqual(snapshotValid2.schemaVersion);
		expect(entryUpdated.working.contentHash).toEqual(snapshotValid2.contentHash);

		const refsUpdated = await store.getWorkingReferences({ entryId: entryValid.id });
		expect(refsUpdated).toHaveLength(1);
		expect(refsUpdated[0]).toEqual(refValid2);

		const addressesSecond = await pool.query(
			`SELECT collection, slug, entry_id, type FROM "${schemaName}".content_addresses WHERE entry_id = $1 ORDER BY collection, slug`,
			[entryValid.id],
		);

		const nonexistentMediaId2 = randomUUID();
		const refFail = buildReference({ kind: "media", targetId: nonexistentMediaId2 });
		const snapshotFail = buildSnapshot({
			collection: contentCollection,
			slug: `media-fail-${randomUUID()}`,
			metadata: { title: "Media Fail" },
			mdx: "Failed media content",
			schemaVersion: 3,
			contentHash: "hash-media-fail",
			references: [refFail],
		});

		let saveErr: unknown;
		try {
			await store.saveWorkingWithReferences({
				entryId: entryValid.id,
				expectedVersion: entryUpdated.version,
				snapshot: snapshotFail,
				references: [refFail],
			});
		} catch (e) {
			saveErr = e;
		}
		expect(saveErr).toBeDefined();

		const savedAfterFail = await store.getEntry(entryValid.id);
		expect(savedAfterFail.version).toBe(entryUpdated.version);
		expect(savedAfterFail.updatedAt).toEqual(entryUpdated.updatedAt);
		expect(savedAfterFail.working.updatedAt).toEqual(entryUpdated.working.updatedAt);
		expect(savedAfterFail.workingSlug).toBe(entryUpdated.workingSlug);
		expect(savedAfterFail.working).toEqual(entryUpdated.working);

		const addressesAfterFail = await pool.query(
			`SELECT collection, slug, entry_id, type FROM "${schemaName}".content_addresses WHERE entry_id = $1 ORDER BY collection, slug`,
			[entryValid.id],
		);
		expect(addressesAfterFail.rows).toEqual(addressesSecond.rows);

		const refsAfterFail = await store.getWorkingReferences({ entryId: entryValid.id });
		expect(refsAfterFail).toEqual(refsUpdated);
	}, 15_000);

	it("preserves reference occurrences, stale flag, normalized targetId casing and avoids false mutations", async () => {
		const target = await seedEntry(store, {
			collection: targetCollection,
			slug: `cat-norm-${randomUUID()}`,
			metadata: { name: "Category Normalization Target" },
			mdx: "",
			schemaVersion: 1,
			contentHash: "hash-cat-norm",
		});

		const upperTargetId = target.id.toUpperCase();
		const refUpper = buildReference({
			kind: "entry",
			targetId: upperTargetId,
			isStale: true,
			occurrences: [
				{ type: "metadata", path: relationPath },
				{ type: "mdx", line: 42, column: 12 },
			],
		});

		const originalSnapshot = buildSnapshot({
			slug: `post-norm-${randomUUID()}`,
			references: [refUpper],
		});

		const created = await store.createEntryWithReferences({
			snapshot: originalSnapshot,
			references: [refUpper],
		});

		const initialDbRefs = await store.getWorkingReferences({ entryId: created.id });
		expect(initialDbRefs).toHaveLength(1);
		expect(initialDbRefs[0].kind).toBe("entry");
		expect(initialDbRefs[0].isStale).toBe(true);
		expect(initialDbRefs[0].occurrences).toEqual(refUpper.occurrences);
		expect(initialDbRefs[0].targetId).toBe(target.id.toLowerCase());

		const saved = await store.saveWorkingWithReferences({
			entryId: created.id,
			expectedVersion: created.version,
			snapshot: originalSnapshot,
			references: [refUpper],
		});

		expect(saved.version).toBe(created.version);
		expect(saved.updatedAt).toEqual(created.updatedAt);
		expect(saved.working.updatedAt).toEqual(created.working.updatedAt);
		expect(saved.working.mdx).toBe(created.working.mdx);
		expect(saved.workingSlug).toBe(created.workingSlug);

		const subsequentDbRefs = await store.getWorkingReferences({ entryId: created.id });
		expect(subsequentDbRefs).toEqual(initialDbRefs);
	});
});
