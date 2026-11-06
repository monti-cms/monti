import { describe, expect, it } from "vitest";
import type { Schema } from "../schema/define";
import { publicPath } from "./paths";

const schema: Schema = {
	locales: { source: "ko", list: [{ code: "ko", name: "한국어" }], prefix: "never" },
	collections: {
		post: { kind: "document", path: "/posts/:slug", fields: {} },
		category: { kind: "item", fields: {} },
	},
};

describe("publicPath", () => {
	it("returns no URL for an item collection without a public page", () => {
		expect(publicPath(schema, "category", "development")).toBeNull();
		expect(publicPath(schema, "post", "hello")).toBe("/posts/hello");
	});
});
