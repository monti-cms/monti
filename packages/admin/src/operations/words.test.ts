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

describe("a language in an operation's message", () => {
	it("a code in a message's values is said by its name in the admin's language, never as the code", () => {
		expect(wordsOf("ko", { key: "translations.create", values: { locale: "ja" } })).toBe("일본어 번역 시작");
		expect(wordsOf("en", { key: "translations.create", values: { locale: "ja" } })).toBe(
			"Translation into Japanese started",
		);
		expect(wordsOf("ko", { key: "entries.notSourceLocale", values: { locale: "en", source: "ko" } })).toBe(
			"새 글은 한국어로 씁니다. 영어 글은 번역으로 만듭니다.",
		);
		expect(wordsOf("ko", { key: "trash.localeTaken", values: { locale: "en" } })).toBe("영어 번역이 이미 있습니다.");
	});
});

describe("English numbers", () => {
	it("a count says its noun in the singular for one, and the plural otherwise", () => {
		expect(wordsOf("en", { key: "library.usedBy", values: { count: 1 } })).toBe("1 place");
		expect(wordsOf("en", { key: "library.usedBy", values: { count: 3 } })).toBe("3 places");
		expect(wordsOf("en", { key: "settings.review.sourceDrafts", values: { count: 1 } })).toBe(
			"1 entry without one gets a draft in it.",
		);
		expect(wordsOf("ko", { key: "library.usedBy", values: { count: 1 } })).toBe("1곳");
	});
});
