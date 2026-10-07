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
	migrateSoftBreaks,
	publishDraft,
} from "@monti-cms/core/testing";
import type { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { contentCollection, requiredMetadata } from "../../../../core/test/any-site";
import { testSite } from "../../../../core/test/site";
import { docOf } from "../../../../core/test/stored-content";
import { createServerMdxFormat, legacyBodies } from "../../server";

/** The `mdx` format as a server registers it: it also reads the text of old bodies, which the steps under test need. */
const formats = createFormatRegistry([createServerMdxFormat()]);
const bodies = legacyBodies(testSite);

/** The `mdx` column of a body template, `null` when it has no text. */
const templateMdx = async (pool: Pool, schemaName: string, id: string): Promise<string | null> =>
	(await pool.query<{ mdx: string | null }>(`SELECT mdx FROM "${schemaName}".body_templates WHERE id = $1`, [id]))
		.rows[0]?.mdx ?? null;

/**
 * Migration steps that follow a change of how a body is read: stored hashes are recomputed (and, where the step says so, bodies and search text are rewritten),
 * so "unpublished changes" keeps meaning what it meant. Each test puts the store back in the state before the step ran and runs the migration again.
 */
describe("document shape migrations", () => {
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
				: await publishDraft(testSite, store, { id: draft.id, expectedVersion: draft.version });
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
		return publishDraft(testSite, store, { id: draft.id, expectedVersion: draft.version });
	};

	const setWorkingBody = (entryId: string, mdx: string) =>
		pool.query(`UPDATE "${schemaName}".entry_bodies SET mdx = $1 WHERE entry_id = $2 AND state = 'working'`, [
			mdx,
			entryId,
		]);

	/** Writes want a body as it is stored now (written from its document), so a store from before is imitated by writing the legacy text to both bodies directly. */
	const setLegacyBodies = (entryId: string, mdx: string) =>
		pool.query(`UPDATE "${schemaName}".entry_bodies SET mdx = $1 WHERE entry_id = $2`, [mdx, entryId]);

	const hasUnpublishedChanges = async (entryId: string) => {
		const { items } = await store.listEntries({ collection: contentCollection });
		const item = items.find((candidate) => candidate.id === entryId);
		if (!item) throw new Error(`entry ${entryId} is not in the list`);
		return item.hasUnpublishedChanges;
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
			.filter((row) => row.content_hash !== mdxContentHash(bodies, row.metadata, row.mdx, row.schema_version))
			.map((row) => `${row.entry_id}/${row.state}`);
	};

	/**
	 * A store from before documents: a save no longer writes the text of a body, so every body that has none gets the text the format writes for its document.
	 * Bodies that were given a text on purpose keep it.
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

	/** Stores a hash a previous version would have computed (anything that is not the current one) and marks the step as not applied yet. */
	const rewindTo = async (step: string) => {
		await giveLegacyText();
		await pool.query(`UPDATE "${schemaName}".entry_bodies SET content_hash = 'stale-' || state || '-' || entry_id`);
		await pool.query(`DELETE FROM "${schemaName}".cms_migrations WHERE name = $1`, [step]);
	};

	describe("0011_line_break_hashes", () => {
		const STEP = "0011_line_break_hashes";

		it("is a recorded migration step", () => {
			expect(CONTENT_STORE_MIGRATIONS).toContain(STEP);
		});

		it("recomputes the hash of every body and keeps what the list shows as unpublished changes", async () => {
			const same = await publishedWith("첫 줄<br />\n둘째 줄");
			// A break written another way is the same content now (it was a different one while `<br />` and `\` were two nodes).
			const spelledOtherwise = await publishedWith("첫 줄<br />\n둘째 줄");
			await setWorkingBody(spelledOtherwise.id, "첫 줄\\\n둘째 줄");
			const edited = await publishedWith("첫 줄<br />\n둘째 줄");
			await setWorkingBody(edited.id, "첫 줄<br />\n다른 줄");

			await rewindTo(STEP);
			await migrateContentStore(pool, { site: testSite, schema: schemaName, formats });

			expect(await staleHashes()).toEqual([]);
			expect(await hasUnpublishedChanges(same.id)).toBe(false);
			expect(await hasUnpublishedChanges(spelledOtherwise.id)).toBe(false);
			expect(await hasUnpublishedChanges(edited.id)).toBe(true);
		});

		it("does not touch bodies, versions or modified dates", async () => {
			const published = await publishedWith("첫 줄<br />\n둘째 줄");
			await rewindTo(STEP);

			await migrateContentStore(pool, { site: testSite, schema: schemaName, formats });

			const after = await store.getEntry(published.id);
			expect(after.version).toBe(published.version);
			expect(after.updatedAt.getTime()).toBe(published.updatedAt.getTime());
			expect(after.working.updatedAt?.getTime()).toBe(published.working.updatedAt?.getTime());
			expect(after.working.doc).toEqual(published.working.doc);
			expect(after.published).toEqual(published.published);
		});
	});

	describe("0012_soft_line_endings", () => {
		const STEP = "0012_soft_line_endings";
		const SOFT = "첫 줄\n둘째 줄\n\n다음 문단\n끝";
		const EXPLICIT = "첫 줄<br />\n둘째 줄\n\n다음 문단<br />\n끝";

		const row = async (entryId: string, state: "working" | "published") =>
			(
				await pool.query<{
					mdx: string;
					content_hash: string;
					search_text: string;
					translation: { version: number; baseSource: string } | null;
				}>(
					`SELECT mdx, content_hash, search_text, translation FROM "${schemaName}".entry_bodies WHERE entry_id = $1 AND state = $2`,
					[entryId, state],
				)
			).rows[0];

		const run = async () => {
			await rewindTo(STEP);
			await migrateContentStore(pool, { site: testSite, schema: schemaName, formats });
		};

		it("is a recorded migration step that runs after the hash step and before the template seed", () => {
			expect(CONTENT_STORE_MIGRATIONS).toContain(STEP);
			expect(CONTENT_STORE_MIGRATIONS.indexOf(STEP)).toBeGreaterThan(
				CONTENT_STORE_MIGRATIONS.indexOf("0011_line_break_hashes"),
			);
			expect(CONTENT_STORE_MIGRATIONS.indexOf(STEP)).toBeLessThan(
				CONTENT_STORE_MIGRATIONS.indexOf("seed_initial_body_templates"),
			);
		});

		it("makes the soft line endings of working and published bodies explicit and keeps what the list shows", async () => {
			const unchanged = await publishedWith(SOFT);
			const edited = await publishedWith(SOFT);
			await setLegacyBodies(unchanged.id, SOFT);
			await setLegacyBodies(edited.id, SOFT);
			await setWorkingBody(edited.id, "첫 줄\n다른 문단");

			await run();

			expect((await row(unchanged.id, "working"))?.mdx).toBe(EXPLICIT);
			expect((await row(unchanged.id, "published"))?.mdx).toBe(EXPLICIT);
			expect((await row(edited.id, "working"))?.mdx).toBe("첫 줄<br />\n다른 문단");
			expect(await staleHashes()).toEqual([]);
			expect(await hasUnpublishedChanges(unchanged.id)).toBe(false);
			expect(await hasUnpublishedChanges(edited.id)).toBe(true);
		});

		it("does not bump the version or the modified dates, and a second run changes nothing", async () => {
			const published = await publishedWith(SOFT);
			await setLegacyBodies(published.id, SOFT);
			await run();

			const after = await store.getEntry(published.id);
			expect(after.version).toBe(published.version);
			expect(after.updatedAt.getTime()).toBe(published.updatedAt.getTime());
			expect(after.working.updatedAt?.getTime()).toBe(published.working.updatedAt?.getTime());

			const before = await row(published.id, "working");
			await run();
			expect(await row(published.id, "working")).toEqual(before);
		});

		it("recomputes the search text of every body", async () => {
			const published = await publishedWith(SOFT);
			await setLegacyBodies(published.id, SOFT);
			await pool.query(`UPDATE "${schemaName}".entry_bodies SET search_text = 'stale' WHERE entry_id = $1`, [
				published.id,
			]);

			await run();

			const stored = await row(published.id, "working");
			expect(stored?.search_text).not.toBe("stale");
			expect(stored?.search_text).toContain("다음 문단");
		});

		it("rewrites the source a translation was confirmed against, so the translation screen sees no change", async () => {
			const published = await publishedWith("본문");
			await pool.query(
				`UPDATE "${schemaName}".entry_bodies SET translation = $1::jsonb WHERE entry_id = $2 AND state = 'working'`,
				[JSON.stringify({ version: 2, baseSource: SOFT }), published.id],
			);
			await setWorkingBody(published.id, SOFT);

			await run();

			const stored = await row(published.id, "working");
			expect(stored?.translation).toEqual({ version: 2, baseSource: EXPLICIT });
			expect(stored?.mdx).toBe(stored?.translation?.baseSource);
		});

		it("rewrites body templates and leaves their version alone", async () => {
			const template = await store.createTemplate({ name: unique("soft"), doc: docOf(SOFT) });
			await pool.query(`UPDATE "${schemaName}".body_templates SET mdx = $1 WHERE id = $2`, [SOFT, template.id]);

			await run();

			const after = await store.getTemplate(template.id);
			expect(await templateMdx(pool, schemaName, template.id)).toBe(EXPLICIT);
			expect(after.version).toBe(template.version);
			expect(after.updatedAt.getTime()).toBe(template.updatedAt.getTime());
		});

		it("leaves a body that does not parse untouched and logs it", async () => {
			const broken = await createDraft("가\n<Unclosed");
			await setWorkingBody(broken.id, "가\n<Unclosed");
			const good = await createDraft(SOFT);
			await setLegacyBodies(good.id, SOFT);
			await giveLegacyText();
			const messages: string[] = [];
			const client = await pool.connect();
			try {
				await migrateSoftBreaks(client, schemaName, {
					site: testSite,
					bodies,
					log: (message) => messages.push(message),
				});
			} finally {
				client.release();
			}

			expect((await row(broken.id, "working"))?.mdx).toBe("가\n<Unclosed");
			expect((await row(good.id, "working"))?.mdx).toBe(EXPLICIT);
			expect(messages.some((message) => message.includes(broken.id) && message.includes("unparsed"))).toBe(true);
			// A body that does not parse still has a valid hash (of its raw string).
			expect(await staleHashes()).toEqual([]);
		});

		it("reaches every row whatever the batch size", async () => {
			for (let index = 0; index < 5; index += 1) {
				const draft = await createDraft(`줄 ${index}\n다음 줄`);
				await setLegacyBodies(draft.id, `줄 ${index}\n다음 줄`);
			}
			await giveLegacyText();
			const client = await pool.connect();
			try {
				await migrateSoftBreaks(client, schemaName, { site: testSite, bodies, batchSize: 2 });
			} finally {
				client.release();
			}
			const left = await pool.query<{ mdx: string }>(
				`SELECT mdx FROM "${schemaName}".entry_bodies WHERE mdx ~ '줄 [0-9]\n다음'`,
			);
			expect(left.rows).toEqual([]);
		});
	});
});
