import { describe, expect, it } from "vitest";
import { testSite } from "../../../../core/test/site";
import { apiErrorOf, errorNotice, errorText, NoticeError } from "../client";
import { apiErrorMessages } from "../error-message.messages";

const network = testSite.createTranslator(apiErrorMessages)("network");

describe("what the screen tells about an error", () => {
	it("ADMIN-E1 tells the server's text, its fix, and keeps the detail apart", () => {
		const error = apiErrorOf(
			testSite,
			503,
			{
				error: {
					code: "service_unavailable",
					message: "Key refused.",
					fix: "Check the key.",
					detail: "401 invalid x-api-key",
				},
			},
			"failed",
		);
		expect(errorNotice(testSite, error, "failed")).toEqual({
			message: "Key refused.",
			fix: "Check the key.",
			detail: "401 invalid x-api-key",
		});
		expect(errorText(testSite, error, "failed")).toBe("Key refused. Check the key.");
	});

	it("ADMIN-E1 leaves out the fix of the code when the message lists issues", () => {
		const error = apiErrorOf(
			testSite,
			400,
			{
				error: {
					code: "invalid_input",
					message: "Invalid",
					fix: "Refresh.",
					issues: [{ code: "missing_field", path: "title" }],
				},
			},
			"failed",
		);
		expect(errorNotice(testSite, error, "failed").fix).toBeUndefined();
	});

	it("ADMIN-E2 never shows the words of an unexpected error", () => {
		const notice = errorNotice(testSite, new SyntaxError("Unexpected token < in JSON at position 0"), "failed");
		expect(notice.message).toBe("failed");
		expect(notice.detail).toContain("Unexpected token");
	});

	it("ADMIN-E1 shows text the screen wrote for the person", () => {
		expect(errorText(testSite, new NoticeError("Too large.", "Pick a smaller file."), "failed")).toBe(
			"Too large. Pick a smaller file.",
		);
	});

	it("ADMIN-E2 tells a network failure as being offline", () => {
		expect(errorNotice(testSite, new TypeError("Failed to fetch"), "failed").message).toBe(network);
	});
});
