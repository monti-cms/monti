import { ADMIN_LANGUAGE } from "@monti-cms/core/client";
import { describe, expect, it } from "vitest";
import { cmsApiErrorMessage, cmsApiIssues, cmsIssueMessage } from "../api-error-message";

describe.runIf(ADMIN_LANGUAGE === "ko")("publish feedback", () => {
	it("keeps field paths for inline validation", () => {
		const payload = {
			issues: [
				{ code: "missing_field", path: "title", message: "제목" },
				{ code: "missing_field", path: "categoryId", message: "카테고리" },
			],
		};
		expect(cmsApiIssues(payload)).toEqual(payload.issues);
		expect(cmsApiErrorMessage(payload, "실패")).toContain("제목을 입력하세요. (title)");
		expect(cmsIssueMessage(payload.issues[1])).toBe("카테고리를 입력하세요. (categoryId)");
		expect(cmsIssueMessage({ code: "missing_field", path: "summary", message: "요약" })).toBe(
			"요약을 입력하세요. (summary)",
		);
		expect(cmsIssueMessage({ code: "missing_field", path: "x" })).toBe("필수 항목을 입력하세요. (x)");
		// Too-long text is also a field-independent code and is stated with the field label.
		expect(cmsIssueMessage({ code: "field_too_long", path: "title", message: "제목" })).toBe(
			"제목이 너무 깁니다. (title)",
		);
		expect(cmsIssueMessage({ code: "field_too_long" })).toBe("입력한 글이 너무 깁니다.");
	});

	it("formats body position and image warnings with readable labels", () => {
		expect(cmsIssueMessage({ code: "mdx_error", position: { line: 4, column: 7 } })).toBe(
			"MDX 본문 구문을 확인하세요. (4행 7열)",
		);
		expect(cmsIssueMessage({ code: "image_media_not_ready", position: { line: 2, column: 1 } })).toBe(
			"이미지가 아직 준비되지 않았습니다. (2행 1열)",
		);
	});
});

describe.runIf(ADMIN_LANGUAGE === "en")("API error messages (English admin)", () => {
	it("fills field labels and positions in English", () => {
		expect(cmsIssueMessage({ code: "missing_field", path: "title", message: "Headline" })).toBe(
			"Fill in Headline. (title)",
		);
		expect(cmsIssueMessage({ code: "field_too_long", message: "Headline" })).toBe("Headline is too long.");
		expect(cmsIssueMessage({ code: "mdx_error", position: { line: 4, column: 7 } })).toBe(
			"Check the MDX syntax of the body. (line 4, column 7)",
		);
		expect(cmsApiErrorMessage({ code: "slug_conflict" }, "fallback")).toBe("This address (slug) is already in use.");
	});
});
