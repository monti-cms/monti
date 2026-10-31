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
	statuses?: readonly ("draft" | "published")[];
	folderId?: string | null;
	includeDescendants?: boolean;
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
	// 5  list input that is not on the list never reaches SQL
	// -----------------------------------------------------------------------

	it("API-G5 refuses a sort field, a sort direction or a status that is not on the list, and the tables are as they were", async () => {
		await seed(content, "le5-a", "A-title");
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
	});

	// -----------------------------------------------------------------------
	// 6  pagination: 26 entries, exact metadata, no dup/omission, reject bad
	// -----------------------------------------------------------------------

	it("LIST-S2 6. 26 entries pageSize=25: exact total/page metadata, no omission/duplicate, deterministic repeat; page<1 / invalid pageSize reject invalid_input", async () => {
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

});
