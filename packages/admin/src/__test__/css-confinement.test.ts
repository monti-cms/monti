// @vitest-environment node
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * CSS confinement. The admin CSS (`styles.css`) and the admin/extension screen classes only use names carrying the `cms` prefix.
 * They neither define nor use the app's own names (shadcn's `bg-background`, `dark:`, etc.).
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

describe("admin CSS confinement", () => {
	it("styles.css does not define the app's color names or variants", () => {
		const themeNames = [...adminCss.matchAll(/^\s*(--(?:color|radius|shadow|font|spacing)-[\w-]+)\s*:/gm)].map(
			(m) => m[1],
		);
		const colors = themeNames.filter((name) => name.startsWith("--color-"));
		expect(colors.length).toBeGreaterThan(0);
		// `@theme` holds only `--color-cms-*` (radius and shadow names are not defined in the theme).
		const theme = adminCss.match(/@theme inline \{([\s\S]*?)\n\}/)?.[1] ?? "";
		for (const name of theme.matchAll(/(--[\w-]+)\s*:/g)) expect(name[1]).toMatch(/^--color-cms-/);
		// Variant names also start with `cms-`.
		for (const variant of adminCss.matchAll(/@custom-variant\s+([\w-]+)/g)) expect(variant[1]).toMatch(/^cms-/);
		// The dark theme follows both `.dark` and `[data-theme="dark"]`.
		expect(adminCss).toMatch(/@custom-variant cms-dark[^;]*\.dark[^;]*\[data-theme="dark"\]/);
		expect(adminCss).toMatch(/html:is\(\.dark, \[data-theme="dark"\]\):has\(\.cms-admin\)/);
	});

	it("color variables only define --cms-* names", () => {
		const definitions = [...adminCss.matchAll(/^\t(--[\w-]+)\s*:/gm)].map((m) => m[1]);
		const colorVars = definitions.filter((name) => new RegExp(`^--(${TOKENS})$`).test(name));
		expect(colorVars).toEqual([]);
	});

	it("admin and extension screen sources use no app-named color classes or dark: variants", () => {
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
