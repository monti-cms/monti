import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
	contentCollection,
	defaultLocale,
	fillRequiredMetadata,
	otherContentCollection,
	recordCollection,
	recordRelationField,
	requiredFields,
	requiredMetadata,
	secondLocale,
	titleFieldOf,
} from "../../../../../test/any-site";
import { contentOf, docOf as docOfText } from "../../../../../test/stored-content";
import { forEachBlock, isBlockId, withoutBlockIds } from "../../../../doc/block-ids";
import { readStoredDocument, STORED_DOCUMENT_VERSION, type StoredDocument } from "../../../../doc/stored-document";
import { paragraphsFormat } from "../../../../format/__test__/paragraphs-format";
import { createFormatRegistry } from "../../../../format/registry";
import { storedFields } from "../../../../schema/derive";
import { createBulkService } from "../../../../services/bulk-service";
import { createContentService } from "../../../../services/content-service";
import { ServiceError } from "../../../../services/types";
import { COLLECTIONS, type Collection, isItemCollection } from "../../../collections";
import { contentPath } from "../../../links";
import { imageWarningsForSnapshot, prepareSnapshot } from "../../../snapshot";
import type { ServiceInput } from "../../../types";
import type { ContentStore, Entry, EntryMetadata } from "../..";
import { CmsError } from "../..";
import { duplicateDraft, publishDraft, restoreDraft, seedEntry, seedSave } from "../seed";
import type { ContractSuite, StoreFactory, StoreSession } from "./harness";

/**
 * Contract of EntryStore: creating, saving and publishing entries, looking them up, and what the write paths of the services do to stored values
 * (removed fields, block ids, duplicates). The suites run with the production write paths on top of the store, so they also cover what the services
 * promise.
 */

/** The formats the services of these suites read text bodies in. Core has no text format of its own, so the tests use the plain one of the format tests. */
const serviceOptions = { formats: async () => createFormatRegistry([paragraphsFormat]) };

/** The text a body said, as the blocks it reads as (ids left out), for comparing bodies. */
const bodyText = (text: string) => contentOf(docOfText(text));

/** A document of an image of a media asset, which text cannot say. */
const imageDoc = (mediaId: string, alt: string, ...before: string[]): StoredDocument => ({
	type: "doc",
	version: STORED_DOCUMENT_VERSION,
	content: [...docOfText(before.join("\n\n")).content, { type: "image", attrs: { mediaId, alt } }],
});

const createSaveAndPublishContract: ContractSuite = (factory) => {
	/** First required-for-publish field that is not the title (category in the reference blog). Checks that publish is blocked when it is missing. */
	const missingRequired = requiredFields(contentCollection).find(({ name }) => name !== "title");

	/**
	 * A relation field that can hold entries not yet published (`allowUnpublished`; `itemIds` of the reference blog's collection) and its collection.
	 * If it hangs off a conditional field, the condition value must be set too for the save to succeed.
	 */
	const unpublishedRelation = (() => {
		for (const collection of COLLECTIONS) {
			for (const stored of storedFields(collection)) {
				const { field } = stored;
				if (field.kind === "relation" && field.allowUnpublished) {
					return { ...stored, collection, to: field.to as Collection, many: Boolean(field.many) };
				}
			}
		}
		return undefined;
	})();

	describe("EntryStore: create, save and publish", () => {
		let session: StoreSession;
		let store: ContentStore;
		let relationTarget: (to: Collection) => Promise<string>;
		/** A store that saves without filling the required-for-publish values (for testing the required-value check). */
		let rawStore: ContentStore;

		/** Metadata filled into a raw snapshot (title + the config's required-for-publish values). */
		const filled = (title: string, collection: Collection = contentCollection) =>
			requiredMetadata(collection, title, relationTarget);

		beforeAll(async () => {
			session = await factory.create();
			store = session.store;
			// Required-for-publish values (such as the reference blog's category) are looked up in the config and filled in.
			const fill = fillRequiredMetadata(store);
			relationTarget = fill.relationTarget;
			rawStore = { ...store, createEntryWithReferences: fill.raw.createEntryWithReferences };
		});

		afterAll(async () => {
			await session.close();
		});

		it("creates a new entry with correct timestamp fields", async () => {
			const entry = await seedEntry(store, {
				collection: contentCollection,
				slug: "test-timestamps",
				metadata: { title: "Timestamps" },
				text: "test",
				schemaVersion: 1,
				contentHash: "hash-ts",
			});

			expect(entry.id).toBeDefined();
			expect(typeof entry.version).toBe("number");

			expect(entry.createdAt).toBeInstanceOf(Date);
			expect(entry.updatedAt).toBeInstanceOf(Date);
			expect(entry.working.updatedAt).toBeInstanceOf(Date);

			expect(entry.publishedAt ?? null).toBeNull();
		});

		it("allows two drafts in the same collection with slug null and manages workingSlug/publishedSlug", async () => {
			const draft1 = await seedEntry(store, {
				collection: contentCollection,
				slug: null,
				metadata: { title: "Draft" },
				text: "draft 1",
				schemaVersion: 1,
				contentHash: "hash-slug-1",
			});
			const draft2 = await seedEntry(store, {
				collection: contentCollection,
				slug: null,
				metadata: { title: "Draft" },
				text: "draft 2",
				schemaVersion: 1,
				contentHash: "hash-slug-2",
			});

			expect(draft1.id).not.toBe(draft2.id);
			expect(draft1.workingSlug ?? null).toBeNull();
			expect(draft1.publishedSlug ?? null).toBeNull();

			const saved1 = await seedSave(store, draft1.id, {
				expectedVersion: draft1.version,
				slug: "draft-1-slug",
				metadata: { title: "Draft" },
				text: "draft 1 updated",
				schemaVersion: 1,
				contentHash: "hash-slug-1-updated",
			});

			expect(saved1.workingSlug).toBe("draft-1-slug");
			expect(saved1.publishedSlug ?? null).toBeNull();

			const published = await publishDraft(store, { id: saved1.id, expectedVersion: saved1.version });
			expect(published.publishedSlug).toBe("draft-1-slug");

			const savedAgain = await seedSave(store, published.id, {
				expectedVersion: published.version,
				slug: "draft-1-slug-new",
				metadata: { title: "Draft" },
				text: "draft 1 updated again",
				schemaVersion: 1,
				contentHash: "hash-slug-1-updated-again",
			});

			expect(savedAgain.workingSlug).toBe("draft-1-slug-new");
			expect(savedAgain.publishedSlug).toBe("draft-1-slug");
		});

		it("timestamps: publish behavior and immutability", async () => {
			const entry = await seedEntry(store, {
				collection: contentCollection,
				slug: "time-test",
				metadata: { title: "Draft" },
				text: "time test",
				schemaVersion: 1,
				contentHash: "hash-time",
			});

			const initialWorkingUpdatedAt = entry.working.updatedAt?.getTime();

			await new Promise((r) => setTimeout(r, 10));

			const published = await publishDraft(store, { id: entry.id, expectedVersion: entry.version });

			expect(published.working.updatedAt?.getTime()).toBe(initialWorkingUpdatedAt);
			expect(published.published?.updatedAt?.getTime()).toBe(initialWorkingUpdatedAt);

			expect(published.publishedAt).toBeInstanceOf(Date);

			const pubAt = published.publishedAt?.getTime();

			await new Promise((r) => setTimeout(r, 10));

			const saved = await seedSave(store, published.id, {
				expectedVersion: published.version,
				metadata: { title: "Draft" },
				text: "time test updated",
				schemaVersion: 1,
				contentHash: "hash-time-2",
			});

			expect(saved.publishedAt?.getTime()).toBe(pubAt);
			expect(saved.published?.updatedAt?.getTime()).toBe(initialWorkingUpdatedAt);

			expect(saved.working.updatedAt?.getTime()).toBeGreaterThan(initialWorkingUpdatedAt);
		});

		it("identical save leaves version, hash, and updatedAt unchanged", async () => {
			const entry = await seedEntry(store, {
				collection: contentCollection,
				slug: "identical",
				metadata: { title: "Draft" },
				text: "draft content",
				schemaVersion: 1,
				contentHash: "hash-identical",
			});

			const saved = await seedSave(store, entry.id, {
				expectedVersion: entry.version,
				metadata: { title: "Draft" },
				text: "draft content",
				schemaVersion: 1,
				contentHash: "hash-identical",
			});

			expect(saved.version).toBe(entry.version);
			expect(saved.working.contentHash).toBe(entry.working.contentHash);
			expect(saved.working.updatedAt?.getTime()).toEqual(entry.working.updatedAt?.getTime());
			expect(saved.updatedAt.getTime()).toEqual(entry.updatedAt.getTime());

			const reloaded = await store.getEntry(entry.id);
			expect(reloaded.version).toBe(entry.version);
			expect(reloaded.updatedAt.getTime()).toEqual(entry.updatedAt.getTime());
			expect(reloaded.working.contentHash).toBe(entry.working.contentHash);
			expect(reloaded.working.metadata).toEqual(entry.working.metadata);
			expect(contentOf(reloaded.working.doc)).toEqual(contentOf(entry.working.doc));
			expect(reloaded.working.schemaVersion).toBe(entry.working.schemaVersion);
		});

		describe("a syntax-only change (same content hash, different MDX string)", () => {
			it("still counts as a change when the slug, metadata, schema version or translation differ", async () => {
				const entry = await seedEntry(store, {
					collection: contentCollection,
					slug: "syntax-only-other-change",
					metadata: { title: "Syntax" },
					text: "words",
					contentHash: "hash-syntax-other",
				});

				const slugChanged = await seedSave(store, entry.id, {
					expectedVersion: entry.version,
					slug: "syntax-only-other-change-2",
					metadata: { title: "Syntax" },
					text: "words again",
					contentHash: "hash-syntax-other",
				});
				expect(slugChanged.version).toBe(entry.version + 1);

				const schemaChanged = await seedSave(store, entry.id, {
					expectedVersion: slugChanged.version,
					metadata: { title: "Syntax" },
					text: "words again",
					schemaVersion: 2,
					contentHash: "hash-syntax-other",
				});
				expect(schemaChanged.version).toBe(slugChanged.version + 1);
			});

			it("is a republish when published: the published snapshot is not replaced", async () => {
				const entry = await seedEntry(store, {
					collection: contentCollection,
					slug: "syntax-only-republish",
					metadata: { title: "Syntax" },
					text: "first words",
					contentHash: "hash-syntax-republish",
				});
				const firstPublish = await publishDraft(store, { id: entry.id, expectedVersion: entry.version });

				const saved = await seedSave(store, entry.id, {
					expectedVersion: firstPublish.version,
					metadata: { title: "Syntax" },
					text: "second words",
					contentHash: "hash-syntax-republish",
				});
				expect(saved.version).toBe(firstPublish.version);
				expect(contentOf(saved.working.doc)).toEqual(bodyText("second words"));

				const republished = await publishDraft(store, { id: entry.id, expectedVersion: saved.version });

				expect(republished.version).toBe(firstPublish.version);
				expect(republished.published).toEqual(firstPublish.published);
				expect(republished.publishedAt?.getTime()).toBe(firstPublish.publishedAt?.getTime());
				expect(contentOf((await store.getEntry(entry.id)).published?.doc)).toEqual(bodyText("first words"));
			});
		});

		it("same-hash correctness: changed metadata/MDX/schemaVersion with reused hash is published", async () => {
			const entry = await seedEntry(store, {
				collection: contentCollection,
				slug: "republish-hash",
				metadata: { title: "Hash Test" },
				text: "hash test",
				schemaVersion: 1,
				contentHash: "same-hash",
			});

			const firstPublish = await publishDraft(store, { id: entry.id, expectedVersion: entry.version });

			const secondSave = await seedSave(store, entry.id, {
				expectedVersion: firstPublish.version,
				metadata: { title: "Hash Test Changed" },
				text: "hash test changed",
				schemaVersion: 2,
				contentHash: "same-hash",
			});

			const secondPublish = await publishDraft(store, { id: entry.id, expectedVersion: secondSave.version });
			expect(secondPublish.published?.metadata).toEqual(await filled("Hash Test Changed"));
			expect(contentOf(secondPublish.published?.doc)).toEqual(bodyText("hash test changed"));
			expect(secondPublish.published?.schemaVersion).toBe(2);
			expect(secondPublish.published?.contentHash).toBe("same-hash");

			const reloaded = await store.getEntry(entry.id);
			expect(reloaded.published?.metadata).toEqual(await filled("Hash Test Changed"));
			expect(contentOf(reloaded.published?.doc)).toEqual(bodyText("hash test changed"));
			expect(reloaded.published?.schemaVersion).toBe(2);
			expect(reloaded.published?.contentHash).toBe("same-hash");
		});

		it("metadata JSON boundary: invalid value rejected with invalid_input", async () => {
			const entry = await seedEntry(store, {
				collection: contentCollection,
				slug: "json-boundary",
				metadata: { title: "JSON Boundary" },
				text: "json",
				schemaVersion: 1,
				contentHash: "hash-json",
			});

			const badMetadata = {
				title: "Bad",
				nested: { invalid: Number.NaN },
			} as unknown as EntryMetadata;

			let caught: unknown;
			try {
				await seedSave(store, entry.id, {
					expectedVersion: entry.version,
					metadata: badMetadata,
					text: "json updated",
					schemaVersion: 1,
					contentHash: "hash-json-2",
				});
			} catch (e) {
				caught = e;
			}

			expect(caught).toBeInstanceOf(CmsError);
			expect(caught).toMatchObject({ code: "invalid_input" });

			const reloaded = await store.getEntry(entry.id);
			expect(reloaded.version).toBe(entry.version);
			expect(reloaded.working.metadata).toEqual(await filled("JSON Boundary"));
		});

		it("true simultaneous-writer test: resolves one conflict", async () => {
			const entry = await seedEntry(store, {
				collection: contentCollection,
				slug: "simul-test",
				metadata: { title: "Simultaneous" },
				text: "simul",
				schemaVersion: 1,
				contentHash: "hash-simul",
			});

			const p1 = seedSave(store, entry.id, {
				expectedVersion: entry.version,
				metadata: { title: "Win 1" },
				text: "win 1",
				schemaVersion: 1,
				contentHash: "hash-simul-1",
			});
			const p2 = seedSave(store, entry.id, {
				expectedVersion: entry.version,
				metadata: { title: "Win 2" },
				text: "win 2",
				schemaVersion: 1,
				contentHash: "hash-simul-2",
			});

			const results = await Promise.allSettled([p1, p2]);

			const isFulfilled = (result: PromiseSettledResult<Entry>): result is PromiseFulfilledResult<Entry> =>
				result.status === "fulfilled";
			const isRejected = (result: PromiseSettledResult<Entry>): result is PromiseRejectedResult =>
				result.status === "rejected";

			const fulfilled = results.filter(isFulfilled);
			const rejected = results.filter(isRejected);

			expect(fulfilled.length).toBe(1);
			expect(rejected.length).toBe(1);

			const winner = fulfilled[0].value;
			const error = rejected[0].reason;

			expect(error).toBeInstanceOf(CmsError);
			expect(error).toMatchObject({
				code: "conflict",
				serverVersion: winner.version,
			});

			const reloaded = await store.getEntry(entry.id);
			expect(reloaded.version).toBe(winner.version);
			expect(reloaded.working.contentHash).toBe(winner.working.contentHash);
		});

		it("stale expectedVersion throws CmsError with code conflict and serverVersion", async () => {
			const entry = await seedEntry(store, {
				collection: contentCollection,
				slug: "stale-test",
				metadata: { title: "Initial" },
				text: "initial",
				schemaVersion: 1,
				contentHash: "hash-1",
			});

			const updated = await seedSave(store, entry.id, {
				expectedVersion: entry.version,
				metadata: { title: "Update 1" },
				text: "update 1",
				schemaVersion: 1,
				contentHash: "hash-2",
			});

			const stalePromise = seedSave(store, entry.id, {
				expectedVersion: entry.version,
				metadata: { title: "Update 2" },
				text: "update 2",
				schemaVersion: 1,
				contentHash: "hash-3",
			});

			expect(typeof updated.version).toBe("number");

			let caughtError: unknown;
			try {
				await stalePromise;
			} catch (error) {
				caughtError = error;
			}

			expect(caughtError).toBeInstanceOf(CmsError);
			expect(caughtError).toMatchObject({
				code: "conflict",
				serverVersion: updated.version,
			});
		});

		it("keeps working and published snapshots separate", async () => {
			const entry = await seedEntry(store, {
				collection: contentCollection,
				slug: "separation-test",
				metadata: { title: "Initial Draft" },
				text: "initial draft",
				schemaVersion: 1,
				contentHash: "hash-draft",
			});

			const published = await publishDraft(store, { id: entry.id, expectedVersion: entry.version });
			expect(published.publishedAt).toBeDefined();

			await seedSave(store, entry.id, {
				expectedVersion: published.version,
				metadata: { title: "Updated Draft" },
				text: "updated draft",
				schemaVersion: 2,
				contentHash: "hash-updated",
			});

			const reloaded = await store.getEntry(entry.id);

			expect(reloaded.working.metadata).toEqual(await filled("Updated Draft"));
			expect(contentOf(reloaded.working.doc)).toEqual(bodyText("updated draft"));
			expect(reloaded.working.contentHash).toBe("hash-updated");
			expect(reloaded.working.schemaVersion).toBe(2);

			expect(reloaded.published).toEqual(published.published);
			expect(reloaded.publishedAt?.getTime()).toEqual(published.publishedAt?.getTime());
		});

		it("republishing the same content hash does not replace the published snapshot", async () => {
			const entry = await seedEntry(store, {
				collection: contentCollection,
				slug: "republish-hash-identical",
				metadata: { title: "Hash Test" },
				text: "hash test",
				schemaVersion: 1,
				contentHash: "same-hash-ident",
			});

			const firstPublish = await publishDraft(store, { id: entry.id, expectedVersion: entry.version });

			const secondSave = await seedSave(store, entry.id, {
				expectedVersion: firstPublish.version,
				metadata: { title: "Hash Test" },
				text: "hash test",
				schemaVersion: 1,
				contentHash: "same-hash-ident",
			});

			await publishDraft(store, { id: entry.id, expectedVersion: secondSave.version });

			const reloaded = await store.getEntry(entry.id);
			expect(reloaded.published).toEqual(firstPublish.published);
			expect(reloaded.publishedAt?.getTime()).toEqual(firstPublish.publishedAt?.getTime());
		});

		it("published entry can clear its working slug, cannot publish without one, and keeps its public slug reserved", async () => {
			const entry = await seedEntry(store, {
				collection: contentCollection,
				slug: "clear-slug-test",
				metadata: { title: "Clear" },
				text: "test",
				schemaVersion: 1,
				contentHash: "hash-c1",
			});

			const published = await publishDraft(store, { id: entry.id, expectedVersion: entry.version });

			const saved = await seedSave(store, entry.id, {
				expectedVersion: published.version,
				slug: null,
				metadata: {},
				text: "test null",
				schemaVersion: 1,
				contentHash: "hash-c2",
			});

			const reloaded = await store.getEntry(entry.id);
			expect(reloaded.workingSlug ?? null).toBeNull();
			expect(reloaded.publishedSlug).toBe("clear-slug-test");

			// A draft without a slug cannot be published. The public URL stays as it is.
			await expect(publishDraft(store, { id: entry.id, expectedVersion: saved.version })).rejects.toMatchObject({
				code: "publish_validation_failed",
				issues: expect.arrayContaining([expect.objectContaining({ code: "null_slug" })]),
			});
			expect((await store.getEntry(entry.id)).publishedSlug).toBe("clear-slug-test");

			await expect(
				seedEntry(store, {
					collection: contentCollection,
					slug: "clear-slug-test",
					metadata: {},
					text: "collision",
					schemaVersion: 1,
					contentHash: "hash-c3",
				}),
			).rejects.toThrow();
		});

		it.skipIf(!missingRequired)(
			"rejects invalid direct publication without creating a published snapshot",
			async () => {
				const draft = await seedEntry(rawStore, {
					collection: contentCollection,
					slug: "validation-missing-required",
					metadata: { title: "Missing required" },
					text: "A valid body.",
					schemaVersion: 1,
					contentHash: "validation-missing-required-hash",
				});

				await expect(publishDraft(store, { id: draft.id, expectedVersion: draft.version })).rejects.toMatchObject({
					code: "publish_validation_failed",
					issues: expect.arrayContaining([
						expect.objectContaining({
							code: "missing_field",
							path: missingRequired?.name,
							message: missingRequired?.field.label,
						}),
					]),
				});
				const unchanged = await store.getEntry(draft.id);
				expect(unchanged.status).toBe("draft");
				expect(unchanged.published).toBeUndefined();
			},
		);

		it("atomically publishes record creates and rolls invalid edits back", async () => {
			const service = createContentService(store, serviceOptions);
			const badSlug = "validation-invalid-record-create";
			await expect(
				service.createDraft(
					{ collection: recordCollection, slug: badSlug, metadata: { title: "" }, format: "paragraphs", body: "" },
					{ publishImmediately: true },
				),
			).rejects.toBeInstanceOf(ServiceError);
			expect(await store.getWorkingEntryBySlug({ collection: recordCollection, slug: badSlug })).toBeNull();

			const published = await service.createDraft(
				{
					collection: recordCollection,
					slug: "validation-valid-record",
					metadata: await filled("Valid record", recordCollection),
					format: "paragraphs",
					body: "",
				},
				{ publishImmediately: true },
			);
			expect(published.status).toBe("published");
			expect(published.published).toBeDefined();
			const before = await store.getEntry(published.id);

			await expect(
				service.saveDraft(
					published.id,
					{
						collection: recordCollection,
						expectedVersion: before.version,
						slug: null,
						metadata: { title: "" },
						format: "paragraphs",
						body: "",
					},
					{ publishImmediately: true },
				),
			).rejects.toBeInstanceOf(ServiceError);
			const after = await store.getEntry(published.id);
			expect(after.version).toBe(before.version);
			expect(after.status).toBe("published");
			expect(after.workingSlug).toBe(before.workingSlug);
			expect(after.working.metadata).toEqual(before.working.metadata);
		});

		it("validates internal links against locked publication addresses", async () => {
			const target = await seedEntry(store, {
				collection: contentCollection,
				slug: "validation-link-target",
				metadata: { title: "Target" },
				text: "Target body.",
				schemaVersion: 1,
				contentHash: "validation-link-target-hash",
			});
			const source = await seedEntry(store, {
				collection: contentCollection,
				slug: "validation-link-source",
				metadata: { title: "Source" },
				// The public URL shape follows the config's `path` (the reference blog uses `/posts/:slug`).
				text: `[Target](${contentPath(contentCollection, "validation-link-target")})`,
				schemaVersion: 1,
				contentHash: "validation-link-source-hash",
			});

			// A target that is not published does not block publishing the link (it is a warning); one nobody holds does.
			const publishedSource = await publishDraft(store, { id: source.id, expectedVersion: source.version });
			const publishedTarget = await publishDraft(store, { id: target.id, expectedVersion: target.version });
			expect(publishedTarget.status).toBe("published");
			expect(publishedSource.status).toBe("published");
		});

		it.skipIf(!unpublishedRelation)(
			"allows draft references only through relations that allow unpublished targets",
			async () => {
				if (!unpublishedRelation) return;
				const { collection, name, to, many, when } = unpublishedRelation;
				const draftItem = await seedEntry(store, {
					collection: to,
					slug: "validation-collection-draft-item",
					metadata: { title: "Draft item" },
					text: "Draft body.",
					schemaVersion: 1,
					contentHash: "validation-collection-draft-item-hash",
				});
				expect(draftItem.status).toBe("draft");
				const service = createContentService(store, serviceOptions);
				const collectionDraft = await service.createDraft({
					collection,
					slug: "validation-collection",
					metadata: {
						...(await filled("Reading list", collection)),
						...(when ? { [when.field]: when.value } : {}),
						[name]: many ? [draftItem.id] : draftItem.id,
					},
					format: "paragraphs",
					body: "",
				});
				const published = await publishDraft(store, {
					id: collectionDraft.id,
					expectedVersion: collectionDraft.version,
				});
				expect(published.status).toBe("published");
			},
		);

		it("metadata accepts valid own JSON keys named constructor and __proto__", async () => {
			const metadata = JSON.parse('{"constructor":"val1","__proto__":"val2"}');

			// Insert raw values as they are (required-for-publish values are not filled).
			const entry = await seedEntry(rawStore, {
				collection: contentCollection,
				slug: "proto-test",
				metadata,
				text: "test",
				schemaVersion: 1,
				contentHash: "hash-proto",
			});

			const reloaded = await store.getEntry(entry.id);

			expect(Object.hasOwn(reloaded.working.metadata, "constructor")).toBe(true);
			expect(Object.hasOwn(reloaded.working.metadata, "__proto__")).toBe(true);

			expect(Object.getOwnPropertyDescriptor(reloaded.working.metadata, "constructor")?.value).toBe("val1");
			expect(Object.getOwnPropertyDescriptor(reloaded.working.metadata, "__proto__")?.value).toBe("val2");
		});
	});
};

const createWorkingEntryBySlugContract: ContractSuite = (factory) => {
	/**
	 * Working slug lookup for the admin preview only.
	 *
	 * The public read (`getPublishedEntryBySlug`) never returns a draft. This pins down that only the admin path can find drafts,
	 * without touching that contract.
	 */
	describe("EntryStore: working entry by slug", () => {
		let session: StoreSession;
		let store: ContentStore;
		let relationTarget: (to: Collection) => Promise<string>;
		/** Another collection to try the same slug in (memos in the reference blog). A config with a single document collection uses an item collection. */
		const elsewhere = otherContentCollection ?? recordCollection;

		beforeAll(async () => {
			session = await factory.create();
			store = session.store;
			// Required-for-publish values (such as the reference blog's category) are looked up in the config and filled in.
			relationTarget = fillRequiredMetadata(store).relationTarget;
		});

		afterAll(async () => {
			await session.close();
		});

		async function seedDraft(slug: string, body: string, metadata: Record<string, unknown> = { title: slug }) {
			const entry = await seedEntry(store, {
				collection: contentCollection,
				slug: null,
				metadata,
				text: body,
				schemaVersion: 1,
				contentHash: `hash-${slug}`,
			});

			return await seedSave(store, entry.id, {
				expectedVersion: entry.version,
				slug,
				metadata,
				text: body,
				schemaVersion: 1,
				contentHash: `hash-${slug}-saved`,
			});
		}

		it("returns the draft with its working body; the public read cannot see the same slug", async () => {
			await seedDraft("draft-only-post", "초안 본문");

			const found = await store.getWorkingEntryBySlug({ collection: contentCollection, slug: "draft-only-post" });

			expect(found?.status).toBe("draft");
			expect(found?.workingSlug).toBe("draft-only-post");
			expect(contentOf(found?.working.doc)).toEqual(bodyText("초안 본문"));
			expect(found?.working.metadata).toEqual(
				await requiredMetadata(contentCollection, "draft-only-post", relationTarget),
			);

			// The public path still does not return the draft (this change did not widen the public contract).
			expect(await store.getPublishedEntryBySlug({ collection: contentCollection, slug: "draft-only-post" })).toEqual({
				status: "not_found",
			});
		});

		it("shows the latest working copy in the preview after the working body is edited post-publish", async () => {
			const draft = await seedDraft("edited-after-publish", "발행 전 본문");

			await publishDraft(store, { id: draft.id, expectedVersion: draft.version });

			const edited = await store.getEntry(draft.id);
			await seedSave(store, draft.id, {
				expectedVersion: edited.version,
				slug: "edited-after-publish",
				metadata: { title: "편집된 제목" },
				text: "발행 후 편집 본문",
				schemaVersion: 1,
				contentHash: "hash-edited-after-publish",
			});

			const found = await store.getWorkingEntryBySlug({ collection: contentCollection, slug: "edited-after-publish" });

			expect(found?.status).toBe("published");
			expect(contentOf(found?.working.doc)).toEqual(bodyText("발행 후 편집 본문"));
			expect(contentOf(found?.published?.doc)).toEqual(bodyText("발행 전 본문"));
		});

		it("returns null for a missing slug", async () => {
			expect(await store.getWorkingEntryBySlug({ collection: contentCollection, slug: "does-not-exist" })).toBeNull();
		});

		it("does not find the same slug in another collection", async () => {
			const other = await seedEntry(store, {
				collection: elsewhere,
				slug: "shared-slug",
				metadata: { title: "메모" },
				text: "메모 본문",
				schemaVersion: 1,
				contentHash: "hash-memo-shared",
			});
			expect(other.workingSlug).toBe("shared-slug");

			expect(await store.getWorkingEntryBySlug({ collection: elsewhere, slug: "shared-slug" })).not.toBeNull();
			expect(await store.getWorkingEntryBySlug({ collection: contentCollection, slug: "shared-slug" })).toBeNull();
		});

		it("rejects invalid input with invalid_input instead of silently returning null", async () => {
			await expect(store.getWorkingEntryBySlug({ collection: contentCollection, slug: "" })).rejects.toBeInstanceOf(
				CmsError,
			);
			await expect(store.getWorkingEntryBySlug({ collection: contentCollection, slug: "  " })).rejects.toMatchObject({
				code: "invalid_input",
			});
			await expect(store.getWorkingEntryBySlug({ collection: contentCollection } as never)).rejects.toMatchObject({
				code: "invalid_input",
			});
		});
	});
};

const createSlugsInUseContract: ContractSuite = (factory) => {
	describe("EntryStore: slugs in use", () => {
		let session: StoreSession;
		let store: ContentStore;

		beforeAll(async () => {
			session = await factory.create();
			store = session.store;
		});

		afterAll(async () => {
			await session.close();
		});

		const seed = async (slug: string) => {
			const entry = await seedEntry(store, {
				collection: contentCollection,
				slug: null,
				metadata: { title: slug },
				text: "Body",
				locale: defaultLocale,
			});
			return seedSave(store, entry.id, {
				expectedVersion: entry.version,
				slug,
				metadata: { title: slug },
				text: "Body",
			});
		};

		it("returns slugs used in the same collection and language, excluding the entry being edited", async () => {
			const used = await seed("lookup-used");
			await seed("lookup-other");

			const params = { collection: contentCollection, locale: defaultLocale };
			expect(await store.slugsInUse({ ...params, slugs: ["lookup-used", "lookup-free"] })).toEqual(
				new Set(["lookup-used"]),
			);
			expect(
				await store.slugsInUse({ ...params, slugs: ["lookup-used", "lookup-other"], excludeEntryId: used.id }),
			).toEqual(new Set(["lookup-other"]));
			// A different language does not conflict.
			expect(await store.slugsInUse({ ...params, locale: "xx-unused", slugs: ["lookup-used"] })).toEqual(new Set());
		});

		it("returns an empty set for no slugs", async () => {
			expect(await store.slugsInUse({ collection: "post", locale: "ko", slugs: [] })).toEqual(new Set());
		});
	});
};

const createRemovedFieldsContract: ContractSuite = (factory) => {
	/**
	 * A site removes a field, or an option of a select field, while entries still hold values for it. Those values stay in the stored metadata
	 * on every write path and never block saving or publishing; publishing only warns about them. Uses the production write paths.
	 * The schema is not edited: a key the current schema does not know and an option the select does not list are the same situation.
	 */

	/** A key no config has a field for: what is left behind when a field is removed. */
	const ORPHAN = "removedField";
	const ORPHAN_LIST = "removedList";
	/** A select value no option has: what is left behind when an option is removed. */
	const UNKNOWN_OPTION = "removed-option";
	const selectField = storedFields(contentCollection).find(({ field, when }) => !when && field.kind === "select");
	/** Relation field a bulk operation can change (several values, to an item collection). */
	const manyRelation = (() => {
		for (const { name, field, when } of storedFields(contentCollection)) {
			if (!when && field.kind === "relation" && field.many && recordRelationField(contentCollection))
				return { name, to: field.to };
		}
		return undefined;
	})();

	describe("EntryStore: values of removed fields and options", () => {
		let session: StoreSession;
		let store: ContentStore;
		let service: ReturnType<typeof createContentService<Entry>>;
		let sequence = 0;
		const unique = (prefix: string) => `${prefix}-${++sequence}`;
		const targets = new Map<Collection, string>();

		beforeAll(async () => {
			session = await factory.create();
			store = session.store;
			service = createContentService<Entry>(store, serviceOptions);
		});

		afterAll(async () => {
			await session.close();
		});

		const relationTarget = async (to: Collection): Promise<string> => {
			const known = targets.get(to);
			if (known) return known;
			const draft = await service.createDraft({
				collection: to,
				slug: unique(to),
				metadata: await requiredMetadata(to, unique(`target ${to}`), relationTarget),
				format: "paragraphs",
				body: "Body",
			});
			const id = (
				draft.status === "published"
					? draft
					: await publishDraft(store, { id: draft.id, expectedVersion: draft.version })
			).id;
			targets.set(to, id);
			return id;
		};

		/** Metadata a post can publish with, plus what the removed field and option left behind. */
		const staleMetadata = async (title: string) => ({
			...(await requiredMetadata(contentCollection, title, relationTarget)),
			[ORPHAN]: "left behind",
			[ORPHAN_LIST]: ["a", "b"],
			...(selectField ? { [selectField.name]: UNKNOWN_OPTION } : {}),
		});

		/** A draft the way an earlier schema saved it: the stored values are written as they are, past validation. */
		const staleDraft = async (title = "Stale") =>
			seedEntry(store, {
				collection: contentCollection,
				slug: unique("stale"),
				metadata: await staleMetadata(title),
				text: "Body",
			});

		it("rejects a new unknown key on create and on save: a typo is not a removed field", async () => {
			await expect(
				service.createDraft({
					collection: contentCollection,
					slug: unique("create"),
					metadata: { ...(await requiredMetadata(contentCollection, "Create", relationTarget)), titel: "typo" },
					format: "paragraphs",
					body: "Body",
				} as never),
			).rejects.toMatchObject({ code: "invalid_metadata_key" });

			const draft = await staleDraft("Typo");
			await expect(
				service.saveDraft(draft.id, {
					collection: contentCollection,
					slug: draft.workingSlug,
					metadata: { ...draft.working.metadata, titel: "typo" },
					format: "paragraphs",
					body: "Body",
					expectedVersion: draft.version,
				} as never),
			).rejects.toMatchObject({ code: "invalid_metadata_key" });
		});

		it("keeps the value of a removed field when saving", async () => {
			const draft = await staleDraft("Save");
			// An API client that sends the stored metadata back, edited elsewhere, loses nothing.
			const saved = await service.saveDraft(draft.id, {
				collection: contentCollection,
				slug: draft.workingSlug,
				metadata: { ...draft.working.metadata, title: "Renamed" },
				format: "paragraphs",
				body: "Body",
				expectedVersion: draft.version,
			} as never);
			expect(saved.working.metadata).toMatchObject({
				title: "Renamed",
				[ORPHAN]: "left behind",
				[ORPHAN_LIST]: ["a", "b"],
			});
		});

		it.skipIf(!selectField)("keeps a select value that is no longer an option instead of the default", async () => {
			const name = selectField?.name ?? "";
			const draft = await staleDraft("Select");
			expect(draft.working.metadata[name]).toBe(UNKNOWN_OPTION);
			const saved = await service.saveDraft(draft.id, {
				collection: contentCollection,
				slug: draft.workingSlug,
				metadata: draft.working.metadata,
				format: "paragraphs",
				body: "Body changed",
				expectedVersion: draft.version,
			} as never);
			expect(saved.working.metadata[name]).toBe(UNKNOWN_OPTION);
		});

		it("publishes an entry holding removed values, keeps them in the published version and warns", async () => {
			const draft = await staleDraft("Publish");
			const published = await publishDraft(store, { id: draft.id, expectedVersion: draft.version });
			expect(published.status).toBe("published");
			expect(published.published?.metadata[ORPHAN]).toBe("left behind");
			expect(published.published?.metadata[ORPHAN_LIST]).toEqual(["a", "b"]);
			if (selectField) expect(published.published?.metadata[selectField.name]).toBe(UNKNOWN_OPTION);

			const working = await store.getWorking({ entryId: draft.id });
			const warnings = await imageWarningsForSnapshot(
				await prepareSnapshot(
					{
						collection: working.collection,
						slug: working.slug,
						metadata: working.metadata,
						doc: working.doc,
					} as never,
					{ previousMetadata: working.metadata },
				),
				{ getMediaAsset: async () => null },
			);
			expect(warnings).toContainEqual(expect.objectContaining({ code: "orphaned_metadata_key", path: ORPHAN }));
			expect(warnings).toContainEqual(expect.objectContaining({ code: "orphaned_metadata_key", path: ORPHAN_LIST }));
			if (selectField) {
				expect(warnings).toContainEqual(
					expect.objectContaining({ code: "unknown_select_value", path: selectField.name, message: UNKNOWN_OPTION }),
				);
			}
		});

		it("publishes in bulk an entry holding removed values", async () => {
			const draft = await staleDraft("Bulk publish");
			const { results } = await createBulkService(store, serviceOptions).run({
				op: "publish",
				items: [{ id: draft.id, expectedVersion: draft.version }],
			});
			expect(results).toEqual([{ id: draft.id, ok: true, version: draft.version + 1 }]);
			const after = await store.getEntry(draft.id);
			expect(after.status).toBe("published");
			expect(after.working.metadata[ORPHAN]).toBe("left behind");
		});

		it.skipIf(!manyRelation)("keeps removed values when a bulk operation saves the metadata", async () => {
			if (!manyRelation) return;
			const draft = await staleDraft("Bulk relation");
			const tag = await relationTarget(manyRelation.to as Collection);
			const { results } = await createBulkService(store, serviceOptions).run({
				op: "relation.add",
				field: manyRelation.name,
				items: [{ id: draft.id, expectedVersion: draft.version }],
				ids: [tag],
			});
			expect(results).toEqual([{ id: draft.id, ok: true, version: draft.version + 1 }]);
			const after = await store.getEntry(draft.id);
			expect(after.working.metadata[manyRelation.name]).toContain(tag);
			expect(after.working.metadata[ORPHAN]).toBe("left behind");
			expect(after.working.metadata[ORPHAN_LIST]).toEqual(["a", "b"]);
		});

		it("keeps removed values in a duplicate", async () => {
			const draft = await staleDraft("Duplicate");
			const copy = await duplicateDraft(store, { id: draft.id });
			expect(copy.working.metadata[ORPHAN]).toBe("left behind");
			expect(copy.working.metadata[ORPHAN_LIST]).toEqual(["a", "b"]);
		});

		it.skipIf(!secondLocale)(
			"lets a translation keep a removed value it already holds, and rejects a new one",
			async () => {
				const source = await service.createDraft({
					collection: contentCollection,
					slug: unique("translated"),
					metadata: await requiredMetadata(contentCollection, "Source", relationTarget),
					format: "paragraphs",
					body: "Body",
				});
				const created = await service.createTranslation({ sourceId: source.id, locale: secondLocale ?? "" });
				// The translation was saved before the field was removed.
				const translation = await seedSave(store, created.id, {
					expectedVersion: created.version,
					metadata: { title: "Translated", [ORPHAN]: "left behind" },
					text: "Body",
				});
				const input = (metadata: Record<string, unknown>) =>
					({
						collection: contentCollection,
						slug: source.workingSlug,
						metadata,
						format: "paragraphs",
						body: "Body",
						expectedVersion: translation.version,
					}) as never;
				const saved = await service.saveDraft(translation.id, input({ title: "Retitled", [ORPHAN]: "left behind" }));
				expect(saved.working.metadata).toMatchObject({ title: "Retitled", [ORPHAN]: "left behind" });
				await expect(
					service.saveDraft(translation.id, {
						...(input({ title: "T", titel: "typo" }) as object),
						expectedVersion: saved.version,
					} as never),
				).rejects.toMatchObject({ code: "invalid_metadata_key" });
			},
		);
	});
};

const createReviewRegressionsContract: ContractSuite = (factory) => {
	/** First relation field in a body collection that multi-selects from an item collection (like tags). If none, the bulk-add test is skipped. */
	const manyRelation = (() => {
		for (const { name, field, when } of storedFields(contentCollection)) {
			if (!when && field.kind === "relation" && field.many && isItemCollection(field.to)) {
				return { name, to: field.to as Collection, many: true };
			}
		}
		return undefined;
	})();
	/** Relation field used for list filtering. A multi-select field is preferred. */
	const filterRelation = manyRelation ?? recordRelationField(contentCollection);
	/**
	 * First relation field that points at a document collection (in whichever collection it lives). Used to test permanent deletion of a referenced document.
	 * A referenced item cannot even be trashed, so it must be a document. Skipped for configs that have none.
	 */
	const documentRelation = (() => {
		for (const collection of COLLECTIONS) {
			for (const { name, field, when } of storedFields(collection)) {
				if (field.kind === "relation" && !isItemCollection(field.to)) {
					return { collection, name, to: field.to as Collection, many: Boolean(field.many), when };
				}
			}
		}
		return undefined;
	})();
	const relationValue = (field: { many: boolean }, id: string) => (field.many ? [id] : id);

	/**
	 * Regression tests for defects reproduced in a code review (2026-09-26). Uses the production write paths.
	 * Collection and field names are looked up in the current config (`test/any-site.ts`).
	 */
	describe("EntryStore: review regressions", () => {
		let session: StoreSession;
		let store: ContentStore;
		let service: ReturnType<typeof createContentService<Entry>>;
		let sequence = 0;
		const unique = (prefix: string) => `${prefix}-${++sequence}`;
		const targets = new Map<Collection, string>();

		beforeAll(async () => {
			session = await factory.create();
			store = session.store;
			service = createContentService<Entry>(store, serviceOptions);
		});

		afterAll(async () => {
			await session.close();
		});

		/** A new published item of the target collection (for an item collection, saving is publishing). */
		const createTarget = async (to: Collection, title = unique(`target ${to}`)): Promise<Entry> => {
			const metadata = await requiredMetadata(to, title, relationTarget);
			const draft = await service.createDraft({
				collection: to,
				slug: unique(to),
				metadata,
				format: "paragraphs",
				body: "Body",
			});
			return draft.status === "published"
				? draft
				: publishDraft(store, { id: draft.id, expectedVersion: draft.version });
		};

		/** Target used by the required-for-publish relation (created once and reused). */
		const relationTarget = async (to: Collection): Promise<string> => {
			const known = targets.get(to);
			if (known) return known;
			const id = (await createTarget(to)).id;
			targets.set(to, id);
			return id;
		};

		const contentMetadata = async (title: string, extra: Record<string, unknown> = {}) => ({
			...(await requiredMetadata(contentCollection, title, relationTarget)),
			...extra,
		});

		const publishedPost = async (extra: Record<string, unknown> = {}, body = "본문") => {
			const draft = await service.createDraft({
				collection: contentCollection,
				slug: unique("post"),
				metadata: await contentMetadata("글", extra),
				format: "paragraphs",
				body,
			});
			return publishDraft(store, { id: draft.id, expectedVersion: draft.version });
		};

		/** An entry that points at `targetId` through `documentRelation`. For a conditional field, the condition value is filled too. */
		const createReferrer = async (title: string, targetId: string) => {
			if (!documentRelation) throw new Error("no relation into a document collection");
			const { collection, name, many, when } = documentRelation;
			const metadata = {
				...(await requiredMetadata(collection, title, relationTarget)),
				...(when ? { [when.field]: when.value } : {}),
				[name]: many ? [targetId] : targetId,
			};
			return service.createDraft({ collection, slug: unique("referrer"), metadata, format: "paragraphs", body: "x" });
		};

		it("creates a record from its title alone and derives the slug", async () => {
			const tag = await service.createDraft({
				collection: recordCollection,
				slug: null,
				metadata: await requiredMetadata(recordCollection, "Type Script", relationTarget),
				format: "paragraphs",
				body: "",
			});
			expect(tag.status).toBe("published");
			expect(tag.publishedSlug).toBe("type-script");
		});

		it("refuses unarchive/restore from a published state instead of silently unpublishing", async () => {
			const post = await publishedPost();
			await expect(store.unarchiveEntry({ id: post.id, expectedVersion: post.version })).rejects.toMatchObject({
				code: "invalid_status",
			});
			await expect(restoreDraft(store, { id: post.id, expectedVersion: post.version })).rejects.toMatchObject({
				code: "invalid_status",
			});
			expect(
				(await store.getPublishedEntryBySlug({ collection: contentCollection, slug: post.publishedSlug ?? "" })).status,
			).toBe("current");
		});

		it("restores a trashed record as an active (public) record", async () => {
			const tag = await service.createDraft({
				collection: recordCollection,
				slug: null,
				metadata: await requiredMetadata(recordCollection, unique("tag"), relationTarget),
				format: "paragraphs",
				body: "",
			});
			const trashed = await store.trashEntry({ id: tag.id, expectedVersion: tag.version });
			const restored = await restoreDraft(store, { id: tag.id, expectedVersion: trashed.version });
			expect(restored.status).toBe("published");
		});

		it("permanently deletes only trashed entries and releases never-published slugs", async () => {
			const post = await publishedPost();
			await expect(store.permanentDeleteEntry({ id: post.id, expectedVersion: post.version })).rejects.toMatchObject({
				code: "invalid_status",
			});

			const slug = unique("never-published");
			const draft = await service.createDraft({
				collection: contentCollection,
				slug,
				metadata: { title: "x" },
				format: "paragraphs",
				body: "x",
			});
			const trashedDraft = await store.trashEntry({ id: draft.id, expectedVersion: draft.version });
			await store.permanentDeleteEntry({ id: draft.id, expectedVersion: trashedDraft.version });
			const reused = await service.createDraft({
				collection: contentCollection,
				slug,
				metadata: { title: "y" },
				format: "paragraphs",
				body: "y",
			});
			expect(reused.workingSlug).toBe(slug);
		});

		it.skipIf(!documentRelation)(
			"blocks permanently deleting a trashed entry that another entry references",
			async () => {
				if (!documentRelation) return;
				const target = await createTarget(documentRelation.to);
				const referrer = await createReferrer("참조하는 글", target.id);
				if (referrer.status !== "published")
					await publishDraft(store, { id: referrer.id, expectedVersion: referrer.version });
				const trashed = await store.trashEntry({ id: target.id, expectedVersion: target.version });
				await expect(
					store.permanentDeleteEntry({ id: target.id, expectedVersion: trashed.version }),
				).rejects.toMatchObject({
					code: "in_use",
					details: {
						usages: expect.arrayContaining([expect.objectContaining({ collection: documentRelation.collection })]),
					},
				});
			},
		);

		it.skipIf(!manyRelation)("adds tags in bulk to an entry that has no tags yet", async () => {
			if (!manyRelation) return;
			const tag = await createTarget(manyRelation.to, unique("bulk"));
			const metadata = await contentMetadata("n");
			delete metadata[manyRelation.name];
			const post = await service.createDraft({
				collection: contentCollection,
				slug: unique("untagged"),
				metadata,
				format: "paragraphs",
				body: "x",
			});
			const { results } = await createBulkService(store, serviceOptions).run({
				op: "relation.add",
				field: manyRelation.name,
				items: [{ id: post.id, expectedVersion: post.version }],
				ids: [tag.id],
			});
			expect(results).toEqual([{ id: post.id, ok: true, version: post.version + 1 }]);
			expect((await store.getEntry(post.id)).working.metadata[manyRelation.name]).toEqual([tag.id]);
		});

		it.skipIf(!documentRelation)(
			"permanently deletes trashed items in bulk and names the entries that still reference a blocked one",
			async () => {
				if (!documentRelation) return;
				const target = await service.createDraft({
					collection: documentRelation.to,
					slug: unique("replaced"),
					metadata: await requiredMetadata(documentRelation.to, "대체될 글", relationTarget),
					format: "paragraphs",
					body: "x",
				});
				const referrer = await createReferrer("참조하는 글", target.id);
				const loose = await service.createDraft({
					collection: contentCollection,
					slug: unique("loose"),
					metadata: { title: "l" },
					format: "paragraphs",
					body: "l",
				});
				const trashedTarget = await store.trashEntry({ id: target.id, expectedVersion: target.version });
				const trashedLoose = await store.trashEntry({ id: loose.id, expectedVersion: loose.version });

				const { results } = await createBulkService(store, serviceOptions).run({
					op: "permanentDelete",
					items: [
						{ id: target.id, expectedVersion: trashedTarget.version },
						{ id: loose.id, expectedVersion: trashedLoose.version },
						{ id: referrer.id, expectedVersion: referrer.version },
					],
				});

				expect(results[0]).toMatchObject({ id: target.id, ok: false, error: "in_use" });
				expect(results[0]?.ok === false && results[0].usages?.map((usage) => usage.title)).toEqual(["참조하는 글"]);
				expect(results[1]).toEqual({ id: loose.id, ok: true, version: trashedLoose.version });
				expect(results[2]).toMatchObject({ id: referrer.id, ok: false, error: "invalid_status" });
				await expect(store.getEntry(loose.id)).rejects.toMatchObject({ code: "not_found" });
				expect((await store.getEntry(target.id)).status).toBe("trashed");
			},
		);

		it("duplicates without the publish date and with a hash that matches its metadata", async () => {
			const draft = await service.createDraft({
				collection: contentCollection,
				slug: unique("dup"),
				metadata: await contentMetadata("원본"),
				format: "paragraphs",
				body: "본문",
			});
			const source = await publishDraft(store, { id: draft.id, expectedVersion: draft.version });
			expect(source.publishedAt).toBeInstanceOf(Date);
			const copy = await duplicateDraft(store, { id: source.id, title: "원본 (복사)" });
			expect(copy.publishedAt).toBeUndefined();
			expect(copy.working.metadata.title).toBe("원본 (복사)");
			const recomputed = await prepareSnapshot({
				collection: contentCollection,
				slug: null,
				metadata: copy.working.metadata as never,
				doc: copy.working.doc,
			});
			expect(copy.working.contentHash).toBe(recomputed.contentHash);
		});

		it("can return to a previous public slug of the same entry", async () => {
			const post = await publishedPost();
			const original = post.publishedSlug as string;
			const renamed = await service.saveDraft(post.id, {
				collection: contentCollection,
				slug: unique("renamed"),
				metadata: post.working.metadata as never,
				doc: post.working.doc,
				expectedVersion: post.version,
			});
			const republished = await publishDraft(store, { id: post.id, expectedVersion: renamed.version });
			const back = await service.saveDraft(post.id, {
				collection: contentCollection,
				slug: original,
				metadata: post.working.metadata as never,
				doc: post.working.doc,
				expectedVersion: republished.version,
			});
			const final = await publishDraft(store, { id: post.id, expectedVersion: back.version });
			expect(final.publishedSlug).toBe(original);
		});

		it.skipIf(!filterRelation)("filters the admin list by trash, tag and unpublished changes", async () => {
			if (!filterRelation) return;
			const tag = await createTarget(filterRelation.to, unique("filter"));
			const tagged = await publishedPost({ [filterRelation.name]: relationValue(filterRelation, tag.id) });
			const changed = await service.saveDraft(tagged.id, {
				collection: contentCollection,
				slug: tagged.workingSlug,
				metadata: { ...(tagged.working.metadata as object), title: "수정 중" } as never,
				doc: tagged.working.doc,
				expectedVersion: tagged.version,
			});

			const relations = { [filterRelation.name]: [tag.id] };
			const byTag = await store.listEntries({ collection: contentCollection, relations });
			expect(byTag.items.map((item) => item.id)).toEqual([tagged.id]);
			expect(byTag.items[0]?.hasUnpublishedChanges).toBe(true);
			expect(byTag.items[0]?.relations[filterRelation.name]).toEqual([{ id: tag.id, title: expect.any(String) }]);

			const withChanges = await store.listEntries({ collection: contentCollection, hasUnpublishedChanges: true });
			expect(withChanges.items.map((item) => item.id)).toContain(tagged.id);

			const trashed = await store.trashEntry({ id: tagged.id, expectedVersion: changed.version });
			expect((await store.listEntries({ collection: contentCollection, relations })).items).toHaveLength(0);
			const trash = await store.listEntries({ collection: contentCollection, statuses: ["trashed"] });
			expect(trash.items.find((item) => item.id === tagged.id)?.trashedAt).toBeInstanceOf(Date);
			expect(trashed.status).toBe("trashed");
		});

		it("refuses to delete media that an unparsed draft or a template still mentions", async () => {
			const media = await store.createMediaAsset({
				filename: "a.png",
				mimeType: "image/png",
				byteSize: 10,
				stagingKey: "staging/a.png",
			});
			await store.completeMediaAsset({
				id: media.id,
				storageKey: "media/a.png",
				mimeType: "image/png",
				byteSize: 10,
				width: 1,
				height: 1,
			});
			await store.createTemplate({
				name: unique("tpl"),
				doc: imageDoc(media.id, "a"),
			});
			await expect(store.beginMediaDelete(media.id)).rejects.toMatchObject({
				code: "in_use",
				details: { templates: 1 },
			});
			expect((await store.getMediaAsset(media.id))?.status).toBe("ready");
		});
	});
};

const createDuplicateContract: ContractSuite = (factory) => {
	describe("EntryStore: duplicate entry", () => {
		let session: StoreSession;
		let store: ContentStore;
		let relationTarget: (to: Collection) => Promise<string>;

		/** For each relation field that points at an item collection, a value picking one published item (such as the reference blog's categories and tags). */
		const itemRelationValues = async () => {
			const values: Record<string, string | string[]> = {};
			for (const { name, field, when } of storedFields(contentCollection)) {
				if (when || field.kind !== "relation" || !isItemCollection(field.to)) continue;
				const id = await relationTarget(field.to as Collection);
				values[name] = field.many ? [id] : id;
			}
			return values;
		};

		beforeAll(async () => {
			session = await factory.create();
			store = session.store;
			relationTarget = fillRequiredMetadata(store).relationTarget;
		});

		afterAll(async () => {
			await session.close();
		});

		it("duplicates entry draft with the caller's title, empty slug, draft status, and preserved references", async () => {
			const media = await store.createMediaAsset({
				filename: "sample.png",
				mimeType: "image/png",
				byteSize: 1024,
				stagingKey: "staging/sample.png",
			});
			const mediaId = media.id;
			const folder = await store.createFolder({ collection: contentCollection, parentId: null, name: "Tech" });
			const relations = await itemRelationValues();
			expect(Object.keys(relations).length).toBeGreaterThan(0);

			// A published entry with a folder and an image (a media reference) in its body, made the way production makes it.
			const original = await createContentService<Entry>(store, serviceOptions).createDraft({
				collection: contentCollection,
				slug: "orig-slug",
				metadata: { title: "Original Post", ...relations },
				doc: imageDoc(mediaId, "sample", "Hello world"),
				folderId: folder.id,
			} as ServiceInput);
			const originalRefs = await store.getWorkingReferences({ entryId: original.id });
			expect(
				originalRefs.some(
					(ref: { kind: string; targetId: string }) => ref.kind === "media" && ref.targetId === mediaId,
				),
			).toBe(true);

			// Publish original so it has published body/status
			await publishDraft(store, { id: original.id, expectedVersion: original.version });
			const publishedOrig = await store.getEntry(original.id);
			expect(publishedOrig.status).toBe("published");
			expect(publishedOrig.publishedSlug).toBe("orig-slug");

			// Execute duplicate
			// Any suffix is up to the caller (the admin screen). The store saves the given title as is.
			const duplicated = await duplicateDraft(store, { id: original.id, title: "Original Post (copy)" });

			// 1. Different ID, version 1, draft status
			expect(duplicated.id).toBeDefined();
			expect(duplicated.id).not.toBe(original.id);
			expect(duplicated.version).toBe(1);
			expect(duplicated.status).toBe("draft");

			// 2. Title is what the caller gave, slug is null/empty
			expect(duplicated.working.metadata.title).toBe("Original Post (copy)");
			expect(duplicated.workingSlug).toBeNull();
			expect(duplicated.publishedSlug).toBeNull();
			expect(duplicated.published).toBeUndefined();

			// 3. Same folder preserved (read back from the store)
			expect((await store.getEntry(duplicated.id)).folderId).toBe(folder.id);

			// 4. Working references preserved (media reuse without re-upload). The copy's are collected from its own body and fields.
			const refs = await store.getWorkingReferences({ entryId: duplicated.id });
			const key = (ref: { kind: string; targetId: string }) => `${ref.kind}:${ref.targetId}`;
			expect(refs.map(key).sort()).toEqual(originalRefs.map(key).sort());

			// 5. Body and relation metadata (such as categories and tags) preserved
			expect(duplicated.working.doc).toEqual(publishedOrig.working.doc);
			for (const [name, value] of Object.entries(relations)) {
				expect(duplicated.working.metadata[name]).toEqual(value);
			}
			expect(duplicated.working.metadata).toEqual({ ...publishedOrig.working.metadata, title: "Original Post (copy)" });
		});

		it("keeps the original title when no title is given, and checks the title field's max", async () => {
			const original = await seedEntry(store, {
				collection: contentCollection,
				slug: "keep-title",
				metadata: { title: "Same title" },
				text: "",
				schemaVersion: 1,
				contentHash: randomUUID(),
			});
			const copy = await duplicateDraft(store, { id: original.id });
			expect(copy.working.metadata.title).toBe("Same title");
			// Exceeding the title field's `max` (it varies by config) gives a plain error carrying the field label and path.
			const { max, label } = titleFieldOf(contentCollection);
			if (max === undefined) return;
			await expect(duplicateDraft(store, { id: original.id, title: "가".repeat(max + 1) })).rejects.toMatchObject({
				code: "field_too_long",
				issues: [{ code: "field_too_long", path: "title", message: label }],
			});
		});

		it("throws not_found when duplicating non-existent entry", async () => {
			const ghostId = randomUUID();
			await expect(duplicateDraft(store, { id: ghostId })).rejects.toThrowError(
				expect.objectContaining({ code: "not_found" }),
			);
		});
	});
};

const createBlockIdsContract: ContractSuite = (factory) => {
	/** Five paragraphs, told apart by their text. */
	const BODY = "Title\n\nFirst paragraph\n\nSecond paragraph\n\nThird paragraph\n\nLast paragraph";

	/** The same body with a list: blocks at two depths, which only a document can say (the text format of these tests has no lists). */
	const listDoc = (second: string): StoredDocument => ({
		type: "doc",
		version: STORED_DOCUMENT_VERSION,
		content: [
			...docOfText("Title\n\nFirst paragraph").content,
			{
				type: "bulletList",
				content: [
					{ type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "one" }] }] },
					{ type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: second }] }] },
				],
			},
		],
	});

	/**
	 * Block ids across the store: a block keeps its id through saves of the same or edited text, publishing and duplicating, and a document sent with ids keeps them.
	 * The tests that look at what the adapter writes (a save of the same body must not touch the stored row) are in the adapter's own folder.
	 */
	describe("EntryStore: block ids in the store", () => {
		let session: StoreSession;
		let store: ContentStore;
		let service: ReturnType<typeof createContentService<Entry>>;
		let sequence = 0;
		const unique = (prefix: string) => `${prefix}-${++sequence}`;
		const targets = new Map<Collection, string>();

		beforeAll(async () => {
			session = await factory.create();
			store = session.store;
			service = createContentService<Entry>(store, serviceOptions);
		});

		afterAll(async () => {
			await session.close();
		});

		const relationTarget = async (to: Collection): Promise<string> => {
			const known = targets.get(to);
			if (known) return known;
			const metadata = await requiredMetadata(to, unique(`target ${to}`), relationTarget);
			const draft = await service.createDraft({
				collection: to,
				slug: unique(to),
				metadata,
				format: "paragraphs",
				body: "Body",
			});
			const published =
				draft.status === "published"
					? draft
					: await publishDraft(store, { id: draft.id, expectedVersion: draft.version });
			targets.set(to, published.id);
			return published.id;
		};

		const createDraft = async (body: { text: string } | { doc: unknown }) =>
			service.createDraft({
				collection: contentCollection,
				slug: unique("post"),
				metadata: await requiredMetadata(contentCollection, unique("Post"), relationTarget),
				...("text" in body ? { format: "paragraphs", body: body.text } : body),
			} as never);

		const save = (entry: Entry, body: { text: string } | { doc: unknown }) =>
			service.saveDraft(entry.id, {
				collection: contentCollection,
				slug: entry.workingSlug,
				metadata: entry.working.metadata as never,
				expectedVersion: entry.version,
				...("text" in body ? { format: "paragraphs", body: body.text } : body),
			} as never);

		const publish = (entry: Entry) => publishDraft(store, { id: entry.id, expectedVersion: entry.version });

		const docOf = (value: unknown): StoredDocument => {
			const doc = readStoredDocument(value);
			if (!doc) throw new Error("expected a stored document");
			return doc;
		};

		const withoutIds = (doc: StoredDocument): StoredDocument => ({ ...doc, content: withoutBlockIds(doc.content) });

		/** The ids of a document in block order. */
		const idList = (value: unknown) => {
			const ids: (string | undefined)[] = [];
			forEachBlock(docOf(value).content, (node) => ids.push(node.id));
			return ids;
		};

		/** Block id by the text a heading or paragraph starts with (texts in these tests are unique). */
		const idsByText = (value: unknown) => {
			const found = new Map<string, string | undefined>();
			forEachBlock(docOf(value).content, (node) => {
				const text = node.content?.[0]?.text;
				if (text !== undefined) found.set(text, node.id);
			});
			return found;
		};

		/** The stored document of a body, read back from the store. */
		const storedDoc = async (entryId: string, state: "working" | "published") => {
			const entry = await store.getEntry(entryId);
			return (state === "working" ? entry.working : entry.published)?.doc;
		};

		const expectUniqueIds = (value: unknown) => {
			const ids = idList(value);
			expect(ids.length).toBeGreaterThan(0);
			for (const id of ids) expect(isBlockId(id)).toBe(true);
			expect(new Set(ids).size).toBe(ids.length);
		};

		it("gives every block of a new body its own id", async () => {
			const draft = await createDraft({ text: BODY });

			expectUniqueIds(draft.working.doc);
			expect(idList(draft.working.doc)).toHaveLength(5);
			expect(await storedDoc(draft.id, "working")).toEqual(draft.working.doc);
			// Ids are not part of the text.
			expect(contentOf(draft.working.doc)).toEqual(bodyText(BODY));
		});

		describe("saving text", () => {
			it("editing one paragraph keeps the ids of the others and of the edited one", async () => {
				const draft = await createDraft({ text: BODY });
				const before = idsByText(draft.working.doc);
				const blocksBefore = idList(draft.working.doc);

				const saved = await save(draft, { text: BODY.replace("Second paragraph", "Second paragraph, reworded") });

				expect(saved.version).toBe(draft.version + 1);
				const after = idsByText(saved.working.doc);
				expect(after.get("Title")).toBe(before.get("Title"));
				expect(after.get("First paragraph")).toBe(before.get("First paragraph"));
				expect(after.get("Third paragraph")).toBe(before.get("Third paragraph"));
				expect(after.get("Second paragraph, reworded")).toBe(before.get("Second paragraph"));
				// The whole tree, the list included, is the one it was.
				expect(idList(saved.working.doc)).toEqual(blocksBefore);
				expect(await storedDoc(draft.id, "working")).toEqual(saved.working.doc);
			});

			it("editing text inside a list item keeps the ids of the list, its items and the other blocks", async () => {
				const draft = await createDraft({ doc: listDoc("two") });
				expect(idList(draft.working.doc)).toHaveLength(7);

				const saved = await save(draft, { doc: withoutIds(listDoc("two and more")) });

				expect(idList(saved.working.doc)).toEqual(idList(draft.working.doc));
			});

			it("adding a paragraph keeps the other ids and gives the new block an id nobody has", async () => {
				const draft = await createDraft({ text: BODY });
				const before = idsByText(draft.working.doc);

				const saved = await save(draft, {
					text: BODY.replace("Third paragraph", "Inserted paragraph\n\nThird paragraph"),
				});

				const after = idsByText(saved.working.doc);
				for (const text of ["Title", "First paragraph", "Second paragraph", "Third paragraph"]) {
					expect(after.get(text)).toBe(before.get(text));
				}
				expect([...before.values()]).not.toContain(after.get("Inserted paragraph"));
				expectUniqueIds(saved.working.doc);
			});

			it("moving a paragraph keeps its id", async () => {
				const draft = await createDraft({ text: BODY });
				const before = idsByText(draft.working.doc);

				const saved = await save(draft, {
					text: "Title\n\nThird paragraph\n\nFirst paragraph\n\nSecond paragraph\n\nLast paragraph",
				});

				const after = idsByText(saved.working.doc);
				for (const text of ["Title", "First paragraph", "Second paragraph", "Third paragraph"]) {
					expect(after.get(text)).toBe(before.get(text));
				}
			});

			it("a body that stops parsing and is fixed again gets new ids: the unparsed draft it replaces has no blocks to pair with", async () => {
				const draft = await createDraft({ text: BODY });
				const broken = await save(draft, { text: "Words\n\n<<<Unclosed" });
				expect(broken.working.doc.content[0]?.type).toBe("unparsed");

				const fixed = await save(broken, { text: BODY });

				expectUniqueIds(fixed.working.doc);
				expect(withoutBlockIds(docOf(fixed.working.doc).content)).toEqual(
					withoutBlockIds(docOf(draft.working.doc).content),
				);
			});
		});

		describe("saving a document", () => {
			const given = (doc: StoredDocument, ids: readonly string[]): StoredDocument => ({
				...doc,
				content: doc.content.map((block, index) => ({ ...block, id: ids[index] ?? "zzzzzzzz" })),
			});

			it("a draft saved with a document keeps the ids the client sent", async () => {
				const draft = await createDraft({ text: BODY });
				const ids = ["clientaa", "clientbb", "clientcc", "clientdd", "clientee"];

				const saved = await save(draft, { doc: given(docOf(draft.working.doc), ids) });

				// The content is the same, so it is no new version: the ids the client chose are stored all the same.
				expect(saved.version).toBe(draft.version);
				expect(saved.updatedAt.getTime()).toBe(draft.updatedAt.getTime());
				expect(docOf(saved.working.doc).content.map((block) => block.id)).toEqual(ids);
				expect(docOf(await storedDoc(draft.id, "working")).content.map((block) => block.id)).toEqual(ids);
			});

			it("a block sent without an id gets one, and a repeated id is given a new one to the later block", async () => {
				const draft = await createDraft({ text: "One\n\nTwo\n\nThree" });
				const doc = docOf(draft.working.doc);
				const [first, second, third] = doc.content;
				if (!first || !second || !third) throw new Error("fixture");

				const saved = await save(draft, {
					doc: {
						...doc,
						content: [{ ...first, id: "kept0001" }, { ...second, id: "kept0001" }, withoutBlockIds([third])[0]],
					},
				});

				const ids = idList(saved.working.doc);
				expect(ids[0]).toBe("kept0001");
				expectUniqueIds(saved.working.doc);
			});

			it("a document created with ids keeps them", async () => {
				const first = await createDraft({ text: BODY });
				const ids = ["newaaaaa", "newbbbbb", "newccccc", "newddddd", "neweeeee"];

				const created = await createDraft({ doc: given(docOf(first.working.doc), ids) });

				expect(docOf(created.working.doc).content.map((block) => block.id)).toEqual(ids);
			});
		});

		describe("publishing", () => {
			it("copies the ids to the published body", async () => {
				const draft = await createDraft({ text: BODY });

				const published = await publish(draft);

				expect(idList(published.published?.doc)).toEqual(idList(draft.working.doc));
				expect(await storedDoc(draft.id, "published")).toEqual(await storedDoc(draft.id, "working"));
				expectUniqueIds(published.published?.doc);
			});

			it("a later save changes the working ids only, and the next publish copies them", async () => {
				const published = await publish(await createDraft({ text: BODY }));
				const publishedIds = idList(published.published?.doc);

				const edited = await save(published, { text: BODY.replace("First paragraph", "First paragraph, reworded") });

				expect(idList(await storedDoc(published.id, "published"))).toEqual(publishedIds);
				// The edited paragraph is the same block: the two bodies still share every id.
				expect(idList(edited.working.doc)).toEqual(publishedIds);
				const again = await publish(edited);
				expect(idList(again.published?.doc)).toEqual(publishedIds);
			});
		});

		describe("duplicating", () => {
			it("keeps the ids of the copy, unique within it, and leaves the original as it was", async () => {
				const original = await createDraft({ text: BODY });
				const before = await store.getEntry(original.id);

				const copy = await duplicateDraft(store, { id: original.id });

				expect(idList(copy.working.doc)).toEqual(idList(original.working.doc));
				expectUniqueIds(copy.working.doc);
				expect(await storedDoc(copy.id, "working")).toEqual(before.working.doc);
				expect(await store.getEntry(original.id)).toEqual(before);
			});

			it("the copy and the original do not affect each other's ids when one is edited", async () => {
				const original = await createDraft({ text: BODY });
				const copy = await duplicateDraft(store, { id: original.id });

				const edited = await save(copy, { text: BODY.replace("Third paragraph", "Third paragraph, reworded") });

				expect(idList(edited.working.doc)).toEqual(idList(original.working.doc));
				expect(await storedDoc(original.id, "working")).toEqual(original.working.doc);
			});
		});

		describe("changes that leave the body alone", () => {
			it("a bulk move to another folder keeps every id", async () => {
				const entry = await createDraft({ text: BODY });
				const folder = await store.createFolder({
					collection: contentCollection,
					parentId: null,
					name: unique("Folder"),
				});

				const { results } = await createBulkService(store, serviceOptions).run({
					op: "folder.move",
					folderId: folder.id,
					items: [{ id: entry.id, expectedVersion: entry.version }],
				});

				expect(results[0]).toMatchObject({ ok: true });
				expect((await store.getEntry(entry.id)).working.doc).toEqual(entry.working.doc);
			});

			it("editing a template keeps the ids of the blocks that stay", async () => {
				const template = await store.createTemplate({ name: unique("Template"), doc: docOfText(BODY) });
				const updated = await store.updateTemplate({
					id: template.id,
					expectedVersion: template.version,
					doc: (({ content, ...rest }) => ({ ...rest, content: withoutBlockIds(content) }))(
						docOfText(BODY.replace("Second paragraph", "Second paragraph, reworded")),
					),
				});

				expect(idList(updated.doc)).toEqual(idList(template.doc));
			});
		});

		describe("reference occurrences", () => {
			const imageBody = (mediaId: string, intro = "Intro paragraph") => imageDoc(mediaId, "Picture", "Title", intro);

			const withMedia = async () =>
				(
					await store.createMediaAsset({
						filename: "block-ids.png",
						mimeType: "image/png",
						byteSize: 1024,
						stagingKey: `staging/${randomUUID()}.png`,
					})
				).id;

			const imageBlockId = (value: unknown) => {
				let id: string | undefined;
				forEachBlock(docOf(value).content, (node) => {
					if (node.type === "image") id = node.id;
				});
				return id;
			};

			/** The media reference to `mediaId` (a required relation field of the entry makes references of its own). */
			const mediaReference = async (entryId: string, mediaId: string) =>
				(await store.getWorkingReferences({ entryId })).find(
					(reference) => reference.kind === "media" && reference.targetId === mediaId,
				);

			it("stores the block id of the image an occurrence is in", async () => {
				const mediaId = await withMedia();
				const draft = await createDraft({ doc: imageBody(mediaId) });

				const reference = await mediaReference(draft.id, mediaId);
				expect(reference?.occurrences).toEqual([{ type: "body", blockId: imageBlockId(draft.working.doc) }]);
			});

			it("saving the same body again, with or without its ids, keeps the occurrences and the version", async () => {
				const mediaId = await withMedia();
				const draft = await createDraft({ doc: imageBody(mediaId) });
				const before = await store.getWorkingReferences({ entryId: draft.id });

				const same = await save(draft, { doc: imageBody(mediaId) });
				expect(same.version).toBe(draft.version);
				const untidy = await save(same, { doc: withoutIds(imageBody(mediaId)) });
				expect(untidy.version).toBe(draft.version);
				const fromDoc = await save(untidy, { doc: untidy.working.doc });
				expect(fromDoc.version).toBe(draft.version);

				expect(await store.getWorkingReferences({ entryId: draft.id })).toEqual(before);
			});

			it("editing another block keeps the block id of the occurrence", async () => {
				const mediaId = await withMedia();
				const draft = await createDraft({ doc: imageBody(mediaId) });

				const saved = await save(draft, { doc: imageBody(mediaId, "Intro paragraph, reworded") });

				expect(saved.version).toBe(draft.version + 1);
				const reference = await mediaReference(draft.id, mediaId);
				expect(reference?.occurrences).toEqual([{ type: "body", blockId: imageBlockId(draft.working.doc) }]);
			});
		});
	});
};

export const entriesContract: ContractSuite = (factory: StoreFactory) => {
	createSaveAndPublishContract(factory);
	createWorkingEntryBySlugContract(factory);
	createSlugsInUseContract(factory);
	createRemovedFieldsContract(factory);
	createReviewRegressionsContract(factory);
	createDuplicateContract(factory);
	createBlockIdsContract(factory);
};
