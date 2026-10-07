import { describe, expect, it } from "vitest";
import { defineCollection, defineSite, fields } from "../..";
import { extractSchemaData } from "../../cli/schema-extract";
import { schemaTypesText } from "../../cli/schema-types";
import { createSite } from "../../site";
import { parseSchemaFile } from "../format";
import { buildJsonSchema } from "../json-schema";
import type { SchemaInput } from "../types";
import { cloneSchema } from "./fixture";

/** A schema file whose posts keep the title in `headline` (`role: "title"`). */
const renamed = () => {
	const schema = cloneSchema();
	const { title, ...rest } = schema.collections.post.fields;
	schema.collections.post.fields = { headline: { ...title, role: "title" }, ...rest };
	schema.collections.post.fields.slug.from = "headline";
	schema.collections.post.list = { columns: ["headline", "status"] };
	schema.collections.post.layout = [{ fields: ["headline", "slug", "summary"] }];
	return schema;
};

describe("the title role in the schema file", () => {
	it("is a field role the format reads, and the config built from the file names the title field by it", () => {
		const file = parseSchemaFile(renamed());
		expect(file.collections.post?.fields.headline).toMatchObject({ kind: "text", role: "title" });
		const config = defineSite({ schema: renamed() as SchemaInput });
		expect(createSite(config).titleField("post").name).toBe("headline");
		expect(createSite(config).titleField("tag").name).toBe("title");
	});

	it("is described in the JSON Schema", () => {
		const text = JSON.stringify(buildJsonSchema());
		expect(text).toContain("`title` (the entry's title");
	});

	it("is written into the generated types as a literal, so code can read which field is the title", () => {
		const types = schemaTypesText(parseSchemaFile(renamed()));
		expect(types).toMatch(/readonly headline: \{[^}]*readonly role: "title";/s);
	});

	it("survives schema:extract from a config in code", () => {
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
		const again = createSite(defineSite({ schema: JSON.parse(JSON.stringify(schema)) as SchemaInput }));
		expect(again.titleField("post").name).toBe("headline");
	});
});
