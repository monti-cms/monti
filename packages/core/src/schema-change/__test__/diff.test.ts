import { describe, expect, it } from "vitest";
import { cloneSchema, type EditableSchema } from "../../schema-file/__test__/fixture";
import type { SchemaMigration } from "../../schema-file/types";
import { describeSchemaChange, diffSchema } from "../diff";
import { changeKey, type SchemaChange } from "../types";

const old = cloneSchema();

/** The diff between the fixture and an edited copy of it, as kinds and keys. */
const changes = (edit: (schema: EditableSchema) => void, transforms?: readonly SchemaMigration[]): SchemaChange[] => {
	const next = cloneSchema();
	edit(next);
	return [...diffSchema(old as never, next as never, { transforms }).changes];
};

describe("diffSchema", () => {
	it("finds nothing between a schema and itself, and ignores labels, layout and other non-data edits", () => {
		expect(diffSchema(old as never, cloneSchema() as never)).toEqual({ changes: [], renameHints: [] });
		expect(
			changes((schema) => {
				schema.collections.post.label = "Article";
				schema.collections.post.fields.title.label = "Headline";
				schema.collections.post.layout = [];
				schema.collections.post.fields.summary.rows = 9;
			}),
		).toEqual([]);
	});

	it("lists collections added and removed", () => {
		const found = changes((schema) => {
			delete schema.collections.tag;
			schema.collections.note = { label: "Note", kind: "item", fields: { title: { kind: "text", label: "Title" } } };
		});
		expect(found.map(changeKey)).toEqual(["collection_removed:tag", "collection_added:note"]);
	});

	it("lists fields added and removed, and tells a required one", () => {
		const found = changes((schema) => {
			delete schema.collections.post.fields.cover;
			schema.collections.post.fields.subtitle = { kind: "text", label: "Subtitle" };
			schema.collections.post.fields.author = { kind: "text", label: "Author", required: true };
		});
		expect(found).toEqual([
			{ kind: "field_removed", collection: "post", field: "cover", fieldKind: "media" },
			{ kind: "field_added", collection: "post", field: "subtitle", fieldKind: "text", required: false },
			{ kind: "field_added", collection: "post", field: "author", fieldKind: "text", required: true },
		]);
	});

	it("sees fields inside a conditional field as fields of the collection, and a move between branches", () => {
		const found = changes((schema) => {
			const policy = schema.collections.post.fields.policy;
			policy.values.deprecated.note = { kind: "text", label: "Note" };
			delete policy.values.deprecated.replacementId;
			policy.values.normal = { replacementId: { kind: "relation", label: "Replacement", to: "post" } };
			policy.discriminant.options.normal = "Normal";
		});
		expect(found.map(changeKey)).toEqual(["field_added:post:note", "field_moved:post:replacementId"]);
		expect(found[1]).toMatchObject({
			from: { field: "policy", value: "deprecated" },
			to: { field: "policy", value: "normal" },
		});
	});

	it("lists type, required and language changes", () => {
		const found = changes((schema) => {
			schema.collections.post.fields.summary = { kind: "select", label: "S", options: { a: "A" }, defaultValue: "a" };
			schema.collections.post.fields.tagIds.many = false;
			schema.collections.post.fields.title.required = undefined;
			schema.collections.post.fields.cover.required = true;
			schema.collections.post.fields.categoryId.localized = "inherit";
		});
		expect(found).toHaveLength(5);
		expect(found).toEqual(
			expect.arrayContaining([
				{ kind: "field_type_changed", collection: "post", field: "summary", from: "text", to: "select" },
				{ kind: "field_required_changed", collection: "post", field: "title", required: false },
				{ kind: "field_required_changed", collection: "post", field: "cover", required: true },
				{ kind: "field_locale_changed", collection: "post", field: "categoryId", from: "shared", to: "inherit" },
				{ kind: "field_type_changed", collection: "post", field: "tagIds", from: "relation:tag[]", to: "relation:tag" },
			]),
		);
	});

	it("lists select options added and removed", () => {
		const found = changes((schema) => {
			const options = schema.collections.post.fields.policy.discriminant.options;
			delete options.deprecated;
			options.archived = "Archived";
			delete schema.collections.post.fields.policy.values.deprecated;
		});
		expect(found.map(changeKey)).toEqual([
			"field_removed:post:replacementId",
			"option_removed:post:policy:deprecated",
			"option_added:post:policy:archived",
		]);
	});

	it("lists locales added and removed and a changed default", () => {
		const found = changes((schema) => {
			schema.locales = [
				{ code: "en", name: "English" },
				{ code: "ja", name: "日本語" },
			];
			schema.defaultLocale = "en";
		});
		expect(found.map(changeKey)).toEqual(["locale_added:ja", "locale_removed:ko", "default_locale_changed:ko:en"]);
	});

	it("lists a body gained or lost, a changed collection kind, and changes of the allowed blocks, marks and headings", () => {
		const found = changes((schema) => {
			schema.collections.tag.body = true;
			schema.collections.category.kind = "document";
			schema.collections.post.body = { blocks: ["table"], marks: ["bold", "italic"] };
		});
		// A collection that changes kind gets the body default of its new kind, so its body changes too.
		expect(found.map((change) => change.kind).sort()).toEqual([
			"allowed_changed",
			"body_changed",
			"body_changed",
			"collection_kind_changed",
		]);
		expect(found.find((change) => change.kind === "allowed_changed")).toMatchObject({
			collection: "post",
			before: {},
			after: { blocks: ["table"], marks: ["bold", "italic"] },
			narrowed: true,
		});

		// Allowing more is not narrowing; the object form of the file and the normalized `allowed` of a site config read the same.
		const widened = diffSchema(
			{ ...old, collections: { post: { ...old.collections.post, body: { blocks: ["table"] } } } } as never,
			{
				...old,
				collections: { post: { ...old.collections.post, body: true, allowed: { blocks: ["table", "math"] } } },
			} as never,
		);
		expect(widened.changes).toMatchObject([{ kind: "allowed_changed", narrowed: false }]);
	});

	describe("with transforms", () => {
		it("tells a rename from a removal and an addition, and marks what a transform handles", () => {
			const transforms: SchemaMigration[] = [
				{ id: "rename", op: "renameField", collection: "post", from: "summary", to: "excerpt" },
				{ id: "drop", op: "dropField", collection: "post", field: "cover" },
				{ id: "default", op: "setDefault", collection: "post", field: "author", value: "Staff" },
				{ id: "map", op: "mapOption", collection: "post", field: "policy", from: "deprecated", to: "legacy" },
			];
			const found = changes((schema) => {
				const { summary, cover, ...rest } = schema.collections.post.fields;
				schema.collections.post.fields = {
					...rest,
					excerpt: summary,
					author: { kind: "text", label: "Author", required: true },
				};
				const options = schema.collections.post.fields.policy.discriminant.options;
				delete options.deprecated;
				options.legacy = "Legacy";
				schema.collections.post.fields.policy.values = {
					legacy: schema.collections.post.fields.policy.values.deprecated,
				};
			}, transforms);
			expect(found).toEqual(
				expect.arrayContaining([
					{ kind: "field_renamed", collection: "post", from: "summary", to: "excerpt", handledBy: "rename" },
					{ kind: "field_removed", collection: "post", field: "cover", fieldKind: "media", handledBy: "drop" },
					{
						kind: "field_added",
						collection: "post",
						field: "author",
						fieldKind: "text",
						required: true,
						handledBy: "default",
					},
					{
						kind: "option_renamed",
						collection: "post",
						field: "policy",
						from: "deprecated",
						to: "legacy",
						handledBy: "map",
					},
				]),
			);
			expect(found.some((change) => change.kind === "field_added" && change.field === "excerpt")).toBe(false);
		});

		it("a mapping to an option that already exists is a removal that a transform handles", () => {
			const found = changes(
				(schema) => {
					const policy = schema.collections.post.fields.policy;
					delete policy.discriminant.options.deprecated;
					delete policy.values.deprecated;
				},
				[{ id: "map", op: "mapOption", collection: "post", field: "policy", from: "deprecated", to: "normal" }],
			);
			expect(found).toContainEqual({
				kind: "option_removed",
				collection: "post",
				field: "policy",
				option: "deprecated",
				handledBy: "map",
			});
		});
	});

	it("points out a removed and an added thing that look like one rename, and applies nothing", () => {
		const next = cloneSchema();
		next.collections.post.fields.excerpt = next.collections.post.fields.summary;
		delete next.collections.post.fields.summary;
		const diff = diffSchema(old as never, next as never);
		expect(diff.renameHints).toEqual([{ scope: "field", collection: "post", from: "summary", to: "excerpt" }]);
		expect(diff.changes.map(changeKey)).toEqual(["field_removed:post:summary", "field_added:post:excerpt"]);

		const renamed = cloneSchema();
		renamed.collections.writer = renamed.collections.tag;
		delete renamed.collections.tag;
		expect(diffSchema(old as never, renamed as never).renameHints).toContainEqual({
			scope: "collection",
			from: "tag",
			to: "writer",
		});
	});

	it("gives each change a stable key and an English description", () => {
		const found = changes((schema) => {
			delete schema.collections.post.fields.cover;
		});
		expect(found.map(changeKey)).toEqual(["field_removed:post:cover"]);
		expect(found.map(describeSchemaChange)).toEqual(["post.cover removed (media)"]);
	});
});
