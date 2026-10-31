import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import * as serverEntry from "../server";
import * as browserEntry from "../server.browser";

const manifest = JSON.parse(readFileSync(new URL("../../package.json", import.meta.url), "utf8")) as {
	exports: Record<string, unknown>;
	publishConfig: { exports: Record<string, unknown> };
};

describe("@monti-cms/mdx/server in the browser bundle", () => {
	it("FMT-P1 has a browser condition that points at a stub, in the source and the published exports", () => {
		expect(manifest.exports["./server"]).toMatchObject({ browser: "./src/server.browser.ts" });
		expect(manifest.publishConfig.exports["./server"]).toMatchObject({ browser: "./dist/server.browser.js" });
	});

	it("FMT-P1 is the empty server side, so the MDX parser is not in it", () => {
		expect(browserEntry.default).toEqual({});
		expect(serverEntry.default.formats).toBeTypeOf("function");
	});
});
