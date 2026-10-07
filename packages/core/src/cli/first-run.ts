import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { parseJsonc } from "./config-paths";
import { unifiedDiff } from "./diff";
import type { Prompter } from "./init-prompts";

/**
 * First-run fixes that `monti init` and `monti add` make to files the app owns, and the checks behind them (`monti doctor` can call the same functions):
 *
 * - the root layout's `<html>` needs `suppressHydrationWarning`, because the admin's theme provider puts its theme class and `color-scheme` on `<html>` before React hydrates;
 * - the public theme pages need `@tailwindcss/typography` (the `prose` classes) and the `render.css` imports (code highlighting and block styles) in the app's global CSS.
 */

const ROOT_LAYOUT_NAMES = ["layout.tsx", "layout.jsx", "layout.ts", "layout.js"];

/** The root layout of the App Router (relative to `cwd`, with `/`), or `undefined` when there is none. */
export function findRootLayout(cwd: string): string | undefined {
	const folders = existsSync(path.join(cwd, "src/app")) ? ["src/app"] : ["app", "src/app"];
	for (const folder of folders)
		for (const name of ROOT_LAYOUT_NAMES) if (existsSync(path.join(cwd, folder, name))) return `${folder}/${name}`;
	return undefined;
}

/** The opening `<html ...>` tag of a layout's text: where it starts, the attributes, and what closes it (`>` or `/>`). */
const HTML_TAG = /<html\b([^>]*?)(\s*)(\/?)>/;

/** Whether the `<html>` tag of a layout has `suppressHydrationWarning` (set, not `={false}`); `undefined` when the text has no `<html>` tag (a nested layout). */
export function hasSuppressHydrationWarning(text: string): boolean | undefined {
	const match = HTML_TAG.exec(text);
	if (!match) return undefined;
	const attributes = match[1] ?? "";
	return /\bsuppressHydrationWarning\b(?!\s*=\s*\{\s*false\s*\})/.test(attributes);
}

/**
 * The layout text with `suppressHydrationWarning` added to `<html>`. Returns the text itself when it is already there, and `undefined` when the edit is not
 * safe to make (no `<html>` tag, or `suppressHydrationWarning={false}` set on purpose).
 */
export function addSuppressHydrationWarning(text: string): string | undefined {
	const match = HTML_TAG.exec(text);
	if (!match) return undefined;
	if (/\bsuppressHydrationWarning\b/.test(match[1] ?? "")) return hasSuppressHydrationWarning(text) ? text : undefined;
	const at = match.index + "<html".length + (match[1] ?? "").length;
	return `${text.slice(0, at)} suppressHydrationWarning${text.slice(at)}`;
}

// ---- Theme styles ----

const TYPOGRAPHY_PACKAGE = "@tailwindcss/typography";
const TYPOGRAPHY_PLUGIN_LINE = `@plugin "${TYPOGRAPHY_PACKAGE}";`;
const CORE_RENDER_LINE = '@import "@monti-cms/core/render.css";';
const BLOCKS_RENDER_LINE = '@import "@monti-cms/blocks/render.css";';

const CSS_CANDIDATES = [
	"app/globals.css",
	"src/app/globals.css",
	"app/global.css",
	"src/app/global.css",
	"styles/globals.css",
	"src/styles/globals.css",
];
const IMPORTS_TAILWIND_V4 = /@import\s+["']tailwindcss(?:\/[^"']*)?["']/;

/** The global CSS file that loads Tailwind: the stylesheet the root layout imports, else a conventional name. Relative to `cwd`, with `/`. */
export function findGlobalCss(cwd: string): string | undefined {
	const read = (file: string) => (existsSync(path.join(cwd, file)) ? readFileSync(path.join(cwd, file), "utf8") : "");
	const candidates: string[] = [];
	const layout = findRootLayout(cwd);
	if (layout) {
		for (const match of read(layout).matchAll(/import\s+["']([^"']+\.css)["']/g)) {
			const from = match[1] ?? "";
			if (from.startsWith("."))
				candidates.push(path.posix.normalize(path.posix.join(path.posix.dirname(layout), from)));
			else if (from.startsWith("@/")) candidates.push(`src/${from.slice(2)}`, from.slice(2));
		}
	}
	candidates.push(...CSS_CANDIDATES);
	const found = candidates.filter((file) => existsSync(path.join(cwd, file)));
	return found.find((file) => /tailwindcss/.test(read(file))) ?? found[0];
}

/** Whether the app uses the blocks package (listed in `package.json`, or imported by `monti.config.ts`). */
export function usesBlocks(cwd: string): boolean {
	const pkg = parseJsonc(readFileSync(path.join(cwd, "package.json"), "utf8")) as
		| { dependencies?: object; devDependencies?: object }
		| undefined;
	if (pkg && "@monti-cms/blocks" in { ...pkg.dependencies, ...pkg.devDependencies }) return true;
	return ["monti.config.ts", "src/monti.config.ts"].some(
		(file) =>
			existsSync(path.join(cwd, file)) && readFileSync(path.join(cwd, file), "utf8").includes("@monti-cms/blocks"),
	);
}

/** The CSS text with the lines added after its last top-level `@import` (imports must stay ahead of the other rules). `undefined` when it does not load Tailwind v4. */
export function addThemeStylesToCss(
	css: string,
	options: { readonly blocks: boolean; readonly typography: boolean },
): string | undefined {
	if (!IMPORTS_TAILWIND_V4.test(css)) return undefined;
	const add = [
		...(css.includes("@monti-cms/core/render.css") ? [] : [CORE_RENDER_LINE]),
		...(options.blocks && !css.includes("@monti-cms/blocks/render.css") ? [BLOCKS_RENDER_LINE] : []),
		...(options.typography && !css.includes(TYPOGRAPHY_PACKAGE) ? [TYPOGRAPHY_PLUGIN_LINE] : []),
	];
	if (add.length === 0) return css;
	const imports = [...css.matchAll(/^@import\b[^\n]*;[ \t]*$/gm)];
	const last = imports.at(-1);
	if (!last) return undefined;
	const at = last.index + last[0].length;
	return `${css.slice(0, at)}\n${add.join("\n")}${css.slice(at)}`;
}

export interface ThemeStylesOptions {
	readonly cwd: string;
	/** The blocks package is used, so its `render.css` is wanted too. Default: looked up with {@link usesBlocks}. */
	readonly blocks?: boolean;
	/** The command that installs the typography plugin as a dev dependency, for the lines printed when the person declines. */
	readonly installCommand: string;
	/** Asked to confirm the change, after its diff is shown. Without it the change is made only when `yes` is set. */
	readonly prompter?: Pick<Prompter, "note" | "confirm">;
	/** Make the change without asking (`--yes`, or a run with no prompts at all). */
	readonly yes?: boolean;
	/** Report the change, write nothing. */
	readonly dryRun?: boolean;
}

export interface ThemeStylesResult {
	/** What is missing, as the exact lines to add; empty when the app is set up. */
	readonly missing: readonly string[];
	/** The CSS file that was changed (or would be, on a dry run). */
	readonly updated?: string;
	readonly diff?: { readonly file: string; readonly diff: string };
	/** The dev dependency to install (the plugin is not in `package.json`), when the change was accepted. */
	readonly installDevDependency?: string;
	/** What the person has to do by hand, with the exact lines. */
	readonly manual: readonly string[];
}

/**
 * Checks that the app can style the theme pages: `@tailwindcss/typography` in `package.json` and loaded by the global CSS, and the `render.css` imports
 * (core, and blocks when used). Shows the change to the CSS file as a diff and asks before making it; when declined, or when the CSS is not the Tailwind 4 shape
 * it can edit, it returns the exact lines to add by hand.
 */
export async function setupThemeStyles(options: ThemeStylesOptions): Promise<ThemeStylesResult> {
	const { cwd } = options;
	const pkg = parseJsonc(readFileSync(path.join(cwd, "package.json"), "utf8")) as
		| { dependencies?: object; devDependencies?: object }
		| undefined;
	const hasTypographyPackage = TYPOGRAPHY_PACKAGE in { ...pkg?.dependencies, ...pkg?.devDependencies };
	const blocks = options.blocks ?? usesBlocks(cwd);
	const cssFile = findGlobalCss(cwd);
	const css = cssFile ? readFileSync(path.join(cwd, cssFile), "utf8") : undefined;

	const missingLines = [
		...(css?.includes("@monti-cms/core/render.css") ? [] : [CORE_RENDER_LINE]),
		...(blocks && !css?.includes("@monti-cms/blocks/render.css") ? [BLOCKS_RENDER_LINE] : []),
		...(css?.includes(TYPOGRAPHY_PACKAGE) ? [] : [TYPOGRAPHY_PLUGIN_LINE]),
	];
	if (missingLines.length === 0 && hasTypographyPackage) return { missing: [], manual: [] };

	const where = cssFile ?? 'your global CSS (the file that has @import "tailwindcss";)';
	const manualFor = (lines: readonly string[], install: boolean) => {
		const out: string[] = [];
		if (install)
			out.push(
				`Install the typography plugin (the theme styles its text with the prose classes): ${options.installCommand}`,
			);
		if (lines.length > 0)
			out.push(
				`Add these lines to ${where}, after the @import "tailwindcss"; line:\n${lines.map((line) => `  ${line}`).join("\n")}`,
			);
		return out;
	};

	const after = css === undefined ? undefined : addThemeStylesToCss(css, { blocks, typography: true });
	const editable = cssFile !== undefined && css !== undefined && after !== undefined && after !== css;
	const diff = editable ? { file: cssFile, diff: unifiedDiff(cssFile, css, after) } : undefined;

	if (options.dryRun) {
		return {
			missing: missingLines,
			updated: editable ? cssFile : undefined,
			diff,
			manual: editable ? [] : manualFor(missingLines, !hasTypographyPackage),
		};
	}
	let accept = options.yes === true;
	if (!accept && options.prompter) {
		options.prompter.note(
			diff ? diff.diff : manualFor(missingLines, !hasTypographyPackage).join("\n"),
			diff ? `Change to ${cssFile}` : "Styles for the theme pages",
		);
		accept = await options.prompter.confirm({
			message: editable
				? `Add these to ${cssFile}${hasTypographyPackage ? "" : ` and install ${TYPOGRAPHY_PACKAGE}`}?`
				: `Install ${TYPOGRAPHY_PACKAGE}? (the CSS lines have to be added by hand)`,
			initial: true,
		});
	}
	if (!accept) return { missing: missingLines, manual: manualFor(missingLines, !hasTypographyPackage) };
	if (editable && css !== undefined && after !== undefined) writeFileSync(path.join(cwd, cssFile), after);
	return {
		missing: missingLines,
		updated: editable ? cssFile : undefined,
		diff,
		installDevDependency: hasTypographyPackage ? undefined : TYPOGRAPHY_PACKAGE,
		manual: editable ? [] : manualFor(missingLines, false),
	};
}
