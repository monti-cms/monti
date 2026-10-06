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
		const summary = cmsApiErrorMessage(payload, "실패");
		expect(summary).toContain("제목");
		expect(summary).toContain("(title)");
		expect(cmsIssueMessage(payload.issues[1])).toContain("카테고리");
		expect(cmsIssueMessage(payload.issues[1])).toContain("(categoryId)");
		expect(cmsIssueMessage({ code: "missing_field", path: "x" })).toContain("(x)");
		// Too-long text is also a field-independent code and is stated with the field label.
		const tooLong = cmsIssueMessage({ code: "field_too_long", path: "title", message: "제목" });
		expect(tooLong).toContain("제목");
		expect(tooLong).toContain("(title)");
		expect(cmsIssueMessage({ code: "field_too_long" })).toBeTruthy();
	});

	it("formats body position and image warnings with readable labels", () => {
		expect(cmsIssueMessage({ code: "mdx_error", position: { line: 4, column: 7 } })).toMatch(/4\D+7/);
		expect(cmsIssueMessage({ code: "image_media_not_ready", position: { line: 2, column: 1 } })).toMatch(/2\D+1/);
	});
});

describe.runIf(ADMIN_LANGUAGE === "ko")("footnote warnings", () => {
	it("names the label after the guidance text", () => {
		const message = cmsIssueMessage({
			code: "footnote_definition_missing",
			message: "gone",
			position: { line: 2, column: 5 },
		});
		expect(message).toContain("gone");
		expect(message).toMatch(/2\D+5/);
		expect(message.indexOf("gone")).toBeLessThan(message.search(/2\D+5/));
	});
});

describe.runIf(ADMIN_LANGUAGE === "en")("API error messages (English admin)", () => {
	it("names the footnote label after the guidance text", () => {
		const message = cmsIssueMessage({
			code: "footnote_definition_unused",
			message: "spare",
			position: { line: 5, column: 1 },
		});
		expect(message).toContain("spare");
		expect(message).toContain("(line 5, column 1)");
		expect(message.indexOf("spare")).toBeLessThan(message.indexOf("(line 5, column 1)"));
	});

	it("fills field labels and positions in English", () => {
		const missing = cmsIssueMessage({ code: "missing_field", path: "title", message: "Headline" });
		expect(missing).toContain("Headline");
		expect(missing).toContain("(title)");
		expect(cmsIssueMessage({ code: "field_too_long", message: "Headline" })).toContain("Headline");
		expect(cmsIssueMessage({ code: "mdx_error", position: { line: 4, column: 7 } })).toContain("(line 4, column 7)");
		// A known error code is mapped to a message instead of falling back.
		const conflict = cmsApiErrorMessage({ code: "slug_conflict" }, "fallback");
		expect(conflict).toBeTruthy();
		expect(conflict).not.toBe("fallback");
	});
});

/** Both languages carry a message for the publish warnings about removed fields and options; the language does not matter to the check. */
describe("warnings about removed fields and options", () => {
	it("name the field key, and the removed option for a select", () => {
		const orphan = cmsIssueMessage({ code: "orphaned_metadata_key", path: "oldField" });
		expect(orphan).toContain("(oldField)");
		expect(orphan).not.toBe("orphaned_metadata_key (oldField)");
		const option = cmsIssueMessage({ code: "unknown_select_value", path: "policy", message: "old-option" });
		expect(option).toContain("old-option");
		expect(option).toContain("(policy)");
		expect(option.indexOf("old-option")).toBeGreaterThan(0);
		expect(option).not.toContain("unknown_select_value");
	});
});
