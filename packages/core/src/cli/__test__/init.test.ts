import { mkdtempSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { parseSchemaFile } from "../../schema-file/format";
import { unifiedDiff } from "../diff";
import { formatInitReport, InitError, initProject, ProjectWriter } from "../init";
import { InitCancelled } from "../init-prompts";
import {
	CREATE_NEXT_APP,
	CREATE_NEXT_APP_LAYOUT,
	fakeHost,
	fixtureApp,
	listFiles,
	POST_MDX,
	read,
	SRC_APP,
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
} as const;

/** Every file of the project with its content, for "nothing existing was touched". */
const snapshot = (dir: string) => Object.fromEntries(listFiles(dir).map((file) => [file, read(dir, file)]));

const index = (lines: readonly string[], needle: string) => lines.findIndex((line) => line.includes(needle));

describe("monti init in a fresh create-next-app", () => {
	it("writes only Monti's own new files with the defaults", async () => {
		const dir = fixtureApp();
		const report = await initProject({ cwd: dir, ...quiet() });

		expect(report.ok).toBe(true);
		expect(report.created).toEqual([
			"monti.config.ts",
			"monti.schema.json",
			"monti-env.d.ts",
			"app/studio/[[...path]]/page.tsx",
			"app/studio/layout.tsx",
			"app/api/cms/[...path]/route.ts",
			".env.example",
		]);
		expect(report.overwritten).toEqual([]);

		// One line per feature, each with a comment; nothing hidden behind a preset.
		const config = read(dir, "monti.config.ts");
		expect(config).toContain('import { defineConfig, postgres } from "@monti-cms/core/server";');
		expect(config).toContain('import schema from "./monti.schema.json";');
		expect(config).toContain("export const cms = defineConfig({\n\tschema,");
		expect(config).toMatch(/\/\/ Bodies as MDX.*\n\t\tmdx\(\),/);
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
		expect(config).not.toMatch(/aiPlugin|gitSync|bareun|\.\.\.blocks|process\.env|createCms|defineServerConfig/);

		const schema = JSON.parse(read(dir, "monti.schema.json"));
		expect(() => parseSchemaFile(schema)).not.toThrow();
		expect(schema.collections.post).toMatchObject({ kind: "document", path: "/posts/:slug" });
		expect(schema.locales).toEqual([{ code: "en", name: "English" }]);
		expect(schema.defaultLocale).toBe("en");
		expect(schema.timeZone).toBe("UTC");
		expect(schema.admin).toEqual({ path: "/studio" });
		expect(read(dir, "monti-env.d.ts")).toContain('readonly defaultLocale: "en";');

		// The three Next files import the config by a relative path.
		expect(read(dir, "app/studio/[[...path]]/page.tsx")).toContain('import { cms } from "../../../monti.config";');
		const layout = read(dir, "app/studio/layout.tsx");
		expect(layout).toContain('import { cms } from "../../monti.config";');
		expect(layout).toContain('import "@monti-cms/admin/styles.css";');
		expect(layout).toContain('import "@monti-cms/blocks/styles.css";');
		expect(read(dir, "app/api/cms/[...path]/route.ts")).toContain('import { cms } from "../../../../monti.config";');
		expect(config + layout).not.toMatch(/[가-힣]/); // cms-allow-korean: checks that the generated files have no Korean
	});

	it("changes no file the app already has and writes no .env.local", async () => {
		const dir = fixtureApp({ ".gitignore": "node_modules\n.next\n", "tsconfig.json": '{ "compilerOptions": {} }' });
		const before = snapshot(dir);
		const report = await initProject({ cwd: dir, host: fakeHost() });
		const after = snapshot(dir);

		for (const [file, content] of Object.entries(before)) expect(after[file]).toBe(content);
		expect(listFiles(dir)).not.toContain(".env.local");
		expect(listFiles(dir).filter((file) => !(file in before))).toEqual(report.created.slice().sort());
		expect(report.created).not.toContain("next.config.ts");
	});

	it("writes a .env.example that says what each variable is and where to get it, without secrets", async () => {
		const dir = fixtureApp();
		await initProject({ cwd: dir, ...quiet() });
		const example = read(dir, ".env.example");
		for (const name of ["DATABASE_URL", "MONTI_SECRET", "SITE_URL", "AUTH_TRUST_HOST"]) {
			expect(example).toContain(name);
		}
		expect(example).toContain("openssl rand -base64 32");
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
			expect(line).toMatch(/^(DATABASE_URL=postgres:\/\/user:password@localhost:5432\/monti|[A-Z0-9_]+=[a-z0-9]*)$/);
		}
	});

	it("with --login github writes the GitHub provider, its variables with how to get them, and the OAuth app step", async () => {
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
		expect(example).toContain("http://localhost:3000/api/cms/auth/callback/github");
		const step = report.next.at(-1) ?? "";
		expect(step).toContain("OAuth");
		expect(step).toContain("http://localhost:3000/api/cms/auth/callback/github");
		expect(report.next.join("\n")).not.toContain("create the first admin");
	});

	it("installs @monti-cms/auth for either login", async () => {
		for (const login of ["password", "github"] as const) {
			const install = vi.fn();
			await initProject({ cwd: fixtureApp(), host: fakeHost({ install }), login });
			expect(install.mock.calls[0]?.[0].args).toContain("@monti-cms/auth");
		}
	});

	it("lists the S3 variables in .env.example, each with where to get it, when storage is s3", async () => {
		const dir = fixtureApp();
		await initProject({ cwd: dir, ...quiet(), storage: "s3" });
		const example = read(dir, ".env.example");
		for (const name of [
			"S3_ENDPOINT",
			"S3_REGION",
			"S3_BUCKET",
			"S3_ACCESS_KEY_ID",
			"S3_SECRET_ACCESS_KEY",
			"S3_PUBLIC_URL",
		]) {
			expect(example).toContain(`${name}=`);
		}
		expect(example).toContain("r2.cloudflarestorage.com");
		expect(example).toContain("MinIO");
	});

	it("lists what is left in order, each step with exact content", async () => {
		const report = await initProject({ cwd: fixtureApp(), host: fakeHost() });
		const next = report.next;

		// The install ran, so it is not in the list. Otherwise the order is: next.config, layout, .env.local, migrate, doctor, dev, then the notes.
		expect(next.map((step) => step.split("\n")[0])).toEqual([
			"Wrap the config in next.config.ts. Add this import at the top:",
			"Add suppressHydrationWarning to the <html> tag in app/layout.tsx:",
			"Create .env.local from the example and fill it in (.env.example says what each value is and where to get it):",
			"Create the tables: pnpm exec monti migrate",
			"Check the setup: pnpm exec monti doctor",
			"Start the app: pnpm dev, then open http://localhost:3000/studio",
			expect.stringContaining("Right after you deploy, open http://localhost:3000/studio and create the first admin"),
		]);
		expect(next[0]).toContain('import { withCms } from "@monti-cms/nextjs/config";');
		expect(next[0]).toContain("-export default nextConfig;\n+export default withCms(nextConfig);");
		expect(next[1]).toContain('<html lang="en" suppressHydrationWarning>');
		expect(next[2]).toContain("cp .env.example .env.local");
		expect(next[2]).toContain("openssl rand -base64 32");
		expect(next[2]).toContain("randomBytes(32).toString('base64')");
		expect(next[4]).toContain("`monti doctor` will tell you if any of the steps above is missing");
		expect(next[6]).toContain("That screen closes as soon as one admin exists");
		expect(next[6]).toContain("monti admin:reset-password");
		expect(next[6]).not.toMatch(/GitHub|OAuth/);
		expect(next.join("\n")).not.toContain("monti import");

		const text = formatInitReport(report);
		expect(text).toContain("What is left");
		expect(text).toMatch(/\n {2}1\. Wrap the config/);
		expect(text).toMatch(/\n {2}7\. Right after you deploy/);
	});

	it("does not touch the database or list the removed steps", async () => {
		const report = await initProject({ cwd: fixtureApp(), ...quiet() });
		const text = report.next.join("\n");
		expect(text).not.toContain("DATABASE_URL in .env.local");
		expect(text).not.toContain("MONTI_ADMIN_GITHUB_ID in .env.local");
		expect(report.steps.map((step) => step.name)).toEqual(["Install packages"]);
	});

	it("never writes a docker compose file, a proxy or theme files", async () => {
		const dir = fixtureApp();
		const before = listFiles(dir);
		const report = await initProject({ cwd: dir, ...quiet() });
		const created = listFiles(dir).filter((file) => !before.includes(file));
		expect(created.length).toBeGreaterThan(0);
		for (const file of created) expect(file).not.toMatch(/docker|compose|proxy\.ts|theme|\(site\)/i);
		expect(report.created.join("\n")).not.toMatch(/docker|compose|proxy\.ts|theme/i);
	});
});

describe("monti init and the package install", () => {
	it("installs the packages with the detected package manager when there is no prompt", async () => {
		const dir = fixtureApp();
		const host = fakeHost();
		const report = await initProject({ cwd: dir, host });
		expect(Object.keys(host)).toEqual(["install"]);
		expect(host.install).toHaveBeenCalledTimes(1);
		const command = host.install.mock.calls[0]?.[0];
		expect(command?.command).toBe("pnpm");
		expect(command?.args[0]).toBe("add");
		expect(command?.args).toEqual(
			expect.arrayContaining([
				"@monti-cms/core",
				"@monti-cms/admin",
				"@monti-cms/nextjs",
				"@monti-cms/mdx",
				"@monti-cms/blocks",
			]),
		);
		expect(command?.args).not.toContain("@monti-cms/ai");
		expect(command?.args).toContain("@monti-cms/auth");
		expect(command?.args).not.toContain("mermaid");
		expect(command?.cwd).toBe(dir);
		expect(report.steps.map((step) => [step.name, step.status])).toEqual([["Install packages", "done"]]);
		expect(report.next.join("\n")).not.toContain("Install the packages");
	});

	it("shows the exact command and asks, with yes as the default, before running it", async () => {
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

	it("a no runs nothing, records the step as skipped and keeps the command in the list", async () => {
		const prompter = scriptedPrompter({ "Install the": false });
		const host = fakeHost();
		const report = await initProject({ cwd: fixtureApp(), host, prompter, ...ANSWERED });
		expect(host.install).not.toHaveBeenCalled();
		expect(report.steps).toEqual([{ name: "Install packages", status: "skipped", detail: "you answered no" }]);
		expect(report.ok).toBe(true);
		expect(report.next[0]).toMatch(/^Install the packages:\npnpm add @monti-cms\/core /);
	});

	it("--no-install asks nothing, runs nothing and prints the command first in the list", async () => {
		const prompter = scriptedPrompter({});
		const host = fakeHost();
		const report = await initProject({ cwd: fixtureApp(), host, prompter, install: false, ...ANSWERED });
		expect(prompter.asked).toEqual([]);
		expect(host.install).not.toHaveBeenCalled();
		expect(report.steps).toEqual([{ name: "Install packages", status: "skipped", detail: "--no-install" }]);
		expect(report.next[0]).toMatch(/^Install the packages:\npnpm add @monti-cms\/core /);
		expect(index(report.next, "Install the packages")).toBeLessThan(index(report.next, "Wrap the config"));
	});

	it("a failed install turns ok off, names the step and keeps the command in the list; the files stay", async () => {
		const dir = fixtureApp();
		const host = fakeHost({ install: () => Promise.reject(new Error("`pnpm add` failed")) });
		const report = await initProject({ cwd: dir, host });
		expect(report.ok).toBe(false);
		expect(report.steps).toContainEqual(
			expect.objectContaining({ name: "Install packages", status: "failed", detail: "`pnpm add` failed" }),
		);
		expect(read(dir, "monti.config.ts")).toContain("defineConfig");
		expect(report.next.join("\n")).toMatch(/Install the packages:\npnpm add @monti-cms\/core/);
		expect(formatInitReport(report)).toContain("Install packages: FAILED");
	});

	it("does not ask about the install when every package is already a dependency", async () => {
		const { packagesFor } = await import("../templates");
		const { collectAnswers } = await import("../init-prompts");
		const { detectApp } = await import("../init-detect");
		const answers = await collectAnswers(detectApp(fixtureApp()), { blocks: "none" });
		const dependencies = Object.fromEntries([...packagesFor(answers), "next"].map((name) => [name, "1.0.0"]));
		const dir = fixtureApp({ "package.json": JSON.stringify({ name: "x", dependencies }) });
		const prompter = scriptedPrompter({});
		const host = fakeHost();
		const report = await initProject({ cwd: dir, host, prompter, ...ANSWERED });
		expect(prompter.asked).toEqual([]);
		expect(host.install).not.toHaveBeenCalled();
		expect(report.steps).toEqual([]);
	});
});

describe("monti init tailors what is left to the app", () => {
	it("a src/ app keeps the config in src and the Next files under src/app", async () => {
		const dir = fixtureApp(SRC_APP);
		const report = await initProject({ cwd: dir, ...quiet(), adminPath: "/cms/studio" });
		expect(report.created).toEqual([
			"src/monti.config.ts",
			"src/monti.schema.json",
			"src/monti-env.d.ts",
			"src/app/cms/studio/[[...path]]/page.tsx",
			"src/app/cms/studio/layout.tsx",
			"src/app/api/cms/[...path]/route.ts",
			".env.example",
		]);
		expect(read(dir, "src/app/cms/studio/layout.tsx")).toContain('import { cms } from "../../../monti.config";');
		expect(JSON.parse(read(dir, "src/monti.schema.json")).admin).toEqual({ path: "/cms/studio" });
		expect(listFiles(dir).filter((file) => file.startsWith("app/"))).toEqual([]);
		// The layout step names the src/ layout.
		expect(report.next.join("\n")).toContain("<html> tag in src/app/layout.tsx");
		expect(report.next.join("\n")).toContain("then open http://localhost:3000/cms/studio");
	});

	it("an existing next.config with the default shape gets the change against that shape", async () => {
		const report = await initProject({ cwd: fixtureApp(), ...quiet() });
		const step = report.next.find((line) => line.startsWith("Wrap the config in next.config.ts")) ?? "";
		expect(step).toContain('import { withCms } from "@monti-cms/nextjs/config";');
		expect(step).toContain("-export default nextConfig;");
		expect(step).toContain("+export default withCms(nextConfig);");
	});

	it("a next.config of another shape gets the import and a sentence about wrapping what it exports", async () => {
		const custom = `import type { NextConfig } from "next";\nexport default (phase: string): NextConfig => ({});\n`;
		const dir = fixtureApp({ "next.config.ts": custom });
		const report = await initProject({ cwd: dir, ...quiet() });
		expect(read(dir, "next.config.ts")).toBe(custom);
		const step = report.next.find((line) => line.startsWith("Wrap the config in next.config.ts")) ?? "";
		expect(step).toContain('import { withCms } from "@monti-cms/nextjs/config";');
		expect(step).toContain("export default withCms(");
		expect(step).not.toContain("-export default nextConfig;");
	});

	it("without a next.config the list shows a whole new next.config.ts, and none is created", async () => {
		const dir = fixtureApp({ "next.config.ts": null });
		const report = await initProject({ cwd: dir, ...quiet() });
		expect(listFiles(dir)).not.toContain("next.config.ts");
		const step = report.next.find((line) => line.startsWith("Create next.config.ts")) ?? "";
		expect(step).toContain('import { withCms } from "@monti-cms/nextjs/config";');
		expect(step).toContain("const nextConfig: NextConfig = {};");
		expect(step).toContain("export default withCms(nextConfig);");
	});

	it("an existing withCms in the next.config means no next.config step", async () => {
		const dir = fixtureApp({
			"next.config.ts": 'import { withCms } from "@monti-cms/nextjs/config";\nexport default withCms({});\n',
		});
		const report = await initProject({ cwd: dir, ...quiet() });
		expect(report.next.join("\n")).not.toContain("next.config");
	});

	it("an existing suppressHydrationWarning means no layout step; a missing one is printed, never added", async () => {
		const done = fixtureApp({
			"app/layout.tsx": CREATE_NEXT_APP_LAYOUT.replace('<html lang="en">', '<html lang="en" suppressHydrationWarning>'),
		});
		expect((await initProject({ cwd: done, ...quiet() })).next.join("\n")).not.toContain("suppressHydrationWarning");

		const missing = fixtureApp();
		const report = await initProject({ cwd: missing, ...quiet() });
		expect(read(missing, "app/layout.tsx")).toBe(CREATE_NEXT_APP_LAYOUT);
		expect(report.next.join("\n")).toContain('<html lang="en" suppressHydrationWarning>');
	});

	it("a tsconfig without resolveJsonModule gets a step with the line, and is not edited", async () => {
		const tsconfig = '{\n  // my options\n  "compilerOptions": {\n    "strict": true\n  }\n}\n';
		const dir = fixtureApp({ "tsconfig.json": tsconfig });
		const report = await initProject({ cwd: dir, ...quiet() });
		expect(read(dir, "tsconfig.json")).toBe(tsconfig);
		const step = report.next.find((line) => line.includes("resolveJsonModule")) ?? "";
		expect(step).toContain('"resolveJsonModule": true');
		expect(step).toContain("compilerOptions of tsconfig.json");

		const ready = await initProject({ cwd: fixtureApp(), ...quiet() });
		expect(ready.next.join("\n")).not.toContain("resolveJsonModule");
	});

	it("a missing .gitignore gets a step that creates it; one that covers .env.local gets none", async () => {
		const none = fixtureApp({ ".gitignore": null });
		const report = await initProject({ cwd: none, ...quiet() });
		expect(listFiles(none)).not.toContain(".gitignore");
		const step = report.next.find((line) => line.startsWith("Keep .env.local out of git")) ?? "";
		expect(step).toBe("Keep .env.local out of git: add this line to .gitignore (create the file):\n.env.local");

		const uncovered = fixtureApp({ ".gitignore": "node_modules\n" });
		const second = await initProject({ cwd: uncovered, ...quiet() });
		expect(read(uncovered, ".gitignore")).toBe("node_modules\n");
		expect(second.next).toContain("Keep .env.local out of git: add this line to .gitignore:\n.env.local");

		const covered = fixtureApp({ ".gitignore": ".env*.local\n" });
		expect((await initProject({ cwd: covered, ...quiet() })).next.join("\n")).not.toContain("out of git");
	});

	it("an app without TypeScript gets the install note before everything else", async () => {
		const dir = fixtureApp({
			"tsconfig.json": null,
			"package.json": JSON.stringify({ name: "x", scripts: { dev: "next dev" }, dependencies: { next: "16.3.8" } }),
		});
		const report = await initProject({ cwd: dir, ...quiet() });
		expect(report.next[0]).toMatch(/^Add TypeScript .*pnpm add -D typescript/);
	});

	it("uses the package manager the lockfile names, or the one given", async () => {
		const dir = fixtureApp({ "pnpm-lock.yaml": null, "yarn.lock": "" });
		const host = fakeHost();
		const report = await initProject({ cwd: dir, host });
		expect(host.install.mock.calls[0]?.[0].command).toBe("yarn");
		expect(report.next.join("\n")).toContain("Create the tables: yarn monti migrate");
		expect(report.next.join("\n")).toContain("Start the app: yarn dev");
		const bun = await initProject({
			cwd: fixtureApp({ "pnpm-lock.yaml": null }),
			...quiet(),
			packageManager: "bun",
		});
		expect(bun.next.join("\n")).toContain("Start the app: bun run dev");
	});

	it("takes the dev port from the dev script for the callback URL", async () => {
		const dir = fixtureApp({
			"package.json": JSON.stringify({
				name: "x",
				scripts: { dev: "next dev -p 4000" },
				dependencies: { next: "16.3.8" },
			}),
		});
		const report = await initProject({ cwd: dir, ...quiet(), login: "github" });
		expect(report.next.join("\n")).toContain("http://localhost:4000/api/cms/auth/callback/github");
		expect(read(dir, ".env.example")).toContain("# SITE_URL=http://localhost:4000");
	});

	it("adds the git-sync note when git-sync is chosen", async () => {
		const report = await initProject({ cwd: fixtureApp(), ...quiet(), extras: "git-sync" });
		expect(report.next.join("\n")).toContain("add a target to gitSync()");
	});

	it("opts the admin page out of the instant validation only when next.config turns on cacheComponents", async () => {
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

	it("refuses an app that is not a Next App Router app, saying what to do", async () => {
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
	it("an app with a content folder gets a post collection from its front matter", async () => {
		const dir = fixtureApp({
			"content/posts/first.mdx": POST_MDX("first"),
			"content/posts/second.md": POST_MDX("second"),
		});
		const report = await initProject({ cwd: dir, ...quiet() });
		const post = JSON.parse(read(dir, "monti.schema.json")).collections.post;
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

	it("every feature: the config has one line each and the packages follow", async () => {
		const dir = fixtureApp();
		const host = fakeHost();
		await initProject({
			cwd: dir,
			host,
			locales: "ko,en",
			timeZone: "Asia/Seoul",
			storage: "s3",
			extras: "ai,git-sync",
			blocks: "callout,tabs,color",
			siteUrl: "https://blog.example.com",
		});
		const config = read(dir, "monti.config.ts");
		expect(config).toContain('import { aiPlugin } from "@monti-cms/ai";');
		expect(config).toContain('import { gitSync } from "@monti-cms/git-sync";');
		expect(config).toContain('import { s3Storage } from "@monti-cms/storage-s3";');
		expect(config).toContain('import { callout, color, tabs } from "@monti-cms/blocks";');
		expect(config).toMatch(/\n\t\taiPlugin\(\),\n/);
		expect(config).toMatch(/\n\t\tgitSync\(\),\n/);
		expect(config).toContain("\tstorage: s3Storage(),");
		expect(config.indexOf("callout(),")).toBeLessThan(config.indexOf("tabs(),"));
		expect(config.indexOf("tabs(),")).toBeLessThan(config.indexOf("color(),"));

		const schema = JSON.parse(read(dir, "monti.schema.json"));
		expect(schema.locales.map((entry: { code: string }) => entry.code)).toEqual(["ko", "en"]);
		expect(schema.defaultLocale).toBe("ko");
		expect(schema.timeZone).toBe("Asia/Seoul");

		const args = host.install.mock.calls[0]?.[0].args ?? [];
		expect(args).toEqual(
			expect.arrayContaining(["@monti-cms/ai", "@monti-cms/git-sync", "@monti-cms/storage-s3", "@monti-cms/blocks"]),
		);
		expect(read(dir, ".env.example")).toContain("S3_BUCKET=");
		expect(read(dir, ".env.example")).toContain("# SITE_URL=https://blog.example.com");
	});

	it("no blocks: a short config with just mdx", async () => {
		const dir = fixtureApp();
		await initProject({ cwd: dir, ...quiet(), blocks: "none" });
		const config = read(dir, "monti.config.ts");
		expect(config).not.toContain("@monti-cms/blocks");
		expect(config).toContain("mdx(),");
		expect(read(dir, "app/studio/layout.tsx")).not.toContain("blocks/styles.css");
	});
});

describe("monti init and files that already exist", () => {
	it("an existing monti.config.ts is kept, its schema file is not written, and the skip is reported", async () => {
		const dir = fixtureApp({ "monti.config.ts": "// mine\nexport const cms = {};\n" });
		const report = await initProject({ cwd: dir, ...quiet() });
		expect(read(dir, "monti.config.ts")).toBe("// mine\nexport const cms = {};\n");
		expect(() => read(dir, "monti.schema.json")).toThrow();
		expect(report.created).not.toContain("monti.config.ts");
		expect(report.skipped).toContain("monti.config.ts");
		expect(report.created).toContain("app/studio/layout.tsx");
		expect(report.notes.join("\n")).toContain("monti.config.ts already exists, so it was kept");
		expect(formatInitReport(report)).toContain("Already there, left as they are:\n  - monti.config.ts");
	});

	it("leaves the files of the earlier cms.config.ts setup alone", async () => {
		const dir = fixtureApp({ "cms.config.ts": "export default {};\n", "cms.server.ts": "export const cms = {};\n" });
		const report = await initProject({ cwd: dir, ...quiet() });
		expect(read(dir, "cms.config.ts")).toBe("export default {};\n");
		expect(() => read(dir, "monti.config.ts")).toThrow();
		expect(report.notes.join("\n")).toContain("cms.config.ts and cms.server.ts from the earlier setup are left alone");
	});

	it("an existing .env.example is kept and reported, never merged", async () => {
		const dir = fixtureApp({ ".env.example": "MINE=1\n" });
		const report = await initProject({ cwd: dir, ...quiet() });
		expect(read(dir, ".env.example")).toBe("MINE=1\n");
		expect(report.skipped).toContain(".env.example");
		expect(report.notes.join("\n")).toContain(".env.example already exists and was kept");
	});

	it("running twice changes nothing the second time", async () => {
		const dir = fixtureApp();
		await initProject({ cwd: dir, ...quiet() });
		const before = snapshot(dir);
		const report = await initProject({ cwd: dir, ...quiet() });
		expect(snapshot(dir)).toEqual(before);
		expect(report.created).toEqual([]);
		expect(report.skipped).toEqual(expect.arrayContaining(["monti.config.ts", ".env.example"]));
	});

	it("a changed file is kept unless --overwrite (or a yes in the prompts)", async () => {
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
});

describe("monti init --dry-run", () => {
	it("lists what it would do and writes and runs nothing, not even asking about the install", async () => {
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
	it("a write that fails stops with the list of what was written before it", async () => {
		const dir = fixtureApp();
		// The route file is written after the config, the schema and the admin files; a file where its folder should be makes that write fail.
		writeFileSync(path.join(dir, "app/api"), "");
		const failure = initProject({ cwd: dir, ...quiet() });
		await expect(failure).rejects.toBeInstanceOf(InitError);
		await expect(failure).rejects.toThrow(
			/These files were written before it failed \(nothing was undone\):\n {2}- monti\.config\.ts\n {2}- monti\.schema\.json\n/,
		);
		await expect(failure).rejects.toThrow(/Run `monti init` again to continue/);
	});

	it("cancelling a prompt writes nothing", async () => {
		const dir = fixtureApp();
		const before = listFiles(dir);
		const prompter = scriptedPrompter({ "Languages of the site": "cancel" });
		await expect(initProject({ cwd: dir, ...quiet(), prompter })).rejects.toBeInstanceOf(InitCancelled);
		expect(listFiles(dir)).toEqual(before);
	});

	it("a wrong flag fails before anything is written, naming the flag", async () => {
		const dir = fixtureApp();
		const before = listFiles(dir);
		const cases: [Record<string, string>, RegExp][] = [
			[{ locales: "English" }, /--locales: "English" must be a language code/],
			[{ timeZone: "Mars/Base" }, /--time-zone "Mars\/Base" must be an IANA time zone/],
			[{ storage: "gcs" }, /--storage "gcs" must be "s3" or "none"/],
			[{ extras: "bareun" }, /--extras: "bareun" is not an extra/],
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
	it("ProjectWriter refuses absolute paths, .. and symlinks that lead out", () => {
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

	it("an app folder that is a symlink out of the project stops the run before it writes there", async () => {
		const outside = mkdtempSync(path.join(tmpdir(), "monti-outside-"));
		const dir = fixtureApp({ "app/layout.tsx": null, "app/page.tsx": null, "app/globals.css": null });
		symlinkSync(outside, path.join(dir, "app"), "dir");
		await expect(initProject({ cwd: dir, ...quiet() })).rejects.toThrow(/outside the project/);
		expect(listFiles(outside)).toEqual([]);
	});
});

describe("unifiedDiff", () => {
	it("shows added and removed lines with context", () => {
		const diff = unifiedDiff(
			"a.ts",
			"one\ntwo\nthree\nfour\nfive\nsix\nseven\n",
			"zero\none\ntwo\nthree\nfour\nfive\nSIX\nseven\n",
		);
		expect(diff).toBe("--- a/a.ts\n+++ b/a.ts\n+zero\n one\n two\n...\n four\n five\n-six\n+SIX\n seven\n ");
	});

	it("the fresh create-next-app config diff is the import and the export", () => {
		const after = `import { withCms } from "@monti-cms/nextjs/config";\n${CREATE_NEXT_APP["next.config.ts"]?.replace("export default nextConfig;", "export default withCms(nextConfig);")}`;
		const diff = unifiedDiff("next.config.ts", CREATE_NEXT_APP["next.config.ts"] ?? "", after);
		expect(diff.split("\n").filter((line) => /^[+-][^+-]/.test(line))).toEqual([
			'+import { withCms } from "@monti-cms/nextjs/config";',
			"-export default nextConfig;",
			"+export default withCms(nextConfig);",
		]);
	});
});
