import { describe, expect, it } from "vitest";
import { CmsError } from "../../store/errors";
import { assertFolderInCollection, assertNoFolderCycle, assertParentInCollection } from "../folders";
import { normalizeMetadata } from "../metadata";

const codeOf = (run: () => unknown) => {
	try {
		run();
	} catch (error) {
		return error instanceof CmsError ? { code: error.code } : "other";
	}
	return null;
};

describe("folders", () => {
	it("LIST-F6 an entry goes in a folder of its own collection", () => {
		expect(codeOf(() => assertFolderInCollection("post", "post"))).toBeNull();
		expect(codeOf(() => assertFolderInCollection("tag", "post"))).toMatchObject({ code: "invalid_input" });
		expect(codeOf(() => assertFolderInCollection(undefined, "post"))).toMatchObject({ code: "invalid_input" });
	});

	it("LIST-F6 a folder nests under a parent of its own collection", () => {
		expect(codeOf(() => assertParentInCollection("post", "post"))).toBeNull();
		expect(codeOf(() => assertParentInCollection("tag", "post"))).toMatchObject({ code: "invalid_input" });
		expect(codeOf(() => assertParentInCollection(undefined, "post"))).toMatchObject({ code: "invalid_input" });
	});

	it("LIST-F6 a folder cannot move under itself or under one of its descendants", () => {
		expect(codeOf(() => assertNoFolderCycle("f", ["parent", "grandparent"]))).toBeNull();
		expect(codeOf(() => assertNoFolderCycle("f", ["f"]))).toMatchObject({ code: "invalid_input" });
		expect(codeOf(() => assertNoFolderCycle("f", ["child", "f"]))).toMatchObject({ code: "invalid_input" });
	});
});

describe("metadata", () => {
	it("keeps JSON values and orders object keys, so equal metadata is equal however it was built", () => {
		const normalized = normalizeMetadata({ b: 1, a: { d: [1, "x", null, true], c: "y" } });
		expect(JSON.stringify(normalized)).toBe('{"a":{"c":"y","d":[1,"x",null,true]},"b":1}');
	});

	it("WRITE-S7 accepts an object with no prototype and a key named __proto__ as plain data", () => {
		const input = JSON.parse('{"__proto__": {"x": 1}, "constructor": "c"}');
		const normalized = normalizeMetadata(input);
		expect(Object.keys(normalized).sort()).toEqual(["__proto__", "constructor"]);
		expect(Object.getPrototypeOf(normalized)).toBe(Object.prototype);
	});

	it("WRITE-S7 rejects what is not a plain JSON object with invalid_input", () => {
		for (const input of [
			null,
			[],
			"text",
			1,
			new Date(),
			new Map(),
			{ a: Number.NaN },
			{ a: Number.POSITIVE_INFINITY },
			{ a: () => 1 },
			{ a: undefined },
			{ a: new Date() },
		]) {
			expect(codeOf(() => normalizeMetadata(input))).toMatchObject({ code: "invalid_input" });
		}
	});
});
