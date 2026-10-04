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

/** create-next-app 모양의 빈 앱(설치 없이 파일만). */
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
	it("빈 Next 앱에 설정·라우트 파일을 만들고 tsconfig·CSS·next 설정을 잇는다", () => {
		const dir = fakeApp();
		const report = initProject({ cwd: dir });
		expect(report.created).toEqual([
			"cms.config.ts",
			"cms.server.ts",
			"app/(admin)/admin/[[...path]]/page.tsx",
			"app/(admin)/admin/layout.tsx",
			"app/api/cms/[...path]/route.ts",
		]);
		expect(report.updated).toEqual(["tsconfig.json", "app/globals.css", "next.config.ts"]);
		expect(report.skipped).toEqual([]);

		const config = read(dir, "cms.config.ts");
		expect(config).toContain('kind: "document"');
		expect(config).toContain("required: true");
		expect(config).toContain("// ...seoFields()");
		expect(config).toContain("// plugins: [...blocks(), seo()]");
		expect(config).not.toContain("admin: {"); // 기본 경로는 적지 않는다
		// 기본은 영어·UTC(개발자가 읽는 파일이라 영어 글만 있다).
		expect(config).toContain('locales: [{ code: "en", name: "English" }]');
		expect(config).toContain('defaultLocale: "en"');
		expect(config).toContain('timeZone: "UTC"');
		expect(config).not.toMatch(/[가-힣]/); // cms-allow-korean: 만든 파일에 한국어가 없는지 확인
		expect(read(dir, "cms.server.ts")).toContain("githubAuth({");
		expect(read(dir, "app/(admin)/admin/[[...path]]/page.tsx")).toContain("CmsAdminPage as default");
		expect(read(dir, "app/(admin)/admin/layout.tsx")).toContain("<CmsAdminLayout>");
		expect(read(dir, "app/api/cms/[...path]/route.ts")).toContain("createCmsRouteHandler()");

		// 있던 별칭은 그대로, 들여쓰기도 그대로.
		const tsconfig = read(dir, "tsconfig.json");
		expect(JSON.parse(tsconfig).compilerOptions.paths).toEqual({
			"@/*": ["./*"],
			"@cms-config": ["./cms.config.ts"],
			"@cms-server": ["./cms.server.ts"],
		});
		expect(tsconfig).toContain('\n  "compilerOptions"');
		expect(tsconfig).toContain('"@cms-config": ["./cms.config.ts"]');

		// 스타일 줄은 마지막 @import 다음에.
		expect(read(dir, "app/globals.css").split("\n").slice(0, 5)).toEqual([
			'@import "tailwindcss";',
			"/* @monti-cms/core admin screen */",
			'@import "tw-animate-css";',
			'@import "@monti-cms/admin/styles.css";',
			'@plugin "@tailwindcss/typography";',
		]);

		const nextConfig = read(dir, "next.config.ts");
		expect(nextConfig.startsWith('import { withCms } from "@monti-cms/core/next";\n')).toBe(true);
		expect(nextConfig).toContain(
			'export default withCms(nextConfig, { config: "./cms.config.ts", server: "./cms.server.ts" });',
		);
		expect(nextConfig).not.toContain("export default nextConfig");
		expect(report.todo.join("\n")).toContain("/api/cms/auth/callback/github");
		expect(report.todo.join("\n")).toContain("CMS_DATABASE_URL");
	});

	it("다시 돌리면 아무것도 덮어쓰지 않고 건너뛴 것으로 알린다", () => {
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
			"app/globals.css",
			"next.config.ts",
		]);
		expect(read(dir, "cms.config.ts")).toBe("// 사이트가 고친 설정\n");
		expect(["tsconfig.json", "app/globals.css", "next.config.ts"].map((file) => read(dir, file))).toEqual(before);
		expect(formatInitReport(report)).toContain("Skipped (already exist, not overwritten):\n  - cms.config.ts");
	});

	it("--locale·--time-zone은 사이트 기본 언어와 시간대로 적힌다", () => {
		const dir = fakeApp();
		initProject({ cwd: dir, locale: "ko", timeZone: "Asia/Seoul" });
		const config = read(dir, "cms.config.ts");
		expect(config).toContain('locales: [{ code: "ko", name: "한국어" }]');
		expect(config).toContain('defaultLocale: "ko"');
		expect(config).toContain('timeZone: "Asia/Seoul"');

		expect(() => initProject({ cwd: fakeApp(), locale: "Korean" })).toThrow(/--locale/);
		expect(() => initProject({ cwd: fakeApp(), timeZone: "Mars/Base" })).toThrow(/--time-zone/);
	});

	it("관리자 경로를 고르면 라우트 폴더와 사이트 설정이 그 경로를 따른다", () => {
		const dir = fakeApp();
		const report = initProject({ cwd: dir, adminPath: "/cms/studio" });
		expect(report.created).toContain("app/(admin)/cms/studio/[[...path]]/page.tsx");
		expect(report.created).toContain("app/(admin)/cms/studio/layout.tsx");
		expect(read(dir, "cms.config.ts")).toContain('admin: { path: "/cms/studio" }');
		expect(report.todo.at(-1)).toContain("/cms/studio");

		// 설정 파일이 이미 있으면 덮어쓰지 않고 적을 것을 알린다.
		const other = fakeApp({ "cms.config.ts": "export default {};\n" });
		expect(initProject({ cwd: other, adminPath: "/studio" }).todo[0]).toContain('admin: { path: "/studio" }');

		expect(() => initProject({ cwd: dir, adminPath: "/" })).toThrow(/admin-path/);
		expect(() => initProject({ cwd: dir, adminPath: "/api/admin" })).toThrow(/admin-path/);
	});

	it("`src/app` 앱은 설정 파일을 src에 두고, baseUrl이 있으면 그 기준으로 paths를 적는다", () => {
		const dir = fakeApp({
			"tsconfig.json": '{\n\t"compilerOptions": {\n\t\t"baseUrl": "./src"\n\t}\n}\n',
			"app/globals.css": "",
			"src/app/globals.css": '@import "tailwindcss";\n@import "tw-animate-css";\n',
		});
		rmSync(path.join(dir, "app"), { recursive: true });
		const report = initProject({ cwd: dir });
		expect(report.created.slice(0, 3)).toEqual([
			"src/cms.config.ts",
			"src/cms.server.ts",
			"src/app/(admin)/admin/[[...path]]/page.tsx",
		]);
		const tsconfig = read(dir, "tsconfig.json");
		expect(JSON.parse(tsconfig).compilerOptions.paths).toEqual({
			"@cms-config": ["./cms.config.ts"],
			"@cms-server": ["./cms.server.ts"],
		});
		expect(tsconfig).toContain('\n\t"compilerOptions"');
		// 이미 있는 줄(tw-animate-css)은 다시 넣지 않는다.
		const css = read(dir, "src/app/globals.css");
		expect(css.match(/tw-animate-css/g)).toHaveLength(1);
		expect(css).toContain('@import "@monti-cms/admin/styles.css";');
		expect(read(dir, "next.config.ts")).toContain('config: "./src/cms.config.ts", server: "./src/cms.server.ts"');
	});

	it("안전하게 고칠 수 없으면 파일을 그대로 두고 할 일로 알린다", () => {
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
		expect(todo).toContain('@import "@monti-cms/admin/styles.css";');
	});

	it("next 설정이 없으면 만든다. package.json이 없으면 멈춘다", () => {
		const dir = fakeApp();
		rmSync(path.join(dir, "next.config.ts"));
		expect(initProject({ cwd: dir }).created).toContain("next.config.ts");
		expect(read(dir, "next.config.ts")).toContain("withCms(nextConfig");

		rmSync(path.join(dir, "package.json"));
		expect(() => initProject({ cwd: dir })).toThrow(/package.json/);
	});
});
