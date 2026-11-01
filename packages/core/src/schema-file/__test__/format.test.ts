import { describe, expect, it } from "vitest";
import { blogSchema, cloneSchema, type EditableSchema } from "../../../test/blog-schema";
import { defineSite } from "../..";
import { ConfigError, type ConfigIssue } from "../../config/check/issue";
import { createSite } from "../../site";
import { parseSchemaFile } from "../format";
import type { SchemaTypes } from "../types";

/** The issues of a schema, for assertions. */
function problems(edit: (schema: EditableSchema) => void): ConfigIssue[] {
	const schema = cloneSchema();
	edit(schema);
	try {
		parseSchemaFile(schema, "monti.schema.ts");
	} catch (error) {
		expect(error).toBeInstanceOf(ConfigError);
		return [...(error as ConfigError).issues];
	}
	throw new Error("the schema was accepted");
}

describe("parseSchemaFile", () => {
	it("SCHEMA-F14 accepts a schema with every field kind and returns a copy", () => {
		const parsed = parseSchemaFile(blogSchema);
		expect(parsed.collections.post?.fields.policy?.kind).toBe("conditional");
		expect(parsed.locales.map((locale) => locale.code)).toEqual(["ko", "en"]);
		expect(parsed).toEqual(blogSchema);
		expect(parsed).not.toBe(blogSchema);
		expect(parsed.collections).not.toBe(blogSchema.collections);
	});

	it("SCHEMA-F14 accepts the object form of `body` with allowed blocks, marks and heading levels", () => {
		const schema = cloneSchema();
		schema.collections.post.body = { blocks: ["callout", "table"], marks: ["bold"], headings: [2, 3] };
		expect(parseSchemaFile(schema).collections.post?.body).toEqual(schema.collections.post.body);
	});

	it("SCHEMA-F14 names the path of a problem in the allowed list of a body", () => {
		const keys = problems((schema) => {
			schema.collections.post.body = { block: ["callout"] };
		});
		expect(keys).toEqual([expect.objectContaining({ path: "collections.post.body.block", code: "unknown-key" })]);
		expect(keys[0]?.message).toContain('did you mean "blocks"');
		const level = problems((schema) => {
			schema.collections.post.body = { headings: [2, 7] };
		});
		expect(level[0]?.path).toMatch(/^collections\.post\.body/);
	});

	it("SCHEMA-F14 names the path of a field with an unknown kind", () => {
		const [issue] = problems((schema) => {
			schema.collections.post.fields.title.kind = "date";
		});
		expect(issue?.path).toBe("collections.post.fields.title.kind");
		expect(issue?.message).toContain("text, slug, relation, select, media, conditional, backlink or view");
	});

	it("SCHEMA-F14 names the key of an option the format does not have, so a misspelling or a retired option is caught", () => {
		const [issue] = problems((schema) => {
			schema.collections.post.fields.title.maxLength = 10;
		});
		expect(issue).toMatchObject({ path: "collections.post.fields.title.maxLength", code: "unknown-key" });
		// The closest known key is named, when there is one.
		const [typo] = problems((schema) => {
			schema.collections.post.fields.title.requird = true;
		});
		expect(typo?.message).toContain('did you mean "required"');
	});

	it("SCHEMA-F14 has no retired aliases: `workflow`, `list` and a string `required` are errors like any unknown or wrong value", () => {
		const old = problems((schema) => {
			schema.collections.post.workflow = "publish";
			schema.collections.post.list = { columns: ["title"] };
			schema.collections.post.fields.title.required = "publish";
		});
		expect(old).toContainEqual(expect.objectContaining({ path: "collections.post.workflow", code: "unknown-key" }));
		expect(old).toContainEqual(expect.objectContaining({ path: "collections.post.list", code: "unknown-key" }));
		expect(old).toContainEqual(
			expect.objectContaining({ path: "collections.post.fields.title.required", code: "enum" }),
		);
		const [kind] = problems((schema) => {
			delete schema.collections.post.kind;
		});
		expect(kind?.path).toBe("collections.post.kind");
	});

	it("SCHEMA-F14 checks the shape of values, with paths into arrays", () => {
		expect(
			problems((schema) => {
				schema.admin.templates = "no";
			})[0],
		).toMatchObject({ path: "admin.templates", code: "type" });
		expect(
			problems((schema) => {
				schema.admin.translations = 0;
			})[0]?.path,
		).toBe("admin.translations");
		expect(
			problems((schema) => {
				schema.locales[1].name = 3;
			})[0],
		).toMatchObject({ path: "locales[1].name", code: "type" });
		expect(
			problems((schema) => {
				delete schema.defaultLocale;
			})[0],
		).toMatchObject({ path: "defaultLocale", code: "required" });
		expect(
			problems((schema) => {
				schema.site.localePrefix = "sometimes";
			})[0],
		).toMatchObject({ path: "site.localePrefix", code: "enum" });
		expect(
			problems((schema) => {
				schema.seed.templates[0].id = 7;
			})[0]?.path,
		).toMatch(/^seed\.templates\[0\]/);
	});

	it("SCHEMA-F14 leaves what a value means to defineSite: a select default, a locale code, a time zone", () => {
		expect(() =>
			parseSchemaFile({
				...cloneSchema(),
				timeZone: "Mars/Base",
				locales: [{ code: "EN_us", name: "x" }],
			}),
		).not.toThrow();
	});

	it("SCHEMA-F14 checks a dependent field of a conditional field is a field that stores a value", () => {
		const dependent = problems((schema) => {
			schema.collections.post.fields.policy.values.deprecated.nested = { kind: "view", view: "x" };
		});
		expect(dependent[0]?.message).toContain("a dependent field must be a text, relation, select or media field");
	});

	it("SCHEMA-F14 reports every problem in one error that lists the paths", () => {
		const schema = cloneSchema();
		schema.locales[0].name = 1;
		schema.collections.post.fields.cover.accept = "video";
		try {
			parseSchemaFile(schema, "site/monti.schema.ts");
			expect.unreachable();
		} catch (error) {
			const message = (error as Error).message;
			expect(message).toContain("site/monti.schema.ts is not valid:");
			expect(message).toContain("locales[0].name:");
			expect(message).toContain("collections.post.fields.cover.accept:");
		}
	});

	it("SCHEMA-F14 rejects something that is not an object", () => {
		expect(() => parseSchemaFile([])).toThrow(/\(root\): must be an object/);
		expect(() => parseSchemaFile(null, "x.ts")).toThrow(/x\.ts is not valid/);
	});

	it("SCHEMA-F14 quotes a key that is not a plain name in the path", () => {
		const [issue] = problems((schema) => {
			schema.collections["my.posts"] = { label: "X", kind: "document", fields: { title: { kind: "nope" } } };
		});
		expect(issue?.path).toBe('collections["my.posts"].fields.title.kind');
	});
});

describe("migrations in the schema file", () => {
	const issues = (edit: (schema: EditableSchema) => void) => {
		const schema = cloneSchema();
		edit(schema);
		try {
			parseSchemaFile(schema);
		} catch (error) {
			expect(error).toBeInstanceOf(ConfigError);
			return (error as ConfigError).issues.map((issue) => `${issue.path}: ${issue.message}`);
		}
		throw new Error("the schema was accepted");
	};

	it("SCHEMA-F6 accepts the six transforms", () => {
		const schema = cloneSchema();
		schema.migrations = [
			{ id: "a", op: "renameField", collection: "post", from: "summary", to: "excerpt" },
			{ id: "b", op: "mapOption", collection: "post", field: "policy", from: "x", to: "normal", note: "merged" },
			{ id: "c", op: "dropField", collection: "post", field: "legacy" },
			{ id: "d", op: "setDefault", collection: "post", field: "summary", value: "-" },
			{ id: "e", op: "dropCollection", collection: "memo", note: "no longer used" },
			{ id: "f", op: "trashLocale", locale: "ja", note: "translations to the trash" },
		];
		const parsed = parseSchemaFile(schema);
		expect(parsed.migrations).toEqual(schema.migrations);
	});

	it("SCHEMA-C2 keeps a trashLocale to a language: a collection is not part of it", () => {
		expect(
			issues((schema) => {
				schema.migrations = [{ id: "a", op: "trashLocale", collection: "post", locale: "ja" }];
			}),
		).toEqual(["migrations[0].collection: is not an option (known: id, note, op, locale)"]);
		expect(
			issues((schema) => {
				schema.migrations = [{ id: "a", op: "trashLocale" }];
			})[0],
		).toMatch(/^migrations\[0\]\.locale:/);
	});

	it("SCHEMA-F6 does not need them: a file without transforms is valid", () => {
		const parsed = parseSchemaFile(cloneSchema());
		expect(parsed.migrations).toBeUndefined();
	});

	it("SCHEMA-F6 names the path of a bad transform", () => {
		expect(
			issues((schema) => {
				schema.migrations = [{ id: "a", op: "moveField", collection: "post" }];
			})[0],
		).toMatch(/^migrations\[0\]\.op: /);
		expect(
			issues((schema) => {
				schema.migrations = [{ id: "a", op: "dropField", collection: "post", field: "x", extra: 1 }];
			}),
		).toEqual(["migrations[0].extra: is not an option (known: id, note, collection, op, field)"]);
		expect(
			issues((schema) => {
				schema.migrations = [{ id: "", op: "dropField", collection: "post", field: "x" }];
			})[0],
		).toMatch(/^migrations\[0\]\.id:/);
	});

	it("SCHEMA-F6 rejects an id used twice", () => {
		expect(
			issues((schema) => {
				schema.migrations = [
					{ id: "a", op: "dropField", collection: "post", field: "x" },
					{ id: "a", op: "dropField", collection: "post", field: "y" },
				];
			}),
		).toEqual(['migrations[1].id: "a" is used twice']);
	});
});

describe("the title role in the schema file", () => {
	/** A schema whose posts keep the title in `headline` (`role: "title"`). */
	const renamed = () => {
		const schema = cloneSchema();
		const { title, ...rest } = schema.collections.post.fields;
		schema.collections.post.fields = { headline: { ...title, role: "title" }, ...rest };
		schema.collections.post.fields.slug.from = "headline";
		schema.collections.post.layout = [{ fields: ["headline", "slug", "summary"] }];
		return schema;
	};

	it("SCHEMA-S2 is a field role the format reads, and the config built from the file names the title field by it", () => {
		const file = parseSchemaFile(renamed());
		expect(file.collections.post?.fields.headline).toMatchObject({ kind: "text", role: "title" });
		const config = defineSite({ schema: renamed() as SchemaTypes });
		expect(createSite(config).titleField("post").name).toBe("headline");
		expect(createSite(config).titleField("tag").name).toBe("title");
	});
});
