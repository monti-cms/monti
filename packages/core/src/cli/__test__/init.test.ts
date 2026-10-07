import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
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
	it("creates config and route files in an empty Next app and wires up tsconfig, CSS and the next config", () => {
		const dir = fakeApp();
		const report = initProject({ cwd: dir });
		expect(report.created).toEqual(
			expect.arrayContaining([
				"cms.config.ts",
				"cms.server.ts",
				"app/(admin)/admin/[[...path]]/page.tsx",
				"app/(admin)/admin/layout.tsx",
				"app/api/cms/[...path]/route.ts",
			]),
		);
		expect(report.updated).toEqual(["tsconfig.json", "next.config.ts"]);
		expect(report.skipped).toEqual([]);

		const config = read(dir, "cms.config.ts");
		expect(config).toContain('kind: "document"');
		expect(config).toContain("required: true");
		expect(config).toContain("// ...seoFields()");
		expect(config).toContain("// plugins: [...blocks(), seo()]");
		expect(config).not.toContain("admin: {"); // the default path is not written
		// Defaults to English and UTC (the file is developer-facing, so it only has English text).
		expect(config).toContain('locales: [{ code: "en", name: "English" }]');
		expect(config).toContain('defaultLocale: "en"');
		expect(config).toContain('timeZone: "UTC"');
		expect(config).not.toMatch(/[가-힣]/); // cms-allow-korean: checks that the generated file has no Korean
		expect(read(dir, "cms.server.ts")).toContain("githubAuth({");
		expect(read(dir, "cms.server.ts")).toContain('import { githubAuth } from "@monti-cms/nextjs/auth";');
		// The server file exports the instance; every generated file imports it from there by a relative path.
		expect(read(dir, "cms.server.ts")).toContain("export const cms = createCms({");
		const page = read(dir, "app/(admin)/admin/[[...path]]/page.tsx");
		expect(page).toContain("<CmsAdminPage cms={cms} {...props} />");
		expect(page).toContain('from "@monti-cms/nextjs/admin"');
		expect(page).toContain('import { cms } from "../../../../cms.server";');
		const layout = read(dir, "app/(admin)/admin/layout.tsx");
		expect(layout).toContain("<CmsAdminLayout cms={cms}>");
		// The prebuilt admin stylesheet is imported by the admin layout only; the app's global CSS is not touched and needs no Tailwind.
		expect(layout.startsWith('import "@monti-cms/admin/styles.css";\n')).toBe(true);
		expect(layout).toContain('from "@monti-cms/nextjs/admin"');
		expect(layout).toContain('import { cms } from "../../../cms.server";');
		const route = read(dir, "app/api/cms/[...path]/route.ts");
		expect(route).toContain("createRouteHandler(cms)");
		expect(route).toContain('import { createRouteHandler } from "@monti-cms/nextjs";');
		expect(route).toContain('import { cms } from "../../../../cms.server";');

		// Existing aliases and indentation stay as they are. Only the site config is an alias: the server file is imported.
		const tsconfig = read(dir, "tsconfig.json");
		expect(JSON.parse(tsconfig).compilerOptions.paths).toEqual({
			"@/*": ["./*"],
			"@cms-config": ["./cms.config.ts"],
		});
		expect(tsconfig).toContain('\n  "compilerOptions"');
		expect(tsconfig).toContain('"@cms-config": ["./cms.config.ts"]');

		expect(read(dir, "app/globals.css")).toBe('@import "tailwindcss";\n\n:root {\n  --background: #fff;\n}\n');

		const nextConfig = read(dir, "next.config.ts");
		expect(nextConfig.startsWith('import { withCms } from "@monti-cms/nextjs/config";\n')).toBe(true);
		expect(nextConfig).toContain('export default withCms(nextConfig, { config: "./cms.config.ts" });');
		expect(nextConfig).not.toContain("export default nextConfig");
		expect(report.todo.join("\n")).toContain("/api/cms/auth/callback/github");
		expect(report.todo.join("\n")).toContain("CMS_DATABASE_URL");
		// Nothing asks for Tailwind, typography or tw-animate.
		expect(report.todo.join("\n")).not.toMatch(/tailwind|tw-animate|typography/i);
	});

	it("running again overwrites nothing and reports files as skipped", () => {
		const dir = fakeApp();
		initProject({ cwd: dir });
		writeFileSync(path.join(dir, "cms.config.ts"), "// 사이트가 고친 설정\n");
		const before = ["tsconfig.json", "app/globals.css", "next.config.ts"].map((file) => read(dir, file));

		const report = initProject({ cwd: dir });
		expect(report.created).toEqual([]);
		expect(report.updated).toEqual([]);
		expect(report.skipped).toEqual([
			"cms.config.ts",
			"cms.server.ts",
			"app/(admin)/admin/[[...path]]/page.tsx",
			"app/(admin)/admin/layout.tsx",
			"app/api/cms/[...path]/route.ts",
			"tsconfig.json",
			"next.config.ts",
		]);
		expect(read(dir, "cms.config.ts")).toBe("// 사이트가 고친 설정\n");
		expect(["tsconfig.json", "app/globals.css", "next.config.ts"].map((file) => read(dir, file))).toEqual(before);
		expect(formatInitReport(report)).toContain("Skipped (already exist, not overwritten):\n  - cms.config.ts");
	});

	it("--locale and --time-zone are written as the site default locale and time zone", () => {
		const dir = fakeApp();
		initProject({ cwd: dir, locale: "ko", timeZone: "Asia/Seoul" });
		const config = read(dir, "cms.config.ts");
		expect(config).toContain('locales: [{ code: "ko", name: "한국어" }]');
		expect(config).toContain('defaultLocale: "ko"');
		expect(config).toContain('timeZone: "Asia/Seoul"');

		expect(() => initProject({ cwd: fakeApp(), locale: "Korean" })).toThrow(/--locale/);
		expect(() => initProject({ cwd: fakeApp(), timeZone: "Mars/Base" })).toThrow(/--time-zone/);
	});

	it("choosing an admin path makes the route folder and site config follow it", () => {
		const dir = fakeApp();
		const report = initProject({ cwd: dir, adminPath: "/cms/studio" });
		expect(report.created).toContain("app/(admin)/cms/studio/[[...path]]/page.tsx");
		expect(report.created).toContain("app/(admin)/cms/studio/layout.tsx");
		expect(read(dir, "cms.config.ts")).toContain('admin: { path: "/cms/studio" }');
		expect(report.todo.at(-1)).toContain("/cms/studio");

		// If the config file already exists, it is not overwritten and the lines to add are reported.
		const other = fakeApp({ "cms.config.ts": "export default {};\n" });
		expect(initProject({ cwd: other, adminPath: "/studio" }).todo[0]).toContain('admin: { path: "/studio" }');

		expect(() => initProject({ cwd: dir, adminPath: "/" })).toThrow(/admin-path/);
		expect(() => initProject({ cwd: dir, adminPath: "/api/admin" })).toThrow(/admin-path/);
	});

	it("a `src/app` app keeps config files in src, and writes paths relative to baseUrl if present", () => {
		const dir = fakeApp({
			"tsconfig.json": '{\n\t"compilerOptions": {\n\t\t"baseUrl": "./src"\n\t}\n}\n',
			"app/globals.css": "",
			"src/app/globals.css": '@import "tailwindcss";\n',
		});
		rmSync(path.join(dir, "app"), { recursive: true });
		const report = initProject({ cwd: dir });
		expect(report.created.slice(0, 3)).toEqual([
			"src/cms.config.ts",
			"src/cms.server.ts",
			"src/app/(admin)/admin/[[...path]]/page.tsx",
		]);
		const tsconfig = read(dir, "tsconfig.json");
		expect(JSON.parse(tsconfig).compilerOptions.paths).toEqual({ "@cms-config": ["./cms.config.ts"] });
		expect(tsconfig).toContain('\n\t"compilerOptions"');
		expect(read(dir, "src/app/globals.css")).toBe('@import "tailwindcss";\n');
		expect(read(dir, "next.config.ts")).toContain('config: "./src/cms.config.ts" }');
		// Files under `src/app` import the server file from `src/`.
		expect(read(dir, "src/app/api/cms/[...path]/route.ts")).toContain('import { cms } from "../../../../cms.server";');
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
		expect(read(dir, "tsconfig.json")).toBe(commented);
		expect(read(dir, "next.config.ts")).toBe(custom);
		expect(read(dir, "app/globals.css")).toBe("body { margin: 0; }\n");
		const todo = report.todo.join("\n");
		expect(todo).toContain('"@cms-config": ["./cms.config.ts"]');
		expect(todo).toContain("withCms(nextConfig");
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
