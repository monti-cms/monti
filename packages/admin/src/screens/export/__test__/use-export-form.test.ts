import { describe, expect, it } from "vitest";
import { testSite } from "../../../../../core/test/site";
import { exportMessages } from "../messages";
import { exportDoneMessage, exportRequest } from "../use-export-form";

const t = testSite.createTranslator(exportMessages);

describe("exportRequest", () => {
	it.each([
		{ case: "the whole site with no text format", given: { scope: "admin" }, want: { scope: "admin" } },
		{
			case: "picked entries in a text format",
			given: { scope: "admin", ids: ["a", "b"], format: "mdx" },
			want: { scope: "admin", ids: ["a", "b"], format: "mdx" },
		},
		{
			case: "one collection's public entries",
			given: { scope: "public", collection: "page" },
			want: { scope: "public", collection: "page" },
		},
		{
			case: "an empty collection or format is left out",
			given: { scope: "admin", collection: "", format: "" },
			want: { scope: "admin" },
		},
	] as const)("DATA-B4 $case", ({ given, want }) => {
		expect(exportRequest(given)).toEqual(want);
	});
});

describe("exportDoneMessage", () => {
	it("DATA-B5 names the saved file, and adds how many bodies are in the JSON only when there are some", () => {
		expect(exportDoneMessage(testSite, "site.zip", 0)).toBe(t("toast.done", { name: "site.zip" }));
		expect(exportDoneMessage(testSite, "site.zip", 2)).toBe(
			`${t("toast.done", { name: "site.zip" })} ${t("toast.notWritten", { count: 2 })}`,
		);
	});
});
