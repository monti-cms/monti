import type { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { docOf } from "../../../../test/stored-content";
import { defineSite } from "../../../config/define";
import { computeContentHash } from "../../../core/content-hash";
import type { Entry } from "../../../core/store";
import { defineCollection } from "../../../schema/collection";
import { applySchemaChange, checkSchemaChange, planSchemaChange, SchemaChangeError } from "../../../schema-change";
import type { SchemaMigration } from "../../../schema-file/types";
import { createContentService } from "../../../services/content-service";
import { type AnyCmsConfig, createSite, type Site } from "../../../site";
import { createContentStore, migrateContentStore } from "../content-store";
import { readBodyDoc } from "../store/rows";
import { closeGlobalPool, createIsolatedTestPool, dropIsolatedTestPool } from "./test-database";

/**
 * Schema changes against a real database: the impact check, the transforms, `cms_migrations` records, hashes, references, versions and the schema version.
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
const afterConfig = (schemaVersion?: number) =>
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
		...(schemaVersion === undefined ? {} : { schemaVersion }),
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
	schema_version: number;
	content_hash: string;
	updated_at: Date;
}

describe("schema changes", () => {
	let pool: Pool;
	let schemaName: string;
	const siteBefore = createSite(beforeConfig as AnyCmsConfig);
	const siteAfter = createSite(afterConfig() as AnyCmsConfig);
	const siteAfterV2 = createSite(afterConfig(2) as AnyCmsConfig);

	const storeFor = (site: Site) => createContentStore(pool, { site, schema: schemaName });
	const serviceFor = (site: Site) => createContentService<Entry>(storeFor(site), { site });

	/** The entries every test works on, written under the schema before. */
	const ids = {} as Record<"category" | "a" | "b" | "c" | "d", string>;

	beforeAll(async () => {
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

	afterAll(async () => {
		if (pool && schemaName) await dropIsolatedTestPool(pool, schemaName);
		await closeGlobalPool();
	});

	const rows = async (): Promise<Map<string, BodyRow>> =>
		new Map(
			(
				await pool.query<BodyRow>(
					`SELECT entry_id, state, metadata, doc, schema_version, content_hash, updated_at FROM "${schemaName}".entry_bodies`,
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
		(await pool.query(`SELECT schema_version, schema FROM "${schemaName}".schema_state`)).rows[0] as
			| { schema_version: number; schema: unknown }
			| undefined;
	const references = async (entryId: string) =>
		(
			await pool.query<{ state: string; kind: string; target_id: string; occurrences: unknown }>(
				`SELECT state, kind, target_id, occurrences FROM "${schemaName}".entry_references WHERE entry_id = $1 ORDER BY state`,
				[entryId],
			)
		).rows;

	const baseline = () => applySchemaChange({ site: siteBefore, store: storeFor(siteBefore), migrations: [] });

	describe("the baseline", () => {
		it("records the schema without touching any entry (an extracted schema file applied with no transforms is a no-op)", async () => {
			const store = storeFor(siteBefore);
			const plan = await planSchemaChange({ site: siteBefore, store, migrations: [] });
			expect(plan.applied).toBeNull();
			expect(plan.diff.changes).toEqual([]);
			expect(plan.changed).toBe(false);
			expect(plan.nextVersion).toBe(1);

			const rowsBefore = await rows();
			const entriesBefore = await entryRows();
			const done = await baseline();
			expect(done.result).toMatchObject({ applied: [], bodies: 0, entries: 0 });
			expect(await rows()).toEqual(rowsBefore);
			expect(await entryRows()).toEqual(entriesBefore);
			expect((await state())?.schema_version).toBe(1);

			// Applying it again changes nothing either, and the plan now has an old side that equals the new one.
			const again = await planSchemaChange({ site: siteBefore, store, migrations: [] });
			expect(again.applied?.schemaVersion).toBe(1);
			expect(again.diff.changes).toEqual([]);
			await baseline();
			expect(await rows()).toEqual(rowsBefore);
		});
	});

	describe("the plan and the impact check", () => {
		it("lists what changed, with the transforms that handle each change, and raises the version", async () => {
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
			// The file's version is 1 (unset) and the schema changed: the apply goes to 2 and the file has to be raised.
			expect(plan.nextVersion).toBe(2);
			expect(plan.needsVersionBump).toBe(true);
			// A file that already carries the raised version is left alone.
			const raised = await planSchemaChange({ site: siteAfterV2, store, migrations });
			expect(raised.nextVersion).toBe(2);
			expect(raised.needsVersionBump).toBe(false);
		});

		it("counts the entries each change touches, with a sample, and reads without writing", async () => {
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
		it("a dry run reports what would happen and changes nothing", async () => {
			const rowsBefore = await rows();
			const recordedBefore = await recorded();
			const stateBefore = await state();
			const done = await applySchemaChange({
				site: siteAfterV2,
				store: storeFor(siteAfterV2),
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

		it("rejects a transform that does not fit the schema, and changes nothing", async () => {
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

		it("runs the transforms through the write rules: values, hashes, references, versions", async () => {
			const entriesBefore = new Map((await entryRows()).map((row) => [row.id as string, row]));
			const rowsBefore = await rows();
			// Which entries had unpublished changes: working and published hashes differ.
			const differs = (map: Map<string, BodyRow>, id: string) =>
				map.get(`${id}/working`)?.content_hash !== map.get(`${id}/published`)?.content_hash;
			expect(differs(rowsBefore, ids.a)).toBe(false);
			expect(differs(rowsBefore, ids.b)).toBe(true);

			const done = await applySchemaChange({ site: siteAfterV2, store: storeFor(siteAfterV2), migrations });
			expect(done.schemaVersion).toBe(2);
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
				// The hash is the one the write rules give for what is stored now (and stays defined over schema version 1).
				expect(row.content_hash, key).toBe(computeContentHash(row.metadata as never, readBodyDoc(row.doc, null)));
			}
			// "Unpublished changes" is true or false as it was.
			expect(differs(rowsAfter, ids.a)).toBe(false);
			expect(differs(rowsAfter, ids.b)).toBe(true);

			// Stamped with the version they were transformed under; entries written before keep the older one only if nothing changed them (here every post changed).
			expect(rowsAfter.get(`${ids.a}/working`)?.schema_version).toBe(2);
			expect(rowsAfter.get(`${ids.a}/published`)?.schema_version).toBe(2);
			const category = rowsAfter.get(`${ids.category}/working`);
			expect(category?.schema_version).toBe(1);
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

			// The schema and its version are recorded, and every transform once.
			expect((await state())?.schema_version).toBe(2);
			expect(await recorded()).toEqual(migrations.map((item) => `schema:${item.id}`).sort());
		});

		it("reads as the new schema does: no warnings for what was transformed, a warning for the orphan", async () => {
			const service = serviceFor(siteAfterV2);
			const working = await storeFor(siteAfterV2).getWorking({ entryId: ids.c });
			const { warnings } = await service.publish({
				id: ids.c,
				expectedVersion: (await storeFor(siteAfterV2).getEntry(ids.c)).version,
			});
			expect(working.metadata).toMatchObject({ status: "live" });
			expect(warnings.map((warning) => `${warning.code}:${warning.path}`)).toEqual(["orphaned_metadata_key:legacy2"]);
		});

		it("is idempotent: a second apply runs nothing and changes nothing", async () => {
			const rowsBefore = await rows();
			const recordedBefore = await recorded();
			const done = await applySchemaChange({ site: siteAfterV2, store: storeFor(siteAfterV2), migrations });
			expect(done.result.applied).toEqual([]);
			expect(done.result.skipped).toEqual(migrations.map((item) => item.id));
			expect(done.result).toMatchObject({ bodies: 0, entries: 0 });
			expect(await rows()).toEqual(rowsBefore);
			expect(await recorded()).toEqual(recordedBefore);
			const plan = await planSchemaChange({ site: siteAfterV2, store: storeFor(siteAfterV2), migrations });
			expect(plan.changed).toBe(false);
			expect(plan.diff.changes).toEqual([]);
			expect(plan.nextVersion).toBe(2);
		});

		it("two applies at once run each transform once", async () => {
			const extra: SchemaMigration[] = [
				...migrations,
				{ id: "author-default-2", op: "setDefault", collection: "post", field: "author", value: "Other" },
			];
			const results = await Promise.all([
				applySchemaChange({ site: siteAfterV2, store: storeFor(siteAfterV2), migrations: extra }),
				applySchemaChange({ site: siteAfterV2, store: storeFor(siteAfterV2), migrations: extra }),
			]);
			const ran = results.flatMap((item) => item.result.applied);
			expect(ran).toEqual(["author-default-2"]);
			// The default found a value everywhere already: it ran and changed nothing.
			expect(results.map((item) => item.result.bodies)).toEqual([0, 0]);
			expect(await recorded()).toContain("schema:author-default-2");
		});
	});

	describe("a rename onto a field that holds a value", () => {
		it("keeps both values and says so: nothing is overwritten", async () => {
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
				site: siteAfterV2,
				store: storeFor(siteAfterV2),
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

	describe("the schema version and the hash", () => {
		it("a save of the same content under a newer schema version is not an edit: the hash, the entry version and the stored version stay", async () => {
			// The category was never transformed, so it is stored under schema version 1.
			const entry = await storeFor(siteAfterV2).getEntry(ids.category);
			expect(entry.working.schemaVersion).toBe(1);
			const saved = (
				await serviceFor(siteAfterV2).saveDraft(ids.category, {
					collection: "category",
					slug: "news",
					metadata: { ...entry.working.metadata },
					doc: entry.working.doc,
					expectedVersion: entry.version,
				} as never)
			).entry;
			expect(saved.version).toBe(entry.version);
			expect(saved.working.contentHash).toBe(entry.working.contentHash);
			expect(saved.working.schemaVersion).toBe(1);
		});

		it("an edit is stored under the site's schema version, and the hash does not depend on it", async () => {
			const entry = await storeFor(siteAfterV2).getEntry(ids.category);
			const saved = (
				await serviceFor(siteAfterV2).saveDraft(ids.category, {
					collection: "category",
					slug: "news",
					metadata: { title: "News, renamed" },
					doc: entry.working.doc,
					expectedVersion: entry.version,
				} as never)
			).entry;
			expect(saved.version).toBeGreaterThan(entry.version);
			expect(saved.working.schemaVersion).toBe(2);
			expect(saved.working.contentHash).toBe(computeContentHash(saved.working.metadata, saved.working.doc));
			// The same content written under another schema version has the same hash.
			const other = (
				await serviceFor(siteAfter).createDraft({
					collection: "category",
					slug: "news-copy",
					metadata: { ...saved.working.metadata },
					doc: saved.working.doc,
				} as never)
			).entry;
			expect(other.working.schemaVersion).toBe(1);
			expect(other.working.contentHash).toBe(saved.working.contentHash);
		});
	});

	it("keeps the Postgres-recorded schema equal to the site's snapshot", async () => {
		const row = await state();
		expect(Object.keys((row?.schema as { collections: object }).collections).sort()).toEqual(["category", "post"]);
	});
});
