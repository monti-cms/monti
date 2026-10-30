import { afterEach, describe, expect, it } from "vitest";
import { addressOfTab, rememberScroll, tabOfPath, takeScroll } from "../place";

afterEach(() => {
	window.sessionStorage.clear();
	window.history.replaceState(null, "", "/");
});

describe("tabOfPath", () => {
	it("reads the tab from the last segment, under any admin path or base path", () => {
		expect(tabOfPath("/admin/settings/locales")).toBe("locales");
		expect(tabOfPath("/blog/cms/settings/collections")).toBe("collections");
		expect(tabOfPath("/admin/settings")).toBeUndefined();
		expect(tabOfPath("/admin/settings/nope")).toBeUndefined();
	});
});

describe("addressOfTab", () => {
	it("swaps the last segment for the tab and keeps the query", () => {
		expect(addressOfTab("/admin/settings/site", "?collection=post&section=fields", "collections")).toBe(
			"/admin/settings/collections?collection=post&section=fields",
		);
		expect(addressOfTab("/x/admin/settings/site", "", "admin")).toBe("/x/admin/settings/admin");
	});
});

describe("scroll after a save", () => {
	it("comes back once, for the same address only", () => {
		window.history.replaceState(null, "", "/admin/settings/collections?collection=post");
		rememberScroll(240);
		expect(takeScroll()).toBe(240);
		expect(takeScroll()).toBeNull();

		rememberScroll(90);
		window.history.replaceState(null, "", "/admin/settings/site");
		expect(takeScroll()).toBeNull();
	});
});
