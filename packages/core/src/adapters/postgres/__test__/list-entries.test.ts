import { randomBytes } from "node:crypto";
import { Pool } from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { contentCollection, requiredMetadata } from "../../../../test/any-site";
import { testSite } from "../../../../test/site";
import { docOf } from "../../../../test/stored-content";
import type { Collection } from "../../../core/collections";
import type { Entry } from "../../../core/store";
import { CmsError } from "../../../core/store";
import { moveToFolder, publishDraft, seedEntry } from "../../../core/store/__test__/seed";
import { createContentStore, migrateContentStore } from "../content-store";

// What stays here changes the stored dates directly (`created_at`, `updated_at`, `published_at`) or reads the schema, which only Postgres has.
// The rest of the list behavior (search, filters, relations, values, record locales) is in the store contract
// (`core/store/__test__/contract/list.contract.ts`).

// ---------------------------------------------------------------------------
// Local type declarations for the not-yet-implemented listEntries API
// ---------------------------------------------------------------------------

interface ListEntriesItem {
	id: string;
	collection: string;
	title: string | null;
	slug: string | null;
	status: "draft" | "published";
	folderId: string | null;
	relations: Readonly<Record<string, readonly { id: string; title: string | null }[]>>;
	values: Readonly<Record<string, string>>;
	publishedAt: Date | null;
	createdAt: Date;
	updatedAt: Date;
}

interface ListEntriesParams {
	collection: string;
	search?: string;
	includeBody?: boolean;
	titleContains?: string;
	slugContains?: string;
	statuses?: readonly ("draft" | "published")[];
	folderId?: string | null;
	includeDescendants?: boolean;
	relations?: Readonly<Record<string, readonly string[]>>;
	sort?: {
		field: "updatedAt" | "createdAt" | "title" | "slug";
		direction: "asc" | "desc";
	};
	page?: number;
	pageSize?: 25 | 50 | 100;
}

interface ExtendedContentStore {
	listEntries(params: ListEntriesParams): Promise<{
		items: ListEntriesItem[];
		total: number;
		page: number;
		pageSize: number;
	}>;
	createEntryWithReferences(params: {
		snapshot: {
			collection: string;
			slug: string | null;
			metadata: Record<string, unknown>;
			doc: unknown;
			schemaVersion: number;
			contentHash: string;
			references: unknown[];
			issues: unknown[];
		};
		references: unknown[];
	}): Promise<Entry>;
}

// ---------------------------------------------------------------------------
// Collections and fields are looked up in the config (runs against both the reference blog config and other site configs, `test/any-site.ts`)
// ---------------------------------------------------------------------------

/** Document collection under test for lists (the reference blog's posts). */
const content = contentCollection;

type RelationInfo = { name: string; to: Collection; many: boolean };
/** A non-conditional relation field that points at an item collection. */
const itemRelations: RelationInfo[] = testSite
	.storedFields(content)
	.flatMap(({ name, field, when }) =>
		!when && field.kind === "relation" && testSite.isItemCollection(field.to)
			? [{ name, to: field.to as Collection, many: Boolean(field.many) }]
			: [],
	);
/** A single-select relation (the reference blog's category) and a multi-select relation (the reference blog's tags). */
const singleRelation = itemRelations.find((relation) => !relation.many);
const manyRelation = itemRelations.find((relation) => relation.many);
const relationTargetTitle = (to: Collection) => `List test ${to}`;

// ---------------------------------------------------------------------------
// Error assertion helper — identity + code
// ---------------------------------------------------------------------------

function expectCmsError(err: unknown, code: string): void {
	expect(err).toBeInstanceOf(CmsError);
	expect((err as CmsError).code).toBe(code);
}

// ---------------------------------------------------------------------------
// Suite-local DB infrastructure (own Pool, random schema, no shared global)
// ---------------------------------------------------------------------------

describe("listEntries in Postgres", () => {
	const ctx: { pool?: Pool; schema?: string; schemaCreated: boolean } = { schemaCreated: false };
	let pool: Pool;
	let schemaName: string;
	let store: ReturnType<typeof createContentStore> & ExtendedContentStore;
	let relationTargets = new Map<Collection, Promise<string>>();

	/** One published item of the relation target collection (created fresh for each test). */
	const relationTarget = (to: Collection): Promise<string> => {
		const known = relationTargets.get(to);
		if (known) return known;
		const created = (async () => {
			const draft = await seedEntry(store, {
				collection: to,
				slug: `list-test-${to}`,
				metadata: await requiredMetadata(to, relationTargetTitle(to), relationTarget),
				text: "",
				schemaVersion: 1,
				contentHash: uniqueHash(),
			});
			return (await publishDraft(testSite, store, { id: draft.id, expectedVersion: draft.version })).id;
		})();
		relationTargets.set(to, created);
		return created;
	};

	/** Metadata with the required-for-publish values filled in (such as the reference blog's category). The title is kept as given (including `null`). */
	const metadataFor = async (collection: string, title: string | null) => ({
		...(await requiredMetadata(collection as Collection, title ?? "", relationTarget)),
		title,
	});

	beforeAll(async () => {
		const url = process.env.CMS_TEST_DATABASE_URL;
		if (!url) {
			throw new Error("CMS_TEST_DATABASE_URL is required — never use CMS_DATABASE_URL for tests.");
		}
		schemaName = `cms_le_${randomBytes(4).toString("hex")}`;
		pool = new Pool({ connectionString: url });
		ctx.pool = pool;
		ctx.schema = schemaName;
		await pool.query(`CREATE SCHEMA "${schemaName}"`);
		ctx.schemaCreated = true;
		await migrateContentStore(pool, { site: testSite, schema: schemaName });
		store = createContentStore(pool, { site: testSite, schema: schemaName }) as unknown as typeof store;
	});

	afterAll(async () => {
		try {
			if (ctx.pool && ctx.schemaCreated && ctx.schema) {
				await ctx.pool.query(`DROP SCHEMA "${ctx.schema}" CASCADE`);
			}
		} finally {
			if (ctx.pool) {
				await ctx.pool.end();
			}
		}
	});

	beforeEach(async () => {
		if (ctx.schemaCreated) {
			try {
				await pool.query(`TRUNCATE "${schemaName}".entries CASCADE`);
				await pool.query(`TRUNCATE "${schemaName}".folders CASCADE`);
			} catch {
				// Tables might not exist yet
			}
			relationTargets = new Map();
		}
	});

	// -----------------------------------------------------------------------
	// Fixture helpers
	// -----------------------------------------------------------------------

	let seqCounter = 0;
	function uniqueHash(): string {
		seqCounter += 1;
		return `h${seqCounter}_${randomBytes(4).toString("hex")}`;
	}

	async function seed(
		collection: string,
		slug: string | null,
		title: string | null,
		opts: {
			status?: "draft" | "published";
			folderId?: string | null;
			text?: string;
		} = {},
	): Promise<Entry & { folderId?: string | null }> {
		const entry = await seedEntry(store, {
			collection,
			slug,
			metadata: await metadataFor(collection, title),
			text: opts.text ?? "default body",
			schemaVersion: 1,
			contentHash: uniqueHash(),
		});

		let current: Entry & { folderId?: string | null } = entry;

		if (opts.status === "published") {
			if (slug === null) {
				throw new Error("Cannot publish an entry with null slug in fixture");
			}
			current = await publishDraft(testSite, store, { id: entry.id, expectedVersion: current.version });
		}

		if (opts.folderId) {
			current = await moveToFolder(store, {
				entryId: entry.id,
				folderId: opts.folderId,
				expectedVersion: current.version,
			});
		}

		return current;
	}

	// -----------------------------------------------------------------------
	// 5  sort fields/directions, NULLS LAST, deterministic id tie-break
	// -----------------------------------------------------------------------

	it("5. all sort fields/directions, NULLS LAST both dirs, deterministic id tie-break; malicious sort rejects invalid_input", async () => {
		// Seed entries and capture IDs for deterministic assertions
		const e5a = await seed(content, null, null);
		const e5b = await seed(content, "le5-a", "B-title");
		const e5c = await seed(content, "le5-b", "A-title");

		const seededIds = [e5a.id, e5b.id, e5c.id];

		// Assign deterministic distinct created_at values via schema-qualified SQL
		await pool.query(`UPDATE "${schemaName}".entries SET created_at = $1 WHERE id = $2`, [
			new Date("2020-01-01T00:00:00Z"),
			seededIds[0],
		]);
		await pool.query(`UPDATE "${schemaName}".entries SET created_at = $1 WHERE id = $2`, [
			new Date("2020-01-02T00:00:00Z"),
			seededIds[1],
		]);
		await pool.query(`UPDATE "${schemaName}".entries SET created_at = $1 WHERE id = $2`, [
			new Date("2020-01-03T00:00:00Z"),
			seededIds[2],
		]);

		// Assign deterministic distinct updated_at values
		await pool.query(`UPDATE "${schemaName}".entries SET updated_at = $1 WHERE id = $2`, [
			new Date("2021-06-01T00:00:00Z"),
			seededIds[0],
		]);
		await pool.query(`UPDATE "${schemaName}".entries SET updated_at = $1 WHERE id = $2`, [
			new Date("2021-06-02T00:00:00Z"),
			seededIds[1],
		]);
		await pool.query(`UPDATE "${schemaName}".entries SET updated_at = $1 WHERE id = $2`, [
			new Date("2021-06-03T00:00:00Z"),
			seededIds[2],
		]);

		// --- default sort: updatedAt DESC then id ASC ---
		const defaultSort = await store.listEntries({ collection: content });
		expect(defaultSort.items.map((i) => i.id)).toEqual([seededIds[2], seededIds[1], seededIds[0]]);

		// --- createdAt ASC: e5a (Jan 1) → e5b (Jan 2) → e5c (Jan 3) ---
		const caAsc = await store.listEntries({ collection: content, sort: { field: "createdAt", direction: "asc" } });
		expect(caAsc.items.map((i) => i.id)).toEqual([seededIds[0], seededIds[1], seededIds[2]]);

		// --- createdAt DESC: e5c → e5b → e5a ---
		const caDesc = await store.listEntries({ collection: content, sort: { field: "createdAt", direction: "desc" } });
		expect(caDesc.items.map((i) => i.id)).toEqual([seededIds[2], seededIds[1], seededIds[0]]);

		// --- updatedAt ASC: e5a (Jun 1) → e5b (Jun 2) → e5c (Jun 3) ---
		const uaAsc = await store.listEntries({ collection: content, sort: { field: "updatedAt", direction: "asc" } });
		expect(uaAsc.items.map((i) => i.id)).toEqual([seededIds[0], seededIds[1], seededIds[2]]);

		// --- updatedAt DESC: e5c → e5b → e5a ---
		const uaDesc = await store.listEntries({ collection: content, sort: { field: "updatedAt", direction: "desc" } });
		expect(uaDesc.items.map((i) => i.id)).toEqual([seededIds[2], seededIds[1], seededIds[0]]);

		// --- Tied group for id ASC tie-break ---
		// Force all three to identical created_at
		await pool.query(`UPDATE "${schemaName}".entries SET created_at = $1 WHERE collection = $2`, [
			new Date("2020-01-01T00:00:00Z"),
			content,
		]);
		const tied = await store.listEntries({ collection: content, sort: { field: "createdAt", direction: "asc" } });
		expect(tied.items).toHaveLength(3);
		const tiedIds = tied.items.map((i) => i.id);
		const sortedIds = [...tiedIds].sort();
		expect(tiedIds).toEqual(sortedIds);

		// --- slug ASC: NULLS LAST → le5-a, le5-b, null ---
		const slugAsc = await store.listEntries({ collection: content, sort: { field: "slug", direction: "asc" } });
		expect(slugAsc.items.map((i) => i.slug)).toEqual(["le5-a", "le5-b", null]);

		// --- slug DESC: NULLS LAST → le5-b, le5-a, null ---
		const slugDesc = await store.listEntries({ collection: content, sort: { field: "slug", direction: "desc" } });
		expect(slugDesc.items.map((i) => i.slug)).toEqual(["le5-b", "le5-a", null]);

		// --- title ASC: NULLS LAST → A-title, B-title, null ---
		const titleAsc = await store.listEntries({ collection: content, sort: { field: "title", direction: "asc" } });
		expect(titleAsc.items.map((i) => i.title)).toEqual(["A-title", "B-title", null]);

		// --- title DESC: NULLS LAST → B-title, A-title, null ---
		const titleDesc = await store.listEntries({ collection: content, sort: { field: "title", direction: "desc" } });
		expect(titleDesc.items.map((i) => i.title)).toEqual(["B-title", "A-title", null]);

		// Malicious runtime sort field → invalid_input, no schema mutation
		const beforeTables = await pool.query(`SELECT tablename FROM pg_tables WHERE schemaname = $1 ORDER BY tablename`, [
			schemaName,
		]);

		const badSort = {
			field: "title; DROP TABLE entries --" as unknown as "title",
			direction: "asc" as const,
		};
		let sortErr: unknown;
		try {
			await store.listEntries({ collection: content, sort: badSort });
		} catch (e) {
			sortErr = e;
		}
		expectCmsError(sortErr, "invalid_input");

		// invalid runtime direction
		let dirErr: unknown;
		try {
			await store.listEntries({ collection: content, sort: { field: "title", direction: "drop" as "asc" } });
		} catch (e) {
			dirErr = e;
		}
		expectCmsError(dirErr, "invalid_input");

		// invalid status
		let statusErr: unknown;
		try {
			await store.listEntries({ collection: content, statuses: ["draft", "invalid" as "published"] });
		} catch (e) {
			statusErr = e;
		}
		expectCmsError(statusErr, "invalid_input");

		const afterTables = await pool.query(`SELECT tablename FROM pg_tables WHERE schemaname = $1 ORDER BY tablename`, [
			schemaName,
		]);
		expect(afterTables.rows).toEqual(beforeTables.rows);
	}, 15_000);

	// -----------------------------------------------------------------------
	// 6  pagination: 26 entries, exact metadata, no dup/omission, reject bad
	// -----------------------------------------------------------------------

	it("6. 26 entries pageSize=25: exact total/page metadata, no omission/duplicate, deterministic repeat; page<1 / invalid pageSize reject invalid_input", async () => {
		// Create 26 entries concurrently with bounded Promise.all
		await Promise.all(
			Array.from({ length: 26 }, (_, i) => seed(content, `le6-s${String(i).padStart(2, "0")}`, `Title ${i}`)),
		);

		// Force identical updatedAt for deterministic tie-break test
		await pool.query(`UPDATE "${schemaName}".entries SET updated_at = $1 WHERE collection = $2`, [
			new Date("2023-06-01T00:00:00Z"),
			content,
		]);

		const p1 = await store.listEntries({
			collection: content,
			page: 1,
			pageSize: 25,
			sort: { field: "updatedAt", direction: "desc" },
		});
		expect(p1.total).toBe(26);
		expect(p1.page).toBe(1);
		expect(p1.pageSize).toBe(25);
		expect(p1.items).toHaveLength(25);

		const p2 = await store.listEntries({
			collection: content,
			page: 2,
			pageSize: 25,
			sort: { field: "updatedAt", direction: "desc" },
		});
		expect(p2.total).toBe(26);
		expect(p2.page).toBe(2);
		expect(p2.pageSize).toBe(25);
		expect(p2.items).toHaveLength(1);

		// No duplicates, no omissions
		const allIds = [...p1.items.map((i) => i.id), ...p2.items.map((i) => i.id)];
		expect(new Set(allIds).size).toBe(26);

		// Assert full concatenated IDs equal exactly ID-ascending order for ties
		const expectedAllIds = [...allIds].sort();
		expect(allIds).toEqual(expectedAllIds);

		// Deterministic repeat
		const p1Again = await store.listEntries({
			collection: content,
			page: 1,
			pageSize: 25,
			sort: { field: "updatedAt", direction: "desc" },
		});
		expect(p1Again.items.map((i) => i.id)).toEqual(p1.items.map((i) => i.id));

		// Reject page < 1
		let pageErr: unknown;
		try {
			await store.listEntries({ collection: content, page: 0 });
		} catch (e) {
			pageErr = e;
		}
		expectCmsError(pageErr, "invalid_input");

		// Reject page noninteger
		let pageFloatErr: unknown;
		try {
			await store.listEntries({ collection: content, page: 1.5 });
		} catch (e) {
			pageFloatErr = e;
		}
		expectCmsError(pageFloatErr, "invalid_input");

		// Reject invalid pageSize (not 25|50|100)
		let sizeErr: unknown;
		try {
			await store.listEntries({ collection: content, pageSize: 30 as unknown as 25 });
		} catch (e) {
			sizeErr = e;
		}
		expectCmsError(sizeErr, "invalid_input");
	}, 30_000);
	// -----------------------------------------------------------------------
	// 7  List authority
	// -----------------------------------------------------------------------

	it.skipIf(!singleRelation || !manyRelation)(
		"7. List authority: working metadata is authoritative for the single relation and the ordered many relation; publishedAt is the column",
		async () => {
			const single = singleRelation as RelationInfo;
			const many = manyRelation as RelationInfo;
			await seedEntry(store, {
				collection: content,
				slug: "d1-direct",
				metadata: { [single.name]: "cat-1", [many.name]: ["tag-a", "tag-b"] },
				text: "body",
				schemaVersion: 1,
				contentHash: randomBytes(16).toString("hex"),
			});

			const targetCat = await seedEntry(store, {
				collection: single.to,
				slug: "cat-real",
				metadata: {},
				text: "",
				schemaVersion: 1,
				contentHash: randomBytes(16).toString("hex"),
			});
			const targetTag1 = await seedEntry(store, {
				collection: many.to,
				slug: "tag-real1",
				metadata: {},
				text: "",
				schemaVersion: 1,
				contentHash: randomBytes(16).toString("hex"),
			});
			const targetTag2 = await seedEntry(store, {
				collection: many.to,
				slug: "tag-real2",
				metadata: {},
				text: "",
				schemaVersion: 1,
				contentHash: randomBytes(16).toString("hex"),
			});

			await store.createEntryWithReferences({
				snapshot: {
					collection: content,
					slug: "d1-ref",
					metadata: { [single.name]: "cat-meta", [many.name]: ["tag-meta1", "tag-meta2"] },
					doc: docOf("body"),
					schemaVersion: 1,
					contentHash: randomBytes(16).toString("hex"),
					references: [],
					issues: [],
				},
				references: [
					{ kind: "entry", targetId: targetCat.id, isStale: true, occurrences: [] },
					{ kind: "entry", targetId: targetTag2.id, isStale: true, occurrences: [] },
					{ kind: "entry", targetId: targetTag1.id, isStale: true, occurrences: [] },
				],
			});

			const histDate = "2019-01-01T00:00:00.000Z";
			const histE = await seedEntry(store, {
				collection: content,
				slug: "d1-hist",
				metadata: await metadataFor(content, "Historical date"),
				text: "body",
				schemaVersion: 1,
				contentHash: randomBytes(16).toString("hex"),
			});
			// If the publish date is set beforehand, like a migrated entry, it stays as is after publishing.
			await pool.query(`UPDATE "${schemaName}".entries SET published_at = $2 WHERE id = $1`, [histE.id, histDate]);
			await publishDraft(testSite, store, { id: histE.id, expectedVersion: histE.version });

			const noMetaE = await seedEntry(store, {
				collection: content,
				slug: "d1-nometa",
				metadata: await metadataFor(content, "No explicit published date"),
				text: "body",
				schemaVersion: 1,
				contentHash: randomBytes(16).toString("hex"),
			});
			const pubNoMetaE = await publishDraft(testSite, store, { id: noMetaE.id, expectedVersion: noMetaE.version });

			const list = await store.listEntries({ collection: content });

			const getBySlug = (s: string) => {
				const item = list.items.find((i) => i.slug === s);
				if (!item) throw new Error(`Missing ${s}`);
				return item;
			};

			const iDirect = getBySlug("d1-direct");
			const ids = (item: typeof iDirect, field: string) => item.relations[field]?.map((value) => value.id);
			expect(ids(iDirect, single.name)).toEqual(["cat-1"]);
			expect(ids(iDirect, many.name)).toEqual(["tag-a", "tag-b"]);
			expect(iDirect.publishedAt).toBeNull();

			const iRef = getBySlug("d1-ref");
			expect(ids(iRef, single.name)).toEqual(["cat-meta"]);
			expect(ids(iRef, many.name)).toEqual(["tag-meta1", "tag-meta2"]);
			expect(iRef.publishedAt).toBeNull();

			const iHist = getBySlug("d1-hist");
			expect(iHist.publishedAt?.toISOString()).toBe(histDate);

			const iNoMeta = getBySlug("d1-nometa");
			expect(iNoMeta.publishedAt).toBeInstanceOf(Date);
			expect(
				Math.abs((iNoMeta.publishedAt as Date).getTime() - (pubNoMetaE.publishedAt as Date).getTime()),
			).toBeLessThan(5000);

			for (const i of [iDirect, iRef, iHist, iNoMeta]) {
				expect("body" in i).toBe(false);
				expect("mdx" in i).toBe(false);
			}
		},
		60_000,
	);

	it("8. publishedAt sort and range use the published_at column; entries without it come last", async () => {
		const entry = async (slug: string, publishedAt?: string) => {
			const created = await seedEntry(store, {
				collection: content,
				slug,
				metadata: await metadataFor(content, slug),
				text: "body",
				schemaVersion: 1,
				contentHash: uniqueHash(),
			});
			if (publishedAt) {
				await pool.query(`UPDATE "${schemaName}".entries SET published_at = $2 WHERE id = $1`, [
					created.id,
					publishedAt,
				]);
			}
			return created;
		};
		// A draft with a preset publish date, like a migrated draft, also sorts by that date.
		await entry("d-2023", "2023-07-17T00:00:00.000+09:00");
		await entry("d-2025", "2025-06-07T00:00:00.000+09:00");
		await entry("d-2024", "2024-03-15T00:00:00.000+09:00");
		await entry("d-none");
		const published = await entry("p-now");
		await publishDraft(testSite, store, { id: published.id, expectedVersion: published.version });

		const order = async (direction: "asc" | "desc") =>
			(await store.listEntries({ collection: content, sort: { field: "publishedAt", direction } as never })).items.map(
				(item) => item.slug,
			);
		expect(await order("desc")).toEqual(["p-now", "d-2025", "d-2024", "d-2023", "d-none"]);
		expect(await order("asc")).toEqual(["d-2023", "d-2024", "d-2025", "p-now", "d-none"]);

		const inRange = await store.listEntries({
			collection: content,
			publishedAt: { from: new Date("2024-01-01T00:00:00Z"), to: new Date("2025-12-31T00:00:00Z") },
		} as never);
		expect(inRange.items.map((item) => item.slug).sort()).toEqual(["d-2024", "d-2025"]);
	}, 30_000);
});
