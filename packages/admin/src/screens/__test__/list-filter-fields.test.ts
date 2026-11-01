import { describe, expect, it } from "vitest";
import {
	filterFieldOf,
	filterFieldsOf,
	hasCondition,
	readCondition,
	takesCondition,
	toggleCondition,
	writeCondition,
} from "../list-filter-fields";
import { listSite } from "./list-site";

const site = listSite();

describe("the fields the filter menu offers", () => {
	it("LIST-F2 are the stored text, media, select and relation fields in schema order, without the title", () => {
		const names = filterFieldsOf(site, "story").map((field) => field.name);
		expect(names).toEqual(["lede", "deskId", "labelIds", "state", "successorId", "cover"]);
	});

	it("LIST-F2 leave out an address and a reverse relation, which have no filter", () => {
		const names = filterFieldsOf(site, "story").map((field) => field.name);
		expect(names).not.toContain("slug");
		expect(names).not.toContain("shelves");
	});

	it("LIST-F2 carry the label, the kind, the options of a select and the target of a relation", () => {
		expect(filterFieldOf(site, "story", "lede")).toMatchObject({ label: "Lede", kind: "text" });
		expect(filterFieldOf(site, "story", "cover")).toMatchObject({ label: "Cover", kind: "media" });
		expect(filterFieldOf(site, "story", "labelIds")).toMatchObject({ label: "Labels", kind: "relation", to: "label" });
		expect(filterFieldOf(site, "story", "state")).toMatchObject({
			kind: "select",
			options: [
				{ value: "live", label: "Live" },
				{ value: "stale", label: "Stale" },
				{ value: "gone", label: "Gone" },
			],
		});
	});

	it("LIST-F2 follow the kind inside a conditional field, which comes right after its choice", () => {
		const names = filterFieldsOf(site, "story").map((field) => field.name);
		expect(names.indexOf("successorId")).toBe(names.indexOf("state") + 1);
		expect(filterFieldOf(site, "story", "successorId")).toMatchObject({ kind: "relation", to: "story" });
	});

	it("LIST-F2 are none for what is not a collection", () => {
		expect(filterFieldsOf(site, "nope")).toEqual([]);
	});
});

describe("conditions on a field", () => {
	it("LIST-F2 are what the kind takes: text and media only empty, select and relation empty or an item", () => {
		expect([takesCondition("text", "empty"), takesCondition("text", "filled"), takesCondition("text", "is")]).toEqual([
			true,
			false,
			false,
		]);
		expect([takesCondition("media", "empty"), takesCondition("media", "filled")]).toEqual([true, false]);
		expect([takesCondition("select", "is"), takesCondition("select", "filled")]).toEqual([true, false]);
		expect([takesCondition("relation", "is"), takesCondition("relation", "filled")]).toEqual([true, false]);
	});

	it("LIST-F2 are ticked and unticked one by one, several at once", () => {
		let conditions = toggleCondition(undefined, { kind: "empty" });
		conditions = toggleCondition(conditions, { kind: "is", value: "a" });
		conditions = toggleCondition(conditions, { kind: "is", value: "b" });
		expect(conditions).toEqual([{ kind: "empty" }, { kind: "is", value: "a" }, { kind: "is", value: "b" }]);
		conditions = toggleCondition(conditions, { kind: "is", value: "a" });
		expect(hasCondition(conditions, { kind: "is", value: "a" })).toBe(false);
		expect(hasCondition(conditions, { kind: "is", value: "b" })).toBe(true);
		expect(toggleCondition([{ kind: "empty" }], { kind: "empty" })).toEqual([]);
	});

	it("LIST-F5 are written and read as the address and the API write them", () => {
		for (const [name, condition, raw] of [
			["labelIds", { kind: "empty" }, "labelIds:empty"],
			["lede", { kind: "filled" }, "lede:filled"],
			["state", { kind: "is", value: "a:b" }, "state:is:a:b"],
		] as const) {
			expect(writeCondition(name, condition)).toBe(raw);
			expect(readCondition(raw)).toEqual({ name, condition });
		}
		for (const raw of [
			"",
			"labelIds",
			"labelIds:",
			"labelIds:maybe",
			"labelIds:is",
			"labelIds:is:",
			"labelIds:empty:x",
			":empty",
		]) {
			expect(readCondition(raw), raw).toBeNull();
		}
	});
});
