// @vitest-environment node
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * M16 CSS 가두기. 관리자 화면 CSS(`styles.css`)와 관리자·확장 화면 클래스는 `cms` 이름표가 붙은 이름만 쓴다.
 * 앱의 이름(shadcn의 `bg-background`·`dark:` 등)을 정하지도, 쓰지도 않는다.
 */
const packagesDir = path.resolve(__dirname, "../../..");
const adminCss = readFileSync(path.resolve(__dirname, "../../styles.css"), "utf8");

const TOKENS = [
	"sidebar-primary-foreground",
	"sidebar-accent-foreground",
	"sidebar-foreground",
	"sidebar-primary",
	"sidebar-accent",
	"sidebar-border",
	"sidebar-ring",
	"sidebar",
	"card-foreground",
	"popover-foreground",
	"primary-foreground",
	"secondary-foreground",
	"muted-foreground",
	"accent-foreground",
	"background",
	"foreground",
	"card",
	"popover",
	"primary",
	"secondary",
	"muted",
	"accent",
	"destructive",
	"warning",
	"border",
	"input",
	"ring",
].join("|");
const UTILITIES =
	"bg|text|border-[xytrblse]|border|ring-offset|ring|outline|fill|stroke|divide|decoration|caret|from|via|to|shadow|accent|placeholder|selection|inset-ring";

function sourceFiles(dir: string): string[] {
	return readdirSync(dir).flatMap((name) => {
		if (["node_modules", "dist", ".next", "__test__", "test"].includes(name)) return [];
		const file = path.join(dir, name);
		if (statSync(file).isDirectory()) return sourceFiles(file);
		return /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) ? [file] : [];
	});
}

describe("관리자 CSS 가두기", () => {
	it("styles.css는 앱의 색 이름·변형을 정하지 않는다", () => {
		const themeNames = [...adminCss.matchAll(/^\s*(--(?:color|radius|shadow|font|spacing)-[\w-]+)\s*:/gm)].map(
			(m) => m[1],
		);
		const colors = themeNames.filter((name) => name.startsWith("--color-"));
		expect(colors.length).toBeGreaterThan(0);
		// `@theme`에는 `--color-cms-*`만 둔다(둥글기·그림자 이름은 theme에 정하지 않는다).
		const theme = adminCss.match(/@theme inline \{([\s\S]*?)\n\}/)?.[1] ?? "";
		for (const name of theme.matchAll(/(--[\w-]+)\s*:/g)) expect(name[1]).toMatch(/^--color-cms-/);
		// 변형 이름도 `cms-`로 시작한다.
		for (const variant of adminCss.matchAll(/@custom-variant\s+([\w-]+)/g)) expect(variant[1]).toMatch(/^cms-/);
		// 어두운 테마는 `.dark`와 `[data-theme="dark"]`를 모두 따른다.
		expect(adminCss).toMatch(/@custom-variant cms-dark[^;]*\.dark[^;]*\[data-theme="dark"\]/);
		expect(adminCss).toMatch(/html:is\(\.dark, \[data-theme="dark"\]\):has\(\.cms-admin\)/);
	});

	it("색 변수는 --cms-* 이름만 정한다", () => {
		const definitions = [...adminCss.matchAll(/^\t(--[\w-]+)\s*:/gm)].map((m) => m[1]);
		const colorVars = definitions.filter((name) => new RegExp(`^--(${TOKENS})$`).test(name));
		expect(colorVars).toEqual([]);
	});

	it("관리자·확장 화면 소스는 앱 이름의 색 클래스와 dark: 변형을 쓰지 않는다", () => {
		const offenders: string[] = [];
		const color = new RegExp(`(?<![\\w-])(?:${UTILITIES})-(?:${TOKENS})(?![\\w-])`, "g");
		const variable = new RegExp(`\\(\\s*--(?:color-)?(?:${TOKENS})(?![\\w-])`, "g");
		const dark = /(?<=[\s"'`:!([])dark:(?=[^\s,])/g;
		const orientation = /(?<![\w-])(?:group-|peer-|in-|has-)*data-(?:horizontal|vertical)(?![\w-[])/g;
		for (const pkg of ["core", "admin", "blocks", "seo", "ai", "bareun"]) {
			const root = path.join(packagesDir, pkg, "src");
			for (const file of sourceFiles(root)) {
				const text = readFileSync(file, "utf8");
				for (const re of [color, variable, dark, orientation]) {
					for (const m of text.matchAll(re)) offenders.push(`${path.relative(packagesDir, file)}: ${m[0]}`);
				}
			}
		}
		expect(offenders).toEqual([]);
	});
});
