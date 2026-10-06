import { describe, expect, it, vi } from "vitest";

const options = vi.hoisted(() => ({ current: undefined as unknown }));

// The options the site gave to its `mdx()` plugin are read from the site config's plugins (`getPluginOptions`).
vi.mock("@monti-cms/core/client", async (importOriginal) => ({
	...(await importOriginal<typeof import("@monti-cms/core/client")>()),
	getPluginOptions: (name: string) => (name === "mdx" ? options.current : undefined),
}));

const { configuredSyntax, NO_SYNTAX } = await import("../syntax-config");
const { createMdxFormat } = await import("../format");

describe("configuredSyntax", () => {
	it("is the list the site gave to mdx({ syntax }), in the same order", () => {
		const first = { name: "first" };
		const second = { name: "second" };
		options.current = { syntax: [first, second] };
		expect(configuredSyntax()).toEqual([first, second]);
		expect(configuredSyntax()[0]).toBe(first);
	});

	it("is no extension when the site has no mdx() plugin, or gave it none", () => {
		options.current = undefined;
		expect(configuredSyntax()).toBe(NO_SYNTAX);
		options.current = {};
		expect(configuredSyntax()).toBe(NO_SYNTAX);
		expect(NO_SYNTAX).toHaveLength(0);
	});
});

describe("createMdxFormat with syntax", () => {
	it("is the same format whatever the extensions, and reads standard MDX with none", async () => {
		const plain = createMdxFormat();
		const extended = createMdxFormat({ syntax: [{ name: "none" }] });
		expect(extended).toMatchObject({ name: plain.name, extension: plain.extension, mimeType: plain.mimeType });
	});
});
