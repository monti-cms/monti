import { describe, expect, it } from "vitest";
import { fail, formatReport, ok, reportOf, skip, warn } from "./report";

describe("monti doctor: the report", () => {
	const report = reportOf("/sites/blog", [
		{ id: "site/next", ...ok("Next 16.4.6, App Router (app/)") },
		{
			id: "env/secret",
			...fail("MONTI_SECRET is not set", {
				where: ".env.local, or the host's environment",
				fix: "add MONTI_SECRET with a long random value\nopenssl rand -base64 32",
			}),
		},
		{
			id: "files/gitignore",
			...warn(".env.local is not in .gitignore", { fix: "add a line `.env.local` to .gitignore" }),
		},
		{ id: "database/migrations", ...skip("the database is not reachable") },
	]);

	it("20-8 a failure makes the report not ok and is counted; warnings and skipped checks do not fail it", () => {
		expect(report.ok).toBe(false);
		expect(report.summary).toEqual({ ok: 1, warn: 1, fail: 1, skip: 1 });
		expect(
			reportOf(
				"/sites/blog",
				report.checks.filter((check) => check.status !== "fail"),
			).ok,
		).toBe(true);
	});

	it("20-8 each check is one line with its mark, and a warning or a failure says where it is and how to fix it right under it", () => {
		expect(formatReport(report).split("\n")).toEqual([
			"monti doctor: /sites/blog",
			"",
			"  ok    site/next            Next 16.4.6, App Router (app/)",
			"  FAIL  env/secret           MONTI_SECRET is not set",
			"                             where: .env.local, or the host's environment",
			"                             fix:   add MONTI_SECRET with a long random value",
			"                                    openssl rand -base64 32",
			"  warn  files/gitignore      .env.local is not in .gitignore",
			"                             fix:   add a line `.env.local` to .gitignore",
			"  skip  database/migrations  the database is not reachable",
			"",
			"1 failed, 1 warning, 1 ok, 1 skipped",
		]);
	});
});
