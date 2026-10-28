import { describe, expect, it } from "vitest";
import { problemAt, siteProblems } from "../site-problems";

const file = (site: Record<string, unknown>) => ({ site });

describe("siteProblems", () => {
	it("has none for a file without site settings or with good ones", () => {
		expect(siteProblems({})).toEqual([]);
		expect(
			siteProblems(
				file({
					homeLink: "/blog",
					aliases: ["www.example.dev", "localhost:3000"],
					previewLocaleParam: "lang",
				}),
			),
		).toEqual([]);
		expect(siteProblems(file({ homeLink: "https://example.dev/blog", previewLocaleParam: false }))).toEqual([]);
	});

	it("names a home link that is neither a path nor an http(s) address", () => {
		for (const homeLink of ["example.dev/blog", "//other.dev", "ftp://x.dev"]) {
			expect(siteProblems(file({ homeLink }))).toEqual([{ area: "site", path: "site.homeLink", code: "home-link" }]);
		}
	});

	it("points at the host that is not a host name, by its place in the list", () => {
		const problems = siteProblems(file({ aliases: ["www.example.dev", "not a host", "-bad"] }));
		expect(problems.map((problem) => [problem.path, problem.code])).toEqual([
			["site.aliases.1", "host"],
			["site.aliases.2", "host"],
		]);
	});

	it("names a preview language query that is not a query name", () => {
		expect(siteProblems(file({ previewLocaleParam: "1lang" }))).toEqual([
			{ area: "site", path: "site.previewLocaleParam", code: "query-name" },
		]);
	});

	it("finds the problem at a path", () => {
		const problems = siteProblems(file({ homeLink: "x" }));
		expect(problemAt(problems, "site.homeLink")?.code).toBe("home-link");
		expect(problemAt(problems, "site.aliases.0")).toBeUndefined();
	});
});
