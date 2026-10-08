import { existsSync, writeFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { formatInitReport, initProject } from "../init";
import { readInitState } from "../init-state";
import { fakeHost, fixtureApp, read, scriptedPrompter } from "./init-helpers";

const WITH_DATABASE = { database: "postgres://a:b@c:5432/d", env: {} } as const;

describe("monti init when a step fails", () => {
	it("does not say Monti is added: it names the failed steps and lists the commands to finish, in order", async () => {
		const dir = fixtureApp();
		const host = fakeHost({ install: () => Promise.reject(new Error("`pnpm add` failed")) });
		const report = await initProject({ cwd: dir, host, blogTheme: true, ...WITH_DATABASE });
		const text = formatInitReport(report);

		expect(report.ok).toBe(false);
		expect(text).not.toContain("Monti is added to your app");
		expect(text).toContain("Monti is only partly added");
		expect(text).toContain("Install packages: FAILED");
		// The steps that needed the packages are listed as not run, and the recovery names every one of them with its exact command, install first.
		expect(report.recovery).toEqual([
			expect.stringMatching(/^pnpm add @monti-cms\/core /),
			"pnpm exec monti migrate",
			"pnpm add -D @tailwindcss/typography",
			"pnpm exec monti add blog-theme --yes",
		]);
		expect(text).toContain("To finish, run these in order:");
		expect(text).toContain("pnpm exec monti init --resume");
		// The files are still there.
		expect(read(dir, "monti.config.ts")).toContain("defineConfig");
	});

	it("keeps the progress in a git-ignored file under .monti/", async () => {
		const dir = fixtureApp({ ".gitignore": "node_modules\n.env*\n" });
		const host = fakeHost({ install: () => Promise.reject(new Error("offline")) });
		await initProject({ cwd: dir, host, ...WITH_DATABASE });
		const state = readInitState(dir);
		expect(state?.steps.install).toBe("incomplete");
		expect(state?.steps.migrate).toBe("incomplete");
		expect(JSON.stringify(state)).not.toContain(":b@");
		expect(read(dir, ".gitignore")).toContain(".monti/");
	});

	it("writes no progress file on a run that went well, and none on a dry run", async () => {
		const ok = fixtureApp();
		await initProject({ cwd: ok, host: fakeHost(), ...WITH_DATABASE });
		expect(existsSync(path.join(ok, ".monti"))).toBe(false);

		const dry = fixtureApp();
		const host = fakeHost({ install: () => Promise.reject(new Error("offline")) });
		await initProject({ cwd: dry, host, dryRun: true, ...WITH_DATABASE });
		expect(existsSync(path.join(dry, ".monti"))).toBe(false);
	});

	it("installs the typography plugin by itself when the theme is chosen, and not when the app has it", async () => {
		const chosen = fixtureApp();
		const host = fakeHost();
		const report = await initProject({ cwd: chosen, host, env: {}, blogTheme: true, database: "skip" });
		expect(host.install.mock.calls.map(([command]) => command.args.join(" "))).toContain(
			"add -D @tailwindcss/typography",
		);
		expect(report.steps.find((step) => step.id === "typography")?.status).toBe("done");

		const has = fixtureApp({
			"package.json": JSON.stringify({
				name: "x",
				dependencies: { next: "16.3.8" },
				devDependencies: { tailwindcss: "^4", "@tailwindcss/typography": "^0.5" },
			}),
		});
		const again = fakeHost();
		const second = await initProject({ cwd: has, host: again, env: {}, blogTheme: true, database: "skip" });
		expect(again.install.mock.calls.map(([command]) => command.args.join(" "))).not.toContain(
			"add -D @tailwindcss/typography",
		);
		expect(second.steps.some((step) => step.id === "typography")).toBe(false);
	});

	it("fails the theme step alone when only the theme fails, and says what to run", async () => {
		const dir = fixtureApp();
		const host = fakeHost();
		// A different file where a theme file goes makes the theme refuse to write.
		writeFileSync(path.join(dir, "proxy.ts"), "// my own proxy\n");
		const report = await initProject({ cwd: dir, host, env: {}, blogTheme: true, database: "skip" });
		const failed = report.steps.filter((step) => step.status === "failed").map((step) => step.id);
		expect(failed).toEqual(["theme"]);
		expect(formatInitReport(report)).not.toContain("Monti is added to your app");
		expect(report.recovery).toEqual(["pnpm exec monti add blog-theme --yes --overwrite"]);
	});
});

describe("monti init --resume", () => {
	it("runs again only the steps that did not complete, then clears the progress", async () => {
		const dir = fixtureApp();
		const first = fakeHost({ migrate: async () => false });
		const failed = await initProject({ cwd: dir, host: first, blogTheme: true, ...WITH_DATABASE });
		expect(failed.steps.filter((step) => step.status === "failed").map((step) => step.id)).toEqual(["migrate"]);
		expect(readInitState(dir)?.steps).toMatchObject({ install: "done", migrate: "incomplete", theme: "done" });

		const second = fakeHost();
		const resumed = await initProject({ cwd: dir, host: second, resume: true, env: {} });
		// The packages were installed the first time: not again. Only the tables are made.
		expect(second.install).not.toHaveBeenCalled();
		expect(second.migrate).toHaveBeenCalledTimes(1);
		expect(resumed.ok).toBe(true);
		expect(resumed.steps.map((step) => [step.id, step.status])).toEqual([["migrate", "done"]]);
		expect(existsSync(path.join(dir, ".monti/init.json"))).toBe(false);
		expect(formatInitReport(resumed)).toContain("Resumed");
	});

	it("installs the packages that were left, and everything that waited for them", async () => {
		const dir = fixtureApp();
		const offline = fakeHost({ install: () => Promise.reject(new Error("offline")) });
		await initProject({ cwd: dir, host: offline, blogTheme: true, ...WITH_DATABASE });

		const online = fakeHost();
		const resumed = await initProject({ cwd: dir, host: online, resume: true, env: {} });
		expect(resumed.ok).toBe(true);
		expect(resumed.steps.map((step) => [step.id, step.status])).toEqual([
			["install", "done"],
			["migrate", "done"],
			["typography", "done"],
			["theme", "done"],
		]);
		const commands = online.install.mock.calls.map(([command]) => command.args.join(" "));
		expect(commands[0]).toMatch(/^add @monti-cms\/core /);
		expect(commands).toContain("add -D @tailwindcss/typography");
		expect(existsSync(path.join(dir, "components/monti/blog-theme/theme.config.ts"))).toBe(true);
		expect(existsSync(path.join(dir, ".monti/init.json"))).toBe(false);
	});

	it("keeps the progress when a step fails again", async () => {
		const dir = fixtureApp();
		await initProject({ cwd: dir, host: fakeHost({ migrate: async () => false }), ...WITH_DATABASE });
		const again = await initProject({
			cwd: dir,
			host: fakeHost({ migrate: async () => false }),
			resume: true,
			env: {},
		});
		expect(again.ok).toBe(false);
		expect(again.recovery).toEqual(["pnpm exec monti migrate"]);
		expect(readInitState(dir)?.steps.migrate).toBe("incomplete");
	});

	it("says so when there is nothing to resume", async () => {
		await expect(initProject({ cwd: fixtureApp(), host: fakeHost(), resume: true, env: {} })).rejects.toThrow(
			/Nothing to resume/,
		);
	});
});

describe("monti init and pnpm 12", () => {
	const PLACEHOLDER = "packages: []\nallowBuilds:\n  esbuild: set this to true or false\n";
	const pnpm12 = (overrides = {}) => fakeHost({ pnpmVersion: () => "12.4.1", ...overrides });

	it("replaces the placeholder pnpm writes, shows the diff and asks first", async () => {
		const dir = fixtureApp({ "pnpm-workspace.yaml": PLACEHOLDER });
		const prompter = scriptedPrompter({
			"Add withCms": true,
			"Add .env.local": true,
			"esbuild's install script": true,
		});
		const report = await initProject({
			cwd: dir,
			host: pnpm12(),
			prompter,
			env: {},
			install: false,
			database: "skip",
			databaseSchema: "",
			adminGithubId: "1",
			siteUrl: "http://localhost:3000",
			locales: "en",
			timeZone: "UTC",
			storage: "none",
			extras: "none",
			blocks: "none",
			adminPath: "/studio",
			blogTheme: false,
		});
		expect(read(dir, "pnpm-workspace.yaml")).toBe("packages: []\nallowBuilds:\n  esbuild: true\n");
		expect(prompter.notes.some((note) => note.title === "Change to pnpm-workspace.yaml")).toBe(true);
		expect(report.updated).toContain("pnpm-workspace.yaml");
	});

	it("never writes a second allowBuilds or esbuild key, and leaves the other lines alone", async () => {
		const text =
			"packages:\n  - apps/*\nallowBuilds:\n  sharp: true\n  esbuild: set this to true or false\nonlyBuiltDependencies:\n  - sharp\n";
		const dir = fixtureApp({ "pnpm-workspace.yaml": text });
		await initProject({ cwd: dir, host: pnpm12(), env: {}, install: false, database: "skip" });
		const after = read(dir, "pnpm-workspace.yaml");
		expect(after.match(/^allowBuilds:/gm)).toHaveLength(1);
		expect(after.match(/esbuild:/g)).toHaveLength(1);
		expect(after).toBe(text.replace("set this to true or false", "true"));
	});

	it("adds the lines when the file has no allowBuilds, and creates the file when there is none", async () => {
		const withFile = fixtureApp({ "pnpm-workspace.yaml": "packages: []\n" });
		await initProject({ cwd: withFile, host: pnpm12(), env: {}, install: false, database: "skip" });
		expect(read(withFile, "pnpm-workspace.yaml")).toBe("packages: []\nallowBuilds:\n  esbuild: true\n");

		const none = fixtureApp();
		await initProject({ cwd: none, host: pnpm12(), env: {}, install: false, database: "skip" });
		expect(read(none, "pnpm-workspace.yaml")).toBe("allowBuilds:\n  esbuild: true\n");
	});

	it("leaves a decision already taken, and does nothing for pnpm 10 or another package manager", async () => {
		const decided = fixtureApp({ "pnpm-workspace.yaml": "allowBuilds:\n  esbuild: false\n" });
		await initProject({ cwd: decided, host: pnpm12(), env: {}, install: false, database: "skip" });
		expect(read(decided, "pnpm-workspace.yaml")).toBe("allowBuilds:\n  esbuild: false\n");

		const old = fixtureApp();
		await initProject({
			cwd: old,
			host: fakeHost({ pnpmVersion: () => "10.14.0" }),
			env: {},
			install: false,
			database: "skip",
		});
		expect(existsSync(path.join(old, "pnpm-workspace.yaml"))).toBe(false);

		const npm = fixtureApp({ "pnpm-lock.yaml": null, "package-lock.json": "{}" });
		await initProject({ cwd: npm, host: pnpm12(), env: {}, install: false, database: "skip" });
		expect(existsSync(path.join(npm, "pnpm-workspace.yaml"))).toBe(false);
	});

	it("when declined, prints the exact lines to add", async () => {
		const dir = fixtureApp({ "pnpm-workspace.yaml": PLACEHOLDER });
		const prompter = scriptedPrompter({
			"Add withCms": true,
			"Add .env.local": true,
			"esbuild's install script": false,
		});
		const report = await initProject({
			cwd: dir,
			host: pnpm12(),
			prompter,
			env: {},
			install: false,
			database: "skip",
			databaseSchema: "",
			adminGithubId: "1",
			siteUrl: "http://localhost:3000",
			locales: "en",
			timeZone: "UTC",
			storage: "none",
			extras: "none",
			blocks: "none",
			adminPath: "/studio",
			blogTheme: false,
		});
		expect(read(dir, "pnpm-workspace.yaml")).toBe(PLACEHOLDER);
		expect(report.next.join("\n")).toContain("allowBuilds:\n  esbuild: true");
	});

	it("is done before the install, so the install can finish", async () => {
		const dir = fixtureApp({ "pnpm-workspace.yaml": PLACEHOLDER });
		let seen: string | undefined;
		const host = pnpm12({
			install: async () => {
				seen = read(dir, "pnpm-workspace.yaml");
			},
		});
		await initProject({ cwd: dir, host, env: {}, database: "skip" });
		expect(seen).toContain("esbuild: true");
	});
});
