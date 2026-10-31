import { describe, expect, it } from "vitest";
import { addressOfTab, tabOfPath } from "../place";

describe("tabOfPath", () => {
	it("ADMIN-U1 reads the tab from the last segment, under any admin path or base path", () => {
		expect(tabOfPath("/admin/settings/locales")).toBe("locales");
		expect(tabOfPath("/blog/cms/settings/collections")).toBe("collections");
		expect(tabOfPath("/admin/settings")).toBeUndefined();
		expect(tabOfPath("/admin/settings/nope")).toBeUndefined();
	});
});

describe("addressOfTab", () => {
	it("ADMIN-U1 swaps the last segment for the tab and keeps the query", () => {
		expect(addressOfTab("/admin/settings/site", "?collection=post&section=fields", "collections")).toBe(
			"/admin/settings/collections?collection=post&section=fields",
		);
		expect(addressOfTab("/x/admin/settings/site", "", "admin")).toBe("/x/admin/settings/admin");
	});
});
