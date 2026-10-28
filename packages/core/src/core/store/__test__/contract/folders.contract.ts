import { randomBytes } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { contentCollection, fillRequiredMetadata } from "../../../../../test/any-site";
import { testSite } from "../../../../../test/site";
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

/** A second folder scope that always uses folders: the media library. Used where a test needs folders of another collection. */
const OTHER_SCOPE = "media";

/** Contract of FolderStore. */
export const foldersContract: ContractSuite = (factory) => {
	describe("FolderStore: folders", () => {
		let session: StoreSession;
		let store: ContentStore;

		beforeEach(async () => {
			session = await factory.create();
			store = session.store;
			// Required-for-publish values (such as the reference blog's category) are looked up in the config and filled in.
			fillRequiredMetadata(store);
		});

		afterEach(async () => {
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
			const r1 = await store.createFolder({
				collection: contentCollection,
				parentId: null,
				name: "Root1",
				position: 20,
			});
			const r2 = await store.createFolder({
				collection: contentCollection,
				parentId: null,
				name: "Root2",
				position: 10,
			});
			// r2 (10) should come before r1 (20)

			// UUID validity
			expect(r1.id).toMatch(UUID_RE);

			expect(r1.collection).toBe(contentCollection);
			expect(r1.parentId).toBeNull();
			expect(r1.name).toBe("Root1");
			expect(typeof r1.position).toBe("number");

			// Nested child
			const c1 = await store.createFolder({
				collection: contentCollection,
				parentId: r1.id,
				name: "Child1",
				position: 20,
			});
			expect(c1.parentId).toBe(r1.id);

			// Explicit position
			const c2 = await store.createFolder({
				collection: contentCollection,
				parentId: r1.id,
				name: "Child2",
				position: 10,
			});
			expect(c2.position).toBe(10);

			// Same-position siblings under r1 to prove id ASC tie-break
			const c3 = await store.createFolder({
				collection: contentCollection,
				parentId: r1.id,
				name: "Child3",
				position: 10,
			});
			expect(c3.position).toBe(10);

			// List returns all including nested — assert deterministic order directly
			const list = await store.listFolders({ collection: contentCollection });
			expect(list).toHaveLength(5);

			// Verify returned order: parentId/root grouping then position ASC then id ASC
			// Root folders first: r2 (10), r1 (20)
			// Children under r1: c2 (10), c3 (10), c1 (20). c2 and c3 tied, sort by id ASC.
			const rRoots = [r2, r1].sort((a, b) => a.position - b.position || a.id.localeCompare(b.id));
			const rChildren = [c2, c3, c1].sort((a, b) => a.position - b.position || a.id.localeCompare(b.id));

			const expectedIds = [...rRoots.map((f) => f.id), ...rChildren.map((f) => f.id)];
			expect(list.map((f) => f.id)).toEqual(expectedIds);

			// Collection isolation — folders of one scope are not listed in another
			await store.createFolder({ collection: OTHER_SCOPE, parentId: null, name: "OtherRoot" });
			const otherList = await store.listFolders({ collection: OTHER_SCOPE });
			expect(otherList).toHaveLength(1);
			expect(otherList[0].name).toBe("OtherRoot");
		}, 30_000);

		// -----------------------------------------------------------------------
		// 2  exact duplicate sibling name → conflict
		// -----------------------------------------------------------------------

		it("2. root and nested exact duplicate => CmsError conflict; same name other parent/collection allowed", async () => {
			// Root duplicate — exact match
			await store.createFolder({ collection: contentCollection, parentId: null, name: "Docs" });

			let err1: unknown;
			try {
				await store.createFolder({ collection: contentCollection, parentId: null, name: "Docs" });
			} catch (e) {
				err1 = e;
			}
			expectCmsError(err1, "folder_name_conflict");

			// Nested parent — duplicate under SAME nested parent (exact)
			const nestedParent = await store.createFolder({ collection: contentCollection, parentId: null, name: "Nested" });
			await store.createFolder({ collection: contentCollection, parentId: nestedParent.id, name: "Sub" });

			// exact duplicate under same nested parent
			let err3: unknown;
			try {
				await store.createFolder({ collection: contentCollection, parentId: nestedParent.id, name: "Sub" });
			} catch (e) {
				err3 = e;
			}
			expectCmsError(err3, "folder_name_conflict");

			// Same name under different parent is OK
			const otherParent = await store.createFolder({ collection: contentCollection, parentId: null, name: "Other" });
			const nested = await store.createFolder({
				collection: contentCollection,
				parentId: otherParent.id,
				name: "Docs",
			});
			expect(nested.name).toBe("Docs");

			// Same name in different collection is OK
			const crossCol = await store.createFolder({ collection: OTHER_SCOPE, parentId: null, name: "Docs" });
			expect(crossCol.name).toBe("Docs");
		}, 30_000);

		// -----------------------------------------------------------------------
		// 3  rename/move/reorder; cycle detection; cross-collection parent
		// -----------------------------------------------------------------------

		it("3. rename/move/reorder success; self and descendant => exact invalid_input and exact unchanged folder rows; cross-collection parent => invalid_input unchanged; atomic unchanged on conflict", async () => {
			const r = await store.createFolder({ collection: contentCollection, parentId: null, name: "R" });
			const ch1 = await store.createFolder({ collection: contentCollection, parentId: r.id, name: "CH1" });
			const ch2 = await store.createFolder({ collection: contentCollection, parentId: ch1.id, name: "CH2" });
			const r2 = await store.createFolder({ collection: contentCollection, parentId: null, name: "R2" });
			const _r3 = await store.createFolder({ collection: contentCollection, parentId: null, name: "R3" });

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
			const beforeSelf = await store.listFolders({ collection: contentCollection });
			let selfErr: unknown;
			try {
				await store.updateFolder({ id: ch1.id, parentId: ch1.id });
			} catch (e) {
				selfErr = e;
			}
			expectCmsError(selfErr, "invalid_input");
			expect((selfErr as CmsError).notice).toEqual({ key: "folder.cycle" });
			const afterSelf = await store.listFolders({ collection: contentCollection });
			expect(afterSelf).toEqual(beforeSelf);

			// Descendant cycle → invalid_input (move R under ch2)
			const beforeDesc = await store.listFolders({ collection: contentCollection });
			let descErr: unknown;
			try {
				await store.updateFolder({ id: r.id, parentId: ch2.id });
			} catch (e) {
				descErr = e;
			}
			expectCmsError(descErr, "invalid_input");
			expect((descErr as CmsError).notice).toEqual({ key: "folder.cycle" });
			const afterDesc = await store.listFolders({ collection: contentCollection });
			expect(afterDesc).toEqual(beforeDesc);

			// Rename-to-conflict -> conflict, atomic unchanged
			let renameConflictErr: unknown;
			try {
				await store.updateFolder({ id: r2.id, name: "R3" }); // R3 already exists at root
			} catch (e) {
				renameConflictErr = e;
			}
			expectCmsError(renameConflictErr, "folder_name_conflict");
			const afterRenameConflict = await store.listFolders({ collection: contentCollection });
			expect(afterRenameConflict).toEqual(beforeDesc);

			// Move-to-parent with conflicting sibling -> conflict, atomic unchanged
			let moveConflictErr: unknown;
			try {
				await store.updateFolder({ id: ch2.id, parentId: null, name: "R3" }); // ch2 moved to root, named R3
			} catch (e) {
				moveConflictErr = e;
			}
			expectCmsError(moveConflictErr, "folder_name_conflict");
			const afterMoveConflict = await store.listFolders({ collection: contentCollection });
			expect(afterMoveConflict).toEqual(beforeDesc);

			// Cross-collection parent → invalid_input
			const crossRoot = await store.createFolder({ collection: OTHER_SCOPE, parentId: null, name: "XR" });
			const beforeCross = await store.listFolders({ collection: contentCollection });
			let crossErr: unknown;
			try {
				await store.updateFolder({ id: ch1.id, parentId: crossRoot.id });
			} catch (e) {
				crossErr = e;
			}
			expectCmsError(crossErr, "invalid_input");
			const afterCross = await store.listFolders({ collection: contentCollection });
			expect(afterCross).toEqual(beforeCross);

			// createFolder using parent in another collection -> invalid_input
			let createCrossErr: unknown;
			try {
				await store.createFolder({ collection: contentCollection, parentId: crossRoot.id, name: "BadChild" });
			} catch (e) {
				createCrossErr = e;
			}
			expectCmsError(createCrossErr, "invalid_input");
			const afterCreateCross = await store.listFolders({ collection: contentCollection });
			expect(afterCreateCross).toEqual(beforeCross);
		}, 30_000);

		// -----------------------------------------------------------------------
		// 3b  how many things sit directly in a folder
		// -----------------------------------------------------------------------

		it("3b. listFolders counts the entries directly in each folder, leaving out the trash, the entries of other folders and those of subfolders", async () => {
			const parent = await store.createFolder({ collection: contentCollection, parentId: null, name: "Counted" });
			const child = await store.createFolder({ collection: contentCollection, parentId: parent.id, name: "Inside" });
			const empty = await store.createFolder({ collection: contentCollection, parentId: null, name: "Empty" });
			const seed = (slug: string, folderId: string | null) =>
				seedEntry(store, {
					collection: contentCollection,
					slug,
					metadata: { title: slug },
					contentHash: uniqueHash(),
					folderId,
				});
			await seed("count-a", parent.id);
			await seed("count-b", parent.id);
			await seed("count-c", child.id);
			await seed("count-loose", null);
			const gone = await seed("count-gone", parent.id);
			await store.trashEntry({ id: gone.id, expectedVersion: gone.version });

			const counts = Object.fromEntries(
				(await store.listFolders({ collection: contentCollection })).map((folder) => [folder.id, folder.entryCount]),
			);
			expect(counts).toEqual({ [parent.id]: 2, [child.id]: 1, [empty.id]: 0 });
		});

		it("3c. listFolders counts the ready files of a media folder, not the ones still uploading", async () => {
			const folder = await store.createFolder({ collection: OTHER_SCOPE, parentId: null, name: "Pictures" });
			const upload = async (filename: string, ready: boolean) => {
				const media = await store.createMediaAsset({
					filename,
					mimeType: "image/png",
					byteSize: 10,
					stagingKey: `staging/${filename}`,
					folderId: folder.id,
				});
				if (ready)
					await store.completeMediaAsset({
						id: media.id,
						storageKey: `media/${filename}`,
						mimeType: "image/png",
						byteSize: 10,
						width: 1,
						height: 1,
					});
			};
			await upload("count-1.png", true);
			await upload("count-2.png", true);
			await upload("count-pending.png", false);
			const listed = await store.listFolders({ collection: OTHER_SCOPE });
			expect(listed.find((item) => item.id === folder.id)?.entryCount).toBe(2);
		});

		// -----------------------------------------------------------------------
		// 4  move entry to folder: version +1, conflict, cross-collection, timestamps
		// -----------------------------------------------------------------------

		it("4. move entry into folder and null: exact +1 each, wrong expected => CmsError conflict/serverVersion, cross-collection folder => invalid_input; full entry field comparisons", async () => {
			const f4 = await store.createFolder({ collection: contentCollection, parentId: null, name: "F4" });

			const entry = await seedEntry(store, {
				collection: contentCollection,
				slug: "fc4-slug",
				metadata: { title: "FC4" },
				text: "body text",
				contentHash: uniqueHash(),
			});

			// Publish first so we can verify published address stability
			const published = await publishDraft(testSite, store, { id: entry.id, expectedVersion: entry.version });

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

			// Compare every Entry field except version, the folder and the time of the change (a move is a change that raises the version, so it moves `changedAt`
			// while the content modified date `updatedAt` stays).
			expect(postMoveEntry.changedAt?.getTime()).toBeGreaterThanOrEqual(preMoveEntry.changedAt?.getTime() ?? 0);
			expect({ ...postMoveEntry, version: 0, folderId: null, changedAt: undefined }).toEqual({
				...preMoveEntry,
				version: 0,
				folderId: null,
				changedAt: undefined,
			});
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

			// Compare every Entry field except version, the folder and the time of the change
			expect({ ...postUnfiledEntry, version: 0, folderId: null, changedAt: undefined }).toEqual({
				...postMoveEntry,
				version: 0,
				folderId: null,
				changedAt: undefined,
			});
			expect(postUnfiledAddress).toEqual(postMoveAddress);

			// Cross-collection folder → invalid_input
			// Capture pre-attempt state for full comparison after
			const preAttempt = await store.getEntry(entry.id);

			const crossFolder = await store.createFolder({ collection: OTHER_SCOPE, parentId: null, name: "XF" });
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
		// 7  not_found exact codes
		// -----------------------------------------------------------------------

		it("7. not_found exact codes for update and trash of nonexistent folder", async () => {
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
				await store.trashFolder({ id: bogusId });
			} catch (e) {
				deleteErr = e;
			}
			expectCmsError(deleteErr, "not_found");
		}, 30_000);
		// -----------------------------------------------------------------------
		// 8  collections without folders
		// -----------------------------------------------------------------------

		describe("a collection without folders", () => {
			const noFolders = testSite.COLLECTIONS.find((name) => !testSite.foldersEnabled(name));

			it.skipIf(!noFolders)(
				"rejects creating and listing folders with invalid_input",
				async () => {
					const collection = noFolders as string;
					await expect(store.createFolder({ collection, parentId: null, name: "Nope" })).rejects.toMatchObject({
						code: "invalid_input",
					});
					await expect(store.listFolders({ collection })).rejects.toMatchObject({ code: "invalid_input" });
				},
				30_000,
			);

			it.skipIf(!noFolders)(
				"rejects moving an entry into a folder of another collection",
				async () => {
					const collection = noFolders as string;
					const folder = await store.createFolder({ collection: contentCollection, parentId: null, name: "Elsewhere" });
					await expect(
						seedEntry(store, { collection, slug: null, metadata: { title: "T" }, folderId: folder.id }),
					).rejects.toMatchObject({ code: "invalid_input" });
					const entry = await seedEntry(store, { collection, slug: null, metadata: { title: "T" } });
					await expect(
						moveToFolder(store, { entryId: entry.id, folderId: folder.id, expectedVersion: entry.version }),
					).rejects.toMatchObject({ code: "invalid_input" });
					expect((await store.getEntry(entry.id)).folderId).toBeNull();
				},
				30_000,
			);
		});
	});
};
