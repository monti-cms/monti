import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { parseSchemaFile } from "../../schema-file/format";
import { printSchemaFile } from "../../schema-file/print";
import { initProject } from "../init";
import { formatInitReport } from "../init-report";
import { InitError, ProjectWriter } from "../init-writer";
import { Cancelled } from "../prompt";
import {
	CREATE_NEXT_APP,
	fakeHost,
	fixtureApp,
	installing,
	listFiles,
	POST_MDX,
	read,
	SRC_APP,
	schemaOf,
	scriptedPrompter,
} from "./init-helpers";

/** What every run needs so it touches nothing outside the fixture: a fake host and no install. */
const quiet = () => ({ host: fakeHost(), install: false });

/** Flags for every question of the prompts, so a scripted prompter only has to answer the confirmations. */
const ANSWERED = {
	siteUrl: "http://localhost:3000",
	locales: "en",
	timeZone: "UTC",
	storage: "none",
	extras: "none",
	blocks: "none",
	adminPath: "/studio",
	login: "password",
	directiveSyntax: false,
} as const;

/** Every file of the project with its content, for "nothing existing was touched". */
const snapshot = (dir: string) => Object.fromEntries(listFiles(dir).map((file) => [file, read(dir, file)]));

const index = (lines: readonly string[], needle: string) => lines.findIndex((line) => line.includes(needle));

describe("monti init in a fresh create-next-app", () => {
	it("INIT-R1 writes only Monti's own new files with the defaults", async () => {
		const dir = fixtureApp();
		const report = await initProject({ cwd: dir, ...quiet() });

		expect(report.ok).toBe(true);
		expect(report.created).toEqual([
			"monti.config.ts",
			"monti.schema.ts",
			"app/studio/[[...path]]/page.tsx",
			"app/studio/layout.tsx",
			"app/api/monti/[...path]/route.ts",
			".env.example",
		]);
		expect(report.overwritten).toEqual([]);

		// One line per feature, each with a comment; nothing hidden behind a preset.
		const config = read(dir, "monti.config.ts");
		expect(config).toContain('import { defineConfig, postgres } from "@monti-cms/core/server";');
		expect(config).toContain('import schema from "./monti.schema";');
		expect(config).toContain("export const cms = defineConfig({\n\tschema,");
		expect(config).toMatch(/\/\/ Bodies as MDX.*\n.*\n\t\tmdx\(\{ syntax: \[directiveSyntax\(\)\] \}\),/);
		for (const line of ["callout(), //", "collapsible(), //", "tabs(), //", "codeRef(), //", "color(), //"]) {
			expect(config).toContain(line);
		}
		for (const line of ["mermaid()", "chart()", "columns()", "codeExplorer()", "tooltip()"]) {
			expect(config).not.toContain(line);
		}
		expect(config).toContain("database: postgres(),");
		// The default login is the built-in email and password one: no GitHub in the config.
		expect(config).toContain('import { auth } from "@monti-cms/auth";');
		expect(config).toContain('import { password } from "@monti-cms/auth/password";');
		expect(config).toContain("\tauth: auth({ providers: [password()] }),");
		expect(config).not.toMatch(/github/i);
		expect(config).toContain("// storage: s3Storage(),");
		expect(config).not.toMatch(/\bai\(|\.\.\.blocks|process\.env|createCms|defineServerConfig/);

		const schema = schemaOf(dir);
		expect(() => parseSchemaFile(schema)).not.toThrow();
		expect(schema.collections.post).toMatchObject({ kind: "document", path: "/posts/:slug" });
		expect(schema.locales).toEqual([{ code: "en", name: "English" }]);
		expect(schema.defaultLocale).toBe("en");
		expect(schema.timeZone).toBe("UTC");
		expect(schema.admin).toEqual({ path: "/studio" });
		// The schema is what the admin writes: a pure literal that the printer would write the same, so the schema screen can save it.
		const written = read(dir, "monti.schema.ts");
		expect(
			written.startsWith('import { defineSchema } from "@monti-cms/core";\n\nexport default defineSchema({\n'),
		).toBe(true);
		expect(printSchemaFile(schema)).toBe(written);

		// The three Next files import the config by a relative path.
		expect(read(dir, "app/studio/[[...path]]/page.tsx")).toContain('import { cms } from "../../../monti.config";');
		const layout = read(dir, "app/studio/layout.tsx");
		expect(layout).toContain('import { cms } from "../../monti.config";');
		expect(layout).toContain('import "@monti-cms/admin/styles.css";');
		expect(layout).toContain('import "@monti-cms/blocks/styles.css";');
		expect(read(dir, "app/api/monti/[...path]/route.ts")).toContain('import { cms } from "../../../../monti.config";');
		expect(config + layout).not.toMatch(/[가-힣]/); // cms-allow-korean: checks that the generated files have no Korean
	});

	it("INIT-K3 edits only next.config and the root layout, says so, and never touches the .env.local that is there", async () => {
		const dir = fixtureApp({ ".gitignore": "node_modules\n.next\n", "tsconfig.json": '{ "compilerOptions": {} }' });
		const before = snapshot(dir);
		const report = await initProject({ cwd: dir, host: fakeHost(), setup: false });
		const after = snapshot(dir);

		const edited = Object.keys(before).filter((file) => after[file] !== before[file]);
		expect(edited.sort()).toEqual([".gitignore", "app/layout.tsx", "next.config.ts"]);
		expect(report.changed.map((item) => item.file).sort()).toEqual(edited.sort());
		expect(listFiles(dir)).not.toContain(".env.local");
		expect(listFiles(dir).filter((file) => !(file in before))).toEqual(report.created.slice().sort());
		expect(report.created).not.toContain("next.config.ts");

		// The wiring is in place: the export is wrapped, the import is added, and <html> has the attribute.
		expect(after["next.config.ts"]).toContain('import { withCms } from "@monti-cms/nextjs/config";');
		expect(after["next.config.ts"]).toContain("export default withCms(nextConfig);");
		expect(after["app/layout.tsx"]).toContain('<html lang="en" suppressHydrationWarning>');

		// The summary names each edited file with what changed in it, after "Created:".
		const text = formatInitReport(report);
		const changed = text.slice(text.indexOf("Changed:")).split("\n");
		const lineOf = (file: string) => changed.find((line) => line.startsWith(`  - ${file} `)) ?? "";
		expect(lineOf("next.config.ts")).toContain("withCms");
		expect(lineOf("app/layout.tsx")).toContain("suppressHydrationWarning");
		expect(lineOf(".gitignore")).toContain(".env.local");
		expect(lineOf(".gitignore")).toContain(".monti/");
		expect(text.indexOf("Created:")).toBeLessThan(text.indexOf("Changed:"));
	});

	it("INIT-K5 writes a .env.example that says what each variable is and where to get it, without secrets", async () => {
		const dir = fixtureApp();
		await initProject({ cwd: dir, ...quiet() });
		const example = read(dir, ".env.example");
		for (const name of ["DATABASE_URL", "MONTI_SECRET", "SITE_URL", "AUTH_TRUST_HOST"]) {
			expect(example).toContain(name);
		}
		expect(example).toContain("openssl rand -base64 32");
		// The local hint assumes no user and no password (a Docker default fails on a Homebrew Postgres).
		expect(example).toContain("postgres://localhost/monti");
		expect(example).not.toContain("postgres:postgres");
		// The default login (email and password) needs no setting at all.
		expect(example).not.toMatch(/GITHUB|OAuth/i);
		// The schema is a commented line with a reason, not a value and not a question.
		expect(example).toMatch(/^# DATABASE_SCHEMA=/m);
		expect(example).not.toMatch(/^DATABASE_SCHEMA=/m);
		expect(example).toMatch(/shared with other apps/);
		expect(example).toMatch(/^MONTI_SECRET=$/m);
		expect(example).not.toContain("S3_BUCKET");
		// Every non-comment line is a name with an empty value or a placeholder, never a real secret.
		for (const line of example.split("\n").filter((entry) => entry && !entry.startsWith("#"))) {
			expect(line).toMatch(/^(DATABASE_URL=postgres:\/\/user:password@host:5432\/monti|[A-Z0-9_]+=[a-z0-9]*)$/);
		}
	});

	it("INIT-R2 with --login github writes the GitHub provider, its variables with how to get them, and the OAuth app step", async () => {
		const dir = fixtureApp();
		const report = await initProject({ cwd: dir, ...quiet(), login: "github" });
		const config = read(dir, "monti.config.ts");
		expect(config).toContain('import { auth } from "@monti-cms/auth";');
		expect(config).toContain('import { github } from "@monti-cms/auth/github";');
		expect(config).toContain("\tauth: auth({ providers: [github()] }),");
		expect(config).not.toContain("password");
		const example = read(dir, ".env.example");
		for (const name of ["AUTH_GITHUB_ID", "AUTH_GITHUB_SECRET", "MONTI_ADMIN_GITHUB_ID"]) {
			expect(example).toMatch(new RegExp(`^${name}=$`, "m"));
		}
		expect(example).toContain("api.github.com/users/<your-github-login>");
		expect(example).toContain("http://localhost:3000/api/monti/auth/callback/github");
		const step = report.next.at(-1) ?? "";
		expect(step).toContain("OAuth");
		expect(step).toContain("http://localhost:3000/api/monti/auth/callback/github");
		expect(report.next.join("\n")).not.toContain("create the first admin");
	});

	it("INIT-R2 writes mdx({ syntax: [directiveSyntax()] }) and installs the package by default, since blocks are installed", async () => {
		const dir = fixtureApp();
		const host = fakeHost();
		const report = await initProject({ cwd: dir, host });
		const config = read(dir, "monti.config.ts");
		expect(config).toContain('import { directiveSyntax } from "@monti-cms/syntax-directive";');
		expect(config).toMatch(/\n\t\tmdx\(\{ syntax: \[directiveSyntax\(\)\] \}\),/);
		expect(host.install).toHaveBeenCalledWith(installing("@monti-cms/syntax-directive"));
		expect(report.answers.directiveSyntax).toBe(true);
	});

	it("INIT-R2 --no-directive-syntax, or no blocks, keeps plain mdx() and installs nothing extra", async () => {
		for (const options of [{ directiveSyntax: false }, { blocks: "none" }]) {
			const dir = fixtureApp();
			const host = fakeHost();
			await initProject({ cwd: dir, host, ...options });
			const config = read(dir, "monti.config.ts");
			expect(config).not.toContain("directiveSyntax");
			expect(config).toMatch(/\n\t\tmdx\(\),/);
			expect(host.install).toHaveBeenCalledOnce();
			expect(host.install).not.toHaveBeenCalledWith(installing("@monti-cms/syntax-directive"));
		}
	});

	it("INIT-R2 installs @monti-cms/auth for either login", async () => {
		for (const login of ["password", "github"] as const) {
			const install = vi.fn();
			await initProject({ cwd: fixtureApp(), host: fakeHost({ install }), login });
			expect(install).toHaveBeenCalledWith(installing("@monti-cms/auth"));
		}
	});

	it("INIT-N1 lists only the human steps after the machine steps worked, each with exact content", async () => {
		const dir = fixtureApp();
		const report = await initProject({ cwd: dir, host: fakeHost() });
		const next = report.next;

		// The install ran, init edited next.config and the layout, and made .env.local, so none of them is in the list. The database has no URL yet: its human step is.
		// Each step names what to do with the exact command or place: the database URL, the dev server and its admin URL, the first admin.
		expect(next.map((step) => step.split("\n")[0])).toEqual([
			expect.stringMatching(/DATABASE_URL.*\.env\.local/),
			expect.stringMatching(/pnpm dev.*http:\/\/localhost:3000\/studio/),
			expect.stringMatching(/deploy.*\/studio.*first admin/),
		]);
		expect(next.join("\n")).not.toMatch(/cp \.env\.example|openssl|Check the setup/);
		expect(next[0]).toContain("pnpm exec monti db:setup");
		expect(next[2]).toContain("That screen closes as soon as one admin exists");
		expect(next[2]).toContain("monti admin:reset-password");
		expect(next[2]).not.toMatch(/GitHub|OAuth/);
		expect(next.join("\n")).not.toContain("monti import");

		const text = formatInitReport(report);
		expect(text).toContain("What is left");
		expect(text).toMatch(/\n {2}2\. Start the app/);
	});

	it("INIT-N1 keeps the by-hand steps when the machine steps are turned off", async () => {
		const dir = fixtureApp();
		const host = fakeHost();
		const report = await initProject({ cwd: dir, host, setup: false });
		expect(listFiles(dir)).not.toContain(".env.local");
		expect(host.setupDatabase).not.toHaveBeenCalled();
		expect(host.runDoctor).not.toHaveBeenCalled();
		expect(report.steps).toContainEqual(
			expect.objectContaining({
				name: "Set up .env.local, the secret and the database",
				status: "skipped",
				detail: "--no-setup",
			}),
		);
		const next = report.next;
		expect(next.map((step) => step.split("\n")[0])).toEqual([
			expect.stringMatching(/\.env\.local.*\.env\.example/),
			expect.stringContaining("pnpm exec monti db:setup"),
			expect.stringContaining("pnpm exec monti doctor"),
			expect.stringMatching(/pnpm dev.*http:\/\/localhost:3000\/studio/),
			expect.stringMatching(/deploy.*\/studio.*first admin/),
		]);
		expect(next[0]).toContain("cp .env.example .env.local");
		expect(next[0]).toContain("openssl rand -base64 32");
		expect(next[2]).toContain("`monti doctor` will tell you if any of the steps above is missing");
	});
});

describe("monti init and the package install", () => {
	it("INIT-I1 installs the packages with the detected package manager when there is no prompt", async () => {
		const dir = fixtureApp();
		const host = fakeHost();
		const report = await initProject({ cwd: dir, host });
		expect(host.install).toHaveBeenCalledOnce();
		expect(host.install).toHaveBeenCalledWith({
			command: "pnpm",
			cwd: dir,
			args: expect.arrayContaining([
				"@monti-cms/core",
				"@monti-cms/admin",
				"@monti-cms/nextjs",
				"@monti-cms/mdx",
				"@monti-cms/blocks",
				"@monti-cms/auth",
			]),
		});
		// `pnpm add <packages>`: the subcommand comes first.
		expect(host.install).toHaveBeenCalledWith(
			expect.objectContaining({ args: expect.toSatisfy((args: readonly string[]) => args[0] === "add") }),
		);
		expect(host.install).not.toHaveBeenCalledWith(installing("@monti-cms/ai"));
		expect(host.install).not.toHaveBeenCalledWith(installing("mermaid"));
		expect(report.steps.map((step) => [step.name, step.status])).toContainEqual(["Install packages", "done"]);
		expect(report.next.join("\n")).not.toContain("Install the packages");
	});

	it("INIT-S1 shows the exact command and asks, with yes as the default, before running it", async () => {
		const prompter = scriptedPrompter({ "Install the": true });
		let initial: boolean | undefined;
		const confirm = prompter.confirm.bind(prompter);
		prompter.confirm = async (question) => {
			initial = question.initial;
			return confirm(question);
		};
		const host = fakeHost();
		const report = await initProject({ cwd: fixtureApp(), host, prompter, ...ANSWERED });
		const question = prompter.asked.find((message) => message.startsWith("Install the"));
		expect(question).toMatch(/^Install the \d+ Monti packages with `pnpm add @monti-cms\/core /);
		expect(initial).toBe(true);
		expect(host.install).toHaveBeenCalledTimes(1);
		expect(report.next.join("\n")).not.toContain("Install the packages");
	});

	it("INIT-S1 a no runs nothing, records the step as skipped and keeps the command in the list", async () => {
		const prompter = scriptedPrompter({ "Install the": false });
		const host = fakeHost();
		const report = await initProject({ cwd: fixtureApp(), host, prompter, ...ANSWERED });
		expect(host.install).not.toHaveBeenCalled();
		expect(report.steps[0]).toEqual({ name: "Install packages", status: "skipped", detail: "you answered no" });
		expect(report.ok).toBe(true);
		expect(report.next[0]).toMatch(/^Install the packages:\npnpm add @monti-cms\/core /);
	});

	it("INIT-S1 --no-install asks nothing, runs nothing and prints the command first in the list", async () => {
		const prompter = scriptedPrompter({});
		const host = fakeHost();
		const report = await initProject({ cwd: fixtureApp(), host, prompter, install: false, setup: false, ...ANSWERED });
		expect(prompter.asked).toEqual([]);
		expect(host.install).not.toHaveBeenCalled();
		expect(report.steps[0]).toEqual({ name: "Install packages", status: "skipped", detail: "--no-install" });
		expect(report.next[0]).toMatch(/^Install the packages:\npnpm add @monti-cms\/core /);
		expect(index(report.next, "Install the packages")).toBeLessThan(index(report.next, "Create .env.local"));
	});

	it("INIT-S1 does not ask about the install when every package is already a dependency", async () => {
		const { packagesFor } = await import("../init-install");
		const { collectAnswers } = await import("../init-prompts");
		const { detectApp } = await import("../init-detect");
		const answers = await collectAnswers(detectApp(fixtureApp()), { blocks: "none" });
		const dependencies = Object.fromEntries([...packagesFor(answers), "next"].map((name) => [name, "1.0.0"]));
		const dir = fixtureApp({ "package.json": JSON.stringify({ name: "x", dependencies }) });
		const prompter = scriptedPrompter({});
		const host = fakeHost();
		const report = await initProject({ cwd: dir, host, prompter, setup: false, ...ANSWERED });
		expect(prompter.asked).toEqual([]);
		expect(host.install).not.toHaveBeenCalled();
		expect(report.steps.map((step) => step.name)).not.toContain("Install packages");
	});
});

describe("monti init tailors what is left to the app", () => {
	it("INIT-R2 a src/ app keeps the config in src and the Next files under src/app", async () => {
		const dir = fixtureApp(SRC_APP);
		const report = await initProject({ cwd: dir, ...quiet(), adminPath: "/cms/studio" });
		expect(report.created).toEqual([
			"src/monti.config.ts",
			"src/monti.schema.ts",
			"src/app/cms/studio/[[...path]]/page.tsx",
			"src/app/cms/studio/layout.tsx",
			"src/app/api/monti/[...path]/route.ts",
			".env.example",
		]);
		expect(read(dir, "src/app/cms/studio/layout.tsx")).toContain('import { cms } from "../../../monti.config";');
		expect(schemaOf(dir, "src/monti.schema.ts").admin).toEqual({ path: "/cms/studio" });
		expect(listFiles(dir).filter((file) => file.startsWith("app/"))).toEqual([]);
		// The edit names the src/ layout.
		expect(report.changed.map((item) => item.file)).toContain("src/app/layout.tsx");
		expect(read(dir, "src/app/layout.tsx")).toContain("suppressHydrationWarning");
		expect(report.next.join("\n")).toContain("then open http://localhost:3000/cms/studio");
	});

	it("INIT-K3 an edited next.config is reported under Changed and is not left to the person", async () => {
		const dir = fixtureApp();
		const report = await initProject({ cwd: dir, ...quiet() });
		expect(read(dir, "next.config.ts")).toContain("export default withCms(nextConfig);");
		expect(report.changed).toContainEqual({ file: "next.config.ts", change: expect.stringContaining("withCms") });
		expect(report.next.join("\n")).not.toContain("next.config");
	});

	it("INIT-K3 a next.config init cannot wrap is left as it is, and what is left says why and what to write", async () => {
		const commonjs = "module.exports = { reactStrictMode: true };\n";
		const dir = fixtureApp({ "next.config.ts": commonjs });
		const report = await initProject({ cwd: dir, ...quiet() });
		expect(read(dir, "next.config.ts")).toBe(commonjs);
		expect(report.changed.map((item) => item.file)).not.toContain("next.config.ts");
		const step = report.next.find((line) => line.includes("next.config.ts")) ?? "";
		expect(step).toContain("module.exports");
		expect(step).toContain('import { withCms } from "@monti-cms/nextjs/config";');
		expect(step).toContain("export default withCms(");
	});

	it("INIT-R2 without a next.config it creates next.config.ts with withCms, and lists it under Created", async () => {
		const dir = fixtureApp({ "next.config.ts": null });
		const report = await initProject({ cwd: dir, ...quiet() });
		expect(report.created).toContain("next.config.ts");
		const config = read(dir, "next.config.ts");
		expect(config).toContain('import { withCms } from "@monti-cms/nextjs/config";');
		expect(config).toContain("export default withCms(nextConfig);");
		expect(report.next.join("\n")).not.toContain("next.config");
	});

	it("INIT-K3 is safe to run twice: the second run changes nothing and says it is already there", async () => {
		const dir = fixtureApp();
		await initProject({ cwd: dir, ...quiet() });
		const after = snapshot(dir);
		const again = await initProject({ cwd: dir, ...quiet() });
		expect(snapshot(dir)).toEqual(after);
		expect(again.changed).toEqual([]);
		expect(again.skipped).toEqual(expect.arrayContaining(["next.config.ts", "app/layout.tsx"]));
		const text = formatInitReport(again);
		expect(text).not.toContain("Changed:");
		expect(text).toMatch(/Already there, left as they are:[\s\S]*next\.config\.ts[\s\S]*app\/layout\.tsx/);
		expect(again.next.join("\n")).not.toMatch(/withCms|suppressHydrationWarning/);
	});

	it("INIT-K3 a layout init cannot edit is left as it is, and what is left says why", async () => {
		const layout = "export default function L({ children }: { children: React.ReactNode }) { return children; }\n";
		const dir = fixtureApp({ "app/layout.tsx": layout });
		const report = await initProject({ cwd: dir, ...quiet() });
		expect(read(dir, "app/layout.tsx")).toBe(layout);
		expect(report.changed.map((item) => item.file)).not.toContain("app/layout.tsx");
		expect(report.next.join("\n")).toContain("app/layout.tsx has no <html> tag");
	});

	it("INIT-K5 a missing .gitignore is created, and one that misses .env.local gets it; none of it is left to the person", async () => {
		const none = fixtureApp({ ".gitignore": null });
		const report = await initProject({ cwd: none, ...quiet() });
		expect(read(none, ".gitignore")).toBe(".env.local\n.monti/\n");
		expect(report.changed).toContainEqual({
			file: ".gitignore",
			change: "created it with .env.local (it holds your secrets) and .monti/ (monti db:migrate writes its logs there)",
		});
		expect(report.next.join("\n")).not.toContain("out of git");

		const uncovered = fixtureApp({ ".gitignore": "node_modules\n" });
		const second = await initProject({ cwd: uncovered, ...quiet() });
		expect(read(uncovered, ".gitignore")).toBe("node_modules\n.env.local\n.monti/\n");
		expect(second.next.join("\n")).not.toContain("out of git");

		const covered = fixtureApp({ ".gitignore": ".env*.local\n" });
		const third = await initProject({ cwd: covered, ...quiet() });
		expect(read(covered, ".gitignore")).toBe(".env*.local\n.monti/\n");
		expect(third.changed).toContainEqual({
			file: ".gitignore",
			change: "added .monti/ (monti db:migrate writes its logs there)",
		});
	});

	it("INIT-I1 uses the package manager the lockfile names, or the one given", async () => {
		const dir = fixtureApp({ "pnpm-lock.yaml": null, "yarn.lock": "" });
		const host = fakeHost();
		const report = await initProject({ cwd: dir, host });
		expect(host.install).toHaveBeenCalledWith(expect.objectContaining({ command: "yarn" }));
		expect(report.next.join("\n")).toContain("then create Monti's tables (once): yarn monti db:setup");
		expect(report.next.join("\n")).toContain("Start the app: yarn dev");
		const bun = await initProject({
			cwd: fixtureApp({ "pnpm-lock.yaml": null }),
			...quiet(),
			packageManager: "bun",
		});
		expect(bun.next.join("\n")).toContain("Start the app: bun run dev");
	});

	it("INIT-N1 takes the dev port from the dev script for the callback URL", async () => {
		const dir = fixtureApp({
			"package.json": JSON.stringify({
				name: "x",
				scripts: { dev: "next dev -p 4000" },
				dependencies: { next: "16.3.8" },
			}),
		});
		const report = await initProject({ cwd: dir, ...quiet(), login: "github" });
		expect(report.next.join("\n")).toContain("http://localhost:4000/api/monti/auth/callback/github");
		expect(read(dir, ".env.example")).toContain("# SITE_URL=https://example.com");
	});

	it("INIT-R2 opts the admin page out of the instant validation only when next.config turns on cacheComponents", async () => {
		const plain = fixtureApp();
		await initProject({ cwd: plain, ...quiet() });
		expect(read(plain, "app/studio/[[...path]]/page.tsx")).not.toContain("instant");

		const cached = fixtureApp({
			"next.config.ts": `import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
};

export default nextConfig;
`,
		});
		await initProject({ cwd: cached, ...quiet() });
		expect(read(cached, "app/studio/[[...path]]/page.tsx")).toContain("export const instant = false;");
	});

	it("INIT-K7 refuses an app that is not a Next App Router app, saying what to do", async () => {
		await expect(initProject({ cwd: fixtureApp({ "package.json": '{ "name": "x" }' }), ...quiet() })).rejects.toThrow(
			/`next` is not in the dependencies/,
		);
		await expect(
			initProject({
				cwd: fixtureApp({
					"app/layout.tsx": null,
					"app/page.tsx": null,
					"app/globals.css": null,
					"pages/index.tsx": "",
				}),
				...quiet(),
			}),
		).rejects.toThrow(/only has a pages\/ folder/);
		await expect(initProject({ cwd: fixtureApp({ "package.json": null }), ...quiet() })).rejects.toThrow(
			/package.json not found/,
		);
	});
});

describe("monti init choices", () => {
	it("INIT-C1 an app with a content folder gets a post collection from its front matter", async () => {
		const dir = fixtureApp({
			"content/posts/first.mdx": POST_MDX("first"),
			"content/posts/second.md": POST_MDX("second"),
		});
		const report = await initProject({ cwd: dir, ...quiet() });
		const post = schemaOf(dir).collections.post;
		expect(post.path).toBe("/posts/:slug");
		expect(Object.keys(post.fields)).toEqual(["title", "slug", "author", "cover", "description", "tagIds"]);
		expect(post.fields.tagIds).toMatchObject({ kind: "relation", to: "tag", many: true });
		expect(post.fields.description).toMatchObject({ kind: "text", role: "summary" });
		expect(post.fields.cover).toMatchObject({ kind: "media", accept: "image" });
		expect(report.app.contentFolders).toEqual([{ dir: "content/posts", files: 2 }]);
		expect(report.notes.join("\n")).toContain("follows the front matter of content/posts/");
		// The content itself is never touched.
		expect(read(dir, "content/posts/first.mdx")).toBe(POST_MDX("first"));
	});

	it("INIT-R2 every feature: the config has one line each and the packages follow", async () => {
		const dir = fixtureApp();
		const host = fakeHost();
		await initProject({
			cwd: dir,
			host,
			locales: "ko,en",
			timeZone: "Asia/Seoul",
			storage: "s3",
			extras: "ai",
			blocks: "callout,tabs,color",
			siteUrl: "https://blog.example.com",
		});
		const config = read(dir, "monti.config.ts");
		expect(config).toContain('import { ai } from "@monti-cms/ai";');
		expect(config).toContain('import { s3Storage } from "@monti-cms/storage-s3";');
		expect(config).toContain('import { callout, color, tabs } from "@monti-cms/blocks";');
		expect(config).toMatch(/\n\t\tai\(\),\n/);
		expect(config).toContain("\tstorage: s3Storage(),");
		expect(config.indexOf("callout(),")).toBeLessThan(config.indexOf("tabs(),"));
		expect(config.indexOf("tabs(),")).toBeLessThan(config.indexOf("color(),"));

		const schema = schemaOf(dir);
		expect(schema.locales.map((entry: { code: string }) => entry.code)).toEqual(["ko", "en"]);
		expect(schema.defaultLocale).toBe("ko");
		expect(schema.timeZone).toBe("Asia/Seoul");

		expect(host.install).toHaveBeenCalledWith(
			installing("@monti-cms/ai", "@monti-cms/storage-s3", "@monti-cms/blocks"),
		);
		expect(read(dir, ".env.example")).toContain("S3_BUCKET=");
		expect(read(dir, ".env.example")).toContain("# SITE_URL=https://blog.example.com");
	});

	it("INIT-R2 no blocks: a short config with just mdx", async () => {
		const dir = fixtureApp();
		await initProject({ cwd: dir, ...quiet(), blocks: "none" });
		const config = read(dir, "monti.config.ts");
		expect(config).not.toContain("@monti-cms/blocks");
		expect(config).toContain("mdx(),");
		expect(read(dir, "app/studio/layout.tsx")).not.toContain("blocks/styles.css");
	});
});

describe("monti init and files that already exist", () => {
	it("INIT-Q4 writes the computer's time zone to the schema and says so in the summary", async () => {
		const dir = fixtureApp();
		const host = fakeHost({ systemTimeZone: () => "Asia/Seoul" });
		const report = await initProject({ cwd: dir, host, install: false });
		expect(schemaOf(dir).timeZone).toBe("Asia/Seoul");
		// The summary has the line that names the zone, where it came from and which file to change (its parts are checked at L1).
		const line = formatInitReport(report)
			.split("\n")
			.find((entry) => entry.includes("Asia/Seoul"));
		expect(line).toContain("this computer");
		expect(line).toContain("`timeZone` in monti.schema.ts");
	});

	it("INIT-K1 an existing monti.config.ts is kept, its schema file is not written, and the skip is reported", async () => {
		const dir = fixtureApp({ "monti.config.ts": "// mine\nexport const cms = {};\n" });
		const report = await initProject({ cwd: dir, ...quiet() });
		expect(read(dir, "monti.config.ts")).toBe("// mine\nexport const cms = {};\n");
		expect(() => read(dir, "monti.schema.ts")).toThrow();
		expect(report.created).not.toContain("monti.config.ts");
		expect(report.skipped).toContain("monti.config.ts");
		expect(report.created).toContain("app/studio/layout.tsx");
		expect(report.notes.join("\n")).toContain("monti.config.ts already exists, so it was kept");
		expect(formatInitReport(report)).toContain("Already there, left as they are:\n  - monti.config.ts");
	});

	it("INIT-K1 a changed file is kept unless --overwrite (or a yes in the prompts)", async () => {
		const dir = fixtureApp({ "app/studio/layout.tsx": "// my layout\n" });
		const kept = await initProject({ cwd: dir, ...quiet() });
		expect(read(dir, "app/studio/layout.tsx")).toBe("// my layout\n");
		expect(kept.skipped).toContain("app/studio/layout.tsx");
		expect(kept.notes.join("\n")).toContain("app/studio/layout.tsx already exists and was kept. Run with --overwrite");

		const replaced = await initProject({ cwd: dir, ...quiet(), overwrite: true });
		expect(read(dir, "app/studio/layout.tsx")).toContain("CmsAdminLayout");
		expect(replaced.overwritten).toContain("app/studio/layout.tsx");

		const asked = fixtureApp({ "app/studio/layout.tsx": "// my layout\n" });
		const prompter = scriptedPrompter({ "already exists and differs": false });
		await initProject({ cwd: asked, ...quiet(), ...ANSWERED, prompter });
		expect(read(asked, "app/studio/layout.tsx")).toBe("// my layout\n");
		expect(prompter.asked.some((message) => message.includes("app/studio/layout.tsx already exists"))).toBe(true);
	});

	it("INIT-K1 pressing Enter at the overwrite question keeps the file: the default is no", async () => {
		const dir = fixtureApp({ "app/studio/layout.tsx": "// my layout\n" });
		const prompter = scriptedPrompter({});
		const confirm = prompter.confirm.bind(prompter);
		// Enter takes the question's default answer; a question without one would take yes, so the test fails if the default goes.
		let overwriteAsked = false;
		prompter.confirm = async (question) => {
			if (!question.message.includes("already exists and differs")) return confirm(question);
			overwriteAsked = true;
			return question.initial ?? true;
		};
		const report = await initProject({ cwd: dir, ...quiet(), ...ANSWERED, prompter });
		expect(overwriteAsked).toBe(true);
		expect(read(dir, "app/studio/layout.tsx")).toBe("// my layout\n");
		expect(report.skipped).toContain("app/studio/layout.tsx");
		expect(report.overwritten).toEqual([]);
	});
});

describe("monti init --dry-run", () => {
	it("INIT-K7 lists what it would do and writes and runs nothing, not even asking about the install", async () => {
		const dir = fixtureApp();
		const before = snapshot(dir);
		const host = fakeHost();
		const prompter = scriptedPrompter({});
		const report = await initProject({ cwd: dir, host, prompter, dryRun: true, ...ANSWERED, extras: "ai" });
		expect(snapshot(dir)).toEqual(before);
		expect(host.install).not.toHaveBeenCalled();
		expect(prompter.asked).toEqual([]);
		expect(report.dryRun).toBe(true);
		expect(report.created).toContain("monti.config.ts");
		expect(report.steps.every((step) => step.status === "planned")).toBe(true);
		const text = formatInitReport(report);
		expect(text).toContain("Dry run: nothing was written");
		expect(text).toContain("Would create:");
	});
});

describe("monti init when something goes wrong", () => {
	it("INIT-K7 a write that fails stops with the list of what was written before it", async () => {
		const dir = fixtureApp();
		// The route file is written after the config, the schema and the admin files; a file where its folder should be makes that write fail.
		writeFileSync(path.join(dir, "app/api"), "");
		const failure = initProject({ cwd: dir, ...quiet() });
		await expect(failure).rejects.toBeInstanceOf(InitError);
		await expect(failure).rejects.toThrow(
			/These files were written before it failed \(nothing was undone\):\n {2}- monti\.config\.ts\n {2}- monti\.schema\.ts\n/,
		);
		await expect(failure).rejects.toThrow(/Run `monti init` again to continue/);
	});

	it("INIT-K7 cancelling a prompt writes nothing", async () => {
		const dir = fixtureApp();
		const before = listFiles(dir);
		const prompter = scriptedPrompter({ "Default language of the site": "cancel" });
		await expect(initProject({ cwd: dir, ...quiet(), prompter })).rejects.toBeInstanceOf(Cancelled);
		expect(listFiles(dir)).toEqual(before);
	});

	it("INIT-K7 a wrong flag fails before anything is written, naming the flag", async () => {
		const dir = fixtureApp();
		const before = listFiles(dir);
		const cases: [Record<string, string>, RegExp][] = [
			[{ locales: "English" }, /--locales: "English" must be a language code/],
			[{ timeZone: "Mars/Base" }, /--time-zone "Mars\/Base" must be an IANA time zone/],
			[{ storage: "gcs" }, /--storage "gcs" must be "s3" or "none"/],
			[{ extras: "nope" }, /--extras: "nope" is not an extra/],
			[{ blocks: "callout,nope" }, /--blocks: "nope" is not a block/],
			[{ adminPath: "/" }, /--admin-path "\/" must be a path like "\/studio"/],
			[{ adminPath: "/api/studio" }, /--admin-path/],
			[{ adminPath: "/../../etc" }, /--admin-path/],
			[{ siteUrl: "localhost:3000" }, /--site-url/],
		];
		for (const [flags, message] of cases) {
			await expect(initProject({ cwd: dir, ...quiet(), ...flags })).rejects.toThrow(message);
		}
		expect(listFiles(dir)).toEqual(before);
	});
});

describe("monti init writes only inside the project", () => {
	it("INIT-K6 ProjectWriter refuses absolute paths, .. and symlinks that lead out", () => {
		const dir = fixtureApp();
		const outside = mkdtempSync(path.join(tmpdir(), "monti-outside-"));
		symlinkSync(outside, path.join(dir, "link"), "dir");
		const writer = new ProjectWriter(dir);
		expect(() => writer.write("../escape.txt", "x")).toThrow(/outside the project/);
		expect(() => writer.write("a/../../escape.txt", "x")).toThrow(/outside the project/);
		expect(() => writer.write(path.join(outside, "abs.txt"), "x")).toThrow(/outside the project/);
		expect(() => writer.write("link/escape.txt", "x")).toThrow(/leads outside the project/);
		writer.write("inside/ok.txt", "ok");
		expect(read(dir, "inside/ok.txt")).toBe("ok");
		expect(writer.written).toEqual(["inside/ok.txt"]);
	});

	it("INIT-K6 an app folder that is a symlink out of the project stops the run before it writes there", async () => {
		const outside = mkdtempSync(path.join(tmpdir(), "monti-outside-"));
		const dir = fixtureApp({ "app/layout.tsx": null, "app/page.tsx": null, "app/globals.css": null });
		symlinkSync(outside, path.join(dir, "app"), "dir");
		await expect(initProject({ cwd: dir, ...quiet() })).rejects.toThrow(/outside the project/);
		expect(listFiles(outside)).toEqual([]);
	});
});

describe("monti init and the heavy blocks", () => {
	const run = async (blocks: string) => {
		const dir = fixtureApp();
		const host = fakeHost();
		await initProject({ cwd: dir, host, blocks });
		expect(host.install).toHaveBeenCalledOnce();
		return { config: read(dir, "monti.config.ts"), install: host.install };
	};

	it("INIT-R2 the default blocks import from the barrel and install neither mermaid nor recharts", async () => {
		const { config, install } = await run("default");
		expect(config).toContain('from "@monti-cms/blocks";');
		expect(config).not.toContain("@monti-cms/blocks/chart");
		expect(config).not.toContain("@monti-cms/blocks/mermaid");
		expect(install).toHaveBeenCalledWith(installing("@monti-cms/blocks"));
		expect(install).not.toHaveBeenCalledWith(installing("recharts"));
		expect(install).not.toHaveBeenCalledWith(installing("mermaid"));
	});

	it("INIT-R2 chart and mermaid come from their own entry points, and their libraries are installed only then", async () => {
		const { config, install } = await run("default,chart,mermaid");
		expect(config).toContain('import { chart } from "@monti-cms/blocks/chart";');
		expect(config).toContain('import { mermaid } from "@monti-cms/blocks/mermaid";');
		// The barrel import has none of the two.
		const barrel = config.split("\n").find((line) => line.endsWith('from "@monti-cms/blocks";')) ?? "";
		expect(barrel).not.toMatch(/\b(chart|mermaid)\b/);
		expect(install).toHaveBeenCalledWith(installing("recharts", "mermaid"));
		expect(config).toContain("chart(),");
		expect(config).toContain("mermaid(),");
	});

	it("INIT-R2 only the chosen heavy block brings its library", async () => {
		const { config, install } = await run("default,chart");
		expect(config).toContain('from "@monti-cms/blocks/chart"');
		expect(config).not.toContain("@monti-cms/blocks/mermaid");
		expect(install).toHaveBeenCalledWith(installing("recharts"));
		expect(install).not.toHaveBeenCalledWith(installing("mermaid"));
	});
});

describe("monti init and the languages of the content", () => {
	const quiet = () => ({ host: fakeHost(), install: false });

	const PAIR = {
		"content/posts/hello.en.mdx": POST_MDX("hello"),
		"content/posts/hello.ko.mdx": POST_MDX("hello"),
		"content/posts/about.ko.mdx": POST_MDX("about"),
	};

	it("INIT-Q3 with --yes (no prompts) the site languages are the ones found, the default being the unpaired one", async () => {
		const dir = fixtureApp(PAIR);
		const report = await initProject({ cwd: dir, ...quiet() });
		const schema = schemaOf(dir);
		expect(schema.locales.map((locale: { code: string }) => locale.code)).toEqual(["ko", "en"]);
		expect(schema.defaultLocale).toBe("ko");
		expect(report.answers.locales).toEqual(["ko", "en"]);
		expect(report.notes.join("\n")).toMatch(/languages are ko, en, found in the file names of content\/posts\//);
	});

	it("INIT-Q3 language folders give the languages too", async () => {
		const dir = fixtureApp({
			"content/en/hello.mdx": POST_MDX("hello"),
			"content/ko/hello.mdx": POST_MDX("hello"),
			"content/ko/about.mdx": POST_MDX("about"),
		});
		const report = await initProject({ cwd: dir, ...quiet() });
		expect(report.answers.locales).toEqual(["ko", "en"]);
		expect(report.notes.join("\n")).toContain("found in the folders of content/");
	});
});

describe("monti init when the install fails", () => {
	it("INIT-S1 does not say Monti is added: the install step failed, ok is false and the install command is listed", async () => {
		const dir = fixtureApp();
		const host = fakeHost({ install: () => Promise.reject(new Error("`pnpm add` failed")) });
		const report = await initProject({ cwd: dir, host });
		const text = formatInitReport(report);

		expect(report.ok).toBe(false);
		expect(report.steps.map((step) => [step.name, step.status])).toContainEqual(["Install packages", "failed"]);
		// Without the packages the database and the check cannot run: they are skipped, and the list says to run them later.
		expect(report.steps.find((step) => step.name === "Set up the database")?.status).toBe("skipped");
		expect(report.steps.find((step) => step.name === "Check the setup")?.status).toBe("skipped");
		expect(text).not.toContain("Monti is added to your app");
		expect(text).toContain("Install packages: FAILED");
		expect(report.next.some((line) => /^Install the packages:\npnpm add @monti-cms\/core /.test(line))).toBe(true);
		// The files are still there.
		expect(read(dir, "monti.config.ts")).toContain("defineConfig");
	});

	it("INIT-K1 completes when init is run again after the failure, and does not overwrite the files from the first run", async () => {
		const dir = fixtureApp();
		const failed = await initProject({
			cwd: dir,
			host: fakeHost({ install: () => Promise.reject(new Error("offline")) }),
		});
		expect(failed.ok).toBe(false);
		const filesAfterFailure = listFiles(dir);
		const edited = `${read(dir, "monti.config.ts")}\n// my edit\n`;
		writeFileSync(path.join(dir, "monti.config.ts"), edited);

		const online = fakeHost();
		const second = await initProject({ cwd: dir, host: online });
		expect(second.ok).toBe(true);
		expect(second.steps.map((step) => [step.name, step.status])).toContainEqual(["Install packages", "done"]);
		expect(online.install).toHaveBeenCalled();
		expect(second.overwritten).toEqual([]);
		expect(second.skipped).toContain("monti.config.ts");
		expect(read(dir, "monti.config.ts")).toBe(edited);
		expect(listFiles(dir).filter((file) => !filesAfterFailure.includes(file))).toEqual([]);
		expect(formatInitReport(second)).not.toContain("FAILED");
	});
});

describe("monti init with a GitHub spec for core", () => {
	const GITHUB = "github:monti-cms/monti#release/v0.2.0-next.16&path:/core";

	/** A fresh Next app whose package.json lists `@monti-cms/core` with the given spec. */
	function appWithCore(spec: string, field: "dependencies" | "devDependencies" = "dependencies") {
		const pkg = JSON.parse(CREATE_NEXT_APP["package.json"] as string);
		pkg[field] = { ...pkg[field], "@monti-cms/core": spec };
		return fixtureApp({ "package.json": JSON.stringify(pkg) });
	}

	it("INIT-I1 installs the missing Monti packages from the same ref, in dependencies or devDependencies", async () => {
		for (const field of ["dependencies", "devDependencies"] as const) {
			const host = fakeHost();
			await initProject({ cwd: appWithCore(GITHUB, field), host });
			expect(host.install).toHaveBeenCalledOnce();
			expect(host.install).toHaveBeenCalledWith(
				installing(
					"@monti-cms/admin@github:monti-cms/monti#release/v0.2.0-next.16&path:/admin",
					"@monti-cms/nextjs@github:monti-cms/monti#release/v0.2.0-next.16&path:/nextjs",
					"next-themes",
				),
			);
			expect(host.install).not.toHaveBeenCalledWith(installing("@monti-cms/admin"));
			expect(host.install).not.toHaveBeenCalledWith(installing("@monti-cms/core"));
			expect(host.install).not.toHaveBeenCalledWith(installing(expect.stringMatching(/^@monti-cms\/core@/)));
		}
	});

	it("INIT-R2 installs @monti-cms/syntax-directive from the same ref when the directive syntax is on", async () => {
		const host = fakeHost();
		await initProject({ cwd: appWithCore(GITHUB), host, directiveSyntax: true });
		expect(host.install).toHaveBeenCalledWith(
			installing("@monti-cms/syntax-directive@github:monti-cms/monti#release/v0.2.0-next.16&path:/syntax-directive"),
		);
		const without = fakeHost();
		await initProject({ cwd: appWithCore(GITHUB), host: without, directiveSyntax: false });
		expect(without.install).toHaveBeenCalledOnce();
		expect(without.install).not.toHaveBeenCalledWith(installing(expect.stringContaining("syntax-directive")));
	});

	it("INIT-I1 prints the --no-install command with the same specs, quoted for a shell", async () => {
		const dir = appWithCore(GITHUB);
		const report = await initProject({ cwd: dir, host: fakeHost(), install: false });
		const text = report.next.find((item) => item.startsWith("Install the packages:"))?.split("\n")[1] ?? "";
		expect(text).toContain("'@monti-cms/admin@github:monti-cms/monti#release/v0.2.0-next.16&path:/admin'");
		expect(text).toMatch(/ next-themes /);
		// A shell reads the printed line back as the same arguments, with no `&` or `#` acting on the command.
		const run = spawnSync("sh", ["-c", `set -- ${text.replace(/^pnpm add /, "")}; printf '%s\\n' "$@"`], {
			encoding: "utf8",
		});
		const args = run.stdout.trim().split("\n");
		expect(args).toContain("@monti-cms/admin@github:monti-cms/monti#release/v0.2.0-next.16&path:/admin");
		expect(args).toContain("next-themes");
	});
});

describe("the packages init installs", () => {
	const PACKAGES = path.resolve(import.meta.dirname, "../../../..");
	/** The peers a package asks the app to install: not Monti's own, not React. */
	const peersOf = (folder: string): string[] =>
		Object.keys(
			JSON.parse(readFileSync(path.join(PACKAGES, folder, "package.json"), "utf8")).peerDependencies ?? {},
		).filter((name) => !name.startsWith("@monti-cms/") && name !== "react" && name !== "react-dom");

	it("INIT-R2 includes every library the admin and the AI plugin need as peers, also with no blocks", async () => {
		for (const blocks of ["default", "none"]) {
			const dir = fixtureApp();
			const report = await initProject({ cwd: dir, host: fakeHost(), install: false, extras: "ai", blocks });
			expect(report.installed).toEqual(expect.arrayContaining([...peersOf("admin"), ...peersOf("ai")]));
		}
	});
});
