import { describe, expect, it } from "vitest";
import { runCli } from "../index";
import { runInitCommand } from "../init-command";
import { QUESTIONS } from "../init-prompts";
import { fakeHost, fixtureApp, listFiles, read, scriptedPrompter } from "./init-helpers";

/** The command line: flags, `--yes`, `--json`, the interactive run, and the exit codes. */

function run(dir: string, argv: string[], extras: Parameters<typeof runInitCommand>[2] = {}) {
	const out: string[] = [];
	const err: string[] = [];
	const host = extras.host ?? fakeHost();
	const code = runInitCommand(
		argv,
		{ cwd: dir, log: (message) => out.push(message), error: (message) => err.push(message) },
		{ interactive: false, host, ...extras },
	);
	return { code, out, err, host };
}

describe("monti init on the command line", () => {
	it("--yes takes every default and prints a plain summary", async () => {
		const dir = fixtureApp();
		const result = run(dir, ["--yes", "--no-install"]);
		expect(await result.code).toBe(0);
		const text = result.out.join("\n");
		expect(text).toContain("Monti is added to your app.");
		expect(text).toContain("Created:\n  - monti.config.ts");
		expect(text).toContain("What is left:");
		expect(text).toMatch(/\n {2}1\. /);
		expect(read(dir, "monti.config.ts")).toContain("defineConfig");
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
		const result = run(dir, ["--json", "--database", "docker", "--extras", "ai", "--no-install"], {
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
			answers: { database: { kind: "docker" }, ai: true, adminPath: "/studio" },
			app: { packageManager: "pnpm", src: false, contentFolders: [{ dir: "content/posts", files: 1 }] },
		});
		expect(report.created).toContain("monti.config.ts");
		expect(report.next.at(-1)).toContain("monti import content/posts");
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
			"--database",
			"postgres://u:p@h:5432/d",
			"--admin-github-id",
			"42",
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
			"--blog-theme",
			"--package-manager",
			"npm",
		]);
		expect(await result.code).toBe(0);
		expect(read(dir, ".env.local")).toContain("MONTI_ADMIN_GITHUB_ID=42");
		expect(JSON.parse(read(dir, "monti.schema.json")).admin).toEqual({ path: "/cms" });
		expect(result.out.join("\n")).toContain("npx monti");
	});

	it("--no-blog-theme and --blog-theme together are refused", async () => {
		const result = run(fixtureApp(), ["--yes", "--blog-theme", "--no-blog-theme"]);
		expect(await result.code).toBe(1);
		expect(result.err.join("\n")).toContain("cannot both be given");
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
		expect(JSON.parse(read(dir, "monti.schema.json")).defaultLocale).toBe("ko");
	});

	it("exits 1 when a step failed, with the files still written", async () => {
		const dir = fixtureApp();
		const host = fakeHost({ install: () => Promise.reject(new Error("offline")) });
		const result = run(dir, ["--yes"], { host });
		expect(await result.code).toBe(1);
		expect(result.out.join("\n")).toContain("Install packages: FAILED (offline)");
		expect(read(dir, "monti.config.ts")).toContain("defineConfig");
	});

	it("an interactive run: the questions, the answers, and the final summary", async () => {
		const dir = fixtureApp({ "content/posts/a.md": "---\ntitle: A\ndate: 2024-01-01\n---\nx\n" });
		const prompter = scriptedPrompter({
			[QUESTIONS.database]: "docker",
			[QUESTIONS.adminGithubId]: "583231",
			[QUESTIONS.locales]: "ko,en",
			[QUESTIONS.storage]: "s3",
			[QUESTIONS.extras]: ["ai"],
			[QUESTIONS.blocks]: "pick",
			[QUESTIONS.blockList]: ["callout", "tabs"],
			[QUESTIONS.adminPath]: "/studio",
			[QUESTIONS.blogTheme]: false,
			"Add withCms": true,
		});
		const host = fakeHost();
		const result = run(dir, [], { interactive: true, prompter, host });
		expect(await result.code).toBe(0);
		expect(prompter.asked).toEqual([
			QUESTIONS.database,
			QUESTIONS.adminGithubId,
			QUESTIONS.locales,
			QUESTIONS.storage,
			QUESTIONS.extras,
			QUESTIONS.blocks,
			QUESTIONS.blockList,
			QUESTIONS.adminPath,
			QUESTIONS.blogTheme,
			"Add withCms to next.config.ts?",
		]);
		// The detection is shown first, the next.config diff before the question about it.
		expect(prompter.notes[0]).toMatchObject({ title: "Detected" });
		expect(prompter.notes[0]?.body).toContain("App Router");
		expect(prompter.notes[0]?.body).toContain("Found 1 Markdown/MDX file in content/posts/");
		expect(
			prompter.notes.some(
				(note) => note.title === "Change to next.config.ts" && note.body.includes("+import { withCms }"),
			),
		).toBe(true);
		expect(host.run).toHaveBeenCalledWith("docker", ["compose", "up", "-d"], dir);
		expect(host.migrate).toHaveBeenCalled();
		expect(result.out.join("\n")).toContain("Start the app: pnpm dev, then open http://localhost:3000/studio");
	});

	it("declining the next.config change leaves it alone and prints the change to make", async () => {
		const dir = fixtureApp();
		const before = read(dir, "next.config.ts");
		const prompter = scriptedPrompter({
			[QUESTIONS.database]: "skip",
			[QUESTIONS.adminGithubId]: "",
			[QUESTIONS.locales]: "en",
			[QUESTIONS.storage]: "none",
			[QUESTIONS.extras]: [],
			[QUESTIONS.blocks]: "all",
			[QUESTIONS.adminPath]: "/studio",
			[QUESTIONS.blogTheme]: false,
			"Add withCms": false,
		});
		const result = run(dir, ["--no-install"], { interactive: true, prompter });
		expect(await result.code).toBe(0);
		expect(read(dir, "next.config.ts")).toBe(before);
		expect(result.out.join("\n")).toContain("Wrap the config in next.config.ts");
	});

	it("Ctrl+C leaves the project as it was and exits 130", async () => {
		const dir = fixtureApp();
		const before = listFiles(dir);
		const prompter = scriptedPrompter({ [QUESTIONS.database]: "cancel" });
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
			"--database",
			"--admin-github-id",
			"--site-url",
			"--locales",
			"--time-zone",
			"--storage",
			"--extras",
			"--blocks",
			"--admin-path",
			"--blog-theme",
			"--overwrite",
			"--no-install",
			"--no-migrate",
			"--no-docker-start",
			"--package-manager",
		]) {
			expect(out.join("\n")).toContain(flag);
		}
		expect(out.join("\n")).not.toMatch(/bareun/i);
	});
});
