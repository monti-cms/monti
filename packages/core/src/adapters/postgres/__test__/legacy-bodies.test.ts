import { randomBytes } from "node:crypto";
import type { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { testSite } from "../../../../test/site";
import { contentOf, docOf } from "../../../../test/stored-content";
import { seedEntry } from "../../../core/store/__test__/seed";
import { createFormatRegistry, NO_FORMATS } from "../../../format/registry";
import { createContentStore, migrateContentStore } from "../content-store";
import { MDX_REQUIRED_MESSAGE } from "../store/mdx-body";
import { CONTENT_STORE_MIGRATIONS } from "../store/schema";
import { fakeMdxRegistry } from "./fake-mdx-format";
import { closeGlobalPool, createIsolatedTestPool, dropIsolatedTestPool } from "./test-database";

/** The steps that read the text of old bodies, and the ones after them: the part of the history an old store has not run. */
const TEXT_STEPS_FROM = "0012_soft_line_endings";
const LAST_TEXT_STEP = "0015_code_annotations";

/**
 * Core does not parse MDX. The old store steps (`0010` to `0015`) read the text of old bodies through the `mdx` format that `@monti-cms/mdx` supplies,
 * and ask for it only when a step has a body to read. These tests use a test double for that format, so core's own steps and SQL are tested without the parser;
 * the steps with the real parser are tested in the MDX package.
 */
describe("migrating without the MDX package (legacy bodies)", () => {
	let pool: Pool;
	let rootSchema: string;
	const extraSchemas: string[] = [];

	beforeAll(async () => {
		const isolated = await createIsolatedTestPool();
		pool = isolated.pool;
		rootSchema = isolated.schemaName;
	});

	afterAll(async () => {
		for (const schema of extraSchemas) await pool.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
		if (pool && rootSchema) await dropIsolatedTestPool(pool, rootSchema);
		await closeGlobalPool();
	});

	const newSchema = () => {
		const schema = `cms_test_legacy_${randomBytes(3).toString("hex")}`;
		extraSchemas.push(schema);
		return schema;
	};

	const recorded = async (schema: string) =>
		(await pool.query<{ name: string }>(`SELECT name FROM "${schema}".cms_migrations ORDER BY name`)).rows.map(
			(row) => row.name,
		);

	/** Takes away the records of the steps from `name` on, as in a store that has not run them yet. */
	const forgetStepsFrom = async (schema: string, name: string) => {
		const forgotten = CONTENT_STORE_MIGRATIONS.slice(CONTENT_STORE_MIGRATIONS.indexOf(name));
		await pool.query(`DELETE FROM "${schema}".cms_migrations WHERE name = ANY($1::text[])`, [forgotten]);
		return forgotten;
	};

	/** An up-to-date store with one body (and the text the store of that time kept next to it), or none. */
	const storeWith = async (options: { body: boolean }) => {
		const schema = newSchema();
		await migrateContentStore(pool, { site: testSite, schema, formats: NO_FORMATS });
		if (options.body) {
			const store = createContentStore(pool, { site: testSite, schema });
			const entry = await seedEntry(store, { collection: "x", slug: "old", metadata: { title: "Old" }, text: "Hello" });
			await pool.query(`UPDATE "${schema}".entry_bodies SET mdx = 'Hello' WHERE entry_id = $1`, [entry.id]);
			return { schema, store, entry };
		}
		await pool.query(`DELETE FROM "${schema}".entry_bodies`);
		await pool.query(`DELETE FROM "${schema}".body_templates`);
		return { schema, store: createContentStore(pool, { site: testSite, schema }), entry: undefined };
	};

	it("migrates a fresh store with no format registered, and never asks for the package", async () => {
		const { formats, bodies } = fakeMdxRegistry();
		const schema = newSchema();

		await migrateContentStore(pool, { site: testSite, schema, formats: createFormatRegistry([]) });
		expect(await recorded(schema)).toEqual([...CONTENT_STORE_MIGRATIONS].sort());

		// The same with a format that has the reader: a fresh store has no body to read, so the reader is never used.
		const withFormat = newSchema();
		await migrateContentStore(pool, { site: testSite, schema: withFormat, formats });
		expect(await recorded(withFormat)).toEqual([...CONTENT_STORE_MIGRATIONS].sort());
		expect(bodies.calls.count).toBe(0);
	});

	it("migrates a store that already recorded the steps through the code annotations, rows included, without the MDX format", async () => {
		const { schema, store, entry } = await storeWith({ body: true });
		if (!entry) throw new Error("expected an entry");
		const lastTextStep = CONTENT_STORE_MIGRATIONS.indexOf(LAST_TEXT_STEP);
		const after = CONTENT_STORE_MIGRATIONS[lastTextStep + 1];
		if (!after) throw new Error("expected a step after the text steps");
		// The steps after the text steps have not run yet; the ones before them have (the store has rows that hold text).
		const forgotten = await forgetStepsFrom(schema, after);
		expect(await recorded(schema)).not.toContain(after);

		await migrateContentStore(pool, { site: testSite, schema, formats: NO_FORMATS });

		for (const name of forgotten) expect(await recorded(schema)).toContain(name);
		expect(contentOf((await store.getEntry(entry.id)).working.doc)).toEqual(contentOf(docOf("Hello")));
	});

	it("an old store that still has to read a body without the MDX format fails with a message that names the package, and records nothing", async () => {
		const { schema, entry } = await storeWith({ body: true });
		if (!entry) throw new Error("expected an entry");
		const forgotten = await forgetStepsFrom(schema, TEXT_STEPS_FROM);
		const before = await recorded(schema);
		expect(forgotten.length).toBeGreaterThan(1);

		const failure = await migrateContentStore(pool, { site: testSite, schema, formats: NO_FORMATS }).then(
			() => undefined,
			(error: unknown) => error,
		);

		expect(failure).toBeInstanceOf(Error);
		expect((failure as Error).message).toBe(MDX_REQUIRED_MESSAGE);
		expect((failure as Error).message).toContain("@monti-cms/mdx");
		// One transaction: nothing was recorded, so a later run (with the package) starts from the same place.
		expect(await recorded(schema)).toEqual(before);
		for (const name of forgotten) expect(await recorded(schema)).not.toContain(name);
		// A format registered under another name does not stand in for it.
		await expect(
			migrateContentStore(pool, { site: testSite, schema, formats: createFormatRegistry([fakeFormatNamed("other")]) }),
		).rejects.toThrow(/@monti-cms\/mdx/);
	});

	it("the same store migrates with an mdx format that has the old-body reader, which reads the text it holds", async () => {
		const { schema, store, entry } = await storeWith({ body: true });
		if (!entry) throw new Error("expected an entry");
		await pool.query(`UPDATE "${schema}".entry_bodies SET mdx = 'Changed words', doc = NULL WHERE entry_id = $1`, [
			entry.id,
		]);
		const forgotten = await forgetStepsFrom(schema, TEXT_STEPS_FROM);
		const { formats, bodies } = fakeMdxRegistry();

		await migrateContentStore(pool, { site: testSite, schema, formats });

		expect(bodies.calls.count).toBeGreaterThan(0);
		for (const name of forgotten) expect(await recorded(schema)).toContain(name);
		// The step that gives bodies their documents used the reader: the body is the document of its text.
		expect(contentOf((await store.getEntry(entry.id)).working.doc)).toEqual(contentOf(docOf("Changed words")));
	});

	it("an old store with no rows needs no format at all", async () => {
		const { schema } = await storeWith({ body: false });
		const forgotten = await forgetStepsFrom(schema, TEXT_STEPS_FROM);
		expect(forgotten).toContain(TEXT_STEPS_FROM);

		await migrateContentStore(pool, { site: testSite, schema, formats: NO_FORMATS });

		for (const name of forgotten) expect(await recorded(schema)).toContain(name);
	});
});

/** A format of another name that has the reader: only the `mdx` format counts. */
function fakeFormatNamed(name: string) {
	const { formats } = fakeMdxRegistry();
	const mdx = formats.get("mdx");
	if (!mdx) throw new Error("expected the fake format");
	return { ...mdx, name };
}
