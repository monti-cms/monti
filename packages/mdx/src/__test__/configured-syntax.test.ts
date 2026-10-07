import { createSite } from "@monti-cms/core/client";
import { describe, expect, it } from "vitest";
import { testConfig } from "../../../core/test/site";
import { createMdxFormat } from "../format";
import { mdx } from "../plugin";
import type { SyntaxExtension } from "../syntax/types";
import { configuredSyntax, NO_SYNTAX } from "../syntax-config";

/** A site of the test config with exactly the given plugins. */
const siteWith = (plugins: ReturnType<typeof mdx>[]) => createSite({ ...testConfig, plugins });

// The options the site gave to its `mdx()` plugin are read from the site config's plugins (`site.getPluginOptions`).
describe("configuredSyntax", () => {
	it("is the list the site gave to mdx({ syntax }), in the same order", () => {
		const first: SyntaxExtension = { name: "first" };
		const second: SyntaxExtension = { name: "second" };
		const site = siteWith([mdx({ syntax: [first, second] })]);
		expect(configuredSyntax(site)).toEqual([first, second]);
		expect(configuredSyntax(site)[0]).toBe(first);
	});

	it("is no extension when the site has no mdx() plugin, or gave it none", () => {
		expect(configuredSyntax(siteWith([]))).toBe(NO_SYNTAX);
		expect(configuredSyntax(siteWith([mdx()]))).toBe(NO_SYNTAX);
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
