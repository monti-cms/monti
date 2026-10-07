import { mkdtempSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { parseSchemaFile } from "../../schema-file/format";
import { formatInitReport, InitError, initProject, ProjectWriter, unifiedDiff } from "../init";
import { InitCancelled } from "../init-prompts";
import {
	CREATE_NEXT_APP,
	fakeHost,
	fixtureApp,
	listFiles,
	POST_MDX,
	read,
	SRC_APP,
	scriptedPrompter,
} from "./init-helpers";

/** What every run needs so it touches nothing outside the fixture: a fake host, no install, and an empty environment. */
const quiet = () => ({ host: fakeHost(), env: {}, install: false });

describe("monti init in a fresh create-next-app", () => {
	it("writes explicit files with the defaults and tells what is left", async () => {
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
			".env.local",
		]);
		expect(report.updated).toEqual(["next.config.ts"]);

		// One line per feature, each with a comment; nothing hidden behind a preset.
		const config = read(dir, "monti.config.ts");
		expect(config).toContain('import { defineConfig, postgres } from "@monti-cms/core/server";');
		expect(config).toContain('import schema from "./monti.schema.json";');
		expect(config).toContain("export const cms = defineConfig({\n\tschema,");
		expect(config).toMatch(/\/\/ Bodies as MDX.*\n\t\tmdx\(\),/);
		for (const line of [
			"callout(), //",
			"collapsible(), //",
			"tabs(), //",
			"columns(), //",
			"codeExplorer(), //",
			"mermaid(), //",
			"chart(), //",
			"tooltip(), //",
			"codeRef(), //",
			"color(), //",
		]) {
			expect(config).toContain(line);
		}
		expect(config).toContain("database: postgres(),");
		expect(config).toContain("auth: auth({ providers: [github()] }),");
		expect(config).toContain("// storage: s3Storage(),");
		expect(config).not.toMatch(/aiPlugin|gitSync|bareun|\.\.\.blocks|process\.env|createCms|defineServerConfig/);
		// The old conventional names only.
		expect(config).not.toMatch(/CMS_|AUTH_SECRET/);

		// The schema is valid, English, UTC, and the admin path is the one asked for.
		const schema = JSON.parse(read(dir, "monti.schema.json"));
		expect(() => parseSchemaFile(schema)).not.toThrow();
		expect(schema.collections.post).toMatchObject({ kind: "document", path: "/posts/:slug" });
		expect(Object.keys(schema.collections.post.fields)).toEqual(["title", "slug", "summary"]);
		expect(schema.locales).toEqual([{ code: "en", name: "English" }]);
		expect(schema.defaultLocale).toBe("en");
		expect(schema.timeZone).toBe("UTC");
		expect(schema.admin).toEqual({ path: "/studio" });
		expect(schema.site).toEqual({ name: "my-blog" });
		expect(schema.$schema).toBe("./node_modules/@monti-cms/core/schema.json");
		expect(read(dir, "monti-env.d.ts")).toContain('readonly defaultLocale: "en";');

		// The three Next files import the config by a relative path.
		expect(read(dir, "app/studio/[[...path]]/page.tsx")).toContain('import { cms } from "../../../monti.config";');
		const layout = read(dir, "app/studio/layout.tsx");
		expect(layout).toContain('import { cms } from "../../monti.config";');
		expect(layout).toContain('import "@monti-cms/admin/styles.css";');
		expect(layout).toContain('import "@monti-cms/blocks/styles.css";');
		expect(read(dir, "app/api/cms/[...path]/route.ts")).toContain('import { cms } from "../../../../monti.config";');

		// .env.local holds only what was generated; .env.example lists the names.
		expect(read(dir, ".env.local")).toMatch(/^# .*\nMONTI_SECRET=generated-secret\n$/);
		const example = read(dir, ".env.example");
		for (const name of [
			"DATABASE_URL",
			"DATABASE_SCHEMA",
			"MONTI_SECRET",
			"AUTH_GITHUB_ID",
			"AUTH_GITHUB_SECRET",
			"MONTI_ADMIN_GITHUB_ID",
			"SITE_URL",
		]) {
			expect(example).toContain(name);
		}
		expect(example).not.toContain("S3_BUCKET");

		// next.config.ts got withCms, and the diff is in the report.
		expect(read(dir, "next.config.ts")).toContain("export default withCms(nextConfig);");
		expect(report.diffs[0]?.diff).toContain('+import { withCms } from "@monti-cms/nextjs/config";');

		// What is left has exact values.
		const next = report.next.join("\n");
		expect(next).toContain("DATABASE_URL in .env.local");
		expect(next).toContain("pnpm exec monti migrate");
		expect(next).toContain("Authorization callback URL: http://localhost:3000/api/cms/auth/callback/github");
		expect(next).toContain("AUTH_GITHUB_ID");
		expect(next).toContain("AUTH_GITHUB_SECRET");
		expect(next).toContain("MONTI_ADMIN_GITHUB_ID");
		expect(report.next.at(-1)).toBe("Start the app: pnpm dev, then open http://localhost:3000/studio");
		expect(next).not.toContain("monti import");
		// Everything the generated files say is English.
		expect(config + layout).not.toMatch(/[가-힣]/); // cms-allow-korean: checks that the generated files have no Korean
	});

	it("does not install, start or migrate anything when no database was given", async () => {
		const dir = fixtureApp();
		const host = fakeHost();
		const report = await initProject({ cwd: dir, host, env: {} });
		expect(host.run).not.toHaveBeenCalled();
		expect(host.migrate).not.toHaveBeenCalled();
		// The packages are installed with the detected package manager.
		expect(host.install).toHaveBeenCalledTimes(1);
		const command = host.install.mock.calls[0]?.[0];
		expect(command?.command).toBe("pnpm");
		expect(command?.args[0]).toBe("add");
		expect(command?.args).toEqual(
			expect.arrayContaining([
				"@monti-cms/core",
				"@monti-cms/admin",
				"@monti-cms/auth",
				"@monti-cms/nextjs",
				"@monti-cms/mdx",
				"@monti-cms/blocks",
				"mermaid",
				"recharts",
			]),
		);
		expect(command?.args).not.toContain("@monti-cms/ai");
		expect(command?.cwd).toBe(dir);
		expect(report.steps).toContainEqual({
			name: "Run monti migrate",
			status: "skipped",
			detail: "DATABASE_URL is not set",
		});
	});
});

describe("monti init in other app shapes", () => {
	it("a src/ app keeps the config in src and the Next files under src/app", async () => {
		const dir = fixtureApp(SRC_APP);
		const report = await initProject({ cwd: dir, ...quiet(), adminPath: "/cms/studio" });
		expect(report.created.slice(0, 6)).toEqual([
			"src/monti.config.ts",
			"src/monti.schema.json",
			"src/monti-env.d.ts",
			"src/app/cms/studio/[[...path]]/page.tsx",
			"src/app/cms/studio/layout.tsx",
			"src/app/api/cms/[...path]/route.ts",
		]);
		expect(read(dir, "src/app/cms/studio/layout.tsx")).toContain('import { cms } from "../../../monti.config";');
		expect(read(dir, "src/app/api/cms/[...path]/route.ts")).toContain(
			'import { cms } from "../../../../monti.config";',
		);
		expect(JSON.parse(read(dir, "src/monti.schema.json")).$schema).toBe("../node_modules/@monti-cms/core/schema.json");
		expect(JSON.parse(read(dir, "src/monti.schema.json")).admin).toEqual({ path: "/cms/studio" });
		expect(listFiles(dir).filter((file) => file.startsWith("app/"))).toEqual([]);
	});

	it("an app with a content folder gets a post collection from its front matter and a monti import suggestion", async () => {
		const dir = fixtureApp({
			"content/posts/first.mdx": POST_MDX("first"),
			"content/posts/second.md": POST_MDX("second"),
		});
		const report = await initProject({ cwd: dir, ...quiet() });
		const post = JSON.parse(read(dir, "monti.schema.json")).collections.post;
		expect(post.path).toBe("/posts/:slug");
		expect(Object.keys(post.fields)).toEqual(["title", "slug", "author", "cover", "date", "description", "tags"]);
		expect(post.fields.description).toMatchObject({ kind: "text", role: "summary" });
		expect(post.fields.cover).toMatchObject({ kind: "media", accept: "image" });
		expect(post.fields).not.toHaveProperty("draft");
		expect(report.app.contentFolders).toEqual([{ dir: "content/posts", files: 2 }]);
		expect(report.next.at(-1)).toBe(
			"Bring in your existing posts (2 in content/posts/): pnpm exec monti import content/posts",
		);
		expect(report.notes.join("\n")).toContain("follows the front matter of content/posts/");
		// The content itself is never touched.
		expect(read(dir, "content/posts/first.mdx")).toBe(POST_MDX("first"));
	});

	it("uses the package manager the lockfile names", async () => {
		const dir = fixtureApp({ "pnpm-lock.yaml": null, "yarn.lock": "" });
		const host = fakeHost();
		const report = await initProject({ cwd: dir, host, env: {}, database: "skip" });
		expect(host.install.mock.calls[0]?.[0].command).toBe("yarn");
		expect(report.next.join("\n")).toContain("yarn monti migrate");
		expect(report.next.at(-1)).toContain("Start the app: yarn dev");
		expect(
			(await initProject({ cwd: fixtureApp({ "pnpm-lock.yaml": null }), ...quiet(), packageManager: "bun" })).next.at(
				-1,
			),
		).toContain("bun run dev");
	});

	it("takes the dev port from the dev script for the callback URL", async () => {
		const dir = fixtureApp({
			"package.json": JSON.stringify({
				name: "x",
				scripts: { dev: "next dev -p 4000" },
				dependencies: { next: "16.3.8" },
			}),
		});
		const report = await initProject({ cwd: dir, ...quiet() });
		expect(report.next.join("\n")).toContain("http://localhost:4000/api/cms/auth/callback/github");
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
	it("a local Docker Postgres: writes docker-compose.yml, starts it, waits for it and migrates", async () => {
		const dir = fixtureApp();
		const host = fakeHost({ freePort: async () => 5433 });
		const report = await initProject({ cwd: dir, host, env: {}, database: "docker" });
		expect(read(dir, "docker-compose.yml")).toContain('- "5433:5432"');
		expect(read(dir, ".env.local")).toContain("DATABASE_URL=postgres://monti:monti@localhost:5433/monti");
		expect(host.run).toHaveBeenCalledWith("docker", ["compose", "up", "-d"], dir);
		expect(host.databaseReachable).toHaveBeenCalledWith("postgres://monti:monti@localhost:5433/monti", 30000);
		expect(host.migrate).toHaveBeenCalledWith(dir);
		expect(report.steps.map((step) => `${step.name}:${step.status}`)).toEqual([
			"Start Postgres in Docker:done",
			"Install packages:done",
			"Run monti migrate:done",
		]);
		expect(report.next.join("\n")).not.toContain("Create the tables");
		expect(report.ok).toBe(true);
	});

	it("without Docker it still writes the files and says to start it", async () => {
		const dir = fixtureApp();
		const host = fakeHost({ dockerAvailable: () => false, databaseReachable: (async () => false) as never });
		const report = await initProject({ cwd: dir, host, env: {}, database: "docker" });
		expect(host.run).not.toHaveBeenCalled();
		expect(host.migrate).not.toHaveBeenCalled();
		expect(read(dir, "docker-compose.yml")).toContain("postgres:17");
		expect(report.steps[0]).toMatchObject({ status: "skipped", detail: "Docker is not running or not installed" });
		expect(report.next.join("\n")).toContain(
			"Start the database: docker compose up -d (install and start Docker first)",
		);
		expect(report.next.join("\n")).toContain("Create the tables: pnpm exec monti migrate");
	});

	it("an existing compose file is not touched; the service to add is printed", async () => {
		const dir = fixtureApp({ "compose.yaml": "services: {}\n" });
		const report = await initProject({ cwd: dir, ...quiet(), database: "docker" });
		expect(read(dir, "compose.yaml")).toBe("services: {}\n");
		expect(() => read(dir, "docker-compose.yml")).toThrow();
		expect(report.skipped).toContain("compose.yaml");
		expect(report.notes.join("\n")).toContain("monti-db:");
	});

	it("a pasted URL goes to .env.local (and the report hides its password); migrate runs when it is reachable", async () => {
		const dir = fixtureApp();
		const host = fakeHost();
		const report = await initProject({
			cwd: dir,
			host,
			env: {},
			database: "postgres://me:hunter2@db.example.com:5432/blog",
			adminGithubId: "12345",
		});
		expect(read(dir, ".env.local")).toContain("DATABASE_URL=postgres://me:hunter2@db.example.com:5432/blog");
		expect(read(dir, ".env.local")).toContain("MONTI_ADMIN_GITHUB_ID=12345");
		expect(JSON.stringify(report)).not.toContain("hunter2");
		expect(host.databaseReachable).toHaveBeenCalledWith("postgres://me:hunter2@db.example.com:5432/blog", 0);
		expect(host.migrate).toHaveBeenCalledTimes(1);
		expect(report.next.join("\n")).not.toContain("Put your numeric GitHub id");
		// .env.example never holds a value.
		expect(read(dir, ".env.example")).not.toContain("hunter2");
	});

	it("an unreachable database is not an error: migrate is left as a step", async () => {
		const dir = fixtureApp();
		const host = fakeHost({ databaseReachable: (async () => false) as never });
		const report = await initProject({ cwd: dir, host, env: {}, database: "postgres://u:p@nowhere:5432/db" });
		expect(host.migrate).not.toHaveBeenCalled();
		expect(report.ok).toBe(true);
		expect(report.next.join("\n")).toContain("Create the tables: pnpm exec monti migrate");
	});

	it("every feature: the config has one line each, the packages follow, S3 names are listed", async () => {
		const dir = fixtureApp();
		const host = fakeHost();
		const report = await initProject({
			cwd: dir,
			host,
			env: {},
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
		expect(config).not.toMatch(/mermaid|chart\(|collapsible|columns|tooltip\(|codeRef/);
		// Blocks keep their canonical order: tabs before color (callout, tabs, color), not the order typed.
		expect(config.indexOf("callout(),")).toBeLessThan(config.indexOf("tabs(),"));
		expect(config.indexOf("tabs(),")).toBeLessThan(config.indexOf("color(),"));

		const schema = JSON.parse(read(dir, "monti.schema.json"));
		expect(schema.locales.map((entry: { code: string }) => entry.code)).toEqual(["ko", "en"]);
		expect(schema.defaultLocale).toBe("ko");
		expect(schema.timeZone).toBe("Asia/Seoul");
		expect(schema.collections.post.fields.title.localized).toBe(true);
		expect(schema.collections.post.fields.slug.localized).toBe("inherit");

		const args = host.install.mock.calls[0]?.[0].args ?? [];
		expect(args).toEqual(
			expect.arrayContaining([
				"@monti-cms/ai",
				"@monti-cms/git-sync",
				"@monti-cms/storage-s3",
				"@monti-cms/blocks",
				"lucide-react",
			]),
		);
		expect(args).not.toContain("mermaid");
		expect(args).not.toContain("recharts");
		expect(read(dir, ".env.example")).toContain("S3_BUCKET=");
		const next = report.next.join("\n");
		expect(next).toContain("S3_ACCESS_KEY_ID");
		expect(next).toContain("Authorization callback URL: https://blog.example.com/api/cms/auth/callback/github");
		expect(next).toContain("add a target to gitSync()");
		expect(next).toContain("then open https://blog.example.com/studio");
	});

	it("no blocks, no extras: a short config with just mdx", async () => {
		const dir = fixtureApp();
		await initProject({ cwd: dir, ...quiet(), blocks: "none" });
		const config = read(dir, "monti.config.ts");
		expect(config).not.toContain("@monti-cms/blocks");
		expect(config).toContain("mdx(),");
		expect(read(dir, "app/studio/layout.tsx")).not.toContain("blocks/styles.css");
	});

	it("the blog theme is added through the registry (monti add blog-theme) only when asked", async () => {
		const without = fixtureApp();
		await initProject({ cwd: without, ...quiet() });
		expect(listFiles(without).some((file) => file.includes("(site)"))).toBe(false);

		const dir = fixtureApp();
		const host = fakeHost();
		const report = await initProject({ cwd: dir, host, env: {}, blogTheme: true, database: "skip" });
		expect(report.created).toContain("app/(site)/blog/page.tsx");
		expect(report.steps).toContainEqual({
			name: "Add the blog theme",
			status: "done",
			detail: expect.stringMatching(/files$/),
		});
		expect(JSON.parse(read(dir, "monti.schema.json")).site.previewPath).toBe("/preview");
		const next = report.next.join("\n");
		expect(next).toContain('set excerptField to "summary"');
		// Tailwind is there, the typography plugin is not.
		expect(next).toContain("pnpm add -D @tailwindcss/typography");
	});
});

describe("monti init and files that already exist", () => {
	it("never overwrites: an existing monti.config.ts is kept and its schema file is not written", async () => {
		const dir = fixtureApp({ "monti.config.ts": "// mine\nexport const cms = {};\n" });
		const report = await initProject({ cwd: dir, ...quiet() });
		expect(read(dir, "monti.config.ts")).toBe("// mine\nexport const cms = {};\n");
		expect(() => read(dir, "monti.schema.json")).toThrow();
		expect(report.created).not.toContain("monti.config.ts");
		expect(report.created).toContain("app/studio/layout.tsx");
		expect(report.notes.join("\n")).toContain("monti.config.ts already exists, so it was kept");
	});

	it("leaves the files of the earlier cms.config.ts setup alone", async () => {
		const dir = fixtureApp({ "cms.config.ts": "export default {};\n", "cms.server.ts": "export const cms = {};\n" });
		const report = await initProject({ cwd: dir, ...quiet() });
		expect(read(dir, "cms.config.ts")).toBe("export default {};\n");
		expect(() => read(dir, "monti.config.ts")).toThrow();
		expect(report.notes.join("\n")).toContain("cms.config.ts and cms.server.ts from the earlier setup are left alone");
	});

	it("running twice changes nothing the second time", async () => {
		const dir = fixtureApp();
		await initProject({ cwd: dir, ...quiet() });
		const before = listFiles(dir).map((file) => [file, read(dir, file)]);
		const report = await initProject({ cwd: dir, ...quiet() });
		expect(listFiles(dir).map((file) => [file, read(dir, file)])).toEqual(before);
		expect(report.created).toEqual([]);
		expect(report.updated).toEqual([]);
		expect(report.skipped).toEqual(expect.arrayContaining(["monti.config.ts", "next.config.ts", ".env.example"]));
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
		const prompter = scriptedPrompter({
			"already exists and differs": false,
			Postgres: "skip",
			GitHub: "",
			Languages: "en",
			uploaded: "none",
			Extra: [],
			blocks: "all",
			admin: "/studio",
			"blog theme": false,
			"Add withCms": true,
		});
		await initProject({ cwd: asked, ...quiet(), prompter });
		expect(read(asked, "app/studio/layout.tsx")).toBe("// my layout\n");
		expect(prompter.asked.some((message) => message.includes("app/studio/layout.tsx already exists"))).toBe(true);
	});

	it("adds only the missing names to an existing .env.local and leaves its other lines alone", async () => {
		const dir = fixtureApp({ ".env.local": "DATABASE_URL=postgres://mine\nOTHER=1" });
		const report = await initProject({ cwd: dir, ...quiet() });
		expect(read(dir, ".env.local")).toBe("DATABASE_URL=postgres://mine\nOTHER=1\nMONTI_SECRET=generated-secret\n");
		expect(report.updated).toContain(".env.local");
		expect(report.notes.join("\n")).toContain("DATABASE_URL is already set in .env.local, so it was not changed.");

		const set = fixtureApp({ ".env.local": "MONTI_SECRET=keep-me\n" });
		await initProject({ cwd: set, ...quiet(), database: "postgres://a:b@c:5432/d" });
		expect(read(set, ".env.local")).toBe("MONTI_SECRET=keep-me\nDATABASE_URL=postgres://a:b@c:5432/d\n");
	});

	it("an existing DATABASE_URL in .env.local counts as a database: migrate runs", async () => {
		const dir = fixtureApp({ ".env.local": "DATABASE_URL=postgres://u:p@h:5432/d\n" });
		const host = fakeHost();
		await initProject({ cwd: dir, host, env: {} });
		expect(host.migrate).toHaveBeenCalledTimes(1);
	});

	it("when next.config cannot be edited safely it is left as is and the exact change is printed", async () => {
		const custom = `import type { NextConfig } from "next";\nexport default (phase: string): NextConfig => ({});\n`;
		const dir = fixtureApp({ "next.config.ts": custom });
		const report = await initProject({ cwd: dir, ...quiet() });
		expect(read(dir, "next.config.ts")).toBe(custom);
		expect(report.updated).not.toContain("next.config.ts");
		const next = report.next.join("\n");
		expect(next).toContain("Wrap the config in next.config.ts");
		expect(next).toContain('import { withCms } from "@monti-cms/nextjs/config";');
		expect(next).toContain("export default withCms(nextConfig);");
	});

	it("an already wrapped next.config is skipped; a missing one is created", async () => {
		const wrapped = fixtureApp({
			"next.config.ts": 'import { withCms } from "@monti-cms/nextjs/config";\nexport default withCms({});\n',
		});
		const report = await initProject({ cwd: wrapped, ...quiet() });
		expect(report.skipped).toContain("next.config.ts");
		expect(report.updated).not.toContain("next.config.ts");

		const none = fixtureApp({ "next.config.ts": null });
		expect((await initProject({ cwd: none, ...quiet() })).created).toContain("next.config.ts");
		expect(read(none, "next.config.ts")).toContain("withCms(nextConfig)");
	});

	it("says what to fix by hand: resolveJsonModule, .gitignore, TypeScript", async () => {
		const dir = fixtureApp({
			"tsconfig.json": '{ "compilerOptions": { "strict": true } }',
			".gitignore": "node_modules\n",
		});
		const next = (await initProject({ cwd: dir, ...quiet() })).next.join("\n");
		expect(next).toContain('Set "resolveJsonModule": true');
		expect(next).toContain("Add .env.local to .gitignore");
		expect(read(dir, "tsconfig.json")).toBe('{ "compilerOptions": { "strict": true } }');
	});
});

describe("monti init --dry-run", () => {
	it("lists what it would do and writes and runs nothing", async () => {
		const dir = fixtureApp();
		const before = listFiles(dir);
		const host = fakeHost();
		const report = await initProject({ cwd: dir, host, env: {}, dryRun: true, database: "docker", extras: "ai" });
		expect(listFiles(dir)).toEqual(before);
		expect(host.run).not.toHaveBeenCalled();
		expect(host.install).not.toHaveBeenCalled();
		expect(host.migrate).not.toHaveBeenCalled();
		expect(report.dryRun).toBe(true);
		expect(report.created).toContain("monti.config.ts");
		expect(report.steps.every((step) => step.status === "planned")).toBe(true);
		const text = formatInitReport(report);
		expect(text).toContain("Dry run: nothing was written");
		expect(text).toContain("Would create:");
	});
});

describe("monti init when something goes wrong", () => {
	it("a failed install does not undo the files: the report says so and gives the command", async () => {
		const dir = fixtureApp();
		const host = fakeHost({ install: () => Promise.reject(new Error("`pnpm add` failed")) });
		const report = await initProject({ cwd: dir, host, env: {}, database: "postgres://a:b@c:5432/d" });
		expect(report.ok).toBe(false);
		expect(report.steps).toContainEqual({ name: "Install packages", status: "failed", detail: "`pnpm add` failed" });
		expect(read(dir, "monti.config.ts")).toContain("defineConfig");
		expect(host.migrate).not.toHaveBeenCalled();
		expect(report.next[0]).toMatch(/^Install the packages:\npnpm add @monti-cms\/core/);
	});

	it("a failed migrate marks the run as not ok", async () => {
		const dir = fixtureApp();
		const host = fakeHost({ migrate: async () => false });
		const report = await initProject({ cwd: dir, host, env: {}, database: "postgres://a:b@c:5432/d" });
		expect(report.ok).toBe(false);
		expect(report.steps.at(-1)).toMatchObject({ name: "Run monti migrate", status: "failed" });
	});

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
		const prompter = scriptedPrompter({ Postgres: "cancel" });
		await expect(initProject({ cwd: dir, ...quiet(), prompter })).rejects.toBeInstanceOf(InitCancelled);
		expect(listFiles(dir)).toEqual(before);
	});

	it("a wrong flag fails before anything is written, naming the flag", async () => {
		const dir = fixtureApp();
		const before = listFiles(dir);
		const cases: [Record<string, string>, RegExp][] = [
			[{ database: "mysql://x" }, /--database "mysql:\/\/x" must be a postgres:\/\/ URL/],
			[{ locales: "English" }, /--locales: "English" must be a language code/],
			[{ timeZone: "Mars/Base" }, /--time-zone "Mars\/Base" must be an IANA time zone/],
			[{ storage: "gcs" }, /--storage "gcs" must be "s3" or "none"/],
			[{ extras: "bareun" }, /--extras: "bareun" is not an extra/],
			[{ blocks: "callout,nope" }, /--blocks: "nope" is not a block/],
			[{ adminPath: "/" }, /--admin-path "\/" must be a path like "\/studio"/],
			[{ adminPath: "/api/studio" }, /--admin-path/],
			[{ adminPath: "/../../etc" }, /--admin-path/],
			[{ adminGithubId: "octocat" }, /--admin-github-id "octocat" must be the numeric GitHub id/],
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
