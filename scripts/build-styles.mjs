// Builds the prebuilt admin stylesheet of a package. Run from a package folder:
// `node ../../scripts/build-styles.mjs [--stdout]`.
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
// - The admin bundle ships its own UI fonts (Pretendard, IBM Plex Mono: `packages/ui/.storybook/fonts.ts`, the rules Storybook and the tests use),
//   copied next to the CSS and linked relatively, so the admin never asks a third-party server for a font.
import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
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

/**
 * The admin's own fonts: the `@font-face` rules and the files to copy next to the built CSS (`dist/fonts/...`, linked relatively). The licenses go
 * with them.
 */
async function bundledFonts(packageDir) {
	const { fontDirs, fontFaces } = await import("../packages/ui/.storybook/fonts.ts");
	const licenses = path.join(packageDir, "styles", "fonts");
	return {
		css: fontFaces(),
		copies: [
			// Pretendard's dynamic subsets only: one file per `unicode-range`.
			{
				from: fontDirs.pretendard,
				to: "fonts/pretendard",
				filter: (file) => !file.endsWith(".woff2") || /subset\.\d+\.woff2$/.test(file),
			},
			...[400, 500, 600].map((weight) => ({
				from: path.join(fontDirs.plex, `ibm-plex-mono-latin-${weight}-normal.woff2`),
				to: `fonts/ibm-plex-mono/ibm-plex-mono-latin-${weight}-normal.woff2`,
			})),
			{ from: path.join(licenses, "LICENSE-Pretendard.txt"), to: "fonts/pretendard/LICENSE.txt" },
			{ from: path.join(licenses, "LICENSE-IBM-Plex-Mono.txt"), to: "fonts/ibm-plex-mono/LICENSE.txt" },
		],
	};
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
	const packageDir = process.cwd();
	const css = await buildStyles(packageDir);
	if (process.argv.includes("--stdout")) {
		process.stdout.write(css);
	} else {
		const fonts = await bundledFonts(packageDir);
		const dist = path.join(packageDir, "dist");
		mkdirSync(dist, { recursive: true });
		writeFileSync(path.join(dist, "styles.css"), css + fonts.css);
		for (const copy of fonts.copies) {
			if (!existsSync(copy.from)) throw new Error(`build-styles: ${copy.from} is not there`);
			mkdirSync(path.dirname(path.join(dist, copy.to)), { recursive: true });
			cpSync(copy.from, path.join(dist, copy.to), { recursive: true, filter: copy.filter });
		}
		console.log(`built ${path.basename(packageDir)} styles: ${(css.length / 1024).toFixed(0)} KB`);
	}
}
