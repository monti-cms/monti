import { existsSync } from "node:fs";
import path from "node:path";
import { parseEnv } from "node:util";
import { describe, expect, it } from "vitest";
import { initProject } from "../init";
import { databaseUrl, prepareEnvFile } from "../init-env";
import { formatInitReport } from "../init-report";
import { fakeHost, fixtureApp, read, scriptedPrompter } from "./init-helpers";

/** The machine steps of init: .env.local and the secret, the database, the doctor. Every project is a temp folder and the host touches nothing. */

const envOf = (dir: string) => parseEnv(read(dir, ".env.local"));
const stepOf = (report: Awaited<ReturnType<typeof initProject>>, name: string) =>
	report.steps.find((step) => step.name === name);
const hasEnvLocal = (dir: string) => existsSync(path.join(dir, ".env.local"));
const ANSWERED = {
	locales: "en",
	storage: "none",
	extras: "none",
	blocks: "none",
	adminPath: "/studio",
	directiveSyntax: false,
	login: "password",
};
const GENERATED = /^[A-Za-z0-9+/]{43}=$/;

describe("the .env.local step", () => {
	it("creates .env.local from .env.example with a generated secret of the strength the docs recommend", () => {
		const example = "DATABASE_URL=postgres://user:password@host:5432/monti\n# a note\nMONTI_SECRET=\nOTHER=1\n";
		const dir = fixtureApp({ ".env.example": example });
		expect(prepareEnvFile(dir)).toEqual({ action: "created" });
		const secret = envOf(dir).MONTI_SECRET ?? "";
		// 32 random bytes as base64, like `openssl rand -base64 32`
		expect(Buffer.from(secret, "base64")).toHaveLength(32);
		expect(secret).toMatch(GENERATED);
		expect(read(dir, ".env.local").replace(secret, "")).toBe(example);
	});

	it("generates a different secret every time", () => {
		const secret = (dir: string) => {
			prepareEnvFile(dir);
			return envOf(dir).MONTI_SECRET;
		};
		const example = { ".env.example": "MONTI_SECRET=\n" };
		expect(secret(fixtureApp(example))).not.toBe(secret(fixtureApp(example)));
	});

	it("never overwrites .env.local: every line stays, a set secret is kept", () => {
		const own = "# mine\nDATABASE_URL=postgres://localhost/mine\nexport EXTRA='a b'\nMONTI_SECRET=keep-this-one\n";
		const dir = fixtureApp({ ".env.local": own, ".env.example": "MONTI_SECRET=\nNEW_VALUE=1\n" });
		expect(prepareEnvFile(dir)).toEqual({ action: "kept", secret: "kept" });
		expect(read(dir, ".env.local")).toBe(own);
	});

	it("fills an empty MONTI_SECRET and changes no other line", () => {
		for (const empty of ["MONTI_SECRET=", 'MONTI_SECRET=""', "MONTI_SECRET=   ", "export MONTI_SECRET="]) {
			const dir = fixtureApp({ ".env.local": `A=1\n${empty}\n# MONTI_SECRET=commented\nB='two words'\n` });
			expect(prepareEnvFile(dir)).toEqual({ action: "kept", secret: "filled" });
			expect(envOf(dir).MONTI_SECRET).toMatch(GENERATED);
			const others = read(dir, ".env.local")
				.split("\n")
				.filter((line) => !/^(export )?MONTI_SECRET=/.test(line));
			expect(others).toEqual(["A=1", "# MONTI_SECRET=commented", "B='two words'", ""]);
		}
	});

	it("adds a missing MONTI_SECRET at the end, with the other lines untouched", () => {
		const dir = fixtureApp({ ".env.local": "A=1\nB=2" });
		expect(prepareEnvFile(dir)).toEqual({ action: "kept", secret: "added" });
		expect(read(dir, ".env.local").startsWith("A=1\nB=2\nMONTI_SECRET=")).toBe(true);
		expect(envOf(dir).A).toBe("1");
		expect(envOf(dir).B).toBe("2");
	});

	it("does nothing without .env.example and without .env.local", () => {
		const dir = fixtureApp();
		expect(prepareEnvFile(dir)).toEqual({ action: "missing-example" });
		expect(hasEnvLocal(dir)).toBe(false);
	});

	it("takes a database URL from the environment or .env.local, and not the placeholder of .env.example", () => {
		const placeholder = fixtureApp({ ".env.local": "DATABASE_URL=postgres://user:password@host:5432/monti\n" });
		expect(databaseUrl(placeholder, {})).toBeUndefined();
		const real = fixtureApp({ ".env.local": "DATABASE_URL=postgres://localhost/mine\n" });
		expect(databaseUrl(real, {})).toBe("postgres://localhost/mine");
		expect(databaseUrl(fixtureApp(), { DATABASE_URL: "postgres://localhost/env" })).toBe("postgres://localhost/env");
		expect(databaseUrl(fixtureApp(), {})).toBeUndefined();
	});
});

describe("monti init runs the machine steps", () => {
	it("creates .env.local with a secret when it is absent, and leaves an existing one's other lines alone", async () => {
		const fresh = fixtureApp();
		await initProject({ cwd: fresh, host: fakeHost() });
		expect(envOf(fresh).MONTI_SECRET).toMatch(GENERATED);
		expect(read(fresh, ".env.local")).toContain("DATABASE_URL=");

		const existing = fixtureApp({ ".env.local": "FOO=bar\nMONTI_SECRET=\n# end\n" });
		const report = await initProject({ cwd: existing, host: fakeHost() });
		const text = read(existing, ".env.local");
		expect(text.startsWith("FOO=bar\nMONTI_SECRET=")).toBe(true);
		expect(text.endsWith("\n# end\n")).toBe(true);
		expect(envOf(existing).MONTI_SECRET).toMatch(GENERATED);
		expect(stepOf(report, "Set up .env.local")?.detail).toContain("filled");
	});

	it("keeps a secret that is set", async () => {
		const dir = fixtureApp({ ".env.local": "MONTI_SECRET=already-set-by-me\n" });
		await initProject({ cwd: dir, host: fakeHost() });
		expect(read(dir, ".env.local")).toBe("MONTI_SECRET=already-set-by-me\n");
	});

	it("sets up the database when a URL is in .env.local or in the environment", async () => {
		const inFile = fixtureApp({ ".env.local": "DATABASE_URL=postgres://localhost/mine\n" });
		const host = fakeHost();
		const report = await initProject({ cwd: inFile, host });
		expect(host.setupDatabase).toHaveBeenCalledWith(inFile);
		expect(stepOf(report, "Set up the database")?.status).toBe("done");

		const inEnv = fixtureApp();
		const envHost = fakeHost({ environment: () => ({ DATABASE_URL: "postgres://localhost/env" }) });
		await initProject({ cwd: inEnv, host: envHost });
		expect(envHost.setupDatabase).toHaveBeenCalledWith(inEnv);
	});

	it("skips the database without a URL, in one line that says how to run it later", async () => {
		const host = fakeHost();
		const lines: string[] = [];
		const report = await initProject({ cwd: fixtureApp(), host, log: (line) => lines.push(line) });
		expect(host.setupDatabase).not.toHaveBeenCalled();
		const step = stepOf(report, "Set up the database");
		expect(step?.status).toBe("skipped");
		expect(step?.detail).toContain("pnpm exec monti db:setup");
		expect(lines.filter((line) => line.includes("no DATABASE_URL"))).toHaveLength(1);
		expect(report.ok).toBe(true);
	});

	it("does not abort when the database setup fails: it reports the failure and adds it to what is left", async () => {
		const dir = fixtureApp({ ".env.local": "DATABASE_URL=postgres://localhost/mine\n" });
		const host = fakeHost({ setupDatabase: () => Promise.reject(new Error("connection refused")) });
		const report = await initProject({ cwd: dir, host });
		expect(stepOf(report, "Set up the database")).toMatchObject({
			status: "failed",
			detail: expect.stringContaining("connection refused"),
		});
		expect(report.ok).toBe(false);
		// the rest still ran
		expect(host.runDoctor).toHaveBeenCalled();
		expect(stepOf(report, "Check the setup")?.status).toBe("done");
		expect(report.next.find((step) => step.includes("connection refused"))).toContain("pnpm exec monti db:setup");
		expect(formatInitReport(report)).toContain("Set up the database: FAILED");
	});

	it("runs the doctor at the end and summarizes it, with the failures and their hints in what is left", async () => {
		const host = fakeHost({
			runDoctor: async (cwd) => ({
				ok: false,
				cwd,
				summary: { ok: 8, warn: 1, fail: 1, skip: 0 },
				checks: [
					{
						id: "secrets/monti-secret",
						group: "secrets",
						title: "MONTI_SECRET",
						status: "fail",
						message: "it is wrong",
						fix: "do the thing",
					},
				],
			}),
		});
		const report = await initProject({ cwd: fixtureApp(), host });
		expect(stepOf(report, "Check the setup")?.detail).toBe("Checked the setup: 8 ok, 1 warning, 1 to fix");
		const left = report.next.find((step) => step.startsWith("Fix what"));
		expect(left).toContain("secrets/monti-secret: it is wrong");
		expect(left).toContain("fix: do the thing");
	});

	it("does not list a database failure again when the database was skipped for want of a URL", async () => {
		const host = fakeHost({
			runDoctor: async (cwd) => ({
				ok: false,
				cwd,
				summary: { ok: 5, warn: 0, fail: 1, skip: 0 },
				checks: [
					{
						id: "database/url",
						group: "database",
						title: "DATABASE_URL",
						status: "fail",
						message: "DATABASE_URL is not set",
					},
				],
			}),
		});
		const report = await initProject({ cwd: fixtureApp(), host });
		expect(report.next.some((step) => step.startsWith("Fix what"))).toBe(false);
	});

	it("runs without a terminal (--yes or no TTY) and records the steps", async () => {
		const report = await initProject({ cwd: fixtureApp(), host: fakeHost() });
		expect(report.steps.map((step) => step.name)).toEqual([
			"Install packages",
			"Set up .env.local",
			"Set up the database",
			"Check the setup",
		]);
	});

	it("skips the steps when the person answers no to the question, and lists them by hand", async () => {
		const dir = fixtureApp();
		const prompter = scriptedPrompter({
			"Set up .env.local, the secret and the database now?": false,
			"Install the": true,
		});
		const host = fakeHost();
		const report = await initProject({ cwd: dir, host, prompter, ...ANSWERED });
		expect(host.setupDatabase).not.toHaveBeenCalled();
		expect(host.runDoctor).not.toHaveBeenCalled();
		expect(hasEnvLocal(dir)).toBe(false);
		expect(stepOf(report, "Set up .env.local, the secret and the database")).toMatchObject({
			status: "skipped",
			detail: "you answered no",
		});
		expect(report.next.some((step) => step.includes("cp .env.example .env.local"))).toBe(true);
	});

	it("asks the question once, with a default of yes, and shows each step as a progress line", async () => {
		const prompter = scriptedPrompter({ "Install the": true });
		let initial: boolean | undefined;
		const confirm = prompter.confirm.bind(prompter);
		prompter.confirm = async (question) => {
			if (question.message.startsWith("Set up .env.local")) initial = question.initial;
			return confirm(question);
		};
		await initProject({ cwd: fixtureApp(), host: fakeHost(), prompter, ...ANSWERED });
		expect(initial).toBe(true);
		expect(prompter.asked.filter((message) => message.startsWith("Set up .env.local"))).toHaveLength(1);
		expect(prompter.asked.filter((message) => message.startsWith("task: "))).toHaveLength(3);
	});

	it("a dry run changes nothing and plans the steps", async () => {
		const dir = fixtureApp();
		const host = fakeHost();
		const report = await initProject({ cwd: dir, host, dryRun: true });
		expect(hasEnvLocal(dir)).toBe(false);
		expect(host.setupDatabase).not.toHaveBeenCalled();
		expect(stepOf(report, "Set up .env.local, the secret and the database")?.status).toBe("planned");
	});

	it("without the packages installed (--no-install) the database and the check wait, and are in what is left", async () => {
		const dir = fixtureApp({ ".env.local": "DATABASE_URL=postgres://localhost/mine\n" });
		const host = fakeHost();
		const report = await initProject({ cwd: dir, host, install: false });
		expect(host.setupDatabase).not.toHaveBeenCalled();
		expect(host.runDoctor).not.toHaveBeenCalled();
		const left = report.next.join("\n");
		expect(left).toContain("db:setup");
		expect(left).toContain("monti doctor");
	});

	it("with GitHub login the human steps are the OAuth app and the dev server, with the secret already made", async () => {
		const dir = fixtureApp({ ".env.local": "DATABASE_URL=postgres://localhost/mine\n" });
		const report = await initProject({ cwd: dir, host: fakeHost(), login: "github" });
		const left = report.next.join("\n");
		expect(left).toContain("Create the GitHub OAuth app");
		expect(left).toContain("Start the app");
		expect(left).not.toMatch(/openssl|cp \.env\.example/);
	});
});
