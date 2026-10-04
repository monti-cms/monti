import { describe, expect, it } from "vitest";
import { diffWords } from "../word-diff";

describe("문체 다듬기 바뀐 곳", () => {
	it("낱말 단위로 빠진 글과 더한 글을 찾고, 같은 종류는 합친다", () => {
		expect(diffWords("나는 오늘 학교에 갔다.", "나는 어제 학교에 갔다.")).toEqual([
			{ type: "same", text: "나는 " },
			{ type: "del", text: "오늘" },
			{ type: "add", text: "어제" },
			{ type: "same", text: " 학교에 갔다." },
		]);
	});

	it("같으면 한 덩어리, 비면 더한 글뿐이다", () => {
		expect(diffWords("그대로", "그대로")).toEqual([{ type: "same", text: "그대로" }]);
		expect(diffWords("", "새 글")).toEqual([{ type: "add", text: "새 글" }]);
	});
});
