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
		for (const schemaVersion of [0, 1.5]) {
			const schema = cloneSchema();
			schema.schemaVersion = schemaVersion;
			try {
				defineSite({ schema: schema as SchemaTypes });
				expect.unreachable();
			} catch (error) {
				expect((error as ConfigError).issues).toEqual([
					expect.objectContaining({ path: "schemaVersion", code: "schema-version" }),
				]);
			}
		}
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

describe("defineSite with a schema version", () => {
	const fromFile = (edit: (schema: EditableSchema) => void = () => {}) => {
		const schema = cloneSchema();
		edit(schema);
		return schema as SchemaTypes;
	};

	it("takes the version from the schema file, and leaves the transforms out of the config", () => {
		const config = defineSite({
			schema: fromFile((schema) => {
				schema.schemaVersion = 4;
				schema.migrations = [{ id: "a", op: "dropField", collection: "post", field: "legacy" }];
			}),
		});
		expect(config.schemaVersion).toBe(4);
		expect(config).not.toHaveProperty("migrations");
		expect(defineSite({ schema: fromFile() }).schemaVersion).toBeUndefined();
	});

	it("keeps the version in the file only, and checks a version set in code", () => {
		expect(() => defineSite({ schema: fromFile(), schemaVersion: 2 } as never)).toThrow(/schemaVersion.*schema file/);
		const plain = { collections: cloneSchema().collections, locales: cloneSchema().locales, defaultLocale: "ko" };
		expect(defineSite({ ...plain, schemaVersion: 2 } as never).schemaVersion).toBe(2);
		expect(() => defineSite({ ...plain, schemaVersion: 0 } as never)).toThrow(/whole number from 1/);
	});
});
