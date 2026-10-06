import { randomBytes } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
	contentCollection,
	defaultLocale,
	otherContentCollection,
	requiredFields,
	requiredMetadata,
	secondLocale,
} from "../../../../../test/any-site";
import { recordLocalizedFields, storedField, storedFields } from "../../../../schema/derive";
import { COLLECTIONS, type Collection, isItemCollection } from "../../../collections";
import { LOCALES } from "../../../locales";
import { CmsError, type ContentStore, type Entry } from "../..";
import { moveToFolder, publishDraft, seedEntry } from "../seed";
import type { ContractSuite, StoreSession } from "./harness";

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
/** A multi-select relation (the reference blog's tags). */
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

/** Contract of ListStore. */
export const listContract: ContractSuite = (factory) => {
	// Every test counts the rows it lists, so each one gets an empty store of its own.
	describe("ListStore: listEntries", () => {
		let session: StoreSession;
		let store: ContentStore;
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
				return (await publishDraft(store, { id: draft.id, expectedVersion: draft.version })).id;
			})();
			relationTargets.set(to, created);
			return created;
		};

		/** Metadata with the required-for-publish values filled in (such as the reference blog's category). The title is kept as given (including `null`). */
		const metadataFor = async (collection: string, title: string | null) => ({
			...(await requiredMetadata(collection as Collection, title ?? "", relationTarget)),
			title,
		});

		beforeEach(async () => {
			session = await factory.create();
			store = session.store;
			relationTargets = new Map();
		});

		afterEach(async () => {
			await session.close();
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
				current = await publishDraft(store, { id: entry.id, expectedVersion: current.version });
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

			// Assert the store survives: the entries seeded above are still listed
			const afterMalicious = await store.listEntries({ collection: content });
			expect(afterMalicious.items.map((item) => item.slug).sort()).toEqual(["le2-other", "slug-한국어"]);
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
};
