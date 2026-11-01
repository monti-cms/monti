import type { Pool } from "pg";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { docOf } from "../../../../../test/stored-content";
import { type CmsConfig, defineSite } from "../../../../config/define";
import { computeContentHash } from "../../../../core/content-hash";
import { type CmsNode, STORED_DOCUMENT_VERSION, type StoredDocument } from "../../../../document";
import { defineCollection } from "../../../../schema/collection";
import {
	applySchemaChange,
	checkSchemaChange,
	planSchemaChange,
	SchemaChangeError,
	snapshotSchema,
} from "../../../../schema-change";
import type { SchemaMigration } from "../../../../schema-file/types";
import { createContentService } from "../../../../services/content-service";
import { createSite, type Site } from "../../../../site";
import { closeGlobalPool, createIsolatedTestPool, dropIsolatedTestPool } from "../../__test__/test-database";
import { createContentStore, migrateContentStore } from "../../content-store";
import { readBodyDoc } from "../rows";

/**
 * Schema changes against a real database: the impact check, the transforms, `cms_migrations` records, hashes, references and versions.
 * The data is written under the schema "before" through the real write path, the change is applied under the schema "after".
 */

const title = { kind: "text", label: "Title", required: true } as const;
const slug = { kind: "slug", label: "Address", from: "title" } as const;

const beforeConfig = defineSite({
	collections: {
		category: defineCollection({ label: "Category", kind: "item", fields: { title, slug } }),
		post: defineCollection({
			label: "Post",
			kind: "document",
			path: "/posts/:slug",
			fields: {
				title,
				slug,
				summary: { kind: "text", label: "Summary" },
				status: {
					kind: "select",
					label: "Status",
					options: { draft: "Draft", live: "Live", old: "Old" },
					defaultValue: "draft",
				},
				legacy: { kind: "text", label: "Legacy" },
				legacy2: { kind: "text", label: "Legacy 2" },
				categoryId: { kind: "relation", label: "Category", to: "category" },
			},
		}),
	},
	locales: [{ code: "en", name: "English" }],
	defaultLocale: "en",
});

/** The schema after the change: `summary` is `excerpt`, `old` is gone, `legacy` is gone (dropped), `legacy2` is gone (kept as an orphan), `author` is required, `categoryId` is `topicId`. */
const afterConfig = () =>
	defineSite({
		collections: {
			category: defineCollection({ label: "Category", kind: "item", fields: { title, slug } }),
			post: defineCollection({
				label: "Post",
				kind: "document",
				path: "/posts/:slug",
				fields: {
					title,
					slug,
					excerpt: { kind: "text", label: "Excerpt" },
					status: {
						kind: "select",
						label: "Status",
						options: { draft: "Draft", live: "Live" },
						defaultValue: "draft",
					},
					author: { kind: "text", label: "Author", required: true },
					topicId: { kind: "relation", label: "Topic", to: "category" },
				},
			}),
		},
		locales: [{ code: "en", name: "English" }],
		defaultLocale: "en",
	});

const migrations: SchemaMigration[] = [
	{ id: "rename-summary", op: "renameField", collection: "post", from: "summary", to: "excerpt" },
	{ id: "rename-category", op: "renameField", collection: "post", from: "categoryId", to: "topicId" },
	{ id: "map-old", op: "mapOption", collection: "post", field: "status", from: "old", to: "live" },
	{ id: "drop-legacy", op: "dropField", collection: "post", field: "legacy" },
	{ id: "author-default", op: "setDefault", collection: "post", field: "author", value: "Staff" },
];

interface BodyRow {
	entry_id: string;
	state: "working" | "published";
	metadata: Record<string, unknown>;
	doc: unknown;
	content_hash: string;
	updated_at: Date;
}

describe("schema changes", () => {
	let pool: Pool;
	let schemaName: string;
	const siteBefore = createSite(beforeConfig as CmsConfig);
	const siteAfter = createSite(afterConfig() as CmsConfig);

	const storeFor = (site: Site) => createContentStore(pool, { site, schema: schemaName });
	const serviceFor = (site: Site) => createContentService(storeFor(site), { site });

	/** The entries every test works on, written under the schema before into a schema of the test's own. */
	const ids = {} as Record<"category" | "a" | "b" | "c" | "d", string>;

	beforeEach(async () => {
		const isolated = await createIsolatedTestPool();
		pool = isolated.pool;
		schemaName = isolated.schemaName;
		await migrateContentStore(pool, { site: siteBefore, schema: schemaName });
		const service = serviceFor(siteBefore);

		const category = (
			await service.createDraft({
				collection: "category",
				slug: "news",
				metadata: { title: "News" },
				doc: docOf(""),
			})
		).entry;
		ids.category = category.id;
		const create = async (slugText: string, metadata: Record<string, string | string[]>) => {
			const draft = (
				await service.createDraft({
					collection: "post",
					slug: slugText,
					metadata,
					doc: docOf(`Body of ${slugText}`),
				} as never)
			).entry;
			return (await service.publish({ id: draft.id, expectedVersion: draft.version })).entry;
		};
		// A: published, with every old field, working copy equal to the published copy.
		ids.a = (
			await create("a", { title: "A", summary: "Summary A", status: "old", legacy: "gone", categoryId: category.id })
		).id;
		// B: published, then edited: it has unpublished changes.
		const b = await create("b", { title: "B", summary: "Summary B", status: "live" });
		ids.b = (
			await service.saveDraft(b.id, {
				collection: "post",
				slug: "b",
				metadata: { title: "B", summary: "Summary B, edited", status: "live" },
				doc: docOf("Body of b"),
				expectedVersion: b.version,
			} as never)
		).entry.id;
		// C: a draft that was never published.
		ids.c = (
			await service.createDraft({
				collection: "post",
				slug: "c",
				metadata: { title: "C", status: "old", legacy2: "kept" },
				doc: docOf("Body of c"),
			} as never)
		).entry.id;
		// D: has nothing the change touches.
		ids.d = (
			await service.createDraft({
				collection: "post",
				slug: "d",
				metadata: { title: "D" },
				doc: docOf("Body of d"),
			} as never)
		).entry.id;
	});

	afterEach(async () => {
		if (pool && schemaName) await dropIsolatedTestPool(pool, schemaName);
	});

	afterAll(async () => {
		await closeGlobalPool();
	});

	const rows = async (): Promise<Map<string, BodyRow>> =>
		new Map(
			(
				await pool.query<BodyRow>(
					`SELECT entry_id, state, metadata, doc, content_hash, updated_at FROM "${schemaName}".entry_bodies`,
				)
			).rows.map((row) => [`${row.entry_id}/${row.state}`, row]),
		);
	const entryRows = async () =>
		(await pool.query(`SELECT id, version, updated_at, status FROM "${schemaName}".entries ORDER BY id`)).rows;
	const recorded = async () =>
		(
			await pool.query<{ name: string }>(
				`SELECT name FROM "${schemaName}".cms_migrations WHERE name LIKE 'schema:%' ORDER BY name`,
			)
		).rows.map((row) => row.name);
	const state = async () =>
		(await pool.query(`SELECT schema FROM "${schemaName}".schema_state`)).rows[0] as { schema: unknown } | undefined;
	const references = async (entryId: string) =>
		(
			await pool.query<{ state: string; kind: string; target_id: string; occurrences: unknown }>(
				`SELECT state, kind, target_id, occurrences FROM "${schemaName}".entry_references WHERE entry_id = $1 ORDER BY state`,
				[entryId],
			)
		).rows;

	const baseline = () => applySchemaChange({ site: siteBefore, store: storeFor(siteBefore), migrations: [] });
	/** The baseline, then the change applied with its transforms. */
	const baselineThenApply = async () => {
		await baseline();
		await applySchemaChange({ site: siteAfter, store: storeFor(siteAfter), migrations });
	};

	describe("the baseline", () => {
		it("SCHEMA-C1 records the schema without touching any entry (an extracted schema file applied with no transforms is a no-op)", async () => {
			const store = storeFor(siteBefore);
			const plan = await planSchemaChange({ site: siteBefore, store, migrations: [] });
			expect(plan.applied).toBeNull();
			expect(plan.diff.changes).toEqual([]);
			expect(plan.changed).toBe(false);

			const rowsBefore = await rows();
			const entriesBefore = await entryRows();
			const done = await baseline();
			expect(done.result).toMatchObject({ applied: [], bodies: 0, entries: 0 });
			expect(await rows()).toEqual(rowsBefore);
			expect(await entryRows()).toEqual(entriesBefore);
			expect((await state())?.schema).toEqual(snapshotSchema(siteBefore));

			// Applying it again changes nothing either, and the plan now has an old side that equals the new one.
			const again = await planSchemaChange({ site: siteBefore, store, migrations: [] });
			expect(again.applied?.schema).toEqual(snapshotSchema(siteBefore));
			expect(again.diff.changes).toEqual([]);
			await baseline();
			expect(await rows()).toEqual(rowsBefore);
		});
	});

	describe("the plan and the impact check", () => {
		it("SCHEMA-C1 lists what changed, with the transforms that handle each change", async () => {
			await baseline();
			const store = storeFor(siteAfter);
			const plan = await planSchemaChange({ site: siteAfter, store, migrations });
			expect(plan.problems).toEqual([]);
			expect(plan.pending.map((item) => item.id)).toEqual(migrations.map((item) => item.id));
			const handled = Object.fromEntries(
				plan.diff.changes.map((change) => [
					`${change.kind}:${"field" in change ? change.field : ""}`,
					change.handledBy,
				]),
			);
			expect(plan.diff.changes.map((change) => change.kind).sort()).toEqual(
				[
					"field_added", // author
					"field_removed", // legacy (dropped)
					"field_removed", // legacy2 (no transform)
					"field_renamed", // summary
					"field_renamed", // categoryId
					"option_removed", // status.old
				].sort(),
			);
			expect(handled["field_added:author"]).toBe("author-default");
			expect(handled["field_removed:legacy"]).toBe("drop-legacy");
			expect(handled["field_removed:legacy2"]).toBeUndefined();
		});

		it("SCHEMA-F4 counts the entries each change touches, with a sample, and reads without writing", async () => {
			await baseline();
			const store = storeFor(siteAfter);
			const plan = await planSchemaChange({ site: siteAfter, store, migrations });
			const rowsBefore = await rows();
			const impact = await checkSchemaChange(store, plan.diff, { site: siteAfter, transforms: plan.pending });
			expect(await rows()).toEqual(rowsBefore);

			const of = (kind: string, field?: string) =>
				impact.impacts.find(
					(item) =>
						item.change.kind === kind &&
						(field === undefined ||
							("field" in item.change && item.change.field === field) ||
							("from" in item.change && item.change.from === field)),
				);
			const summary = of("field_renamed", "summary");
			expect(summary?.entries).toBe(2); // A and B hold a summary (an entry counts once for its working and published copies)
			expect(summary?.sample.map((entry) => entry.title).sort()).toEqual(["A", "B"]);
			expect(summary?.consequence).toBe("transformed");
			expect(of("field_removed", "legacy")).toMatchObject({ entries: 1, consequence: "deleted" });
			expect(of("field_removed", "legacy2")).toMatchObject({ entries: 1, consequence: "orphaned" });
			expect(of("option_removed")).toMatchObject({ entries: 2, consequence: "transformed" }); // A (published) and C (draft)
			// `author` is required now: the four posts have no value (the transform fills it).
			expect(of("field_added", "author")).toMatchObject({ entries: 4, consequence: "transformed" });
			expect(of("field_renamed", "categoryId")?.entries).toBe(1);
			expect(impact.bodiesRead).toBeGreaterThan(0);

			// Without the transforms the same changes keep their data as orphans, and the required field blocks publishing.
			const unhandled = await checkSchemaChange(
				store,
				(await planSchemaChange({ site: siteAfter, store, migrations: [] })).diff,
				{
					site: siteAfter,
				},
			);
			const named = (kind: string, field: string) =>
				unhandled.impacts.find(
					(item) => item.change.kind === kind && "field" in item.change && item.change.field === field,
				);
			expect(unhandled.impacts.find((item) => item.change.kind === "option_removed")?.consequence).toBe(
				"unknown_value",
			);
			expect(named("field_added", "author")).toMatchObject({ entries: 4, consequence: "publish_blocked" });
			expect(named("field_added", "excerpt")).toMatchObject({ entries: 0, consequence: "none" });
			expect(named("field_removed", "summary")).toMatchObject({ entries: 2, consequence: "orphaned" });
			expect(named("field_removed", "legacy")).toMatchObject({ entries: 1, consequence: "orphaned" });
			// Without the site an allowed-blocks check is skipped, which is said.
			const diff = {
				changes: [{ kind: "allowed_changed", collection: "post", before: {}, after: { blocks: [] }, narrowed: true }],
				renameHints: [],
			} as never;
			expect((await checkSchemaChange(store, diff)).impacts[0]).toMatchObject({ checked: false, entries: 0 });
		});
	});

	describe("applying", () => {
		it("SCHEMA-C1 a dry run reports what would happen and changes nothing", async () => {
			await baseline();
			const rowsBefore = await rows();
			const recordedBefore = await recorded();
			const stateBefore = await state();
			const done = await applySchemaChange({
				site: siteAfter,
				store: storeFor(siteAfter),
				migrations,
				dryRun: true,
			});
			expect(done.result.dryRun).toBe(true);
			expect(done.result.applied).toEqual(migrations.map((item) => item.id));
			expect(done.result.changed["rename-summary"]).toEqual({ entries: 2, bodies: 4 }); // working and published copies of A and B
			expect(await rows()).toEqual(rowsBefore);
			expect(await recorded()).toEqual(recordedBefore);
			expect(await state()).toEqual(stateBefore);
		});

		it("SCHEMA-F6 rejects a transform that does not fit the schema, and changes nothing", async () => {
			await baseline();
			const rowsBefore = await rows();
			const wrong: SchemaMigration[] = [
				{ id: "drop-live-field", op: "dropField", collection: "post", field: "status" },
			];
			await expect(
				applySchemaChange({ site: siteAfter, store: storeFor(siteAfter), migrations: wrong }),
			).rejects.toThrow(SchemaChangeError);
			await expect(
				applySchemaChange({
					site: siteAfter,
					store: storeFor(siteAfter),
					migrations: [
						{ id: "bad-option", op: "mapOption", collection: "post", field: "status", from: "old", to: "missing" },
					],
				}),
			).rejects.toThrow(/no option "missing"/);
			expect(await rows()).toEqual(rowsBefore);
			expect(await recorded()).toEqual([]);
		});

		it("SCHEMA-F5 runs the transforms through the write rules: values, hashes, references, versions", async () => {
			await baseline();
			const entriesBefore = new Map((await entryRows()).map((row) => [row.id as string, row]));
			const rowsBefore = await rows();
			// Which entries had unpublished changes: working and published hashes differ.
			const differs = (map: Map<string, BodyRow>, id: string) =>
				map.get(`${id}/working`)?.content_hash !== map.get(`${id}/published`)?.content_hash;
			expect(differs(rowsBefore, ids.a)).toBe(false);
			expect(differs(rowsBefore, ids.b)).toBe(true);

			const done = await applySchemaChange({ site: siteAfter, store: storeFor(siteAfter), migrations });
			expect(done.result.applied).toEqual(migrations.map((item) => item.id));
			expect(done.result.dryRun).toBe(false);

			const rowsAfter = await rows();
			const a = rowsAfter.get(`${ids.a}/working`);
			expect(a?.metadata).toEqual({
				title: "A",
				excerpt: "Summary A",
				status: "live",
				topicId: ids.category,
				author: "Staff",
			});
			expect(rowsAfter.get(`${ids.a}/published`)?.metadata).toEqual(a?.metadata);
			// The edited draft and its older published copy are both renamed, and stay different.
			expect(rowsAfter.get(`${ids.b}/working`)?.metadata).toMatchObject({
				excerpt: "Summary B, edited",
				author: "Staff",
			});
			expect(rowsAfter.get(`${ids.b}/published`)?.metadata).toMatchObject({ excerpt: "Summary B", author: "Staff" });
			// The value of a removed field without a `dropField` stays: nothing is dropped silently.
			expect(rowsAfter.get(`${ids.c}/working`)?.metadata).toEqual({
				title: "C",
				status: "live",
				legacy2: "kept",
				author: "Staff",
			});
			// The mapped select value is now an option.
			expect(rowsAfter.get(`${ids.d}/working`)?.metadata).toEqual({ title: "D", author: "Staff" });

			for (const [key, row] of rowsAfter) {
				// The hash is the one the write rules give for what is stored now.
				expect(row.content_hash, key).toBe(computeContentHash(row.metadata as never, readBodyDoc(row.doc)));
			}
			// "Unpublished changes" is true or false as it was.
			expect(differs(rowsAfter, ids.a)).toBe(false);
			expect(differs(rowsAfter, ids.b)).toBe(true);

			const category = rowsAfter.get(`${ids.category}/working`);
			expect(category?.content_hash).toBe(rowsBefore.get(`${ids.category}/working`)?.content_hash);

			// version and updated_at of entries and bodies are kept, as in the data migrations before.
			for (const row of await entryRows()) {
				expect(row.version, row.id).toBe(entriesBefore.get(row.id)?.version);
				expect(row.updated_at, row.id).toEqual(entriesBefore.get(row.id)?.updated_at);
			}
			for (const [key, row] of rowsAfter) expect(row.updated_at, key).toEqual(rowsBefore.get(key)?.updated_at);

			// The relation moved to its new field name: the reference follows (working and published), and stays one reference.
			const refs = await references(ids.a);
			expect(refs.map((ref) => ref.state)).toEqual(["published", "working"]);
			for (const ref of refs) {
				expect(ref.target_id).toBe(ids.category);
				expect(ref.occurrences).toEqual([{ type: "metadata", path: "topicId" }]);
			}

			// The schema is recorded, and every transform once.
			expect((await state())?.schema).toEqual(snapshotSchema(siteAfter));
			expect(await recorded()).toEqual(migrations.map((item) => `schema:${item.id}`).sort());
		});

		it("SCHEMA-F5 reads as the new schema does: no warnings for what was transformed, a warning for the orphan", async () => {
			await baselineThenApply();
			const service = serviceFor(siteAfter);
			const working = await storeFor(siteAfter).getWorking({ entryId: ids.c });
			const { warnings } = await service.publish({
				id: ids.c,
				expectedVersion: (await storeFor(siteAfter).getEntry(ids.c)).version,
			});
			expect(working.metadata).toMatchObject({ status: "live" });
			expect(warnings.map((warning) => `${warning.code}:${warning.path}`)).toEqual(["orphaned_metadata_key:legacy2"]);
		});

		it("SCHEMA-F5 reaches every entry when there are more bodies than one batch of the apply", async () => {
			await baseline();
			const service = serviceFor(siteBefore);
			// More than the 200 bodies the apply reads at a time, so it has to read a second batch.
			const many = await Promise.all(
				Array.from(
					{ length: 205 },
					async (_, index) =>
						(
							await service.createDraft({
								collection: "post",
								slug: `many-${index}`,
								metadata: { title: `Many ${index}`, summary: `Summary ${index}` },
								doc: docOf(""),
							} as never)
						).entry.id,
				),
			);
			await applySchemaChange({ site: siteAfter, store: storeFor(siteAfter), migrations });
			const after = await rows();
			const renamed = many.filter((id) => after.get(`${id}/working`)?.metadata.excerpt !== undefined);
			expect(renamed).toHaveLength(many.length);
			expect(many.some((id) => "summary" in (after.get(`${id}/working`)?.metadata ?? {}))).toBe(false);
		});

		it("SCHEMA-F5 is idempotent: a second apply runs nothing and changes nothing", async () => {
			await baselineThenApply();
			const rowsBefore = await rows();
			const recordedBefore = await recorded();
			const done = await applySchemaChange({ site: siteAfter, store: storeFor(siteAfter), migrations });
			expect(done.result.applied).toEqual([]);
			expect(done.result.skipped).toEqual(migrations.map((item) => item.id));
			expect(done.result).toMatchObject({ bodies: 0, entries: 0 });
			expect(await rows()).toEqual(rowsBefore);
			expect(await recorded()).toEqual(recordedBefore);
			const plan = await planSchemaChange({ site: siteAfter, store: storeFor(siteAfter), migrations });
			expect(plan.changed).toBe(false);
			expect(plan.diff.changes).toEqual([]);
		});

		it("SCHEMA-F5 two applies at once run each transform once", async () => {
			await baselineThenApply();
			const extra: SchemaMigration[] = [
				...migrations,
				{ id: "author-default-2", op: "setDefault", collection: "post", field: "author", value: "Other" },
			];
			const results = await Promise.all([
				applySchemaChange({ site: siteAfter, store: storeFor(siteAfter), migrations: extra }),
				applySchemaChange({ site: siteAfter, store: storeFor(siteAfter), migrations: extra }),
			]);
			const ran = results.flatMap((item) => item.result.applied);
			expect(ran).toEqual(["author-default-2"]);
			// The default found a value everywhere already: it ran and changed nothing.
			expect(results.map((item) => item.result.bodies)).toEqual([0, 0]);
			expect(await recorded()).toContain("schema:author-default-2");
		});
	});

	describe("a rename onto a field that holds a value", () => {
		it("SCHEMA-F1 keeps both values and says so: nothing is overwritten", async () => {
			await baselineThenApply();
			const service = serviceFor(siteBefore);
			const draft = (
				await service.createDraft({
					collection: "post",
					slug: "conflict",
					metadata: { title: "Conflict", summary: "old summary" },
					doc: docOf("Body"),
				} as never)
			).entry;
			// A body that already holds a value under the new name (as a hand edit of the data would leave it).
			await pool.query(
				`UPDATE "${schemaName}".entry_bodies SET metadata = metadata || '{"excerpt":"new summary"}'::jsonb WHERE entry_id = $1`,
				[draft.id],
			);
			const done = await applySchemaChange({
				site: siteAfter,
				store: storeFor(siteAfter),
				migrations: [
					...migrations,
					{ id: "rename-summary-again", op: "renameField", collection: "post", from: "summary", to: "excerpt" },
				],
			});
			expect(done.conflicts).toEqual([
				{ id: "rename-summary-again", entryId: draft.id, from: "summary", to: "excerpt" },
			]);
			const body = (await rows()).get(`${draft.id}/working`);
			expect(body?.metadata).toMatchObject({ summary: "old summary", excerpt: "new summary" });
		});
	});

	describe("the hash", () => {
		it("SCHEMA-F5 a save of the same content is not an edit: the hash and the entry version stay", async () => {
			const entry = await storeFor(siteAfter).getEntry(ids.category);
			const saved = (
				await serviceFor(siteAfter).saveDraft(ids.category, {
					collection: "category",
					slug: "news",
					metadata: { ...entry.working.metadata },
					doc: entry.working.doc,
					expectedVersion: entry.version,
				} as never)
			).entry;
			expect(saved.version).toBe(entry.version);
			expect(saved.working.contentHash).toBe(entry.working.contentHash);
		});

		it("SCHEMA-F5 an edit changes the hash to the one of its content", async () => {
			const entry = await storeFor(siteAfter).getEntry(ids.category);
			const saved = (
				await serviceFor(siteAfter).saveDraft(ids.category, {
					collection: "category",
					slug: "news",
					metadata: { title: "News, renamed" },
					doc: entry.working.doc,
					expectedVersion: entry.version,
				} as never)
			).entry;
			expect(saved.version).toBeGreaterThan(entry.version);
			expect(saved.working.contentHash).toBe(computeContentHash(saved.working.metadata, saved.working.doc));
		});
	});

	it("SCHEMA-C3 keeps the Postgres-recorded schema equal to the site's snapshot", async () => {
		await baselineThenApply();
		const row = await state();
		expect(Object.keys((row?.schema as { collections: object }).collections).sort()).toEqual(["category", "post"]);
	});
});

describe("schema change: collection path", () => {
	/** A public path change against a real database: the impact check counts the published entries whose address changes, and only those. */

	const title = { kind: "text", label: "Title", required: true } as const;

	const slug = { kind: "slug", label: "Address", from: "title" } as const;

	const siteWith = (postPath: string) =>
		createSite(
			defineSite({
				collections: {
					post: defineCollection({
						label: "Post",
						kind: "document",
						path: postPath as `/${string}:slug`,
						fields: { title, slug },
					}),
					page: defineCollection({ label: "Page", kind: "document", path: "/pages/:slug", fields: { title, slug } }),
				},
				locales: [{ code: "en", name: "English" }],
				defaultLocale: "en",
			}) as CmsConfig,
		);

	let pool: Pool;
	let schemaName: string;
	const before = siteWith("/posts/:slug");
	const after = siteWith("/blog/:slug");

	const storeFor = (site: Site) => createContentStore(pool, { site, schema: schemaName });

	beforeAll(async () => {
		const isolated = await createIsolatedTestPool();
		pool = isolated.pool;
		schemaName = isolated.schemaName;
		await migrateContentStore(pool, { site: before, schema: schemaName });
		const store = storeFor(before);
		const service = createContentService(store, { site: before });

		const draft = async (collection: "post" | "page", slugText: string) =>
			(
				await service.createDraft({
					collection,
					slug: slugText,
					metadata: { title: slugText },
					doc: docOf(`Body of ${slugText}`),
				} as never)
			).entry;
		const publish = async (collection: "post" | "page", slugText: string) => {
			const entry = await draft(collection, slugText);
			return (await service.publish({ id: entry.id, expectedVersion: entry.version })).entry;
		};

		await publish("post", "published-1");
		await publish("post", "published-2");
		// Published, then edited: it has a published copy and a working copy, and counts once.
		const edited = await publish("post", "published-3");
		await service.saveDraft(edited.id, {
			collection: "post",
			slug: "published-3",
			metadata: { title: "published-3 edited" },
			doc: docOf("Edited"),
			expectedVersion: edited.version,
		} as never);
		await draft("post", "draft-1");
		await draft("post", "draft-2");
		const trashed = await draft("post", "trashed-1");
		await store.trashEntry({ id: trashed.id, expectedVersion: trashed.version });
		// Another collection with a published entry: its address does not change.
		await publish("page", "about");
	});

	afterAll(async () => {
		if (pool && schemaName) await dropIsolatedTestPool(pool, schemaName);
		await closeGlobalPool();
	});

	it("SCHEMA-A1 counts the published entries of the collection whose path changed: not drafts, not trashed ones, not other collections, an edited one once", async () => {
		const store = storeFor(after);
		await applySchemaChange({ site: before, store: storeFor(before), migrations: [] });
		const plan = await planSchemaChange({ site: after, store, migrations: [] });
		expect(plan.diff.changes).toEqual([
			{ kind: "collection_path_changed", collection: "post", from: "/posts/:slug", to: "/blog/:slug" },
		]);
		const { impacts } = await checkSchemaChange(store, plan.diff, { site: after });
		expect(impacts).toHaveLength(1);
		expect(impacts[0]).toMatchObject({ consequence: "address_changed", entries: 3, checked: true });
		expect(impacts[0]?.sample).toHaveLength(3);
		expect(impacts[0]?.sample.every((item) => item.collection === "post")).toBe(true);
	});
});

describe("removing a collection with its entries", () => {
	/**
	 * Removing a collection with a `dropCollection` transform, against a real database: the review's numbers, the relation referrers the apply unlinks, and
	 * what the apply deletes (entries with their trash and translations, folders, addresses, references) in one transaction with the schema record.
	 */

	const title = { kind: "text", label: "Title", required: true } as const;

	const slug = { kind: "slug", label: "Address", from: "title" } as const;

	const locales = [
		{ code: "en", name: "English" },
		{ code: "ko", name: "Korean" },
	];

	const memo = defineCollection({
		label: "Memo",
		kind: "document",
		path: "/memos/:slug",
		folders: true,
		fields: { title, slug },
	});

	const post = (withMemo: boolean) =>
		defineCollection({
			label: "Post",
			kind: "document",
			path: "/posts/:slug",
			fields: {
				title,
				slug,
				...(withMemo ? { memoId: { kind: "relation", label: "Memo", to: "memo" } } : {}),
			},
		});

	const before = defineSite({ collections: { memo, post: post(true) }, locales, defaultLocale: "en" });

	/** The schema after the change: the memo collection is gone, and the post no longer has a field pointing at it. */
	const after = defineSite({ collections: { post: post(false) }, locales, defaultLocale: "en" });

	const drop: SchemaMigration = { id: "drop-memo", op: "dropCollection", collection: "memo" };

	const linkTo = (entryId: string): StoredDocument => ({
		type: "doc",
		version: STORED_DOCUMENT_VERSION,
		content: [
			{
				type: "paragraph",
				content: [
					{ type: "text", text: "See " } as CmsNode,
					{ type: "text", text: "the memo", marks: [{ type: "link", attrs: { entryId } }] } as CmsNode,
				],
			},
		],
	});

	let pool: Pool;
	let schemaName: string;
	const siteBefore = createSite(before as CmsConfig);
	const siteAfter = createSite(after as CmsConfig);
	const storeFor = (site: Site) => createContentStore(pool, { site, schema: schemaName });
	const serviceFor = (site: Site) => createContentService(storeFor(site), { site });

	/** The entries every test works on, written under the schema before into a schema of the test's own. */
	const ids = {} as Record<"m1" | "m1ko" | "m2" | "m3" | "p1" | "p2" | "p3" | "p4" | "folder", string>;

	const count = async (table: string, where = "TRUE", params: unknown[] = []) =>
		Number(
			(await pool.query<{ n: string }>(`SELECT count(*) AS n FROM "${schemaName}"."${table}" WHERE ${where}`, params))
				.rows[0]?.n,
		);
	const memoEntries = () => count("entries", "collection = 'memo'");

	beforeEach(async () => {
		const isolated = await createIsolatedTestPool();
		pool = isolated.pool;
		schemaName = isolated.schemaName;
		await migrateContentStore(pool, { site: siteBefore, schema: schemaName });
		const store = storeFor(siteBefore);
		const service = serviceFor(siteBefore);
		const publish = async (id: string, version: number) =>
			(await service.publish({ id, expectedVersion: version })).entry;

		const folder = await store.createFolder({ collection: "memo", parentId: null, name: "Inbox" });
		ids.folder = folder.id;
		// m1: published, with a Korean translation, renamed once (so it has an old address), in a folder.
		const m1 = (
			await service.createDraft({
				collection: "memo",
				slug: "first",
				metadata: { title: "First memo" },
				doc: docOf("First"),
				folderId: folder.id,
			} as never)
		).entry;
		ids.m1 = m1.id;
		const m1Published = await publish(m1.id, m1.version);
		ids.m1ko = (await service.createTranslation({ sourceId: m1.id, locale: "ko" })).entry.id;
		const renamed = (
			await service.saveDraft(m1.id, {
				collection: "memo",
				slug: "first-renamed",
				metadata: { title: "First memo" },
				doc: docOf("First"),
				expectedVersion: m1Published.version,
			} as never)
		).entry;
		await publish(m1.id, renamed.version);
		// m2: a draft. m3: in the trash.
		ids.m2 = (
			await service.createDraft({
				collection: "memo",
				slug: "second",
				metadata: { title: "Second memo" },
				doc: docOf(""),
			} as never)
		).entry.id;
		const m3 = (
			await service.createDraft({
				collection: "memo",
				slug: "third",
				metadata: { title: "Third memo" },
				doc: docOf(""),
			} as never)
		).entry;
		ids.m3 = m3.id;
		await store.trashEntry({ id: m3.id, expectedVersion: m3.version });

		// p1 points at m1 with a relation field; p2 links to m2 from its body; p3 has nothing to do with memos.
		ids.p1 = (
			await service.createDraft({
				collection: "post",
				slug: "p1",
				metadata: { title: "Reads the memo", memoId: m1.id },
				doc: docOf(""),
			} as never)
		).entry.id;
		ids.p2 = (
			await service.createDraft({
				collection: "post",
				slug: "p2",
				metadata: { title: "Links the memo" },
				doc: linkTo(ids.m2),
			} as never)
		).entry.id;
		ids.p3 = (
			await service.createDraft({
				collection: "post",
				slug: "p3",
				metadata: { title: "Unrelated" },
				doc: docOf(""),
			} as never)
		).entry.id;
		await applySchemaChange({ site: siteBefore, store, migrations: [] });
	});

	afterEach(async () => {
		if (pool && schemaName) await dropIsolatedTestPool(pool, schemaName);
	});

	afterAll(async () => {
		await closeGlobalPool();
	});

	it("SCHEMA-D4 is a change handled by the transform: a removed collection that deletes its entries", async () => {
		const store = storeFor(siteAfter);
		const plan = await planSchemaChange({ site: siteAfter, store, migrations: [drop] });
		expect(plan.problems).toEqual([]);
		expect(plan.diff.changes).toContainEqual({
			kind: "collection_removed",
			collection: "memo",
			handledBy: "drop-memo",
		});
		// Without the transform the entries would stay behind as orphans.
		const bare = await planSchemaChange({ site: siteAfter, store, migrations: [] });
		const impact = await checkSchemaChange(store, bare.diff, { site: siteAfter });
		expect(impact.impacts.find((item) => item.change.kind === "collection_removed")).toMatchObject({
			consequence: "orphaned",
			entries: 4,
		});
	});

	it("SCHEMA-D4 rejects a drop while the schema still has the collection", async () => {
		const plan = await planSchemaChange({ site: siteBefore, store: storeFor(siteBefore), migrations: [drop] });
		expect(plan.problems.map((problem) => problem.id)).toEqual(["drop-memo"]);
	});

	it("SCHEMA-D3 counts what the removal deletes, with the trash, the translations, the folders and the old addresses", async () => {
		const store = storeFor(siteAfter);
		const plan = await planSchemaChange({ site: siteAfter, store, migrations: [drop] });
		const rowsBefore = await memoEntries();
		const impact = await checkSchemaChange(store, plan.diff, { site: siteAfter, transforms: plan.pending });
		expect(await memoEntries()).toBe(rowsBefore);

		const removal = impact.impacts.find((item) => item.change.kind === "collection_removed");
		expect(removal).toMatchObject({ consequence: "deleted", entries: 3 });
		expect(removal?.drop).toMatchObject({
			entries: 3, // m1, m2 and the trashed m3: a translation comes with its source
			trashed: 1,
			translations: 1,
			folders: 1,
			bodyLinks: 1, // p2 links to m2
		});
		// m1 has its current address and the old one; m2 and m3 have working addresses only if they were published, so at least these two.
		expect(removal?.drop?.addresses).toBeGreaterThanOrEqual(2);
	});

	it("SCHEMA-D3 names the entries of other collections that point at it, with the first titles", async () => {
		const store = storeFor(siteAfter);
		const plan = await planSchemaChange({ site: siteAfter, store, migrations: [drop] });
		const impact = await checkSchemaChange(store, plan.diff, { site: siteAfter, transforms: plan.pending });
		const removal = impact.impacts.find((item) => item.change.kind === "collection_removed");
		expect(removal?.drop?.unlinked.count).toBe(1);
		expect(removal?.drop?.unlinked.sample).toMatchObject([{ id: ids.p1, title: "Reads the memo", collection: "post" }]);
	});

	it("SCHEMA-D4 rolls back the unlink with the rest when the apply fails inside the transaction", async () => {
		const store = storeFor(siteAfter);
		await expect(
			store.applySchemaChange({
				transformIds: ["drop-memo"],
				dropCollections: [{ id: "drop-memo", collection: "memo" }],
				collections: [],
				schema: {},
				rewrite: async () => null,
				unlinkRewrite: async () => {
					throw new Error("boom");
				},
			}),
		).rejects.toThrow("boom");
		expect(await memoEntries()).toBe(4);
		expect(await count("cms_migrations", "name = 'schema:drop-memo'")).toBe(0);
	});

	it("SCHEMA-D4 applies with entries pointing in: unlinks them, then deletes the entries (the trashed one and the translation too), the folders, the addresses and the references in one step", async () => {
		// p1 reads m1 from a relation field in its working and in its published body, and p4 reads the draft m2 in its working body only.
		const service = serviceFor(siteBefore);
		const p1 = await pool.query<{ version: number }>(`SELECT version FROM "${schemaName}".entries WHERE id = $1`, [
			ids.p1,
		]);
		await service.saveDraft(ids.p1, {
			collection: "post",
			slug: "p1",
			metadata: { title: "Reads the memo", memoId: ids.m1 },
			doc: docOf("Reads"),
			expectedVersion: p1.rows[0]?.version as number,
		} as never);
		const p1Saved = await pool.query<{ version: number }>(`SELECT version FROM "${schemaName}".entries WHERE id = $1`, [
			ids.p1,
		]);
		await service.publish({ id: ids.p1, expectedVersion: p1Saved.rows[0]?.version as number });
		ids.p4 = (
			await service.createDraft({
				collection: "post",
				slug: "p4",
				metadata: { title: "Reads the draft memo", memoId: ids.m2 },
				doc: docOf(""),
			} as never)
		).entry.id;
		const versions = async () =>
			Object.fromEntries(
				(
					await pool.query<{ id: string; version: number }>(
						`SELECT id, version FROM "${schemaName}".entries WHERE id = ANY($1::uuid[])`,
						[[ids.p1, ids.p2, ids.p3, ids.p4]],
					)
				).rows.map((row) => [row.id, row.version]),
			);
		const relationOf = async (id: string, state: "working" | "published") =>
			(
				await pool.query<{ metadata: Record<string, unknown> }>(
					`SELECT metadata FROM "${schemaName}".entry_bodies WHERE entry_id = $1 AND state = $2`,
					[id, state],
				)
			).rows[0]?.metadata.memoId;
		expect(await relationOf(ids.p1, "working")).toBe(ids.m1);
		expect(await relationOf(ids.p1, "published")).toBe(ids.m1);
		const was = await versions();
		const saved = () => count("cms_events", "kind = 'saved' AND entry_id = ANY($1::uuid[])", [[ids.p1, ids.p4]]);
		const savedBefore = await saved();

		const store = storeFor(siteAfter);
		const postsBefore = await count("entries", "collection = 'post'");
		const done = await applySchemaChange({ site: siteAfter, store, migrations: [drop] });

		// The dropped ids are out of both bodies of p1 and out of p4, and nothing references them any more.
		expect(await relationOf(ids.p1, "working")).toBeUndefined();
		expect(await relationOf(ids.p1, "published")).toBeUndefined();
		expect(await relationOf(ids.p4, "working")).toBeUndefined();
		// Each entry that was unlinked has its version up once and a `saved` event; the others are untouched.
		const now = await versions();
		expect(now[ids.p1]).toBe((was[ids.p1] as number) + 1);
		expect(now[ids.p4]).toBe((was[ids.p4] as number) + 1);
		expect(now[ids.p2]).toBe(was[ids.p2]);
		expect(now[ids.p3]).toBe(was[ids.p3]);
		expect(await saved()).toBe(savedBefore + 2);

		expect(done.result.dropped).toEqual([
			expect.objectContaining({ collection: "memo", entries: 3, trashed: 1, translations: 1, folders: 1 }),
		]);
		expect(done.result.applied).toEqual(["drop-memo"]);
		expect(await memoEntries()).toBe(0);
		expect(await count("entry_bodies", `entry_id = ANY($1::uuid[])`, [[ids.m1, ids.m1ko, ids.m2, ids.m3]])).toBe(0);
		expect(await count("folders", "collection = 'memo'")).toBe(0);
		expect(await count("content_addresses", "collection = 'memo'")).toBe(0);
		expect(await count("entry_references", "target_entry_id = ANY($1::uuid[])", [[ids.m1, ids.m2, ids.m3]])).toBe(0);
		// The posts are untouched, and p2 keeps its text with the link in it (it shows as broken).
		expect(await count("entries", "collection = 'post'")).toBe(postsBefore);
		const body = await pool.query<{ doc: StoredDocument }>(
			`SELECT doc FROM "${schemaName}".entry_bodies WHERE entry_id = $1 AND state = 'working'`,
			[ids.p2],
		);
		expect(JSON.stringify(body.rows[0]?.doc)).toContain(ids.m2);

		// One deleted event for every entry that went, the translation and the trashed one included.
		const events = await pool.query<{ entry_id: string; collection: string }>(
			`SELECT entry_id, collection FROM "${schemaName}".cms_events WHERE kind = 'deleted' ORDER BY entry_id`,
		);
		expect(events.rows.map((row) => row.entry_id).sort()).toEqual([ids.m1, ids.m1ko, ids.m2, ids.m3].sort());
		expect(new Set(events.rows.map((row) => row.collection))).toEqual(new Set(["memo"]));

		// The transform is recorded with the schema, in the same step.
		expect(await count("cms_migrations", "name = 'schema:drop-memo'")).toBe(1);
		const state = await pool.query<{ schema: { collections: Record<string, unknown> } }>(
			`SELECT schema FROM "${schemaName}".schema_state`,
		);
		expect(Object.keys(state.rows[0]?.schema.collections ?? {})).toEqual(["post"]);
	});

	it("SCHEMA-D4 runs once: applying again deletes nothing and the plan has nothing left", async () => {
		const store = storeFor(siteAfter);
		await applySchemaChange({ site: siteAfter, store, migrations: [drop] });
		const again = await applySchemaChange({ site: siteAfter, store, migrations: [drop] });
		expect(again.result.applied).toEqual([]);
		expect(again.result.dropped).toEqual([]);
		const plan = await planSchemaChange({ site: siteAfter, store, migrations: [drop] });
		expect(plan.changed).toBe(false);
	});
});

describe("removing a language with its translations", () => {
	/**
	 * Removing a language with a `trashLocale` transform, against a real database: the review's numbers, and what the apply moves to the trash (every live
	 * translation in that language, of every collection, the way the entry lifecycle trashes one) in one transaction with the schema record.
	 */

	const title = { kind: "text", label: "Title", required: true } as const;

	const slug = { kind: "slug", label: "Address", from: "title" } as const;

	const post = defineCollection({ label: "Post", kind: "document", path: "/posts/:slug", fields: { title, slug } });

	const note = defineCollection({ label: "Note", kind: "document", path: "/notes/:slug", fields: { title, slug } });

	const collections = { post, note };

	const ko = { code: "ko", name: "Korean" };

	const en = { code: "en", name: "English" };

	const before = defineSite({ collections, locales: [ko, en], defaultLocale: "ko" });

	/** The schema after the change: English is gone. */
	const after = defineSite({ collections, locales: [ko], defaultLocale: "ko" });

	const trash: SchemaMigration = { id: "trash-en", op: "trashLocale", locale: "en" };

	let pool: Pool;
	let schemaName: string;
	const siteBefore = createSite(before as CmsConfig);
	const siteAfter = createSite(after as CmsConfig);
	const storeFor = (site: Site) => createContentStore(pool, { site, schema: schemaName });
	const serviceFor = (site: Site) => createContentService(storeFor(site), { site });

	/** a: published, with a published translation. b: a draft with a draft translation. c: in the trash with its translation. d: published, its translation trashed alone. n: a note with a translation. Each test writes them into a schema of its own. */
	const ids = {} as Record<
		"a" | "aEn" | "b" | "bEn" | "c" | "cEn" | "d" | "dEn" | "e" | "n" | "nEn" | "noteKoOnly",
		string
	>;
	const live = ["aEn", "bEn", "nEn"] as const;
	const everyId = () => Object.values(ids);

	const count = async (table: string, where = "TRUE", params: unknown[] = []) =>
		Number(
			(await pool.query<{ n: string }>(`SELECT count(*) AS n FROM "${schemaName}"."${table}" WHERE ${where}`, params))
				.rows[0]?.n,
		);
	const rows = async () =>
		new Map(
			(
				await pool.query<{ id: string; status: string; version: number; deleted_at: Date | null }>(
					`SELECT id, status, version, deleted_at FROM "${schemaName}".entries WHERE id = ANY($1::uuid[])`,
					[everyId()],
				)
			).rows.map((row) => [row.id, row]),
		);
	const statusOf = (state: Map<string, { status: string }>, key: keyof typeof ids) => state.get(ids[key])?.status;

	beforeEach(async () => {
		const isolated = await createIsolatedTestPool();
		pool = isolated.pool;
		schemaName = isolated.schemaName;
		await migrateContentStore(pool, { site: siteBefore, schema: schemaName });
		const store = storeFor(siteBefore);
		const service = serviceFor(siteBefore);
		const draft = async (collection: "post" | "note", name: string) =>
			(
				await service.createDraft({
					collection,
					slug: name,
					metadata: { title: `Title of ${name}` },
					doc: docOf(name),
				} as never)
			).entry;
		const publish = async (id: string) => {
			const current = await store.getEntry(id);
			return (await service.publish({ id, expectedVersion: current.version })).entry;
		};
		/** A translation with a text of its own (a copy of the source text cannot be published). */
		const translate = async (sourceId: string, collection: "post" | "note", name: string) => {
			const created = (await service.createTranslation({ sourceId, locale: "en" })).entry;
			await service.saveDraft(created.id, {
				collection,
				slug: `${name}-en`,
				metadata: {},
				doc: docOf(`English ${name}`),
				expectedVersion: created.version,
			} as never);
			return created.id;
		};
		const trashOf = async (id: string) => {
			const current = await store.getEntry(id);
			await store.trashEntry({ id, expectedVersion: current.version });
		};

		ids.a = (await draft("post", "alpha")).id;
		await publish(ids.a);
		ids.aEn = await translate(ids.a, "post", "alpha");
		await publish(ids.aEn);

		ids.b = (await draft("post", "bravo")).id;
		ids.bEn = await translate(ids.b, "post", "bravo");

		// c is trashed with its translation (they go together).
		ids.c = (await draft("post", "charlie")).id;
		ids.cEn = await translate(ids.c, "post", "charlie");
		await trashOf(ids.c);

		// d is published; only its translation is in the trash.
		ids.d = (await draft("post", "delta")).id;
		await publish(ids.d);
		ids.dEn = await translate(ids.d, "post", "delta");
		await trashOf(ids.dEn);

		// e has no translation at all.
		ids.e = (await draft("post", "echo")).id;

		ids.n = (await draft("note", "november")).id;
		ids.nEn = await translate(ids.n, "note", "november");
		ids.noteKoOnly = (await draft("note", "only-ko")).id;

		await applySchemaChange({ site: siteBefore, store, migrations: [] });
	});

	afterEach(async () => {
		if (pool && schemaName) await dropIsolatedTestPool(pool, schemaName);
	});

	afterAll(async () => {
		await closeGlobalPool();
	});

	it("SCHEMA-C2 is a change handled by the transform: the review counts the live translations that move, the trashed ones are not counted", async () => {
		const store = storeFor(siteAfter);
		const plan = await planSchemaChange({ site: siteAfter, store, migrations: [trash] });
		expect(plan.problems).toEqual([]);
		expect(plan.diff.changes).toContainEqual({ kind: "locale_removed", locale: "en", handledBy: "trash-en" });
		const impact = await checkSchemaChange(store, plan.diff, { site: siteAfter, transforms: plan.pending });
		const removal = impact.impacts.find((item) => item.change.kind === "locale_removed");
		expect(removal).toMatchObject({ consequence: "trashed", entries: 3 });
		expect(removal?.sample.map((item) => item.id).sort()).toEqual(live.map((key) => ids[key]).sort());

		// Without the transform the translations stay as they are, hidden.
		const bare = await planSchemaChange({ site: siteAfter, store, migrations: [] });
		const bareImpact = await checkSchemaChange(store, bare.diff, { site: siteAfter });
		expect(bareImpact.impacts.find((item) => item.change.kind === "locale_removed")).toMatchObject({
			consequence: "orphaned",
			entries: 3,
		});
	});

	it("SCHEMA-C2 rejects a trash while the schema still lists the language", async () => {
		const plan = await planSchemaChange({ site: siteBefore, store: storeFor(siteBefore), migrations: [trash] });
		expect(plan.problems.map((problem) => problem.id)).toEqual(["trash-en"]);
	});

	it("SCHEMA-C2 leaves the translations as they are when the schema drops the language without the transform", async () => {
		const was = await rows();
		const done = await applySchemaChange({ site: siteAfter, store: storeFor(siteAfter), migrations: [] });
		expect(done.result.trashed).toEqual([]);
		expect(await rows()).toEqual(was);
		expect(statusOf(was, "aEn")).toBe("published");
		expect(statusOf(was, "bEn")).toBe("draft");
	});

	it("SCHEMA-C2 rolls back the moves with the rest when the apply fails after them in the transaction", async () => {
		const store = storeFor(siteAfter);
		const was = await rows();
		// The same id twice: the moves run, then recording the transform fails on the second insert.
		await expect(
			store.applySchemaChange({
				transformIds: ["trash-en", "trash-en"],
				trashLocales: [{ id: "trash-en", locale: "en" }],
				collections: [],
				schema: {},
				rewrite: async () => null,
				unlinkRewrite: async () => null,
			}),
		).rejects.toThrow();
		expect(await rows()).toEqual(was);
		expect(await count("cms_migrations", "name = 'schema:trash-en'")).toBe(0);
	});

	it("SCHEMA-C2 moves every live translation in that language to the trash, in every collection, and nothing else", async () => {
		const was = await rows();
		const trashedEvents = () => count("cms_events", "kind = 'trashed' AND entry_id = ANY($1::uuid[])", [everyId()]);
		const eventsBefore = await trashedEvents();

		const done = await applySchemaChange({ site: siteAfter, store: storeFor(siteAfter), migrations: [trash] });
		expect(done.result.applied).toEqual(["trash-en"]);
		expect(done.result.trashed).toEqual([{ locale: "en", entries: 3 }]);

		const now = await rows();
		for (const key of live) {
			expect(statusOf(now, key)).toBe("trashed");
			expect(now.get(ids[key])?.deleted_at).toBeInstanceOf(Date);
			expect(now.get(ids[key])?.version).toBe((was.get(ids[key])?.version as number) + 1);
		}
		// The sources, the entry without a translation, and the translations that were in the trash already are untouched.
		for (const key of ["a", "b", "c", "d", "e", "n", "noteKoOnly", "cEn", "dEn"] as const) {
			expect(now.get(ids[key])).toEqual(was.get(ids[key]));
		}
		expect(statusOf(now, "a")).toBe("published");
		expect(statusOf(now, "d")).toBe("published");
		expect(statusOf(now, "noteKoOnly")).toBe("draft");

		// One `trashed` event for each, like the trash of one entry.
		expect(await trashedEvents()).toBe(eventsBefore + 3);

		// The trash screen lists them, and they are recorded once.
		const trashed = await storeFor(siteAfter).listTrash({ pageSize: 100 });
		const listed = JSON.stringify(trashed.items);
		for (const key of live) expect(listed).toContain(ids[key]);
		expect(await count("cms_migrations", "name = 'schema:trash-en'")).toBe(1);
	});

	it("SCHEMA-C2 runs once: applying again moves nothing and the plan has nothing left", async () => {
		const store = storeFor(siteAfter);
		await applySchemaChange({ site: siteAfter, store, migrations: [trash] });
		const was = await rows();
		const again = await applySchemaChange({ site: siteAfter, store, migrations: [trash] });
		expect(again.result.applied).toEqual([]);
		expect(again.result.skipped).toEqual(["trash-en"]);
		expect(again.result.trashed).toEqual([]);
		expect(await rows()).toEqual(was);
		expect((await planSchemaChange({ site: siteAfter, store, migrations: [trash] })).changed).toBe(false);
	});

	it("SCHEMA-C2 restores one of them from the trash like any translation", async () => {
		await applySchemaChange({ site: siteAfter, store: storeFor(siteAfter), migrations: [trash] });
		const service = serviceFor(siteAfter);
		const trashed = (await rows()).get(ids.bEn);
		const restored = await service.restore({ id: ids.bEn, expectedVersion: trashed?.version as number });
		expect(restored.entry.status).toBe("draft");
		const state = await rows();
		expect(statusOf(state, "bEn")).toBe("draft");
		expect(state.get(ids.bEn)?.deleted_at).toBeNull();
		// The others stay in the trash.
		expect(statusOf(state, "aEn")).toBe("trashed");
		expect(statusOf(state, "nEn")).toBe("trashed");
	});
});
