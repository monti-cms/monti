import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { contentCollection, fillRequiredMetadata } from "../../../../../test/any-site";
import { testSite } from "../../../../../test/site";
import { contentOf, docOf } from "../../../../../test/stored-content";
import type { ContentStore } from "../..";
import { CmsError } from "../..";
import { publishDraft, seedEntry, seedSave } from "../seed";
import type { ContractSuite, StoreSession } from "./harness";

/** Contract of PreferenceStore and TransferStore. */
export const preferencesTransferContract: ContractSuite = (factory) => {
	describe("PreferenceStore", () => {
		let session: StoreSession;
		let store: ContentStore;

		beforeAll(async () => {
			session = await factory.create();
			store = session.store;
		});

		afterAll(async () => {
			await session.close();
		});

		it("reads null when nothing was saved for the user", async () => {
			await expect(store.getPreferences({ userId: `user-${randomUUID()}` })).resolves.toBeNull();
		});

		it("reads back what was saved, as JSON", async () => {
			const userId = `user-${randomUUID()}`;
			const preferences = { list: { pageSize: 50, columns: ["title", "status"] }, editor: { inspectorOpen: true } };

			await store.savePreferences({ userId, preferences });

			expect(await store.getPreferences({ userId })).toEqual(preferences);
		});

		it("replaces the previous preferences on a second save", async () => {
			const userId = `user-${randomUUID()}`;

			await store.savePreferences({ userId, preferences: { editor: { inspectorOpen: true }, theme: "dark" } });
			await store.savePreferences({ userId, preferences: { editor: { inspectorOpen: false } } });

			expect(await store.getPreferences({ userId })).toEqual({ editor: { inspectorOpen: false } });
		});

		it("keeps the preferences of each user separate", async () => {
			const first = `user-${randomUUID()}`;
			const second = `user-${randomUUID()}`;

			await store.savePreferences({ userId: first, preferences: { theme: "dark" } });
			await store.savePreferences({ userId: second, preferences: { theme: "light" } });
			await store.savePreferences({ userId: first, preferences: { theme: "system" } });

			expect(await store.getPreferences({ userId: first })).toEqual({ theme: "system" });
			expect(await store.getPreferences({ userId: second })).toEqual({ theme: "light" });
		});

		it("rejects preferences that are not plain JSON with CmsError invalid_input and keeps the saved ones", async () => {
			const userId = `user-${randomUUID()}`;
			await store.savePreferences({ userId, preferences: { theme: "dark" } });

			const notJson = [{ when: new Date() }, { ratio: Number.NaN }, { run: () => 1 }];
			for (const preferences of notJson) {
				const err = await store.savePreferences({ userId, preferences: preferences as never }).catch((e) => e);
				expect(err).toBeInstanceOf(CmsError);
				expect((err as CmsError).code).toBe("invalid_input");
			}

			expect(await store.getPreferences({ userId })).toEqual({ theme: "dark" });
		});
	});

	describe("TransferStore", () => {
		let session: StoreSession;
		let store: ContentStore;

		beforeAll(async () => {
			session = await factory.create();
			store = session.store;
			// Publishing needs the required-for-publish values, which this file's scenarios do not care about.
			fillRequiredMetadata(store);
		});

		afterAll(async () => {
			await session.close();
		});

		it("reflects entries with their working and published bodies", async () => {
			const draft = await seedEntry(store, {
				collection: contentCollection,
				slug: "export-draft",
				metadata: { title: "Export draft" },
				text: "# Draft body",
			});
			const created = await seedEntry(store, {
				collection: contentCollection,
				slug: "export-live",
				metadata: { title: "Export live" },
				text: "# Live body",
			});
			const published = await publishDraft(testSite, store, { id: created.id, expectedVersion: created.version });
			await seedSave(store, published.id, {
				expectedVersion: published.version,
				metadata: { title: "Export live, edited" },
				text: "# Edited body",
			});

			const { entries } = await store.readExportSnapshot();

			const exportedDraft = entries.find((entry) => entry.id === draft.id);
			expect(exportedDraft).toMatchObject({
				collection: contentCollection,
				status: "draft",
				workingSlug: "export-draft",
				publishedSlug: null,
				publishedAt: null,
				working: { metadata: { title: "Export draft" } },
			});
			expect(contentOf(exportedDraft?.working.doc)).toEqual(contentOf(docOf("# Draft body")));
			expect(exportedDraft?.published).toBeUndefined();

			const exportedLive = entries.find((entry) => entry.id === published.id);
			expect(exportedLive).toMatchObject({
				collection: contentCollection,
				status: "published",
				workingSlug: "export-live",
				publishedSlug: "export-live",
				working: { metadata: { title: "Export live, edited" } },
			});
			expect(contentOf(exportedLive?.working.doc)).toEqual(contentOf(docOf("# Edited body")));
			expect(contentOf(exportedLive?.published?.doc)).toEqual(contentOf(docOf("# Live body")));
			expect(exportedLive?.publishedAt).toBeInstanceOf(Date);
			expect(exportedLive?.working.contentHash).not.toBe(exportedLive?.published?.contentHash);
		});

		it("reflects folders, media assets, templates and preferences created through the port", async () => {
			const folder = await store.createFolder({ collection: contentCollection, parentId: null, name: "Export folder" });
			const filename = `export-${randomUUID()}.png`;
			const media = await store.createMediaAsset({
				filename,
				mimeType: "image/png",
				byteSize: 10,
				stagingKey: `staging/${filename}`,
			});
			const template = await store.createTemplate({ name: "Export template", doc: docOf("# Template body") });
			const userId = `user-${randomUUID()}`;
			await store.savePreferences({ userId, preferences: { theme: "dark" } });

			const snapshot = await store.readExportSnapshot();

			expect(snapshot.folders.find((candidate) => candidate.id === folder.id)).toMatchObject({
				collection: contentCollection,
				parentId: null,
				name: "Export folder",
			});
			expect(snapshot.media.find((candidate) => candidate.id === media.id)).toMatchObject({
				id: media.id,
				filename,
				status: "pending",
			});
			expect(snapshot.templates.find((candidate) => candidate.id === template.id)).toMatchObject({
				name: "Export template",
				doc: template.doc,
			});
			expect(snapshot.preferences.find((candidate) => candidate.userId === userId)).toMatchObject({
				userId,
				preferences: { theme: "dark" },
			});
			expect(snapshot.preferences.find((candidate) => candidate.userId === userId)?.updatedAt).toBeInstanceOf(Date);
		});

		it("reads the same snapshot, with the same entry order, while the data does not change", async () => {
			for (const slug of ["export-order-a", "export-order-b", "export-order-c"]) {
				await seedEntry(store, { collection: contentCollection, slug, metadata: { title: slug }, text: `# ${slug}` });
			}

			const first = await store.readExportSnapshot();
			const second = await store.readExportSnapshot();

			expect(first.entries.length).toBeGreaterThanOrEqual(3);
			expect(second.entries.map((entry) => entry.id)).toEqual(first.entries.map((entry) => entry.id));
			expect(second).toEqual(first);
		});
	});

	describe("TransferStore restoreArchive", () => {
		let from: StoreSession;
		let into: StoreSession;

		beforeAll(async () => {
			from = await factory.create();
			into = await factory.create();
			fillRequiredMetadata(from.store);
		});

		afterAll(async () => {
			await from.close();
			await into.close();
		});

		it("puts a snapshot into an empty store as it was, and refuses a second restore", async () => {
			const created = await seedEntry(from.store, {
				collection: contentCollection,
				slug: "restore-live",
				metadata: { title: "Restore live" },
				text: "# Live body",
			});
			const published = await publishDraft(testSite, from.store, { id: created.id, expectedVersion: created.version });
			await seedSave(from.store, published.id, {
				expectedVersion: published.version,
				metadata: { title: "Restore live, edited" },
				text: "# Edited body",
			});
			await seedEntry(from.store, {
				collection: contentCollection,
				slug: "restore-draft",
				metadata: { title: "Restore draft" },
				text: "# Draft body",
			});
			const snapshot = await from.store.readExportSnapshot();

			expect(await into.store.countSiteContent()).toEqual({ entries: 0, folders: 0, media: 0 });
			const result = await into.store.restoreArchive(snapshot);

			expect(result).toMatchObject({ entries: snapshot.entries.length, translations: 0 });
			const restored = await into.store.readExportSnapshot();
			expect(restored.entries).toEqual(snapshot.entries);
			expect(restored.references).toEqual(snapshot.references);
			expect(restored.addresses).toEqual(snapshot.addresses);
			expect((await into.store.countSiteContent()).entries).toBe(snapshot.entries.length);

			const err = await into.store.restoreArchive(snapshot).catch((e) => e);
			expect(err).toBeInstanceOf(CmsError);
			expect((err as CmsError).code).toBe("conflict");
		});

		it("restores its own backup into a site whose entries were deleted for good, at the addresses they kept", async () => {
			const site = await factory.create();
			try {
				fillRequiredMetadata(site.store);
				const created = await seedEntry(site.store, {
					collection: contentCollection,
					slug: "kept-address",
					metadata: { title: "Kept address" },
					text: "# Body",
				});
				const published = await publishDraft(testSite, site.store, {
					id: created.id,
					expectedVersion: created.version,
				});
				const snapshot = await site.store.readExportSnapshot();
				// Deleting a published entry for good keeps its address, so the address is not reused for other content. The post goes first, then what
				// `fillRequiredMetadata` made for its required fields.
				for (const entry of [published, ...snapshot.entries.filter((item) => item.id !== published.id)]) {
					const trashed = await site.store.trashEntry({ id: entry.id, expectedVersion: entry.version });
					await site.store.deleteTrashed({ targets: [{ type: "entry", id: trashed.id }] });
				}
				expect(await site.store.countSiteContent()).toEqual({ entries: 0, folders: 0, media: 0 });

				await site.store.restoreArchive(snapshot);
				expect((await site.store.readExportSnapshot()).addresses).toEqual(snapshot.addresses);
			} finally {
				await site.close();
			}
		});

		it("restores a folder that the backup lists before its parent", async () => {
			const source = await factory.create();
			const target = await factory.create();
			try {
				const parent = await source.store.createFolder({
					collection: contentCollection,
					parentId: null,
					name: "Parent",
				});
				const child = await source.store.createFolder({
					collection: contentCollection,
					parentId: parent.id,
					name: "Child",
				});
				const snapshot = await source.store.readExportSnapshot();
				const folderOf = (id: string) =>
					snapshot.folders.find((folder) => folder.id === id) as (typeof snapshot.folders)[number];
				// The order of a backup's folders is not promised: here the child comes first.
				const childFirst = { ...snapshot, folders: [folderOf(child.id), folderOf(parent.id)] };

				await target.store.restoreArchive(childFirst);

				const byId = (folders: typeof snapshot.folders) => [...folders].sort((a, b) => a.id.localeCompare(b.id));
				expect(byId((await target.store.readExportSnapshot()).folders)).toEqual(byId(snapshot.folders));
			} finally {
				await source.close();
				await target.close();
			}
		});
	});
};
