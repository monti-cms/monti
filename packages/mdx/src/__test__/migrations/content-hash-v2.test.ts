import { createHash } from "node:crypto";
import { createFormatRegistry } from "@monti-cms/core/format";
import {
	CONTENT_STORE_MIGRATIONS,
	type Collection,
	closeGlobalPool,
	createContentService,
	createContentStore,
	createIsolatedTestPool,
	dropIsolatedTestPool,
	type Entry,
	type JsonValue,
	mdxContentHash,
	migrateContentStore,
	publishDraft,
	recomputeContentHashes,
} from "@monti-cms/core/testing";
import type { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { contentCollection, requiredMetadata } from "../../../../core/test/any-site";
import { testSite } from "../../../../core/test/site";
import { createServerMdxFormat, legacyBodies } from "../../server";

/** The `mdx` format as a server registers it: it also reads the text of old bodies, which the migration steps under test need. */
const formats = createFormatRegistry([createServerMdxFormat()]);
const bodies = legacyBodies(testSite);

/** The content hash as it was before the parsed-body hash: it covered the MDX string itself. */
const hashV1 = (metadata: JsonValue, mdx: string, schemaVersion: number): string => {
	const sorted = (value: JsonValue): JsonValue =>
		value === null || typeof value !== "object"
			? value
			: Array.isArray(value)
				? value.map(sorted)
				: Object.fromEntries(
						Object.keys(value)
							.sort()
							.map((key) => [key, sorted((value as Record<string, JsonValue>)[key] as JsonValue)]),
					);
	return createHash("sha256")
		.update(JSON.stringify(["cms-snapshot-v1", schemaVersion, sorted(metadata), mdx]))
		.digest("hex");
};

/** A syntax-only difference: the same text and emphasis written two ways. */
const STAR = "An *a* word";
const UNDERSCORE = "An _a_ word";

describe("content hash v2", () => {
	let pool: Pool;
	let schemaName: string;
	let store: ReturnType<typeof createContentStore>;
	let service: ReturnType<typeof createContentService<Entry>>;
	let sequence = 0;
	const unique = (prefix: string) => `${prefix}-${++sequence}`;
	const targets = new Map<Collection, string>();

	beforeAll(async () => {
		const isolated = await createIsolatedTestPool();
		pool = isolated.pool;
		schemaName = isolated.schemaName;
		await migrateContentStore(pool, { site: testSite, schema: schemaName, formats });
		store = createContentStore(pool, { site: testSite, schema: schemaName });
		service = createContentService<Entry>(store, { site: testSite, formats: async () => formats });
	});

	afterAll(async () => {
		if (pool && schemaName) await dropIsolatedTestPool(pool, schemaName);
		await closeGlobalPool();
	});

	const relationTarget = async (to: Collection): Promise<string> => {
		const known = targets.get(to);
		if (known) return known;
		const metadata = await requiredMetadata(to, unique(`target ${to}`), relationTarget);
		const draft = (
			await service.createDraft({
				collection: to,
				slug: unique(to),
				metadata,
				format: "mdx",
				body: "Body",
			})
		).entry;
		const published =
			draft.status === "published"
				? draft
				: await publishDraft(testSite, store, { id: draft.id, expectedVersion: draft.version });
		targets.set(to, published.id);
		return published.id;
	};

	const metadataFor = async (title: string) => ({
		...(await requiredMetadata(contentCollection, title, relationTarget)),
	});

	const createDraft = async (mdx: string) =>
		service
			.createDraft({
				collection: contentCollection,
				slug: unique("post"),
				metadata: await metadataFor(unique("Post")),
				format: "mdx",
				body: mdx,
			})
			.then((result) => result.entry);

	const publishedWith = async (mdx: string) => {
		const draft = await createDraft(mdx);
		return publishDraft(testSite, store, { id: draft.id, expectedVersion: draft.version });
	};

	const saveMdx = (entry: Entry, mdx: string) =>
		service
			.saveDraft(entry.id, {
				collection: contentCollection,
				slug: entry.workingSlug,
				metadata: entry.working.metadata as never,
				format: "mdx",
				body: mdx,
				expectedVersion: entry.version,
			})
			.then((result) => result.entry);

	const hasUnpublishedChanges = async (entryId: string) => {
		const { items } = await store.listEntries({ collection: contentCollection });
		const item = items.find((candidate) => candidate.id === entryId);
		if (!item) throw new Error(`entry ${entryId} is not in the list`);
		return item.hasUnpublishedChanges;
	};

	describe("saving", () => {
		it("a re-save that only changes the syntax is not an unpublished change and does not bump the version", async () => {
			const published = await publishedWith(STAR);

			const resaved = await saveMdx(published, UNDERSCORE);

			expect(resaved.version).toBe(published.version);
			expect(resaved.updatedAt.getTime()).toBe(published.updatedAt.getTime());
			expect(resaved.working.contentHash).toBe(published.working.contentHash);
			// Both spellings are stored as the same document.
			expect(resaved.working.doc).toEqual(published.working.doc);
			expect(await hasUnpublishedChanges(published.id)).toBe(false);
		});

		it("a re-save that changes the content is an unpublished change", async () => {
			const published = await publishedWith(STAR);

			const resaved = await saveMdx(published, "An *b* word");

			expect(resaved.version).toBe(published.version + 1);
			expect(await hasUnpublishedChanges(published.id)).toBe(true);
		});

		it("publishing a body that only differs in syntax keeps the published snapshot", async () => {
			const published = await publishedWith(STAR);
			const resaved = await saveMdx(published, UNDERSCORE);

			const republished = await publishDraft(testSite, store, { id: published.id, expectedVersion: resaved.version });

			expect(republished.version).toBe(published.version);
			expect(republished.published).toEqual(published.published);
		});
	});

	describe("migration", () => {
		const STEP = "0010_content_hash_v2";

		const storedHashes = async (entryId: string) =>
			Object.fromEntries(
				(
					await pool.query<{ state: string; content_hash: string }>(
						`SELECT state, content_hash FROM "${schemaName}".entry_bodies WHERE entry_id = $1`,
						[entryId],
					)
				).rows.map((row) => [row.state, row.content_hash]),
			);

		/**
		 * A store from before documents: the text of every body that has none (a save no longer writes it) is written as the format writes the document.
		 * Rows that were given a text on purpose are left as they are.
		 */
		const giveLegacyText = async () => {
			const rows = await pool.query<{ entry_id: string; state: string; doc: Parameters<typeof bodies.write>[0] }>(
				`SELECT entry_id, state, doc FROM "${schemaName}".entry_bodies WHERE mdx IS NULL`,
			);
			for (const row of rows.rows) {
				await pool.query(`UPDATE "${schemaName}".entry_bodies SET mdx = $1 WHERE entry_id = $2 AND state = $3`, [
					bodies.write(row.doc).text,
					row.entry_id,
					row.state,
				]);
			}
		};

		/** Stored rows whose hash is not what the current hash rule gives for their metadata, MDX and schema version. */
		const staleHashes = async () => {
			const rows = await pool.query<{
				entry_id: string;
				state: string;
				metadata: JsonValue;
				mdx: string;
				schema_version: number;
				content_hash: string;
			}>(`SELECT entry_id, state, metadata, mdx, schema_version, content_hash FROM "${schemaName}".entry_bodies`);
			expect(rows.rows.length).toBeGreaterThan(0);
			return rows.rows
				.filter((row) => row.content_hash !== mdxContentHash(bodies, row.metadata, row.mdx))
				.map((row) => `${row.entry_id}/${row.state}`);
		};

		/** Rewrites every stored hash the way the previous version would have, and marks the step as not applied yet. */
		const downgradeToV1 = async () => {
			await giveLegacyText();
			const rows = await pool.query<{
				entry_id: string;
				state: string;
				metadata: JsonValue;
				mdx: string;
				schema_version: number;
			}>(`SELECT entry_id, state, metadata, mdx, schema_version FROM "${schemaName}".entry_bodies`);
			for (const row of rows.rows) {
				await pool.query(
					`UPDATE "${schemaName}".entry_bodies SET content_hash = $1 WHERE entry_id = $2 AND state = $3`,
					[hashV1(row.metadata, row.mdx, row.schema_version), row.entry_id, row.state],
				);
			}
			await pool.query(`DELETE FROM "${schemaName}".cms_migrations WHERE name = $1`, [STEP]);
		};

		it("is a recorded migration step", () => {
			expect(CONTENT_STORE_MIGRATIONS).toContain(STEP);
		});

		it("recomputes stored hashes with v2 and keeps what the list shows as unpublished changes", async () => {
			const same = await publishedWith(STAR);
			// Published with one spelling, edited to the other, saved with the old (v1) hash: v1 reported a change that is not one.
			const syntaxOnly = await publishedWith(STAR);
			const edited = await publishedWith(STAR);
			await saveMdx(edited, "An *b* word");
			await createDraft("Hello {");

			await giveLegacyText();
			await pool.query(`UPDATE "${schemaName}".entry_bodies SET mdx = $1 WHERE entry_id = $2 AND state = 'working'`, [
				UNDERSCORE,
				syntaxOnly.id,
			]);
			await downgradeToV1();
			const before = {
				same: await hasUnpublishedChanges(same.id),
				syntaxOnly: await hasUnpublishedChanges(syntaxOnly.id),
				edited: await hasUnpublishedChanges(edited.id),
			};
			expect(before).toEqual({ same: false, syntaxOnly: true, edited: true });

			await migrateContentStore(pool, { site: testSite, schema: schemaName, formats });

			expect(await staleHashes()).toEqual([]);
			expect(await hasUnpublishedChanges(same.id)).toBe(false);
			// Equivalent bodies stop counting as a change; different content still does.
			expect(await hasUnpublishedChanges(syntaxOnly.id)).toBe(false);
			expect(await hasUnpublishedChanges(edited.id)).toBe(true);
			const { working, published } = await storedHashes(syntaxOnly.id).then((h) => ({
				working: h.working,
				published: h.published,
			}));
			expect(working).toBe(published);
		});

		it("reaches every row whatever the batch size", async () => {
			await publishedWith(STAR);
			await publishedWith(UNDERSCORE);
			await createDraft("Hello");
			await downgradeToV1();

			const client = await pool.connect();
			try {
				// Fewer rows per batch than there are rows, with a remainder.
				await recomputeContentHashes(client, schemaName, { batchSize: 2, bodies });
			} finally {
				client.release();
			}

			expect(await staleHashes()).toEqual([]);
		});

		it("does not touch bodies, versions or modified dates", async () => {
			const published = await publishedWith(STAR);
			await downgradeToV1();

			await migrateContentStore(pool, { site: testSite, schema: schemaName, formats });

			const after = await store.getEntry(published.id);
			expect(after.version).toBe(published.version);
			expect(after.updatedAt.getTime()).toBe(published.updatedAt.getTime());
			expect(after.working.updatedAt?.getTime()).toBe(published.working.updatedAt?.getTime());
			expect(after.working.doc).toEqual(published.working.doc);
			expect(after.published).toEqual(published.published);
		});
	});
});
