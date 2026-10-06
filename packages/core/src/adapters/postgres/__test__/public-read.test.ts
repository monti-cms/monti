import type { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
	contentCollection,
	fillRequiredMetadata,
	otherContentCollection,
	recordCollection,
	recordRelationField,
	requiredMetadata,
} from "../../../../test/any-site";
import { COLLECTIONS, type Collection, isItemCollection } from "../../../core/collections";
import type { ContentStore } from "../../../core/store";
import { publishDraft, seedEntry, seedSave } from "../../../core/store/__test__/seed";
import { storedFields } from "../../../schema/derive";
import { SUMMARY_ROLE } from "../../../schema/fields";
import { createContentStore, migrateContentStore } from "../content-store";
import { closeGlobalPool, createIsolatedTestPool, dropIsolatedTestPool } from "./test-database";

/**
 * Public published-read contract (real DB).
 *
 * Verifies: drafts, archived, trashed, and reserved slugs are never public by any path,
 * only published versions are read by the canonical current slug, and former slugs are resolved as aliases.
 * Collection and field names are looked up in the current config (`test/any-site.ts`). It runs against both the reference blog config and other site configs.
 */

const content = contentCollection;
/** Document collection for trash tests (the same collection if there is no second one). */
const trashContent = otherContentCollection ?? contentCollection;
/** Two kinds of classification records (two items of the same collection if there is only one item collection). */
const itemCollections = COLLECTIONS.filter((name) => isItemCollection(name));
const otherRecordCollection = itemCollections.find((name) => name !== recordCollection) ?? recordCollection;
/** Name of the text field serving as the summary (if any). */
const summaryField = storedFields(content).find(
	({ field }) => field.kind === "text" && field.role === SUMMARY_ROLE,
)?.name;
const summaryOf = (value: string): Record<string, string> => (summaryField ? { [summaryField]: value } : {});
/** Relation field that points at items. A multi-select field is preferred (the reference blog's tags). */
const tagLikeRelation = (() => {
	for (const { name, field, when } of storedFields(content)) {
		if (!when && field.kind === "relation" && field.many && isItemCollection(field.to)) {
			return { name, to: field.to as Collection, many: true };
		}
	}
	return recordRelationField(content);
})();
const relationValue = (id: string) => (tagLikeRelation?.many ? [id] : id);
describe("public published-read contract", () => {
	let pool: Pool;
	let schemaName: string;
	let store: ContentStore;
	let relationTarget: (to: Collection) => Promise<string>;
	/** Metadata with the required-for-publish values filled in (same as the values the store fills). */
	const filled = async (title: string, extra: Record<string, unknown> = {}) => ({
		...(await requiredMetadata(content, title, relationTarget)),
		...extra,
	});

	beforeAll(async () => {
		const isolated = await createIsolatedTestPool();
		pool = isolated.pool;
		schemaName = isolated.schemaName;

		await migrateContentStore(pool, { schema: schemaName });
		store = createContentStore(pool, { schema: schemaName });
		// Required-for-publish values (such as the reference blog's category) are irrelevant to this file's scenarios, so the store fills them in.
		relationTarget = fillRequiredMetadata(store).relationTarget;
	});

	afterAll(async () => {
		if (pool && schemaName) {
			await dropIsolatedTestPool(pool, schemaName);
		}
		await closeGlobalPool();
	});

	async function createEntry(params: {
		collection: string;
		slug: string;
		metadata?: Record<string, unknown>;
		mdx?: string;
	}) {
		const metadata = params.metadata ?? { title: params.slug };
		return seedEntry(store, {
			collection: params.collection,
			slug: params.slug,
			metadata,
			mdx: params.mdx ?? `# ${params.slug}`,
			schemaVersion: 1,
			contentHash: `hash-${params.slug}`,
		});
	}

	async function createPublishedEntry(params: {
		collection: string;
		slug: string;
		metadata?: Record<string, unknown>;
		mdx?: string;
	}) {
		const entry = await createEntry(params);

		return publishDraft(store, { id: entry.id, expectedVersion: entry.version });
	}

	async function publishedSlugs(collections: readonly string[]): Promise<string[]> {
		const rows = await store.listPublishedEntries({ collections });

		return rows.map((row) => row.slug);
	}

	async function addressType(slug: string): Promise<string | undefined> {
		const res = await pool.query<{ type: string }>(
			`SELECT type FROM "${schemaName}".content_addresses WHERE slug = $1`,
			[slug],
		);

		return res.rows[0]?.type;
	}

	it("does not show drafts in public lists or single reads", async () => {
		const draft = await createEntry({ collection: content, slug: "draft-only", metadata: { title: "초안" } });

		expect(draft.status).toBe("draft");
		expect(await addressType("draft-only")).toBe("reservation");
		expect(await publishedSlugs([content])).not.toContain("draft-only");
		await expect(store.getPublishedEntryBySlug({ collection: content, slug: "draft-only" })).resolves.toEqual({
			status: "not_found",
		});
	});

	it("shows the canonical slug, body, and metadata in public reads once published", async () => {
		await createPublishedEntry({
			collection: content,
			slug: "live-post",
			metadata: { title: "공개 글", ...summaryOf("요약") },
			mdx: "# 공개 본문",
		});

		expect(await publishedSlugs([content])).toContain("live-post");
		expect(await addressType("live-post")).toBe("current");

		const lookup = await store.getPublishedEntryBySlug({ collection: content, slug: "live-post" });

		expect(lookup.status).toBe("current");
		if (lookup.status === "current") {
			expect(lookup.entry.slug).toBe("live-post");
			expect(lookup.entry.mdx).toBe("# 공개 본문");
			expect(lookup.entry.metadata).toEqual(await filled("공개 글", summaryOf("요약")));
			expect(lookup.entry.publishedAt).toBeInstanceOf(Date);
		}
	});

	it("omits the body in list reads by default and includes it only on request", async () => {
		const withoutBody = await store.listPublishedEntries({ collections: [content] });
		const withBody = await store.listPublishedEntries({ collections: [content], includeBody: true });

		expect(withoutBody.length).toBeGreaterThan(0);
		expect(withoutBody.every((row) => row.mdx === "")).toBe(true);
		expect(withBody.some((row) => row.mdx.length > 0)).toBe(true);
	});

	it("includes the body in single reads by default", async () => {
		const lookup = await store.getPublishedEntryBySlug({ collection: content, slug: "live-post" });

		expect(lookup.status).toBe("current");
		if (lookup.status === "current") {
			expect(lookup.entry.mdx).toBe("# 공개 본문");
		}
	});

	it("disappears from public reads once archived", async () => {
		const published = await createPublishedEntry({ collection: content, slug: "to-archive" });

		expect(await publishedSlugs([content])).toContain("to-archive");

		await store.archiveEntry({ id: published.id, expectedVersion: published.version });

		expect(await publishedSlugs([content])).not.toContain("to-archive");
		await expect(store.getPublishedEntryBySlug({ collection: content, slug: "to-archive" })).resolves.toEqual({
			status: "not_found",
		});
	});

	it("disappears from public reads once trashed", async () => {
		const published = await createPublishedEntry({ collection: trashContent, slug: "to-trash" });

		expect(await publishedSlugs([trashContent])).toContain("to-trash");

		await store.trashEntry({ id: published.id, expectedVersion: published.version });

		expect(await publishedSlugs([trashContent])).not.toContain("to-trash");
		await expect(store.getPublishedEntryBySlug({ collection: trashContent, slug: "to-trash" })).resolves.toEqual({
			status: "not_found",
		});
	});

	it("resolves the old slug as an alias and returns the canonical slug after a slug change", async () => {
		const published = await createPublishedEntry({ collection: content, slug: "before-rename" });
		const saved = await seedSave(store, published.id, {
			expectedVersion: published.version,
			slug: "after-rename",
			metadata: { title: "이름 변경" },
			mdx: "# 이름 변경",
			schemaVersion: 1,
			contentHash: "hash-renamed",
		});

		await publishDraft(store, { id: saved.id, expectedVersion: saved.version });

		expect(await addressType("before-rename")).toBe("alias");
		expect(await addressType("after-rename")).toBe("current");

		const lookup = await store.getPublishedEntryBySlug({ collection: content, slug: "before-rename" });

		expect(lookup.status).toBe("alias");
		if (lookup.status === "alias") {
			expect(lookup.entry.slug).toBe("after-rename");
			expect(lookup.entry.mdx).toBe("# 이름 변경");
		}
	});

	it.skipIf(!tagLikeRelation)(
		"keeps the existing published snapshot until re-publish when a published entry's working copy is edited",
		async () => {
			const tagCollection = tagLikeRelation?.to ?? recordCollection;
			const tagField = tagLikeRelation?.name ?? "";
			const publishedTag = await createPublishedEntry({
				collection: tagCollection,
				slug: "f10-published-tag",
				metadata: { title: "Published tag" },
			});
			const workingTag = await createPublishedEntry({
				collection: tagCollection,
				slug: "f10-working-tag",
				metadata: { title: "Working tag" },
			});
			const published = await createPublishedEntry({
				collection: content,
				slug: "f10-published-snapshot",
				metadata: {
					title: "Published title",
					...summaryOf("Published summary"),
					[tagField]: relationValue(publishedTag.id),
				},
				mdx: "# Published body",
			});
			const working = await seedSave(store, published.id, {
				expectedVersion: published.version,
				slug: "f10-working-snapshot",
				metadata: {
					title: "Working title",
					...summaryOf("Working summary"),
					[tagField]: relationValue(workingTag.id),
				},
				mdx: "# Working body",
				schemaVersion: 1,
				contentHash: "f10-working-content",
			});

			expect(working.status).toBe("published");
			expect(await publishedSlugs([content])).toContain("f10-published-snapshot");
			expect(await publishedSlugs([content])).not.toContain("f10-working-snapshot");
			const beforeRepublish = await store.getPublishedEntryBySlug({
				collection: content,
				slug: "f10-published-snapshot",
			});
			expect(beforeRepublish.status).toBe("current");
			if (beforeRepublish.status === "current") {
				expect(beforeRepublish.entry.slug).toBe("f10-published-snapshot");
				expect(beforeRepublish.entry.mdx).toBe("# Published body");
				expect(beforeRepublish.entry.metadata).toEqual(
					await filled("Published title", {
						...summaryOf("Published summary"),
						[tagField]: relationValue(publishedTag.id),
					}),
				);
			}
			await expect(
				store.getPublishedEntryBySlug({ collection: content, slug: "f10-working-snapshot" }),
			).resolves.toEqual({
				status: "not_found",
			});

			const republished = await publishDraft(store, { id: working.id, expectedVersion: working.version });
			expect(
				await store.getPublishedEntryBySlug({ collection: content, slug: "f10-published-snapshot" }),
			).toMatchObject({
				status: "alias",
				entry: { slug: "f10-working-snapshot", mdx: "# Working body" },
			});
			expect(await store.getPublishedEntryBySlug({ collection: content, slug: "f10-working-snapshot" })).toMatchObject({
				status: "current",
				entry: { slug: "f10-working-snapshot", mdx: "# Working body", metadata: { title: "Working title" } },
			});
			expect(republished.status).toBe("published");
		},
	);
	it("does not leave a slug that went back to private as an alias either", async () => {
		const published = await createPublishedEntry({ collection: content, slug: "alias-then-archive" });
		const saved = await seedSave(store, published.id, {
			expectedVersion: published.version,
			slug: "alias-then-archive-2",
			metadata: { title: "이름 변경" },
			mdx: "# 이름 변경",
			schemaVersion: 1,
			contentHash: "hash-alias-archive",
		});
		const republished = await publishDraft(store, { id: saved.id, expectedVersion: saved.version });

		await store.archiveEntry({ id: republished.id, expectedVersion: republished.version });

		expect(await addressType("alias-then-archive")).toBe("alias");
		await expect(store.getPublishedEntryBySlug({ collection: content, slug: "alias-then-archive" })).resolves.toEqual({
			status: "not_found",
		});
		await expect(store.getPublishedEntryBySlug({ collection: content, slug: "alias-then-archive-2" })).resolves.toEqual(
			{
				status: "not_found",
			},
		);
	});

	it("makes classification records (item collections) public too, and excludes them once trashed", async () => {
		const tag = await createPublishedEntry({
			collection: recordCollection,
			slug: "public-tag",
			metadata: { title: "공개 태그" },
		});
		await createPublishedEntry({
			collection: otherRecordCollection,
			slug: "public-category",
			metadata: { title: "공개 분류" },
		});

		expect(await publishedSlugs([...new Set([recordCollection, otherRecordCollection])])).toEqual(
			expect.arrayContaining(["public-tag", "public-category"]),
		);

		// A record collection has no archive and uses only active/trashed.
		await store.trashEntry({ id: tag.id, expectedVersion: tag.version });

		expect(await publishedSlugs([recordCollection])).not.toContain("public-tag");
		expect(await publishedSlugs([otherRecordCollection])).toContain("public-category");
	});

	it("reads several collections at once without mixing in unpublished items", async () => {
		await createEntry({ collection: recordCollection, slug: "draft-tag", metadata: { title: "초안 태그" } });

		const rows = await store.listPublishedEntries({ collections: COLLECTIONS });

		expect(rows.every((row) => row.collection !== "secret")).toBe(true);
		expect(rows.map((row) => row.slug)).not.toContain("draft-tag");
	});

	it("rejects a collection that is not allowed", async () => {
		await expect(store.listPublishedEntries({ collections: ["secret"] })).rejects.toThrow(/컬렉션|collection/);
		await expect(store.listPublishedEntries({ collections: [] })).rejects.toThrow();
		await expect(store.getPublishedEntryBySlug({ collection: "secret", slug: "x" })).rejects.toThrow();
	});

	it("rejects an empty slug", async () => {
		await expect(store.getPublishedEntryBySlug({ collection: content, slug: "" })).rejects.toThrow();
	});
});
