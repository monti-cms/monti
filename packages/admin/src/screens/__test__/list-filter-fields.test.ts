import { describe, expect, it } from "vitest";
import { testSite } from "../../../../core/test/site";
import {
	filterFieldOf,
	filterFieldsOf,
	hasCondition,
	readCondition,
	takesCondition,
	toggleCondition,
	writeCondition,
} from "../list-filter-fields";

describe("the fields the filter menu offers", () => {
	it("are the stored text, media, select and relation fields in schema order, without the title", () => {
		const names = filterFieldsOf(testSite, "post").map((field) => field.name);
		expect(names.slice(0, 5)).toEqual(["summary", "categoryId", "tagIds", "policy", "replacementPostId"]);
		expect(names).not.toContain("title");
	});

	it("leave out an address and a reverse relation, which have no filter", () => {
		const names = filterFieldsOf(testSite, "post").map((field) => field.name);
		expect(names).not.toContain("slug");
		expect(names).not.toContain("series");
	});

	it("carry the label, the kind, the options of a select and the target of a relation", () => {
		expect(filterFieldOf(testSite, "post", "summary")).toMatchObject({ label: "요약", kind: "text" });
		expect(filterFieldOf(testSite, "post", "tagIds")).toMatchObject({ label: "태그", kind: "relation", to: "tag" });
		expect(filterFieldOf(testSite, "post", "policy")).toMatchObject({
			kind: "select",
			options: [
				{ value: "normal", label: "일반" },
				{ value: "evergreen", label: "항상 최신 글" },
				{ value: "deprecated", label: "지원 중단" },
			],
		});
	});

	it("follow the kind inside a conditional field, which comes right after its choice", () => {
		const names = filterFieldsOf(testSite, "post").map((field) => field.name);
		expect(names.indexOf("replacementPostId")).toBe(names.indexOf("policy") + 1);
		expect(filterFieldOf(testSite, "post", "replacementPostId")).toMatchObject({ kind: "relation", to: "post" });
	});

	it("are none for what is not a collection", () => {
		expect(filterFieldsOf(testSite, "nope")).toEqual([]);
	});
});

describe("conditions on a field", () => {
	it("are what the kind takes: text and media only empty, select and relation empty or an item", () => {
		expect([takesCondition("text", "empty"), takesCondition("text", "filled"), takesCondition("text", "is")]).toEqual([
			true,
			false,
			false,
		]);
		expect([takesCondition("media", "empty"), takesCondition("media", "filled")]).toEqual([true, false]);
		expect([takesCondition("select", "is"), takesCondition("select", "filled")]).toEqual([true, false]);
		expect([takesCondition("relation", "is"), takesCondition("relation", "filled")]).toEqual([true, false]);
	});

	it("are ticked and unticked one by one, several at once", () => {
		let conditions = toggleCondition(undefined, { kind: "empty" });
		conditions = toggleCondition(conditions, { kind: "is", value: "a" });
		conditions = toggleCondition(conditions, { kind: "is", value: "b" });
		expect(conditions).toEqual([{ kind: "empty" }, { kind: "is", value: "a" }, { kind: "is", value: "b" }]);
		conditions = toggleCondition(conditions, { kind: "is", value: "a" });
		expect(hasCondition(conditions, { kind: "is", value: "a" })).toBe(false);
		expect(hasCondition(conditions, { kind: "is", value: "b" })).toBe(true);
		expect(toggleCondition([{ kind: "empty" }], { kind: "empty" })).toEqual([]);
	});

	it("take empty and filled as opposites: ticking one drops the other", () => {
		expect(toggleCondition([{ kind: "empty" }], { kind: "filled" })).toEqual([{ kind: "filled" }]);
		expect(toggleCondition([{ kind: "filled" }], { kind: "empty" })).toEqual([{ kind: "empty" }]);
	});

	it("are written and read as the address and the API write them", () => {
		for (const [name, condition, raw] of [
			["tagIds", { kind: "empty" }, "tagIds:empty"],
			["summary", { kind: "filled" }, "summary:filled"],
			["policy", { kind: "is", value: "a:b" }, "policy:is:a:b"],
		] as const) {
			expect(writeCondition(name, condition)).toBe(raw);
			expect(readCondition(raw)).toEqual({ name, condition });
		}
		for (const raw of [
			"",
			"tagIds",
			"tagIds:",
			"tagIds:maybe",
			"tagIds:is",
			"tagIds:is:",
			"tagIds:empty:x",
			":empty",
		]) {
			expect(readCondition(raw), raw).toBeNull();
		}
	});
});
