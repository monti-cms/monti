import { describe, expect, it } from "vitest";
import { CmsError } from "../../store/errors";
import { assertPromotedToCurrent, linkTargetChanged, planPublishAddress, reservationFor } from "../slug-address";

const codeOf = (run: () => unknown) => {
	try {
		run();
	} catch (error) {
		return error instanceof CmsError ? error.code : "other";
	}
	return null;
};

describe("slug reservation", () => {
	it("reserves a slug nobody holds", () => {
		expect(reservationFor("me", null)).toBe("reserve");
	});

	it("keeps a slug the entry already holds, whatever kind of address it is (a publish promotes its own current or alias slug)", () => {
		expect(reservationFor("me", { entryId: "me", type: "reservation" })).toBe("keep");
		expect(reservationFor("me", { entryId: "me", type: "current" })).toBe("keep");
		expect(reservationFor("me", { entryId: "me", type: "alias" })).toBe("keep");
	});

	it("rejects a slug another entry holds, as a reservation, a current address or a former one", () => {
		for (const type of ["reservation", "current", "alias"] as const) {
			expect(codeOf(() => reservationFor("me", { entryId: "other", type }))).toBe("slug_conflict");
		}
	});

	it("rejects a slug kept only to prevent reuse (the entry that held it is deleted)", () => {
		expect(codeOf(() => reservationFor("me", { entryId: null, type: "deleted" }))).toBe("slug_conflict");
	});
});

describe("address change of a publish", () => {
	it("claims the slug of a first publish", () => {
		expect(planPublishAddress(null, "hello")).toEqual({ demoteCurrent: false, promote: true });
	});

	it("changes nothing when the public slug is already the draft's", () => {
		expect(planPublishAddress("hello", "hello")).toEqual({ demoteCurrent: false, promote: false });
	});

	it("turns the old public slug into an alias and claims the new one when the slug changed", () => {
		expect(planPublishAddress("old", "new")).toEqual({ demoteCurrent: true, promote: true });
	});

	it("turns the public slug into an alias when the draft cleared its slug, and claims nothing", () => {
		expect(planPublishAddress("old", null)).toEqual({ demoteCurrent: true, promote: false });
	});

	it("has nothing to do for an entry with no slug before and after", () => {
		expect(planPublishAddress(null, null)).toEqual({ demoteCurrent: false, promote: false });
	});
});

describe("claiming the public slug", () => {
	it("accepts a slug that is now the entry's own current address", () => {
		expect(() => assertPromotedToCurrent("me", { entryId: "me", type: "current" })).not.toThrow();
	});

	it("rejects a slug held by another entry, one that is not current, or one that vanished", () => {
		expect(codeOf(() => assertPromotedToCurrent("me", { entryId: "other", type: "current" }))).toBe("slug_conflict");
		expect(codeOf(() => assertPromotedToCurrent("me", { entryId: "me", type: "alias" }))).toBe("slug_conflict");
		expect(codeOf(() => assertPromotedToCurrent("me", null))).toBe("slug_conflict");
	});
});

describe("internal link target changing during a publish", () => {
	it("is stable when the address is the same before and after", () => {
		expect(linkTargetChanged({ entryId: "a", type: "current" }, { entryId: "a", type: "current" })).toBe(false);
		expect(linkTargetChanged(undefined, undefined)).toBe(false);
	});

	it("changed when the address appeared, vanished, moved to another entry or changed kind", () => {
		expect(linkTargetChanged(undefined, { entryId: "a", type: "current" })).toBe(true);
		expect(linkTargetChanged({ entryId: "a", type: "current" }, undefined)).toBe(true);
		expect(linkTargetChanged({ entryId: "a", type: "current" }, { entryId: "b", type: "current" })).toBe(true);
		expect(linkTargetChanged({ entryId: "a", type: "current" }, { entryId: "a", type: "alias" })).toBe(true);
	});
});
