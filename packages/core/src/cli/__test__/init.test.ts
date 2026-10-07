import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { defineConfig } from "../../config/define";
import { parseSchemaFile } from "../../schema-file/format";
import { formatInitReport, initProject } from "../init";

const DEFAULT_NEXT_CONFIG = `import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
};

export default nextConfig;
`;

let dirs: string[] = [];
afterEach(() => {
	for (const dir of dirs) rmSync(dir, { recursive: true, force: true });
	dirs = [];
});

/** An empty create-next-app-shaped app (files only, no install). */
function fakeApp(files: Record<string, string> = {}): string {
	const dir = mkdtempSync(path.join(tmpdir(), "cms-init-"));
	dirs.push(dir);
	const all: Record<string, string> = {
		"package.json": '{ "name": "site", "private": true }\n',
		"tsconfig.json":
			'{\n  "compilerOptions": {\n    "strict": true,\n    "paths": {\n      "@/*": ["./*"]\n    }\n  }\n}\n',
		"app/globals.css": '@import "tailwindcss";\n\n:root {\n  --background: #fff;\n}\n',
		"app/layout.tsx": "export default function RootLayout() { return null; }\n",
		"next.config.ts": DEFAULT_NEXT_CONFIG,
		...files,
	};
	for (const [file, content] of Object.entries(all)) {
		mkdirSync(path.dirname(path.join(dir, file)), { recursive: true });
		writeFileSync(path.join(dir, file), content);
	}
	return dir;
}
const read = (dir: string, file: string) => readFileSync(path.join(dir, file), "utf8");

describe("monti init", () => {
	it("creates one config file, the schema and three Next files in an empty Next app and wires up the next config, leaving tsconfig and CSS alone", () => {
		const dir = fakeApp();
		const report = initProject({ cwd: dir });
		expect(report.created).toEqual([
			"monti.config.ts",
			"monti.schema.json",
			"monti-env.d.ts",
			"app/admin/[[...path]]/page.tsx",
			"app/admin/layout.tsx",
			"app/api/cms/[...path]/route.ts",
		]);
		expect(report.updated).toEqual(["next.config.ts"]);
		expect(report.skipped).toEqual([]);

		// The config is the one file: it loads the schema file, and names the database, the login and the plugins; the data is in the schema file.
		const config = read(dir, "monti.config.ts");
		expect(config).toContain('import schema from "./monti.schema.json";');
		expect(config).toContain('import { defineConfig, postgres } from "@monti-cms/core/server";');
		expect(config).toContain("export const cms = defineConfig({\n\tschema,");
		expect(config).toContain("database: postgres(),");
		expect(config).toContain("auth: auth({ providers: [github()], host: nextHost }),");
		expect(config).toContain("plugins: [],");
		expect(config).toContain('import { auth } from "@monti-cms/auth";');
		expect(config).toContain('import { github } from "@monti-cms/auth/github";');
		expect(config).toContain('import { nextHost } from "@monti-cms/nextjs/auth";');
		// No separate server file, no defineServerConfig, no secret or other value read from process.env here, and nothing of the old names.
		expect(() => read(dir, "cms.server.ts")).toThrow();
		expect(() => read(dir, "cms.config.ts")).toThrow();
		expect(config).not.toMatch(
			/defineServerConfig|createCms|process\.env\.(?!HOST_URL)|CMS_|AUTH_SECRET|next-auth|\.\.\.blocks/,
		);
		expect(config).not.toContain("defineCollection");
		const schema = JSON.parse(read(dir, "monti.schema.json"));
		expect(schema.$schema).toBe("./node_modules/@monti-cms/core/schema.json");
		expect(schema.collections.post).toMatchObject({ kind: "document", path: "/posts/:slug" });
		expect(schema.collections.post.fields.title).toMatchObject({ kind: "text", required: true });
		expect(schema).not.toHaveProperty("admin"); // the default path is not written
		// Defaults to English and UTC (the file is developer-facing, so it only has English text).
		expect(schema.locales).toEqual([{ code: "en", name: "English" }]);
		expect(schema.defaultLocale).toBe("en");
		expect(schema.timeZone).toBe("UTC");
		expect(config + read(dir, "monti.schema.json")).not.toMatch(/[가-힣]/); // cms-allow-korean: checks that the generated files have no Korean
		// The types of the schema are written next to it.
		expect(read(dir, "monti-env.d.ts")).toContain('readonly defaultLocale: "en";');
		// Every generated file imports the CMS instance from the config file by a relative path: there is no alias for it.
		const page = read(dir, "app/admin/[[...path]]/page.tsx");
		expect(page).toContain("<CmsAdminPage cms={cms} {...props} />");
		expect(page).toContain('from "@monti-cms/nextjs/admin"');
		expect(page).toContain('import { cms } from "../../../monti.config";');
		const layout = read(dir, "app/admin/layout.tsx");
		expect(layout).toContain("<CmsAdminLayout cms={cms}>");
		// The prebuilt admin stylesheet is imported by the admin layout only; the app's global CSS is not touched and needs no Tailwind.
		expect(layout.startsWith('import "@monti-cms/admin/styles.css";\n')).toBe(true);
		expect(layout).toContain('from "@monti-cms/nextjs/admin"');
		expect(layout).toContain('import { cms } from "../../monti.config";');
		const route = read(dir, "app/api/cms/[...path]/route.ts");
		expect(route).toContain("createRouteHandler(cms)");
		expect(route).toContain('import { createRouteHandler } from "@monti-cms/nextjs";');
		expect(route).toContain('import { cms } from "../../../../monti.config";');

		// tsconfig is not edited: no alias is needed, the config is imported by a relative path.
		expect(read(dir, "tsconfig.json")).toBe(
			'{\n  "compilerOptions": {\n    "strict": true,\n    "paths": {\n      "@/*": ["./*"]\n    }\n  }\n}\n',
		);
		expect(read(dir, "tsconfig.json")).not.toContain("cms-config");

		expect(read(dir, "app/globals.css")).toBe('@import "tailwindcss";\n\n:root {\n  --background: #fff;\n}\n');

		const nextConfig = read(dir, "next.config.ts");
		expect(nextConfig.startsWith('import { withCms } from "@monti-cms/nextjs/config";\n')).toBe(true);
		expect(nextConfig).toContain("export default withCms(nextConfig);");
		expect(nextConfig).not.toContain("export default nextConfig");
		// The environment variables it tells about are the conventional ones.
		const todo = report.todo.join("\n");
		for (const name of [
			"DATABASE_URL",
			"MONTI_SECRET",
			"AUTH_GITHUB_ID",
			"AUTH_GITHUB_SECRET",
			"MONTI_ADMIN_GITHUB_ID",
		]) {
			expect(todo).toContain(name);
		}
		expect(todo).toContain("/api/cms/auth/callback/github");
		expect(todo).not.toMatch(/CMS_|AUTH_SECRET|CMS_DEV_AUTH_BYPASS/);
		// Nothing asks for Tailwind, typography or tw-animate.
		expect(todo).not.toMatch(/tailwind|tw-animate|typography/i);
	});

	it("running again overwrites nothing and reports files as skipped", () => {
		const dir = fakeApp();
		initProject({ cwd: dir });
		writeFileSync(path.join(dir, "monti.config.ts"), "// 사이트가 고친 설정\n");
		const before = ["tsconfig.json", "app/globals.css", "next.config.ts"].map((file) => read(dir, file));

		const report = initProject({ cwd: dir });
		expect(report.created).toEqual([]);
		expect(report.updated).toEqual([]);
		expect(report.skipped).toEqual([
			"monti.config.ts",
			"app/admin/[[...path]]/page.tsx",
			"app/admin/layout.tsx",
			"app/api/cms/[...path]/route.ts",
			"next.config.ts",
		]);
		// The site's own config is not given a schema file it does not load; the existing one is pointed out.
		expect(report.todo.join("\n")).toContain("monti.schema.json exists: load it from monti.config.ts");
		expect(read(dir, "monti.config.ts")).toBe("// 사이트가 고친 설정\n");
		expect(["tsconfig.json", "app/globals.css", "next.config.ts"].map((file) => read(dir, file))).toEqual(before);
		expect(formatInitReport(report)).toContain("Skipped (already exist, not overwritten):\n  - monti.config.ts");
	});

	it("writes a schema file that is valid, that the config loads, and that has types", () => {
		const dir = fakeApp({
			"tsconfig.json": '{ "compilerOptions": { "resolveJsonModule": true } }\n',
		});
		const report = initProject({ cwd: dir, adminPath: "/studio", locale: "ko", timeZone: "Asia/Seoul" });
		const file = JSON.parse(read(dir, "monti.schema.json"));
		expect(() => parseSchemaFile(file)).not.toThrow();
		const config = defineConfig({ schema: file });
		expect(Object.keys(config.collections)).toEqual(["post"]);
		expect(config.admin?.path).toBe("/studio");
		expect(config.timeZone).toBe("Asia/Seoul");
		expect(read(dir, "monti-env.d.ts")).toContain('readonly path: "/posts/:slug";');
		// With resolveJsonModule on, nothing about tsconfig is asked.
		expect(report.todo.join("\n")).not.toContain("resolveJsonModule");
	});

	it("asks for resolveJsonModule when the tsconfig lacks it, and leaves the tsconfig alone", () => {
		const dir = fakeApp();
		const before = read(dir, "tsconfig.json");
		const report = initProject({ cwd: dir });
		expect(report.todo.join("\n")).toContain('Set "resolveJsonModule": true in tsconfig.json');
		expect(read(dir, "tsconfig.json")).toBe(before);
	});

	it("does not give an existing config a schema file, and says how to move its data", () => {
		const dir = fakeApp({ "monti.config.ts": "export const cms = {};\n" });
		const report = initProject({ cwd: dir });
		expect(report.created).not.toContain("monti.schema.json");
		expect(report.created).not.toContain("monti-env.d.ts");
		expect(report.todo.join("\n")).toContain("with `monti schema:extract`");
		expect(() => read(dir, "monti.schema.json")).toThrow();
	});

	it("--locale and --time-zone are written as the site default locale and time zone", () => {
		const dir = fakeApp();
		initProject({ cwd: dir, locale: "ko", timeZone: "Asia/Seoul" });
		const schema = JSON.parse(read(dir, "monti.schema.json"));
		expect(schema.locales).toEqual([{ code: "ko", name: "한국어" }]);
		expect(schema.defaultLocale).toBe("ko");
		expect(schema.timeZone).toBe("Asia/Seoul");

		expect(() => initProject({ cwd: fakeApp(), locale: "Korean" })).toThrow(/--locale/);
		expect(() => initProject({ cwd: fakeApp(), timeZone: "Mars/Base" })).toThrow(/--time-zone/);
	});

	it("leaves the files of the earlier setup alone: it creates no second config, and says they are now monti.config.ts", () => {
		const dir = fakeApp({ "cms.config.ts": "export default {};\n", "cms.server.ts": "export const cms = {};\n" });
		const report = initProject({ cwd: dir });
		expect(report.created).not.toContain("monti.config.ts");
		expect(report.created).not.toContain("monti.schema.json");
		expect(() => read(dir, "monti.config.ts")).toThrow();
		expect(read(dir, "cms.config.ts")).toBe("export default {};\n");
		expect(read(dir, "cms.server.ts")).toBe("export const cms = {};\n");
		expect(report.todo.join("\n")).toContain(
			"cms.config.ts and cms.server.ts from the earlier setup are replaced by monti.config.ts",
		);
		// The route files still point at the one config file, which is what the earlier files turn into.
		expect(report.created).toContain("app/admin/layout.tsx");
	});

	it("choosing an admin path makes the route folder and site config follow it", () => {
		const dir = fakeApp();
		const report = initProject({ cwd: dir, adminPath: "/cms/studio" });
		expect(report.created).toContain("app/cms/studio/[[...path]]/page.tsx");
		expect(report.created).toContain("app/cms/studio/layout.tsx");
		expect(JSON.parse(read(dir, "monti.schema.json")).admin).toEqual({ path: "/cms/studio" });
		expect(report.todo.at(-1)).toContain("/cms/studio");

		// If the config file already exists, it is not overwritten and the lines to add are reported.
		const other = fakeApp({ "monti.config.ts": "export const cms = {};\n" });
		expect(initProject({ cwd: other, adminPath: "/studio" }).todo.join("\n")).toContain('admin: { path: "/studio" }');

		expect(() => initProject({ cwd: dir, adminPath: "/" })).toThrow(/admin-path/);
		expect(() => initProject({ cwd: dir, adminPath: "/api/admin" })).toThrow(/admin-path/);
	});

	it("a `src/app` app keeps the config file in src, and imports it by relative paths whatever the baseUrl", () => {
		const dir = fakeApp({
			"tsconfig.json": '{\n\t"compilerOptions": {\n\t\t"baseUrl": "./src"\n\t}\n}\n',
			"app/globals.css": "",
			"src/app/globals.css": '@import "tailwindcss";\n',
		});
		rmSync(path.join(dir, "app"), { recursive: true });
		const report = initProject({ cwd: dir });
		expect(report.created.slice(0, 4)).toEqual([
			"src/monti.config.ts",
			"src/monti.schema.json",
			"src/monti-env.d.ts",
			"src/app/admin/[[...path]]/page.tsx",
		]);
		expect(read(dir, "tsconfig.json")).toBe('{\n\t"compilerOptions": {\n\t\t"baseUrl": "./src"\n\t}\n}\n');
		expect(read(dir, "src/monti.config.ts")).toContain('import schema from "./monti.schema.json";');
		expect(read(dir, "src/app/globals.css")).toBe('@import "tailwindcss";\n');
		expect(read(dir, "next.config.ts")).toContain("export default withCms(nextConfig);");
		// Files under `src/app` import the config file from `src/`.
		expect(read(dir, "src/app/api/cms/[...path]/route.ts")).toContain(
			'import { cms } from "../../../../monti.config";',
		);
	});

	it("when it cannot fix safely, it leaves the file as is and reports a manual step", () => {
		const custom = `import type { NextConfig } from "next";\nexport default (phase: string): NextConfig => ({});\n`;
		const commented = '{\n  // 주석\n  "compilerOptions": { "strict": true, },\n}\n';
		const dir = fakeApp({
			"tsconfig.json": commented,
			"next.config.ts": custom,
			"app/globals.css": "body { margin: 0; }\n",
		});
		const report = initProject({ cwd: dir });
		expect(report.updated).toEqual([]);
		expect(report.skipped).not.toContain("tsconfig.json");
		expect(read(dir, "tsconfig.json")).toBe(commented);
		expect(read(dir, "next.config.ts")).toBe(custom);
		expect(read(dir, "app/globals.css")).toBe("body { margin: 0; }\n");
		const todo = report.todo.join("\n");
		expect(todo).not.toContain("cms-config");
		expect(todo).toContain("withCms(nextConfig);");
		expect(todo).not.toMatch(/tailwind/i);
	});

	it("creates the next config if missing. Stops if there is no package.json", () => {
		const dir = fakeApp();
		rmSync(path.join(dir, "next.config.ts"));
		expect(initProject({ cwd: dir }).created).toContain("next.config.ts");
		expect(read(dir, "next.config.ts")).toContain("withCms(nextConfig");

		rmSync(path.join(dir, "package.json"));
		expect(() => initProject({ cwd: dir })).toThrow(/package.json/);
	});
});
