import { describe, expect, it } from "vitest";
import {
	addCollection,
	addField,
	addOption,
	allowedOf,
	FIELD_KEY_ORDER,
	fieldsOf,
	hasBody,
	moveField,
	nameProblem,
	type Obj,
	recordRename,
	removeField,
	removeOption,
	renameField,
	renameOption,
	setProp,
	setTitleField,
	titleFieldName,
	withBody,
	withKind,
} from "../schema-model";

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
	list: { columns: ["title", "summary", "status"] },
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

	it("renames a field in place and follows it in the layout, the list columns and a slug's source", () => {
		const renamed = renameField(post(), {}, "title", "heading");
		expect(Object.keys(fieldsOf(renamed))).toEqual(["heading", "slug", "summary", "status"]);
		expect((renamed.layout as { fields: string[] }[])[0]?.fields).toEqual(["heading", "summary"]);
		expect((renamed.list as { columns: string[] }).columns).toEqual(["heading", "summary", "status"]);
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
		expect((removed.list as { columns: string[] }).columns).toEqual(["title", "status"]);
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

	it("adds a collection with the title field every collection needs", () => {
		const file = addCollection({ collections: {} }, "tag", "item");
		expect(file).toEqual({
			collections: {
				tag: { label: "Tag", kind: "item", fields: { title: { kind: "text", label: "Title", required: true } } },
			},
		});
	});

	it("checks names", () => {
		expect(nameProblem("", [])).toBe("empty");
		expect(nameProblem("my field", [])).toBe("pattern");
		expect(nameProblem("translations", [])).toBe("reserved");
		expect(nameProblem("title", ["title"])).toBe("taken");
		expect(nameProblem("ok_name-2", ["title"])).toBeNull();
	});

	it("tracks renames: a chain is one rename, and renaming back cancels it", () => {
		const first = recordRename([], { kind: "field", collection: "post", from: "a", to: "b" });
		const chain = recordRename(first, { kind: "field", collection: "post", from: "b", to: "c" });
		expect(chain).toEqual([{ kind: "field", collection: "post", from: "a", to: "c" }]);
		expect(recordRename(chain, { kind: "field", collection: "post", from: "c", to: "a" })).toEqual([]);
	});
});
