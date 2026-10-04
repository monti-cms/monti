import { randomBytes } from "node:crypto";
import { Pool } from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { contentCollection, fillRequiredMetadata } from "../../../../test/any-site";
import { CmsError, createContentStore, migrateContentStore } from "../content-store";
import { moveToFolder, seedEntry } from "./seed";

// ---------------------------------------------------------------------------
// Local type declarations for the not-yet-implemented folder API
// ---------------------------------------------------------------------------

interface Folder {
	id: string;
	collection: string;
	parentId: string | null;
	name: string;
	position: number;
}

interface ExtendedContentStore {
	createFolder(params: {
		collection: string;
		parentId: string | null;
		name: string;
		position?: number;
	}): Promise<Folder>;
	updateFolder(params: { id: string; name?: string; parentId?: string | null; position?: number }): Promise<Folder>;
	deleteFolder(params: { id: string }): Promise<void>;
	listFolders(params: { collection: string }): Promise<Folder[]>;
}

// ---------------------------------------------------------------------------
// Error assertion helper — identity + code
// ---------------------------------------------------------------------------

function expectCmsError(err: unknown, code: string): void {
	expect(err).toBeInstanceOf(CmsError);
	expect((err as CmsError).code).toBe(code);
}

// ---------------------------------------------------------------------------
// UUID v4 regex
// ---------------------------------------------------------------------------

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ---------------------------------------------------------------------------
// Suite-local DB infrastructure
// ---------------------------------------------------------------------------

describe("Folders contract", () => {
	const ctx: { pool?: Pool; schema?: string; schemaCreated: boolean } = { schemaCreated: false };
	let pool: Pool;
	let schemaName: string;
	let store: ReturnType<typeof createContentStore> & ExtendedContentStore;

	beforeAll(async () => {
		const url = process.env.CMS_TEST_DATABASE_URL;
		if (!url) {
			throw new Error("CMS_TEST_DATABASE_URL is required — never use CMS_DATABASE_URL for tests.");
		}
		schemaName = `cms_fd_${randomBytes(4).toString("hex")}`;
		pool = new Pool({ connectionString: url });
		ctx.pool = pool;
		ctx.schema = schemaName;
		await pool.query(`CREATE SCHEMA "${schemaName}"`);
		ctx.schemaCreated = true;
		await migrateContentStore(pool, { schema: schemaName });
		store = createContentStore(pool, { schema: schemaName }) as unknown as typeof store;
	});

	afterAll(async () => {
		try {
			if (ctx.pool && ctx.schemaCreated && ctx.schema) {
				await ctx.pool.query(`DROP SCHEMA "${ctx.schema}" CASCADE`);
			}
		} finally {
			if (ctx.pool) {
				await ctx.pool.end();
			}
		}
	});

	beforeEach(async () => {
		if (ctx.schemaCreated) {
			try {
				await pool.query(`TRUNCATE "${schemaName}".entries CASCADE`);
				await pool.query(`TRUNCATE "${schemaName}".folders CASCADE`);
			} catch (_e) {
				// Tables might not exist yet
			}
			// 발행 필수값(블로그의 카테고리 같은 것)은 설정에서 찾아 채운다. 위에서 글을 다 지웠으므로 관계 대상도
			// 새로 만들게 저장소를 다시 만든다.
			store = createContentStore(pool, { schema: schemaName }) as unknown as typeof store;
			fillRequiredMetadata(store);
		}
	});

	// -----------------------------------------------------------------------
	// Fixture helpers
	// -----------------------------------------------------------------------

	let seqCounter = 0;
	function uniqueHash(): string {
		seqCounter += 1;
		return `fh${seqCounter}_${randomBytes(4).toString("hex")}`;
	}

	// -----------------------------------------------------------------------
	// 1  create/list nesting, UUID validity, collection isolation, position
	//
	// listFolders contract: returns folders in deterministic order:
	//   parentId/root grouping then position ASC then id ASC
	// -----------------------------------------------------------------------

	it("1. create/list nesting with UUID validity, collection isolation, exact returned keys, deterministic listFolders order (parentId/root grouping → position ASC → id ASC) including same-position siblings", async () => {
		const r1 = await store.createFolder({ collection: "fc1", parentId: null, name: "Root1", position: 20 });
		const r2 = await store.createFolder({ collection: "fc1", parentId: null, name: "Root2", position: 10 });
		// r2 (10) should come before r1 (20)

		// UUID validity
		expect(r1.id).toMatch(UUID_RE);

		// Exact returned keys
		const keys = Object.keys(r1).sort();
		expect(keys).toEqual(["collection", "id", "name", "parentId", "position", "version"].sort());
		expect(r1.collection).toBe("fc1");
		expect(r1.parentId).toBeNull();
		expect(r1.name).toBe("Root1");
		expect(typeof r1.position).toBe("number");

		// Nested child
		const c1 = await store.createFolder({ collection: "fc1", parentId: r1.id, name: "Child1", position: 20 });
		expect(c1.parentId).toBe(r1.id);

		// Explicit position
		const c2 = await store.createFolder({ collection: "fc1", parentId: r1.id, name: "Child2", position: 10 });
		expect(c2.position).toBe(10);

		// Same-position siblings under r1 to prove id ASC tie-break
		const c3 = await store.createFolder({ collection: "fc1", parentId: r1.id, name: "Child3", position: 10 });
		expect(c3.position).toBe(10);

		// List returns all including nested — assert deterministic order directly
		const list = await store.listFolders({ collection: "fc1" });
		expect(list).toHaveLength(5);

		// Verify returned order: parentId/root grouping then position ASC then id ASC
		// Root folders first: r2 (10), r1 (20)
		// Children under r1: c2 (10), c3 (10), c1 (20). c2 and c3 tied, sort by id ASC.
		const rRoots = [r2, r1].sort((a, b) => a.position - b.position || a.id.localeCompare(b.id));
		const rChildren = [c2, c3, c1].sort((a, b) => a.position - b.position || a.id.localeCompare(b.id));

		const expectedIds = [...rRoots.map((f) => f.id), ...rChildren.map((f) => f.id)];
		expect(list.map((f) => f.id)).toEqual(expectedIds);

		// Collection isolation — fc1 folders not in fc_other
		await store.createFolder({ collection: "fc_other", parentId: null, name: "OtherRoot" });
		const otherList = await store.listFolders({ collection: "fc_other" });
		expect(otherList).toHaveLength(1);
		expect(otherList[0].name).toBe("OtherRoot");
	}, 30_000);

	// -----------------------------------------------------------------------
	// 2  exact duplicate sibling name → conflict
	// -----------------------------------------------------------------------

	it("2. root and nested exact duplicate => CmsError conflict; same name other parent/collection allowed", async () => {
		// Root duplicate — exact match
		await store.createFolder({ collection: "fc2", parentId: null, name: "Docs" });

		let err1: unknown;
		try {
			await store.createFolder({ collection: "fc2", parentId: null, name: "Docs" });
		} catch (e) {
			err1 = e;
		}
		expectCmsError(err1, "folder_name_conflict");

		// Nested parent — duplicate under SAME nested parent (exact)
		const nestedParent = await store.createFolder({ collection: "fc2", parentId: null, name: "Nested" });
		await store.createFolder({ collection: "fc2", parentId: nestedParent.id, name: "Sub" });

		// exact duplicate under same nested parent
		let err3: unknown;
		try {
			await store.createFolder({ collection: "fc2", parentId: nestedParent.id, name: "Sub" });
		} catch (e) {
			err3 = e;
		}
		expectCmsError(err3, "folder_name_conflict");

		// Same name under different parent is OK
		const otherParent = await store.createFolder({ collection: "fc2", parentId: null, name: "Other" });
		const nested = await store.createFolder({ collection: "fc2", parentId: otherParent.id, name: "Docs" });
		expect(nested.name).toBe("Docs");

		// Same name in different collection is OK
		const crossCol = await store.createFolder({ collection: "fc2x", parentId: null, name: "Docs" });
		expect(crossCol.name).toBe("Docs");
	}, 30_000);

	// -----------------------------------------------------------------------
	// 3  rename/move/reorder; cycle detection; cross-collection parent
	// -----------------------------------------------------------------------

	it("3. rename/move/reorder success; self and descendant => exact invalid_input and exact unchanged folder rows; cross-collection parent => invalid_input unchanged; atomic unchanged on conflict", async () => {
		const r = await store.createFolder({ collection: "fc3", parentId: null, name: "R" });
		const ch1 = await store.createFolder({ collection: "fc3", parentId: r.id, name: "CH1" });
		const ch2 = await store.createFolder({ collection: "fc3", parentId: ch1.id, name: "CH2" });
		const r2 = await store.createFolder({ collection: "fc3", parentId: null, name: "R2" });
		const _r3 = await store.createFolder({ collection: "fc3", parentId: null, name: "R3" });

		// Rename
		const renamed = await store.updateFolder({ id: ch1.id, name: "CH1_Renamed" });
		expect(renamed.name).toBe("CH1_Renamed");

		// Move to different parent
		const moved = await store.updateFolder({ id: ch2.id, parentId: r.id });
		expect(moved.parentId).toBe(r.id);

		// Reorder via position
		const reordered = await store.updateFolder({ id: ch2.id, position: 999 });
		expect(reordered.position).toBe(999);

		// Self-cycle → invalid_input
		const beforeSelf = await store.listFolders({ collection: "fc3" });
		let selfErr: unknown;
		try {
			await store.updateFolder({ id: ch1.id, parentId: ch1.id });
		} catch (e) {
			selfErr = e;
		}
		expectCmsError(selfErr, "invalid_input");
		const afterSelf = await store.listFolders({ collection: "fc3" });
		expect(afterSelf).toEqual(beforeSelf);

		// Descendant cycle → invalid_input (move R under ch2)
		const beforeDesc = await store.listFolders({ collection: "fc3" });
		let descErr: unknown;
		try {
			await store.updateFolder({ id: r.id, parentId: ch2.id });
		} catch (e) {
			descErr = e;
		}
		expectCmsError(descErr, "invalid_input");
		const afterDesc = await store.listFolders({ collection: "fc3" });
		expect(afterDesc).toEqual(beforeDesc);

		// Rename-to-conflict -> conflict, atomic unchanged
		let renameConflictErr: unknown;
		try {
			await store.updateFolder({ id: r2.id, name: "R3" }); // R3 already exists at root
		} catch (e) {
			renameConflictErr = e;
		}
		expectCmsError(renameConflictErr, "folder_name_conflict");
		const afterRenameConflict = await store.listFolders({ collection: "fc3" });
		expect(afterRenameConflict).toEqual(beforeDesc);

		// Move-to-parent with conflicting sibling -> conflict, atomic unchanged
		let moveConflictErr: unknown;
		try {
			await store.updateFolder({ id: ch2.id, parentId: null, name: "R3" }); // ch2 moved to root, named R3
		} catch (e) {
			moveConflictErr = e;
		}
		expectCmsError(moveConflictErr, "folder_name_conflict");
		const afterMoveConflict = await store.listFolders({ collection: "fc3" });
		expect(afterMoveConflict).toEqual(beforeDesc);

		// Cross-collection parent → invalid_input
		const crossRoot = await store.createFolder({ collection: "fc3_other", parentId: null, name: "XR" });
		const beforeCross = await store.listFolders({ collection: "fc3" });
		let crossErr: unknown;
		try {
			await store.updateFolder({ id: ch1.id, parentId: crossRoot.id });
		} catch (e) {
			crossErr = e;
		}
		expectCmsError(crossErr, "invalid_input");
		const afterCross = await store.listFolders({ collection: "fc3" });
		expect(afterCross).toEqual(beforeCross);

		// createFolder using parent in another collection -> invalid_input
		let createCrossErr: unknown;
		try {
			await store.createFolder({ collection: "fc3", parentId: crossRoot.id, name: "BadChild" });
		} catch (e) {
			createCrossErr = e;
		}
		expectCmsError(createCrossErr, "invalid_input");
		const afterCreateCross = await store.listFolders({ collection: "fc3" });
		expect(afterCreateCross).toEqual(beforeCross);
	}, 30_000);

	// -----------------------------------------------------------------------
	// 4  move entry to folder: version +1, conflict, cross-collection, timestamps
	// -----------------------------------------------------------------------

	it("4. move entry into folder and null: exact +1 each, wrong expected => CmsError conflict/serverVersion, cross-collection folder => invalid_input; full entry field comparisons", async () => {
		const f4 = await store.createFolder({ collection: contentCollection, parentId: null, name: "F4" });

		const entry = await seedEntry(store, {
			collection: contentCollection,
			slug: "fc4-slug",
			metadata: { title: "FC4" },
			mdx: "body text",
			schemaVersion: 1,
			contentHash: uniqueHash(),
		});

		// Publish first so we can verify published address stability
		const published = await store.publishEntry({ id: entry.id, expectedVersion: entry.version });

		const preMoveEntry = await store.getEntry(entry.id);
		const preMoveAddress = await pool.query<{ slug: string; type: string }>(
			`SELECT slug, type FROM "${schemaName}".content_addresses WHERE entry_id = $1 ORDER BY slug`,
			[entry.id],
		);

		// Move into folder
		const moved = await moveToFolder(store, {
			entryId: entry.id,
			folderId: f4.id,
			expectedVersion: published.version,
		});

		const postMoveEntry = await store.getEntry(entry.id);
		const postMoveAddress = await pool.query<{ slug: string; type: string }>(
			`SELECT slug, type FROM "${schemaName}".content_addresses WHERE entry_id = $1 ORDER BY slug`,
			[entry.id],
		);

		expect(moved.version).toBe(published.version + 1);
		expect(moved.folderId).toBe(f4.id);

		// Compare every Entry field except version
		expect({ ...postMoveEntry, version: 0, folderId: null }).toEqual({ ...preMoveEntry, version: 0, folderId: null });
		expect(postMoveAddress.rows).toEqual(preMoveAddress.rows);

		// Wrong expectedVersion → conflict with serverVersion
		let conflictErr: unknown;
		try {
			await moveToFolder(store, { entryId: entry.id, folderId: null, expectedVersion: published.version });
		} catch (e) {
			conflictErr = e;
		}
		expectCmsError(conflictErr, "conflict");
		expect((conflictErr as CmsError).serverVersion).toBe(moved.version);

		// Move back to null (unfiled)
		const unfiled = await moveToFolder(store, {
			entryId: entry.id,
			folderId: null,
			expectedVersion: moved.version,
		});

		const postUnfiledEntry = await store.getEntry(entry.id);
		const postUnfiledAddress = await pool.query<{ slug: string; type: string }>(
			`SELECT slug, type FROM "${schemaName}".content_addresses WHERE entry_id = $1 ORDER BY slug`,
			[entry.id],
		);

		expect(unfiled.version).toBe(moved.version + 1);
		expect(unfiled.folderId).toBeNull();

		// Compare every Entry field except version
		expect({ ...postUnfiledEntry, version: 0, folderId: null }).toEqual({
			...postMoveEntry,
			version: 0,
			folderId: null,
		});
		expect(postUnfiledAddress.rows).toEqual(postMoveAddress.rows);

		// Cross-collection folder → invalid_input
		// Capture pre-attempt state for full comparison after
		const preAttempt = await store.getEntry(entry.id);
		const preAttemptFolderRow = await pool.query<{ folder_id: string | null; version: number }>(
			`SELECT folder_id, version FROM "${schemaName}".entries WHERE id = $1`,
			[entry.id],
		);

		const crossFolder = await store.createFolder({ collection: "fc4_other", parentId: null, name: "XF" });
		let crossErr: unknown;
		try {
			await moveToFolder(store, {
				entryId: entry.id,
				folderId: crossFolder.id,
				expectedVersion: unfiled.version,
			});
		} catch (e) {
			crossErr = e;
		}
		expectCmsError(crossErr, "invalid_input");

		// After cross-collection invalid_input: entry version/folder/timestamps/body/address exactly unchanged
		const postAttempt = await store.getEntry(entry.id);
		expect(postAttempt).toEqual(preAttempt);

		const postAttemptFolderRow = await pool.query<{ folder_id: string | null; version: number }>(
			`SELECT folder_id, version FROM "${schemaName}".entries WHERE id = $1`,
			[entry.id],
		);
		expect(postAttemptFolderRow.rows[0]).toEqual(preAttemptFolderRow.rows[0]);
	}, 30_000);

	// -----------------------------------------------------------------------
	// 5  delete folder reparents entries and child folders; never deletes entries
	// -----------------------------------------------------------------------

	it("5. delete non-root folder reparents direct entries and child folders to deleted parent; delete root reparents to null; never deletes entries; snapshot full entries/addresses/folder exact unchanged", async () => {
		// Build tree: root → mid → leaf  (entries in mid)
		const root = await store.createFolder({ collection: contentCollection, parentId: null, name: "Root5" });
		const mid = await store.createFolder({ collection: contentCollection, parentId: root.id, name: "Mid5" });
		const leaf = await store.createFolder({ collection: contentCollection, parentId: mid.id, name: "Leaf5" });

		const e5 = await seedEntry(store, {
			collection: contentCollection,
			slug: "fc5-e",
			metadata: { title: "E5" },
			mdx: "e5 body",
			schemaVersion: 1,
			contentHash: uniqueHash(),
		});
		const e5pub = await store.publishEntry({ id: e5.id, expectedVersion: e5.version });
		const _e5moved = await moveToFolder(store, {
			entryId: e5.id,
			folderId: mid.id,
			expectedVersion: e5pub.version,
		});

		const preDeleteMidEntry = await store.getEntry(e5.id);
		const preDeleteMidAddress = await pool.query<{ slug: string; type: string }>(
			`SELECT slug, type FROM "${schemaName}".content_addresses WHERE entry_id = $1 ORDER BY slug`,
			[e5.id],
		);

		// Delete mid → leaf reparents to root, entry reparents to root
		await store.deleteFolder({ id: mid.id });

		const folders5 = await store.listFolders({ collection: contentCollection });
		expect(folders5.find((f) => f.id === mid.id)).toBeUndefined();

		const leafAfter = folders5.find((f) => f.id === leaf.id);
		expect(leafAfter?.parentId).toBe(root.id);

		// Entry still exists, reparented to root's parent (root's id since mid had root as parent)
		const e5After = await store.getEntry(e5.id);
		expect(e5After).toBeDefined();

		expect(e5After.folderId).toBe(root.id);
		// Verify entry folderId via direct DB query
		const dbRow = await pool.query<{ folder_id: string | null }>(
			`SELECT folder_id FROM "${schemaName}".entries WHERE id = $1`,
			[e5.id],
		);
		expect(dbRow.rows[0].folder_id).toBe(root.id);

		// Version and content exactly unchanged
		expect({ ...e5After, folderId: null }).toEqual({ ...preDeleteMidEntry, folderId: null });

		const postDeleteMidAddress = await pool.query<{ slug: string; type: string }>(
			`SELECT slug, type FROM "${schemaName}".content_addresses WHERE entry_id = $1 ORDER BY slug`,
			[e5.id],
		);
		expect(postDeleteMidAddress.rows).toEqual(preDeleteMidAddress.rows);

		// Now delete root → leaf reparents to null, entry reparents to null
		await store.deleteFolder({ id: root.id });

		const folders5b = await store.listFolders({ collection: contentCollection });
		expect(folders5b.find((f) => f.id === root.id)).toBeUndefined();

		const leafFinal = folders5b.find((f) => f.id === leaf.id);
		expect(leafFinal?.parentId).toBeNull();

		const dbRow2 = await pool.query<{ folder_id: string | null }>(
			`SELECT folder_id FROM "${schemaName}".entries WHERE id = $1`,
			[e5.id],
		);
		expect(dbRow2.rows[0].folder_id).toBeNull();

		const e5Final = await store.getEntry(e5.id);
		expect(e5Final.folderId).toBeNull();
		expect({ ...e5Final, folderId: null }).toEqual({ ...preDeleteMidEntry, folderId: null });
	}, 30_000);

	// -----------------------------------------------------------------------
	// 6  delete collision → conflict, atomically unchanged
	// -----------------------------------------------------------------------

	it("6. delete collision => exact conflict and atomically unchanged folders/entries", async () => {
		const parent = await store.createFolder({ collection: contentCollection, parentId: null, name: "P6" });

		// "Dup" exists at root level
		await store.createFolder({ collection: contentCollection, parentId: null, name: "Dup" });

		// "Dup" also under parent (same name, different parent = OK)
		await store.createFolder({ collection: contentCollection, parentId: parent.id, name: "Dup" });

		// Seed an entry in the to-be-deleted parent
		const e6 = await seedEntry(store, {
			collection: contentCollection,
			slug: "fc6-e",
			metadata: { title: "E6" },
			mdx: "e6 body",
			schemaVersion: 1,
			contentHash: uniqueHash(),
		});
		const e6pub = await store.publishEntry({ id: e6.id, expectedVersion: e6.version });
		const e6moved = await moveToFolder(store, {
			entryId: e6.id,
			folderId: parent.id,
			expectedVersion: e6pub.version,
		});

		// Capture raw folder rows + entry state before deletion attempt
		const beforeFolders = await store.listFolders({ collection: contentCollection });
		const beforeEntry = await store.getEntry(e6.id);
		const beforeEntryDb = await pool.query<{
			folder_id: string | null;
			version: number;
		}>(`SELECT folder_id, version FROM "${schemaName}".entries WHERE id = $1`, [e6.id]);
		expect(beforeEntryDb.rows[0]).toEqual({
			folder_id: e6moved.folderId,
			version: e6moved.version,
		});
		expect(beforeEntry.version).toBe(e6moved.version);
		const beforeBodyDb = await pool.query<{
			mdx: string;
			content_hash: string;
		}>(`SELECT mdx, content_hash FROM "${schemaName}".entry_bodies WHERE entry_id = $1 AND state = 'working'`, [e6.id]);
		const beforeAddress = await pool.query<{ slug: string; type: string }>(
			`SELECT slug, type FROM "${schemaName}".content_addresses WHERE entry_id = $1 ORDER BY slug`,
			[e6.id],
		);

		// Deleting parent would reparent child "Dup" to root, colliding with existing root "Dup"
		let delErr: unknown;
		try {
			await store.deleteFolder({ id: parent.id });
		} catch (e) {
			delErr = e;
		}
		expectCmsError(delErr, "folder_name_conflict");

		// All folders unchanged
		const afterFolders = await store.listFolders({ collection: contentCollection });
		expect(afterFolders).toEqual(beforeFolders);

		// Entry version, folder, timestamps, body, address all exactly unchanged
		const afterEntry = await store.getEntry(e6.id);
		expect(afterEntry).toEqual(beforeEntry);

		const afterEntryDb = await pool.query<{
			folder_id: string | null;
			version: number;
		}>(`SELECT folder_id, version FROM "${schemaName}".entries WHERE id = $1`, [e6.id]);
		expect(afterEntryDb.rows[0]).toEqual(beforeEntryDb.rows[0]);

		const afterBodyDb = await pool.query<{
			mdx: string;
			content_hash: string;
		}>(`SELECT mdx, content_hash FROM "${schemaName}".entry_bodies WHERE entry_id = $1 AND state = 'working'`, [e6.id]);
		expect(afterBodyDb.rows[0]).toEqual(beforeBodyDb.rows[0]);

		const afterAddress = await pool.query<{ slug: string; type: string }>(
			`SELECT slug, type FROM "${schemaName}".content_addresses WHERE entry_id = $1 ORDER BY slug`,
			[e6.id],
		);
		expect(afterAddress.rows).toEqual(beforeAddress.rows);
	}, 30_000);

	// -----------------------------------------------------------------------
	// 7  not_found exact codes
	// -----------------------------------------------------------------------

	it("7. not_found exact codes for update and delete of nonexistent folder", async () => {
		const bogusId = "00000000-0000-0000-0000-000000000000";

		let updateErr: unknown;
		try {
			await store.updateFolder({ id: bogusId, name: "nope" });
		} catch (e) {
			updateErr = e;
		}
		expectCmsError(updateErr, "not_found");

		let deleteErr: unknown;
		try {
			await store.deleteFolder({ id: bogusId });
		} catch (e) {
			deleteErr = e;
		}
		expectCmsError(deleteErr, "not_found");
	}, 30_000);

	// -----------------------------------------------------------------------
	// 8  Concurrency opposing moves
	// -----------------------------------------------------------------------

	it("8. Folder concurrency: concurrent opposing moves (A under B, B under A) fulfills one, rejects other with invalid_input, graph is acyclic", async () => {
		const lockId = randomBytes(4).readInt32BE();
		const appName = `test8_${randomBytes(4).toString("hex")}`;
		const funcName = `trig_func_${randomBytes(4).toString("hex")}`;
		const triggerName = `trig_${randomBytes(4).toString("hex")}`;
		const url = process.env.CMS_TEST_DATABASE_URL;
		if (!url) {
			throw new Error("CMS_TEST_DATABASE_URL is required");
		}

		const customPool = new Pool({
			connectionString: url,
			max: 2,
			application_name: appName,
		});
		const customStore = createContentStore(customPool, { schema: schemaName }) as unknown as typeof store;
		const gateClient = await pool.connect();

		let lockHeld = false;
		let triggerCreated = false;
		let funcCreated = false;

		const fA = await store.createFolder({ collection: "fc8", parentId: null, name: "A" });
		const fB = await store.createFolder({ collection: "fc8", parentId: null, name: "B" });

		let p1: Promise<unknown> | undefined;
		let p2: Promise<unknown> | undefined;

		try {
			await gateClient.query("SELECT pg_advisory_lock($1)", [lockId]);
			lockHeld = true;

			await pool.query(`
				CREATE FUNCTION "${schemaName}"."${funcName}"() RETURNS trigger AS $$
				BEGIN
					PERFORM pg_advisory_lock(${lockId});
					PERFORM pg_advisory_unlock(${lockId});
					RETURN NEW;
				END;
				$$ LANGUAGE plpgsql;
			`);
			funcCreated = true;

			await pool.query(`
				CREATE TRIGGER "${triggerName}" BEFORE UPDATE ON "${schemaName}".folders
				FOR EACH ROW EXECUTE FUNCTION "${schemaName}"."${funcName}"();
			`);
			triggerCreated = true;

			p1 = customStore.updateFolder({ id: fA.id, parentId: fB.id });
			p2 = customStore.updateFolder({ id: fB.id, parentId: fA.id });

			await expect
				.poll(
					async () => {
						const res = await pool.query(
							"SELECT state, wait_event FROM pg_stat_activity WHERE application_name = $1 AND pid <> pg_backend_pid()",
							[appName],
						);
						return res.rows.filter((r) => r.state === "active" && r.wait_event !== null).length;
					},
					{ timeout: 15_000 },
				)
				.toBe(2);

			await gateClient.query("SELECT pg_advisory_unlock($1)", [lockId]);
			lockHeld = false;

			const results = await Promise.allSettled([p1, p2]);

			const fulfilled = results.filter((r) => r.status === "fulfilled");
			const rejected = results.filter((r) => r.status === "rejected");

			expect(fulfilled).toHaveLength(1);
			expect(rejected).toHaveLength(1);

			const err = (rejected[0] as PromiseRejectedResult).reason;
			expectCmsError(err, "invalid_input");

			const folders = await store.listFolders({ collection: "fc8" });
			const map = new Map(folders.map((f) => [f.id, f.parentId]));

			const aParent = map.get(fA.id);
			const bParent = map.get(fB.id);

			expect([aParent, bParent]).toContain(null);
			if (aParent === null) {
				expect(bParent).toBe(fA.id);
			} else {
				expect(aParent).toBe(fB.id);
			}
		} finally {
			if (lockHeld) {
				await gateClient.query("SELECT pg_advisory_unlock($1)", [lockId]).catch(() => {});
			}

			// Await hanging promises to release table locks before dropping trigger
			if (p1 && p2) {
				await Promise.allSettled([p1, p2]);
			}

			if (triggerCreated) {
				await pool.query(`DROP TRIGGER IF EXISTS "${triggerName}" ON "${schemaName}".folders CASCADE`);
			}
			if (funcCreated) {
				await pool.query(`DROP FUNCTION IF EXISTS "${schemaName}"."${funcName}"() CASCADE`);
			}
			gateClient.release();
			await customPool.end();
		}
	}, 30_000);
});
