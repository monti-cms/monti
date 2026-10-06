import type { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { contentCollection, requiredMetadata } from "../../../../test/any-site";
import { docOf } from "../../../../test/stored-content";
import type { Collection } from "../../../core/collections";
import { computeContentHash } from "../../../core/content-hash";
import { contentPath } from "../../../core/links";
import type { Entry } from "../../../core/store";
import { publishDraft } from "../../../core/store/__test__/seed";
import { entryLinkIds } from "../../../doc/entry-links";
import { readStoredDocument, STORED_DOCUMENT_VERSION } from "../../../doc/stored-document";
import { createContentService } from "../../../services/content-service";
import { createWritePipeline } from "../../../services/write-pipeline";
import { createContentStore, migrateContentStore } from "../content-store";
import { migrateLinkEntryIds } from "../store/link-id-migration";
import { CONTENT_STORE_MIGRATIONS } from "../store/schema";
import { templateMdx } from "./template-rows";
import { closeGlobalPool, createIsolatedTestPool, dropIsolatedTestPool } from "./test-database";

const STEP = "0018_link_entry_ids";

/**
 * `0018_link_entry_ids`: the internal links of every stored document move from the address they were written with to the id of their entry (document
 * version 3), hashes and body references follow, and nothing fails because of a link that resolves to nothing. Each test writes bodies with links by address
 * (a service with no link resolver keeps them) and puts them back at document version 2, as a store from before holds them.
 */
describe("0018_link_entry_ids", () => {
	let pool: Pool;
	let schemaName: string;
	let store: ReturnType<typeof createContentStore>;
	/** A service that does not turn links by address into links by id, so a body keeps the links it was written with. */
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
		service = createContentService<Entry>(store, { pipeline: createWritePipeline() });
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
			doc: docOf("Body"),
		});
		const published =
			draft.status === "published"
				? draft
				: await publishDraft(store, { id: draft.id, expectedVersion: draft.version });
		targets.set(to, published.id);
		return published.id;
	};

	const create = async (slug: string, mdx: string) =>
		service.createDraft({
			collection: contentCollection,
			slug,
			metadata: await requiredMetadata(contentCollection, unique("Post"), relationTarget),
			doc: docOf(mdx),
		});

	const hrefTo = (slug: string) => {
		const path = contentPath(contentCollection, slug);
		if (!path) throw new Error("the content collection has no path");
		return path;
	};

	/** The body as a store from before holds it: document version 2, a hash of that document. */
	const asVersion2 = async (entryId: string) => {
		await pool.query(
			`UPDATE "${schemaName}".entry_bodies SET doc = jsonb_set(doc, '{version}', '2'), content_hash = 'stale-' || state WHERE entry_id = $1`,
			[entryId],
		);
		await pool.query(`DELETE FROM "${schemaName}".entry_references WHERE entry_id = $1 AND kind = 'entry'`, [entryId]);
	};

	const row = async (entryId: string, state: "working" | "published") =>
		(
			await pool.query<{
				mdx: string | null;
				doc: unknown;
				content_hash: string;
				schema_version: number;
				metadata: Record<string, unknown>;
				updated_at: Date;
			}>(
				`SELECT mdx, doc, content_hash, schema_version, metadata, updated_at FROM "${schemaName}".entry_bodies WHERE entry_id = $1 AND state = $2`,
				[entryId, state],
			)
		).rows[0];

	const references = async (entryId: string, state: "working" | "published") =>
		(
			await pool.query<{ target_id: string; target_entry_id: string; is_stale: boolean; occurrences: unknown[] }>(
				`SELECT target_id, target_entry_id, is_stale, occurrences FROM "${schemaName}".entry_references
				 WHERE entry_id = $1 AND state = $2 AND kind = 'entry' ORDER BY target_id`,
				[entryId, state],
			)
		).rows;

	const migrate = async () => {
		const logged: string[] = [];
		const client = await pool.connect();
		try {
			await client.query("BEGIN");
			const report = await migrateLinkEntryIds(client, schemaName, { log: (message) => logged.push(message) });
			await client.query("COMMIT");
			return { report, logged };
		} catch (error) {
			await client.query("ROLLBACK");
			throw error;
		} finally {
			client.release();
		}
	};

	it("is a step after the unparsed bodies step, before the seed", () => {
		const names = CONTENT_STORE_MIGRATIONS;
		expect(names.indexOf(STEP)).toBeGreaterThan(names.indexOf("0017_unparsed_bodies"));
		expect(names.indexOf(STEP)).toBeLessThan(names.indexOf("seed_initial_body_templates"));
	});

	it("turns the internal links of working and published bodies into links by id, and keeps version and modified date", async () => {
		const target = await create(unique("target"), "Target");
		const publishedTarget = await publishDraft(store, { id: target.id, expectedVersion: target.version });
		const targetSlug = publishedTarget.workingSlug as string;
		const source = await create(
			unique("source"),
			`See [the target](${hrefTo(targetSlug)}) and [outside](https://example.com/a).`,
		);
		const publishedSource = await publishDraft(store, { id: source.id, expectedVersion: source.version });
		await asVersion2(source.id);
		const before = await row(source.id, "working");

		await pool.query(`DELETE FROM "${schemaName}".cms_migrations WHERE name = $1`, [STEP]);
		await migrateContentStore(pool, { schema: schemaName });

		for (const state of ["working", "published"] as const) {
			const after = await row(source.id, state);
			const doc = readStoredDocument(after?.doc);
			expect(doc?.version).toBe(STORED_DOCUMENT_VERSION);
			// An internal link holds only the id of the entry; an outside link is untouched.
			expect(entryLinkIds(doc?.content)).toEqual([target.id]);
			const marks = JSON.stringify(after?.doc);
			expect(marks).toContain('"entryId"');
			expect(marks).not.toContain(hrefTo(targetSlug));
			expect(marks).toContain("https://example.com/a");
			// The hash is the one a save of this document makes, and no text is written next to it.
			expect(after?.content_hash).toBe(
				computeContentHash(after?.metadata as never, doc as never, after?.schema_version),
			);
			expect(after?.mdx).toBeNull();
			expect(await references(source.id, state)).toMatchObject([
				{ target_id: target.id, target_entry_id: target.id, is_stale: false, occurrences: [{ type: "body" }] },
			]);
		}
		// Working and published are the same body, so they hash the same: no unpublished changes appear.
		expect((await row(source.id, "working"))?.content_hash).toBe((await row(source.id, "published"))?.content_hash);
		expect((await row(source.id, "working"))?.updated_at.getTime()).toBe(before?.updated_at.getTime());
		expect((await store.getEntry(source.id)).version).toBe(publishedSource.version);
	});

	it("finds the entry by a former address, and leaves an address nobody holds as it is, with a log", async () => {
		const target = await create(unique("target"), "Target");
		const publishedTarget = await publishDraft(store, { id: target.id, expectedVersion: target.version });
		const oldSlug = publishedTarget.workingSlug as string;
		// A rename: publishing the new slug turns the old one into an alias.
		const renamedSlug = unique("renamed");
		const renamed = await service.saveDraft(target.id, {
			collection: contentCollection,
			slug: renamedSlug,
			metadata: (await store.getEntry(target.id)).working.metadata as never,
			doc: docOf("Target"),
			expectedVersion: publishedTarget.version,
		});
		await publishDraft(store, { id: target.id, expectedVersion: renamed.version });
		const missing = unique("nobody-holds-this");
		const source = await create(unique("source"), `[old](${hrefTo(oldSlug)}) [gone](${hrefTo(missing)})`);
		await asVersion2(source.id);

		const { report, logged } = await migrate();

		expect(report.converted).toBeGreaterThanOrEqual(1);
		expect(report.unresolved).toBeGreaterThanOrEqual(1);
		const doc = readStoredDocument((await row(source.id, "working"))?.doc);
		expect(entryLinkIds(doc?.content)).toEqual([target.id]);
		expect(JSON.stringify(doc)).toContain(hrefTo(missing));
		expect(logged.some((message) => message.includes(source.id))).toBe(true);
	});

	it("rewrites the links of a template", async () => {
		const target = await create(unique("target"), "Target");
		const publishedTarget = await publishDraft(store, { id: target.id, expectedVersion: target.version });
		const href = hrefTo(publishedTarget.workingSlug as string);
		const template = await store.createTemplate({ name: unique("template"), doc: docOf(`[x](${href})`) });

		await migrate();

		const stored = await store.getTemplate(template.id);
		expect(entryLinkIds(stored.doc.content)).toEqual([target.id]);
		expect(await templateMdx(pool, schemaName, template.id)).toBeNull();
	});

	it("keeps the body references of relation fields and rebuilds the ones of links", async () => {
		const target = await create(unique("target"), "Target");
		const publishedTarget = await publishDraft(store, { id: target.id, expectedVersion: target.version });
		const source = await create(unique("source"), `[x](${hrefTo(publishedTarget.workingSlug as string)})`);
		await asVersion2(source.id);
		// A stale leftover from an older save: a body occurrence of a link that is no longer in the body.
		await pool.query(
			`INSERT INTO "${schemaName}".entry_references (entry_id, state, kind, target_id, target_entry_id, is_stale, occurrences)
			 VALUES ($1, 'working', 'entry', $2, $2, true, '[{"type":"mdx","line":1,"column":1}]')`,
			[source.id, source.id],
		);

		await migrate();

		const refs = await references(source.id, "working");
		expect(refs.map((ref) => ref.target_id)).toEqual([target.id]);
	});

	it("changes nothing when it runs again", async () => {
		const target = await create(unique("target"), "Target");
		const publishedTarget = await publishDraft(store, { id: target.id, expectedVersion: target.version });
		const source = await create(unique("source"), `[x](${hrefTo(publishedTarget.workingSlug as string)})`);
		await asVersion2(source.id);
		await migrate();
		const before = [await row(source.id, "working"), await references(source.id, "working")];

		const { report } = await migrate();

		expect(report.converted).toBe(0);
		expect([await row(source.id, "working"), await references(source.id, "working")]).toEqual(before);
	});
});
