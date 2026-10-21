import { describe, expect, it } from "vitest";
import {
	addCollection,
	addField,
	addOption,
	allowedOf,
	changeCount,
	changedAreas,
	collectionNameProblem,
	collectionsOf,
	FIELD_KEY_ORDER,
	fieldProblems,
	fieldsOf,
	hasBody,
	moveField,
	nameProblem,
	newField,
	type Obj,
	recordRename,
	removeBlock,
	removeField,
	removeOption,
	renameField,
	renameOption,
	reorderCollections,
	reorderField,
	setProp,
	setTitleField,
	suggestedFieldName,
	titleFieldName,
	unpublishedTargetsOf,
	withBody,
	withKind,
	withOpposite,
	withOptionFields,
	withPublicPath,
	withUnpublishedTargets,
} from "../schema-model";

const withPath = (): Obj => ({ ...post(), path: "/posts/:slug" });
const post = (): Obj => ({
	label: "Post",
	kind: "document",
	fields: {
		title: { kind: "text", label: "Title", required: true },
		slug: { kind: "slug", label: "Address", from: "title" },
		summary: { kind: "text", label: "Summary", max: 100 },
		status: { kind: "select", label: "Status", options: { draft: "Draft", live: "Live" }, defaultValue: "draft" },
	},
	layout: [{ group: "Main", fields: ["title", "summary"] }],
});

describe("schema model", () => {
	it("puts a new property of a field where the format has it, not at the end", () => {
		const field = { kind: "text", label: "Title", max: 10, placeholder: "x" };
		expect(Object.keys(setProp(field, "required", true, FIELD_KEY_ORDER))).toEqual([
			"kind",
			"label",
			"required",
			"max",
			"placeholder",
		]);
		expect(Object.keys(setProp(field, "description", "d", FIELD_KEY_ORDER))).toEqual([
			"kind",
			"label",
			"description",
			"max",
			"placeholder",
		]);
		expect(setProp(field, "max", undefined, FIELD_KEY_ORDER)).toEqual({
			kind: "text",
			label: "Title",
			placeholder: "x",
		});
	});

	it("renames a field in place and follows it in the layout and a slug's source", () => {
		const renamed = renameField(post(), {}, "title", "heading");
		expect(Object.keys(fieldsOf(renamed))).toEqual(["heading", "slug", "summary", "status"]);
		expect((renamed.layout as { fields: string[] }[])[0]?.fields).toEqual(["heading", "summary"]);
		expect((fieldsOf(renamed).slug as Obj).from).toBe("heading");
	});

	it("keeps the title field the title when it is renamed: the field named title gets the title role", () => {
		expect(titleFieldName(post())).toBe("title");
		const renamed = renameField(post(), {}, "title", "headline");
		expect(fieldsOf(renamed).headline).toEqual({ kind: "text", label: "Title", required: true, role: "title" });
		expect(titleFieldName(renamed)).toBe("headline");
		// A title that already has the role keeps it, and a field that is not the title gets nothing.
		expect(fieldsOf(renameField(renamed, {}, "headline", "name")).name).toMatchObject({ role: "title" });
		expect(fieldsOf(renameField(post(), {}, "summary", "blurb")).blurb).not.toHaveProperty("role");
	});

	it("moves the title role to another text field", () => {
		const moved = setTitleField(renameField(post(), {}, "title", "headline"), "summary");
		expect(titleFieldName(moved)).toBe("summary");
		expect(fieldsOf(moved).headline).not.toHaveProperty("role");
		expect(fieldsOf(moved).summary).toMatchObject({ role: "title" });
	});

	it("removes a field and the places that named it", () => {
		const removed = removeField(post(), {}, "summary");
		expect(Object.keys(fieldsOf(removed))).toEqual(["title", "slug", "status"]);
		expect((removed.layout as { fields: string[] }[])[0]?.fields).toEqual(["title"]);
	});

	it("adds and moves fields, inside a conditional branch too", () => {
		const added = addField(post(), {}, "rating", { kind: "text", label: "Rating" });
		expect(Object.keys(fieldsOf(added)).at(-1)).toBe("rating");
		expect(Object.keys(fieldsOf(moveField(added, {}, "rating", -2)))).toEqual([
			"title",
			"slug",
			"rating",
			"summary",
			"status",
		]);

		const conditional = addField(post(), {}, "policy", {
			kind: "conditional",
			label: "Policy",
			discriminant: { kind: "select", label: "Policy", options: { a: "A", b: "B" }, defaultValue: "a" },
			values: {},
		});
		const branch = addField(conditional, { branch: { field: "policy", option: "b" } }, "why", {
			kind: "text",
			label: "Why",
		});
		expect((fieldsOf(branch).policy as { values: Obj }).values).toEqual({ b: { why: { kind: "text", label: "Why" } } });
	});

	it("keeps the options of a select in order, with its default pointing at one of them", () => {
		const status = fieldsOf(post()).status as Obj;
		const added = addOption(status, "later", "Later");
		expect(Object.keys(added.options as Obj)).toEqual(["draft", "live", "later"]);
		const renamed = renameOption(added, "draft", "idea");
		expect(Object.keys(renamed.options as Obj)).toEqual(["idea", "live", "later"]);
		expect(renamed.defaultValue).toBe("idea");
		const removed = removeOption(renamed, "idea");
		expect(removed.defaultValue).toBe("live");
	});

	it("moves a conditional branch along with its option", () => {
		const field: Obj = {
			kind: "conditional",
			label: "P",
			discriminant: { kind: "select", label: "P", options: { a: "A", b: "B" }, defaultValue: "a" },
			values: { b: { why: { kind: "text", label: "Why" } } },
		};
		expect((renameOption(field, "b", "c").values as Obj).c).toBeDefined();
		expect((removeOption(field, "b").values as Obj).b).toBeUndefined();
	});

	it("changes the kind of a field and keeps what still applies", () => {
		const text = { kind: "text", label: "Rating", required: true, description: "How good", max: 5 };
		const select = withKind(text, "select", []);
		expect(select).toMatchObject({
			kind: "select",
			label: "Rating",
			required: true,
			description: "How good",
			defaultValue: "first",
		});
		expect(select).not.toHaveProperty("max");
		expect(withKind(text, "view", [])).not.toHaveProperty("required");
	});

	it("writes the body as the format does", () => {
		const doc: Obj = { label: "Post", kind: "document", fields: {} };
		expect(hasBody(doc)).toBe(true);
		expect(withBody(doc, true, {})).toEqual(doc);
		expect(withBody(doc, false, {}).body).toBe(false);
		const limited = withBody(doc, true, { blocks: ["table"], headings: [2, 3] });
		expect(limited.body).toEqual({ blocks: ["table"], headings: [2, 3] });
		expect(allowedOf(limited)).toEqual({ blocks: ["table"], headings: [2, 3] });
		expect(withBody({ ...limited, kind: "item" }, true, {}).body).toBe(true);
		expect(hasBody({ label: "Tag", kind: "item", fields: {} })).toBe(false);
	});

	it("adds a collection with the title and slug fields every collection starts with, and the address when there is one", () => {
		const file = addCollection({ collections: {} }, "tag", "item");
		expect(file).toEqual({
			collections: {
				tag: {
					label: "Tag",
					kind: "item",
					fields: {
						title: { kind: "text", label: "Title", required: true, role: "title" },
						slug: { kind: "slug", label: "Slug", required: true, from: "title" },
					},
				},
			},
		});
		const withPath = collectionsOf(addCollection({}, "note", "document", "/note/:slug")).note as Obj;
		expect(Object.keys(withPath)).toEqual(["label", "kind", "path", "fields"]);
	});

	it("on a site with several locales, a new collection's title is per locale, and a document's slug starts from the source locale's", () => {
		const locales = [
			{ code: "ko", name: "한국어" },
			{ code: "en", name: "English" },
		];
		const item = collectionsOf(addCollection({ locales }, "category", "item")).category as Obj;
		expect(fieldsOf(item).title?.localized).toBe(true);
		expect(fieldsOf(item).slug?.localized).toBeUndefined();
		const document = collectionsOf(addCollection({ locales }, "memo", "document")).memo as Obj;
		expect(fieldsOf(document).title?.localized).toBe(true);
		expect(fieldsOf(document).slug?.localized).toBe("inherit");
		const single = collectionsOf(addCollection({ locales: locales.slice(0, 1) }, "tag", "item")).tag as Obj;
		expect(fieldsOf(single).title?.localized).toBeUndefined();
	});

	it("says what a field still needs before it can be added", () => {
		const names = ["post", "tag"];
		expect(fieldProblems(newField("text", "A"), post(), names)).toEqual([]);
		expect(fieldProblems(newField("relation", "A", names), post(), names)).toEqual([]);
		expect(fieldProblems(newField("relation", "A", []), post(), [])).toEqual(["target"]);
		expect(fieldProblems(newField("select", "A"), post(), names)).toEqual([]);
		expect(fieldProblems({ kind: "select", label: "A", options: {} }, post(), names)).toEqual(["options"]);
		expect(fieldProblems(newField("slug", "A"), post(), names)).toEqual([]);
		expect(fieldProblems({ kind: "slug", label: "A", from: "status" }, post(), names)).toEqual(["slugFrom"]);
		// A conditional field needs a field in one of its options.
		expect(fieldProblems(newField("conditional", "A"), post(), names)).toEqual(["branches"]);
		const filled = { ...newField("conditional", "A"), values: { a: { note: { kind: "text", label: "Note" } } } };
		expect(fieldProblems(filled, post(), names)).toEqual([]);
	});

	it("blocks deleting the title field, and the slug field while the address uses :slug", () => {
		expect(removeBlock(withPath(), {}, "title")).toBe("title");
		expect(removeBlock(withPath(), {}, "slug")).toBe("slug");
		expect(removeBlock(withPath(), {}, "summary")).toBeNull();
		expect(removeBlock(post(), {}, "slug")).toBeNull();
		// The title role moves the block with it.
		expect(removeBlock(renameField(withPath(), {}, "title", "headline"), {}, "headline")).toBe("title");
	});

	it("checks names", () => {
		expect(nameProblem("", [])).toBe("empty");
		expect(nameProblem("my field", [])).toBe("pattern");
		expect(nameProblem("translations", [])).toBe("reserved");
		expect(nameProblem("title", ["title"])).toBe("taken");
		expect(nameProblem("ok_name-2", ["title"])).toBeNull();
	});

	it("checks collection names against the reserved collection names, not the field-key ones", () => {
		expect(collectionNameProblem("media", [])).toBe("reserved");
		expect(collectionNameProblem("translations", [])).toBeNull();
		expect(nameProblem("media", [])).toBeNull();
		expect(collectionNameProblem("post", ["post"])).toBe("taken");
	});

	it("tracks renames: a chain is one rename, and renaming back cancels it", () => {
		const first = recordRename([], { kind: "field", collection: "post", from: "a", to: "b" });
		const chain = recordRename(first, { kind: "field", collection: "post", from: "b", to: "c" });
		expect(chain).toEqual([{ kind: "field", collection: "post", from: "a", to: "c" }]);
		expect(recordRename(chain, { kind: "field", collection: "post", from: "c", to: "a" })).toEqual([]);
	});
});

describe("reorderField", () => {
	it("puts a field where the one it is dropped on is, and keeps the others in order", () => {
		const collection = post();
		const order = Object.keys(fieldsOf(collection));
		const moved = reorderField(collection, {}, order[0] as string, order[2] as string);
		expect(Object.keys(fieldsOf(moved))).toEqual([order[1], order[2], order[0], ...order.slice(3)]);
		const back = reorderField(moved, {}, order[0] as string, order[1] as string);
		expect(Object.keys(fieldsOf(back))).toEqual([order[0], order[1], order[2], ...order.slice(3)]);
	});

	it("leaves the list alone for the same field or a name that is not in it", () => {
		const collection = post();
		const first = Object.keys(fieldsOf(collection))[0] as string;
		expect(reorderField(collection, {}, first, first)).toEqual(collection);
		expect(reorderField(collection, {}, first, "nope")).toEqual(collection);
	});
});

describe("changeCount", () => {
	const file = (): Obj => ({
		collections: { post: post() },
		locales: [{ code: "en", name: "English" }],
		defaultLocale: "en",
	});
	it("is zero for an untouched draft and counts each edited part once", () => {
		expect(changeCount(file(), file())).toBe(0);
		const edited = file();
		edited.collections = { post: { ...post(), label: "Article" }, memo: post() };
		edited.timeZone = "Asia/Seoul";
		edited.site = { name: "Mine", home: "/" };
		// post edited, memo added, time zone, two site settings
		expect(changeCount(file(), edited)).toBe(5);
	});
});

describe("changedAreas", () => {
	const file = (): Obj => ({
		collections: { post: post(), tag: post() },
		locales: [{ code: "en", name: "English" }],
		defaultLocale: "en",
	});
	it("marks nothing for an untouched draft", () => {
		const areas = changedAreas(file(), file());
		expect(Object.values(areas.tabs).some(Boolean)).toBe(false);
		expect(areas.collections).toEqual({});
	});
	it("marks the tab and the collection part that changed, and only those", () => {
		const edited = file();
		edited.collections = { post: { ...post(), label: "Article" }, tag: post() };
		const areas = changedAreas(file(), edited);
		expect(areas.tabs.collections).toBe(true);
		expect(areas.tabs.site || areas.tabs.admin || areas.tabs.locales).toBe(false);
		expect(Object.keys(areas.collections)).toEqual(["post"]);
		expect(areas.collections.post).toEqual({ basics: true, fields: false, editor: false });
	});
	it("marks each settings tab by its own settings", () => {
		const edited = file();
		edited.site = { name: "Mine" };
		edited.timeZone = "Asia/Seoul";
		const { tabs } = changedAreas(file(), edited);
		expect(tabs).toEqual({ site: true, locales: true, collections: false, admin: false });
	});
	it("marks the collections tab when a collection is removed or the order changes", () => {
		const removed = file();
		removed.collections = { post: post() };
		expect(changedAreas(file(), removed).tabs.collections).toBe(true);
		const swapped = file();
		swapped.collections = { tag: post(), post: post() };
		expect(changedAreas(file(), swapped).tabs.collections).toBe(true);
	});
});

describe("collection reordering", () => {
	const file = (): Obj => ({
		collections: { post: post(), memo: post(), tag: post() },
	});

	it("reorders collections to a specified order", () => {
		const reordered = reorderCollections(file(), ["tag", "post", "memo"]);
		expect(Object.keys(collectionsOf(reordered))).toEqual(["tag", "post", "memo"]);
	});

	it("counts collection order change as one pending change", () => {
		const reordered = reorderCollections(file(), ["memo", "post", "tag"]);
		expect(changeCount(file(), reordered)).toBe(1);
	});
});

describe("adding a field", () => {
	it("names a link after its target and any other field after its label, never with a taken name", () => {
		expect(suggestedFieldName({ kind: "relation", to: "category" }, [])).toBe("categoryId");
		expect(suggestedFieldName({ kind: "relation", to: "tag", many: true }, [])).toBe("tagIds");
		expect(suggestedFieldName({ kind: "text", label: "Reading time" }, [])).toBe("readingTime");
		expect(suggestedFieldName({ kind: "text", label: "읽는 시간" }, [])).toBe("text");
		expect(suggestedFieldName({ kind: "text", label: "Summary" }, ["summary"])).toBe("summary2");
		expect(suggestedFieldName({ kind: "conditional", label: "" }, [])).toBe("select");
	});

	it("keeps whether unpublished targets can be picked and hold back publishing as one choice", () => {
		for (const choice of ["hidden", "blocking", "allowed"] as const) {
			expect(unpublishedTargetsOf(withUnpublishedTargets({ kind: "relation", to: "tag" }, choice))).toBe(choice);
		}
		// The default writes nothing.
		expect(withUnpublishedTargets({ kind: "relation", to: "tag", publishedOnly: true }, "blocking")).toEqual({
			kind: "relation",
			to: "tag",
		});
	});

	it("shows a many link on its target as a backlink, and takes it away again", () => {
		const start = {
			collections: {
				post: { label: "Post", kind: "document", fields: { tagIds: { kind: "relation", to: "tag", many: true } } },
				tag: { label: "Tag", kind: "item", fields: { title: { kind: "text", label: "Name" } } },
			},
		};
		const shown = withOpposite(start, "post", "tagIds", "tag", true);
		expect(fieldsOf(collectionsOf(shown).tag as Obj).posts).toEqual({
			kind: "backlink",
			label: "Post",
			from: "post",
			via: "tagIds",
		});
		expect(withOpposite(shown, "post", "tagIds", "tag", true)).toBe(shown);
		expect(withOpposite(shown, "post", "tagIds", "tag", false)).toEqual(start);
	});

	it("turns a choice into one with fields per option and back, keeping its options", () => {
		const select = {
			kind: "select",
			label: "Format",
			required: true,
			options: { news: "News", guide: "Guide" },
			defaultValue: "news",
		};
		const withFields = withOptionFields(select, true);
		expect(withFields).toMatchObject({
			kind: "conditional",
			label: "Format",
			discriminant: { kind: "select", label: "Format", required: true, options: select.options, defaultValue: "news" },
			values: {},
		});
		expect(withOptionFields(withFields, false)).toEqual(select);
	});

	it("brings a slug along with a public address when the collection has none", () => {
		const item = { kind: "item", fields: { title: { kind: "text", label: "Name" } } };
		expect(fieldsOf(withPublicPath(item, "/tags/:slug", true)).slug).toEqual({
			kind: "slug",
			label: "Slug",
			required: true,
			from: "title",
		});
		const document = { kind: "document", fields: { title: { kind: "text", label: "Title" } } };
		expect(fieldsOf(withPublicPath(document, "/posts/:slug", true)).slug?.localized).toBe("inherit");
		// No address, or a slug already there: only the address changes.
		expect(withPublicPath(item, undefined, true)).toEqual(item);
		const withSlug = { ...item, fields: { ...item.fields, key: { kind: "slug", label: "Key", from: "title" } } };
		expect(Object.keys(fieldsOf(withPublicPath(withSlug, "/tags/:slug", false)))).toEqual(["title", "key"]);
	});
});
