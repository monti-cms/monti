import type { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { docOf } from "../../../../test/stored-content";
import type { CmsConfig } from "../../../config/define";
import { defineSite } from "../../../config/define";
import { type CmsNode, STORED_DOCUMENT_VERSION, type StoredDocument } from "../../../document";
import { defineCollection } from "../../../schema/collection";
import { applySchemaChange, checkSchemaChange, planSchemaChange, SchemaChangeError } from "../../../schema-change";
import type { SchemaMigration } from "../../../schema-file/types";
import { createContentService } from "../../../services/content-service";
import { createSite, type Site } from "../../../site";
import { createContentStore, migrateContentStore } from "../content-store";
import { closeGlobalPool, createIsolatedTestPool, dropIsolatedTestPool } from "./test-database";

/**
 * Removing a collection with a `dropCollection` transform, against a real database: the review's numbers, the relation referrers that block the apply, and
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

describe("removing a collection with its entries", () => {
	let pool: Pool;
	let schemaName: string;
	const siteBefore = createSite(before as CmsConfig);
	const siteAfter = createSite(after as CmsConfig);
	const storeFor = (site: Site) => createContentStore(pool, { site, schema: schemaName });
	const serviceFor = (site: Site) => createContentService(storeFor(site), { site });

	const ids = {} as Record<"m1" | "m1ko" | "m2" | "m3" | "p1" | "p2" | "p3" | "folder", string>;

	const count = async (table: string, where = "TRUE", params: unknown[] = []) =>
		Number(
			(await pool.query<{ n: string }>(`SELECT count(*) AS n FROM "${schemaName}"."${table}" WHERE ${where}`, params))
				.rows[0]?.n,
		);
	const memoEntries = () => count("entries", "collection = 'memo'");

	beforeAll(async () => {
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

	afterAll(async () => {
		if (pool && schemaName) await dropIsolatedTestPool(pool, schemaName);
		await closeGlobalPool();
	});

	it("is a change handled by the transform: a removed collection that deletes its entries", async () => {
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

	it("rejects a drop while the schema still has the collection", async () => {
		const plan = await planSchemaChange({ site: siteBefore, store: storeFor(siteBefore), migrations: [drop] });
		expect(plan.problems.map((problem) => problem.id)).toEqual(["drop-memo"]);
	});

	it("counts what the removal deletes, with the trash, the translations, the folders and the old addresses", async () => {
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

	it("names the entries of other collections that point at it, with the first titles", async () => {
		const store = storeFor(siteAfter);
		const plan = await planSchemaChange({ site: siteAfter, store, migrations: [drop] });
		const impact = await checkSchemaChange(store, plan.diff, { site: siteAfter, transforms: plan.pending });
		const removal = impact.impacts.find((item) => item.change.kind === "collection_removed");
		expect(removal?.drop?.blockers.count).toBe(1);
		expect(removal?.drop?.blockers.sample).toMatchObject([{ id: ids.p1, title: "Reads the memo", collection: "post" }]);
	});

	it("refuses to apply while an entry of another collection points at it, and changes nothing", async () => {
		const store = storeFor(siteAfter);
		const entriesBefore = await memoEntries();
		await expect(applySchemaChange({ site: siteAfter, store, migrations: [drop] })).rejects.toBeInstanceOf(
			SchemaChangeError,
		);
		expect(await memoEntries()).toBe(entriesBefore);
		expect(await count("cms_migrations", "name = 'schema:drop-memo'")).toBe(0);
		expect(await count("cms_events", "kind = 'deleted'")).toBe(0);
	});

	it("the store refuses it too, inside the transaction, when the pre-check is skipped", async () => {
		const store = storeFor(siteAfter);
		await expect(
			store.applySchemaChange({
				transformIds: ["drop-memo"],
				dropCollections: [{ id: "drop-memo", collection: "memo" }],
				collections: [],
				schema: {},
				rewrite: async () => null,
			}),
		).rejects.toMatchObject({ code: "in_use" });
		expect(await memoEntries()).toBe(4);
	});

	it("body links never block: only the relation field of p1 does", async () => {
		const service = serviceFor(siteBefore);
		// Unlink: p1 no longer has the relation (what `POST /references/unlink` does for a screen).
		const current = await pool.query<{ version: number }>(`SELECT version FROM "${schemaName}".entries WHERE id = $1`, [
			ids.p1,
		]);
		await service.saveDraft(ids.p1, {
			collection: "post",
			slug: "p1",
			metadata: { title: "Reads the memo" },
			doc: docOf(""),
			expectedVersion: current.rows[0]?.version as number,
		} as never);

		const store = storeFor(siteAfter);
		const plan = await planSchemaChange({ site: siteAfter, store, migrations: [drop] });
		const impact = await checkSchemaChange(store, plan.diff, { site: siteAfter, transforms: plan.pending });
		const removal = impact.impacts.find((item) => item.change.kind === "collection_removed");
		expect(removal?.drop).toMatchObject({ blockers: { count: 0, sample: [] }, bodyLinks: 1 });
	});

	it("deletes the entries (the trashed one and the translation too), the folders, the addresses and the references in one step", async () => {
		const store = storeFor(siteAfter);
		const postsBefore = await count("entries", "collection = 'post'");
		const done = await applySchemaChange({ site: siteAfter, store, migrations: [drop] });

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

	it("runs once: applying again deletes nothing and the plan has nothing left", async () => {
		const store = storeFor(siteAfter);
		const again = await applySchemaChange({ site: siteAfter, store, migrations: [drop] });
		expect(again.result.applied).toEqual([]);
		expect(again.result.dropped).toEqual([]);
		const plan = await planSchemaChange({ site: siteAfter, store, migrations: [drop] });
		expect(plan.changed).toBe(false);
	});
});
