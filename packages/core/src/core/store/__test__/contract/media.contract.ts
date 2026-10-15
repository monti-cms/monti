import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { ContentStore } from "../..";
import type { ContractSuite, StoreSession } from "./harness";

/** Contract of MediaMetadataStore. */
export const mediaContract: ContractSuite = (factory) => {
	describe("MediaMetadataStore: media list kind filter", () => {
		let session: StoreSession;
		let store: ContentStore;

		const addReady = async (filename: string, mimeType: string, image: boolean) => {
			const media = await store.createMediaAsset({
				filename,
				mimeType,
				byteSize: 10,
				stagingKey: `staging/${filename}`,
			});
			await store.completeMediaAsset({
				id: media.id,
				storageKey: `media/${filename}`,
				mimeType,
				byteSize: 10,
				width: image ? 1 : null,
				height: image ? 1 : null,
			});
		};

		beforeAll(async () => {
			session = await factory.create();
			store = session.store;
			await addReady("a.png", "image/png", true);
			await addReady("b.webp", "image/webp", true);
			await addReady("c.pdf", "application/pdf", false);
			await addReady("d.md", "text/markdown", false);
		});

		afterAll(async () => {
			await session.close();
		});

		const names = async (params: Parameters<ContentStore["listMediaAssets"]>[0]) =>
			(await store.listMediaAssets(params)).items.map((item) => item.filename).sort();

		it("separates images and files by kind", async () => {
			expect(await names({})).toEqual(["a.png", "b.webp", "c.pdf", "d.md"]);
			expect(await names({ kind: "all" })).toEqual(["a.png", "b.webp", "c.pdf", "d.md"]);
			expect(await names({ kind: "image" })).toEqual(["a.png", "b.webp"]);
			expect(await names({ kind: "file" })).toEqual(["c.pdf", "d.md"]);
		});

		it("keeps the mimeType filter working", async () => {
			expect(await names({ mimeType: "image/png" })).toEqual(["a.png"]);
		});
	});

	describe("MediaMetadataStore: media by storage key", () => {
		let session: StoreSession;
		let store: ContentStore;

		beforeAll(async () => {
			session = await factory.create();
			store = session.store;
		});

		afterAll(async () => {
			await session.close();
		});

		const upload = async (filename: string, storageKey: string, ready: boolean) => {
			const media = await store.createMediaAsset({
				filename,
				mimeType: "image/png",
				byteSize: 10,
				stagingKey: `staging/${filename}`,
			});
			if (ready) {
				await store.completeMediaAsset({
					id: media.id,
					storageKey,
					mimeType: "image/png",
					byteSize: 10,
					width: 1,
					height: 1,
				});
			}
			return media.id;
		};

		it("finds the ready files stored under the keys it is given, and leaves out a key no ready file holds", async () => {
			const first = await upload("by-key-1.png", "media/by-key-1.png", true);
			const second = await upload("by-key-2.png", "media/by-key-2.png", true);
			await upload("by-key-pending.png", "media/by-key-pending.png", false);

			const found = await store.findReadyMediaByStorageKeys({
				keys: ["media/by-key-1.png", "media/by-key-2.png", "media/by-key-pending.png", "media/nobody.png"],
			});

			expect(found.sort((a, b) => a.storageKey.localeCompare(b.storageKey))).toEqual([
				{ id: first, storageKey: "media/by-key-1.png" },
				{ id: second, storageKey: "media/by-key-2.png" },
			]);
		});

		it("asks nothing for no keys", async () => {
			expect(await store.findReadyMediaByStorageKeys({ keys: [] })).toEqual([]);
		});
	});

	describe("MediaMetadataStore: virtual folders and hierarchy", () => {
		let session: StoreSession;
		let store: ContentStore;
		let rootFolder: string;
		let subFolder: string;

		beforeAll(async () => {
			session = await factory.create();
			store = session.store;
			const parent = await store.createFolder({ collection: "media", name: "Folder A", parentId: null });
			rootFolder = parent.id;
			const child = await store.createFolder({ collection: "media", name: "Folder B", parentId: rootFolder });
			subFolder = child.id;
		});

		afterAll(async () => {
			await session.close();
		});

		it("creates media assets in folders and filters them by folderId and includeDescendants", async () => {
			const rootMedia = await store.createMediaAsset({
				filename: "root.png",
				mimeType: "image/png",
				byteSize: 10,
				stagingKey: "staging/root.png",
				folderId: null,
			});
			await store.completeMediaAsset({
				id: rootMedia.id,
				storageKey: "media/root.png",
				mimeType: "image/png",
				byteSize: 10,
				width: 1,
				height: 1,
			});

			const folderAMedia = await store.createMediaAsset({
				filename: "folderA.png",
				mimeType: "image/png",
				byteSize: 10,
				stagingKey: "staging/folderA.png",
				folderId: rootFolder,
			});
			await store.completeMediaAsset({
				id: folderAMedia.id,
				storageKey: "media/folderA.png",
				mimeType: "image/png",
				byteSize: 10,
				width: 1,
				height: 1,
			});

			const folderBMedia = await store.createMediaAsset({
				filename: "folderB.png",
				mimeType: "image/png",
				byteSize: 10,
				stagingKey: "staging/folderB.png",
				folderId: subFolder,
			});
			await store.completeMediaAsset({
				id: folderBMedia.id,
				storageKey: "media/folderB.png",
				mimeType: "image/png",
				byteSize: 10,
				width: 1,
				height: 1,
			});

			// All media (folderId undefined)
			const all = await store.listMediaAssets({});
			expect(all.items.map((m) => m.filename).sort()).toEqual(["folderA.png", "folderB.png", "root.png"]);

			// Unfiled/root media (folderId null)
			const unfiled = await store.listMediaAssets({ folderId: null });
			expect(unfiled.items.map((m) => m.filename)).toEqual(["root.png"]);

			// Folder A without descendants
			const inFolderA = await store.listMediaAssets({ folderId: rootFolder, includeDescendants: false });
			expect(inFolderA.items.map((m) => m.filename)).toEqual(["folderA.png"]);

			// Folder A with descendants (Folder A + Folder B)
			const inFolderAWithDescendants = await store.listMediaAssets({ folderId: rootFolder, includeDescendants: true });
			expect(inFolderAWithDescendants.items.map((m) => m.filename).sort()).toEqual(["folderA.png", "folderB.png"]);

			// Folder B
			const inFolderB = await store.listMediaAssets({ folderId: subFolder });
			expect(inFolderB.items.map((m) => m.filename)).toEqual(["folderB.png"]);

			// Folder contents count
			const contentsA = await store.getFolderContents({ id: rootFolder });
			expect(contentsA.entryCount).toBe(1);

			// Moving media to another folder
			await store.updateMediaMetadata({ id: rootMedia.id, folderId: rootFolder });
			const contentsAAfterMove = await store.getFolderContents({ id: rootFolder });
			expect(contentsAAfterMove.entryCount).toBe(2);

			// Moving back to null
			await store.updateMediaMetadata({ id: rootMedia.id, folderId: null });
			const contentsAAfterReset = await store.getFolderContents({ id: rootFolder });
			expect(contentsAAfterReset.entryCount).toBe(1);

			// Deleting subFolder reparents its media to rootFolder
			await store.deleteFolder({ id: subFolder, expectedVersion: 1 });
			const inFolderAAfterDelete = await store.listMediaAssets({ folderId: rootFolder });
			expect(inFolderAAfterDelete.items.map((m) => m.filename).sort()).toEqual(["folderA.png", "folderB.png"]);
		});
	});
};
