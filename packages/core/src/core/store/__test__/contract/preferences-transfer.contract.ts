import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { contentCollection, fillRequiredMetadata } from "../../../../../test/any-site";
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
			const published = await publishDraft(store, { id: created.id, expectedVersion: created.version });
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
};
