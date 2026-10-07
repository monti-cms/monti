import { describe, expect, it } from "vitest";
import { parseSchemaFile, SchemaFileError } from "../format";
import { blogSchema, cloneSchema, type EditableSchema } from "./fixture";

/** The paths and messages of the problems of a schema, for assertions. */
function problems(edit: (schema: EditableSchema) => void): { path: string; message: string }[] {
	const schema = cloneSchema();
	edit(schema);
	try {
		parseSchemaFile(schema, "monti.schema.json");
	} catch (error) {
		expect(error).toBeInstanceOf(SchemaFileError);
		return [...(error as SchemaFileError).issues];
	}
	throw new Error("the schema was accepted");
}

describe("parseSchemaFile", () => {
	it("accepts a schema with every field kind and returns a copy", () => {
		const parsed = parseSchemaFile(blogSchema);
		expect(parsed.collections.post?.fields.policy?.kind).toBe("conditional");
		expect(parsed.locales.map((locale) => locale.code)).toEqual(["ko", "en"]);
		expect(parsed).toEqual(blogSchema);
		expect(parsed).not.toBe(blogSchema);
		expect(parsed.collections).not.toBe(blogSchema.collections);
	});

	it("accepts the object form of `body` with allowed blocks, marks and heading levels", () => {
		const schema = cloneSchema();
		schema.collections.post.body = { blocks: ["callout", "table"], marks: ["bold"], headings: [2, 3] };
		expect(parseSchemaFile(schema).collections.post?.body).toEqual(schema.collections.post.body);
	});

	it("names the JSON path of a problem in the allowed list of a body", () => {
		const keys = problems((schema) => {
			schema.collections.post.body = { block: ["callout"] };
		});
		expect(keys).toEqual([{ path: "collections.post.body.block", message: "is not part of the schema format" }]);
		const level = problems((schema) => {
			schema.collections.post.body = { headings: [2, 7] };
		});
		expect(level[0]?.path).toMatch(/^collections\.post\.body/);
	});

	it("names the JSON path of a field with an unknown kind", () => {
		const [issue] = problems((schema) => {
			schema.collections.post.fields.title.kind = "date";
		});
		expect(issue?.path).toBe("collections.post.fields.title.kind");
		expect(issue?.message).toContain("text, slug, relation, select, media, conditional, backlink or view");
	});

	it("names the key of an option the format does not have, so a misspelling or a retired option is caught", () => {
		const [issue] = problems((schema) => {
			schema.collections.post.fields.title.maxLength = 10;
		});
		expect(issue).toEqual({
			path: "collections.post.fields.title.maxLength",
			message: "is not part of the schema format",
		});
	});

	it("has no retired aliases: `workflow` on a collection and a string `required` are errors", () => {
		const old = problems((schema) => {
			schema.collections.post.workflow = "publish";
			schema.collections.post.fields.title.required = "publish";
		});
		expect(old).toContainEqual({ path: "collections.post.workflow", message: "is not part of the schema format" });
		const required = old.find((issue) => issue.path === "collections.post.fields.title.required");
		expect(required?.message).toContain("only `true` exists");
		const [kind] = problems((schema) => {
			delete schema.collections.post.kind;
		});
		expect(kind?.path).toBe("collections.post.kind");
	});

	it("checks the rules that name one value, with paths into arrays", () => {
		expect(
			problems((schema) => {
				schema.locales[1].code = "EN_us";
			}),
		).toEqual([{ path: "locales[1].code", message: 'must look like "en", "pt-BR" or "zh-Hant"' }]);
		expect(
			problems((schema) => {
				schema.defaultLocale = "ja";
			}),
		).toEqual([{ path: "defaultLocale", message: '"ja" is not one of the locales (ko, en)' }]);
		expect(
			problems((schema) => {
				schema.locales.push({ code: "ko", name: "Again" });
			}),
		).toEqual([{ path: "locales[2].code", message: '"ko" is listed twice' }]);
		expect(
			problems((schema) => {
				schema.timeZone = "Mars/Base";
			}),
		).toEqual([{ path: "timeZone", message: "is not an IANA time zone" }]);
		expect(
			problems((schema) => {
				schema.admin.path = "/api/x";
			})[0]?.path,
		).toBe("admin.path");
		expect(
			problems((schema) => {
				schema.site.url = "ftp://example.com";
			})[0]?.path,
		).toBe("site.url");
		expect(
			problems((schema) => {
				schema.seed.templates[0].id = "not-a-uuid";
			})[0]?.path,
		).toMatch(/^seed\.templates\[0\]/);
	});

	it("checks select defaults and the options a conditional field shows fields for", () => {
		expect(
			problems((schema) => {
				schema.collections.post.fields.policy.discriminant.defaultValue = "missing";
			})[0],
		).toMatchObject({ path: "collections.post.fields.policy.discriminant.defaultValue" });
		expect(
			problems((schema) => {
				schema.collections.post.fields.policy.values.unknown = {};
			})[0],
		).toMatchObject({ path: "collections.post.fields.policy.values.unknown" });
		const dependent = problems((schema) => {
			schema.collections.post.fields.policy.values.deprecated.nested = { kind: "view", view: "x" };
		});
		expect(dependent[0]?.message).toContain("a dependent field must be a text, relation, select or media field");
	});

	it("reports every problem in one error that lists the paths", () => {
		const schema = cloneSchema();
		schema.locales[0].code = "KO";
		schema.collections.post.fields.cover.accept = "video";
		try {
			parseSchemaFile(schema, "site/monti.schema.json");
			expect.unreachable();
		} catch (error) {
			const message = (error as Error).message;
			expect(message).toContain("site/monti.schema.json is not a valid schema file:");
			expect(message).toContain("locales[0].code:");
			expect(message).toContain("collections.post.fields.cover.accept:");
		}
	});

	it("rejects something that is not an object", () => {
		expect(() => parseSchemaFile([])).toThrow(/\(root\): must be a JSON object/);
		expect(() => parseSchemaFile(null, "x.json")).toThrow(/x\.json is not a valid schema file/);
	});

	it("quotes a key that is not a plain name in the path", () => {
		const [issue] = problems((schema) => {
			schema.collections["my.posts"] = { label: "X", kind: "document", fields: { title: { kind: "nope" } } };
		});
		expect(issue?.path).toBe('collections["my.posts"].fields.title.kind');
	});
});
