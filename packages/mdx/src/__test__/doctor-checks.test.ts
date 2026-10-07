import { fakeCms } from "@monti-cms/core/testing";
import { describe, expect, it } from "vitest";
import { testConfig } from "../../../core/test/site";
import { mdx } from "../plugin";
import mdxServer, { createServerMdxFormat } from "../server";
import type { SyntaxExtension } from "../syntax/types";

/** The checks of the MDX plugin for `monti doctor`: the format is registered, and the syntax extensions load. */

const checks = mdxServer.checks ?? [];

const run = (id: string, plugins: ReturnType<typeof mdx>[], withFormat = true) => {
	const check = checks.find((item) => item.id === id);
	if (!check) throw new Error(`no check ${id}`);
	const config = { ...testConfig, plugins };
	return Promise.resolve(
		check.run({
			cms: fakeCms({ config, ...(withFormat ? { formats: [createServerMdxFormat()] } : {}) }),
			cwd: "/app",
			env: {},
			online: false,
		}),
	);
};

describe("mdx checks for monti doctor", () => {
	it("is the plugin's server side, so the core finds the checks through `plugin.server`", async () => {
		expect(checks.map((item) => item.id)).toEqual(["format", "syntax"]);
		expect(mdx().server).toBeTypeOf("function");
		expect((await mdx().server?.())?.default).toBe(mdxServer);
	});

	it("passes when the mdx format is registered, and fails with what to add when it is not", async () => {
		expect((await run("format", [mdx()])).status).toBe("ok");
		const missing = await run("format", [], false);
		expect(missing.status).toBe("fail");
		expect(missing.where).toContain("plugins");
		expect(missing.fix).toContain("mdx()");
	});

	it("passes with no syntax extension, and with extensions that load", async () => {
		expect(await run("syntax", [mdx()])).toMatchObject({
			status: "ok",
			message: expect.stringContaining("standard MDX"),
		});
		const fine: SyntaxExtension = { name: "fine" };
		const result = await run("syntax", [mdx({ syntax: [fine] })]);
		expect(result.status).toBe("ok");
		expect(result.message).toContain("fine");
	});

	it("fails and names the option when an extension cannot be built", async () => {
		const broken: SyntaxExtension = {
			name: "broken",
			remarkPlugins: () => {
				throw new Error("cannot build the parser");
			},
		};
		const result = await run("syntax", [mdx({ syntax: [broken] })]);
		expect(result.status).toBe("fail");
		expect(result.message).toContain("cannot build the parser");
		expect(result.where).toContain("syntax");
		expect(result.fix).toContain("install it");
	});
});
