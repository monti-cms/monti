import { computeContentHash } from "@monti-cms/core/runtime";
import {
	closeGlobalPool,
	createContentStore,
	createIsolatedTestPool,
	dropIsolatedTestPool,
	formatRewriteReport,
	migrateContentStore,
	rewriteContent,
	seedEntry,
} from "@monti-cms/core/testing";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

/**
 * Runs with the directive extension switched on in the site config (`vitest.configured.config.ts`): `monti content:rewrite` writes the site's own notation,
 * so standard JSX becomes directives, line breaks stay `<br />`, and the content hash does not change.
 */
const STANDARD = [
	'<TextAlign align="center">',
	"",
	"가운데 <u>밑줄</u>",
	"",
	"</TextAlign>",
	"",
	"앞<br />\n뒤",
	"",
	'<Image mediaId="abc" alt="설명" />',
	"",
].join("\n");

const DIRECTIVES = [
	':::text-align{align="center"}',
	"가운데 :u[밑줄]",
	":::",
	"",
	"앞<br />\n뒤",
	"",
	'::image{mediaId="abc" alt="설명"}',
	"",
].join("\n");

describe("content rewrite with directive syntax in the site config", () => {
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

	it("writes directives (and <br />) for a standard body without changing its hash, and leaves directive bodies as they are", async () => {
		const store = createContentStore(pool, { schema: schemaName });
		const metadata = { title: "T" };
		const hash = computeContentHash(metadata, STANDARD, 1);
		const standard = await seedEntry(store, {
			collection: "x",
			slug: "standard",
			metadata,
			mdx: STANDARD,
			contentHash: hash,
		});
		const written = await seedEntry(store, {
			collection: "x",
			slug: "written",
			metadata,
			mdx: DIRECTIVES,
			contentHash: hash,
		});

		const dryRun = await rewriteContent(pool, { schema: schemaName });
		expect(dryRun.applied).toBe(false);
		expect((await store.getEntry(standard.id)).working.mdx).toBe(STANDARD);
		const lines = formatRewriteReport(dryRun);
		expect(lines).toContainEqual(expect.stringMatching(/^x\/standard \(.+\) working: changed$/));
		expect(lines).toContainEqual(expect.stringMatching(/^x\/written \(.+\) working: unchanged$/));

		await rewriteContent(pool, { schema: schemaName, apply: true });

		const after = await store.getEntry(standard.id);
		expect(after.working.mdx).toBe(DIRECTIVES);
		expect(after.working.contentHash).toBe(hash);
		expect(computeContentHash(metadata, after.working.mdx, 1)).toBe(hash);
		expect(after.version).toBe(standard.version);
		expect(after.updatedAt.getTime()).toBe(standard.updatedAt.getTime());
		expect((await store.getEntry(written.id)).working.mdx).toBe(DIRECTIVES);
		expect((await rewriteContent(pool, { schema: schemaName, apply: true })).changed).toBe(0);
	});
});
