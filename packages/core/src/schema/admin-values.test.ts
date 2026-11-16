import { describe, expect, it } from "vitest";
import { AdminValues, AdminValuesPatch, COLLECTION_ICONS, diffAdminValues, mergeAdminValues } from "./admin-values";

describe("a collection's icon", () => {
	it("is one of a fixed list of about twenty, and nothing else is stored", () => {
		expect(COLLECTION_ICONS.length).toBeGreaterThanOrEqual(18);
		expect(new Set(COLLECTION_ICONS).size).toBe(COLLECTION_ICONS.length);
		expect(AdminValues.parse({ icon: "book" })).toEqual({ icon: "book" });
		expect(AdminValues.safeParse({ icon: "rocket-ship" }).success).toBe(false);
		expect(AdminValuesPatch.safeParse({ icon: "rocket-ship" }).success).toBe(false);
	});

	it("a patch sets it, another patch that leaves it out keeps it, and null takes it away", () => {
		const set = mergeAdminValues({ label: "시리즈" }, { icon: "book" });
		expect(set).toEqual({ label: "시리즈", icon: "book" });
		expect(mergeAdminValues(set, { label: "연재" })).toEqual({ label: "연재", icon: "book" });
		expect(mergeAdminValues(set, { icon: null })).toEqual({ label: "시리즈" });
	});

	it("the patch a screen sends names the icon only when it changed", () => {
		expect(diffAdminValues({ label: "태그" }, { label: "태그", icon: "tag" })).toEqual({ icon: "tag" });
		expect(diffAdminValues({ icon: "tag" }, { icon: "user" })).toEqual({ icon: "user" });
		expect(diffAdminValues({ icon: "tag" }, {})).toEqual({ icon: null });
		expect(diffAdminValues({ icon: "tag" }, { icon: "tag" })).toEqual({});
	});
});
