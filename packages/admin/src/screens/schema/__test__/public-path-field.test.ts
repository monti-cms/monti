import { describe, expect, it } from "vitest";
import { pathOfSegment, segmentOf } from "../public-path-field";

describe("the editable part of a public address", () => {
	it("is what stands between the first slash and /:slug", () => {
		expect(segmentOf("/posts/:slug")).toBe("posts");
		expect(segmentOf("/blog/posts/:slug")).toBe("blog/posts");
		expect(segmentOf("/:slug")).toBe("");
		expect(segmentOf("")).toBe("");
	});

	it("extracts the segment cleanly even without slashes or :slug", () => {
		expect(segmentOf("posts/:slug")).toBe("posts");
		expect(segmentOf("/posts")).toBe("posts");
		expect(segmentOf("posts")).toBe("posts");
	});

	it("makes the address back, without spaces, colons or slashes around it", () => {
		expect(pathOfSegment("posts")).toBe("/posts/:slug");
		expect(pathOfSegment("/blog/posts/")).toBe("/blog/posts/:slug");
		expect(pathOfSegment(" my:notes ")).toBe("/mynotes/:slug");
		expect(pathOfSegment("")).toBe("/:slug");
	});
});
