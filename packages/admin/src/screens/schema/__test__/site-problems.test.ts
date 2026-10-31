import { describe, expect, it } from "vitest";
import { problemAt, siteProblems } from "../site-problems";

const file = (site: Record<string, unknown>) => ({ site });

describe("siteProblems", () => {
	it("SCHEMA-F9 has none for a file without site settings or with good ones", () => {
		expect(siteProblems({})).toEqual([]);
		expect(
			siteProblems(
				file({
					aliases: ["www.example.dev", "localhost:3000"],
					previewLocaleParam: "lang",
				}),
			),
		).toEqual([]);
		expect(siteProblems(file({ previewLocaleParam: false }))).toEqual([]);
	});

	it("SCHEMA-F9 points at the host that is not a host name, by its place in the list", () => {
		const problems = siteProblems(file({ aliases: ["www.example.dev", "not a host", "-bad"] }));
		expect(problems.map((problem) => [problem.path, problem.code])).toEqual([
			["site.aliases.1", "host"],
			["site.aliases.2", "host"],
		]);
	});

	it("SCHEMA-F9 names a preview language query that is not a query name", () => {
		expect(siteProblems(file({ previewLocaleParam: "1lang" }))).toEqual([
			{ area: "site", path: "site.previewLocaleParam", code: "query-name" },
		]);
	});

	it("SCHEMA-F9 finds the problem at a path", () => {
		const problems = siteProblems(file({ aliases: ["not a host"] }));
		expect(problemAt(problems, "site.aliases.0")?.code).toBe("host");
		expect(problemAt(problems, "site.aliases.1")).toBeUndefined();
	});
});
