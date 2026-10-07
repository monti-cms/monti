import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
	addSuppressHydrationWarning,
	addThemeStylesToCss,
	findGlobalCss,
	findRootLayout,
	hasSuppressHydrationWarning,
	setupThemeStyles,
} from "../first-run";

let dirs: string[] = [];
afterEach(() => {
	for (const dir of dirs) rmSync(dir, { recursive: true, force: true });
	dirs = [];
});

function app(files: Record<string, string>): string {
	const dir = mkdtempSync(path.join(tmpdir(), "monti-first-run-"));
	dirs.push(dir);
	for (const [file, content] of Object.entries({ "package.json": "{}", ...files })) {
		mkdirSync(path.dirname(path.join(dir, file)), { recursive: true });
		writeFileSync(path.join(dir, file), content);
	}
	return dir;
}

const read = (dir: string, file: string) => readFileSync(path.join(dir, file), "utf8");
const TAILWIND = '@import "tailwindcss";\n';
const INSTALL = "pnpm add -D @tailwindcss/typography";

describe("suppressHydrationWarning on <html>", () => {
	it("is added after the existing attributes, and left alone when it is there", () => {
		const layout = '<html lang="en">\n<body />\n</html>';
		expect(hasSuppressHydrationWarning(layout)).toBe(false);
		const after = addSuppressHydrationWarning(layout);
		expect(after).toBe('<html lang="en" suppressHydrationWarning>\n<body />\n</html>');
		expect(hasSuppressHydrationWarning(after ?? "")).toBe(true);
		expect(addSuppressHydrationWarning(after ?? "")).toBe(after);
	});

	it("handles a tag with no attributes, several lines and a className expression", () => {
		expect(addSuppressHydrationWarning("<html>")).toBe("<html suppressHydrationWarning>");
		const multi = '<html\n  lang="en"\n  className={`${font.variable} antialiased`}\n>';
		expect(addSuppressHydrationWarning(multi)).toBe(
			'<html\n  lang="en"\n  className={`${font.variable} antialiased`} suppressHydrationWarning\n>',
		);
	});

	it("says nothing about a layout without <html>, and refuses to override a deliberate false", () => {
		expect(hasSuppressHydrationWarning("export default () => null")).toBeUndefined();
		expect(addSuppressHydrationWarning("export default () => null")).toBeUndefined();
		const off = "<html suppressHydrationWarning={false}>";
		expect(hasSuppressHydrationWarning(off)).toBe(false);
		expect(addSuppressHydrationWarning(off)).toBeUndefined();
	});

	it("finds the root layout under app or src/app", () => {
		expect(findRootLayout(app({ "app/layout.tsx": "" }))).toBe("app/layout.tsx");
		expect(findRootLayout(app({ "src/app/layout.jsx": "", "app/layout.tsx": "" }))).toBe("src/app/layout.jsx");
		expect(findRootLayout(app({}))).toBeUndefined();
	});
});

describe("theme styles in the global CSS", () => {
	it("adds the render.css imports and the typography plugin after the last @import", () => {
		const css = '@import "tailwindcss";\n@import "tw-animate-css";\n\n:root {\n  --a: 1;\n}\n';
		expect(addThemeStylesToCss(css, { blocks: true, typography: true })).toBe(
			'@import "tailwindcss";\n@import "tw-animate-css";\n@import "@monti-cms/core/render.css";\n@import "@monti-cms/blocks/render.css";\n@plugin "@tailwindcss/typography";\n\n:root {\n  --a: 1;\n}\n',
		);
	});

	it("leaves out what is there and the blocks line when blocks are not used", () => {
		const css = `${TAILWIND}@import "@monti-cms/core/render.css";\n`;
		expect(addThemeStylesToCss(css, { blocks: false, typography: true })).toBe(
			`${css}@plugin "@tailwindcss/typography";\n`.replace(`render.css";\n@plugin`, `render.css";\n@plugin`),
		);
		const done = `${css}@plugin "@tailwindcss/typography";\n`;
		expect(addThemeStylesToCss(done, { blocks: false, typography: true })).toBe(done);
	});

	it("does not edit a stylesheet that is not Tailwind 4", () => {
		expect(
			addThemeStylesToCss("@tailwind base;\n@tailwind utilities;\n", { blocks: false, typography: true }),
		).toBeUndefined();
	});

	it("finds the stylesheet the root layout imports", () => {
		const dir = app({
			"app/layout.tsx": 'import "./theme.css";\nexport default () => null;',
			"app/theme.css": TAILWIND,
			"app/globals.css": "body {}",
		});
		expect(findGlobalCss(dir)).toBe("app/theme.css");
		expect(findGlobalCss(app({ "src/app/globals.css": TAILWIND }))).toBe("src/app/globals.css");
	});
});

describe("setupThemeStyles", () => {
	const fixture = () =>
		app({ "app/globals.css": TAILWIND, "package.json": '{"dependencies":{"@monti-cms/core":"1"}}' });

	it("asks after showing the diff, edits the CSS and asks for the plugin to be installed", async () => {
		const dir = fixture();
		const notes: string[] = [];
		const result = await setupThemeStyles({
			cwd: dir,
			installCommand: INSTALL,
			prompter: { note: (body) => void notes.push(body), confirm: async () => true },
		});
		expect(read(dir, "app/globals.css")).toBe(
			`${TAILWIND}@import "@monti-cms/core/render.css";\n@plugin "@tailwindcss/typography";\n`,
		);
		expect(result.installDevDependency).toBe("@tailwindcss/typography");
		expect(result.updated).toBe("app/globals.css");
		expect(notes[0]).toContain('+@plugin "@tailwindcss/typography";');
		expect(result.manual).toEqual([]);
	});

	it("prints the exact lines and writes nothing when declined, or when nobody can be asked", async () => {
		const dir = fixture();
		const declined = await setupThemeStyles({
			cwd: dir,
			installCommand: INSTALL,
			prompter: { note: () => undefined, confirm: async () => false },
		});
		const silent = await setupThemeStyles({ cwd: dir, installCommand: INSTALL });
		expect(read(dir, "app/globals.css")).toBe(TAILWIND);
		for (const result of [declined, silent]) {
			expect(result.installDevDependency).toBeUndefined();
			const text = result.manual.join("\n");
			expect(text).toContain(INSTALL);
			expect(text).toContain('@import "@monti-cms/core/render.css";');
			expect(text).toContain('@plugin "@tailwindcss/typography";');
			expect(text).toContain("app/globals.css");
		}
	});

	it("adds the blocks line only when the app uses blocks, and does nothing once everything is there", async () => {
		const dir = app({
			"app/globals.css": TAILWIND,
			"package.json": '{"dependencies":{"@monti-cms/blocks":"1"},"devDependencies":{"@tailwindcss/typography":"1"}}',
		});
		const first = await setupThemeStyles({ cwd: dir, installCommand: INSTALL, yes: true });
		expect(first.installDevDependency).toBeUndefined();
		expect(read(dir, "app/globals.css")).toContain('@import "@monti-cms/blocks/render.css";');
		const again = await setupThemeStyles({ cwd: dir, installCommand: INSTALL, yes: true });
		expect(again).toEqual({ missing: [], manual: [] });
	});

	it("gives the lines to add by hand for a Tailwind 3 stylesheet, and for a missing one", async () => {
		const v3 = app({ "app/globals.css": "@tailwind base;\n" });
		const result = await setupThemeStyles({ cwd: v3, installCommand: INSTALL, yes: true });
		expect(read(v3, "app/globals.css")).toBe("@tailwind base;\n");
		expect(result.manual.join("\n")).toContain('@import "@monti-cms/core/render.css";');
		const none = await setupThemeStyles({ cwd: app({}), installCommand: INSTALL, yes: true });
		expect(none.manual.join("\n")).toContain('@import "tailwindcss"');
	});

	it("shows the change on a dry run and writes nothing", async () => {
		const dir = fixture();
		const result = await setupThemeStyles({ cwd: dir, installCommand: INSTALL, dryRun: true });
		expect(result.diff?.file).toBe("app/globals.css");
		expect(read(dir, "app/globals.css")).toBe(TAILWIND);
	});
});
