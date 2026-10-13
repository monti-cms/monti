import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import * as serverEntry from "../server";
import * as browserEntry from "../server.browser";

const manifest = JSON.parse(readFileSync(new URL("../../package.json", import.meta.url), "utf8")) as {
	exports: Record<string, unknown>;
	publishConfig: { exports: Record<string, unknown> };
};

describe("@monti-cms/mdx/server in the browser bundle", () => {
	it("has a browser condition that points at a stub, in the source and the published exports", () => {
		expect(manifest.exports["./server"]).toMatchObject({ browser: "./src/server.browser.ts" });
		expect(manifest.publishConfig.exports["./server"]).toMatchObject({ browser: "./dist/server.browser.js" });
	});

	it("exports the same names as the server entry, so imports resolve either way", () => {
		expect(Object.keys(browserEntry).sort()).toEqual(Object.keys(serverEntry).sort());
	});

	it("does not carry the MDX parser: its functions refuse to run", () => {
		expect(() => browserEntry.createServerMdxFormat()).toThrow(/server only/);
	});
});
