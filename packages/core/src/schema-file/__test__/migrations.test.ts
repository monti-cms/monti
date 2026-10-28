import { describe, expect, it } from "vitest";
import { ConfigError } from "../../config/check/issue";
import { defineSite } from "../../config/define";
import { parseSchemaFile } from "../format";
import type { SchemaTypes } from "../types";
import { cloneSchema, type EditableSchema } from "./fixture";

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

describe("migrations in the schema file", () => {
	it("accepts the five transforms", () => {
		const schema = cloneSchema();
		schema.migrations = [
			{ id: "a", op: "renameField", collection: "post", from: "summary", to: "excerpt" },
			{ id: "b", op: "mapOption", collection: "post", field: "policy", from: "x", to: "normal", note: "merged" },
			{ id: "c", op: "dropField", collection: "post", field: "legacy" },
			{ id: "d", op: "setDefault", collection: "post", field: "summary", value: "-" },
			{ id: "e", op: "dropCollection", collection: "memo", note: "no longer used" },
		];
		const parsed = parseSchemaFile(schema);
		expect(parsed.migrations).toEqual(schema.migrations);
	});

	it("does not need them: a file without transforms is valid", () => {
		const parsed = parseSchemaFile(cloneSchema());
		expect(parsed.migrations).toBeUndefined();
	});

	it("names the path of a bad transform", () => {
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

	it("rejects an id used twice", () => {
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

describe("defineSite with a schema file", () => {
	const fromFile = (edit: (schema: EditableSchema) => void = () => {}) => {
		const schema = cloneSchema();
		edit(schema);
		return schema as SchemaTypes;
	};

	it("leaves the transforms out of the config", () => {
		const config = defineSite({
			schema: fromFile((schema) => {
				schema.migrations = [{ id: "a", op: "dropField", collection: "post", field: "legacy" }];
			}),
		});
		expect(config).not.toHaveProperty("migrations");
	});
});
