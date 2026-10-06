import type { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { contentCollection, requiredMetadata } from "../../../../test/any-site";
import { contentOf } from "../../../../test/stored-content";
import type { Collection } from "../../../core/collections";
import type { Entry } from "../../../core/store";
import { formatRewriteReport } from "../../../core/store";
import { publishDraft } from "../../../core/store/__test__/seed";
import { forEachBlock, isBlockId } from "../../../mdx/block-ids";
import { bodyFromMdx, readStoredDocument } from "../../../mdx/stored-document";
import { createContentService } from "../../../services/content-service";
import { createContentStore } from "../content-store";
import { mdxContentHash } from "../store/mdx-body";
import { rewriteContent } from "../store/rewrite";
import { migrateForEarlierSteps } from "./template-rows";
import { closeGlobalPool, createIsolatedTestPool, dropIsolatedTestPool } from "./test-database";

/**
 * `monti content:rewrite`: re-derives stored bodies from their documents with the site's syntax (a body with no document gets one when its MDX parses).
 * The content hash is unchanged by design, so the rewrite is a change of spelling only: no version bump, no new modified date, and a body whose hash
 * would change is never written.
 *
 * Saving already writes a body from its document, so a body in another spelling is imitated here by writing the text to the row directly.
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
		await migrateForEarlierSteps(pool, schemaName);
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
		const draft = await service.createDraft({
			collection: to,
			slug: unique(to),
			metadata,
			format: "mdx",
			body: "Body",
		});
		const published =
			draft.status === "published"
				? draft
				: await publishDraft(store, { id: draft.id, expectedVersion: draft.version });
		targets.set(to, published.id);
		return published.id;
	};

	const createDraft = async (mdx: string) =>
		service.createDraft({
			collection: contentCollection,
			slug: unique("post"),
			metadata: await requiredMetadata(contentCollection, unique("Post"), relationTarget),
			format: "mdx",
			body: mdx,
		});

	const publishedWith = async (mdx: string) => {
		const draft = await createDraft(mdx);
		return publishDraft(store, { id: draft.id, expectedVersion: draft.version });
	};

	/** Puts the text in the rows as given, with the document the test names (none by default: a body from before documents were stored). */
	const setRaw = (entryId: string, mdx: string, doc: unknown = null, state?: "working" | "published") =>
		pool.query(
			`UPDATE "${schemaName}".entry_bodies SET mdx = $1, doc = $2::jsonb WHERE entry_id = $3 AND ($4::text IS NULL OR state = $4)`,
			[mdx, doc === null ? null : JSON.stringify(doc), entryId, state ?? null],
		);

	/** A published entry whose bodies are in another spelling than the one a save writes, and have no document. */
	const untidyPublished = async (mdx: string) => {
		const published = await publishedWith(mdx);
		await setRaw(published.id, mdx);
		return published;
	};

	const stored = async (entryId: string, state: "working" | "published") =>
		(
			await pool.query<{ mdx: string; doc: unknown; content_hash: string; search_text: string; updated_at: Date }>(
				`SELECT mdx, doc, content_hash, search_text, updated_at FROM "${schemaName}".entry_bodies WHERE entry_id = $1 AND state = $2`,
				[entryId, state],
			)
		).rows[0];

	const lineOf = (report: { items: readonly { label: string; outcome: string }[] }, entry: Entry, state: string) =>
		report.items.find((item) => item.label.includes(`${entry.workingSlug ?? entry.id}`) && item.label.endsWith(state));

	describe("a dry run (the default)", () => {
		it("reports each body as changed or unchanged and writes nothing", async () => {
			const untidy = await untidyPublished(UNTIDY);
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
			const untidy = await untidyPublished(UNTIDY);
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
			const published = await untidyPublished(UNTIDY);
			const workingBefore = await stored(published.id, "working");
			const publishedBefore = await stored(published.id, "published");
			expect(workingBefore?.mdx).toBe(UNTIDY);
			expect(workingBefore?.doc).toBeNull();

			const report = await rewriteContent(pool, { schema: schemaName, apply: true });

			expect(report.applied).toBe(true);
			const working = await stored(published.id, "working");
			const publishedAfter = await stored(published.id, "published");
			expect(working?.mdx).toBe(TIDY);
			expect(publishedAfter?.mdx).toBe(TIDY);
			// The document is written with the text, and it is the one the TIDY text reads as.
			expect(contentOf(working?.doc)).toEqual(contentOf(bodyFromMdx(TIDY).doc));
			expect(contentOf(publishedAfter?.doc)).toEqual(contentOf(bodyFromMdx(TIDY).doc));
			// The hash covers the parsed body, so it is the same for both spellings: asserted, not assumed.
			expect(working?.content_hash).toBe(workingBefore?.content_hash);
			expect(publishedAfter?.content_hash).toBe(publishedBefore?.content_hash);
			expect(mdxContentHash(published.working.metadata, TIDY, published.working.schemaVersion)).toBe(
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
			const same = await untidyPublished(UNTIDY);
			const edited = await untidyPublished(UNTIDY);
			await setRaw(edited.id, `${UNTIDY}\nMore words\n`, null, "working");
			const flag = async (id: string) =>
				(await store.listEntries({ collection: contentCollection })).items.find((item) => item.id === id)
					?.hasUnpublishedChanges;
			const before = { same: await flag(same.id), edited: await flag(edited.id) };

			await rewriteContent(pool, { schema: schemaName, apply: true });

			expect({ same: await flag(same.id), edited: await flag(edited.id) }).toEqual(before);
		});

		it("refreshes the search text, and a second run changes nothing", async () => {
			const draft = await createDraft(UNTIDY);
			await setRaw(draft.id, UNTIDY);
			await rewriteContent(pool, { schema: schemaName, apply: true });
			const once = await stored(draft.id, "working");
			expect(once?.search_text).toContain("emphasis");

			const again = await rewriteContent(pool, { schema: schemaName, apply: true });

			expect(again.changed).toBe(0);
			expect(await stored(draft.id, "working")).toEqual(once);
		});

		it("skips a body that does not parse, reports it, and still rewrites the others", async () => {
			const broken = await createDraft("Words\n\n<Unclosed");
			const untidy = await createDraft(UNTIDY);
			await setRaw(untidy.id, UNTIDY);

			const report = await rewriteContent(pool, { schema: schemaName, apply: true });

			expect(lineOf(report, broken, "working")).toMatchObject({ outcome: "skipped", reason: "unparsed" });
			expect((await stored(broken.id, "working"))?.mdx).toBe("Words\n\n<Unclosed");
			expect((await stored(broken.id, "working"))?.doc).toMatchObject({ content: [{ type: "unparsed" }] });
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
			for (let index = 0; index < 5; index += 1) {
				const draft = await createDraft(`Title ${index}\n=====\n`);
				await setRaw(draft.id, `Title ${index}\n=====\n`);
			}
			await rewriteContent(pool, { schema: schemaName, apply: true, batchSize: 2 });
			const left = await pool.query<{ mdx: string }>(
				`SELECT mdx FROM "${schemaName}".entry_bodies WHERE mdx ~ '^Title [0-9]\n====='`,
			);
			expect(left.rows).toEqual([]);
		});
	});

	describe("from the document", () => {
		it("writes the MDX of a body that has a document from that document, and leaves the document as it is", async () => {
			const published = await publishedWith(TIDY);
			const before = await stored(published.id, "working");
			// The stored text is spelled another way; the document is what the body is.
			await setRaw(published.id, UNTIDY, before?.doc);

			const report = await rewriteContent(pool, { schema: schemaName, apply: true });

			expect(lineOf(report, published, "working")?.outcome).toBe("changed");
			const after = await stored(published.id, "working");
			expect(after?.mdx).toBe(TIDY);
			expect(after?.doc).toEqual(before?.doc);
			expect(after?.content_hash).toBe(before?.content_hash);
			expect(after?.search_text).toBe(before?.search_text);
		});

		it("keeps every block id of the document, in the working and the published body", async () => {
			const published = await publishedWith(TIDY);
			const ids = async (state: "working" | "published") => {
				const doc = readStoredDocument((await stored(published.id, state))?.doc);
				const found: (string | undefined)[] = [];
				forEachBlock(doc?.content ?? [], (node) => found.push(node.id));
				return found;
			};
			const workingBefore = await ids("working");
			const publishedBefore = await ids("published");
			expect(workingBefore).toHaveLength(7);
			expect(workingBefore.every(isBlockId)).toBe(true);
			await setRaw(published.id, UNTIDY, (await stored(published.id, "working"))?.doc);

			const report = await rewriteContent(pool, { schema: schemaName, apply: true });

			expect(lineOf(report, published, "working")?.outcome).toBe("changed");
			expect(await ids("working")).toEqual(workingBefore);
			expect(await ids("published")).toEqual(publishedBefore);
		});

		it("does not write a body whose text says something else than its document", async () => {
			const published = await publishedWith(TIDY);
			const before = await stored(published.id, "working");
			// The text was edited behind the document's back: re-deriving it from the document would lose the edit.
			await setRaw(published.id, `${TIDY}\nAn edit.\n`, before?.doc, "working");

			const report = await rewriteContent(pool, { schema: schemaName, apply: true });

			expect(lineOf(report, published, "working")).toMatchObject({ outcome: "skipped", reason: "hash" });
			expect((await stored(published.id, "working"))?.mdx).toBe(`${TIDY}\nAn edit.\n`);
		});

		it("treats a stored document it cannot read as no document and writes one from the MDX", async () => {
			const draft = await createDraft(TIDY);
			await setRaw(draft.id, UNTIDY, { type: "doc", version: 99, content: [] });

			await rewriteContent(pool, { schema: schemaName, apply: true });

			const after = await stored(draft.id, "working");
			expect(after?.mdx).toBe(TIDY);
			expect(contentOf(after?.doc)).toEqual(contentOf(bodyFromMdx(TIDY).doc));
		});

		it("fills in the document of a body that has none even when its text is already written the site's way", async () => {
			const draft = await createDraft(TIDY);
			await setRaw(draft.id, TIDY);

			const report = await rewriteContent(pool, { schema: schemaName, apply: true });

			expect(lineOf(report, draft, "working")?.outcome).toBe("changed");
			expect(contentOf((await stored(draft.id, "working"))?.doc)).toEqual(contentOf(bodyFromMdx(TIDY).doc));
			expect((await rewriteContent(pool, { schema: schemaName, apply: true })).changed).toBe(0);
		});
	});
});
