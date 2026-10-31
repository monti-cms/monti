import { describe, expect, it } from "vitest";
import type { CliIo } from "../command";
import { runCli } from "../index";
import { QUESTIONS } from "../init-prompts";
import { type FakeHost, fakeHost, fixtureApp, listFiles, read, schemaOf, scriptedPrompter } from "./init-helpers";

/** The command line: flags, `--yes`, `--json`, the interactive run, and the exit codes. */

function run(dir: string, argv: string[], extras: Pick<CliIo, "interactive" | "prompter"> & { host?: FakeHost } = {}) {
	const out: string[] = [];
	const err: string[] = [];
	const host = extras.host ?? fakeHost();
	const code = runCli(["init", ...argv], {
		cwd: dir,
		log: (message) => out.push(message),
		error: (message) => err.push(message),
		interactive: false,
		initHost: host,
		...extras,
	});
	return { code, out, err, host };
}

describe("monti init on the command line", () => {
	it("INIT-N1 --yes takes every default and prints a plain summary", async () => {
		const dir = fixtureApp();
		const before = listFiles(dir);
		const result = run(dir, ["--yes", "--no-install"]);
		expect(await result.code).toBe(0);
		const text = result.out.join("\n");
		// Every file init made is named (.env.local in its step, the others in the list), and what is left is a numbered list whose first step is the install it did not run.
		const made = listFiles(dir).filter((file) => !before.includes(file));
		expect(made).toEqual(expect.arrayContaining(["monti.config.ts", ".env.local"]));
		for (const file of made) expect(text).toContain(file === ".env.local" ? file : `  - ${file}`);
		expect(text).toMatch(/\n {2}1\. .*\n.*pnpm add @monti-cms\/core/);
		expect(read(dir, "monti.config.ts")).toContain("defineConfig");
	});

	it("INIT-Q1 without a terminal nothing is asked, even without --yes", async () => {
		const dir = fixtureApp();
		const prompter = scriptedPrompter({});
		const result = run(dir, ["--no-install"], { interactive: false, prompter });
		expect(await result.code).toBe(0);
		expect(prompter.asked).toEqual([]);
	});

	it("CLI-E1 --json prints one JSON document and asks nothing, even on a terminal", async () => {
		const dir = fixtureApp({ "content/posts/a.md": "---\ntitle: A\n---\nx\n" });
		const prompter = scriptedPrompter({});
		const result = run(dir, ["--json", "--extras", "ai", "--no-install"], {
			interactive: true,
			prompter,
		});
		expect(await result.code).toBe(0);
		expect(prompter.asked).toEqual([]);
		expect(result.out).toHaveLength(1);
		const report = JSON.parse(result.out[0] ?? "");
		expect(report).toMatchObject({
			ok: true,
			dryRun: false,
			answers: { ai: true, adminPath: "/studio" },
			app: { packageManager: "pnpm", src: false, contentFolders: [{ dir: "content/posts", files: 1 }] },
		});
		expect(report.created).toContain("monti.config.ts");
		expect(report.next.join("\n")).not.toContain("monti import");
		expect(result.err).toEqual([]);
	});

	it("INIT-K7 --dry-run changes nothing", async () => {
		const dir = fixtureApp();
		const before = listFiles(dir);
		const result = run(dir, ["--yes", "--dry-run"]);
		expect(await result.code).toBe(0);
		expect(listFiles(dir)).toEqual(before);
		expect(result.out.join("\n")).toContain("Dry run: nothing was written");
	});

	it("INIT-Q1 every question has a flag", async () => {
		const dir = fixtureApp();
		const result = run(dir, [
			"--yes",
			"--no-install",
			"--site-url",
			"https://x.dev",
			"--locales",
			"ko,en",
			"--time-zone",
			"Asia/Seoul",
			"--storage",
			"s3",
			"--extras",
			"ai",
			"--blocks",
			"callout,tabs",
			"--admin-path",
			"/cms",
			"--package-manager",
			"npm",
		]);
		expect(await result.code).toBe(0);
		expect(read(dir, ".env.example")).toContain("https://x.dev");
		expect(schemaOf(dir).admin).toEqual({ path: "/cms" });
		expect(result.out.join("\n")).toContain("npx monti");
	});

	it("INIT-K7 a bad --package-manager and an unknown flag are refused", async () => {
		expect(await run(fixtureApp(), ["--package-manager", "pip"]).code).toBe(1);
		const unknown = run(fixtureApp(), ["--nope"]);
		expect(await unknown.code).toBe(1);
		expect(unknown.err.join("\n")).toMatch(/nope/);
	});

	it("INIT-S1 exits 1 when a step failed, with the files still written", async () => {
		const dir = fixtureApp();
		const host = fakeHost({ install: () => Promise.reject(new Error("offline")) });
		const result = run(dir, ["--yes"], { host });
		expect(await result.code).toBe(1);
		expect(result.out.join("\n")).toContain("Install packages: FAILED (offline)");
		expect(read(dir, "monti.config.ts")).toContain("defineConfig");
	});

	it("INIT-Q1 an interactive run: the questions, the install confirmation, and the final summary", async () => {
		const dir = fixtureApp({ "content/posts/a.md": "---\ntitle: A\ndate: 2024-01-01\n---\nx\n" });
		const prompter = scriptedPrompter({
			[QUESTIONS.defaultLocale]: "ko",
			[QUESTIONS.otherLocales]: ["en"],
			[QUESTIONS.storage]: "s3",
			[QUESTIONS.extras]: ["ai"],
			[QUESTIONS.blocks]: "pick",
			[QUESTIONS.blockList]: ["callout", "tabs"],
			[QUESTIONS.adminPath]: "/studio",
			[QUESTIONS.login]: "password",
			[QUESTIONS.directive]: "mdx",
			"Install the": true,
		});
		const host = fakeHost();
		const result = run(dir, [], { interactive: true, prompter, host });
		expect(await result.code).toBe(0);
		expect(prompter.asked).toEqual([
			QUESTIONS.setup,
			QUESTIONS.defaultLocale,
			QUESTIONS.otherLocales,
			QUESTIONS.storage,
			QUESTIONS.extras,
			QUESTIONS.blocks,
			QUESTIONS.blockList,
			QUESTIONS.adminPath,
			QUESTIONS.login,
			QUESTIONS.directive,
			expect.stringContaining("Install the"),
			QUESTIONS.setupNow,
			"task: Setting up .env.local",
			"task: Creating Monti's tables",
			"task: Checking the setup",
		]);
		expect(prompter.notes[0]).toMatchObject({ title: "Detected" });
		expect(prompter.notes[0]?.body).toContain("App Router");
		expect(prompter.notes[0]?.body).toContain("Found 1 Markdown/MDX file in content/posts/");
		expect(host.install).toHaveBeenCalled();
		expect(result.out.join("\n")).toContain("Changed:\n  - next.config.ts \u2014 wrapped the export in withCms()");
		expect(result.out.join("\n")).toContain("Start the app: pnpm dev, then open http://localhost:3000/studio");
	});

	it("INIT-S1 answering no to the install runs nothing and lists the command", async () => {
		const dir = fixtureApp();
		const prompter = scriptedPrompter({
			[QUESTIONS.defaultLocale]: "en",
			[QUESTIONS.otherLocales]: [],
			[QUESTIONS.storage]: "none",
			[QUESTIONS.extras]: [],
			[QUESTIONS.blocks]: "all",
			[QUESTIONS.adminPath]: "/studio",
			[QUESTIONS.login]: "github",
			[QUESTIONS.directive]: "mdx",
			"Install the": false,
		});
		const host = fakeHost();
		const result = run(dir, [], { interactive: true, prompter, host });
		expect(await result.code).toBe(0);
		expect(host.install).not.toHaveBeenCalled();
		expect(result.out.join("\n")).toMatch(/Install the packages:\n\s+pnpm add @monti-cms\/core/);
	});

	it("INIT-K7 Ctrl+C leaves the project as it was and exits 130", async () => {
		const dir = fixtureApp();
		const before = listFiles(dir);
		const prompter = scriptedPrompter({ [QUESTIONS.defaultLocale]: "cancel" });
		const result = run(dir, [], { interactive: true, prompter });
		expect(await result.code).toBe(130);
		// One line that says it was cancelled and that nothing was written.
		expect(result.err).toHaveLength(1);
		expect(result.err[0]).toMatch(/cancel/i);
		expect(result.err[0]).toMatch(/nothing was written/i);
		expect(listFiles(dir)).toEqual(before);
	});
});
