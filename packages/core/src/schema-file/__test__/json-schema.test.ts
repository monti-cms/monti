import { readFileSync } from "node:fs";
import { Ajv } from "ajv";
import { describe, expect, it } from "vitest";
import { jsonSchemaText } from "../json-schema";
import { blogSchema, cloneSchema, type EditableSchema } from "./fixture";

const published = JSON.parse(readFileSync(new URL("../../../schema.json", import.meta.url), "utf8")) as object;

const validator = () => new Ajv({ strict: false, allErrors: true }).compile(published);

describe("schema.json (the JSON Schema editors read)", () => {
	it("is up to date: `pnpm --filter @monti-cms/core schema:build` writes it from the format", () => {
		expect(readFileSync(new URL("../../../schema.json", import.meta.url), "utf8")).toBe(jsonSchemaText());
	});

	it("accepts a valid schema file", () => {
		const validate = validator();
		expect(validate(blogSchema), JSON.stringify(validate.errors)).toBe(true);
	});

	it("rejects what the runtime check rejects by shape, at the same place", () => {
		const validate = validator();
		const locations = (edit: (schema: EditableSchema) => void): string[] => {
			const schema = cloneSchema();
			edit(schema);
			expect(validate(schema)).toBe(false);
			return (validate.errors ?? []).map((error) => error.instancePath);
		};
		expect(
			locations((schema) => {
				schema.collections.post.workflow = "publish";
			}),
		).toContain("/collections/post");
		expect(
			locations((schema) => {
				schema.collections.post.fields.title.required = "publish";
			}),
		).toContain("/collections/post/fields/title/required");
		expect(
			locations((schema) => {
				schema.collections.post.fields.cover.accept = "video";
			}),
		).toContain("/collections/post/fields/cover/accept");
		expect(
			locations((schema) => {
				delete schema.defaultLocale;
			}),
		).toContain("");
		expect(
			locations((schema) => {
				schema.locales[0].code = "KO";
			}),
		).toContain("/locales/0/code");
	});

	it("describes the options an editor shows next to the key", () => {
		const text = JSON.stringify(published);
		expect(text).toContain("Collection name -> definition");
		expect(text).toContain("The collection the relation points to.");
		expect(text).toContain("Help text below the input.");
	});

	it("lets a schema file point to it with `$schema`", () => {
		const validate = validator();
		expect(validate({ ...blogSchema, $schema: "./node_modules/@monti-cms/core/schema.json" })).toBe(true);
	});
});
