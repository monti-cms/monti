import { describe, expect, expectTypeOf, it } from "vitest";
import { defineCollection, defineSchema, defineSite, fields } from "../..";
import type { Cms } from "../../cms";
import type { CollectionName, MetadataFor } from "../../core/types";
import type { DocumentComponentsFor } from "../../render";

/**
 * The types of a config built from a schema made with `defineSchema` (what `monti.schema.ts` exports): the collection, field and locale names flow into the config
 * with nothing written by hand, and a wrong `kind` or option is a type error in the schema file.
 */

const schema = defineSchema({
	collections: {
		post: {
			label: "Post",
			kind: "document",
			path: "/posts/:slug",
			fields: {
				title: { kind: "text", label: "Title", required: true },
				slug: { kind: "slug", label: "Address", from: "title" },
				stage: {
					kind: "select",
					label: "Stage",
					options: { idea: "Idea", done: "Done" },
					defaultValue: "idea",
				},
				tagIds: { kind: "relation", label: "Tags", to: "tag", many: true },
				policy: {
					kind: "conditional",
					label: "Policy",
					discriminant: {
						kind: "select",
						label: "Policy",
						options: { normal: "Normal", deprecated: "Deprecated" },
						defaultValue: "normal",
					},
					values: { deprecated: { replacementId: { kind: "relation", label: "Replacement", to: "post" } } },
				},
			},
			layout: [{ fields: ["title", "slug"] }],
		},
		tag: {
			label: "Tag",
			kind: "item",
			fields: {
				title: { kind: "text", label: "Name", required: true },
				slug: { kind: "slug", label: "Address", from: "title" },
			},
		},
	},
	locales: [
		{ code: "ko", name: "한국어" },
		{ code: "en", name: "English" },
	],
	defaultLocale: "ko",
});

describe("defineSite({ schema }) types", () => {
	const config = defineSite({ schema });

	it("SCHEMA-S1 keeps collection names, locale codes and the shape of each collection's metadata", () => {
		expectTypeOf<CollectionName<typeof config>>().toEqualTypeOf<"post" | "tag">();
		expectTypeOf(config.defaultLocale).toEqualTypeOf<"ko" | "en">();
		type Post = MetadataFor<"post", typeof config>;
		expectTypeOf<NonNullable<Post["stage"]>>().toEqualTypeOf<"idea" | "done">();
		expectTypeOf<NonNullable<Post["tagIds"]>>().toEqualTypeOf<readonly string[]>();
		expectTypeOf<NonNullable<Post["policy"]>>().toEqualTypeOf<"normal" | "deprecated">();
		expectTypeOf<NonNullable<Post["replacementId"]>>().toEqualTypeOf<string>();
		expectTypeOf<MetadataFor<"nope", typeof config>>().toEqualTypeOf<never>();
		expectTypeOf<Post>().not.toHaveProperty("nope");
		expect(config.collections.post.kind).toBe("document");
	});

	it("SCHEMA-S1 types the same as the config written in code", () => {
		const post = defineCollection({
			label: "Post",
			kind: "document",
			fields: {
				title: fields.text({ label: "Title", required: true }),
				slug: fields.slug({ label: "Address", from: "title" }),
				stage: fields.select({ label: "Stage", options: { idea: "Idea", done: "Done" }, defaultValue: "idea" }),
				tagIds: fields.relation({ label: "Tags", to: "tag", many: true }),
			},
		});
		const tag = defineCollection({
			label: "Tag",
			kind: "item",
			fields: { title: fields.text({ label: "Name" }), slug: fields.slug({ label: "Address" }) },
		});
		const code = defineSite({
			collections: { post, tag },
			locales: [{ code: "ko", name: "x" }],
			defaultLocale: "ko",
		});
		type FromSchema = MetadataFor<"post", typeof config>;
		type FromCode = MetadataFor<"post", typeof code>;
		expectTypeOf<FromSchema["stage"]>().toEqualTypeOf<FromCode["stage"]>();
		expectTypeOf<FromSchema["tagIds"]>().toEqualTypeOf<FromCode["tagIds"]>();
	});

	it("SCHEMA-S1 reaches the instance (`cms.read`) and the component table of the site", () => {
		type Instance = Cms<typeof config>;
		expectTypeOf<Parameters<Instance["read"]["getEntry"]>[0]["collection"]>().toEqualTypeOf<"post" | "tag">();
		const components = {} satisfies DocumentComponentsFor<typeof config>;
		expect(components).toEqual({});
	});

	it("SCHEMA-S1 adds code collections to the types of the file's", () => {
		const note = defineCollection({
			label: "Note",
			kind: "item",
			fields: { title: fields.text({ label: "Name" }), slug: fields.slug({ label: "Address" }) },
		});
		const merged = defineSite({ schema, collections: { note } });
		expectTypeOf<CollectionName<typeof merged>>().toEqualTypeOf<"post" | "tag" | "note">();
	});
});

describe("defineSchema types", () => {
	it("SCHEMA-S1 is the identity at run time", () => {
		const given = { collections: {}, locales: [{ code: "en", name: "English" }], defaultLocale: "en" } as const;
		expect(defineSchema(given)).toBe(given);
	});

	it("SCHEMA-S1 keeps names as literal types, and the schema it returns is the type of its argument", () => {
		expectTypeOf(schema.defaultLocale).toEqualTypeOf<"ko">();
		expectTypeOf(schema.collections.post.kind).toEqualTypeOf<"document">();
		expectTypeOf(schema.locales[0].code).toEqualTypeOf<"ko">();
	});

	it("SCHEMA-S1 reports a wrong kind or a wrong option as a type error", () => {
		const base = { locales: [{ code: "en", name: "English" }], defaultLocale: "en" } as const;
		defineSchema({
			...base,
			collections: {
				post: {
					label: "Post",
					// @ts-expect-error a field kind that does not exist
					kind: "page",
					fields: { title: { kind: "text", label: "Title" } },
				},
			},
		});
		defineSchema({
			...base,
			collections: {
				post: {
					label: "Post",
					kind: "document",
					fields: {
						// @ts-expect-error "date" is not a field kind
						when: { kind: "date", label: "When" },
						// @ts-expect-error `rows` is a number
						body: { kind: "text", label: "Body", rows: "3" },
						// @ts-expect-error a relation needs the collection it points to
						author: { kind: "relation", label: "Author" },
					},
				},
			},
		});
		// @ts-expect-error `locales` is required
		defineSchema({ collections: {}, defaultLocale: "en" });
		expect(true).toBe(true);
	});
});
