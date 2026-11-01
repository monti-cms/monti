import { randomUUID } from "node:crypto";
import type { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
	contentCollection,
	fillRequiredMetadata,
	recordRelationField,
	requiredMetadata,
} from "../../../../../test/any-site";
import { testSite } from "../../../../../test/site";
import { docOf } from "../../../../../test/stored-content";
import { withActor } from "../../../../core/actor";
import type { Collection } from "../../../../core/collections";
import { publishDraft, seedEntry, seedSave } from "../../../../core/store/__test__/seed";
import type { PreparedSnapshot, Reference, StorePort } from "../../../../services";
import { createContentService } from "../../../../services/content-service";
import { closeGlobalPool, createIsolatedTestPool, dropIsolatedTestPool } from "../../__test__/test-database";
import { createContentStore, migrateContentStore } from "../../content-store";

/** Every change that raises an entry's version records who made it and when, for the edit screen's conflict dialog. */
describe("who made the latest change of an entry (Postgres)", () => {
	let pool: Pool;
	let schemaName: string;
	let store: ReturnType<typeof createContentStore>;
	let relationTarget: (to: Collection) => Promise<string>;

	beforeAll(async () => {
		const isolated = await createIsolatedTestPool();
		pool = isolated.pool;
		schemaName = isolated.schemaName;
		await migrateContentStore(pool, { site: testSite, schema: schemaName });
		store = createContentStore(pool, { site: testSite, schema: schemaName });
		({ relationTarget } = fillRequiredMetadata(store));
	});

	afterAll(async () => {
		if (pool && schemaName) await dropIsolatedTestPool(pool, schemaName);
		await closeGlobalPool();
	});

	const draft = (text = "first") =>
		seedEntry(store, {
			collection: contentCollection,
			slug: `changed-by-${randomUUID()}`,
			metadata: { title: "Changed by" },
			text,
			contentHash: randomUUID(),
		});

	it("WRITE-W14 records the admin who saved the draft, and the time of the save", async () => {
		const entry = await draft();
		const before = Date.now();
		const saved = await withActor("Mina", () =>
			seedSave(store, entry.id, { expectedVersion: entry.version, metadata: { title: "Changed by" }, text: "second" }),
		);
		expect(saved.changedBy).toBe("Mina");
		expect(saved.changedAt?.getTime()).toBeGreaterThanOrEqual(before - 1000);
		const read = await store.getEntry(entry.id);
		expect(read.changedBy).toBe("Mina");
		expect(read.changedAt?.getTime()).toBe(saved.changedAt?.getTime());
	});

	it("WRITE-S13 moves the modified date to the time of a save that changes the content", async () => {
		const entry = await draft();
		const long = new Date("2020-01-01T00:00:00Z");
		await pool.query(`UPDATE "${schemaName}".entries SET updated_at = $2 WHERE id = $1`, [entry.id, long]);

		const saved = await seedSave(store, entry.id, {
			expectedVersion: entry.version,
			metadata: entry.working.metadata,
			text: "changed",
		});

		expect(saved.updatedAt.getTime()).toBeGreaterThan(long.getTime());
		expect((await store.getEntry(entry.id)).updatedAt).toEqual(saved.updatedAt);
	});

	it("WRITE-S15 frees the address a draft moved away from, so another entry can take it", async () => {
		const freed = `freed-${randomUUID()}`;
		const first = await seedEntry(store, {
			collection: contentCollection,
			slug: freed,
			metadata: { title: "First" },
			text: "First",
		});
		await seedSave(store, first.id, {
			expectedVersion: first.version,
			slug: `moved-${randomUUID()}`,
			metadata: first.working.metadata,
			text: "First",
		});

		const second = await seedEntry(store, {
			collection: contentCollection,
			slug: freed,
			metadata: { title: "Second" },
			text: "Second",
		});
		expect(second.workingSlug).toBe(freed);
	});

	it("WRITE-P4 counts the address an entry deleted for good left behind as in use", async () => {
		const slug = `left-behind-${randomUUID()}`;
		const entry = await seedEntry(store, {
			collection: contentCollection,
			slug,
			metadata: { title: "Gone" },
			text: "Gone",
		});
		const published = await publishDraft(testSite, store, { id: entry.id, expectedVersion: entry.version });
		const trashed = await store.trashEntry({ id: entry.id, expectedVersion: published.version });
		await store.permanentDeleteEntry({ id: entry.id, expectedVersion: trashed.version });

		const inUse = await store.slugsInUse({ collection: contentCollection, locale: entry.locale, slugs: [slug] });
		expect([...inUse]).toEqual([slug]);
	});

	it("EVENT-D1 records a create that also publishes as the create, then the publish", async () => {
		const { entry } = await createContentService(store, { site: testSite }).createDraft(
			{
				collection: contentCollection,
				slug: `published-on-create-${randomUUID()}`,
				metadata: await requiredMetadata(contentCollection, "Published on create", relationTarget),
				doc: docOf("Body"),
			},
			{ publishImmediately: true },
		);
		expect(entry.status).toBe("published");

		const events = await pool.query<{ kind: string }>(
			`SELECT kind FROM "${schemaName}".cms_events WHERE entry_id = $1 ORDER BY seq`,
			[entry.id],
		);
		expect(events.rows.map((row) => row.kind)).toEqual(["created", "published"]);
	});
});

describe("ContentStore References", () => {
	type ExtendedStore = ReturnType<typeof createContentStore> & StorePort;

	/**
	 * A relation field where a body collection points at an item collection. A multi-select field is preferred (it also tests the order `ordinal`).
	 * Collection and field names are looked up in the current config (`test/any-site.ts`).
	 */
	const relation = (() => {
		for (const { name, field, when } of testSite.storedFields(contentCollection)) {
			if (!when && field.kind === "relation" && field.many && testSite.isItemCollection(field.to)) {
				return { name, to: field.to as Collection, many: true };
			}
		}
		return recordRelationField(contentCollection);
	})();

	/** The reference location (metadata path). Tests that only check the store contract use just the name. */
	const relationPath = relation?.name ?? "relationId";

	/** A prepared snapshot. The body is given as text (`text`) and stored as the document it reads as. */
	function buildSnapshot(overrides: Partial<PreparedSnapshot> & { text?: string } = {}): PreparedSnapshot {
		const { text, ...rest } = overrides;
		const refs = overrides.references || [];
		return {
			collection: contentCollection,
			slug: `test-slug-${Math.random().toString(36).slice(2, 8)}`,
			metadata: { title: "Test" },
			doc: docOf(text ?? "Test content"),
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

	let pool: Pool;
	let schemaName: string;
	let store: ExtendedStore;

	beforeAll(async () => {
		const isolated = await createIsolatedTestPool();
		pool = isolated.pool;
		schemaName = isolated.schemaName;

		await migrateContentStore(pool, { site: testSite, schema: schemaName });
		store = createContentStore(pool, { site: testSite, schema: schemaName }) as unknown as ExtendedStore;
	});

	afterAll(async () => {
		if (pool && schemaName) {
			await dropIsolatedTestPool(pool, schemaName);
		}
		await closeGlobalPool();
	});

	it("WRITE-S11 create rollback: invalid/nonexistent entry target causes failure and leaves zero matching entry or reference rows", async () => {
		const nonexistentId = randomUUID();
		const ref1 = buildReference({ kind: "entry", targetId: nonexistentId });
		const snapshot1 = buildSnapshot({ slug: "create-invalid-target", references: [ref1] });

		await expect(store.createEntryWithReferences({ snapshot: snapshot1, references: [ref1] })).rejects.toMatchObject({
			code: "invalid_reference",
		});

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

	it("WRITE-S11 media reference enforces DB identity via media_assets table, rejects invalid/mismatched targets, and roundtrips valid references", async () => {
		const source = await seedEntry(store, {
			collection: contentCollection,
			slug: `media-src-${randomUUID()}`,
			metadata: {},
			text: "",
			contentHash: "m-src",
		});

		const mediaIdA = randomUUID();
		const mediaIdB = randomUUID();
		await pool.query(`INSERT INTO "${schemaName}".media_assets (id) VALUES ($1), ($2)`, [mediaIdA, mediaIdB]);

		await expect(
			pool.query(
				`INSERT INTO "${schemaName}".entry_references (entry_id, state, kind, target_id, target_media_id, target_entry_id, is_stale, occurrences)
				 VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)`,
				[source.id, "working", "media", mediaIdA, null, null, false, JSON.stringify([])],
			),
		).rejects.toMatchObject({ code: "23514", constraint: "entry_references_target_check" });

		const preMismatchCount = await pool.query(
			`SELECT COUNT(*) as count FROM "${schemaName}".entry_references WHERE entry_id = $1`,
			[source.id],
		);
		expect(preMismatchCount.rows[0].count).toBe("0");

		await expect(
			pool.query(
				`INSERT INTO "${schemaName}".entry_references (entry_id, state, kind, target_id, target_media_id, target_entry_id, is_stale, occurrences)
				 VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)`,
				[source.id, "working", "media", mediaIdA, mediaIdB, null, false, JSON.stringify([])],
			),
		).rejects.toMatchObject({ code: "23514", constraint: "entry_references_target_check" });

		const nonexistentMediaId = randomUUID();
		const refInvalid = buildReference({ kind: "media", targetId: nonexistentMediaId });
		const snapshotInvalid = buildSnapshot({ slug: `media-invalid-${randomUUID()}`, references: [refInvalid] });

		await expect(
			store.createEntryWithReferences({ snapshot: snapshotInvalid, references: [refInvalid] }),
		).rejects.toMatchObject({ code: "invalid_reference" });

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
		expect(entryValid).toMatchObject({ collection: contentCollection, workingSlug: snapshotValid.slug });

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
			text: "Updated media content",
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
		expect(entryUpdated.working.doc).toEqual(snapshotValid2.doc);
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
			text: "Failed media content",
			contentHash: "hash-media-fail",
			references: [refFail],
		});

		await expect(
			store.saveWorkingWithReferences({
				entryId: entryValid.id,
				expectedVersion: entryUpdated.version,
				snapshot: snapshotFail,
				references: [refFail],
			}),
		).rejects.toMatchObject({ code: "invalid_reference" });

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
	});

	it("WRITE-S11 refuses a relation to an entry that does not exist when the body also links to it", async () => {
		const missing = buildReference({
			targetId: randomUUID(),
			occurrences: [
				{ type: "metadata", path: relationPath },
				{ type: "body", blockId: "b1" },
			],
		});
		const snapshot = buildSnapshot({ references: [missing] });

		await expect(store.createEntryWithReferences({ snapshot, references: [missing] })).rejects.toMatchObject({
			code: "invalid_reference",
		});
		const created = await pool.query(`SELECT 1 FROM "${schemaName}".entries WHERE working_slug = $1`, [snapshot.slug]);
		expect(created.rows).toEqual([]);
	});

	/** An entry of the content collection, in the trash. */
	const trashedTarget = async () => {
		const target = await seedEntry(store, {
			collection: contentCollection,
			slug: `trashed-target-${randomUUID()}`,
			metadata: { title: "Trashed target" },
			text: "Target",
		});
		await store.trashEntry({ id: target.id, expectedVersion: target.version });
		return target;
	};

	it("WRITE-S14 refuses a save that points a field at an entry in the trash, says so, and writes nothing", async () => {
		const target = await trashedTarget();
		const source = await store.createEntryWithReferences({ snapshot: buildSnapshot(), references: [] });
		// The body links to it too: the field still makes it a relation.
		const relation = buildReference({
			targetId: target.id,
			occurrences: [
				{ type: "metadata", path: relationPath },
				{ type: "body", blockId: "b1" },
			],
		});

		await expect(
			store.saveWorkingWithReferences({
				entryId: source.id,
				expectedVersion: source.version,
				snapshot: buildSnapshot({ text: "Points at the trash", references: [relation] }),
				references: [relation],
			}),
		).rejects.toMatchObject({ code: "invalid_reference", notice: { key: "entry.reference.trashed" } });
		const after = await store.getEntry(source.id);
		expect(after.version).toBe(source.version);
		expect(after.working).toEqual(source.working);
		expect(await store.getWorkingReferences({ entryId: source.id })).toEqual([]);
	});

	it("WRITE-S14 keeps a relation the draft already had when its target goes to the trash, so the draft can still be saved and moved", async () => {
		const target = await seedEntry(store, {
			collection: contentCollection,
			slug: `trashed-later-${randomUUID()}`,
			metadata: { title: "Trashed later" },
			text: "Target",
		});
		const relation = buildReference({ targetId: target.id });
		const source = await store.createEntryWithReferences({
			snapshot: buildSnapshot({ references: [relation] }),
			references: [relation],
		});
		// TRASH-T9: an entry other drafts point at can still go to the trash.
		const live = await store.getEntry(target.id);
		await store.trashEntry({ id: target.id, expectedVersion: live.version });

		const saved = await store.saveWorkingWithReferences({
			entryId: source.id,
			expectedVersion: source.version,
			snapshot: buildSnapshot({ text: "Edited after the trash", references: [relation] }),
			references: [relation],
		});
		expect(saved.version).toBe(source.version + 1);
		expect(await store.getWorkingReferences({ entryId: source.id })).toEqual([relation]);
	});

	it("WRITE-S14 saves a body link to an entry in the trash, and indexes it", async () => {
		const target = await trashedTarget();
		const source = await store.createEntryWithReferences({ snapshot: buildSnapshot(), references: [] });
		const link = buildReference({ targetId: target.id, occurrences: [{ type: "body", blockId: "b1" }] });

		const saved = await store.saveWorkingWithReferences({
			entryId: source.id,
			expectedVersion: source.version,
			snapshot: buildSnapshot({ text: "Links to the trash", references: [link] }),
			references: [link],
		});

		expect(saved.version).toBe(source.version + 1);
		expect(await store.getWorkingReferences({ entryId: source.id })).toEqual([link]);
	});

	/** An entry whose draft points at `targetId` through the relation field. */
	const referrer = async (targetId: string) => {
		const ref = buildReference({ targetId });
		return store.createEntryWithReferences({ snapshot: buildSnapshot({ references: [ref] }), references: [ref] });
	};

	it("TRASH-D2 lists the entries in the trash that point at an entry only when asked", async () => {
		const target = await seedEntry(store, {
			collection: contentCollection,
			slug: `pointed-at-${randomUUID()}`,
			metadata: { title: "Pointed at" },
			text: "Target",
		});
		const live = await referrer(target.id);
		const trashed = await referrer(target.id);
		await store.trashEntry({ id: trashed.id, expectedVersion: trashed.version });

		const sources = async (includeTrashed?: boolean) =>
			(await store.getIncomingReferences({ targetId: target.id, ...(includeTrashed ? { includeTrashed } : {}) }))
				.map((item) => `${item.sourceId}:${item.sourceStatus}`)
				.sort();

		expect(await sources()).toEqual([`${live.id}:draft`]);
		expect(await sources(true)).toEqual([`${live.id}:draft`, `${trashed.id}:trashed`].sort());
	});

	it("WRITE-W9 does not count the published version of an archived entry as a use on the site", async () => {
		const target = await seedEntry(store, {
			collection: contentCollection,
			slug: `archived-use-${randomUUID()}`,
			metadata: { title: "Used" },
			text: "Target",
		});
		const archived = await referrer(target.id);
		// An entry that was published with the relation and then archived: its published references stay for unarchiving.
		await pool.query(
			`INSERT INTO "${schemaName}".entry_references (entry_id, state, kind, target_id, target_entry_id, target_media_id, is_stale, occurrences)
			 SELECT entry_id, 'published', kind, target_id, target_entry_id, target_media_id, is_stale, occurrences
			 FROM "${schemaName}".entry_references WHERE entry_id = $1 AND state = 'working'`,
			[archived.id],
		);
		await pool.query(`UPDATE "${schemaName}".entries SET status = 'archived' WHERE id = $1`, [archived.id]);

		const uses = await store.getIncomingReferences({ targetId: target.id });
		expect(uses.map((item) => `${item.sourceId}:${item.state}`)).toEqual([`${archived.id}:working`]);
	});
});
