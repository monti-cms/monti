import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { runDoctorCommand } from "@monti-cms/core/cli";
import { defineConfig } from "@monti-cms/core/server";
import { testServer } from "@monti-cms/core/testing";
import { mdx } from "@monti-cms/mdx";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { schema } from "../site";
import { contentHealth } from "./index";

const test = testServer();
const cms = defineConfig({ schema, plugins: [mdx(), contentHealth()], ...test.server });

beforeAll(async () => {
	await cms.migrate();
	const service = cms.contentService();
	for (const [slug, summary] of [
		["has-summary", "A summary."],
		["no-summary", undefined],
	] as const) {
		const draft = (
			await service.createDraft({
				collection: "post",
				slug,
				metadata: { title: slug, summary },
				body: "Body.",
				format: "mdx",
			})
		).entry;
		await service.publish({ id: draft.id, expectedVersion: draft.version });
	}
});
afterAll(async () => {
	await cms.close();
	await test.drop();
});

/** The checks the plugin adds, run in process against the instance, the way `monti doctor` calls them. */
const run = async (id: string, env: Record<string, string> = {}) => {
	const server = await contentHealth().server?.();
	const check = server?.default.checks?.find((candidate) => candidate.id === id);
	if (!check) throw new Error(`no check ${id}`);
	return check.run({ cms, cwd: process.cwd(), env, online: false });
};

describe("a monti doctor check from a plugin", () => {
	it("says what it found, where, and how to fix it", async () => {
		expect(await run("summaries")).toMatchObject({
			status: "warn",
			message: "1 of 2 published posts have no summary: no-summary",
			where: expect.stringContaining("?collection=post"),
			fix: expect.stringContaining("fillFromBody"),
		});
	});

	it("is ok when there is nothing to say", async () => {
		expect(await run("site-url", { SITE_URL: "https://blog.example" })).toMatchObject({ status: "ok" });
		expect(await run("site-url")).toMatchObject({ status: "warn", fix: "set SITE_URL=https://your-site.example" });
	});

	it("is part of `monti doctor`, under the plugin's name", async () => {
		// A project folder next to the recipe, so that its config file resolves the same packages as the tests.
		const dir = mkdtempSync(path.join(import.meta.dirname, ".project-"));
		try {
			mkdirSync(dir, { recursive: true });
			writeFileSync(path.join(dir, "monti.schema.json"), JSON.stringify(schema));
			writeFileSync(
				path.join(dir, "monti.config.ts"),
				`import { defineConfig, postgres } from "@monti-cms/core/server";
import { auth } from "@monti-cms/auth";
import { github } from "@monti-cms/auth/github";
import { mdx } from "@monti-cms/mdx";
import { contentHealth } from "../index";
import schema from "./monti.schema.json";

export const cms = defineConfig({
	schema,
	plugins: [mdx(), contentHealth()],
	database: postgres({ connectionString: process.env.CMS_TEST_DATABASE_URL, schema: ${JSON.stringify(test.schema)} }),
	auth: auth({ providers: [github()] }),
});
`,
			);
			const lines: string[] = [];
			const code = await runDoctorCommand(["--only", "content-health", "--no-env-file", "--json"], {
				cwd: dir,
				log: (line) => lines.push(line),
				error: (line) => lines.push(line),
			});
			const report = JSON.parse(lines.join("\n"));
			expect(report.checks.map((check: { id: string; status: string }) => [check.id, check.status])).toEqual([
				["content-health/summaries", "warn"],
				["content-health/site-url", "warn"],
			]);
			expect(code).toBe(0); // warnings do not fail the command
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});
});
