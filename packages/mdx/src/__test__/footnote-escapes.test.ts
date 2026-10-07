import { createFormatRegistry } from "@monti-cms/core/format";
import { describe, expect, it } from "vitest";
import { prepareSnapshot } from "../../../core/src/core/snapshot";
import { contentCollection } from "../../../core/test/any-site";
import { testSite } from "../../../core/test/site";
import { mdxFormat } from "../format";

describe("footnote markers in MDX text", () => {
	it("does not mistake an escaped marker or inline code for a missing definition", async () => {
		const snapshot = await prepareSnapshot(
			testSite,
			{
				collection: contentCollection,
				slug: "footnotes",
				metadata: { title: "Footnotes" },
				format: "mdx",
				body: "\\[^a] and `[^b]`\n",
			} as never,
			{ import: { formats: createFormatRegistry([mdxFormat]) } },
		);
		expect((snapshot.warnings ?? []).filter((warning) => warning.code.startsWith("footnote_"))).toEqual([]);
	});
});
