import { describe, expect, it } from "vitest";
import type { CliIo } from "../command";
import { runCli } from "../index";
import { QUESTIONS } from "../init-prompts";
import {
	type FakeHost,
	fakeHost,
	fixtureApp,
	listFiles,
	read,
	SRC_APP,
	schemaOf,
	scriptedPrompter,
} from "./init-helpers";

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
	it("--directive-syntax and --no-directive-syntax decide the block syntax, and --no-install still installs nothing", async () => {
		for (const [flag, on] of [
			["--directive-syntax", true],
			["--no-directive-syntax", false],
		] as const) {
			const dir = fixtureApp();
			const result = run(dir, ["--yes", "--no-install", flag]);
			expect(await result.code).toBe(0);
			expect(read(dir, "monti.config.ts").includes("directiveSyntax()")).toBe(on);
			expect(result.host.install).not.toHaveBeenCalled();
		}
	});

	it("--yes takes every default and prints a plain summary", async () => {
		const dir = fixtureApp();
		const result = run(dir, ["--yes", "--no-install"]);
		expect(await result.code).toBe(0);
		const text = result.out.join("\n");
		expect(text).toContain("Monti is added to your app.");
		expect(text).toContain("Created:\n  - monti.config.ts");
		expect(text).toContain("Monti's files are in the project root (next to app/).");
		expect(text).toContain("What is left:");
		expect(text).toMatch(/\n {2}1\. /);
		expect(read(dir, "monti.config.ts")).toContain("defineConfig");
	});

	it("says that the files go to src/ when the app uses src/app", async () => {
		const dir = fixtureApp(SRC_APP);
		const result = run(dir, ["--yes", "--no-install"]);
		expect(await result.code).toBe(0);
		expect(result.out.join("\n")).toContain("Your app uses src/app, so Monti's files are in src/ (next to app/).");
	});

	it("without a terminal nothing is asked, even without --yes", async () => {
		const dir = fixtureApp();
		const prompter = scriptedPrompter({});
		const result = run(dir, ["--no-install"], { interactive: false, prompter });
		expect(await result.code).toBe(0);
		expect(prompter.asked).toEqual([]);
	});

	it("--json prints one JSON document and asks nothing, even on a terminal", async () => {
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

	it("--json reports an error as JSON with exit code 1", async () => {
		const dir = fixtureApp();
		const result = run(dir, ["--json", "--storage", "gcs"]);
		expect(await result.code).toBe(1);
		expect(JSON.parse(result.out[0] ?? "")).toMatchObject({ ok: false, error: expect.stringContaining("--storage") });
		expect(listFiles(dir)).toEqual(listFiles(fixtureApp()));
	});

	it("--dry-run changes nothing", async () => {
		const dir = fixtureApp();
		const before = listFiles(dir);
		const result = run(dir, ["--yes", "--dry-run"]);
		expect(await result.code).toBe(0);
		expect(listFiles(dir)).toEqual(before);
		expect(result.out.join("\n")).toContain("Dry run: nothing was written");
	});

	it("every question has a flag", async () => {
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
			"ai,git-sync",
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

	it("the flags of the removed behavior are refused", async () => {
		for (const flag of [
			"--database",
			"--database-schema",
			"--admin-github-id",
			"--no-migrate",
			"--no-docker-start",
			"--blog-theme",
			"--resume",
		]) {
			const removed = run(fixtureApp(), ["--yes", flag, "x"]);
			expect(await removed.code).toBe(1);
		}
	});

	it("a bad --package-manager and an unknown flag are refused", async () => {
		expect(await run(fixtureApp(), ["--package-manager", "pip"]).code).toBe(1);
		const unknown = run(fixtureApp(), ["--nope"]);
		expect(await unknown.code).toBe(1);
		expect(unknown.err.join("\n")).toMatch(/nope/);
	});

	it("--locale still sets the one default language", async () => {
		const dir = fixtureApp();
		await run(dir, ["--yes", "--no-install", "--locale", "ko"]).code;
		expect(schemaOf(dir).defaultLocale).toBe("ko");
	});

	it("exits 1 when a step failed, with the files still written", async () => {
		const dir = fixtureApp();
		const host = fakeHost({ install: () => Promise.reject(new Error("offline")) });
		const result = run(dir, ["--yes"], { host });
		expect(await result.code).toBe(1);
		expect(result.out.join("\n")).toContain("Install packages: FAILED (offline)");
		expect(read(dir, "monti.config.ts")).toContain("defineConfig");
	});

	it("an interactive run: the questions, the install confirmation, and the final summary", async () => {
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
		]);
		expect(prompter.notes[0]).toMatchObject({ title: "Detected" });
		expect(prompter.notes[0]?.body).toContain("App Router");
		expect(prompter.notes[0]?.body).toContain("Found 1 Markdown/MDX file in content/posts/");
		expect(host.install).toHaveBeenCalled();
		expect(result.out.join("\n")).toContain("Changed:\n  - next.config.ts \u2014 wrapped the export in withCms()");
		expect(result.out.join("\n")).toContain("Start the app: pnpm dev, then open http://localhost:3000/studio");
	});

	it("answering no to the install runs nothing and lists the command", async () => {
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

	it("Ctrl+C leaves the project as it was and exits 130", async () => {
		const dir = fixtureApp();
		const before = listFiles(dir);
		const prompter = scriptedPrompter({ [QUESTIONS.defaultLocale]: "cancel" });
		const result = run(dir, [], { interactive: true, prompter });
		expect(await result.code).toBe(130);
		expect(result.err).toEqual(["Cancelled. Nothing was written."]);
		expect(listFiles(dir)).toEqual(before);
	});

	it("runCli routes init, and `init --help` shows every flag", async () => {
		const out: string[] = [];
		const code = await runCli(["init", "--help"], {
			cwd: fixtureApp(),
			log: (message) => out.push(message),
			error: () => undefined,
		});
		expect(code).toBe(0);
		for (const flag of [
			"--yes",
			"--json",
			"--dry-run",
			"--site-url",
			"--locales",
			"--time-zone",
			"--storage",
			"--extras",
			"--blocks",
			"--admin-path",
			"--overwrite",
			"--no-install",
			"--package-manager",
		]) {
			expect(out.join("\n")).toContain(flag);
		}
		expect(out.join("\n")).not.toMatch(/bareun/i);
	});
});
