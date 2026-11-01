import { describe, expect, it } from "vitest";
import { CmsError } from "../../store/errors";
import { assertFolderInCollection, assertNoFolderCycle, assertParentInCollection } from "../folders";

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
