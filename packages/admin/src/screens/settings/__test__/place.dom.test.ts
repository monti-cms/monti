import { afterEach, describe, expect, it } from "vitest";
import { rememberScroll, takeScroll } from "../place";

afterEach(() => {
	window.sessionStorage.clear();
	window.history.replaceState(null, "", "/");
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
