import { describe, expect, it } from "vitest";
import { slugify } from "../slug";

describe("Editor Workflow & Slugify Contract", () => {
	it("slugifies English and special characters cleanly", () => {
		expect(slugify("Hello World! 2026")).toBe("hello-world-2026");
		expect(slugify("Exploring Keystatic & Tiptap...")).toBe("exploring-keystatic-tiptap");
	});

	it("preserves Korean characters properly without encoding into % escape", () => {
		expect(slugify("안녕하세요 새로운 블로그 포스트")).toBe("안녕하세요-새로운-블로그-포스트");
		expect(slugify("Next.js 16과 React 19 에디터")).toBe("nextjs-16과-react-19-에디터");
	});

	it("handles empty or punctuation-only strings safely", () => {
		expect(slugify("")).toBe("");
		expect(slugify("   ")).toBe("");
		expect(slugify("!@#$%^&*()")).toBe("");
	});
});
