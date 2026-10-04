import { describe, expect, it } from "vitest";
import { diffWords } from "../word-diff";

describe("style polish changes", () => {
	it("finds removed and added text word by word and merges runs of the same kind", () => {
		expect(diffWords("나는 오늘 학교에 갔다.", "나는 어제 학교에 갔다.")).toEqual([
			{ type: "same", text: "나는 " },
			{ type: "del", text: "오늘" },
			{ type: "add", text: "어제" },
			{ type: "same", text: " 학교에 갔다." },
		]);
	});

	it("identical text is one chunk, and empty input leaves only the added text", () => {
		expect(diffWords("그대로", "그대로")).toEqual([{ type: "same", text: "그대로" }]);
		expect(diffWords("", "새 글")).toEqual([{ type: "add", text: "새 글" }]);
	});
});
