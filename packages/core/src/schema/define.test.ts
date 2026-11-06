import { describe, expect, it } from "vitest";
import { checkSchema, type Schema } from "./define";

describe("collection public paths", () => {
	it("allows an item without a public path and still requires one for a document", () => {
		const withoutPath = {
			locales: { source: "ko", list: [{ code: "ko", name: "한국어" }], prefix: "never" },
			collections: {
				category: {
					kind: "item",
					fields: {
						title: { kind: "text", required: true },
						slug: { kind: "slug", required: true },
					},
				},
			},
		} satisfies Schema;

		expect(checkSchema(withoutPath)).toEqual([]);
		expect(
			checkSchema({
				...withoutPath,
				collections: { category: { ...withoutPath.collections.category, kind: "document" } },
			} as unknown as Schema),
		).toContainEqual({ collection: "category", code: "badPath" });
	});
});
