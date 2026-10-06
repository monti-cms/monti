import { describe, expect, it } from "vitest";
import { createFormatRegistry, NO_FORMATS } from "../registry";
import { defineFormat } from "../types";

const format = (name: string, withImport = true) =>
	defineFormat({
		name,
		label: name.toUpperCase(),
		mimeType: "text/plain",
		extension: name,
		export: () => "",
		...(withImport ? { import: () => ({ ok: false as const, issues: [] }) } : {}),
	});

describe("the format registry", () => {
	it("finds a format by name and lists them in the order given", () => {
		const registry = createFormatRegistry([format("one"), format("two")]);

		expect(registry.get("two")?.name).toBe("two");
		expect(registry.get("three")).toBeUndefined();
		expect(registry.list().map((item) => item.name)).toEqual(["one", "two"]);
	});

	it("reports what the meta API shows: the file facts, and whether the format can be read back", () => {
		const registry = createFormatRegistry([format("two-way"), format("one-way", false)]);

		expect(registry.info()).toEqual([
			{ name: "two-way", label: "TWO-WAY", mimeType: "text/plain", extension: "two-way", canImport: true },
			{ name: "one-way", label: "ONE-WAY", mimeType: "text/plain", extension: "one-way", canImport: false },
		]);
	});

	it("rejects two formats with one name", () => {
		expect(() => createFormatRegistry([format("same"), format("same")])).toThrow(/"same" is provided twice/);
	});

	it("rejects a name that is not lowercase letters, digits and hyphens", () => {
		for (const name of ["Mdx", "mdx!", "1mdx", "", "m dx"]) {
			expect(() =>
				defineFormat({ name, label: "x", mimeType: "text/plain", extension: "x", export: () => "" }),
			).toThrow(/invalid name/);
		}
	});

	it("brings no format of its own: the default registry is empty", () => {
		expect(NO_FORMATS.list()).toEqual([]);
		expect(NO_FORMATS.get("mdx")).toBeUndefined();
	});
});
