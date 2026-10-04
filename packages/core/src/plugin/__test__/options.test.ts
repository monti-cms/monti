import { describe, expect, it, vi } from "vitest";

vi.mock("../../config/resolved", () => ({
	cmsConfig: {
		plugins: [
			{ name: "color", options: { palette: ["red"] } },
			{ name: "seo", options: {} },
		],
	},
}));

import { getPluginOptions } from "../options";

describe("getPluginOptions", () => {
	it("returns the options of the plugin with that name", () => {
		expect(getPluginOptions<{ palette: string[] }>("color")).toEqual({ palette: ["red"] });
	});

	it("is undefined for a plugin the site config does not list", () => {
		expect(getPluginOptions("ai")).toBeUndefined();
	});
});
