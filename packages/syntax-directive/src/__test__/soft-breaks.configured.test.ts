import { createFormatRegistry } from "@monti-cms/core/format";
import {
	closeGlobalPool,
	createContentStore,
	createIsolatedTestPool,
	dropIsolatedTestPool,
	migrateContentStore,
	seedEntry,
} from "@monti-cms/core/testing";
import { configuredSyntax } from "@monti-cms/mdx/format";
import { createServerMdxFormat } from "@monti-cms/mdx/server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { testSite } from "../../test/site";

/**
 * Runs with the directive extension switched on in the site config (`vitest.configured.config.ts`): the store migration that writes `<br />` at each soft line
 * ending reads and edits bodies with the site's own syntax (the `mdx` format of the instance carries it, built from the plugin options), and leaves the directive text of a post exactly as it was.
 */
const STEP = "0012_soft_line_endings";

const BODY = [
	"# 제목",
	"",
	"첫 줄\n둘째 줄 :u[밑줄] 와 :sup[2]",
	"",
	':::text-align{align="center"}',
	"가운데\n두 줄",
	":::",
	"",
	'::image{mediaId="abc" alt="설명"}',
	"",
	"- 하나\n  이어서",
	"",
].join("\n");

const formats = createFormatRegistry([createServerMdxFormat({ syntax: configuredSyntax(testSite) })]);

describe("soft line endings migration with directive syntax in the site config", () => {
	let pool: Awaited<ReturnType<typeof createIsolatedTestPool>>["pool"];
	let schemaName: string;

	beforeAll(async () => {
		const isolated = await createIsolatedTestPool();
		pool = isolated.pool;
		schemaName = isolated.schemaName;
		await migrateContentStore(pool, { site: testSite, schema: schemaName, formats });
	});

	afterAll(async () => {
		if (pool && schemaName) await dropIsolatedTestPool(pool, schemaName);
		await closeGlobalPool();
	});

	it("inserts <br /> at the line endings and keeps every other byte of the directive text", async () => {
		const store = createContentStore(pool, { site: testSite, schema: schemaName });
		const entry = await seedEntry(store, {
			collection: "x",
			slug: "directive-post",
			metadata: { title: "T" },
			text: "x",
		});
		// A store does not write the MDX column any more; this body is one a store held before that, as the text it was given.
		await pool.query(`UPDATE "${schemaName}".entry_bodies SET mdx = $1 WHERE entry_id = $2`, [BODY, entry.id]);
		await pool.query(`DELETE FROM "${schemaName}".cms_migrations WHERE name = $1`, [STEP]);

		await migrateContentStore(pool, { site: testSite, schema: schemaName, formats });

		const after = await store.getEntry(entry.id);
		const { rows } = await pool.query<{ mdx: string }>(
			`SELECT mdx FROM "${schemaName}".entry_bodies WHERE entry_id = $1 AND state = 'working'`,
			[entry.id],
		);
		const mdx = rows[0]?.mdx ?? "";
		expect(mdx.replaceAll("<br />", "")).toBe(BODY);
		expect(mdx).toContain(':::text-align{align="center"}\n가운데<br />\n두 줄\n:::');
		expect(mdx).toContain('::image{mediaId="abc" alt="설명"}');
		expect(mdx).toContain(":u[밑줄]");
		// The directive fences are read as syntax (not as paragraph text with line endings), so nothing is inserted into or after them.
		expect(mdx).not.toMatch(/(?:align="center"}|:::|alt="설명"})<br \/>/);
		expect(after.version).toBe(entry.version);
		expect(after.updatedAt.getTime()).toBe(entry.updatedAt.getTime());
	});
});
