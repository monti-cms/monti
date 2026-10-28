import type { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { docOf } from "../../../../test/stored-content";
import type { CmsConfig } from "../../../config/define";
import { defineSite } from "../../../config/define";
import { defineCollection } from "../../../schema/collection";
import { applySchemaChange, checkSchemaChange, planSchemaChange } from "../../../schema-change";
import type { SchemaMigration } from "../../../schema-file/types";
import { createContentService } from "../../../services/content-service";
import { createSite, type Site } from "../../../site";
import { createContentStore, migrateContentStore } from "../content-store";
import { closeGlobalPool, createIsolatedTestPool, dropIsolatedTestPool } from "./test-database";

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

describe("removing a language with its translations", () => {
	let pool: Pool;
	let schemaName: string;
	const siteBefore = createSite(before as CmsConfig);
	const siteAfter = createSite(after as CmsConfig);
	const storeFor = (site: Site) => createContentStore(pool, { site, schema: schemaName });
	const serviceFor = (site: Site) => createContentService(storeFor(site), { site });

	/** a: published, with a published translation. b: a draft with a draft translation. c: in the trash with its translation. d: published, its translation trashed alone. n: a note with a translation. */
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

	beforeAll(async () => {
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

	afterAll(async () => {
		if (pool && schemaName) await dropIsolatedTestPool(pool, schemaName);
		await closeGlobalPool();
	});

	it("is a change handled by the transform: the review counts the live translations that move, the trashed ones are not counted", async () => {
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

	it("rejects a trash while the schema still lists the language", async () => {
		const plan = await planSchemaChange({ site: siteBefore, store: storeFor(siteBefore), migrations: [trash] });
		expect(plan.problems.map((problem) => problem.id)).toEqual(["trash-en"]);
	});

	it("leaves the translations as they are when the schema drops the language without the transform", async () => {
		const was = await rows();
		const done = await applySchemaChange({ site: siteAfter, store: storeFor(siteAfter), migrations: [] });
		expect(done.result.trashed).toEqual([]);
		expect(await rows()).toEqual(was);
		expect(statusOf(was, "aEn")).toBe("published");
		expect(statusOf(was, "bEn")).toBe("draft");
	});

	it("rolls back the moves with the rest when the apply fails after them in the transaction", async () => {
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

	it("moves every live translation in that language to the trash, in every collection, and nothing else", async () => {
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

	it("runs once: applying again moves nothing and the plan has nothing left", async () => {
		const was = await rows();
		const store = storeFor(siteAfter);
		const again = await applySchemaChange({ site: siteAfter, store, migrations: [trash] });
		expect(again.result.applied).toEqual([]);
		expect(again.result.skipped).toEqual(["trash-en"]);
		expect(again.result.trashed).toEqual([]);
		expect(await rows()).toEqual(was);
		expect((await planSchemaChange({ site: siteAfter, store, migrations: [trash] })).changed).toBe(false);
	});

	it("restores one of them from the trash like any translation", async () => {
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
