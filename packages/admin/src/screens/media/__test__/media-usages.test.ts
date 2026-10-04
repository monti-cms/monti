import { describe, expect, it } from "vitest";
import { mediaUsages } from "../media-item";

describe("미디어 사용처 묶기", () => {
	it("초안과 공개본에서 함께 쓰는 글은 한 번만, 한쪽에서만 쓰면 안내를 붙인다", () => {
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
