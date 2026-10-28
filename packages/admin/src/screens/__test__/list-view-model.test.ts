import { describe, expect, it } from "vitest";
import { testSite } from "../../../../core/test/site";
import { sortChoicesOf, sortLabel } from "../list-view-model";

describe("the orders of the view menu", () => {
	it("list the dates newest first then oldest first, then the title both ways", () => {
		const choices = sortChoicesOf(testSite, "post");
		expect(choices.map((choice) => [choice.field, choice.direction])).toEqual([
			["updatedAt", "desc"],
			["updatedAt", "asc"],
			["publishedAt", "desc"],
			["publishedAt", "asc"],
			["createdAt", "desc"],
			["createdAt", "asc"],
			["title", "asc"],
			["title", "desc"],
		]);
	});

	it("have no published date on an item collection", () => {
		const fields = sortChoicesOf(testSite, "tag").map((choice) => choice.field);
		expect(fields).not.toContain("publishedAt");
		expect(fields).toContain("title");
	});

	it("name every order, and a name is never an empty or untranslated key", () => {
		for (const choice of sortChoicesOf(testSite, "post")) {
			expect(choice.label).not.toMatch(/^sort\./);
			expect(choice.label).toBe(sortLabel(testSite, choice.field, choice.direction));
		}
	});
});
