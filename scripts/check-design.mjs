#!/usr/bin/env node
/**
 * Admin design system guard. Admin UI is styled with the token utilities of `@monti-cms/ui` (`packages/ui/styles/theme.css`) and built from the parts
 * of `@monti-cms/ui`; one-off CSS, raw pixel sizes and parts built inside a screen fragment the design, so they fail CI.
 *
 *   node scripts/check-design.mjs                                     # list every finding; fails if any
 *   node scripts/check-design.mjs packages/admin/src/screens/media    # only part of the tree
 *
 * Checked: `packages/ui/src`, `packages/admin/src`, the `.tsx` files of `packages/ai/src` and `packages/seo/src`, and `packages/mdx/src/admin` (they render
 * inside the admin). Not checked: tests (`__test__`, `*.test.*`, `src/test`), Storybook stories (`*.stories.*`, `foundations`), site rendering
 * (`packages/blocks`, `packages/core/render.css`) and `examples/`. The last three rules below name their own files.
 *
 * Rules (each finding names its rule id):
 *   css-file            Admin styling lives in token utilities. The only stylesheets in `packages/ui` and `packages/admin` are `ui/styles/theme.css`,
 *                       `ui/styles/tokens.css` (generated), `admin/styles/index.css` and `admin/styles/admin.css` (`ui/.storybook` is exempt). A
 *                       `.ts`/`.tsx` that imports any other CSS file fails too.
 *   admin-css-rule      `admin/styles/admin.css` holds document-wide base rules only (the body, the border default, `.monti-admin`, the scrollbar).
 *                       Any other selector moves to token utilities on the element.
 *   arbitrary-value     A class with a raw color in brackets (`bg-[#fff]`, `[color:red]`, `color-mix(... white)`) fails everywhere. Outside `packages/ui`
 *                       a raw length (`w-[34px]`, `p-[0.5rem]`, `calc(100%-2rem)`) fails too: the parts of `@monti-cms/ui` keep the design system's
 *                       measured sizes. Allowed: values made of tokens (`var(--monti-...)`, `calc()` of tokens), `%`, `fr`, `auto`, Tailwind's
 *                       own size numbers (`min-h-10`), and selector variants (`[&>svg]:`, `data-[state=open]:`).
 *   raw-palette         Tailwind's palette or default sizes (`bg-red-500`, `text-white`, `text-sm`) instead of tokens (`bg-monti-danger`, `text-monti-body`).
 *   inline-style        `style={...}` in a screen. In `packages/ui/src` only a style object with a literal px or color value fails (use a utility).
 *   part-in-screen      A screen (everything outside `packages/ui`) must not build styled primitives: no import of the libraries `@monti-cms/ui` is built
 *                       on (Base UI, Radix, `class-variance-authority`, `cmdk`, `sonner`, ...), no `cva(`, and no `@monti-cms/ui/internal` (the open
 *                       parts with `className`) unless the file says why. Add the part to `@monti-cms/ui`.
 *   undocumented-part   Every component exported from `packages/ui/src/index.ts` is named in backticks in `docs/design/admin/components/*.md`.
 *   drawing-only        A screen of a package the admin stylesheet compiles (its `@source` lines: admin, ai, blocks, mdx, seo; not `ui`,
 *                       `admin/src/ui`, stories or the blocks' `render.tsx`) sets no `className` or `style`, and imports neither
 *                       `@monti-cms/ui/internal` nor a class helper (`cn`, `*Variants`), unless it is in `DRAWING` with its reason. A
 *                       `DRAWING` entry that no longer exists or draws fails too. A `design-allow` marker does not skip this rule.
 *   app-color           No class or variable of the host app's color names (`bg-background`, `--muted-foreground`), no `dark:` variant and no
 *                       `data-horizontal` variant in the sources of core, admin, blocks, mdx, seo and ai.
 *   theme-names         `ui/styles/theme.css` clears Tailwind's names and defines only `monti` ones that read `--monti-*` variables, its variants
 *                       are `monti-` (the dark one follows `.dark` and `[data-theme="dark"]`), and `ui/styles/tokens.css` and `admin/styles/admin.css`
 *                       declare only `--monti-*` variables, none named like the host app's colors.
 *   off-system          Every class word in the admin UI packages (stories and test helpers too) is in the design system: a known role per
 *                       namespace, the weights, radius and shadows it keeps, no line height or letter spacing of its own, and on screens the
 *                       spacing scale. The roles are read from `packages/ui/styles/theme.css`; `OWN_TYPE` and `OWN_COLORS` name the exceptions.
 *   design-allow        A `design-allow` marker without a reason.
 *
 * A value that is measured or computed at runtime (a position under the pointer, a width the user dragged) ends its line with
 * `// design-allow: reason`, or `{/* design-allow: reason *\/}` in JSX (alone on its line, it skips the next line). In a CSS file,
 * `/* design-allow: reason *\/` on the line before a rule skips that rule. A marker is not for a style choice, and an empty reason fails.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const rel = (file) => path.relative(root, file).split(path.sep).join("/");
const targets = process.argv.slice(2).map((target) => path.resolve(target));

/** Source trees the admin UI is built from. `ui` is the design system itself, `screen` is everything that composes it. */
const SOURCES = [
	{ dir: "packages/ui/src", ext: /\.tsx?$/, kind: "ui" },
	{ dir: "packages/admin/src", ext: /\.tsx?$/, kind: "screen" },
	{ dir: "packages/ai/src", ext: /\.tsx$/, kind: "screen" },
	{ dir: "packages/seo/src", ext: /\.tsx$/, kind: "screen" },
	{ dir: "packages/mdx/src/admin", ext: /\.tsx$/, kind: "screen" },
];
const SKIP_DIRS = new Set(["__test__", "node_modules", "dist", "test", "foundations"]);
const isSkippedFile = (name) =>
	/\.(test|stories)\.tsx?$/.test(name) || name.endsWith(".d.ts") || name === "tokens.generated.ts";

const ALLOWED_CSS = new Set([
	"packages/ui/styles/theme.css",
	"packages/ui/styles/tokens.css",
	"packages/admin/styles/index.css",
	"packages/admin/styles/admin.css",
]);
/** Package specifiers that stand for the allowed files above. */
const ALLOWED_CSS_SPECIFIERS = new Set(["@monti-cms/ui/theme.css", "@monti-cms/ui/tokens.css"]);
const CSS_ROOTS = ["packages/ui", "packages/admin"];
const CSS_SKIP_DIRS = new Set(["node_modules", "dist", ".storybook", "storybook-static", ".turbo", "test-results"]);

/** The document-wide rules of `admin.css`: selector → the `@layer` it must sit in (`null` for none). */
const ADMIN_CSS_FILE = "packages/admin/styles/admin.css";
const ADMIN_CSS_SELECTORS = new Map([
	["html:has(.monti-admin) body", null],
	[":where(html:has(.monti-admin)) *", "base"],
	[".monti-admin", null],
	[".monti-admin *", null],
	[".monti-admin *:hover", null],
	[".monti-admin ::-webkit-scrollbar", null],
	[".monti-admin ::-webkit-scrollbar-track", null],
	[".monti-admin ::-webkit-scrollbar-thumb", null],
	[".monti-admin *:hover::-webkit-scrollbar-thumb", null],
]);

/** What `@monti-cms/ui` is built on: a screen reaches these only through its parts. (`react-day-picker/locale` is date data, not a part.) */
const PART_LIBRARIES =
	/^(?:@radix-ui\/.+|@base-ui(?:-components)?(?:\/.+)?|class-variance-authority|cva|vaul|cmdk|sonner|clsx|tailwind-merge|react-day-picker)$/;

const PALETTE =
	"slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|black|white";
const PALETTE_CLASS = new RegExp(
	`^-?(?:bg|text|border(?:-[trblxyse])?|ring|fill|stroke|outline|decoration|divide|from|to|via|shadow)-(?:${PALETTE})(?:-\\d+)?(?:/[\\w.[\\]%-]+)?$`,
);
const TEXT_SIZE_CLASS = /^text-(?:xs|sm|base|lg|xl|\dxl)(?:\/[\w.[\]-]+)?$/;

/** A raw length (`px`, `rem`, `em`, `ch`, `pt`) or a raw color. Percentages, `fr`, `auto`, `var()` and viewport units pass. */
const RAW_LENGTH = /(?<![\w.#-])-?(?:\d+\.?\d*|\.\d+)(?:px|rem|em|ch|pt)\b/;
const NAMED_COLORS =
	"white|black|red|green|blue|yellow|orange|purple|pink|gray|grey|brown|cyan|magenta|navy|teal|lime|maroon|olive|silver|gold|indigo|violet|crimson|coral|salmon|tomato";
const RAW_COLOR = new RegExp(
	`#[0-9a-fA-F]{3,8}\\b|\\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch)\\(|(?<![\\w-])(?:${NAMED_COLORS})(?![\\w-])`,
);
const UNITLESS_STYLE_KEYS = new Set([
	"opacity",
	"zIndex",
	"flex",
	"flexGrow",
	"flexShrink",
	"order",
	"lineHeight",
	"fontWeight",
	"zoom",
	"scale",
	"aspectRatio",
	"gridColumn",
	"gridRow",
	"columnCount",
	"WebkitLineClamp",
	"lineClamp",
]);

const files = [];
const walk = (dir, ext, kind) => {
	for (const name of readdirSync(dir)) {
		const full = path.join(dir, name);
		if (statSync(full).isDirectory()) {
			if (!SKIP_DIRS.has(name)) walk(full, ext, kind);
		} else if (ext.test(name) && !isSkippedFile(name)) {
			files.push({ file: full, kind });
		}
	}
};
for (const { dir, ext, kind } of SOURCES) walk(path.join(root, dir), ext, kind);

/** Whether a path is one of the paths given on the command line, or under one (everything when none is given). */
const inTargets = (file) =>
	targets.length === 0 || targets.some((target) => file === target || file.startsWith(`${target}${path.sep}`));
/** Whether a command-line path is this one, or above it (so it covers a check that reads this path as a whole). */
const covers = (file) =>
	targets.length === 0 || targets.some((target) => file === target || file.startsWith(`${target}${path.sep}`));

const findings = [];
const add = (file, line, rule, message) => findings.push({ file: rel(file), line, rule, message });

/**
 * Lexes TypeScript/TSX well enough to find strings and comments: string literals (the segments of a template literal separately), comments,
 * the source with comments blanked (`blanked`) and the same with string contents blanked too (`masked`), so offsets and line numbers stay the same.
 * A quoted string that does not close on its line is not a string (an apostrophe in JSX text).
 */
function lex(source) {
	const strings = [];
	const comments = [];
	const blanked = source.split("");
	const n = source.length;
	const lineStarts = [0];
	for (let index = 0; index < n; index += 1) if (source[index] === "\n") lineStarts.push(index + 1);
	const lineAt = (offset) => {
		let low = 0;
		let high = lineStarts.length - 1;
		while (low < high) {
			const mid = Math.ceil((low + high) / 2);
			if (lineStarts[mid] <= offset) low = mid;
			else high = mid - 1;
		}
		return low + 1;
	};
	const collect = (from, to) => {
		let offset = from;
		for (const part of source.slice(from, to).split("\n")) {
			comments.push({ line: lineAt(offset), text: part });
			offset += part.length + 1;
		}
		for (let k = from; k < to; k += 1) if (blanked[k] !== "\n") blanked[k] = " ";
	};

	let i = 0;
	let tail = "";
	const push = (text) => {
		tail = (tail + text).slice(-30);
	};
	const REGEX_BEFORE = /(?:^|[(,=:[!&|?{};+\-*%>~^]|\b(?:return|typeof|case|void|throw))\s*$/;

	function scanTemplate() {
		let segment = i;
		while (i < n) {
			const char = source[i];
			if (char === "\\") {
				i += 2;
			} else if (char === "`") {
				strings.push({ start: segment, end: i });
				i += 1;
				push('"');
				return;
			} else if (char === "$" && source[i + 1] === "{") {
				strings.push({ start: segment, end: i });
				i += 2;
				scanCode(true);
				segment = i;
			} else {
				i += 1;
			}
		}
		strings.push({ start: segment, end: i });
	}

	function scanCode(untilBrace) {
		let depth = 0;
		while (i < n) {
			const char = source[i];
			const next = source[i + 1];
			if (char === "/" && next === "/") {
				const end = source.indexOf("\n", i);
				const stop = end === -1 ? n : end;
				collect(i, stop);
				i = stop;
				continue;
			}
			if (char === "/" && next === "*") {
				const end = source.indexOf("*/", i + 2);
				const stop = end === -1 ? n : end + 2;
				collect(i, stop);
				i = stop;
				continue;
			}
			if (char === '"' || char === "'") {
				let j = i + 1;
				while (j < n && source[j] !== char && source[j] !== "\n") j += source[j] === "\\" ? 2 : 1;
				if (source[j] === char) {
					strings.push({ start: i + 1, end: j });
					i = j + 1;
					push('"');
				} else {
					i += 1;
				}
				continue;
			}
			if (char === "`") {
				i += 1;
				scanTemplate();
				continue;
			}
			if (char === "/" && REGEX_BEFORE.test(tail)) {
				let j = i + 1;
				let inClass = false;
				while (j < n && source[j] !== "\n") {
					if (source[j] === "\\") j += 1;
					else if (source[j] === "[") inClass = true;
					else if (source[j] === "]") inClass = false;
					else if (source[j] === "/" && !inClass) break;
					j += 1;
				}
				if (source[j] === "/") {
					push("/re/");
					i = j + 1;
					continue;
				}
			}
			if (char === "{") depth += 1;
			if (char === "}") {
				if (untilBrace && depth === 0) {
					i += 1;
					return;
				}
				depth -= 1;
			}
			if (!/\s/.test(char)) push(char);
			i += 1;
		}
	}
	scanCode(false);

	const masked = [...blanked];
	for (const { start, end } of strings) for (let k = start; k < end; k += 1) if (masked[k] !== "\n") masked[k] = "x";
	return { strings, comments, blanked: blanked.join(""), masked: masked.join(""), lineAt };
}

/** The lines a `design-allow` marker skips; a marker with no reason is a finding. */
function allowedLines(file, { comments, blanked }) {
	const blankedLines = blanked.split("\n");
	const allowed = new Set();
	for (const { line, text } of comments) {
		const marker = /design-allow:(.*)$/.exec(text);
		if (!marker) continue;
		const reason = marker[1].replace(/\*\/\s*$/, "").trim();
		if (!reason) {
			add(
				file,
				line,
				"design-allow",
				"a design-allow marker needs a reason (`// design-allow: why the value is measured at runtime`)",
			);
			continue;
		}
		allowed.add(line);
		// A marker alone on its line (a comment line in a JSX tag, or `{/* */}`) also skips the next line of code.
		if ((blankedLines[line - 1] ?? "").replace(/[\s{}]/g, "") !== "") continue;
		for (let next = line + 1; next <= blankedLines.length; next += 1) {
			allowed.add(next);
			if (blankedLines[next - 1].replace(/[\s{}]/g, "") !== "") break;
		}
	}
	return allowed;
}

/** Splits at `separator` outside brackets and parentheses. */
function splitTop(text, separator) {
	const parts = [];
	let depth = 0;
	let from = 0;
	for (let k = 0; k < text.length; k += 1) {
		const char = text[k];
		if (char === "[" || char === "(") depth += 1;
		else if (char === "]" || char === ")") depth -= 1;
		else if (char === separator && depth === 0) {
			parts.push({ text: text.slice(from, k), offset: from });
			from = k + 1;
		}
	}
	parts.push({ text: text.slice(from), offset: from });
	return parts;
}

/** The value inside the brackets of an arbitrary-value utility (`w-[34px]` → `34px`; `[mask:url(x)]` → `url(x)`), or null. */
function arbitraryValue(utility) {
	const property = /^\[[a-zA-Z-]+:(.+)\]$/.exec(utility);
	if (property) return property[1];
	const open = utility.indexOf("-[");
	if (open < 1) return null;
	let depth = 0;
	for (let k = open + 1; k < utility.length; k += 1) {
		if (utility[k] === "[") depth += 1;
		else if (utility[k] === "]") {
			depth -= 1;
			if (depth === 0) {
				const rest = utility.slice(k + 1);
				return rest === "" || rest.startsWith("/") ? utility.slice(open + 2, k) : null;
			}
		}
	}
	return null;
}

function checkClasses(file, kind, lexed, allowed) {
	for (const { start, end } of lexed.strings) {
		const content = lexed.blanked.slice(start, end);
		if (!/[[-]/.test(content)) continue;
		for (const match of content.matchAll(/\S+/g)) {
			const line = lexed.lineAt(start + match.index);
			if (allowed.has(line)) continue;
			const token = match[0].replace(/^!|!$/g, "");
			const utility = splitTop(token, ":").at(-1).text;
			const value = arbitraryValue(utility);
			// The parts of `@monti-cms/ui` keep the design system's measured sizes; a raw color is banned everywhere.
			const raw = value !== null && (RAW_COLOR.test(value) || (kind === "screen" && RAW_LENGTH.test(value)));
			if (raw) {
				const what = RAW_COLOR.test(value) ? "color" : "length";
				add(
					file,
					line,
					"arbitrary-value",
					`\`${token}\` carries a raw ${what}; use a token utility or a value made of \`var(--monti-…)\``,
				);
			} else if (PALETTE_CLASS.test(utility)) {
				add(
					file,
					line,
					"raw-palette",
					`\`${token}\` is Tailwind's palette; use a color token (\`bg-monti-…\`, \`text-monti-…\`, \`border-monti-…\`)`,
				);
			} else if (TEXT_SIZE_CLASS.test(utility)) {
				add(
					file,
					line,
					"raw-palette",
					`\`${token}\` is Tailwind's type size; use a type role (\`text-monti-body\`, \`text-monti-note\`, …)`,
				);
			}
		}
	}
}

/** The end of the `{ ... }` that opens at `open` in masked source (strings blanked), or -1. */
function matchingBrace(masked, open) {
	let depth = 0;
	for (let k = open; k < masked.length; k += 1) {
		if (masked[k] === "{") depth += 1;
		else if (masked[k] === "}") {
			depth -= 1;
			if (depth === 0) return k;
		}
	}
	return -1;
}

function checkInlineStyle(file, kind, source, lexed, allowed) {
	for (const match of lexed.masked.matchAll(/\bstyle=\{/g)) {
		const open = match.index + match[0].length - 1;
		const line = lexed.lineAt(match.index);
		if (kind === "screen") {
			if (!allowed.has(line)) {
				add(
					file,
					line,
					"inline-style",
					"`style={…}` in a screen; use token utilities. A value measured at runtime takes `// design-allow: reason`",
				);
			}
			continue;
		}
		const close = matchingBrace(lexed.masked, open);
		if (close === -1 || lexed.masked[open + 1] !== "{") continue;
		for (const { start, end } of lexed.strings) {
			if (start < open || end > close) continue;
			const value = source.slice(start, end);
			const at = lexed.lineAt(start);
			if (!allowed.has(at) && (RAW_LENGTH.test(value) || RAW_COLOR.test(value))) {
				add(file, at, "inline-style", `style value "${value}" is a raw length or color; use token utilities`);
			}
		}
		for (const number of lexed.masked.slice(open, close).matchAll(/\b([A-Za-z]+)\s*:\s*(-?\d*\.?\d+)\s*(?=[,}\n])/g)) {
			const at = lexed.lineAt(open + number.index);
			if (!UNITLESS_STYLE_KEYS.has(number[1]) && number[2] !== "0" && !allowed.has(at)) {
				add(file, at, "inline-style", `style ${number[1]}: ${number[2]} is a raw pixel value; use token utilities`);
			}
		}
	}
}

/** The module specifiers of `import ... from`, side-effect `import`, `export ... from`, `import()` and `require()`; `type` marks a type-only statement. */
function specifiers(lexed) {
	const found = [];
	for (const { start, end } of lexed.strings) {
		if (!/(?:\bfrom|\bimport\s*\(?|\brequire\s*\()\s*["'`]$/.test(lexed.blanked.slice(Math.max(0, start - 24), start)))
			continue;
		const before = lexed.blanked.slice(0, start);
		const statement = before.slice(before.lastIndexOf(";") + 1);
		found.push({
			specifier: lexed.blanked.slice(start, end),
			line: lexed.lineAt(start),
			type: /^\s*(?:import|export)\s+type\b/.test(statement),
		});
	}
	return found;
}

function checkImports(file, kind, lexed, allowed) {
	for (const { specifier, line, type } of specifiers(lexed)) {
		if (allowed.has(line)) continue;
		if (/\.s?css(?:\?.*)?$/.test(specifier)) {
			const resolved = specifier.startsWith(".")
				? rel(path.resolve(path.dirname(file), specifier.replace(/\?.*$/, "")))
				: specifier;
			if (!ALLOWED_CSS.has(resolved) && !ALLOWED_CSS_SPECIFIERS.has(resolved)) {
				add(
					file,
					line,
					"css-file",
					`imports \`${specifier}\`; admin styling is token utilities, and the only stylesheets are ${[...ALLOWED_CSS].join(", ")}`,
				);
			}
		}
		if (kind === "screen" && !type && PART_LIBRARIES.test(specifier)) {
			add(
				file,
				line,
				"part-in-screen",
				`imports \`${specifier}\`; build the part in \`@monti-cms/ui\` and use it from there`,
			);
		}
		if (kind === "screen" && specifier === "@monti-cms/ui/internal") {
			add(
				file,
				line,
				"part-in-screen",
				"imports `@monti-cms/ui/internal` (the open parts, with `className`); use the closed part from `@monti-cms/ui`, or mark why this file needs the open one",
			);
		}
	}
	if (kind !== "screen") return;
	for (const match of lexed.masked.matchAll(/\bcva\s*\(/g)) {
		const line = lexed.lineAt(match.index);
		if (!allowed.has(line))
			add(file, line, "part-in-screen", "declares `cva(`; a styled part with variants belongs in `@monti-cms/ui`");
	}
}

for (const { file, kind } of files) {
	if (!inTargets(file)) continue;
	const source = readFileSync(file, "utf8");
	const lexed = lex(source);
	const allowed = allowedLines(file, lexed);
	checkClasses(file, kind, lexed, allowed);
	checkInlineStyle(file, kind, source, lexed, allowed);
	checkImports(file, kind, lexed, allowed);
}

/** Stylesheets: only the allowed files exist, and `admin.css` holds base rules only. */
function walkCss(dir, out) {
	for (const name of readdirSync(dir)) {
		const full = path.join(dir, name);
		if (statSync(full).isDirectory()) {
			if (!CSS_SKIP_DIRS.has(name)) walkCss(full, out);
		} else if (/\.s?css$/.test(name)) {
			out.push(full);
		}
	}
}

function checkAdminCss(file) {
	const source = readFileSync(file, "utf8");
	const lineStarts = [0];
	for (let index = 0; index < source.length; index += 1) if (source[index] === "\n") lineStarts.push(index + 1);
	const lineAt = (offset) => {
		let line = 1;
		while (line < lineStarts.length && lineStarts[line] <= offset) line += 1;
		return line;
	};
	const markers = new Set();
	const clean = source.replace(/\/\*[\s\S]*?\*\//g, (comment, offset) => {
		const marker = /design-allow:([\s\S]*?)\*\//.exec(comment);
		if (marker) {
			const end = lineAt(offset + comment.length - 1);
			if (marker[1].trim()) markers.add(end);
			else add(file, end, "design-allow", "a design-allow marker needs a reason (`/* design-allow: why */`)");
		}
		return comment.replace(/[^\n]/g, " ");
	});

	const skipBlock = (open) => {
		let depth = 0;
		for (let k = open; k < clean.length; k += 1) {
			if (clean[k] === "{") depth += 1;
			else if (clean[k] === "}") {
				depth -= 1;
				if (depth === 0) return k;
			}
		}
		return clean.length - 1;
	};
	const layers = [];
	let preludeStart = 0;
	let i = 0;
	while (i < clean.length) {
		const char = clean[i];
		if (char === ";") {
			preludeStart = i + 1;
		} else if (char === "}") {
			layers.pop();
			preludeStart = i + 1;
		} else if (char === "{") {
			const prelude = clean.slice(preludeStart, i);
			const startLine = lineAt(preludeStart + prelude.search(/\S/));
			const skipped = markers.has(startLine - 1) || markers.has(startLine);
			const layer = /^@layer\s+([\w-]+)$/.exec(prelude.trim());
			if (layer) {
				layers.push(layer[1]);
				preludeStart = i + 1;
			} else {
				if (prelude.trim().startsWith("@")) {
					if (!skipped)
						add(
							file,
							startLine,
							"admin-css-rule",
							`\`${prelude.trim().replace(/\s+/g, " ")}\` is not a document-wide base rule; move it to token utilities on the element`,
						);
				} else {
					let offset = 0;
					for (const part of splitTop(prelude, ",")) {
						const selector = part.text.replace(/\s+/g, " ").trim();
						const line = lineAt(preludeStart + offset + part.text.search(/\S|$/));
						offset += part.text.length + 1;
						const ok =
							ADMIN_CSS_SELECTORS.has(selector) && ADMIN_CSS_SELECTORS.get(selector) === (layers.at(-1) ?? null);
						if (!ok && !skipped)
							add(
								file,
								line,
								"admin-css-rule",
								`\`${selector}\` is not a document-wide base rule; move it to token utilities on the element`,
							);
					}
				}
				i = skipBlock(i);
				preludeStart = i + 1;
			}
		}
		i += 1;
	}
}

for (const dir of CSS_ROOTS) {
	const found = [];
	walkCss(path.join(root, dir), found);
	for (const file of found) {
		if (!inTargets(file)) continue;
		if (!ALLOWED_CSS.has(rel(file))) {
			add(
				file,
				1,
				"css-file",
				"a stylesheet outside the allowed four; style with token utilities (a new utility goes in the theme, `packages/ui/styles/theme.css`)",
			);
		} else if (rel(file) === ADMIN_CSS_FILE) {
			checkAdminCss(file);
		}
	}
}

/** Every component `@monti-cms/ui` exports is named in the docs. */
function checkUndocumentedParts() {
	const indexFile = path.join(root, "packages/ui/src/index.ts");
	const lexed = lex(readFileSync(indexFile, "utf8"));
	const names = [];
	for (const match of lexed.blanked.matchAll(/^export\s+const\s+(\w+)/gm)) {
		names.push({ name: match[1], line: lexed.lineAt(match.index) });
	}
	for (const match of lexed.blanked.matchAll(/^export\s*\{([^}]*)\}/gm)) {
		let offset = match.index + match[0].indexOf("{") + 1;
		for (const item of match[1].split(",")) {
			const name = item
				.trim()
				.split(/\s+as\s+/)
				.at(-1);
			if (name) names.push({ name, line: lexed.lineAt(offset + item.search(/\S|$/)) });
			offset += item.length + 1;
		}
	}
	const docsDir = path.join(root, "docs/design/admin/components");
	const spans = readdirSync(docsDir)
		.filter((name) => name.endsWith(".md"))
		.flatMap((name) => [...readFileSync(path.join(docsDir, name), "utf8").matchAll(/`([^`\n]+)`/g)].map((m) => m[1]));
	// A span names a part when it is the name itself, or a JSX opening of it (`<Name open>`); a part only used in the example of another is not named.
	const documented = (name) => spans.some((span) => new RegExp(`^<?${name}(?![A-Za-z0-9_])`).test(span.trim()));
	for (const { name, line } of names) {
		if (!/^[A-Z][A-Za-z0-9]*$/.test(name) || documented(name)) continue;
		add(
			indexFile,
			line,
			"undocumented-part",
			`\`${name}\` is not named in docs/design/admin/components/*.md; add it to the docs page of its family (its rules, and its name in the "코드" section)`,
		);
	}
}
if (covers(path.join(root, "packages/ui/src/index.ts"))) checkUndocumentedParts();

/** `.ts`/`.tsx` sources under `dir`, tests and test helpers left out. */
function sourcesUnder(dir, skip = ["__test__", "node_modules", "dist", "test"]) {
	return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
		const full = path.join(dir, entry.name);
		if (entry.isDirectory()) return skip.includes(entry.name) ? [] : sourcesUnder(full, skip);
		return /\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) ? [full] : [];
	});
}
/** The 1-based lines of `source` that match `pattern`. */
const linesMatching = (source, pattern) =>
	source.split("\n").flatMap((text, index) => (pattern.test(text) ? [index + 1] : []));

/** The packages whose classes the admin stylesheet compiles (its `@source` lines): the admin UI. */
const ADMIN_UI_PACKAGES = [
	...readFileSync(path.join(root, "packages/admin/styles/index.css"), "utf8").matchAll(
		/^@source "(?:\.\.\/\.\.\/)?([\w-]+|\.\.)\/src";/gm,
	),
].map((match) => (match[1] === ".." ? "admin" : match[1]));

/**
 * Files of a screen package that draw something the components cannot say (positions over the document, drag transforms, measured layouts, chart
 * geometry, an imitation of another site), with the reason. Only these set `className` or `style`, import the open entry or the class helpers.
 * Adding a file here is a design decision, made in review.
 */
const DRAWING = new Map([
	["admin/src/editor/block-handle-overlay.tsx", "the handle floats beside the block at measured coordinates"],
	[
		"admin/src/editor/blocks/added/view.tsx",
		"the default custom block is drawn in the document: a frame with the component name above its body",
	],
	[
		"admin/src/editor/blocks/block-issues.tsx",
		"a notice under a block inside the document; block views stay free of UI packages",
	],
	[
		"admin/src/editor/blocks/fence-preview/fence-preview-node-view.tsx",
		"the preview block is drawn inside the document",
	],
	[
		"admin/src/editor/blocks/fence-preview/preview-renderers.tsx",
		"rendered previews (diagram, formula) are drawn inside the document in the block's own look",
	],
	[
		"admin/src/editor/blocks/shared.tsx",
		"the block toolbar floats over the block corner and attributes are written in place inside the block",
	],
	[
		"admin/src/editor/blocks/use-block-editor.tsx",
		"`Content` and `BlockFrame` are how a block view draws inside the document, so they take a `className`",
	],
	[
		"admin/src/editor/code-block/code-block-view.tsx",
		"the code block is drawn in the document: frame, line gutter, line backgrounds and the code text are positioned together",
	],
	[
		"admin/src/editor/code-block/line-menu.tsx",
		"a menu beside the picked lines (absolute position inside the block, never takes focus from the code)",
	],
	[
		"admin/src/editor/file-node-view.tsx",
		"the file card is a block inside the document, with its name written in place",
	],
	[
		"admin/src/editor/image-node-view.tsx",
		"the image block is drawn inside the document: frame, crop, width, caption in place, resize handles",
	],
	[
		"admin/src/editor/inline-bubble.tsx",
		"the bubble floats at the selection (fixed coordinates, z-index, measured by ref)",
	],
	[
		"admin/src/editor/internal-link-popup.tsx",
		"a list floating at the caret (fixed coordinates, z-index, highlighted row scrolled into view)",
	],
	["admin/src/editor/table-toolbar.tsx", "the toolbar floats over the table at a position measured from it"],
	[
		"admin/src/editor/tiptap-editor.tsx",
		"the editor canvas: the writing column is sized by `--editor-width`, and the empty-line hint and the block under an open menu are styled inside it",
	],
	["admin/src/host/layout.tsx", "the admin root: `monti-admin` scopes the tokens and the page fills the window"],
	[
		"admin/src/host/setup-problem.tsx",
		"the admin root: `monti-admin` scopes the tokens and the screen is centered in the window",
	],
	[
		"admin/src/screens/entries/editor-scroller.tsx",
		"the scrolling body of the editor: its active-block highlight reaches into the editor's own markup",
	],
	[
		"admin/src/screens/entries/entry-editor-side-panels.tsx",
		"the side panels overlay the body on narrow screens and dock beside it on wide ones (absolute position, shadow)",
	],
	[
		"admin/src/screens/entries/scroll-room.tsx",
		"extra room after the last block so the source can scroll as far as the translation does (35% of the viewport, in step with the editor)",
	],
	[
		"admin/src/screens/entries/sortable-entry-row.tsx",
		"a sortable row is moved by dnd-kit's transform (inline style) and lifts while dragged, and its handle needs a grab cursor and no touch scrolling",
	],
	[
		"admin/src/screens/schema/fields-tree-layout-rows.tsx",
		"the drop rows of the field list: a drag transform on the row",
	],
	[
		"admin/src/screens/schema/fields-tree-rows.tsx",
		"the field list rows: the hover-revealed row buttons and the problem dot",
	],
	[
		"admin/src/screens/shared/side-panel.tsx",
		"the slots of the side panels: beside the list or the page on a wide window, floating over its right edge on a narrow one (absolute position, shadow)",
	],
	["blocks/src/callout/view.tsx", "draws the callout as the public post does"],
	["blocks/src/chart/preview.tsx", "chart geometry inside the post's rhythm"],
	["blocks/src/chart/ui.tsx", "chart geometry (recharts selectors, aspect ratio, tooltip and legend boxes, swatches)"],
	["blocks/src/chart/view.tsx", "the public page's chart, styled by render.css"],
	["blocks/src/code-explorer/view.tsx", "draws the explorer as the public post does"],
	["blocks/src/collapsible/view.tsx", "draws the collapsible as the public post does"],
	["blocks/src/color/menu.tsx", "color samples painted by the mark's own classes and variables"],
	["blocks/src/columns/view.tsx", "measured column layout with boundary handles and drag"],
	["blocks/src/mermaid/preview.tsx", "hosts the diagram SVG"],
	["blocks/src/tabs/view.tsx", "draws the tab bar and body as the public post does"],
	["mdx/src/admin/mdx-source-editor.tsx", "a textarea laid over a syntax-highlighted layer"],
	["mdx/src/admin/source-panel.tsx", "sizes the highlighted source editor, which draws its own surface"],
]);

/**
 * Screens are built from `@monti-cms/ui` components and their options only: no `className`, no `style`, no import of the open entry
 * (`@monti-cms/ui/internal`) and no class helper (`cn`, `*Variants`), outside the drawing files. The components refuse `className` and `style` in
 * their types; this covers raw elements. A screen is every source of a package the admin stylesheet compiles, except the design system itself
 * (`ui`, `admin/src/ui`), stories and the blocks' public-site renderers (`render.tsx`, styled by `render.css`).
 */
function checkDrawingOnly() {
	const isScreen = (file) =>
		!file.startsWith("admin/src/ui/") &&
		!file.startsWith("admin/src/stories/") &&
		!/\.stories\.tsx$/.test(file) &&
		!/\/render(\.client)?\.tsx$/.test(file);
	const packagesDir = path.join(root, "packages");
	const screens = ADMIN_UI_PACKAGES.filter((name) => name !== "ui")
		.flatMap((name) => sourcesUnder(path.join(packagesDir, name, "src")))
		.map((full) => ({ full, file: path.relative(packagesDir, full).split(path.sep).join("/") }))
		.filter(({ file }) => isScreen(file));
	const byFile = new Map();
	for (const { full, file } of screens) {
		const source = readFileSync(full, "utf8");
		byFile.set(file, source);
		if (DRAWING.has(file) || !inTargets(full)) continue;
		for (const line of linesMatching(source, /\b(?:className|style)=\{?["'`{]/))
			add(
				full,
				line,
				"drawing-only",
				"sets `className` or `style`; a screen uses the options of the `@monti-cms/ui` parts",
			);
		for (const line of linesMatching(source, /from "@monti-cms\/ui\/internal"/))
			add(
				full,
				line,
				"drawing-only",
				"imports `@monti-cms/ui/internal`; a screen uses the closed parts of `@monti-cms/ui`",
			);
		for (const line of linesMatching(
			source,
			/import (?:type )?\{[^}]*\b(?:cn|[a-z]+Variants)\b[^}]*\} from "@monti-cms\/(?:ui|admin|admin\/kit)"/,
		))
			add(full, line, "drawing-only", "imports a class helper (`cn`, `*Variants`); a screen sets no classes");
	}
	for (const file of DRAWING.keys()) {
		const full = path.join(packagesDir, file);
		if (!covers(full)) continue;
		const source = byFile.get(file);
		if (source === undefined)
			add(full, 1, "drawing-only", "is listed in DRAWING (scripts/check-design.mjs) but is not a screen file any more");
		else if (!/\b(?:className|style)=|@monti-cms\/ui\/internal/.test(source))
			add(
				full,
				1,
				"drawing-only",
				"is listed in DRAWING (scripts/check-design.mjs) but draws nothing any more; take it off the list",
			);
	}
}
checkDrawingOnly();

/** The app's (shadcn) color names: the admin neither uses them unprefixed nor defines them, under its prefix or not. */
const APP_COLORS = [
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
	"destructive-foreground",
	"background",
	"foreground",
	"card",
	"popover",
	"primary",
	"secondary",
	"muted",
	"accent",
	"destructive",
	"border",
	"input",
	"ring",
].join("|");
const APP_COLOR_UTILITIES =
	"bg|text|border-[xytrblse]|border|ring-offset|ring|outline|fill|stroke|divide|decoration|caret|from|via|to|shadow|accent|placeholder|selection|inset-ring";

/**
 * The admin's CSS is confined to its own names (`monti-` prefix): the sources of the admin and its first-party plugins use no class of the host app's
 * color names (`bg-background`, `text-muted-foreground`), no `--background` variable, no `dark:` variant (the admin's is `monti-dark:`) and no
 * shadcn orientation variant (`data-horizontal`). They would pick up the host's theme, or nothing.
 */
function checkAppColors() {
	const patterns = [
		{
			regex: new RegExp(`(?<![\\w-])(?:${APP_COLOR_UTILITIES})-(?:${APP_COLORS})(?![\\w-])`, "g"),
			why: "is the host app's color name; use a token utility (`bg-monti-…`, `text-monti-…`)",
		},
		{
			regex: new RegExp(`\\(\\s*--(?:color-)?(?:${APP_COLORS})(?![\\w-])`, "g"),
			why: "reads the host app's color variable; use a `--monti-…` token",
		},
		{ regex: /(?<=[\s"'`:!([])dark:(?=[^\s,])/g, why: "is the host's dark variant; the admin's is `monti-dark:`" },
		{
			regex: /(?<![\w-])(?:group-|peer-|in-|has-)*data-(?:horizontal|vertical)(?![\w-[])/g,
			why: "is shadcn's orientation variant; use `data-[orientation=…]:`",
		},
	];
	for (const pkg of ["core", "admin", "blocks", "mdx", "seo", "ai"]) {
		for (const full of sourcesUnder(path.join(root, "packages", pkg, "src"), [
			"node_modules",
			"dist",
			".next",
			"__test__",
			"test",
		])) {
			if (!inTargets(full)) continue;
			const lexed = lex(readFileSync(full, "utf8"));
			for (const { regex, why } of patterns)
				for (const match of lexed.blanked.matchAll(regex))
					add(full, lexed.lineAt(match.index), "app-color", `\`${match[0]}\` ${why}`);
		}
	}
}
checkAppColors();

const THEME_FILE = "packages/ui/styles/theme.css";
const TOKENS_FILE = "packages/ui/styles/tokens.css";
const themeCss = readFileSync(path.join(root, THEME_FILE), "utf8");
const lineOf = (source, offset) => source.slice(0, offset).split("\n").length;

/**
 * The admin's stylesheet names only what is its own, so it cannot restyle the host and Tailwind's defaults cannot leak in. The theme
 * (`theme.css`) clears Tailwind's palette, text sizes, weights, shadows, tracking, line heights and radius, then defines only `monti` names whose
 * values read the admin's variables; its variants are `monti-` too, and the dark one follows both `.dark` and `[data-theme="dark"]`. The token
 * values (`tokens.css`) and the hand-written rules (`admin.css`) declare only `--monti-*` variables, none named like the host app's colors.
 */
function checkThemeNames() {
	const themeFile = path.join(root, THEME_FILE);
	if (covers(themeFile)) {
		const blocks = [...themeCss.matchAll(/@theme inline \{([\s\S]*?)\n\}/g)].map((match) => ({
			text: match[1],
			offset: match.index + match[0].indexOf("{") + 1,
		}));
		const allowed =
			/^--(?:(?:background-color|text-color|border-color|ring-color|ring-offset-color|outline-color|fill|stroke|text-decoration-color|caret-color|spacing|radius|height|size|container|shadow)-monti-|font-(?:sans|mono)$|font-weight-(?:normal|medium|semibold|bold)$|tracking-caps$|animate-monti-[a-z-]+$|color-(?:transparent|current|inherit)$|[a-z-]+-\*$)/;
		const declarations = blocks.flatMap(({ text, offset }) =>
			[...text.matchAll(/(--[\w-]+(?:-\*)?)\s*:\s*([^;]+);/g)].map((match) => ({
				name: match[1],
				value: match[2].trim(),
				line: lineOf(themeCss, offset + match.index),
			})),
		);
		if (!declarations.some(({ name }) => name.startsWith("--background-color-monti-")))
			throw new Error(`check-design: read no color roles from the @theme blocks of ${THEME_FILE}`);
		for (const { name, value, line } of declarations) {
			if (!allowed.test(name))
				add(themeFile, line, "theme-names", `\`${name}\` is not a monti name; the theme defines only its own`);
			else if (/^--font-(?:sans|mono)$/.test(name) && !value.includes("--monti-font-"))
				add(themeFile, line, "theme-names", `\`${name}\` must read a \`--monti-font-*\` variable`);
			else if (name.startsWith("--radius-monti-") && !/^var\(--monti-radius-/.test(value))
				add(themeFile, line, "theme-names", `\`${name}\` must read a \`--monti-radius-*\` variable`);
			else if (/^--(?!animate-)[a-z-]+-monti-/.test(name) && !/^var\(--monti-|^\d/.test(value))
				add(themeFile, line, "theme-names", `\`${name}\` must read a \`--monti-*\` variable`);
		}
		for (const reset of [
			"--color-*",
			"--text-*",
			"--font-weight-*",
			"--shadow-*",
			"--tracking-*",
			"--leading-*",
			"--radius-*",
		])
			if (!declarations.some(({ name, value }) => name === reset && value === "initial"))
				add(themeFile, 1, "theme-names", `the theme does not clear Tailwind's \`${reset}\` (\`${reset}: initial;\`)`);
		for (const match of themeCss.matchAll(/@custom-variant\s+([\w-]+)/g))
			if (!match[1].startsWith("monti-"))
				add(themeFile, lineOf(themeCss, match.index), "theme-names", `the variant \`${match[1]}\` is not a monti name`);
		if (!/@custom-variant monti-dark[^;]*\.dark[^;]*\[data-theme="dark"\]/.test(themeCss))
			add(themeFile, 1, "theme-names", 'the `monti-dark` variant must follow both `.dark` and `[data-theme="dark"]`');
	}
	for (const file of [TOKENS_FILE, ADMIN_CSS_FILE]) {
		const full = path.join(root, file);
		if (!covers(full)) continue;
		const source = readFileSync(full, "utf8").replace(/\/\*[\s\S]*?\*\//g, (comment) => comment.replace(/[^\n]/g, " "));
		for (const match of source.matchAll(/^\s*(--[\w-]+)\s*:/gm)) {
			const name = match[1];
			const line = lineOf(source, match.index + match[0].indexOf(name));
			if (!name.startsWith("--monti-"))
				add(full, line, "theme-names", `declares \`${name}\`; the admin declares only \`--monti-*\` variables`);
			else if (new RegExp(`^--monti-(?:${APP_COLORS})$`).test(name))
				add(full, line, "theme-names", `declares \`${name}\`, the host app's color name under the admin's prefix`);
		}
		if (file === TOKENS_FILE && !/html:is\(\.dark, \[data-theme="dark"\]\):has\(\.monti-admin\)/.test(source))
			add(full, 1, "theme-names", 'the dark tokens must apply under both `.dark` and `[data-theme="dark"]`');
	}
}
checkThemeNames();

/** Role names per namespace, read from the generated theme, so adding a role to `tokens.json` is all it takes. */
const rolesOf = (namespace) =>
	new Set([...themeCss.matchAll(new RegExp(`--${namespace}-monti-([a-z-]+?)(?:--[a-z-]+)?:`, "g"))].map((m) => m[1]));
const ROLES = {
	bg: rolesOf("background-color"),
	// The type roles are utilities of their own (`@utility text-monti-body`), the colors are theme variables.
	text: new Set([
		...rolesOf("text-color"),
		...[...themeCss.matchAll(/@utility text-monti-([\w-]+)/g)].map((m) => m[1]),
	]),
	border: rolesOf("border-color"),
	divide: rolesOf("border-color"),
	ring: rolesOf("ring-color"),
	"ring-offset": rolesOf("ring-offset-color"),
	outline: rolesOf("outline-color"),
	fill: rolesOf("fill"),
	stroke: rolesOf("stroke"),
	decoration: rolesOf("text-decoration-color"),
	caret: rolesOf("caret-color"),
	shadow: rolesOf("shadow"),
};
/** The spacing scale (`--spacing-monti-*` in the theme): gaps, padding and margins on screens use these, plus `0`, `px` and `auto`. */
const SPACING = new Set([...themeCss.matchAll(/--spacing-(monti-\d+):/g)].map((m) => m[1]));
for (const [kind, names] of [...Object.entries(ROLES), ["spacing", SPACING]])
	if (names.size === 0) throw new Error(`check-design: read no ${kind} names from packages/ui/styles/theme.css`);

/** Files that draw something other than the admin and keep its colors on purpose. */
const OWN_COLORS = new Set([
	// Imitates a search result page, so it uses that page's link colors.
	"seo/src/admin/preview.tsx",
]);
/** Type the design system's own parts set outside the roles, by file: what the role does not cover. */
const OWN_TYPE = new Map([
	// Text that runs over several lines in a field takes the design system's own line of 1.6 times the size (`.mt-textarea`).
	["ui/src/textarea.tsx", new Set(["leading-[1.6]"])],
	// The conversation's own line heights: 1.6 times the size in the admin's bubble and 1.7 in the assistant's answer (`.mt-msg-user`).
	["ui/src/chat-message.tsx", new Set(["leading-[1.6]", "leading-[1.7]"])],
	// The modal's own type: a 20px title (28px line, -0.015em) and text at 1.65 times the size (`.mt-dialog-title`, `.mt-dialog` text).
	["ui/src/dialog.tsx", new Set(["text-[20px]", "leading-[28px]", "tracking-[-0.015em]", "leading-[1.65]"])],
	// The translation marker's text, 10px, the one size under the micro role (`.mt-marker`).
	["ui/src/marker.tsx", new Set(["text-[10px]"])],
	// The heading icon's level number, 8px mono in the corner of the 16px glyph (`.mt-ico-level .lv`).
	["ui/src/heading-icon.tsx", new Set(["text-[8px]", "leading-[8px]"])],
]);

/** Why a utility is outside the design system, or null. */
function offSystem(utility, inUi, ownColors) {
	const color = utility.match(
		/^-?(bg|text|border(?:-[xytblrse])?|divide|ring-offset|ring|outline|fill|stroke|decoration|caret|accent|shadow|from|via|to)-([a-z][\w-]*?)(\/[\w.]+)?$/,
	);
	if (color) {
		const [, rawKind, name, alpha] = color;
		const kind = rawKind.replace(/^border-.$/, "border");
		if (name.startsWith("monti-")) {
			const role = name.slice("monti-".length);
			if (!ROLES[kind]) return `no ${kind}-* colors in the system`;
			if (!ROLES[kind].has(role)) return `unknown role "${role}" for ${kind}-*`;
			return null;
		}
		if (new RegExp(`^(?:${PALETTE})(?:-\\d+)?$`).test(name)) return ownColors ? null : "Tailwind palette color";
		if (kind === "text" && /^(xs|sm|base|lg|[2-9]?xl)$/.test(name)) return "Tailwind text size: use text-monti-<role>";
		if (kind === "shadow" && /^(2xs|xs|sm|md|lg|xl|2xl)$/.test(name))
			return "Tailwind shadow: use shadow-monti-floating or none";
		if (["transparent", "current", "inherit"].includes(name) && !alpha) return null;
	}
	if (
		/^-?(bg|text|border|ring|fill|stroke|outline|decoration|from|via|to|shadow)-\[(#|rgb|hsl|oklch|color:)/.test(
			utility,
		)
	)
		return ownColors ? null : "arbitrary color";
	if (/^text-\[[\d.]+(px|rem)\]$/.test(utility)) return "arbitrary text size";
	if (utility === "shadow") return "Tailwind shadow: use shadow-monti-floating or none";
	if (/^font-(thin|extralight|light|extrabold|black)$/.test(utility))
		return "weight outside normal, medium, semibold, bold";
	if (/^leading-(?!none$)/.test(utility)) return "line height comes with the text role";
	if (/^tracking-(?!caps$)/.test(utility)) return "letter spacing: only tracking-caps";
	if (/^rounded(-[a-z]+)?-(xs|2xl|3xl|4xl|dialog)$/.test(utility) || utility === "rounded")
		return "radius outside sm, md, lg, xl, full";
	if (/^rounded(-[a-z]{1,2})?-(sm|md|lg|xl|full)$/.test(utility)) return "unprefixed radius: use rounded-monti-<size>";
	const space = utility.match(/^-?(?:p[xytblrse]?|m[xytblrse]?|gap(?:-[xy])?|space-[xy])-([a-z0-9.-]+)$/);
	if (space && !inUi && !["0", "px", "auto"].includes(space[1]) && !SPACING.has(space[1]))
		return `spacing "${space[1]}": use the scale (${[...SPACING].join(", ")})`;
	return null;
}

/**
 * The admin uses the design system only. The theme clears Tailwind's palette, text sizes, weights, shadows, tracking and line heights, so a class
 * outside the system compiles to nothing; this names each such class instead of letting it vanish. Every class-like word of a double-quoted or
 * template string in the admin UI packages counts, stories and test helpers too. Spacing on screens takes the scale (`gap-monti-8`); the parts of
 * `@monti-cms/ui` may use in-between numbers of their own.
 */
function checkOffSystem() {
	const packagesDir = path.join(root, "packages");
	for (const pkg of ADMIN_UI_PACKAGES) {
		for (const full of sourcesUnder(path.join(packagesDir, pkg, "src"), ["__test__", "node_modules", "dist"])) {
			if (!inTargets(full)) continue;
			const file = path.relative(packagesDir, full).split(path.sep).join("/");
			const inUi = file.startsWith("ui/src/") || file.startsWith("admin/src/ui/");
			const source = readFileSync(full, "utf8");
			for (const literal of source.matchAll(/"(?:[^"\\\n]|\\.)*"|`(?:[^`\\]|\\.)*`/g)) {
				const line = source.slice(0, literal.index).split("\n").length;
				for (const word of literal[0]
					.slice(1, -1)
					.replace(/\$\{[^}]*\}/g, " ")
					.split(/\s+/)) {
					if (!word) continue;
					const utility = splitTop(word, ":").at(-1).text.replace(/^!/, "");
					if (OWN_TYPE.get(file)?.has(utility)) continue;
					const why = offSystem(utility, inUi, OWN_COLORS.has(file));
					if (why) add(full, line, "off-system", `\`${word}\`: ${why}`);
				}
			}
		}
	}
}
checkOffSystem();

const HINTS = {
	"css-file": "Admin UI is styled with token utilities, not stylesheets.",
	"admin-css-rule": "admin.css holds document-wide base rules only; style the element with token utilities.",
	"arbitrary-value": "Use a token utility; an arbitrary value may only reference tokens, %, fr or auto.",
	"raw-palette": "Use the token utilities of packages/ui/styles/theme.css (docs/design/admin/tokens.md).",
	"inline-style": "Style with token utilities; mark only a value measured at runtime with `// design-allow: reason`.",
	"part-in-screen":
		"A screen composes the parts of @monti-cms/ui; a new styled part is built there first, with its story.",
	"undocumented-part": "Every ui part has its rules in docs/design/admin/components/.",
	"drawing-only": "A screen composes the parts of @monti-cms/ui by their options; only the files in DRAWING draw.",
	"app-color": "The admin's CSS uses its own names only (monti- prefix), so the host's theme cannot reach it.",
	"theme-names":
		"The theme and the token files define only the admin's own names (monti-), and the theme clears Tailwind's.",
	"off-system": "Use the type roles, color roles, radius, weights and spacing scale of packages/ui/styles/theme.css.",
	"design-allow": "A marker states why the value cannot be a token.",
};

if (findings.length > 0) {
	findings.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line);
	console.error(`check-design: ${findings.length} finding(s) that break the admin design system.\n`);
	for (const [rule, hint] of Object.entries(HINTS)) {
		const group = findings.filter((finding) => finding.rule === rule);
		if (group.length === 0) continue;
		console.error(`${rule} (${group.length}): ${hint}`);
		for (const { file, line, message } of group) console.error(`  ${file}:${line}: [${rule}] ${message}`);
		console.error("");
	}
	process.exit(1);
}
console.log(`check-design: ok (${files.length} files)`);
