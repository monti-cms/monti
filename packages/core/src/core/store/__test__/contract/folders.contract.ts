import { randomBytes } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { contentCollection, fillRequiredMetadata } from "../../../../../test/any-site";
import { CmsError, type ContentStore } from "../..";
import { moveToFolder, publishDraft, seedEntry } from "../seed";
import type { ContractSuite, StoreSession } from "./harness";

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

/** Contract of FolderStore. */
export const foldersContract: ContractSuite = (factory) => {
	describe("FolderStore: folders", () => {
		let session: StoreSession;
		let store: ContentStore;

		beforeAll(async () => {
			session = await factory.create();
			store = session.store;
			// Required-for-publish values (such as the reference blog's category) are looked up in the config and filled in.
			fillRequiredMetadata(store);
		});

		afterAll(async () => {
			await session.close();
		});

		// -----------------------------------------------------------------------
		// Fixture helpers
		// -----------------------------------------------------------------------

		let seqCounter = 0;
		function uniqueHash(): string {
			seqCounter += 1;
			return `fh${seqCounter}_${randomBytes(4).toString("hex")}`;
		}

		/**
		 * The public address of a published entry as the store resolves it: which entry the slug leads to, and whether it is the current slug.
		 * A move between folders must not change it.
		 */
		const publicAddress = async (slug: string) => {
			const lookup = await store.getPublishedEntryBySlug({ collection: contentCollection, slug });
			return lookup.status === "not_found"
				? { status: lookup.status }
				: { status: lookup.status, id: lookup.entry.id, slug: lookup.entry.slug };
		};

		// -----------------------------------------------------------------------
		// 1  create/list nesting, UUID validity, collection isolation, position
		//
		// listFolders contract: returns folders in deterministic order:
		//   parentId/root grouping then position ASC then id ASC
		// -----------------------------------------------------------------------

		it("1. create/list nesting with UUID validity, collection isolation, deterministic listFolders order (parentId/root grouping → position ASC → id ASC) including same-position siblings", async () => {
			const r1 = await store.createFolder({ collection: "fc1", parentId: null, name: "Root1", position: 20 });
			const r2 = await store.createFolder({ collection: "fc1", parentId: null, name: "Root2", position: 10 });
			// r2 (10) should come before r1 (20)

			// UUID validity
			expect(r1.id).toMatch(UUID_RE);

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
			const published = await publishDraft(store, { id: entry.id, expectedVersion: entry.version });

			const preMoveEntry = await store.getEntry(entry.id);
			const preMoveAddress = await publicAddress("fc4-slug");
			expect(preMoveAddress).toEqual({ status: "current", id: entry.id, slug: "fc4-slug" });

			// Move into folder
			const moved = await moveToFolder(store, {
				entryId: entry.id,
				folderId: f4.id,
				expectedVersion: published.version,
			});

			const postMoveEntry = await store.getEntry(entry.id);
			const postMoveAddress = await publicAddress("fc4-slug");

			expect(moved.version).toBe(published.version + 1);
			expect(moved.folderId).toBe(f4.id);

			// Compare every Entry field except version
			expect({ ...postMoveEntry, version: 0, folderId: null }).toEqual({ ...preMoveEntry, version: 0, folderId: null });
			expect(postMoveAddress).toEqual(preMoveAddress);

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
			const postUnfiledAddress = await publicAddress("fc4-slug");

			expect(unfiled.version).toBe(moved.version + 1);
			expect(unfiled.folderId).toBeNull();

			// Compare every Entry field except version
			expect({ ...postUnfiledEntry, version: 0, folderId: null }).toEqual({
				...postMoveEntry,
				version: 0,
				folderId: null,
			});
			expect(postUnfiledAddress).toEqual(postMoveAddress);

			// Cross-collection folder → invalid_input
			// Capture pre-attempt state for full comparison after
			const preAttempt = await store.getEntry(entry.id);

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
			expect({ folderId: postAttempt.folderId, version: postAttempt.version }).toEqual({
				folderId: preAttempt.folderId,
				version: preAttempt.version,
			});
			expect(await publicAddress("fc4-slug")).toEqual(postUnfiledAddress);
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
			const e5pub = await publishDraft(store, { id: e5.id, expectedVersion: e5.version });
			const _e5moved = await moveToFolder(store, {
				entryId: e5.id,
				folderId: mid.id,
				expectedVersion: e5pub.version,
			});

			const preDeleteMidEntry = await store.getEntry(e5.id);
			const preDeleteMidAddress = await publicAddress("fc5-e");
			expect(preDeleteMidAddress).toEqual({ status: "current", id: e5.id, slug: "fc5-e" });

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

			// Version and content exactly unchanged
			expect({ ...e5After, folderId: null }).toEqual({ ...preDeleteMidEntry, folderId: null });

			expect(await publicAddress("fc5-e")).toEqual(preDeleteMidAddress);

			// Now delete root → leaf reparents to null, entry reparents to null
			await store.deleteFolder({ id: root.id });

			const folders5b = await store.listFolders({ collection: contentCollection });
			expect(folders5b.find((f) => f.id === root.id)).toBeUndefined();

			const leafFinal = folders5b.find((f) => f.id === leaf.id);
			expect(leafFinal?.parentId).toBeNull();

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
			const e6pub = await publishDraft(store, { id: e6.id, expectedVersion: e6.version });
			const e6moved = await moveToFolder(store, {
				entryId: e6.id,
				folderId: parent.id,
				expectedVersion: e6pub.version,
			});

			// Capture folder rows + entry state before deletion attempt
			const beforeFolders = await store.listFolders({ collection: contentCollection });
			const beforeEntry = await store.getEntry(e6.id);
			expect({ folderId: beforeEntry.folderId, version: beforeEntry.version }).toEqual({
				folderId: e6moved.folderId,
				version: e6moved.version,
			});
			expect(beforeEntry.version).toBe(e6moved.version);
			const beforeWorking = await store.getWorking({ entryId: e6.id });
			const beforeAddress = await publicAddress("fc6-e");

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
			expect({ folderId: afterEntry.folderId, version: afterEntry.version }).toEqual({
				folderId: beforeEntry.folderId,
				version: beforeEntry.version,
			});

			const afterWorking = await store.getWorking({ entryId: e6.id });
			expect(afterWorking).toEqual(beforeWorking);
			expect({ mdx: afterEntry.working.mdx, contentHash: afterEntry.working.contentHash }).toEqual({
				mdx: beforeEntry.working.mdx,
				contentHash: beforeEntry.working.contentHash,
			});

			expect(await publicAddress("fc6-e")).toEqual(beforeAddress);
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
	});
};
