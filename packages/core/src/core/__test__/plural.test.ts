import { describe, expect, it } from "vitest";
import { defaultCollectionPath } from "../plural";

describe("defaultCollectionPath", () => {
	it.each([
		["post", "/posts/:slug"],
		["memo", "/memos/:slug"],
		["category", "/categories/:slug"],
		["person", "/people/:slug"],
		["series", "/series/:slug"],
		["blog-post", "/blog-posts/:slug"],
		["blog-posts", "/blog-posts/:slug"],
		["note", "/notes/:slug"],
	])("SCHEMA-N1 %s -> %s", (id, path) => {
		expect(defaultCollectionPath(id)).toBe(path);
	});
});
