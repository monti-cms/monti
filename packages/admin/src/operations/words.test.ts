import { describe, expect, it } from "vitest";
import { wordsOf } from "./admin-context";

describe("whose words a message is read in", () => {
	it("a key is the screen's own word; a message an operation sent is the core's, where both dictionaries have the key", () => {
		// The template editor's button, and the activity log's line for the same key.
		expect(wordsOf("ko", "templates.save")).toBe("저장");
		expect(wordsOf("ko", { key: "templates.save", values: { name: "기본 틀" } })).toBe("템플릿 기본 틀 저장");
		expect(wordsOf("ko", "trash.empty")).toBe("비우기");
		expect(wordsOf("ko", { key: "trash.empty", values: { count: 3 } })).toBe("휴지통 비움: 3개 영구 삭제");
		// A key only one dictionary has reads the same either way.
		expect(wordsOf("ko", { key: "list.untitled" })).toBe(wordsOf("ko", "list.untitled"));
		expect(wordsOf("en", { key: "errors.conflict" })).toBe("Changed in the meantime.");
	});
});
