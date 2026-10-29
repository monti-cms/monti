import { issueText } from "@monti-cms/core/site";
import { describe, expect, it } from "vitest";
import { testSite } from "../../../../core/test/site";
import { cmsApiErrorMessage, cmsApiIssues, fieldIssueLine, issueLine } from "../error-message";
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

describe("an issue beside its field", () => {
	it("leaves out the field key, which is an internal name the field already stands for", () => {
		const told1 = told({ code: "missing_field", path: "title", message: "제목" });
		const issue = { text: told1.text, where: told1.where, path: "title" };
		expect(issue.where).toBe("title");
		expect(fieldIssueLine(issue)).toBe(issue.text);
		expect(fieldIssueLine(issue)).not.toContain("title");
	});

	it("keeps a place that is not the field's key, such as a line and a column of the body", () => {
		const told2 = told({ code: "mdx_error", path: "body", message: "x", position: { line: 3, column: 4 } });
		const issue = { text: told2.text, where: told2.where, path: "body" };
		expect(fieldIssueLine(issue)).toBe(issueLine(issue));
		expect(fieldIssueLine(issue)).toContain("(");
	});
});
