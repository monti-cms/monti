import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { contentCollection } from "../../../../../test/any-site";
import { docOf } from "../../../../../test/stored-content";
import type { ContentStore } from "../..";
import { CmsError } from "../..";
import type { ContractSuite, StoreSession } from "./harness";

/** An entry whose body refers to the media file (a reference row, nothing else), so the file counts as used. */
const referToMedia = (store: ContentStore, mediaId: string) =>
	store.createEntryWithReferences({
		snapshot: {
			collection: contentCollection,
			slug: `uses-${mediaId}`,
			metadata: { title: "Uses a media file" },
			doc: docOf(""),
			contentHash: `uses-${mediaId}`,
			references: [],
			issues: [],
			imageSources: [],
		} as never,
		references: [{ kind: "media", targetId: mediaId, isStale: false, occurrences: [] }],
	});

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
			expect(contentsA.files).toBe(2);

			// Moving media to another folder
			await store.updateMediaMetadata({ id: rootMedia.id, folderId: rootFolder });
			const contentsAAfterMove = await store.getFolderContents({ id: rootFolder });
			expect(contentsAAfterMove.files).toBe(3);

			// Moving back to null
			await store.updateMediaMetadata({ id: rootMedia.id, folderId: null });
			const contentsAAfterReset = await store.getFolderContents({ id: rootFolder });
			expect(contentsAAfterReset.files).toBe(2);
		});
	});

	describe("MediaMetadataStore: alt text condition and counts", () => {
		let session: StoreSession;
		let store: ContentStore;
		let folderA: string;
		let folderB: string;
		let usedId: string;

		const addReady = async (input: {
			filename: string;
			mimeType: string;
			alt?: string;
			folderId?: string | null;
		}): Promise<string> => {
			const image = input.mimeType.startsWith("image/");
			const media = await store.createMediaAsset({
				filename: input.filename,
				mimeType: input.mimeType,
				byteSize: 10,
				stagingKey: `staging/${input.filename}`,
				...(input.folderId !== undefined ? { folderId: input.folderId } : {}),
			});
			await store.completeMediaAsset({
				id: media.id,
				storageKey: `media/${input.filename}`,
				mimeType: input.mimeType,
				byteSize: 10,
				width: image ? 1 : null,
				height: image ? 1 : null,
			});
			if (input.alt !== undefined) await store.updateMediaMetadata({ id: media.id, defaultAlt: input.alt });
			return media.id;
		};

		beforeAll(async () => {
			session = await factory.create();
			store = session.store;
			folderA = (await store.createFolder({ collection: "media", name: "Alt A", parentId: null })).id;
			folderB = (await store.createFolder({ collection: "media", name: "Alt B", parentId: folderA })).id;
			await addReady({ filename: "cat.png", mimeType: "image/png", alt: "A cat", folderId: folderA });
			await addReady({ filename: "dog.png", mimeType: "image/png", folderId: folderA });
			await addReady({ filename: "bird.webp", mimeType: "image/webp", alt: "   ", folderId: folderB });
			usedId = await addReady({ filename: "fish.png", mimeType: "image/png", alt: "A fish", folderId: folderB });
			// A stray alt text on an attachment never counts: alt text only exists for images.
			await addReady({ filename: "guide.pdf", mimeType: "application/pdf", alt: "stray", folderId: folderA });
			await addReady({ filename: "other.png", mimeType: "image/png" });
			await referToMedia(store, usedId);
		});

		afterAll(async () => {
			await session.close();
		});

		const names = async (params: Parameters<ContentStore["listMediaAssets"]>[0]) =>
			(await store.listMediaAssets(params)).items.map((item) => item.filename).sort();
		const counts = async (params: Parameters<ContentStore["listMediaAssets"]>[0]) => {
			const { kinds, alts } = await store.listMediaAssets(params);
			return { kinds, alts };
		};

		it("finds images without alt text: empty or only white space, and never an attachment", async () => {
			expect(await names({ alt: "none" })).toEqual(["bird.webp", "dog.png", "other.png"]);
		});

		it("finds images with alt text, and never an attachment even when it has a stray alt", async () => {
			expect(await names({ alt: "has" })).toEqual(["cat.png", "fish.png"]);
		});

		it("shows everything for alt `all` or no alt, and combines with the other conditions", async () => {
			expect(await names({ alt: "all" })).toEqual(await names({}));
			expect(await names({ alt: "none", folderId: folderA })).toEqual(["dog.png"]);
			expect(await names({ alt: "none", folderId: folderA, includeDescendants: true })).toEqual([
				"bird.webp",
				"dog.png",
			]);
			expect(await names({ alt: "none", kind: "file" })).toEqual([]);
			expect(await names({ alt: "none", mimeType: "image/webp" })).toEqual(["bird.webp"]);
			expect((await store.listMediaAssets({ alt: "none", pageSize: 2 })).total).toBe(3);
		});

		it("counts kinds and alts over all files when nothing narrows the list", async () => {
			expect(await counts({})).toEqual({ kinds: { image: 5, file: 1 }, alts: { none: 3, has: 2 } });
		});

		it("counts ignore kind and alt themselves, so every choice of a menu has its number", async () => {
			const all = await counts({});
			expect(await counts({ kind: "file" })).toEqual(all);
			expect(await counts({ kind: "image" })).toEqual(all);
			expect(await counts({ alt: "none" })).toEqual(all);
			expect(await counts({ alt: "has", kind: "file" })).toEqual(all);
			// The list itself is narrowed.
			expect((await store.listMediaAssets({ kind: "file" })).total).toBe(1);
		});

		it("counts respect the folder and includeDescendants", async () => {
			expect(await counts({ folderId: folderA })).toEqual({
				kinds: { image: 2, file: 1 },
				alts: { none: 1, has: 1 },
			});
			expect(await counts({ folderId: folderA, includeDescendants: true })).toEqual({
				kinds: { image: 4, file: 1 },
				alts: { none: 2, has: 2 },
			});
			expect(await counts({ folderId: null })).toEqual({ kinds: { image: 1, file: 0 }, alts: { none: 1, has: 0 } });
		});

		it("counts respect the search and the mime type prefix", async () => {
			expect(await counts({ search: "og" })).toEqual({ kinds: { image: 1, file: 0 }, alts: { none: 1, has: 0 } });
			expect(await counts({ search: ".pdf" })).toEqual({ kinds: { image: 0, file: 1 }, alts: { none: 0, has: 0 } });
			expect(await counts({ mimeType: "image/" })).toEqual({
				kinds: { image: 5, file: 0 },
				alts: { none: 3, has: 2 },
			});
		});

		it("counts respect used and the upload dates", async () => {
			expect(await counts({ used: "used" })).toEqual({ kinds: { image: 1, file: 0 }, alts: { none: 0, has: 1 } });
			expect(await counts({ used: "unused" })).toEqual({ kinds: { image: 4, file: 1 }, alts: { none: 3, has: 1 } });
			const future = new Date(Date.now() + 24 * 60 * 60 * 1000);
			expect(await counts({ uploadedFrom: future })).toEqual({
				kinds: { image: 0, file: 0 },
				alts: { none: 0, has: 0 },
			});
		});
	});

	describe("MediaMetadataStore: replace the file of a media file", () => {
		let session: StoreSession;
		let store: ContentStore;
		let folderId: string;
		let sequence = 0;

		beforeAll(async () => {
			session = await factory.create();
			store = session.store;
			folderId = (await store.createFolder({ collection: "media", name: "Replace", parentId: null })).id;
		});

		afterAll(async () => {
			await session.close();
		});

		/** A ready media file stored under `media/<name>`, optionally with an original. */
		const addReady = async (input: {
			filename: string;
			mimeType: string;
			byteSize?: number;
			width?: number | null;
			height?: number | null;
			withOriginal?: boolean;
			folderId?: string | null;
		}) => {
			sequence += 1;
			const media = await store.createMediaAsset({
				filename: input.filename,
				mimeType: input.mimeType,
				byteSize: input.byteSize ?? 10,
				stagingKey: `staging/${sequence}-${input.filename}`,
				...(input.folderId !== undefined ? { folderId: input.folderId } : {}),
				...(input.withOriginal
					? { original: { mimeType: "image/png", byteSize: 500, stagingKey: `staging/${sequence}-original` } }
					: {}),
			});
			return store.completeMediaAsset({
				id: media.id,
				storageKey: `media/${sequence}-${input.filename}`,
				mimeType: input.mimeType,
				byteSize: input.byteSize ?? 10,
				width: input.width ?? null,
				height: input.height ?? null,
				...(input.withOriginal
					? {
							original: {
								storageKey: `media/${sequence}-original.png`,
								mimeType: "image/png",
								byteSize: 500,
								width: 400,
								height: 300,
							},
						}
					: {}),
			});
		};

		const pending = async (filename: string, mimeType: string) => {
			sequence += 1;
			return store.createMediaAsset({
				filename,
				mimeType,
				byteSize: 10,
				stagingKey: `staging/${sequence}-${filename}`,
			});
		};

		const refuses = async (run: Promise<unknown>, code: string) => {
			const error = await run.then(
				() => undefined,
				(caught: unknown) => caught,
			);
			expect(error).toBeInstanceOf(CmsError);
			expect((error as CmsError).code).toBe(code);
		};

		it("keeps the id, name, folder, alt, caption, creation date and references, and takes the new file", async () => {
			const target = await addReady({
				filename: "keep.png",
				mimeType: "image/png",
				width: 10,
				height: 10,
				withOriginal: true,
				folderId,
			});
			await store.updateMediaMetadata({ id: target.id, defaultAlt: "Kept alt", defaultCaption: "Kept caption" });
			await referToMedia(store, target.id);
			const source = await addReady({
				filename: "new.webp",
				mimeType: "image/webp",
				byteSize: 99,
				width: 20,
				height: 12,
			});

			const { media, released } = await store.replaceMediaFile({ id: target.id, fromId: source.id });

			expect(media).toMatchObject({
				id: target.id,
				status: "ready",
				filename: "keep.png",
				folderId,
				defaultAlt: "Kept alt",
				defaultCaption: "Kept caption",
				storageKey: source.storageKey,
				mimeType: "image/webp",
				byteSize: 99,
				width: 20,
				height: 12,
			});
			expect(media.createdAt).toEqual(target.createdAt);
			expect(media.updatedAt.getTime()).toBeGreaterThanOrEqual(target.updatedAt.getTime());
			// The new file has no original, so the old one is gone from the record too.
			expect(media.original).toBeNull();
			expect(released).toEqual({ storageKey: target.storageKey, originalStorageKey: target.original?.storageKey });
			expect(released.originalStorageKey).toEqual(expect.any(String));

			expect(await store.getMediaAsset(source.id)).toBeNull();
			expect(await store.getMediaAsset(target.id)).toEqual(media);
			const listed = (await store.listMediaAssets({ folderId })).items.find((item) => item.id === target.id);
			expect(listed?.referencesCount).toBe(1);
		});

		it("takes over the original of the new file, every original field", async () => {
			const target = await addReady({ filename: "orig-less.png", mimeType: "image/png", width: 1, height: 1 });
			const source = await addReady({
				filename: "with-original.png",
				mimeType: "image/png",
				width: 8,
				height: 6,
				withOriginal: true,
			});

			const { media, released } = await store.replaceMediaFile({ id: target.id, fromId: source.id });

			expect(media.original).toMatchObject({
				storageKey: source.original?.storageKey,
				mimeType: "image/png",
				byteSize: 500,
				width: 400,
				height: 300,
			});
			expect(released).toEqual({ storageKey: target.storageKey, originalStorageKey: null });
		});

		it("replaces an attachment by an attachment of the same type", async () => {
			const target = await addReady({ filename: "guide.pdf", mimeType: "application/pdf", byteSize: 5 });
			const source = await addReady({ filename: "guide-v2.pdf", mimeType: "application/pdf", byteSize: 7 });
			const { media } = await store.replaceMediaFile({ id: target.id, fromId: source.id });
			expect(media).toMatchObject({ filename: "guide.pdf", mimeType: "application/pdf", byteSize: 7, width: null });
			expect(media.storageKey).toBe(source.storageKey);
		});

		it("refuses a different kind or type with a notice, and changes nothing", async () => {
			const image = await addReady({ filename: "kind.png", mimeType: "image/png", width: 1, height: 1 });
			const pdf = await addReady({ filename: "kind.pdf", mimeType: "application/pdf" });
			const markdown = await addReady({ filename: "kind.md", mimeType: "text/markdown" });

			for (const [id, fromId, key] of [
				[image.id, pdf.id, "media.replace.kind"],
				[pdf.id, image.id, "media.replace.kind"],
				[pdf.id, markdown.id, "media.replace.type"],
			] as const) {
				const error = await store.replaceMediaFile({ id, fromId }).then(
					() => undefined,
					(caught: unknown) => caught,
				);
				expect(error).toBeInstanceOf(CmsError);
				expect(error).toMatchObject({ code: "unsupported_media_type", notice: { key } });
			}
			expect(await store.getMediaAsset(pdf.id)).toEqual(pdf);
			expect(await store.getMediaAsset(markdown.id)).toEqual(markdown);
		});

		it("refuses a file that is not ready or does not exist", async () => {
			const ready = await addReady({ filename: "ready.png", mimeType: "image/png", width: 1, height: 1 });
			const other = await addReady({ filename: "other-ready.png", mimeType: "image/png", width: 1, height: 1 });
			const waiting = await pending("waiting.png", "image/png");
			const missing = "00000000-0000-4000-8000-000000000999";

			await refuses(store.replaceMediaFile({ id: ready.id, fromId: waiting.id }), "not_found");
			await refuses(store.replaceMediaFile({ id: waiting.id, fromId: other.id }), "not_found");
			await refuses(store.replaceMediaFile({ id: ready.id, fromId: missing }), "not_found");
			await refuses(store.replaceMediaFile({ id: missing, fromId: other.id }), "not_found");
			await refuses(store.replaceMediaFile({ id: ready.id, fromId: ready.id }), "invalid_input");

			expect(await store.getMediaAsset(ready.id)).toEqual(ready);
			expect(await store.getMediaAsset(other.id)).toEqual(other);
			expect((await store.getMediaAsset(waiting.id))?.status).toBe("pending");
		});

		it("refuses a replacement that an entry refers to, so no reference loses its file", async () => {
			const target = await addReady({ filename: "t-in-use.png", mimeType: "image/png", width: 1, height: 1 });
			const source = await addReady({ filename: "s-in-use.png", mimeType: "image/png", width: 1, height: 1 });
			await referToMedia(store, source.id);

			await refuses(store.replaceMediaFile({ id: target.id, fromId: source.id }), "conflict");
			expect(await store.getMediaAsset(target.id)).toEqual(target);
			expect(await store.getMediaAsset(source.id)).toEqual(source);
		});
	});
};
