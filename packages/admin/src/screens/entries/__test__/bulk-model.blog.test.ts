// Blog-only: the other site has no backlink and no conditional field, the two kinds a bulk change must leave out.
import { describe, expect, it } from "vitest";
import { testSite } from "../../../../../core/test/site";
import { changeableRelations } from "../bulk-model";

describe("the relation fields a bulk change can reach", () => {
	it("LIST-C4 leave out a backlink and a field that only exists inside a conditional branch", () => {
		const names = changeableRelations(testSite, "post").map((field) => field.name);
		expect(names).toEqual(["categoryId", "tagIds"]);
		expect(names).not.toContain("series");
		expect(names).not.toContain("replacementPostId");
	});
});
