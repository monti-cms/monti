import { randomBytes } from "node:crypto";
import { Kysely, PostgresDialect, sql } from "kysely";
import { Pool } from "pg";
import { afterAll, describe, expect, inject, it } from "vitest";
import type { Block } from "../body/doc";
import { fingerprint } from "../bytes";
import { canonical } from "../json";
import { blockHash } from "../translations/links";
import { migrateToLatest, migrateUntil } from "./migrations";
import type { Database } from "./schema";

const URL = process.env.CMS_TEST_DATABASE_URL;

describe("migrating while another site changes its tables", () => {
	it("00-6 a site's migration does not fail when another schema in the same database drops a table meanwhile", async () => {
		if (!URL) throw new Error("Set CMS_TEST_DATABASE_URL (postgres://localhost/monti_test) to run the core tests.");
		const admin = new Pool({ connectionString: URL, max: 4 });
		afterAll(() => admin.end());
		const other = `${inject("testRun")}${randomBytes(6).toString("hex")}`;
		await admin.query(`create schema ${other}`);
		// Another site in the same database keeps making and dropping a table, as a schema apply does.
		let churning = true;
		const churn = (async () => {
			while (churning) {
				await admin.query(`create table if not exists ${other}.monti_post (id text)`);
				await admin.query(`drop table if exists ${other}.monti_post`);
			}
		})();
		try {
			for (let round = 0; round < 6; round++) {
				const schema = `${inject("testRun")}${randomBytes(6).toString("hex")}`;
				await admin.query(`create schema ${schema}`);
				const db = new Kysely<Database>({
					dialect: new PostgresDialect({
						pool: new Pool({ connectionString: URL, options: `-c search_path=${schema}` }),
					}),
				});
				try {
					await expect(migrateToLatest(db)).resolves.toBeUndefined();
				} finally {
					await db.destroy();
				}
			}
		} finally {
			churning = false;
			await churn;
		}
	}, 60_000);
});

describe("0013: block hashes without empty parts", () => {
	it("04-2 T120 the hashes kept before move to the new measure: published, kept source blocks, and what a translation has seen", async () => {
		if (!URL) throw new Error("Set CMS_TEST_DATABASE_URL (postgres://localhost/monti_test) to run the core tests.");
		const schema = `${inject("testRun")}${randomBytes(6).toString("hex")}`;
		const admin = new Pool({ connectionString: URL, max: 1 });
		await admin.query(`create schema ${schema}`);
		await admin.end();
		const db = new Kysely<Database>({
			dialect: new PostgresDialect({ pool: new Pool({ connectionString: URL, options: `-c search_path=${schema}` }) }),
		});
		try {
			await migrateUntil(db, "0012_translation_seen");
			// As 0012 measured: empty parts and all, without the id and the link.
			const oldHash = ({ id: _id, link: _link, ...rest }: Block) => fingerprint(JSON.stringify(canonical(rest)));
			const now: Block = {
				id: "s1",
				type: "paragraph",
				attrs: {},
				content: [{ type: "text", text: "하나", marks: [] }],
			};
			const earlier: Block = { id: "s1", type: "paragraph", attrs: {}, content: [{ type: "text", text: "하나였다" }] };
			const gone = "a hash no block is left for";
			await sql`insert into entries (id, collection, translation_group, locale, slug, doc) values
				('ko', 'post', 'g', 'ko', 'one', ${JSON.stringify({ type: "doc", blocks: [now] })}::jsonb),
				('en', 'post', 'g', 'en', 'one', ${JSON.stringify({
					type: "doc",
					blocks: [
						{
							id: "t1",
							type: "paragraph",
							content: [{ type: "text", text: "One" }],
							link: { from: "s1", seen: oldHash(now), state: "translated" },
						},
						{
							id: "t2",
							type: "paragraph",
							content: [{ type: "text", text: "Was one" }],
							link: { from: "s1", seen: oldHash(earlier), state: "translated" },
						},
						{
							id: "t3",
							type: "paragraph",
							content: [{ type: "text", text: "Old" }],
							link: { from: "s9", seen: gone, state: "translated" },
						},
					],
				})}::jsonb)`.execute(db);
			await sql`insert into entry_published (entry_id, collection, locale, title, slug, values, doc, published_at, from_version, block_hashes)
				values ('ko', 'post', 'ko', '하나', 'one', '{}'::jsonb, ${JSON.stringify({ type: "doc", blocks: [now] })}::jsonb, now(), 1,
				${JSON.stringify({ s1: oldHash(now) })}::jsonb)`.execute(db);
			await sql`insert into source_blocks (hash, block) values (${oldHash(earlier)}, ${JSON.stringify(earlier)}::jsonb)`.execute(
				db,
			);
			// A source never published: its translation kept the draft's block as it left it ("keep the source"), and nothing else holds that block.
			const drafted: Block = { id: "d1", type: "paragraph", attrs: {}, content: [{ type: "text", text: "초안" }] };
			const follows = (seen: string) => ({
				type: "doc",
				blocks: [
					{
						id: "u1",
						type: "paragraph",
						content: [{ type: "text", text: "초안" }],
						link: { from: "d1", seen, state: "keepSource" },
					},
				],
			});
			await sql`insert into entries (id, collection, translation_group, locale, slug, doc) values
				('draft-ko', 'post', 'h', 'ko', 'draft', ${JSON.stringify({ type: "doc", blocks: [drafted] })}::jsonb),
				('draft-en', 'post', 'h', 'en', 'draft', ${JSON.stringify(follows(oldHash(drafted)))}::jsonb),
				('empty', 'post', 'k', 'ko', 'empty', null)`.execute(db);
			await sql`insert into entry_published (entry_id, collection, locale, title, slug, values, doc, published_at, from_version)
				values ('empty', 'post', 'ko', '빈 글', 'empty', '{}'::jsonb, null, now(), 1)`.execute(db);
			// An undo of the translation's last save puts this back; one past its undo never comes back, and stays as it was.
			await sql`insert into monti_activity (id, actor, operation, summary, targets, undo_until) values
				('a1', '{}'::jsonb, 'entries.save', '{}'::jsonb, '[]'::jsonb, now() + interval '1 day'),
				('a0', '{}'::jsonb, 'entries.save', '{}'::jsonb, '[]'::jsonb, now() - interval '1 day')`.execute(db);
			const seeing = (seen: string) => ({
				row: {
					id: "en",
					doc: {
						type: "doc",
						blocks: [{ id: "t1", type: "paragraph", content: [], link: { from: "s1", seen, state: "translated" } }],
					},
				},
				published: { entry_id: "en", doc: null, block_hashes: {} },
				oldPaths: [],
				links: [],
			});
			await sql`insert into monti_activity_snapshot (activity_id, kind, record_id, before, after_version)
				values ('a0', 'entry', 'old-en', ${JSON.stringify(seeing(oldHash(now)))}::jsonb, 1)`.execute(db);
			await sql`insert into monti_activity_snapshot (activity_id, kind, record_id, before, after_version) values ('a1', 'entry', 'en', ${JSON.stringify(seeing(oldHash(now)))}::jsonb, 2), ('a1', 'entry', 'ko', ${JSON.stringify(
				{
					row: { id: "ko", doc: { type: "doc", blocks: [now] } },
					published: { entry_id: "ko", doc: { type: "doc", blocks: [now] }, block_hashes: { s1: oldHash(now) } },
					oldPaths: [],
					links: [],
				},
			)}::jsonb, 2)`.execute(db);

			// More translations than a page holds, so the step goes through pages.
			await sql`insert into entries (id, collection, translation_group, locale, slug, doc)
				select 'bulk' || n, 'post', 'bulk' || n, 'en', 'bulk' || n, ${JSON.stringify(follows(oldHash(now)))}::jsonb
				from generate_series(1, 450) n`.execute(db);

			await migrateToLatest(db);
			const bulk = await sql<{ moved: number }>`select count(*)::int as moved from entries
				where id like 'bulk%' and doc->'blocks'->0->'link'->>'seen' = ${blockHash(now)}`.execute(db);
			expect(bulk.rows[0]?.moved).toBe(450);
			const published = await sql<{
				block_hashes: Record<string, string>;
			}>`select block_hashes from entry_published where entry_id = 'ko'`.execute(db);
			expect(published.rows[0]?.block_hashes).toEqual({ s1: blockHash(now) });
			const kept = await sql<{ hash: string }>`select hash from source_blocks`.execute(db);
			expect(kept.rows.map((row) => row.hash)).toEqual([blockHash(earlier)]);
			const translation = await sql<{ doc: { blocks: Block[] } }>`select doc from entries where id = 'en'`.execute(db);
			expect(translation.rows[0]?.doc.blocks.map((block) => block.link?.seen)).toEqual([
				blockHash(now),
				blockHash(earlier),
				gone,
			]);
			const draft = await sql<{ doc: { blocks: Block[] } }>`select doc from entries where id = 'draft-en'`.execute(db);
			expect(draft.rows[0]?.doc.blocks[0]?.link?.seen).toBe(blockHash(drafted));
			// No body stays no body: SQL null, not JSON null, or the next unchanged save would read as a change.
			const empty = await sql<{ working: boolean; published: boolean }>`
				select (select doc is null from entries where id = 'empty') as working,
					(select doc is null from entry_published where entry_id = 'empty') as published`.execute(db);
			expect(empty.rows[0]).toEqual({ working: true, published: true });
			const undo = await sql<{
				record_id: string;
				before: { row: { doc: { blocks: Block[] } }; published: { block_hashes: Record<string, string> } };
			}>`
				select record_id, before from monti_activity_snapshot order by record_id`.execute(db);
			expect(
				undo.rows.map((row) => [
					row.record_id,
					row.before.row.doc.blocks[0]?.link?.seen,
					row.before.published.block_hashes,
				]),
			).toEqual([
				["en", blockHash(now), {}],
				["ko", undefined, { s1: blockHash(now) }],
				["old-en", oldHash(now), {}],
			]);
			expect(blockHash(now)).not.toBe(oldHash(now));
		} finally {
			await db.destroy();
		}
	});
});
