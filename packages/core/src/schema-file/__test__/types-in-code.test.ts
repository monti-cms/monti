import { describe, expect, expectTypeOf, it } from "vitest";
import { defineCollection, defineConfig, fields } from "../..";
import type { Cms } from "../../cms";
import type { CollectionName, MetadataFor } from "../../core/types";
import type { DocumentComponentsFor } from "../../render";

/**
 * The types of a config built from a schema written in code with literal types (an inline `as const` object). A schema file imported from JSON gets the same
 * types from the generated declaration file; that path is tested in `cli/__test__/schema-types.test.ts`.
 */

const schema = {
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
} as const;

describe("defineConfig({ schema }) types", () => {
	const config = defineConfig({ schema });

	it("keeps collection names, locale codes and the shape of each collection's metadata", () => {
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

	it("types the same as the config written in code", () => {
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
		const code = defineConfig({
			collections: { post, tag },
			locales: [{ code: "ko", name: "x" }],
			defaultLocale: "ko",
		});
		type FromSchema = MetadataFor<"post", typeof config>;
		type FromCode = MetadataFor<"post", typeof code>;
		expectTypeOf<FromSchema["stage"]>().toEqualTypeOf<FromCode["stage"]>();
		expectTypeOf<FromSchema["tagIds"]>().toEqualTypeOf<FromCode["tagIds"]>();
	});

	it("reaches the instance (`cms.read`) and the component table of the site", () => {
		type Instance = Cms<typeof config>;
		expectTypeOf<Parameters<Instance["read"]["getEntry"]>[0]["collection"]>().toEqualTypeOf<"post" | "tag">();
		const components = {} satisfies DocumentComponentsFor<typeof config>;
		expect(components).toEqual({});
	});

	it("adds code collections to the types of the file's", () => {
		const note = defineCollection({
			label: "Note",
			kind: "item",
			fields: { title: fields.text({ label: "Name" }), slug: fields.slug({ label: "Address" }) },
		});
		const merged = defineConfig({ schema, collections: { note } });
		expectTypeOf<CollectionName<typeof merged>>().toEqualTypeOf<"post" | "tag" | "note">();
	});
});
