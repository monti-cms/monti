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
 *                       `ui/styles/tokens.css` (generated), `ui/styles/admin.css` and `admin/styles/index.css` (`ui/.storybook` is exempt). A
 *                       `.ts`/`.tsx` that imports any other CSS file fails too.
 *   admin-css-rule      `ui/styles/admin.css` holds document-wide base rules only (the body, the border default, `.monti-admin`, the scrollbar).
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
 *                       are `monti-` (the dark one follows `.dark` and `[data-theme="dark"]`), and `ui/styles/tokens.css` and `ui/styles/admin.css`
 *                       declare only `--monti-*` variables, none named like the host app's colors.
 *   off-system          Every class word in the admin UI packages (stories and test helpers too) is in the design system: a known role per
 *                       namespace, the weights, radius and shadows it keeps, no line height or letter spacing of its own, and on screens the
 *                       spacing scale. The roles are read from `packages/ui/styles/theme.css`; `OWN_TYPE` and `OWN_COLORS` name the exceptions.
 *   fixed-height        A raw height of 24px or more (`h-7`, `min-h-12`, `size-6`, `h-[52px]`) outside stories. Controls take the height tokens
 *                       (`h-monti-control-md`); a row, bar or picture box with a measured height of its own is listed in `FIXED_HEIGHTS` with
 *                       its reason. An entry the file no longer uses fails too.
 *   control-shape       A pressable class string (`cursor-pointer` with a ground on hover or state) has pill corners, or 6px in a file SIX_PX
 *                       names with its reason. Other corners (`rounded-monti-sm`, `-lg`, `rounded-[5px]`) fail.
 *   icon-list           Only `packages/ui/src/icons.ts`, the one list of icons, imports `@carbon/icons-react` (stories and tests too, in
 *                       every package). Code takes icons from `@monti-cms/ui/icons`, or `@monti-cms/admin/icons` in an extension.
 *   design-allow        A `design-allow` marker without a reason.
 *
 * A value that is measured or computed at runtime (a position under the pointer, a width the user dragged) ends its line with
 * `// design-allow: reason`, or `{/* design-allow: reason *\/}` in JSX (alone on its line, it skips the next line). In a CSS file,
 * `/* design-allow: reason *\/` on the line before a rule skips that rule. A marker is not for a style choice, and an empty reason fails.
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const rel = (file) => path.relative(root, file).split(path.sep).join("/");
const targets = process.argv.slice(2).map((target) => path.resolve(target));

/**
 * Source trees the admin UI is built from. `ui` is the design system itself, `screen` is everything that composes it. A tree that does not exist yet
 * (the packages being rebuilt) is skipped.
 */
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
	"packages/ui/styles/admin.css",
	"packages/admin/styles/index.css",
]);
/** Package specifiers that stand for the allowed files above. */
const ALLOWED_CSS_SPECIFIERS = new Set(["@monti-cms/ui/theme.css", "@monti-cms/ui/tokens.css"]);
const CSS_ROOTS = ["packages/ui", "packages/admin"];
const CSS_SKIP_DIRS = new Set(["node_modules", "dist", ".storybook", "storybook-static", ".turbo", "test-results"]);

/** The document-wide rules of `admin.css`: selector → the `@layer` it must sit in (`null` for none). */
const ADMIN_CSS_FILE = "packages/ui/styles/admin.css";
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
for (const { dir, ext, kind } of SOURCES) if (existsSync(path.join(root, dir))) walk(path.join(root, dir), ext, kind);

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
	if (!existsSync(path.join(root, dir))) continue;
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

/** `.ts`/`.tsx` sources under `dir`, tests and test helpers left out; none when `dir` does not exist. */
function sourcesUnder(dir, skip = ["__test__", "node_modules", "dist", "test"]) {
	if (!existsSync(dir)) return [];
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
const ADMIN_STYLES_INDEX = path.join(root, "packages/admin/styles/index.css");
const ADMIN_UI_PACKAGES = existsSync(ADMIN_STYLES_INDEX)
	? [...readFileSync(ADMIN_STYLES_INDEX, "utf8").matchAll(/^@source "(?:\.\.\/\.\.\/)?([\w-]+|\.\.)\/src";/gm)].map(
			(match) => (match[1] === ".." ? "admin" : match[1]),
		)
	: ["ui"];

/**
 * Files of a screen package that draw something the components cannot say (positions over the document, drag transforms, measured layouts, chart
 * geometry, an imitation of another site), with the reason. Only these set `className` or `style`, import the open entry or the class helpers.
 * Adding a file here is a design decision, made in review.
 */
const DRAWING = new Map([]);

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
			/^--(?:(?:background-color|text-color|border-color|ring-color|ring-offset-color|outline-color|fill|stroke|text-decoration-color|caret-color|spacing|radius|height|size|container|shadow|ease)-monti-|default-transition-(?:duration|timing-function)$|font-(?:sans|mono)$|font-weight-(?:normal|medium|semibold|bold)$|tracking-caps$|animate-monti-[a-z-]+$|color-(?:transparent|current|inherit)$|[a-z-]+-\*$)/;
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
		if (!covers(full) || !existsSync(full)) continue;
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

/** Every icon comes from the one list: no other file of any package imports Carbon. */
function checkIconList() {
	const list = "packages/ui/src/icons.ts";
	for (const pkg of readdirSync(path.join(root, "packages"))) {
		const dir = path.join(root, "packages", pkg, "src");
		if (!statSync(dir, { throwIfNoEntry: false })?.isDirectory()) continue;
		for (const file of sourcesUnder(dir, ["node_modules", "dist"])) {
			if (rel(file) === list) continue;
			const lexed = lex(readFileSync(file, "utf8"));
			for (const { specifier, line, type } of specifiers(lexed))
				if (!type && specifier.startsWith("@carbon/icons-react"))
					add(file, line, "icon-list", `imports \`${specifier}\`; take the icon from \`@monti-cms/ui/icons\``);
		}
	}
}
checkIconList();

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
/**
 * Parts whose spacing leaves the scale on purpose (the spacing section of tokens.md): a pill's sides from its height, an optical pull, a measure taken from a board.
 * Anywhere else a part takes the spacing scale too. Keyed by file, with why; a listed file that no longer leaves the scale fails.
 */
const OFF_SCALE_SPACE = new Map([
	[
		"ui/src/button.tsx",
		"pill sides from the height rule (36→18 filled, 32→14) and the loading ring's optical sides and gap (13/15, 7), the leading icon's 2px pull",
	],
	[
		"ui/src/chat-input.tsx",
		"the box's text sits 18px in to line up with its round corner; the send button's room under the text",
	],
	["ui/src/chat-message.tsx", "the bubble's sides follow its 14px corner; 3px lines its first line with the avatar"],
	["ui/src/command.tsx", "menu rows' 9px sides line the words up with the menu's 12px corner and 1px border"],
	["ui/src/dropdown-menu.tsx", "a caption row 7px tall above and below, measured in the menu board"],
	["ui/src/entry-status.tsx", "the status dot's 7px gap, measured with the dot's own 1px ring"],
	["ui/src/field-tree.tsx", "a field nested in a group stands one grip (28px) or grip and name column (44px) in"],
	["ui/src/floating-bar.tsx", "the bar's 3px ring around its 28px buttons"],
	["ui/src/heading-icon.tsx", "the level number's 2px pull into the glyph"],
	["ui/src/label.tsx", "a 2px gap that makes the required mark read as part of its word"],
	["ui/src/marker.tsx", "the marker's 5px end beside its 10px letters"],
	[
		"ui/src/menu-parts.tsx",
		"menu rows' 9px sides line the words up with the menu's 12px corner and 1px border; separators sit 5px clear",
	],
	["ui/src/nav-link.tsx", "the leading icon's 2px pull into the pill side"],
	[
		"ui/src/page-header.tsx",
		"the title's 18px over the ink rule and the meta's 3px baseline lift, measured in the header board",
	],
	["ui/src/pick-list.tsx", "pill sides from the height rule (32→14)"],
	["ui/src/proposal-bubble.tsx", "the arrows' 7px gap, measured in the bubble"],
	["ui/src/proposal-marks.tsx", "2px of colour beyond the marked letters"],
	["ui/src/review.tsx", "3px drops the check box to the first line's middle"],
	["ui/src/segmented.tsx", "the track's 2px ring around its cells"],
	["ui/src/separator.tsx", "a vertical rule 3px clear of the words on each side"],
	[
		"ui/src/sidebar.tsx",
		"pill sides from the height rule (32→14); the tree's folder indents step 22px from the parent's icon",
	],
	["ui/src/split-button.tsx", "the split pill's sides and the loading ring's optical sides and gap, as Button"],
	["ui/src/status-bar-list.tsx", "a menu's rows: 9px sides as menu-parts"],
	["ui/src/suggest.tsx", "pill sides from the height rule (32→14) and the leading icon's 2px pull"],
	["ui/src/tabs.tsx", "3px under a tab's words to its 1.5px rule, measured in the tabs board"],
	["ui/src/textarea.tsx", "the small field's 3px keeps one line at 28px with the 20px line"],
	["ui/src/tile.tsx", "a tile's caption sides follow its 14px picture corner; 44px leaves room for its menu button"],
	["ui/src/todo-item.tsx", "to-dos are menu rows (9px sides); 11px drops the done mark to the first line's middle"],
	["ui/src/tool-call-line.tsx", "3px keeps a tool line at the 20px line inside 26px"],
]);

/** Files where `font-bold` is not stress but the thing itself: bold text in an entry's body, the format bar's B, the toolbar's open tab (tokens.md). */
const BOLD_OK = new Set(["ui/src/doc-blocks.tsx", "ui/src/format-bar.tsx", "ui/src/tabs.tsx"]);

const OWN_TYPE = new Map([
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
	if (/^duration-\d+$/.test(utility))
		return "motion: duration-(--monti-duration-fast|normal|slow), or nothing for the normal one";
	if (/^ease-(linear|in|out|in-out)$/.test(utility)) return "motion: ease-monti-standard or ease-monti-exit";
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
const offScaleSeen = new Set();
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
					// Weights come with the type role (the type section of tokens.md): 600 to stress, 700 only on the big titles' roles. Bold in body text and the format bar's
					// B show what bold is; the toolbar's open tab is 700 by its rule.
					if (utility === "font-bold" && !BOLD_OK.has(file))
						add(full, line, "off-system", `\`${word}\`: stress is font-semibold; 700 comes with the title roles`);
					if (utility === "font-medium")
						add(full, line, "off-system", `\`${word}\`: 500 comes only with text-monti-label`);
					// Parts take the spacing scale too, except where OFF_SCALE_SPACE says why.
					if (
						inUi &&
						!file.includes("/screens/") &&
						!file.includes("/spec-pack/") &&
						/^-?(?:p[xytblrse]?|m[xytblrse]?|gap(?:-[xy])?)-\[\d+(?:\.\d+)?px\]$/.test(utility)
					) {
						if (OFF_SCALE_SPACE.has(file)) offScaleSeen.add(file);
						else
							add(
								full,
								line,
								"off-system",
								`\`${word}\`: spacing takes the scale; a part that must leave it says why in OFF_SCALE_SPACE`,
							);
					}
					// One focus ring (the states section of tokens.md): 2px at half ink, or the field's ink underline. Light rings on dark ground (on-emphasis) keep their own.
					if (/focus/.test(word.split(":").slice(0, -1).join(":"))) {
						if (/^ring-(\d+|\[\d+px\])$/.test(utility) && utility !== "ring-2")
							add(full, line, "off-system", `\`${word}\`: the focus ring is 2px (ring-2)`);
						if (/^(ring|outline)-monti-contrast\/\d+$/.test(utility) && !utility.endsWith("/50"))
							add(full, line, "off-system", `\`${word}\`: the focus ring is half ink (ring-monti-contrast/50)`);
					}
				}
			}
		}
	}
}
checkOffSystem();
if (targets.length === 0)
	for (const file of OFF_SCALE_SPACE.keys())
		if (!offScaleSeen.has(file))
			add(
				path.join(root, "packages", file),
				1,
				"off-system",
				"OFF_SCALE_SPACE names a file that keeps to the scale now",
			);

/**
 * Fixed heights that are not controls, each with its reason (the height standard in tokens.md). A control takes a height token (`h-monti-control-md`); a row, a bar
 * or a picture box that has a measured height of its own is named here. Keyed by the file under `packages/`, then the class.
 */
const FIXED_HEIGHTS = new Map([
	[
		"ui/src/layout.ts",
		new Map([["min-h-64", '`minHeight="empty"`: the room an empty list or drop area keeps, not a control']]),
	],
	[
		"ui/src/list-section.tsx",
		new Map([
			["h-[52px]", "a list row of one line (title and note), measured in the list board"],
			["h-[74px]", "a list row with its meta line, measured in the list board"],
		]),
	],
	[
		"ui/src/patch.tsx",
		new Map([["h-10", "the file name row heading a code change, a row of the card, not a control"]]),
	],
	["ui/src/table.tsx", new Map([["h-10", "the table's head row, measured in the list board"]])],
	[
		"ui/src/proposal-bubble.tsx",
		new Map([["h-11", "the floating bar that holds the proposal's buttons (32px each), a bar, not a control"]]),
	],
	[
		"ui/src/textarea.tsx",
		new Map([["min-h-[52px]", "`tall`: a textarea opens two lines high; a control's token is its one-line height"]]),
	],
	["ui/src/tile.tsx", new Map([["h-13", "a folder tile in the media grid, a card, not a control"]])],
	["ui/src/uploading-image.tsx", new Map([["h-60", "the picture box of an image being uploaded"]])],
	["ui/src/spec-pack/parts.tsx", new Map([["h-24", "a sample picture in the spec pack's image block"]])],
]);

/** A raw height of 24px or more (`h-7`, `min-h-12`, `size-6`, `h-[52px]`): the height of a control, a row or a box that the tokens should name. */
function fixedHeight(utility) {
	const step = /^(?:min-h|h|size)-(\d+(?:\.\d+)?)$/.exec(utility);
	if (step) return Number(step[1]) * 4 >= 24;
	const px = /^(?:min-h|h|size)-\[(\d+(?:\.\d+)?)px\]$/.exec(utility);
	return px ? Number(px[1]) >= 24 : false;
}

function checkFixedHeights() {
	const packagesDir = path.join(root, "packages");
	const seen = new Set();
	for (const pkg of ADMIN_UI_PACKAGES) {
		for (const full of sourcesUnder(path.join(packagesDir, pkg, "src"), [
			"__test__",
			"node_modules",
			"dist",
			"foundations",
		])) {
			if (!inTargets(full) || /\.(stories|test)\./.test(full)) continue;
			const file = path.relative(packagesDir, full).split(path.sep).join("/");
			const source = readFileSync(full, "utf8");
			const allowed = allowedLines(full, lex(source));
			for (const literal of source.matchAll(/"(?:[^"\\\n]|\\.)*"|`(?:[^`\\]|\\.)*`/g)) {
				const line = source.slice(0, literal.index).split("\n").length;
				if (allowed.has(line)) continue;
				for (const word of literal[0]
					.slice(1, -1)
					.replace(/\$\{[^}]*\}/g, " ")
					.split(/\s+/)) {
					const utility = splitTop(word, ":").at(-1).text.replace(/^!/, "");
					if (!fixedHeight(utility)) continue;
					if (FIXED_HEIGHTS.get(file)?.has(utility)) {
						seen.add(`${file} ${utility}`);
						continue;
					}
					add(
						full,
						line,
						"fixed-height",
						`\`${word}\`: a control takes a height token; a row or box names its reason in FIXED_HEIGHTS`,
					);
				}
			}
		}
	}
	if (targets.length > 0) return;
	for (const [file, classes] of FIXED_HEIGHTS)
		for (const utility of classes.keys())
			if (!seen.has(`${file} ${utility}`))
				add(
					path.join(packagesDir, file),
					1,
					"fixed-height",
					`FIXED_HEIGHTS names \`${utility}\`, which the file no longer uses`,
				);
}
checkFixedHeights();

/**
 * Where a pressable thing may have 6px corners (`rounded-monti-md`) instead of a pill (the shape rule in button.md): rows inside a floating surface (menus,
 * pickers) and blocks taller than one line (cards, tiles, a two-line conversation row). Keyed by the file under `packages/`, with the reason.
 */
const SIX_PX = new Map([
	["ui/src/menu-parts.tsx", "rows of a floating menu follow the menu's own corners"],
	["ui/src/conversation-list.tsx", "a conversation row is two lines tall, a block"],
	["ui/src/tile.tsx", "a media or folder tile is a card"],
	["ui/src/todo-item.tsx", "a to-do is a two-line block"],
	["ui/src/media-picker.tsx", "a picked file is a card"],
	["ui/src/block-handle.tsx", "the block in hand is a block of the body, not the handle (the handle is a pill)"],
]);

/** A check box is a square mark, not a ground: its 4px corner (`rounded-monti-sm`) stays. Keyed by file, with the class. */
const CHECK_MARKS = new Map([
	["ui/src/checkbox.tsx", "rounded-monti-sm"],
	["ui/src/dropdown-menu.tsx", "rounded-monti-sm"],
]);

/**
 * A pressable thing that lays a ground (`hover:bg-…`, `data-…:bg-…`) has one of two shapes: a pill (`rounded-monti-full`), or 6px where SIX_PX says
 * why. Any other corner (`rounded-monti-sm`, `-lg`, `-xl`, `rounded-[5px]`) is the fragment this rule stops. Checked per class string.
 */
function checkControlShapes() {
	const uiDir = path.join(root, "packages/ui/src");
	for (const full of sourcesUnder(uiDir, ["__test__", "node_modules", "dist", "foundations", "screens", "spec-pack"])) {
		if (!inTargets(full) || /\.(stories|test)\./.test(full)) continue;
		const file = path.relative(path.join(root, "packages"), full).split(path.sep).join("/");
		const source = readFileSync(full, "utf8");
		const allowed = allowedLines(full, lex(source));
		for (const literal of source.matchAll(/"(?:[^"\\\n]|\\.)*"|`(?:[^`\\]|\\.)*`/g)) {
			const line = source.slice(0, literal.index).split("\n").length;
			if (allowed.has(line)) continue;
			const words = literal[0]
				.slice(1, -1)
				.replace(/\$\{[^}]*\}/g, " ")
				.split(/\s+/)
				.filter(Boolean);
			const last = (word) => splitTop(word, ":").at(-1).text.replace(/^!/, "");
			// Pressable with a ground: a background laid on hover, press or a state (a row pointed at, a toggle's pressed cell). A control that lays no
			// ground (a text button) shows no corner, so its corner is not a shape.
			if (!words.some((word) => word.includes(":") && /^bg-monti-/.test(last(word)))) continue;
			for (const word of words) {
				if (word.includes(":")) continue;
				const corner = /^rounded(?:-[a-z]{1,2})?-(.+)$/.exec(word);
				if (!corner) continue;
				const size = corner[1];
				if (size === "monti-full" || size === "none" || size === "(--cell-radius)") continue;
				if (size === "monti-md" && SIX_PX.has(file)) continue;
				if (CHECK_MARKS.get(file) === word) continue;
				add(full, line, "control-shape", `\`${word}\`: a pressable thing is a pill, or 6px where SIX_PX names why`);
			}
		}
	}
	if (targets.length > 0) return;
	for (const file of SIX_PX.keys())
		if (!existsSync(path.join(root, "packages", file)))
			add(path.join(root, "packages", file), 1, "control-shape", "SIX_PX names a file that is gone");
}
checkControlShapes();

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
	"control-shape":
		"Pressable things are pills; 6px only for rows in floating menus and blocks taller than a line (SIX_PX, the shape rule in button.md).",
	"fixed-height":
		"Controls stand at the height tokens (control-lg/md/sm/xs); a fixed row or box height is listed in FIXED_HEIGHTS with its reason.",
	"icon-list": "Icons come from the one list, packages/ui/src/icons.ts; add a new icon there first.",
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
