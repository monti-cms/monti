import type { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { contentCollection, requiredMetadata } from "../../../../test/any-site";
import type { Collection } from "../../../core/collections";
import { computeContentHash } from "../../../core/content-hash";
import { createContentService } from "../../../services/content-service";
import { createContentStore, type Entry, migrateContentStore } from "../content-store";
import { formatRewriteReport, rewriteContent } from "../store/rewrite";
import { closeGlobalPool, createIsolatedTestPool, dropIsolatedTestPool } from "./test-database";

/**
 * `monti content:rewrite`: re-serializes stored bodies with the site's syntax. The content hash is unchanged by design, so the rewrite is a change of
 * spelling only: no version bump, no new modified date, and a body whose hash would change is never written.
 */

/** The same content in a spelling the serializer does not write (underscore emphasis, a `*` list, a setext heading, a backslash break). */
const UNTIDY = "Title\n=====\n\nSome _emphasis_ here\\\nand a break\n\n* one\n* two\n";
const TIDY = "# Title\n\nSome *emphasis* here<br />\nand a break\n\n- one\n- two\n";

describe("content rewrite", () => {
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
		await migrateContentStore(pool, { schema: schemaName });
		store = createContentStore(pool, { schema: schemaName });
		service = createContentService<Entry>(store);
	});

	afterAll(async () => {
		if (pool && schemaName) await dropIsolatedTestPool(pool, schemaName);
		await closeGlobalPool();
	});

	const relationTarget = async (to: Collection): Promise<string> => {
		const known = targets.get(to);
		if (known) return known;
		const metadata = await requiredMetadata(to, unique(`target ${to}`), relationTarget);
		const draft = await service.createDraft({ collection: to, slug: unique(to), metadata, mdx: "Body" });
		const published =
			draft.status === "published" ? draft : await store.publishEntry({ id: draft.id, expectedVersion: draft.version });
		targets.set(to, published.id);
		return published.id;
	};

	const createDraft = async (mdx: string) =>
		service.createDraft({
			collection: contentCollection,
			slug: unique("post"),
			metadata: await requiredMetadata(contentCollection, unique("Post"), relationTarget),
			mdx,
		});

	const publishedWith = async (mdx: string) => {
		const draft = await createDraft(mdx);
		return store.publishEntry({ id: draft.id, expectedVersion: draft.version });
	};

	const stored = async (entryId: string, state: "working" | "published") =>
		(
			await pool.query<{ mdx: string; content_hash: string; search_text: string; updated_at: Date }>(
				`SELECT mdx, content_hash, search_text, updated_at FROM "${schemaName}".entry_bodies WHERE entry_id = $1 AND state = $2`,
				[entryId, state],
			)
		).rows[0];

	const lineOf = (report: { items: readonly { label: string; outcome: string }[] }, entry: Entry, state: string) =>
		report.items.find((item) => item.label.includes(`${entry.workingSlug ?? entry.id}`) && item.label.endsWith(state));

	describe("a dry run (the default)", () => {
		it("reports each body as changed or unchanged and writes nothing", async () => {
			const untidy = await publishedWith(UNTIDY);
			const tidy = await publishedWith(TIDY);
			const before = await stored(untidy.id, "working");

			const report = await rewriteContent(pool, { schema: schemaName });

			expect(report.applied).toBe(false);
			expect(lineOf(report, untidy, "working")?.outcome).toBe("changed");
			expect(lineOf(report, untidy, "published")?.outcome).toBe("changed");
			expect(lineOf(report, tidy, "working")?.outcome).toBe("unchanged");
			expect(report.changed).toBeGreaterThanOrEqual(2);
			expect(await stored(untidy.id, "working")).toEqual(before);
			expect(await stored(untidy.id, "published")).toMatchObject({ mdx: UNTIDY });
		});

		it("prints `collection/slug (locale) state: changed|unchanged` per body and a summary", async () => {
			const untidy = await publishedWith(UNTIDY);
			const lines = formatRewriteReport(await rewriteContent(pool, { schema: schemaName }));
			expect(lines).toContain(`${contentCollection}/${untidy.workingSlug} (${untidy.locale}) working: changed`);
			expect(lines).toContain(`${contentCollection}/${untidy.workingSlug} (${untidy.locale}) published: changed`);
			expect(lines.at(-1)).toMatch(
				/^\d+ changed, \d+ unchanged, \d+ skipped\. Dry run: nothing was written \(pass --apply to write\)\.$/,
			);
		});
	});

	describe("--apply", () => {
		it("writes the site's notation and leaves the content hash, version and dates as they were", async () => {
			const published = await publishedWith(UNTIDY);
			const workingBefore = await stored(published.id, "working");
			const publishedBefore = await stored(published.id, "published");

			const report = await rewriteContent(pool, { schema: schemaName, apply: true });

			expect(report.applied).toBe(true);
			const working = await stored(published.id, "working");
			const publishedAfter = await stored(published.id, "published");
			expect(working?.mdx).toBe(TIDY);
			expect(publishedAfter?.mdx).toBe(TIDY);
			// The hash covers the parsed body, so it is the same for both spellings: asserted, not assumed.
			expect(working?.content_hash).toBe(workingBefore?.content_hash);
			expect(publishedAfter?.content_hash).toBe(publishedBefore?.content_hash);
			expect(computeContentHash(published.working.metadata, TIDY, published.working.schemaVersion)).toBe(
				workingBefore?.content_hash,
			);
			expect(working?.updated_at.getTime()).toBe(workingBefore?.updated_at.getTime());
			const after = await store.getEntry(published.id);
			expect(after.version).toBe(published.version);
			expect(after.updatedAt.getTime()).toBe(published.updatedAt.getTime());
			expect(after.working.contentHash).toBe(published.working.contentHash);
			expect(after.published?.contentHash).toBe(published.published?.contentHash);
		});

		it("keeps what the list shows as unpublished changes", async () => {
			const same = await publishedWith(UNTIDY);
			const edited = await publishedWith(UNTIDY);
			await pool.query(`UPDATE "${schemaName}".entry_bodies SET mdx = $1 WHERE entry_id = $2 AND state = 'working'`, [
				`${UNTIDY}\nMore words\n`,
				edited.id,
			]);
			const flag = async (id: string) =>
				(await store.listEntries({ collection: contentCollection })).items.find((item) => item.id === id)
					?.hasUnpublishedChanges;
			const before = { same: await flag(same.id), edited: await flag(edited.id) };

			await rewriteContent(pool, { schema: schemaName, apply: true });

			expect({ same: await flag(same.id), edited: await flag(edited.id) }).toEqual(before);
		});

		it("refreshes the search text, and a second run changes nothing", async () => {
			const draft = await createDraft(UNTIDY);
			await rewriteContent(pool, { schema: schemaName, apply: true });
			const once = await stored(draft.id, "working");
			expect(once?.search_text).toContain("emphasis");

			const again = await rewriteContent(pool, { schema: schemaName, apply: true });

			expect(again.changed).toBe(0);
			expect(await stored(draft.id, "working")).toEqual(once);
		});

		it("rewrites body templates and leaves their version and date alone", async () => {
			const template = await store.createTemplate({ name: unique("untidy"), mdx: UNTIDY });

			await rewriteContent(pool, { schema: schemaName, apply: true });

			const after = await store.getTemplate(template.id);
			expect(after.mdx).toBe(TIDY);
			expect(after.version).toBe(template.version);
			expect(after.updatedAt.getTime()).toBe(template.updatedAt.getTime());
		});

		it("skips a body that does not parse, reports it, and still rewrites the others", async () => {
			const broken = await createDraft("Words\n\n<Unclosed");
			const untidy = await createDraft(UNTIDY);

			const report = await rewriteContent(pool, { schema: schemaName, apply: true });

			expect(lineOf(report, broken, "working")).toMatchObject({ outcome: "skipped", reason: "unparsed" });
			expect((await stored(broken.id, "working"))?.mdx).toBe("Words\n\n<Unclosed");
			expect((await stored(untidy.id, "working"))?.mdx).toBe(TIDY);
			expect(formatRewriteReport(report).some((line) => line.endsWith("working: skipped (does not parse)"))).toBe(true);
		});

		it("never writes a body whose content hash would change", async () => {
			const draft = await createDraft(UNTIDY);
			const before = await stored(draft.id, "working");

			// A serializer that changes the content: whatever the cause, the guard stops the write.
			const report = await rewriteContent(pool, {
				schema: schemaName,
				apply: true,
				write: (mdx) => `${mdx}\nAn added sentence.\n`,
			});

			expect(lineOf(report, draft, "working")).toMatchObject({ outcome: "skipped", reason: "hash" });
			expect(await stored(draft.id, "working")).toEqual(before);
			expect(report.changed).toBe(0);
			expect(formatRewriteReport(report).some((line) => line.includes("the content hash would change"))).toBe(true);
		});

		it("reaches every row whatever the batch size", async () => {
			for (let index = 0; index < 5; index += 1) await createDraft(`Title ${index}\n=====\n`);
			await rewriteContent(pool, { schema: schemaName, apply: true, batchSize: 2 });
			const left = await pool.query<{ mdx: string }>(
				`SELECT mdx FROM "${schemaName}".entry_bodies WHERE mdx ~ '^Title [0-9]\n====='`,
			);
			expect(left.rows).toEqual([]);
		});
	});
});
