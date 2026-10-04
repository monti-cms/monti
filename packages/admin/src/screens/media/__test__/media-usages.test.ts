import { describe, expect, it } from "vitest";
import { mediaUsages } from "../media-item";

describe("grouping media usages", () => {
	it("a post used by both draft and published version counts once; one used on a single side gets a note", () => {
		const usages = mediaUsages({
			references: [
				{ entryId: "a", title: "발행한 글", collection: "post", state: "working" },
				{ entryId: "a", title: "발행한 글", collection: "post", state: "published" },
				{ entryId: "b", title: "새 글", collection: "post", state: "working" },
				{ entryId: "c", title: "뺀 글", collection: "post", state: "published" },
			],
		});
		expect(usages).toEqual([
			{ entryId: "a", title: "발행한 글", collection: "post" },
			{ entryId: "b", title: "새 글", collection: "post", note: "beforePublish" },
			{ entryId: "c", title: "뺀 글", collection: "post", note: "publishedOnly" },
		]);
	});
});
