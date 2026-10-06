import {
	closeGlobalPool,
	createContentStore,
	createIsolatedTestPool,
	dropIsolatedTestPool,
	migrateContentStore,
	seedEntry,
} from "@monti-cms/core/testing";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

/**
 * Runs with the directive extension switched on in the site config (`vitest.configured.config.ts`): the store migration that writes `<br />` at each soft line
 * ending reads and edits bodies with the site's own syntax, and leaves the directive text of a post exactly as it was.
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

describe("soft line endings migration with directive syntax in the site config", () => {
	let pool: Awaited<ReturnType<typeof createIsolatedTestPool>>["pool"];
	let schemaName: string;

	beforeAll(async () => {
		const isolated = await createIsolatedTestPool();
		pool = isolated.pool;
		schemaName = isolated.schemaName;
		await migrateContentStore(pool, { schema: schemaName });
	});

	afterAll(async () => {
		if (pool && schemaName) await dropIsolatedTestPool(pool, schemaName);
		await closeGlobalPool();
	});

	it("inserts <br /> at the line endings and keeps every other byte of the directive text", async () => {
		const store = createContentStore(pool, { schema: schemaName });
		const entry = await seedEntry(store, {
			collection: "x",
			slug: "directive-post",
			metadata: { title: "T" },
			mdx: BODY,
		});
		// A store writes the MDX column from the document; this body is one a store held before that, as the text it was given.
		await pool.query(`UPDATE "${schemaName}".entry_bodies SET mdx = $1 WHERE entry_id = $2`, [BODY, entry.id]);
		await pool.query(`DELETE FROM "${schemaName}".cms_migrations WHERE name = $1`, [STEP]);

		await migrateContentStore(pool, { schema: schemaName });

		const after = await store.getEntry(entry.id);
		expect(after.working.mdx.replaceAll("<br />", "")).toBe(BODY);
		expect(after.working.mdx).toContain(':::text-align{align="center"}\n가운데<br />\n두 줄\n:::');
		expect(after.working.mdx).toContain('::image{mediaId="abc" alt="설명"}');
		expect(after.working.mdx).toContain(":u[밑줄]");
		// The directive fences are read as syntax (not as paragraph text with line endings), so nothing is inserted into or after them.
		expect(after.working.mdx).not.toMatch(/(?:align="center"}|:::|alt="설명"})<br \/>/);
		expect(after.version).toBe(entry.version);
		expect(after.updatedAt.getTime()).toBe(entry.updatedAt.getTime());
	});
});
