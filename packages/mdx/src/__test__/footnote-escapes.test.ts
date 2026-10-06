import { describe, expect, it } from "vitest";
import { contentCollection, prepareSnapshot } from "./snapshot-helpers";

describe("footnote markers in MDX text", () => {
	it("does not mistake an escaped marker or inline code for a missing definition", async () => {
		const snapshot = await prepareSnapshot({
			collection: contentCollection,
			slug: "footnotes",
			metadata: { title: "Footnotes" },
			format: "mdx",
			body: "\\[^a] and `[^b]`\n",
		} as never);
		expect((snapshot.warnings ?? []).filter((warning) => warning.code.startsWith("footnote_"))).toEqual([]);
	});
});
