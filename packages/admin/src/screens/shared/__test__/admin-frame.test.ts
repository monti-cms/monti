import { describe, expect, it } from "vitest";
import { testSite } from "../../../../../core/test/site";
import { BUILT_IN_TOOLS } from "../../tools/tools-tabs";
import { frameScreenContext } from "../admin-frame";

describe("the screen context of a frame page", () => {
	it("PLUG-A5 names the collection on a list", () => {
		for (const collection of testSite.COLLECTIONS)
			expect(frameScreenContext(testSite, collection)).toEqual({ screen: "entries", collection });
	});

	it("PLUG-A5 names the media screen and the settings screen", () => {
		expect(frameScreenContext(testSite, "media")).toEqual({ screen: "media" });
		expect(frameScreenContext(testSite, "settings")).toEqual({ screen: "settings" });
	});

	it("PLUG-A5 takes the trash for a list of entries, and every other page for `other`", () => {
		expect(frameScreenContext(testSite, "trash")).toEqual({ screen: "entries" });
		for (const tool of [...BUILT_IN_TOOLS, "tools:ai" as const])
			expect(frameScreenContext(testSite, tool), tool).toEqual({ screen: "other" });
	});
});
