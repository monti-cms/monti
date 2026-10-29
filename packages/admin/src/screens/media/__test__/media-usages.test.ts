import { describe, expect, it } from "vitest";
import { contentCollection } from "../../../../../core/test/any-site";
import { testSite } from "../../../../../core/test/site";
import { mediaUsages, placeNamer } from "../media-item";
import { mediaMessages } from "../messages";

const t = testSite.createTranslator(mediaMessages);
const titleField =
	Object.entries(testSite.schemaOf(contentCollection).fields).find(([, field]) => field.kind === "text")?.[0] ??
	"title";

describe("grouping media usages", () => {
	it("lists a post once even when its draft and published version both use the file, merging their places", () => {
		const usages = mediaUsages(
			{
				references: [
					{
						entryId: "a",
						title: "발행한 글",
						collection: contentCollection,
						state: "published",
						occurrences: [{ type: "body" }],
					},
					{
						entryId: "a",
						title: "발행한 글",
						collection: contentCollection,
						state: "working",
						occurrences: [
							{ type: "metadata", path: titleField },
							{ type: "body", blockId: "b1" },
						],
					},
					{
						entryId: "b",
						title: "새 글",
						collection: contentCollection,
						state: "working",
						occurrences: [{ type: "body" }],
					},
				],
			},
			placeNamer(testSite, t),
		);
		expect(usages.map((usage) => usage.entryId)).toEqual(["a", "b"]);
		// The draft's places come first, and each place is named once: the field by its label, the body as the body.
		const fieldLabel = testSite.schemaOf(contentCollection).fields[titleField]?.label;
		expect(usages[0]?.places).toEqual([fieldLabel, t("usage.place.body")]);
		expect(usages[1]?.places).toEqual([t("usage.place.body")]);
	});

	it("names no place when the server gives none", () => {
		const [usage] = mediaUsages(
			{ references: [{ entryId: "a", title: "글", collection: contentCollection, state: "working" }] },
			placeNamer(testSite, t),
		);
		expect(usage?.places).toEqual([]);
	});
});
