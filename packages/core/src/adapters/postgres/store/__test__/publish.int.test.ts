import type { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { contentCollection, fillRequiredMetadata } from "../../../../../test/any-site";
import { testSite } from "../../../../../test/site";
import { docOf } from "../../../../../test/stored-content";
import { publishDraft, seedEntry, seedSave } from "../../../../core/store/__test__/seed";
import { STORED_DOCUMENT_VERSION, type StoredDocument } from "../../../../doc/stored-document";
import { createContentService } from "../../../../services/content-service";
import { closeGlobalPool, createIsolatedTestPool, dropIsolatedTestPool } from "../../__test__/test-database";
import { createContentStore, migrateContentStore } from "../../content-store";

/** Collection names are looked up in the current config (`test/any-site.ts`). Posts are the document collection with a body; tags are the item collection. */
const content = contentCollection;

describe("Publishing, Lifecycle & Published-References Contracts", () => {
	let pool: Pool;
	let schemaName: string;
	let store: ReturnType<typeof createContentStore>;

	beforeAll(async () => {
		const isolated = await createIsolatedTestPool();
		pool = isolated.pool;
		schemaName = isolated.schemaName;

		await migrateContentStore(pool, { site: testSite, schema: schemaName });
		store = createContentStore(pool, { site: testSite, schema: schemaName });
		// Values needed to publish an entry (such as the reference blog's category) are irrelevant to this file's scenarios, so the store fills them in.
		fillRequiredMetadata(store);
	});

	afterAll(async () => {
		if (pool && schemaName) {
			await dropIsolatedTestPool(pool, schemaName);
		}
		await closeGlobalPool();
	});

	describe("4. Timestamps", () => {
		it("WRITE-P5 resets the publish time to now only when asked, even without changes", async () => {
			const original = new Date("2023-07-16T15:00:00Z");
			const post = await seedEntry(store, {
				collection: content,
				slug: "post-reset-date",
				metadata: { title: "Reset" },
				text: "Body",
				contentHash: "ts-hash-reset",
			});
			await pool.query(`UPDATE "${schemaName}".entries SET published_at = $2 WHERE id = $1`, [post.id, original]);
			const pub1 = await publishDraft(testSite, store, { id: post.id, expectedVersion: post.version });
			expect(pub1.publishedAt).toEqual(original);

			// Even a re-publish with no changes updates only the publish date and bumps the version.
			const before = Date.now();
			const pub2 = await publishDraft(testSite, store, {
				id: post.id,
				expectedVersion: pub1.version,
				resetPublishedAt: true,
			});
			expect(pub2.version).toBe(pub1.version + 1);
			expect(pub2.publishedAt?.getTime()).toBeGreaterThanOrEqual(before - 1000);

			await store.saveWorkingWithReferences({
				entryId: post.id,
				expectedVersion: pub2.version,
				snapshot: {
					collection: content,
					slug: "post-reset-date",
					metadata: { title: "Reset V2" },
					doc: docOf("V2"),
					contentHash: "ts-hash-reset-2",
					issues: [],
					references: [],
					imageSources: [],
				},
				references: [],
			});
			// The publish time is set back, so the reset below has to move it to now.
			await pool.query(`UPDATE "${schemaName}".entries SET published_at = $2 WHERE id = $1`, [post.id, original]);
			const pub3 = await publishDraft(testSite, store, {
				id: post.id,
				expectedVersion: pub2.version + 1,
				resetPublishedAt: true,
			});
			expect(pub3.publishedAt?.getTime()).toBeGreaterThanOrEqual(before - 1000);
		});

		it("WRITE-P5 publishes with a publish time set beforehand (migrated drafts keep their original date)", async () => {
			const post = await seedEntry(store, {
				collection: content,
				slug: "post-preset-date",
				metadata: { title: "Migrated" },
				text: "Body",
				contentHash: "ts-hash-preset",
			});
			const original = new Date("2023-07-16T15:00:00Z");
			await pool.query(`UPDATE "${schemaName}".entries SET published_at = $2 WHERE id = $1`, [post.id, original]);

			const published = await publishDraft(testSite, store, { id: post.id, expectedVersion: post.version });
			expect(published.publishedAt).toEqual(original);
		});
	});

	describe("addresses", () => {
		it("WRITE-P4 a publish that changes the body keeps the public address the entry already has", async () => {
			const post = await seedEntry(store, {
				collection: content,
				slug: "kept-address",
				metadata: { title: "Kept" },
				text: "First",
			});
			const first = await publishDraft(testSite, store, { id: post.id, expectedVersion: post.version });
			const saved = await seedSave(store, post.id, {
				expectedVersion: first.version,
				metadata: first.working.metadata,
				text: "Second",
			});
			await publishDraft(testSite, store, { id: post.id, expectedVersion: saved.version });

			const found = await store.getPublishedEntryBySlug({ collection: content, slug: "kept-address" });
			expect(found.status).toBe("current");
		});
	});

	describe("body links by address", () => {
		/** A paragraph of links written as addresses, as the document keeps a link nothing resolved at save. */
		const linksTo = (...hrefs: string[]): StoredDocument => ({
			type: "doc",
			version: STORED_DOCUMENT_VERSION,
			content: [
				{
					type: "paragraph",
					content: hrefs.flatMap((href, index) => [
						...(index > 0 ? [{ type: "text", text: " " }] : []),
						{ type: "text", text: `link ${index}`, marks: [{ type: "link", attrs: { href } }] },
					]),
				},
			],
		});

		it("WRITE-P1 a link to the address of an entry in the trash only warns, and one to an address nobody holds blocks", async () => {
			const target = await seedEntry(store, {
				collection: content,
				slug: "link-trashed-target",
				metadata: { title: "Trashed" },
				text: "Target",
			});
			const published = await publishDraft(testSite, store, { id: target.id, expectedVersion: target.version });
			await store.trashEntry({ id: target.id, expectedVersion: published.version });
			const toTrash = testSite.contentPath(content, "link-trashed-target") as string;
			const toNobody = testSite.contentPath(content, "link-nobody-holds") as string;
			const source = await seedEntry(store, {
				collection: content,
				slug: "link-trashed-source",
				metadata: { title: "Source" },
				doc: linksTo(toTrash, toNobody),
			});

			const checked = await createContentService(store, { site: testSite }).checkPublish({ id: source.id });

			const links = (issues: readonly { code: string; message?: string }[]) =>
				issues.filter((issue) => issue.code.endsWith("internal_link")).map((issue) => `${issue.code} ${issue.message}`);
			expect(links(checked.issues)).toEqual([`unresolved_internal_link ${toNobody}`]);
			expect(links(checked.warnings)).toEqual([`unpublished_internal_link ${toTrash}`]);
		});
	});
});
