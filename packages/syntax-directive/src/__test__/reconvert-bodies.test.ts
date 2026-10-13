import { createFormatRegistry } from "@monti-cms/core/format";
import {
	closeGlobalPool,
	createContentStore,
	createIsolatedTestPool,
	dropIsolatedTestPool,
	migrateContentStore,
	seedEntry,
} from "@monti-cms/core/testing";
import { createServerMdxFormat } from "@monti-cms/mdx/server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { testSite } from "../../test/site";
import { directiveSyntax } from "../index";

/**
 * `monti db:migrate --reconvert-bodies`: a body a migration kept as `unparsed` source because the site could not read its `:::` blocks then is read again once the
 * directive syntax is in the config. Nothing else about the row changes.
 */

const SOURCE = ["첫 줄\n둘째 줄", "", ':::text-align{align="center"}', "가운데", ":::", ""].join("\n");

const plain = createFormatRegistry([createServerMdxFormat()]);
const withDirectives = createFormatRegistry([createServerMdxFormat({ syntax: [directiveSyntax()] })]);

describe("migrate --reconvert-bodies", () => {
	let pool: Awaited<ReturnType<typeof createIsolatedTestPool>>["pool"];
	let schemaName: string;
	let entryId: string;

	const row = async () =>
		(
			await pool.query<{
				doc: { content: { type: string }[] };
				content_hash: string;
				search_text: string;
				schema_version: number;
				updated_at: Date;
			}>(
				`SELECT doc, content_hash, search_text, schema_version, updated_at FROM "${schemaName}".entry_bodies WHERE entry_id = $1 AND state = 'working'`,
				[entryId],
			)
		).rows[0];

	beforeAll(async () => {
		const isolated = await createIsolatedTestPool();
		pool = isolated.pool;
		schemaName = isolated.schemaName;
		await migrateContentStore(pool, { site: testSite, schema: schemaName, formats: plain });
		const store = createContentStore(pool, { site: testSite, schema: schemaName });
		const entry = await seedEntry(store, {
			collection: "x",
			slug: "kept-as-source",
			metadata: { title: "T" },
			text: "x",
		});
		entryId = entry.id;
		// What a migration leaves for a body it could not read: one `unparsed` node holding the text.
		const unparsed = {
			type: "doc",
			version: 3,
			content: [{ id: "abcd1234", type: "unparsed", attrs: { format: "mdx", source: SOURCE } }],
		};
		await pool.query(
			`UPDATE "${schemaName}".entry_bodies SET doc = $1::jsonb, content_hash = 'stale', search_text = 'stale' WHERE entry_id = $2`,
			[JSON.stringify(unparsed), entryId],
		);
	});

	afterAll(async () => {
		if (pool && schemaName) await dropIsolatedTestPool(pool, schemaName);
		await closeGlobalPool();
	});

	it("does nothing unless asked", async () => {
		await migrateContentStore(pool, { site: testSite, schema: schemaName, formats: withDirectives });
		expect((await row())?.doc.content[0]?.type).toBe("unparsed");
	});

	it("keeps a body the config still cannot read, and reports it with its ::: blocks", async () => {
		const found: { where: string; hasDirective: boolean; kind: string }[] = [];
		const summary = await migrateContentStore(pool, {
			site: testSite,
			schema: schemaName,
			formats: plain,
			reconvertBodies: true,
			onUnreadableBody: (body) => found.push(body),
		});
		expect(summary.reconverted).toEqual({ converted: 0, remaining: 1 });
		expect(found).toEqual([
			expect.objectContaining({ where: `entry_bodies ${entryId}/working`, kind: "draft", hasDirective: true }),
		]);
		expect((await row())?.doc.content[0]?.type).toBe("unparsed");
	});

	it("reads it once the directive syntax is on, touching only the document, hash and search text; again changes nothing", async () => {
		const before = await row();
		const summary = await migrateContentStore(pool, {
			site: testSite,
			schema: schemaName,
			formats: withDirectives,
			reconvertBodies: true,
		});
		expect(summary.reconverted).toEqual({ converted: 1, remaining: 0 });
		const after = await row();
		expect(after?.doc.content.map((node) => node.type)).not.toContain("unparsed");
		expect(JSON.stringify(after?.doc)).toContain("hardBreak");
		expect(after?.content_hash).not.toBe("stale");
		expect(after?.search_text).toContain("가운데");
		expect(after?.schema_version).toBe(before?.schema_version);
		expect(after?.updated_at).toEqual(before?.updated_at);

		const again = await migrateContentStore(pool, {
			site: testSite,
			schema: schemaName,
			formats: withDirectives,
			reconvertBodies: true,
		});
		expect(again.reconverted).toEqual({ converted: 0, remaining: 0 });
		expect(await row()).toEqual(after);
	});

	it("the steps that keep a body as source report it (once, with the reason) instead of logging a line for it", async () => {
		const isolated = await createIsolatedTestPool();
		try {
			const store = (name: string) => createContentStore(isolated.pool, { site: testSite, schema: name });
			await migrateContentStore(isolated.pool, { site: testSite, schema: isolated.schemaName, formats: plain });
			const entry = await seedEntry(store(isolated.schemaName), {
				collection: "x",
				slug: "legacy",
				metadata: { title: "T" },
				text: "x",
			});
			// A body from before documents that the site cannot read: ::: blocks without the syntax.
			await isolated.pool.query(
				`UPDATE "${isolated.schemaName}".entry_bodies SET mdx = $1, doc = NULL WHERE entry_id = $2`,
				[SOURCE, entry.id],
			);
			await isolated.pool.query(
				`DELETE FROM "${isolated.schemaName}".cms_migrations WHERE name IN ('0012_soft_line_endings', '0013_stored_documents', '0017_unparsed_bodies')`,
			);
			const found: { where: string; reason?: string; hasDirective: boolean }[] = [];
			const detail: string[] = [];
			await migrateContentStore(isolated.pool, {
				site: testSite,
				schema: isolated.schemaName,
				formats: plain,
				onUnreadableBody: (body) => found.push(body),
				detail: (line) => detail.push(line),
			});
			const mine = found.filter((body) => body.where === `entry_bodies ${entry.id}/working`);
			expect(mine.length).toBeGreaterThan(0);
			expect(mine.every((body) => body.hasDirective)).toBe(true);
			expect(detail.join("\n")).not.toContain(entry.id);
			const doc = await isolated.pool.query<{ doc: { content: { type: string }[] } }>(
				`SELECT doc FROM "${isolated.schemaName}".entry_bodies WHERE entry_id = $1 AND state = 'working'`,
				[entry.id],
			);
			expect(doc.rows[0]?.doc.content[0]?.type).toBe("unparsed");
		} finally {
			await dropIsolatedTestPool(isolated.pool, isolated.schemaName);
		}
	});
});
