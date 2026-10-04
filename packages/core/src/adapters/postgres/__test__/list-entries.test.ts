import { randomBytes } from "node:crypto";
import { Pool } from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
	contentCollection,
	defaultLocale,
	otherContentCollection,
	requiredFields,
	requiredMetadata,
	secondLocale,
} from "../../../../test/any-site";
import { COLLECTIONS, type Collection, isItemCollection } from "../../../core/collections";
import { LOCALES } from "../../../core/locales";
import { recordLocalizedFields, storedField, storedFields } from "../../../schema/derive";
import type { Entry } from "../content-store";
import { CmsError, createContentStore, migrateContentStore } from "../content-store";
import { moveToFolder, seedEntry } from "./seed";

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

interface Folder {
	id: string;
	collection: string;
	parentId: string | null;
	name: string;
	position: number;
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
			mdx: string;
			schemaVersion: number;
			contentHash: string;
			references: unknown[];
			issues: unknown[];
		};
		references: unknown[];
	}): Promise<Entry>;
	createFolder(params: {
		collection: string;
		parentId: string | null;
		name: string;
		position?: number;
	}): Promise<Folder>;
}

// ---------------------------------------------------------------------------
// Collections and fields are looked up in the config (runs against both the reference blog config and other site configs, `test/any-site.ts`)
// ---------------------------------------------------------------------------

/** Document collection under test for lists (the reference blog's posts). */
const content = contentCollection;

type RelationInfo = { name: string; to: Collection; many: boolean };
/** A non-conditional relation field that points at an item collection. */
const itemRelations: RelationInfo[] = storedFields(content).flatMap(({ name, field, when }) =>
	!when && field.kind === "relation" && isItemCollection(field.to)
		? [{ name, to: field.to as Collection, many: Boolean(field.many) }]
		: [],
);
/** A single-select relation (the reference blog's category) and a multi-select relation (the reference blog's tags). */
const singleRelation = itemRelations.find((relation) => !relation.many);
const manyRelation = itemRelations.find((relation) => relation.many);
/** A relation required for publish, so the fixture always fills it (the reference blog's category). */
const filledRelation = requiredFields(content).flatMap(({ name, field }) =>
	field.kind === "relation" ? [{ name, to: field.to as Collection, many: Boolean(field.many) }] : [],
)[0];
/** Collection of the required relation's targets (the fixture creates items). */
const fixtureTargets = new Set(
	requiredFields(content).flatMap(({ field }) => (field.kind === "relation" ? [field.to as string] : [])),
);
/** For checking collection isolation: another collection for which the fixture creates no items (the reference blog's memos). */
const isolatedCollection =
	otherContentCollection ?? COLLECTIONS.find((name) => name !== content && !fixtureTargets.has(name));
/** Another collection without the required relation field (the reference blog's memos have no category). */
const collectionWithoutFilledRelation = filledRelation
	? COLLECTIONS.find((name) => name !== content && !storedField(name, filledRelation.name))
	: undefined;
/** Item collection whose name (`title`) is a per-language value (the reference blog's tags). */
const localizedRecordCollection = COLLECTIONS.find(
	(name) => isItemCollection(name) && recordLocalizedFields(name).includes("title"),
);
/** A language that is neither the default nor the second one (if any). An empty name is not included in the language list. */
const thirdLocale = LOCALES.find((code) => code !== defaultLocale && code !== secondLocale);
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

describe("listEntries contract", () => {
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
				mdx: "",
				schemaVersion: 1,
				contentHash: uniqueHash(),
			});
			return (await store.publishEntry({ id: draft.id, expectedVersion: draft.version })).id;
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
		await migrateContentStore(pool, { schema: schemaName });
		store = createContentStore(pool, { schema: schemaName }) as unknown as typeof store;
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
			mdx?: string;
		} = {},
	): Promise<Entry & { folderId?: string | null }> {
		const entry = await seedEntry(store, {
			collection,
			slug,
			metadata: await metadataFor(collection, title),
			mdx: opts.mdx ?? "default body",
			schemaVersion: 1,
			contentHash: uniqueHash(),
		});

		let current: Entry & { folderId?: string | null } = entry;

		if (opts.status === "published") {
			if (slug === null) {
				throw new Error("Cannot publish an entry with null slug in fixture");
			}
			current = await store.publishEntry({ id: entry.id, expectedVersion: current.version });
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
	// 1  exact item keys, default pagination, collection isolation
	// -----------------------------------------------------------------------

	it("1. exact item keys, default pagination, collection isolation", async () => {
		await seed(content, "le1a-slug", "Le1a Title");
		if (isolatedCollection) await seed(isolatedCollection, "le1b-slug", "Le1b Title");

		const res = await store.listEntries({ collection: content });
		// Every relation field has a value, and only the required relation filled by the fixture comes with its target title.
		const expectedRelations: Record<string, { id: string; title: string }[]> = {};
		for (const { name, field } of storedFields(content)) {
			if (field.kind !== "relation") continue;
			const filled = requiredFields(content).some((required) => required.name === name);
			const to = field.to as Collection;
			expectedRelations[name] = filled ? [{ id: await relationTarget(to), title: relationTargetTitle(to) }] : [];
		}

		// pagination defaults
		expect(res.page).toBe(1);
		expect(res.pageSize).toBe(25);
		expect(res.total).toBe(1);
		expect(res.items).toHaveLength(1);

		// objectContaining check
		const item = res.items[0];
		expect(item).toEqual(
			expect.objectContaining({
				id: expect.any(String),
				collection: content,
				title: "Le1a Title",
				slug: "le1a-slug",
				status: "draft",
				version: 1,
				folderId: null,
				relations: expectedRelations,
				publishedAt: null,
				createdAt: expect.any(Date),
				updatedAt: expect.any(Date),
			}),
		);
		expect("body" in item).toBe(false);
		expect("mdx" in item).toBe(false);

		// collection isolation: items of other collections are not mixed in
		if (!isolatedCollection) return;
		const res2 = await store.listEntries({ collection: isolatedCollection });
		expect(res2.total).toBe(1);
		expect(res2.items[0].collection).toBe(isolatedCollection);
	});

	it.skipIf(!filledRelation)("1b. relation filters accept only the collection's relation fields", async () => {
		const relation = filledRelation as RelationInfo;
		await seed(content, "le1b-slug", "Le1b Title");
		const targetId = await relationTarget(relation.to);
		const byTarget = await store.listEntries({ collection: content, relations: { [relation.name]: [targetId] } });
		expect(byTarget.items.map((item) => item.slug)).toContain("le1b-slug");
		const elsewhere = await store.listEntries({
			collection: content,
			relations: { [relation.name]: ["00000000-0000-4000-8000-000000000000"] },
		});
		expect(elsewhere.items.map((item) => item.slug)).not.toContain("le1b-slug");
		const invalid: Record<string, string[]>[] = [
			{ title: [targetId] },
			{ [(manyRelation ?? relation).name]: ["not-a-uuid"] },
		];
		for (const relations of invalid) {
			try {
				await store.listEntries({ collection: content, relations });
				throw new Error("expected invalid_input");
			} catch (err) {
				expectCmsError(err, "invalid_input");
			}
		}
		// That filter cannot be used on a collection without that relation field (the reference blog's memos have no category field).
		if (!collectionWithoutFilledRelation) return;
		await expect(
			store.listEntries({ collection: collectionWithoutFilledRelation, relations: { [relation.name]: [targetId] } }),
		).rejects.toMatchObject({ code: "invalid_input" });
	});

	// -----------------------------------------------------------------------
	// 2  Korean + Latin case-insensitive substring; body search gating
	// -----------------------------------------------------------------------

	it("2. Korean case-insensitive substring over title+slug; Latin case-insensitive; MDX body excluded by default, searched only with includeBody=true, but never adds body to output", async () => {
		await seed(content, "slug-한국어", "제목 테스트", {
			mdx: '본문 내용 <Hidden attr="secret" /> [Link](http://example.com/url)',
		});
		await seed(content, "le2-other", "Unrelated Alpha title % _", { mdx: "body with % and _ chars" });

		// title search (Korean)
		const byTitle = await store.listEntries({ collection: content, search: "제목" });
		expect(byTitle.items).toHaveLength(1);
		expect(byTitle.items[0].title).toBe("제목 테스트");

		// slug search (Korean)
		const bySlug = await store.listEntries({ collection: content, search: "한국어" });
		expect(bySlug.items).toHaveLength(1);
		expect(bySlug.items[0].slug).toBe("slug-한국어");

		// Latin case-insensitive: seed has "Alpha" in title, search "alpha" (lowercase)
		const byAlpha = await store.listEntries({ collection: content, search: "alpha" });
		expect(byAlpha.items).toHaveLength(1);
		expect(byAlpha.items[0].title).toBe("Unrelated Alpha title % _");

		// % and _ are literal
		const byPct = await store.listEntries({ collection: content, search: "%" });
		expect(byPct.items).toHaveLength(1);
		expect(byPct.items[0].slug).toBe("le2-other");

		// MDX syntax tokens should NOT match in body search
		const byAttr = await store.listEntries({ collection: content, search: "secret", includeBody: true });
		expect(byAttr.items).toHaveLength(0);
		const byUrl = await store.listEntries({ collection: content, search: "example", includeBody: true });
		expect(byUrl.items).toHaveLength(0);

		// body NOT searched by default
		const noBodySearch = await store.listEntries({ collection: content, search: "본문" });
		expect(noBodySearch.items).toHaveLength(0);

		// body IS searched with includeBody=true
		const withBody = await store.listEntries({ collection: content, search: "본문", includeBody: true });
		expect(withBody.items).toHaveLength(1);
		expect(withBody.items[0].slug).toBe("slug-한국어");

		// includeBody never adds a body field to output
		expect("body" in withBody.items[0]).toBe(false);
		expect("mdx" in withBody.items[0]).toBe(false);

		// Valid collection post plus SQL-looking malicious search string safely returns 0 items, proving parameterization
		const maliciousSearch = await store.listEntries({
			collection: content,
			search: "'; DROP TABLE entries;--",
		});
		expect(maliciousSearch.items).toHaveLength(0);

		// Malicious invalid collection string containing SQL text passed through intentional unknown cast => CmsError invalid_input
		let colErr: unknown;
		try {
			await store.listEntries({
				collection: "'; DROP TABLE entries;--" as unknown as string,
			});
		} catch (e) {
			colErr = e;
		}
		expectCmsError(colErr, "invalid_input");

		// Assert schema survives
		const afterTables = await pool.query(`SELECT tablename FROM pg_tables WHERE schemaname = $1 ORDER BY tablename`, [
			schemaName,
		]);
		expect(afterTables.rows.length).toBeGreaterThan(0);
	});

	it("2b. Visible body search: syntax-only needles/URL must not match; nested visible text/link label/fenced code must match", async () => {
		const slug = "d2-body-search";
		await seed(content, slug, "Body Search Title", {
			mdx: `
{/* SecretComment123 */}
export const meta = { val: "ExportedVar456" };
<div data-attr="before>AttrTail789">
  <span className="NestedClass">VisibleNestedText321</span>
</div>
[LinkLabel654](https://example.com/LinkUrl987)
\`\`\`js
console.log("FencedCode000");
\`\`\`
`,
		});

		const expectMatch = async (needle: string, shouldMatch: boolean, withBody: boolean) => {
			const res = await store.listEntries({ collection: content, search: needle, includeBody: withBody });
			const found = res.items.some((i) => i.slug === slug);
			expect(found).toBe(shouldMatch);
		};

		// Without includeBody, none should match
		await expectMatch("VisibleNestedText321", false, false);
		await expectMatch("LinkLabel654", false, false);

		// With includeBody=true
		await expectMatch("VisibleNestedText321", true, true);
		await expectMatch("LinkLabel654", true, true);
		await expectMatch("FencedCode000", true, true);

		// Must NOT match
		await expectMatch("SecretComment123", false, true);
		await expectMatch("ExportedVar456", false, true);
		await expectMatch("AttrTail789", false, true);
		await expectMatch("LinkUrl987", false, true);
	}, 15_000);

	// -----------------------------------------------------------------------
	// 2b  column header filters: title only / slug only, ANDed with search
	// -----------------------------------------------------------------------

	it("2b. titleContains matches only the title and slugContains only the slug; both AND with search", async () => {
		await seed(content, "alpha-slug", "베타 제목");
		await seed(content, "beta-slug", "알파 제목");

		const byTitle = await store.listEntries({ collection: content, titleContains: "베타" });
		expect(byTitle.items.map((item) => item.slug)).toEqual(["alpha-slug"]);

		const bySlug = await store.listEntries({ collection: content, slugContains: "beta" });
		expect(bySlug.items.map((item) => item.slug)).toEqual(["beta-slug"]);

		// The title filter does not look at the slug, and the slug filter does not look at the title.
		expect((await store.listEntries({ collection: content, titleContains: "slug" })).items).toHaveLength(0);
		expect((await store.listEntries({ collection: content, slugContains: "제목" })).items).toHaveLength(0);

		const anded = await store.listEntries({ collection: content, search: "알파", slugContains: "alpha" });
		expect(anded.items).toHaveLength(0);

		const literal = await store.listEntries({ collection: content, titleContains: "%" });
		expect(literal.items).toHaveLength(0);
	});

	// -----------------------------------------------------------------------
	// 3  status filter; folder undefined/null/direct/descendants
	// -----------------------------------------------------------------------

	it("3. draft/published status filter; folder undefined=all, null=unfiled, folderId=direct, includeDescendants", async () => {
		const f3a = await store.createFolder({ collection: content, parentId: null, name: "F3a" });
		const f3b = await store.createFolder({ collection: content, parentId: f3a.id, name: "F3b" });

		await seed(content, "le3-unfiled", "unfiled draft");
		await seed(content, "le3-pub-f3a", "pub in f3a", { status: "published", folderId: f3a.id });
		await seed(content, "le3-pub-f3b", "pub in f3b", { status: "published", folderId: f3b.id });

		// status filtering
		const drafts = await store.listEntries({ collection: content, statuses: ["draft"] });
		expect(drafts.items.map((i) => i.slug)).toEqual(["le3-unfiled"]);

		const pubs = await store.listEntries({ collection: content, statuses: ["published"] });
		expect(pubs.items.map((i) => i.slug).sort()).toEqual(["le3-pub-f3a", "le3-pub-f3b"]);

		// multiple statuses
		const both = await store.listEntries({ collection: content, statuses: ["draft", "published"] });
		expect(both.items).toHaveLength(3);

		// folderId undefined → all
		const all = await store.listEntries({ collection: content });
		expect(all.items).toHaveLength(3);

		// folderId null → unfiled
		const unfiled = await store.listEntries({ collection: content, folderId: null });
		expect(unfiled.items.map((i) => i.slug)).toEqual(["le3-unfiled"]);

		// direct folder
		const direct = await store.listEntries({ collection: content, folderId: f3a.id, includeDescendants: false });
		expect(direct.items.map((i) => i.slug)).toEqual(["le3-pub-f3a"]);

		// descendants
		const desc = await store.listEntries({ collection: content, folderId: f3a.id, includeDescendants: true });
		expect(desc.items.map((i) => i.slug).sort()).toEqual(["le3-pub-f3a", "le3-pub-f3b"]);
	}, 60_000);

	// -----------------------------------------------------------------------
	// 4  AND vs OR across status+folder; collection is mandatory; supplied search is ANDed
	// -----------------------------------------------------------------------

	it("4. predicates are AND, multiple statuses are OR; collection is mandatory; when search is supplied it remains AND with other predicates", async () => {
		const f4 = await store.createFolder({ collection: content, parentId: null, name: "F4" });

		// Fixture names chosen so none contains a substring of another:
		// "alpha" is unique, "zeta" is unique
		await seed(content, "le4-df", "alpha draft in folder", { status: "draft", folderId: f4.id });
		await seed(content, "le4-pf", "alpha pub in folder", { status: "published", folderId: f4.id });
		await seed(content, "le4-du", "alpha draft unfiled", { status: "draft" });
		await seed(content, "le4-zeta", "zeta draft in folder", { status: "draft", folderId: f4.id });

		// Predicates AND, multiple statuses OR:
		// (draft OR published) AND folder=F4 AND search="alpha"
		const res = await store.listEntries({
			collection: content,
			search: "alpha",
			statuses: ["draft", "published"],
			folderId: f4.id,
		});
		const resSlugs = res.items.map((i) => i.slug).sort();
		expect(resSlugs).toEqual(["le4-df", "le4-pf"]);
	}, 30_000);

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
				mdx: "body",
				schemaVersion: 1,
				contentHash: randomBytes(16).toString("hex"),
			});

			const targetCat = await seedEntry(store, {
				collection: single.to,
				slug: "cat-real",
				metadata: {},
				mdx: "",
				schemaVersion: 1,
				contentHash: randomBytes(16).toString("hex"),
			});
			const targetTag1 = await seedEntry(store, {
				collection: many.to,
				slug: "tag-real1",
				metadata: {},
				mdx: "",
				schemaVersion: 1,
				contentHash: randomBytes(16).toString("hex"),
			});
			const targetTag2 = await seedEntry(store, {
				collection: many.to,
				slug: "tag-real2",
				metadata: {},
				mdx: "",
				schemaVersion: 1,
				contentHash: randomBytes(16).toString("hex"),
			});

			await store.createEntryWithReferences({
				snapshot: {
					collection: content,
					slug: "d1-ref",
					metadata: { [single.name]: "cat-meta", [many.name]: ["tag-meta1", "tag-meta2"] },
					mdx: "body",
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
				mdx: "body",
				schemaVersion: 1,
				contentHash: randomBytes(16).toString("hex"),
			});
			// If the publish date is set beforehand, like a migrated entry, it stays as is after publishing.
			await pool.query(`UPDATE "${schemaName}".entries SET published_at = $2 WHERE id = $1`, [histE.id, histDate]);
			await store.publishEntry({ id: histE.id, expectedVersion: histE.version });

			const noMetaE = await seedEntry(store, {
				collection: content,
				slug: "d1-nometa",
				metadata: await metadataFor(content, "No explicit published date"),
				mdx: "body",
				schemaVersion: 1,
				contentHash: randomBytes(16).toString("hex"),
			});
			const pubNoMetaE = await store.publishEntry({ id: noMetaE.id, expectedVersion: noMetaE.version });

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

	it.skipIf(!manyRelation)(
		"resolves tag names in metadata order without changing tag IDs",
		async () => {
			const many = manyRelation as RelationInfo;
			const firstTag = await seedEntry(store, {
				collection: many.to,
				slug: "first-tag",
				metadata: { title: "First tag" },
				mdx: "",
				schemaVersion: 1,
				contentHash: uniqueHash(),
			});
			const secondTag = await seedEntry(store, {
				collection: many.to,
				slug: "second-tag",
				metadata: { title: "Second tag" },
				mdx: "",
				schemaVersion: 1,
				contentHash: uniqueHash(),
			});
			const post = await seedEntry(store, {
				collection: content,
				slug: "tagged-post",
				metadata: { title: "Tagged", [many.name]: [secondTag.id, firstTag.id] },
				mdx: "body",
				schemaVersion: 1,
				contentHash: uniqueHash(),
			});

			const result = await store.listEntries({ collection: content });
			const item = result.items.find((entry) => entry.id === post.id);
			expect(item?.relations[many.name]).toEqual([
				{ id: secondTag.id, title: "Second tag" },
				{ id: firstTag.id, title: "First tag" },
			]);
		},
		30_000,
	);

	/** Text and select fields (other than the title). These supply the values of list cells. */
	const plainField = storedFields(content).find(
		({ name, field, when }) => !when && name !== "title" && (field.kind === "select" || field.kind === "text"),
	);

	it.skipIf(!plainField)(
		"lists the stored text of text and select fields as `values` (empty values are left out)",
		async () => {
			const stored = plainField as NonNullable<typeof plainField>;
			const value = stored.field.kind === "select" ? (Object.keys(stored.field.options)[0] ?? "x") : "plain value";
			const filled = await seedEntry(store, {
				collection: content,
				slug: "values-filled",
				metadata: { title: "Has values", [stored.name]: value },
				mdx: "body",
				schemaVersion: 1,
				contentHash: uniqueHash(),
			});
			const empty = await seedEntry(store, {
				collection: content,
				slug: "values-empty",
				metadata: { title: "No values", [stored.name]: "" },
				mdx: "body",
				schemaVersion: 1,
				contentHash: uniqueHash(),
			});
			const result = await store.listEntries({ collection: content });
			const values = (id: string) => result.items.find((entry) => entry.id === id)?.values;
			expect(values(filled.id)).toMatchObject({ title: "Has values", [stored.name]: value });
			expect(values(empty.id)).toEqual({ title: "No values" });
		},
		30_000,
	);

	it("8. publishedAt sort and range use the published_at column; entries without it come last", async () => {
		const entry = async (slug: string, publishedAt?: string) => {
			const created = await seedEntry(store, {
				collection: content,
				slug,
				metadata: await metadataFor(content, slug),
				mdx: "body",
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
		await store.publishEntry({ id: published.id, expectedVersion: published.version });

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

	// Requires an item collection with per-language names and a second language.
	it.skipIf(!secondLocale || !localizedRecordCollection)(
		"9. record collections list the locales that have a name (the default locale is the record's own title)",
		async () => {
			const records = localizedRecordCollection as Collection;
			const translations: Record<string, { title: string }> = { [secondLocale as string]: { title: "React" } };
			if (thirdLocale) translations[thirdLocale] = { title: " " };
			const named = await seedEntry(store, {
				collection: records,
				slug: "tag-react",
				metadata: { title: "리액트", translations },
				mdx: "",
				schemaVersion: 1,
				contentHash: uniqueHash(),
			});
			const plain = await seedEntry(store, {
				collection: records,
				slug: "tag-plain",
				metadata: { title: "그냥" },
				mdx: "",
				schemaVersion: 1,
				contentHash: uniqueHash(),
			});
			const { items } = await store.listEntries({ collection: records });
			const localesOf = (id: string) =>
				(items.find((item) => item.id === id) as { recordLocales?: string[] })?.recordLocales;
			expect(localesOf(named.id)).toEqual(LOCALES.filter((code) => code === defaultLocale || code === secondLocale));
			expect(localesOf(plain.id)).toEqual([defaultLocale]);

			const posts = await store.listEntries({ collection: content });
			expect(posts.items.every((item) => !("recordLocales" in item))).toBe(true);
		},
		30_000,
	);
});
