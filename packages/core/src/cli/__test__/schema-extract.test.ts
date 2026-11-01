import { describe, expect, it } from "vitest";
import { defineCollection, defineSite, fields } from "../..";
import type { SchemaTypes } from "../../schema-file/types";
import { createSite } from "../../site";
import { extractSchemaData } from "../schema-extract";

describe("the title role in the schema file", () => {
	it("SCHEMA-S4 survives schema:extract from a config in code", () => {
		const post = defineCollection({
			label: "Post",
			kind: "document",
			path: "/posts/:slug",
			fields: {
				headline: fields.text({ label: "Headline", role: "title", required: true }),
				slug: fields.slug({ label: "Slug", from: "headline", required: true }),
			},
		});
		const config = defineSite({
			collections: { post },
			locales: [{ code: "en", name: "English" }],
			defaultLocale: "en",
		});
		const { schema } = extractSchemaData(config);
		expect(schema.collections.post?.fields.headline).toMatchObject({ role: "title" });
		const again = createSite(defineSite({ schema: JSON.parse(JSON.stringify(schema)) as SchemaTypes }));
		expect(again.titleField("post").name).toBe("headline");
	});
});
