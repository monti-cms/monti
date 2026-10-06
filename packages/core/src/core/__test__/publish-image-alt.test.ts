import { describe, expect, it } from "vitest";
import { contentCollection } from "../../../test/any-site";
import { prepareSnapshot, validateForPublish } from "../snapshot";

describe("publish validation of images", () => {
	it("blocks publishing an image without alt", async () => {
		// The required-attribute checks for blog-specific blocks (tabs, tooltip, alignment) live in `review-regressions.blog.test.ts`.
		const mdx = '<Image mediaId="11111111-1111-4111-8111-111111111111" />';
		const snapshot = await prepareSnapshot({ collection: contentCollection, slug: "m", metadata: { title: "m" }, mdx });
		const result = validateForPublish(snapshot, {
			targets: [],
			media: [{ id: "11111111-1111-4111-8111-111111111111" }],
		});
		expect(result.ready).toBe(false);
		expect(result.issues.map((issue) => issue.code)).toContain("missing_image_alt");
	});
});
