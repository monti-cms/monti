import { randomBytes } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
	contentCollection,
	defaultLocale,
	otherContentCollection,
	recordCollection,
	requiredFields,
	requiredMetadata,
	secondLocale,
} from "../../../../../test/any-site";
import { testSite } from "../../../../../test/site";
import { docOf } from "../../../../../test/stored-content";
import { STORED_DOCUMENT_VERSION, type StoredDocument } from "../../../../doc/stored-document";
import { isRequiredField } from "../../../../schema/fields";
import type { Collection } from "../../../collections";
import { CmsError, type ContentStore, type Entry } from "../..";
import { moveToFolder, publishDraft, seedEntry, seedSave } from "../seed";
import type { ContractSuite, StoreSession } from "./harness";

// ---------------------------------------------------------------------------
// Collections and fields are looked up in the config (runs against both the reference blog config and other site configs, `test/any-site.ts`)
// ---------------------------------------------------------------------------

/** A block of the site's own, given an attribute its definition does not declare: text a reader never sees. */
const hiddenAttrBlock = (() => {
	const found = testSite.ADDED_BLOCKS.find((block) => block.syntax.kind !== "text" && !("attr" in block.attributes));
	if (!found) throw new Error("list contract: the config has no block of its own");
	return found.name;
})();

/** A body of the text (read by the test reader) followed by a block whose attributes carry text a reader never sees. */
const withHidden = (text: string): StoredDocument => ({
	type: "doc",
	version: STORED_DOCUMENT_VERSION,
	content: [...docOf(text).content, { type: hiddenAttrBlock, attrs: { attr: "secret HiddenAttr789" }, content: [] }],
});

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
	otherContentCollection ?? testSite.COLLECTIONS.find((name) => name !== content && !fixtureTargets.has(name));
/** Another collection without the required relation field (the reference blog's memos have no category). */
const collectionWithoutFilledRelation = filledRelation
	? testSite.COLLECTIONS.find((name) => name !== content && !testSite.storedField(name, filledRelation.name))
	: undefined;
/** Item collection whose name (`title`) is a per-language value (the reference blog's tags). */
const localizedRecordCollection = testSite.COLLECTIONS.find(
	(name) => testSite.isItemCollection(name) && testSite.recordLocalizedFields(name).includes("title"),
);
/** A language that is neither the default nor the second one (if any). An empty name is not included in the language list. */
const thirdLocale = testSite.LOCALES.find((code) => code !== defaultLocale && code !== secondLocale);
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
				text?: string;
				doc?: StoredDocument;
			} = {},
		): Promise<Entry & { folderId?: string | null }> {
			const entry = await seedEntry(store, {
				collection,
				slug,
				metadata: await metadataFor(collection, title),
				text: opts.text ?? "default body",
				doc: opts.doc,
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
		// 1  exact item keys, default pagination, collection isolation
		// -----------------------------------------------------------------------

		it("LIST-S2 1. exact item keys, default pagination, collection isolation", async () => {
			await seed(content, "le1a-slug", "Le1a Title");
			if (isolatedCollection) await seed(isolatedCollection, "le1b-slug", "Le1b Title");

			const res = await store.listEntries({ collection: content });
			// Every relation field has a value, and only the required relation filled by the fixture comes with its target title.
			const expectedRelations: Record<string, { id: string; title: string }[]> = {};
			for (const { name, field } of testSite.storedFields(content)) {
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

		/** One item of an item collection, under its own name (a tag). */
		const makeItem = async (to: Collection, name: string): Promise<string> =>
			(
				await seedEntry(store, {
					collection: to,
					slug: `item-${name}`,
					metadata: await requiredMetadata(to, name, relationTarget),
					text: "",
					contentHash: uniqueHash(),
				})
			).id;

		/** Saves a changed draft of an entry, which for a published entry is a change not yet published. */
		const changeDraft = async (entry: Entry, title: string) =>
			seedSave(store, entry.id, {
				metadata: await metadataFor(content, title),
				text: `${title} body`,
				contentHash: uniqueHash(),
				expectedVersion: entry.version,
			});

		/** A post of the content collection with these values on top of the required ones. */
		const seedWith = async (slug: string, extra: Record<string, unknown>) =>
			seedEntry(store, {
				collection: content,
				slug,
				metadata: { ...(await metadataFor(content, slug)), ...extra },
				text: "body",
				contentHash: uniqueHash(),
			});

		const slugsOf = async (fields: NonNullable<Parameters<ContentStore["listEntries"]>[0]["fields"]>) =>
			(await store.listEntries({ collection: content, fields, pageSize: 100 })).items.map((item) => item.slug).sort();

		describe.skipIf(!manyRelation)("field conditions on a relation that holds many", () => {
			const field = () => (manyRelation as RelationInfo).name;
			const seedTagged = async () => {
				const tagA = await makeItem((manyRelation as RelationInfo).to, "a");
				const tagB = await makeItem((manyRelation as RelationInfo).to, "b");
				await seedWith("fc-a", { [field()]: [tagA] });
				await seedWith("fc-ab", { [field()]: [tagA, tagB] });
				await seedWith("fc-none", { [field()]: [] });
				return { tagA, tagB };
			};

			it("LIST-F2 is finds the rows that hold the item, and empty the rows that hold none", async () => {
				const { tagA, tagB } = await seedTagged();
				expect(await slugsOf({ [field()]: [{ kind: "is", value: tagA }] })).toEqual(["fc-a", "fc-ab"]);
				expect(await slugsOf({ [field()]: [{ kind: "is", value: tagB }] })).toEqual(["fc-ab"]);
				expect(await slugsOf({ [field()]: [{ kind: "empty" }] })).toEqual(["fc-none"]);
			});

			it("LIST-F2 takes several conditions on one field as OR", async () => {
				const { tagA, tagB } = await seedTagged();
				expect(await slugsOf({ [field()]: [{ kind: "empty" }, { kind: "is", value: tagB }] })).toEqual([
					"fc-ab",
					"fc-none",
				]);
				expect(
					await slugsOf({
						[field()]: [
							{ kind: "is", value: tagA },
							{ kind: "is", value: tagB },
						],
					}),
				).toEqual(["fc-a", "fc-ab"]);
			});

			it("LIST-F2 takes conditions on different fields as AND", async () => {
				const { tagB } = await seedTagged();
				const other = filledRelation && filledRelation.name !== field() ? filledRelation : undefined;
				if (!other) return;
				const targetId = await relationTarget(other.to);
				expect(
					await slugsOf({ [field()]: [{ kind: "is", value: tagB }], [other.name]: [{ kind: "is", value: targetId }] }),
				).toEqual(["fc-ab"]);
				expect(await slugsOf({ [field()]: [{ kind: "empty" }], [other.name]: [{ kind: "empty" }] })).toEqual([]);
			});
		});

		it.skipIf(!filledRelation)(
			"LIST-F2 a relation of one item: is finds the item, empty finds a row without it",
			async () => {
				const relation = filledRelation as RelationInfo;
				const targetId = await relationTarget(relation.to);
				await seed(content, "fc-single", "Single");
				expect(await slugsOf({ [relation.name]: [{ kind: "is", value: targetId }] })).toContain("fc-single");
				expect(
					await slugsOf({ [relation.name]: [{ kind: "is", value: "00000000-0000-4000-8000-000000000000" }] }),
				).toEqual([]);
				expect(await slugsOf({ [relation.name]: [{ kind: "empty" }] })).not.toContain("fc-single");
			},
		);

		const textField = testSite.storedFields(content).find(({ field, when, name }) => {
			return !when && field.kind === "text" && name !== "title" && !isRequiredField(field);
		});
		it.skipIf(!textField)("LIST-F2 a text field: filled finds a row with text, empty one without", async () => {
			const name = (textField as { name: string }).name;
			await seedWith("fc-text", { [name]: "Something to say" });
			await seedWith("fc-blank", { [name]: "" });
			await seedWith("fc-unset", {});
			expect(await slugsOf({ [name]: [{ kind: "filled" }] })).toEqual(["fc-text"]);
			expect(await slugsOf({ [name]: [{ kind: "empty" }] })).toEqual(["fc-blank", "fc-unset"]);
		});

		const selectField = testSite.storedFields(content).find(({ field, when }) => !when && field.kind === "select");
		it.skipIf(!selectField)("LIST-F2 a select: is finds the option, empty a row with none chosen", async () => {
			const { name, field } = selectField as { name: string; field: { options: Record<string, string> } };
			const [first, second] = Object.keys(field.options);
			await seedWith("fc-first", { [name]: first });
			await seedWith("fc-second", { [name]: second ?? first });
			await seedWith("fc-chosen-none", {});
			expect(await slugsOf({ [name]: [{ kind: "is", value: first as string }] })).toContain("fc-first");
			expect(await slugsOf({ [name]: [{ kind: "is", value: first as string }] })).not.toContain("fc-chosen-none");
			expect(await slugsOf({ [name]: [{ kind: "empty" }] })).toContain("fc-chosen-none");
			expect(await slugsOf({ [name]: [{ kind: "empty" }] })).not.toContain("fc-first");
		});

		const mediaField = testSite.storedFields(content).find(({ field, when }) => !when && field.kind === "media");
		it.skipIf(!mediaField)(
			"LIST-F2 a media field: filled finds a row that has a file, empty one that has none",
			async () => {
				const name = (mediaField as { name: string }).name;
				await seedWith("fc-media", { [name]: "5c1e7a8e-2d0b-4f4b-9d57-3f6a1b9a0c11" });
				await seedWith("fc-no-media", {});
				expect(await slugsOf({ [name]: [{ kind: "filled" }] })).toEqual(["fc-media"]);
				expect(await slugsOf({ [name]: [{ kind: "empty" }] })).toContain("fc-no-media");
				expect(await slugsOf({ [name]: [{ kind: "empty" }] })).not.toContain("fc-media");
			},
		);

		it("LIST-F2 refuses a condition the field's kind does not take, and a field that is not there", async () => {
			const targetId = filledRelation ? await relationTarget(filledRelation.to) : "";
			const invalid: Record<string, { kind: "empty" } | { kind: "filled" } | { kind: "is"; value: string }>[] = [
				// Nothing named so.
				{ noSuchField: { kind: "empty" } },
				// A title is text: it is not picked from a list.
				{ title: { kind: "is", value: "x" } },
				...(filledRelation
					? [
							// A relation has no "filled", and its item is an id.
							{ [filledRelation.name]: { kind: "filled" as const } },
							{ [filledRelation.name]: { kind: "is" as const, value: "not-a-uuid" } },
						]
					: []),
				...(selectField ? [{ [selectField.name]: { kind: "filled" as const } }] : []),
			];
			for (const [name, condition] of invalid.flatMap((entry) => Object.entries(entry))) {
				await expect(store.listEntries({ collection: content, fields: { [name]: [condition] } })).rejects.toMatchObject(
					{
						code: "invalid_input",
					},
				);
			}
			if (!collectionWithoutFilledRelation || !filledRelation) return;
			// That filter cannot be used on a collection without that relation field (the reference blog's memos have no category field).
			await expect(
				store.listEntries({
					collection: collectionWithoutFilledRelation,
					fields: { [filledRelation.name]: [{ kind: "is", value: targetId }] },
				}),
			).rejects.toMatchObject({ code: "invalid_input" });
		});

		describe("countListValues: the numbers beside the filter menu's values", () => {
			it.skipIf(!manyRelation)(
				"LIST-F3 counts the rows of each item of a relation, and the rows with none",
				async () => {
					const many = manyRelation as RelationInfo;
					const tagA = await makeItem(many.to, "a");
					const tagB = await makeItem(many.to, "b");
					await seedWith("cv-a", { [many.name]: [tagA] });
					await seedWith("cv-ab", { [many.name]: [tagA, tagB] });
					await seedWith("cv-none", { [many.name]: [] });
					const counts = await store.countListValues({ collection: content, facet: { field: many.name } });
					expect(counts.total).toBe(3);
					expect(counts.empty).toBe(1);
					expect(counts.values).toEqual({ [tagA]: 2, [tagB]: 1 });
				},
			);

			it("LIST-F3 counts the rows of the folder, and no others", async () => {
				const folder = await store.createFolder({ collection: content, parentId: null, name: "Counted" });
				await seed(content, "cv-in", "In folder", { folderId: folder.id });
				await seed(content, "cv-in-published", "Published in folder", { folderId: folder.id, status: "published" });
				await seed(content, "cv-out", "Out of folder");
				const facet = { field: "title" } as const;
				expect((await store.countListValues({ collection: content, facet, folderId: folder.id })).total).toBe(2);
				expect((await store.countListValues({ collection: content, facet, folderId: null })).total).toBe(1);
				expect((await store.countListValues({ collection: content, facet })).total).toBe(3);
			});

			it("LIST-F3 counts the rows in each state of the status column, which add up to the rows in scope", async () => {
				await seed(content, "cs-draft", "Draft");
				await seed(content, "cs-live", "Live", { status: "published" });
				const editing = await seed(content, "cs-editing", "Editing", { status: "published" });
				await changeDraft(editing, "Editing again");
				const archived = await seed(content, "cs-archived", "Archived", { status: "published" });
				await store.archiveEntry({ id: archived.id, expectedVersion: archived.version });
				const counts = await store.countListValues({ collection: content, facet: "status" });
				expect(counts.values).toEqual({ published: 1, editing: 1, draft: 1, archived: 1 });
				expect(counts.total).toBe(4);
			});

			it.skipIf(!textField)("LIST-F3 counts a text field as empty and filled", async () => {
				const name = (textField as { name: string }).name;
				await seedWith("cv-text", { [name]: "Words" });
				await seedWith("cv-blank", { [name]: "" });
				await seedWith("cv-unset", {});
				const counts = await store.countListValues({ collection: content, facet: { field: name } });
				expect(counts).toMatchObject({ total: 3, empty: 2, filled: 1 });
			});

			it.skipIf(!selectField)("LIST-F3 counts a select per option", async () => {
				const { name, field } = selectField as { name: string; field: { options: Record<string, string> } };
				const [first] = Object.keys(field.options) as [string];
				await seedWith("cv-first", { [name]: first });
				await seedWith("cv-first-too", { [name]: first });
				await seedWith("cv-unchosen", {});
				const counts = await store.countListValues({ collection: content, facet: { field: name } });
				expect(counts.values[first]).toBe(2);
				expect(counts.empty).toBe(1);
			});

			it("LIST-F3 refuses a field that is not there, and the translation filter of a collection without translations", async () => {
				await expect(
					store.countListValues({ collection: content, facet: { field: "noSuchField" } }),
				).rejects.toMatchObject({ code: "invalid_input" });
				await expect(
					store.countListValues({ collection: recordCollection, facet: "translation" }),
				).rejects.toMatchObject({ code: "invalid_input" });
			});
		});

		// -----------------------------------------------------------------------
		// 2  Korean + Latin case-insensitive substring; body search gating
		// -----------------------------------------------------------------------

		it("LIST-F1 2. Korean case-insensitive substring over title+slug; Latin case-insensitive; body excluded by default, searched only with includeBody=true, but never adds body to output", async () => {
			await seed(content, "slug-한국어", "제목 테스트", {
				doc: withHidden("본문 내용 [Link](http://example.com/url)"),
			});
			await seed(content, "le2-other", "Unrelated Alpha title % _", { text: "body with % and _ chars" });

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

		it("LIST-F1 2a. Search matches word by word: every word must be found, in any order and in different places", async () => {
			await seed(content, "wm-launch-notes", "Spring Launch Plan", { text: "budget and timeline for the campaign" });
			await seed(content, "wm-other", "Autumn Plan", { text: "nothing about the spring" });
			const slugsOf = async (search: string, includeBody = false) =>
				(await store.listEntries({ collection: content, search, includeBody })).items.map((item) => item.slug).sort();

			// Words in the title, in any order
			expect(await slugsOf("plan spring")).toEqual(["wm-launch-notes"]);
			// One word in the title and one in the slug
			expect(await slugsOf("spring notes")).toEqual(["wm-launch-notes"]);
			// A word that is missing anywhere rules the entry out
			expect(await slugsOf("spring budget")).toEqual([]);
			// The body is searched only with includeBody, word by word as well
			expect(await slugsOf("spring budget", true)).toEqual(["wm-launch-notes"]);
			expect(await slugsOf("plan campaign", true)).toEqual(["wm-launch-notes"]);
			// A single word and the surrounding spaces behave as before
			expect(await slugsOf("  plan  ")).toEqual(["wm-launch-notes", "wm-other"]);
			// Only spaces is no search
			expect(await slugsOf("   ")).toEqual(["wm-launch-notes", "wm-other"]);
		});

		it("LIST-F1 2b. Visible body search: link addresses and block attributes must not match; visible text, link labels and fenced code must match", async () => {
			const slug = "d2-body-search";
			await seed(content, slug, "Body Search Title", {
				doc: withHidden(
					'VisibleNestedText321\n\n[LinkLabel654](https://example.com/LinkUrl987)\n\n```js\nconsole.log("FencedCode000");\n```',
				),
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

			// Must NOT match: what a reader does not see (a link's address, the attributes of a block)
			await expectMatch("HiddenAttr789", false, true);
			await expectMatch("LinkUrl987", false, true);
		}, 15_000);

		// -----------------------------------------------------------------------
		// 3  status filter; folder undefined/null/direct/descendants
		// -----------------------------------------------------------------------

		it("LIST-F6 3. draft/published status filter; folder undefined=all, null=unfiled, folderId=direct, includeDescendants", async () => {
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

		it("LIST-F2 the status filter tells the four states apart, and several are OR", async () => {
			await seed(content, "st-draft", "Draft");
			await seed(content, "st-live", "Live", { status: "published" });
			const editing = await seed(content, "st-editing", "Editing", { status: "published" });
			await changeDraft(editing, "Editing again");
			const archived = await seed(content, "st-archived", "Archived", { status: "published" });
			await store.archiveEntry({ id: archived.id, expectedVersion: archived.version });

			const slugsOfStatuses = async (statuses: NonNullable<Parameters<ContentStore["listEntries"]>[0]["statuses"]>) =>
				(await store.listEntries({ collection: content, statuses })).items.map((item) => item.slug).sort();
			// `published` has no unpublished changes, `editing` has: each state is only its own rows.
			expect(await slugsOfStatuses(["published"])).toEqual(["st-live"]);
			expect(await slugsOfStatuses(["editing"])).toEqual(["st-editing"]);
			expect(await slugsOfStatuses(["draft"])).toEqual(["st-draft"]);
			expect(await slugsOfStatuses(["archived"])).toEqual(["st-archived"]);
			// Several are OR.
			expect(await slugsOfStatuses(["published", "editing"])).toEqual(["st-editing", "st-live"]);
			expect(await slugsOfStatuses(["editing", "draft", "archived"])).toEqual([
				"st-archived",
				"st-draft",
				"st-editing",
			]);
			// None asked for is everything but the trash.
			expect((await store.listEntries({ collection: content })).total).toBe(4);
		}, 60_000);

		it("TRASH-B2 sorts the trash by the day its entries were trashed, the last one first", async () => {
			const first = await seed(content, "tr-first", "Trashed first");
			const second = await seed(content, "tr-second", "Trashed second");
			await seed(content, "tr-kept", "Kept");
			await store.trashEntry({ id: first.id, expectedVersion: first.version });
			// `deleted_at` is the transaction's `now()`: a later transaction is later.
			await store.trashEntry({ id: second.id, expectedVersion: second.version });
			const trash = (direction: "asc" | "desc") =>
				store
					.listEntries({ collection: content, statuses: ["trashed"], sort: { field: "deletedAt", direction } })
					.then((result) => result.items.map((item) => item.slug));
			expect(await trash("desc")).toEqual(["tr-second", "tr-first"]);
			expect(await trash("asc")).toEqual(["tr-first", "tr-second"]);
		});

		// -----------------------------------------------------------------------
		// 4  AND vs OR across status+folder; collection is mandatory; supplied search is ANDed
		// -----------------------------------------------------------------------

		it("LIST-F2 4. predicates are AND, multiple statuses are OR; collection is mandatory; when search is supplied it remains AND with other predicates", async () => {
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
			"LIST-S3 resolves tag names in metadata order without changing tag IDs",
			async () => {
				const many = manyRelation as RelationInfo;
				const firstTag = await seedEntry(store, {
					collection: many.to,
					slug: "first-tag",
					metadata: { title: "First tag" },
					text: "",
					contentHash: uniqueHash(),
				});
				const secondTag = await seedEntry(store, {
					collection: many.to,
					slug: "second-tag",
					metadata: { title: "Second tag" },
					text: "",
					contentHash: uniqueHash(),
				});
				const post = await seedEntry(store, {
					collection: content,
					slug: "tagged-post",
					metadata: { title: "Tagged", [many.name]: [secondTag.id, firstTag.id] },
					text: "body",
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
		const plainField = testSite
			.storedFields(content)
			.find(({ name, field, when }) => !when && name !== "title" && (field.kind === "select" || field.kind === "text"));

		it.skipIf(!plainField)(
			"LIST-S3 lists the stored text of text and select fields as `values` (empty values are left out)",
			async () => {
				const stored = plainField as NonNullable<typeof plainField>;
				const value = stored.field.kind === "select" ? (Object.keys(stored.field.options)[0] ?? "x") : "plain value";
				const filled = await seedEntry(store, {
					collection: content,
					slug: "values-filled",
					metadata: { title: "Has values", [stored.name]: value },
					text: "body",
					contentHash: uniqueHash(),
				});
				const empty = await seedEntry(store, {
					collection: content,
					slug: "values-empty",
					metadata: { title: "No values", [stored.name]: "" },
					text: "body",
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
			"LIST-S3 9. record collections list the locales that have a name (the default locale is the record's own title)",
			async () => {
				const records = localizedRecordCollection as Collection;
				const translations: Record<string, { title: string }> = { [secondLocale as string]: { title: "React" } };
				if (thirdLocale) translations[thirdLocale] = { title: " " };
				const named = await seedEntry(store, {
					collection: records,
					slug: "tag-react",
					metadata: { title: "리액트", translations },
					text: "",
					contentHash: uniqueHash(),
				});
				const plain = await seedEntry(store, {
					collection: records,
					slug: "tag-plain",
					metadata: { title: "그냥" },
					text: "",
					contentHash: uniqueHash(),
				});
				const { items } = await store.listEntries({ collection: records });
				const localesOf = (id: string) =>
					(items.find((item) => item.id === id) as { recordLocales?: string[] })?.recordLocales;
				expect(localesOf(named.id)).toEqual(
					testSite.LOCALES.filter((code) => code === defaultLocale || code === secondLocale),
				);
				expect(localesOf(plain.id)).toEqual([defaultLocale]);

				const posts = await store.listEntries({ collection: content });
				expect(posts.items.every((item) => !("recordLocales" in item))).toBe(true);
			},
			30_000,
		);

		// -----------------------------------------------------------------------
		// searchEntries: the picker search
		// -----------------------------------------------------------------------

		describe("searchEntries", () => {
			const titles = (hits: readonly { title: string | null }[]) => hits.map((hit) => hit.title);

			it("LIST-F7 ranks a title equal to the query, then a prefix, a word start, a contains, and a slug match, ignoring case", async () => {
				await seed(content, "s-contains", "The Roadmap");
				await seed(content, "s-word", "My road trip");
				await seed(content, "s-prefix", "Roadside");
				await seed(content, "s-exact", "road");
				await seed(content, "road-slug", "Something else");
				await seed(content, "s-none", "Unrelated");
				const hits = await store.searchEntries({ collection: content, query: "ROAD" });
				expect(titles(hits)).toEqual(["road", "Roadside", "My road trip", "The Roadmap", "Something else"]);
			});

			it("LIST-F7 answers title, slug and status, and the slug as the title of an entry without one", async () => {
				const published = await seed(content, "found-it", "Found it", { status: "published" });
				await seed(content, "untitled-one", null);
				const hits = await store.searchEntries({ collection: content });
				expect(hits).toContainEqual({ id: published.id, title: "Found it", slug: "found-it", status: "published" });
				expect(hits).toContainEqual(
					expect.objectContaining({ title: "untitled-one", slug: "untitled-one", status: "draft" }),
				);
			});

			it("LIST-F7 returns the first entries by title when there is no query, up to the limit", async () => {
				for (const name of ["Charlie", "alpha", "Bravo", "delta"]) await seed(content, `l-${name}`, name);
				expect(titles(await store.searchEntries({ collection: content }))).toEqual([
					"alpha",
					"Bravo",
					"Charlie",
					"delta",
				]);
				expect(titles(await store.searchEntries({ collection: content, query: "  ", limit: 2 }))).toEqual([
					"alpha",
					"Bravo",
				]);
			});

			it("LIST-F7 orders equal matches by title and caps the hits at the limit", async () => {
				for (const name of ["pick b", "pick a", "pick c"]) await seed(content, name.replace(" ", "-"), name);
				const hits = await store.searchEntries({ collection: content, query: "pick", limit: 2 });
				expect(titles(hits)).toEqual(["pick a", "pick b"]);
			});

			it("LIST-F7 matches % and _ in the query as text", async () => {
				await seed(content, "pct-a", "100% done");
				await seed(content, "pct-b", "1000 done");
				expect(titles(await store.searchEntries({ collection: content, query: "100%" }))).toEqual(["100% done"]);
				expect(titles(await store.searchEntries({ collection: content, query: "_" }))).toEqual([]);
			});

			it("searches one collection only, and never finds the trash", async () => {
				const kept = await seed(content, "shared-kept", "Shared title");
				const trashed = await seed(content, "shared-trashed", "Shared title trashed");
				await store.trashEntry({ id: trashed.id, expectedVersion: trashed.version });
				if (isolatedCollection) await seed(isolatedCollection, "shared-other", "Shared title elsewhere");
				const hits = await store.searchEntries({ collection: content, query: "shared" });
				expect(hits.map((hit) => hit.id)).toEqual([kept.id]);
			});

			it("LIST-F7 finds only published entries with publishedOnly", async () => {
				await seed(content, "p-draft", "Pub draft");
				const live = await seed(content, "p-live", "Pub live", { status: "published" });
				const hits = await store.searchEntries({ collection: content, query: "pub", publishedOnly: true });
				expect(hits.map((hit) => hit.id)).toEqual([live.id]);
				expect(titles(await store.searchEntries({ collection: content, query: "pub" }))).toEqual([
					"Pub draft",
					"Pub live",
				]);
			});

			it.skipIf(!secondLocale)("LIST-F7 finds only the entries of the locale", async () => {
				await seed(content, "loc-default", "Locale default");
				const other = await seedEntry(store, {
					collection: content,
					slug: "loc-other",
					metadata: await metadataFor(content, "Locale other"),
					text: "",
					contentHash: uniqueHash(),
					locale: secondLocale,
				});
				const hits = await store.searchEntries({
					collection: content,
					query: "locale",
					locale: secondLocale as string,
				});
				expect(hits.map((hit) => hit.id)).toEqual([other.id]);
				expect(await store.searchEntries({ collection: content, query: "locale" })).toHaveLength(2);
			});

			it("LIST-F7 looks entries up by id whatever the other filters say, in the collection only", async () => {
				const draft = await seed(content, "id-draft", "By id");
				const trashed = await seed(content, "id-trashed", "Trashed by id");
				await store.trashEntry({ id: trashed.id, expectedVersion: trashed.version });
				const other = isolatedCollection ? await seed(isolatedCollection, "id-other", "Other by id") : undefined;
				const hits = await store.searchEntries({
					collection: content,
					ids: [draft.id, trashed.id, ...(other ? [other.id] : [])],
					query: "nothing like it",
					publishedOnly: true,
				});
				expect(hits.map((hit) => hit.id)).toEqual([draft.id]);
				expect(await store.searchEntries({ collection: content, ids: [] })).toEqual([]);
			});

			it("LIST-F7 rejects parameters it cannot search with", async () => {
				for (const params of [
					{ collection: "no-such-collection" },
					{ collection: content, limit: 0 },
					{ collection: content, limit: 51 },
					{ collection: content, limit: 1.5 },
					{ collection: content, locale: "xx-nope" },
					{ collection: content, ids: ["not-an-id"] },
					{ collection: content, query: 5 },
					{ collection: content, publishedOnly: "yes" },
				]) {
					await expect(store.searchEntries(params as never)).rejects.toMatchObject({ code: "invalid_input" });
				}
			});
		});
	});
};
