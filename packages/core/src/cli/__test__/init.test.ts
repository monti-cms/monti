import { mkdtempSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { parseSchemaFile } from "../../schema-file/format";
import { printSchemaFile } from "../../schema-file/print";
import { unifiedDiff } from "../diff";
import { initProject } from "../init";
import { formatInitReport } from "../init-report";
import { InitError, ProjectWriter } from "../init-writer";
import { Cancelled } from "../prompt";
import {
	CREATE_NEXT_APP,
	CREATE_NEXT_APP_LAYOUT,
	DEFAULT_NEXT_CONFIG,
	fakeHost,
	fixtureApp,
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
	it("writes only Monti's own new files with the defaults", async () => {
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
		expect(config).not.toMatch(/\bai\(|gitSync|bareun|\.\.\.blocks|process\.env|createCms|defineServerConfig/);

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

	it("edits only next.config and the root layout, says so, and writes no .env.local", async () => {
		const dir = fixtureApp({ ".gitignore": "node_modules\n.next\n", "tsconfig.json": '{ "compilerOptions": {} }' });
		const before = snapshot(dir);
		const report = await initProject({ cwd: dir, host: fakeHost() });
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

		// The summary names each edited file with the exact change, next to "Created:".
		const text = formatInitReport(report);
		expect(text).toContain(
			"Changed:\n  - next.config.ts \u2014 wrapped the export in withCms(), added the import from @monti-cms/nextjs/config\n  - app/layout.tsx \u2014 added suppressHydrationWarning to <html>\n  - .gitignore \u2014 added .env.local (it holds your secrets) and .monti/ (monti db:migrate writes its logs there)",
		);
		expect(text.indexOf("Created:")).toBeLessThan(text.indexOf("Changed:"));
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

	it(".env.example lists what is needed now first, and the deploy-time values apart under their own heading", async () => {
		for (const login of ["password", "github"] as const) {
			const dir = fixtureApp();
			await initProject({ cwd: dir, ...quiet(), login, storage: "s3" });
			const example = read(dir, ".env.example");
			const deploy = example.indexOf("# --- When you deploy (not needed on your computer) ---");
			expect(deploy).toBeGreaterThan(0);
			const now = example.slice(0, deploy);
			const later = example.slice(deploy);

			// Needed now: before the heading, set (not commented out), with the sslmode hint next to DATABASE_URL.
			const needed = [
				"DATABASE_URL",
				"MONTI_SECRET",
				...(login === "github" ? ["AUTH_GITHUB_ID", "AUTH_GITHUB_SECRET", "MONTI_ADMIN_GITHUB_ID"] : []),
				"S3_BUCKET",
			];
			for (const name of needed) expect(now).toMatch(new RegExp(`^${name}=`, "m"));
			expect(now.indexOf("sslmode=verify-full")).toBeGreaterThan(now.indexOf("# Postgres connection URL"));
			expect(now.indexOf("sslmode=verify-full")).toBeLessThan(now.indexOf("DATABASE_URL="));
			expect(now).toContain("no warning from the database driver");
			for (const name of ["SITE_URL", "AUTH_TRUST_HOST", "DATABASE_SCHEMA"]) expect(now).not.toContain(name);

			// When you deploy: after the heading, each commented out with one plain sentence above it.
			expect(later).toContain(
				"# Your site's public address, e.g. https://example.com. Used for login links and to recognise links to your own site.\n# SITE_URL=",
			);
			expect(later).toContain(
				"# Only if you run your own proxy such as nginx. Not needed on Vercel, Netlify or Cloudflare.\n# AUTH_TRUST_HOST=true",
			);
			expect(later).toMatch(/^# DATABASE_SCHEMA=monti$/m);
			expect(later).not.toMatch(/^[A-Z_]+=/m);
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
		expect(example).toContain("http://localhost:3000/api/monti/auth/callback/github");
		const step = report.next.at(-1) ?? "";
		expect(step).toContain("OAuth");
		expect(step).toContain("http://localhost:3000/api/monti/auth/callback/github");
		expect(report.next.join("\n")).not.toContain("create the first admin");
	});

	it("writes mdx({ syntax: [directiveSyntax()] }) and installs the package by default, since blocks are installed", async () => {
		const dir = fixtureApp();
		const host = fakeHost();
		const report = await initProject({ cwd: dir, host });
		const config = read(dir, "monti.config.ts");
		expect(config).toContain('import { directiveSyntax } from "@monti-cms/syntax-directive";');
		expect(config).toMatch(/\n\t\tmdx\(\{ syntax: \[directiveSyntax\(\)\] \}\),/);
		expect(host.install.mock.calls[0]?.[0].args).toContain("@monti-cms/syntax-directive");
		expect(report.answers.directiveSyntax).toBe(true);
	});

	it("--no-directive-syntax, or no blocks, keeps plain mdx() and installs nothing extra", async () => {
		for (const options of [{ directiveSyntax: false }, { blocks: "none" }]) {
			const dir = fixtureApp();
			const host = fakeHost();
			await initProject({ cwd: dir, host, ...options });
			const config = read(dir, "monti.config.ts");
			expect(config).not.toContain("directiveSyntax");
			expect(config).toMatch(/\n\t\tmdx\(\),/);
			expect(host.install.mock.calls[0]?.[0].args).not.toContain("@monti-cms/syntax-directive");
		}
	});

	it("--directive-syntax turns it on even without blocks", async () => {
		const dir = fixtureApp();
		await initProject({ cwd: dir, ...quiet(), blocks: "none", directiveSyntax: true });
		expect(read(dir, "monti.config.ts")).toContain("mdx({ syntax: [directiveSyntax()] }),");
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

		// The install ran and init edited next.config and the layout, so neither is in the list. The order is: .env.local, db:setup, doctor, dev, then the notes.
		expect(next.map((step) => step.split("\n")[0])).toEqual([
			"Create .env.local from the example and fill it in (.env.example says what each value is and where to get it):",
			"Create Monti's tables in your database (once): pnpm exec monti db:setup",
			"Check the setup: pnpm exec monti doctor",
			"Start the app: pnpm dev, then open http://localhost:3000/studio",
			expect.stringContaining("Right after you deploy, open <your site>/studio and create the first admin"),
		]);
		expect(next[0]).toContain("cp .env.example .env.local");
		expect(next[0]).toContain("openssl rand -base64 32");
		expect(next[0]).toContain("randomBytes(32).toString('base64')");
		expect(next[2]).toContain("`monti doctor` will tell you if any of the steps above is missing");
		expect(next[4]).toContain("That screen closes as soon as one admin exists");
		expect(next[4]).toContain("monti admin:reset-password");
		expect(next[4]).not.toMatch(/GitHub|OAuth/);
		expect(next.join("\n")).not.toContain("monti import");

		const text = formatInitReport(report);
		expect(text).toContain("What is left");
		expect(text).toMatch(/\n {2}1\. Create \.env\.local/);
		expect(text).toMatch(/\n {2}5\. Right after you deploy/);
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
		expect(Object.keys(host)).toEqual(["install", "systemTimeZone"]);
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
		expect(index(report.next, "Install the packages")).toBeLessThan(index(report.next, "Create .env.local"));
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
		const { packagesFor } = await import("../init-install");
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

	it("an existing next.config of the default shape is edited, not listed", async () => {
		const dir = fixtureApp();
		const report = await initProject({ cwd: dir, ...quiet() });
		expect(read(dir, "next.config.ts")).toBe(
			DEFAULT_NEXT_CONFIG.replace(
				'import type { NextConfig } from "next";',
				'import type { NextConfig } from "next";\nimport { withCms } from "@monti-cms/nextjs/config";',
			).replace("export default nextConfig;", "export default withCms(nextConfig);"),
		);
		expect(report.changed[0]).toEqual({
			file: "next.config.ts",
			change: "wrapped the export in withCms(), added the import from @monti-cms/nextjs/config",
		});
		expect(report.next.join("\n")).not.toContain("next.config");
	});

	it("wraps an object export and a call export, and puts the import below the last import", async () => {
		const object = fixtureApp({
			"next.config.mjs": `import path from "node:path";\n\nexport default {\n  reactStrictMode: true,\n  outputFileTracingRoot: path.join(process.cwd(), "}"),\n};\n`,
			"next.config.ts": null,
		});
		await initProject({ cwd: object, ...quiet() });
		expect(read(object, "next.config.mjs")).toBe(
			`import path from "node:path";\nimport { withCms } from "@monti-cms/nextjs/config";\n\nexport default withCms({\n  reactStrictMode: true,\n  outputFileTracingRoot: path.join(process.cwd(), "}"),\n});\n`,
		);

		const call = fixtureApp({
			"next.config.ts": `import type { NextConfig } from "next";\nimport bundleAnalyzer from "@next/bundle-analyzer";\n\nconst withAnalyzer = bundleAnalyzer({ enabled: true });\nconst config: NextConfig = {};\n\nexport default withAnalyzer(config) // done\n`,
		});
		await initProject({ cwd: call, ...quiet() });
		expect(read(call, "next.config.ts")).toBe(
			`import type { NextConfig } from "next";\nimport bundleAnalyzer from "@next/bundle-analyzer";\nimport { withCms } from "@monti-cms/nextjs/config";\n\nconst withAnalyzer = bundleAnalyzer({ enabled: true });\nconst config: NextConfig = {};\n\nexport default withCms(withAnalyzer(config)) // done\n`,
		);
	});

	it("a next.config init cannot wrap safely is left as it is and its step says why", async () => {
		const shapes: Record<string, string> = {
			function: `import type { NextConfig } from "next";\nexport default (phase: string): NextConfig => ({});\n`,
			satisfies: `import type { NextConfig } from "next";\nexport default { reactStrictMode: true } satisfies NextConfig;\n`,
			commonjs: `module.exports = { reactStrictMode: true };\n`,
		};
		for (const [name, custom] of Object.entries(shapes)) {
			const dir = fixtureApp({ "next.config.ts": custom });
			const report = await initProject({ cwd: dir, ...quiet() });
			expect(read(dir, "next.config.ts"), name).toBe(custom);
			expect(
				report.changed.map((item) => item.file),
				name,
			).not.toContain("next.config.ts");
			const step = report.next.find((line) => line.startsWith("Wrap the config in next.config.ts")) ?? "";
			expect(step, name).toContain("init did not edit it:");
			expect(step, name).toContain('import { withCms } from "@monti-cms/nextjs/config";');
			expect(step, name).toContain("export default withCms(");
		}
		const commonjs = fixtureApp({ "next.config.ts": shapes.commonjs ?? "" });
		const text = formatInitReport(await initProject({ cwd: commonjs, ...quiet() }));
		expect(text).toContain("uses module.exports (CommonJS)");
		expect(text).not.toContain("Changed:\n  - next.config.ts");
	});

	it("without a next.config it creates next.config.ts with withCms, and lists it under Created", async () => {
		const dir = fixtureApp({ "next.config.ts": null });
		const report = await initProject({ cwd: dir, ...quiet() });
		expect(report.created).toContain("next.config.ts");
		const config = read(dir, "next.config.ts");
		expect(config).toContain('import { withCms } from "@monti-cms/nextjs/config";');
		expect(config).toContain("export default withCms(nextConfig);");
		expect(report.next.join("\n")).not.toContain("next.config");
	});

	it("is safe to run twice: the second run changes nothing and says it is already there", async () => {
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

	it("adds .monti/ to .gitignore once, keeps a line that already covers it, and reports it", async () => {
		const dir = fixtureApp({ ".gitignore": "node_modules\n.env.local" });
		const first = await initProject({ cwd: dir, ...quiet() });
		expect(read(dir, ".gitignore")).toBe("node_modules\n.env.local\n.monti/\n");
		expect(first.changed).toContainEqual({
			file: ".gitignore",
			change: "added .monti/ (monti db:migrate writes its logs there)",
		});
		const second = await initProject({ cwd: dir, ...quiet() });
		expect(read(dir, ".gitignore")).toBe("node_modules\n.env.local\n.monti/\n");
		expect(second.changed.map((item) => item.file)).not.toContain(".gitignore");
		for (const covered of [".monti", "/.monti/", ".monti/*"]) {
			const other = fixtureApp({ ".gitignore": `${covered}\n.env.local\n` });
			const report = await initProject({ cwd: other, ...quiet() });
			expect(read(other, ".gitignore")).toBe(`${covered}\n.env.local\n`);
			expect(report.changed.map((item) => item.file)).not.toContain(".gitignore");
		}
	});

	it("a dry run reports the edits as planned and writes nothing", async () => {
		const dir = fixtureApp();
		const before = snapshot(dir);
		const report = await initProject({ cwd: dir, ...quiet(), dryRun: true });
		expect(snapshot(dir)).toEqual(before);
		expect(report.changed.map((item) => item.file)).toEqual(["next.config.ts", "app/layout.tsx", ".gitignore"]);
		expect(formatInitReport(report)).toContain("Would change:\n  - next.config.ts \u2014");
	});

	it("puts suppressHydrationWarning after the other attributes of <html>, whichever way they are written", async () => {
		const cases: [string, string][] = [
			["<html>", "<html suppressHydrationWarning>"],
			[
				'<html lang={locale} className={cn("a", b > c)}>',
				'<html lang={locale} className={cn("a", b > c)} suppressHydrationWarning>',
			],
		];
		for (const [from, to] of cases) {
			const dir = fixtureApp({ "app/layout.tsx": CREATE_NEXT_APP_LAYOUT.replace('<html lang="en">', from) });
			const report = await initProject({ cwd: dir, ...quiet() });
			if (from.includes("b > c")) {
				// A `>` inside an attribute: init cannot find the end of the tag, so it does not touch it.
				expect(read(dir, "app/layout.tsx")).toContain(from);
				expect(report.next.join("\n")).toContain("init could not read the <html> tag");
			} else {
				expect(read(dir, "app/layout.tsx")).toContain(to);
			}
		}
	});

	it("the progress line counts created files and changes to existing files apart", async () => {
		const lines: string[] = [];
		const dir = fixtureApp();
		const report = await initProject({ cwd: dir, ...quiet(), log: (line) => lines.push(line) });
		const line = lines.find((item) => item.startsWith("Created "));
		expect(line).toBe(`Created ${report.created.length} files, changed ${report.changed.length}`);
		expect(report.changed.length).toBeGreaterThan(0);
		expect(lines.some((item) => item.startsWith("Wrote "))).toBe(false);
	});

	it("formats the edited <html> sensibly: one line when it fits, one attribute per line when it would be long", async () => {
		const edited = async (tag: string) => {
			const dir = fixtureApp({ "app/layout.tsx": CREATE_NEXT_APP_LAYOUT.replace('<html lang="en">', tag) });
			await initProject({ cwd: dir, ...quiet() });
			return read(dir, "app/layout.tsx");
		};
		// Short: stays on one line.
		expect(await edited('<html lang="en" className="dark">')).toContain(
			'    <html lang="en" className="dark" suppressHydrationWarning>',
		);
		// Long (the shape create-next-app 16 writes): every attribute on its own line, the template literal intact.
		// biome-ignore lint/suspicious/noTemplateCurlyInString: the JSX source holds a template literal on purpose
		const className = "className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}";
		const long = await edited(`<html lang="en" ${className}>`);
		expect(long).toContain(
			`    <html\n      lang="en"\n      ${className}\n      suppressHydrationWarning\n    >\n      <body>`,
		);
		// Already one attribute per line: the new one is added on a line of its own, like the others.
		expect(await edited('<html\n      lang="en"\n      dir="ltr"\n    >')).toContain(
			'<html\n      lang="en"\n      dir="ltr"\n      suppressHydrationWarning\n    >',
		);
		// Tabs stay tabs.
		const tabs = fixtureApp({
			"app/layout.tsx": `export default function L({ children }: { children: React.ReactNode }) {\n\treturn (\n\t\t<html lang="en" className="a-very-long-class-name another-long-class-name yet-another-class-name">\n\t\t\t{children}\n\t\t</html>\n\t);\n}\n`,
		});
		await initProject({ cwd: tabs, ...quiet() });
		expect(read(tabs, "app/layout.tsx")).toContain('\t\t<html\n\t\t\tlang="en"\n');
	});

	it("a layout init cannot edit (no <html>, or suppressHydrationWarning={false}) gets a step with the reason", async () => {
		const noHtml = fixtureApp({
			"app/layout.tsx": "export default function L({ children }: { children: React.ReactNode }) { return children; }\n",
		});
		const first = await initProject({ cwd: noHtml, ...quiet() });
		expect(first.next.join("\n")).toContain("app/layout.tsx has no <html> tag");
		const off = fixtureApp({
			"app/layout.tsx": CREATE_NEXT_APP_LAYOUT.replace(
				'<html lang="en">',
				'<html lang="en" suppressHydrationWarning={false}>',
			),
		});
		const second = await initProject({ cwd: off, ...quiet() });
		expect(second.next.join("\n")).toContain("suppressHydrationWarning={false}");
		expect(read(off, "app/layout.tsx")).toContain("suppressHydrationWarning={false}");
	});

	it("an existing withCms and an existing suppressHydrationWarning are left alone and need no step", async () => {
		const withCms = 'import { withCms } from "@monti-cms/nextjs/config";\nexport default withCms({});\n';
		const done = fixtureApp({
			"next.config.ts": withCms,
			"app/layout.tsx": CREATE_NEXT_APP_LAYOUT.replace('<html lang="en">', '<html lang="en" suppressHydrationWarning>'),
		});
		const report = await initProject({ cwd: done, ...quiet() });
		expect(read(done, "next.config.ts")).toBe(withCms);
		expect(report.changed.map((item) => item.file)).toEqual([".gitignore"]);
		expect(report.next.join("\n")).not.toMatch(/next\.config|suppressHydrationWarning/);
	});

	it("a missing .gitignore is created, and one that misses .env.local gets it; none of it is left to the person", async () => {
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

	it("the deploy step names the site only when it is not a local address", async () => {
		const local = await initProject({ cwd: fixtureApp(), ...quiet() });
		expect(local.next.join("\n")).toContain("open <your site>/studio and create the first admin");
		expect(local.next.join("\n")).not.toContain("Right after you deploy, open http://localhost");
		const real = await initProject({ cwd: fixtureApp(), ...quiet(), siteUrl: "https://blog.example.com/" });
		expect(real.next.join("\n")).toContain("open https://blog.example.com/studio and create the first admin");
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
		expect(report.next.join("\n")).toContain("Create Monti's tables in your database (once): yarn monti db:setup");
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
		expect(report.next.join("\n")).toContain("http://localhost:4000/api/monti/auth/callback/github");
		expect(read(dir, ".env.example")).toContain("# SITE_URL=https://example.com");
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
		expect(config).toContain('import { ai } from "@monti-cms/ai";');
		expect(config).toContain('import { gitSync } from "@monti-cms/git-sync";');
		expect(config).toContain('import { s3Storage } from "@monti-cms/storage-s3";');
		expect(config).toContain('import { callout, color, tabs } from "@monti-cms/blocks";');
		expect(config).toMatch(/\n\t\tai\(\),\n/);
		expect(config).toMatch(/\n\t\tgitSync\(\),\n/);
		expect(config).toContain("\tstorage: s3Storage(),");
		expect(config.indexOf("callout(),")).toBeLessThan(config.indexOf("tabs(),"));
		expect(config.indexOf("tabs(),")).toBeLessThan(config.indexOf("color(),"));

		const schema = schemaOf(dir);
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
	it("writes the computer's time zone to the schema and says so in the summary", async () => {
		const dir = fixtureApp();
		const host = fakeHost({ systemTimeZone: () => "Asia/Seoul" });
		const report = await initProject({ cwd: dir, host, install: false });
		expect(schemaOf(dir).timeZone).toBe("Asia/Seoul");
		expect(formatInitReport(report)).toContain(
			"Time zone: Asia/Seoul (from this computer). Dates on your site and scheduled publishing use it; change `timeZone` in monti.schema.ts if your readers are elsewhere.",
		);
	});

	it("a broken computer time zone gives UTC and the summary says it could not be read", async () => {
		const dir = fixtureApp();
		const host = fakeHost({ systemTimeZone: () => "Mars/Olympus" });
		const report = await initProject({ cwd: dir, host, install: false });
		expect(schemaOf(dir).timeZone).toBe("UTC");
		expect(formatInitReport(report)).toContain("Time zone: UTC (this computer's time zone could not be read).");
	});

	it("an existing monti.config.ts is kept, its schema file is not written, and the skip is reported", async () => {
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
			/These files were written before it failed \(nothing was undone\):\n {2}- monti\.config\.ts\n {2}- monti\.schema\.ts\n/,
		);
		await expect(failure).rejects.toThrow(/Run `monti init` again to continue/);
	});

	it("cancelling a prompt writes nothing", async () => {
		const dir = fixtureApp();
		const before = listFiles(dir);
		const prompter = scriptedPrompter({ "Default language of the site": "cancel" });
		await expect(initProject({ cwd: dir, ...quiet(), prompter })).rejects.toBeInstanceOf(Cancelled);
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
