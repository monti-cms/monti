import { issueText } from "@monti-cms/core/site";
import { describe, expect, it } from "vitest";
import { testSite } from "../../../../core/test/site";
import { cmsApiErrorMessage, cmsApiIssues, issueLine } from "../error-message";
import { apiErrorMessages } from "../error-message.messages";

const told = (issue: Parameters<typeof issueText>[1]) => ({ ...issue, ...issueText(testSite, issue) });

describe("issue text from the server", () => {
	it("shows an issue as the server wrote it, with its place after it", () => {
		expect(issueLine({ text: "Fill in Headline.", where: "title" })).toBe("Fill in Headline. (title)");
		expect(issueLine({ text: "Fill in Headline." })).toBe("Fill in Headline.");
	});

	it("lists the issues of an answer under the heading, each as its line", () => {
		const payload = {
			issues: [
				told({ code: "missing_field", path: "title", message: "Headline" }),
				told({ code: "mdx_error", position: { line: 4, column: 7 } }),
			],
		};
		expect(cmsApiIssues(payload)).toEqual(payload.issues);
		const summary = cmsApiErrorMessage(testSite, payload, "fallback").split("\n");
		expect(summary[0]).toBe(testSite.createTranslator(apiErrorMessages)("validationFailedList"));
		expect(summary.slice(1)).toEqual(payload.issues.map((issue) => `• ${issueLine(issue)}`));
	});

	it("shows the server's message of an answer without issues", () => {
		expect(cmsApiErrorMessage(testSite, { code: "slug_conflict", message: "Taken." }, "fallback")).toBe("Taken.");
		expect(cmsApiErrorMessage(testSite, { code: "slug_conflict" }, "fallback")).toBe("fallback");
	});
});
