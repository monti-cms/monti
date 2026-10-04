import { describe, expect, it } from "vitest";
import { defineMessages, josa, translate } from "../define";

const messages = defineMessages("test", {
	en: { save: "Save", deleted: "Deleted {name}", count: ({ n }) => (Number(n) === 1 ? "1 item" : `${n} items`) },
	ko: { save: "저장", deleted: ({ name }) => `${josa(String(name), "을", "를")} 지웠습니다` },
});

describe("message dictionary", () => {
	it("picks locale dictionary -> English -> key, and fills `{name}` and function messages", () => {
		expect(translate(messages, "ko", "save")).toBe("저장");
		expect(translate(messages, "ko", "deleted", { name: "태그" })).toBe("태그를 지웠습니다");
		expect(translate(messages, "ko", "deleted", { name: "글" })).toBe("글을 지웠습니다");
		expect(translate(messages, "ja", "deleted", { name: "x" })).toBe("Deleted x");
		expect(translate(messages, "ko", "count", { n: 3 })).toBe("3 items");
	});

	it("uses text overridden by the site first", () => {
		expect(translate(messages, "ko", "save", undefined, { test: { save: "보관" } })).toBe("보관");
		expect(translate(messages, "en", "deleted", { name: "a" }, { test: { deleted: "Gone: {name}" } })).toBe("Gone: a");
	});
});
