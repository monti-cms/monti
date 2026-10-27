// Builds the prebuilt admin stylesheet of a package. Run from a package folder:
// `node ../../scripts/build-styles.mjs [--stdout | --missing]`.
//
// Reads `styles/index.css` (Tailwind 4 input), compiles it with the package's sources, and writes `dist/styles.css`, which the host imports
// as `@monti-cms/<package>/styles.css`. The host needs no Tailwind, typography or tw-animate setup. To keep the file from touching the host:
//
// - Every selector is scoped to a document that contains the admin (`:where(html:has(.monti-admin))`, zero specificity). Popups are portaled
//   to `body`, so the scope is the document, not the `.monti-admin` element. Preflight (Tailwind's reset) is scoped the same way.
// - Custom properties the bundle declares all start with `--monti-` (Tailwind's `--tw-*` become `--monti-tw-*`; its theme is inlined). Variables set
//   at runtime by other libraries (Base UI's `--anchor-width` and so on) are only read, so they keep their names.
// - Keyframes are renamed with a `monti-` prefix.
// - No `@layer` is left (Tailwind's layers are flattened after it has sorted its output): unlayered rules beat the host's layered ones, whatever order
//   the stylesheets load in, so a host's `.hidden`, `.prose` or reset in its own `utilities` or `base` layer cannot override the admin.
// - KaTeX fonts are copied next to the CSS and linked relatively.
// - The admin bundle also ships its own UI fonts (Pretendard, IBM Plex Mono; see `bundledFonts`), so the admin never asks a third-party server for a font.
// - The admin bundle also compiles the sources of the first-party plugins (ai, blocks, mdx, seo, git-sync), so the shared utilities, `prose`, theme and reset
//   exist once. A later file that redefined `.prose` would reset what the admin's dark variant set.
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { pathToFileURL } from "node:url";

/** What every selector in the bundle sits under. `:where()` keeps the specificity of the unscoped rule. */
export const SCOPE = ":where(html:has(.monti-admin))";

/** Splits a selector list at its top-level commas (commas inside `()`, `[]` and strings stay). */
function splitSelectors(selector) {
	const parts = [];
	let depth = 0;
	let quote = "";
	let start = 0;
	for (let i = 0; i < selector.length; i++) {
		const char = selector[i];
		if (quote) {
			if (char === "\\") i++;
			else if (char === quote) quote = "";
		} else if (char === '"' || char === "'") quote = char;
		else if (char === "(" || char === "[") depth++;
		else if (char === ")" || char === "]") depth--;
		else if (char === "," && depth === 0) {
			parts.push(selector.slice(start, i));
			start = i + 1;
		}
	}
	parts.push(selector.slice(start));
	return parts.map((part) => part.trim()).filter(Boolean);
}

/** Puts one selector under the scope. Returns `null` for selectors that cannot apply to a page (`:host`). */
export function scopeSelector(selector) {
	// Already confined to a document that contains the admin (the hand-written rules).
	if (/^(?::where\()?html\b.*?:has\(\.monti-admin\)/.test(selector)) return selector;
	if (/^:host\b/.test(selector)) return null;
	const root = /^(?::root|html)(?![\w-])/.exec(selector);
	if (root) return `${SCOPE}${selector.slice(root[0].length)}`;
	return `${SCOPE} ${selector}`;
}

/** Whether rules inside this at-rule are selectors of the page (not keyframe steps or font descriptors). */
const isPlainContainer = (node) =>
	node.type === "root" ||
	(node.type === "atrule" && ["layer", "media", "supports", "container", "starting-style"].includes(node.name));

/** PostCSS plugin: scopes selectors, prefixes custom properties and keyframes, flattens layers. */
export const confine = () => ({
	postcssPlugin: "monti-confine",
	OnceExit(root) {
		// 1. Custom properties the bundle declares → `--monti-*`.
		const declared = new Set();
		root.walkDecls((decl) => {
			if (decl.prop.startsWith("--")) declared.add(decl.prop);
			// Tailwind's own variables are renamed even where a bundle only reads them (a plugin's `transition-colors` reads `--tw-ease`,
			// which the admin bundle declares).
			for (const name of decl.value.match(/--tw-[\w-]+/g) ?? []) declared.add(name);
		});
		root.walkAtRules("property", (rule) => declared.add(rule.params.trim()));
		const rename = new Map(
			[...declared].filter((name) => !name.startsWith("--monti-")).map((name) => [name, `--monti-${name.slice(2)}`]),
		);
		const renameValue = (value) => value.replace(/--[\w-]+/g, (name) => rename.get(name) ?? name);

		// 2. Keyframes → `monti-*`.
		const keyframes = new Map();
		root.walkAtRules(/keyframes$/, (rule) => {
			if (!rule.params.startsWith("monti-")) keyframes.set(rule.params, `monti-${rule.params}`);
		});

		root.walkDecls((decl) => {
			if (decl.prop.startsWith("--")) decl.prop = rename.get(decl.prop) ?? decl.prop;
			decl.value = renameValue(decl.value);
			if (
				/^(?:-webkit-)?animation(?:-name)?$/.test(decl.prop) ||
				(decl.prop.startsWith("--") && /animation|animate/.test(decl.prop))
			) {
				decl.value = decl.value.replace(/(?<![\w-])[\w-]+(?![\w-])/g, (word) => keyframes.get(word) ?? word);
			}
		});
		root.walkAtRules((rule) => {
			if (rule.name === "property") rule.params = rename.get(rule.params.trim()) ?? rule.params;
			else if (/keyframes$/.test(rule.name)) rule.params = keyframes.get(rule.params) ?? rule.params;
		});

		// 3. Selectors → under the scope.
		root.walkRules((rule) => {
			if (!rule.parent || !isPlainContainer(rule.parent)) return;
			const scoped = splitSelectors(rule.selector)
				.map(scopeSelector)
				.filter((selector) => selector !== null);
			if (scoped.length === 0) rule.remove();
			else rule.selector = scoped.join(", ");
		});

		// 4. Layers → flattened. Tailwind sorts its output by layer, so the order is already right; a layer in the shipped file would rank
		// against the host's own `utilities` layer by which stylesheet loads first, and the host's `.hidden` or `.prose` rules could beat ours.
		// Unlayered rules always beat the host's layered ones; inside the bundle the zero-specificity reset and the utilities keep their order.
		root.walkAtRules("layer", (rule) => {
			if (rule.nodes) rule.replaceWith(rule.nodes);
			else rule.remove();
		});
	},
});
confine.postcss = true;

/** Compiles `<packageDir>/styles/index.css` and confines it. Returns the CSS text (not minified). */
async function compileStyles(packageDir) {
	const require = createRequire(import.meta.url);
	const postcss = require("postcss");
	const tailwind = require("@tailwindcss/postcss");
	const input = path.join(packageDir, "styles", "index.css");
	const result = await postcss([tailwind({ optimize: { minify: false } }), confine()]).process(
		readFileSync(input, "utf8"),
		{ from: input },
	);
	return result.css;
}

/**
 * Builds `<packageDir>/styles/index.css`. Returns the CSS text (minified).
 * @param {string} packageDir
 */
export async function buildStyles(packageDir) {
	const require = createRequire(import.meta.url);
	const { transform } = require("lightningcss");
	const input = path.join(packageDir, "styles", "index.css");
	const css = await compileStyles(packageDir);
	return transform({ filename: input, code: Buffer.from(css), minify: true }).code.toString();
}

/** Class names (unescaped) a stylesheet defines: the first class of every selector. */
function definedClasses(css) {
	const require = createRequire(import.meta.url);
	const postcss = require("postcss");
	const classes = new Set();
	postcss.parse(css).walkRules((rule) => {
		if (rule.parent?.type === "atrule" && /keyframes$/.test(rule.parent.name)) return;
		for (const selector of rule.selectors) {
			for (const match of selector.matchAll(/\.((?:\\.|[\w-])+)/g)) classes.add(match[1].replace(/\\(.)/g, "$1"));
		}
	});
	return classes;
}

/** Candidate class strings in a package's sources: every whitespace- or quote-separated token of its `.ts` and `.tsx` files (tests excluded). */
function sourceTokens(packageDir) {
	const tokens = new Set();
	const walk = (dir) => {
		for (const entry of readdirSync(dir, { withFileTypes: true })) {
			const full = path.join(dir, entry.name);
			if (entry.isDirectory()) {
				if (!["node_modules", "__test__", "test"].includes(entry.name)) walk(full);
			} else if (/\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) {
				for (const token of readFileSync(full, "utf8").split(/[\s"'`]+/)) if (token) tokens.add(token);
			}
		}
	};
	// The admin bundle also compiles the first-party plugins' sources (see `packages/admin/styles/index.css`).
	const packages =
		path.basename(packageDir) === "admin"
			? ["admin", "ai", "blocks", "mdx", "seo", "git-sync"]
			: [path.basename(packageDir)];
	for (const name of packages) walk(path.join(packageDir, "..", name, "src"));
	return [...tokens];
}

/**
 * The utilities Tailwind knows in a package's sources but the built CSS does not define. Empty when the scan reaches every source file.
 * (Tailwind decides what is a utility, so ordinary words and identifiers in the sources are ignored.)
 */
export async function missingUtilities(packageDir, css) {
	const require = createRequire(import.meta.url);
	const { compile } = require("@tailwindcss/node");
	const input = path.join(packageDir, "styles", "index.css");
	const compiler = await compile(readFileSync(input, "utf8"), { base: path.dirname(input), onDependency() {} });
	const expected = definedClasses(compiler.build(sourceTokens(packageDir)));
	const built = definedClasses(css);
	return [...expected].filter((name) => !built.has(name)).sort();
}

/**
 * KaTeX fonts: `url(.../fonts/X.woff2)` becomes `url(./fonts/X.woff2)`, next to the built CSS (the host's bundler resolves them from there).
 * Only the woff2 files are kept (every browser the admin supports reads them). Returns the CSS and the fonts folder to copy (null without KaTeX).
 */
export function localizeFonts(css, packageDir) {
	if (!/@font-face/.test(css)) return { css, fonts: null };
	const require = createRequire(path.join(packageDir, "package.json"));
	const fonts = path.join(path.dirname(require.resolve("katex/package.json")), "dist", "fonts");
	const kept = css
		.replace(/,\s*url\([^)]*\.(?:woff|ttf)["']?\)\s*format\([^)]*\)/g, "")
		.replace(/url\(["']?[^")']*\/fonts\/([^"')/]+\.woff2)["']?\)/g, "url(./fonts/$1)");
	return { css: kept, fonts };
}

/**
 * The admin's own fonts, as `@font-face` rules plus the files to copy next to the built CSS (`dist/fonts/...`, linked relatively like the KaTeX fonts).
 * Pretendard is the variable font in its dynamic subsets (one file per `unicode-range`, so a page only downloads the slices it shows), IBM Plex Mono
 * is the latin subset in 400, 500 and 600. Both are renamed (`Monti Pretendard`, `Monti Plex Mono`) so they never collide with a site's own copy.
 * The fonts are devDependencies of the admin package: only the admin bundle has them, other bundles return `null`.
 *
 * No `ascent-override`, `descent-override` or `line-gap-override` is set: Pretendard's own metrics already center Hangul and Latin in the admin's
 * controls. A font that replaces it must be balanced here, with those descriptors, and never by nudging parts with padding. `pnpm test:visual:audit`
 * reports a control whose text is off center.
 */
export function bundledFonts(packageDir) {
	const require = createRequire(path.join(packageDir, "package.json"));
	let pretendardDir;
	let plexDir;
	try {
		pretendardDir = path.dirname(require.resolve("pretendard/package.json"));
		plexDir = path.dirname(require.resolve("@fontsource/ibm-plex-mono/package.json"));
	} catch {
		return null;
	}
	const licenses = path.join(packageDir, "styles", "fonts");
	const subsets = path.join(pretendardDir, "dist", "web", "variable", "woff2-dynamic-subset");
	const pretendardCss = readFileSync(
		path.join(pretendardDir, "dist", "web", "variable", "pretendardvariable-dynamic-subset.css"),
		"utf8",
	)
		.replace(/\/\*[\s\S]*?\*\//g, "")
		.replace(/\s+/g, " ")
		.replace(/'Pretendard Variable'/g, '"Monti Pretendard"')
		.replace(/url\(\.\/woff2-dynamic-subset\//g, "url(./fonts/pretendard/")
		.replace(/format\('woff2-variations'\)/g, 'format("woff2")')
		.replace(/\} /g, "}\n")
		.trim();
	const latin = JSON.parse(readFileSync(path.join(plexDir, "unicode.json"), "utf8")).latin;
	const plexCss = [400, 500, 600]
		.map(
			(weight) =>
				`@font-face{font-family:"Monti Plex Mono";font-style:normal;font-display:swap;font-weight:${weight};` +
				`src:url(./fonts/ibm-plex-mono/ibm-plex-mono-latin-${weight}-normal.woff2) format("woff2");unicode-range:${latin}}`,
		)
		.join("\n");
	const note =
		"/* Pretendard's metrics already center Hangul and Latin in our controls, so no ascent-override or descent-override is set. A replacement font must be balanced here (ascent-override, descent-override, line-gap-override), not by nudging parts with padding. */";
	return {
		css: `${note}\n${pretendardCss}\n${plexCss}\n`,
		copies: [
			{
				from: subsets,
				to: "fonts/pretendard",
				filter: (file) => !file.endsWith(".woff2") || /subset\.\d+\.woff2$/.test(file),
			},
			...[400, 500, 600].map((weight) => ({
				from: path.join(plexDir, "files", `ibm-plex-mono-latin-${weight}-normal.woff2`),
				to: `fonts/ibm-plex-mono/ibm-plex-mono-latin-${weight}-normal.woff2`,
			})),
			{ from: path.join(licenses, "LICENSE-Pretendard.txt"), to: "fonts/pretendard/LICENSE.txt" },
			{ from: path.join(licenses, "LICENSE-IBM-Plex-Mono.txt"), to: "fonts/ibm-plex-mono/LICENSE.txt" },
		].filter((copy) => existsSync(copy.from)),
	};
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
	const packageDir = process.cwd();
	const fonts = bundledFonts(packageDir);
	const css = (await buildStyles(packageDir)) + (fonts?.css ?? "");
	if (process.argv.includes("--missing")) {
		// Utilities used in the sources that the built CSS lacks (JSON list). The confinement test runs this.
		process.stdout.write(JSON.stringify(await missingUtilities(packageDir, css)));
	} else if (process.argv.includes("--stdout")) {
		process.stdout.write(css);
	} else {
		const { css: finalCss, fonts: katexFonts } = localizeFonts(css, packageDir);
		const dist = path.join(packageDir, "dist");
		mkdirSync(dist, { recursive: true });
		writeFileSync(path.join(dist, "styles.css"), finalCss);
		if (katexFonts)
			cpSync(katexFonts, path.join(dist, "fonts"), { recursive: true, filter: (from) => !/\.(woff|ttf)$/.test(from) });
		for (const copy of fonts?.copies ?? []) {
			mkdirSync(path.dirname(path.join(dist, copy.to)), { recursive: true });
			cpSync(copy.from, path.join(dist, copy.to), { recursive: true, filter: copy.filter });
		}
		console.log(`built ${path.basename(packageDir)} styles: ${(finalCss.length / 1024).toFixed(0)} KB`);
	}
}
