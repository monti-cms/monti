import { randomUUID } from "node:crypto";
import type { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { contentCollection, recordCollection, recordRelationField } from "../../../../test/any-site";
import { docOf, mdxOf } from "../../../../test/stored-content";
import { type Collection, isItemCollection } from "../../../core/collections";
import type { Entry } from "../../../core/store";
import { seedEntry } from "../../../core/store/__test__/seed";
import { storedFields } from "../../../schema/derive";
import type { PreparedSnapshot, Reference, StorePort } from "../../../services";
import { createContentStore, migrateContentStore } from "../content-store";
import { closeGlobalPool, createIsolatedTestPool, dropIsolatedTestPool } from "./test-database";

type ExtendedStore = ReturnType<typeof createContentStore> & StorePort<Entry>;

/**
 * A relation field where a body collection points at an item collection. A multi-select field is preferred (it also tests the order `ordinal`).
 * Collection and field names are looked up in the current config (`test/any-site.ts`).
 */
const relation = (() => {
	for (const { name, field, when } of storedFields(contentCollection)) {
		if (!when && field.kind === "relation" && field.many && isItemCollection(field.to)) {
			return { name, to: field.to as Collection, many: true };
		}
	}
	return recordRelationField(contentCollection);
})();
/** The item collection that creates reference targets and the reference location (metadata path). Tests that only check the store contract use just the name. */
const targetCollection = relation?.to ?? recordCollection;
const relationPath = relation?.name ?? "relationId";

/** A prepared snapshot. The body is given as text (`mdx`) and stored as the document it reads as. */
function buildSnapshot(overrides: Partial<PreparedSnapshot> & { mdx?: string } = {}): PreparedSnapshot {
	const { mdx, ...rest } = overrides;
	const refs = overrides.references || [];
	return {
		collection: contentCollection,
		slug: `test-slug-${Math.random().toString(36).slice(2, 8)}`,
		metadata: { title: "Test" },
		doc: docOf(mdx ?? "Test content"),
		schemaVersion: 1,
		contentHash: `hash-${Math.random().toString(36).slice(2, 8)}`,
		issues: [],
		imageSources: [],
		...rest,
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

describe("ContentStore References", () => {
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
		expect(entryUpdated.working.mdx).toEqual(mdxOf(snapshotValid2.doc));
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
});
