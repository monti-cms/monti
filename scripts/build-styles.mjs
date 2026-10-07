// Builds the prebuilt admin stylesheet of a package. Run from a package folder:
// `node ../../scripts/build-styles.mjs [--stdout]`.
//
// Reads `styles/index.css` (Tailwind 4 input), compiles it with the package's sources, and writes `dist/styles.css`, which the host imports
// as `@monti-cms/<package>/styles.css`. The host needs no Tailwind, typography or tw-animate setup. To keep the file from touching the host:
//
// - Every selector is scoped to a document that contains the admin (`:where(html:has(.cms-admin))`, zero specificity). Popups are portaled
//   to `body`, so the scope is the document, not the `.cms-admin` element. Preflight (Tailwind's reset) is scoped the same way.
// - Custom properties the bundle declares all start with `--cms-` (Tailwind's `--tw-*` become `--cms-tw-*`; its theme is inlined). Variables set
//   at runtime by other libraries (Base UI's `--anchor-width` and so on) are only read, so they keep their names.
// - Keyframes are renamed with a `cms-` prefix.
// - Layers live under one `cms` layer (`cms.theme`, `cms.base`, ...), so they never merge with the host's `theme`, `base` or `utilities`.
// - KaTeX fonts are copied next to the CSS and linked relatively.
import { cpSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { pathToFileURL } from "node:url";

/** What every selector in the bundle sits under. `:where()` keeps the specificity of the unscoped rule. */
export const SCOPE = ":where(html:has(.cms-admin))";
const LAYERS = new Set(["properties", "theme", "base", "components", "utilities"]);

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
	if (/^(?::where\()?html\b.*?:has\(\.cms-admin\)/.test(selector)) return selector;
	if (/^:host\b/.test(selector)) return null;
	const root = /^(?::root|html)(?![\w-])/.exec(selector);
	if (root) return `${SCOPE}${selector.slice(root[0].length)}`;
	return `${SCOPE} ${selector}`;
}

/** Whether rules inside this at-rule are selectors of the page (not keyframe steps or font descriptors). */
const isPlainContainer = (node) =>
	node.type === "root" ||
	(node.type === "atrule" && ["layer", "media", "supports", "container", "starting-style"].includes(node.name));

/** PostCSS plugin: scopes selectors, prefixes custom properties, keyframes and layers. */
export const confine = () => ({
	postcssPlugin: "monti-confine",
	OnceExit(root) {
		// 1. Custom properties the bundle declares → `--cms-*`.
		const declared = new Set();
		root.walkDecls((decl) => {
			if (decl.prop.startsWith("--")) declared.add(decl.prop);
		});
		root.walkAtRules("property", (rule) => declared.add(rule.params.trim()));
		const rename = new Map(
			[...declared].filter((name) => !name.startsWith("--cms-")).map((name) => [name, `--cms-${name.slice(2)}`]),
		);
		const renameValue = (value) => value.replace(/--[\w-]+/g, (name) => rename.get(name) ?? name);

		// 2. Keyframes → `cms-*`.
		const keyframes = new Map();
		root.walkAtRules(/keyframes$/, (rule) => {
			if (!rule.params.startsWith("cms-")) keyframes.set(rule.params, `cms-${rule.params}`);
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
			else if (rule.name === "layer" && rule.params) {
				rule.params = rule.params
					.split(",")
					.map((name) => (LAYERS.has(name.trim()) ? `cms.${name.trim()}` : name.trim()))
					.join(", ");
			}
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
	},
});
confine.postcss = true;

/**
 * Compiles `<packageDir>/styles/index.css`. Returns the CSS text (minified).
 * @param {string} packageDir
 */
export async function buildStyles(packageDir) {
	const require = createRequire(import.meta.url);
	const postcss = require("postcss");
	const tailwind = require("@tailwindcss/postcss");
	const { transform } = require("lightningcss");
	const input = path.join(packageDir, "styles", "index.css");
	const result = await postcss([tailwind({ optimize: { minify: false } }), confine()]).process(
		readFileSync(input, "utf8"),
		{
			from: input,
		},
	);
	return transform({ filename: input, code: Buffer.from(result.css), minify: true }).code.toString();
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

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
	const packageDir = process.cwd();
	const css = await buildStyles(packageDir);
	if (process.argv.includes("--stdout")) {
		process.stdout.write(css);
	} else {
		const { css: finalCss, fonts } = localizeFonts(css, packageDir);
		const dist = path.join(packageDir, "dist");
		mkdirSync(dist, { recursive: true });
		writeFileSync(path.join(dist, "styles.css"), finalCss);
		if (fonts)
			cpSync(fonts, path.join(dist, "fonts"), { recursive: true, filter: (from) => !/\.(woff|ttf)$/.test(from) });
		console.log(`built ${path.basename(packageDir)} styles: ${(finalCss.length / 1024).toFixed(0)} KB`);
	}
}
