import { describe, expect, it } from "vitest";
import { defineConfig } from "../../config/define";
import { parseSchemaFile, SchemaFileError } from "../format";
import type { SchemaInput } from "../types";
import { cloneSchema, type EditableSchema } from "./fixture";

const issues = (edit: (schema: EditableSchema) => void) => {
	const schema = cloneSchema();
	edit(schema);
	try {
		parseSchemaFile(schema);
	} catch (error) {
		expect(error).toBeInstanceOf(SchemaFileError);
		return (error as SchemaFileError).issues.map((issue) => `${issue.path}: ${issue.message}`);
	}
	throw new Error("the schema was accepted");
};

describe("schemaVersion and migrations in the schema file", () => {
	it("accepts a schema version and the four transforms", () => {
		const schema = cloneSchema();
		schema.schemaVersion = 3;
		schema.migrations = [
			{ id: "a", op: "renameField", collection: "post", from: "summary", to: "excerpt" },
			{ id: "b", op: "mapOption", collection: "post", field: "policy", from: "x", to: "normal", note: "merged" },
			{ id: "c", op: "dropField", collection: "post", field: "legacy" },
			{ id: "d", op: "setDefault", collection: "post", field: "summary", value: "-" },
		];
		const parsed = parseSchemaFile(schema);
		expect(parsed.schemaVersion).toBe(3);
		expect(parsed.migrations).toEqual(schema.migrations);
	});

	it("does not need either: a file without them is valid (version 1, no transforms)", () => {
		const parsed = parseSchemaFile(cloneSchema());
		expect(parsed.schemaVersion).toBeUndefined();
		expect(parsed.migrations).toBeUndefined();
	});

	it("names the path of a bad version or transform", () => {
		expect(
			issues((schema) => {
				schema.schemaVersion = 0;
			}),
		).toEqual(["schemaVersion: Too small: expected number to be >=1"]);
		expect(
			issues((schema) => {
				schema.schemaVersion = 1.5;
			})[0],
		).toMatch(/^schemaVersion:/);
		expect(
			issues((schema) => {
				schema.migrations = [{ id: "a", op: "moveField", collection: "post" }];
			})[0],
		).toMatch(/^migrations\[0\]\.op: /);
		expect(
			issues((schema) => {
				schema.migrations = [{ id: "a", op: "dropField", collection: "post", field: "x", extra: 1 }];
			}),
		).toEqual(["migrations[0].extra: is not part of the schema format"]);
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

describe("defineConfig with a schema version", () => {
	const fromFile = (edit: (schema: EditableSchema) => void = () => {}) => {
		const schema = cloneSchema();
		edit(schema);
		return schema as SchemaInput;
	};

	it("takes the version from the schema file, and leaves the transforms out of the config", () => {
		const config = defineConfig({
			schema: fromFile((schema) => {
				schema.schemaVersion = 4;
				schema.migrations = [{ id: "a", op: "dropField", collection: "post", field: "legacy" }];
			}),
		});
		expect(config.schemaVersion).toBe(4);
		expect(config).not.toHaveProperty("migrations");
		expect(defineConfig({ schema: fromFile() }).schemaVersion).toBeUndefined();
	});

	it("keeps the version in the file only, and checks a version set in code", () => {
		expect(() => defineConfig({ schema: fromFile(), schemaVersion: 2 } as never)).toThrow(/schemaVersion.*schema file/);
		const plain = { collections: cloneSchema().collections, locales: cloneSchema().locales, defaultLocale: "ko" };
		expect(defineConfig({ ...plain, schemaVersion: 2 } as never).schemaVersion).toBe(2);
		expect(() => defineConfig({ ...plain, schemaVersion: 0 } as never)).toThrow(/whole number from 1/);
	});
});
