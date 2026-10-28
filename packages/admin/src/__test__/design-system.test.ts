// @vitest-environment node
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * The admin uses the design system only. `@monti-cms/ui`'s `styles/theme.css` clears Tailwind's palette, text sizes, weights, shadows, tracking and line heights,
 * so a class outside the system compiles to nothing; this test names each such class with its file and line instead of letting it vanish.
 * Spacing on screens takes the design system's scale (`gap-monti-8`); the components of `@monti-cms/ui` may use in-between numbers of their own.
 */
const packagesDir = path.resolve(__dirname, "../../..");
const themeCss = readFileSync(path.resolve(__dirname, "../../../ui/styles/theme.css"), "utf8");
/** The packages whose classes the admin stylesheet compiles (its `@source` lines): the admin UI. Core's code block line effects are site config, not admin UI. */
const ADMIN_UI_PACKAGES = [
	...readFileSync(path.resolve(__dirname, "../../styles/index.css"), "utf8").matchAll(
		/^@source "(?:\.\.\/\.\.\/)?([\w-]+|\.\.)\/src";/gm,
	),
].map((m) => (m[1] === ".." ? "admin" : m[1]));

/** Role names per namespace, read from the generated theme, so adding a role to `tokens.json` is all it takes. */
function roles(namespace: string): Set<string> {
	return new Set(
		[...themeCss.matchAll(new RegExp(`--${namespace}-monti-([a-z-]+?)(?:--[a-z-]+)?:`, "g"))].map((m) => m[1]),
	);
}
const ROLES: Record<string, Set<string>> = {
	bg: roles("background-color"),
	// The type roles are utilities of their own (`@utility text-monti-body`), the colors are theme variables.
	text: new Set([...roles("text-color"), ...[...themeCss.matchAll(/@utility text-monti-([\w-]+)/g)].map((m) => m[1])]),
	border: roles("border-color"),
	divide: roles("border-color"),
	ring: roles("ring-color"),
	"ring-offset": roles("ring-offset-color"),
	outline: roles("outline-color"),
	fill: roles("fill"),
	stroke: roles("stroke"),
	decoration: roles("text-decoration-color"),
	caret: roles("caret-color"),
	shadow: roles("shadow"),
};
const KEYWORDS = new Set(["transparent", "current", "inherit"]);
/** The spacing scale (`--spacing-monti-*` in the theme): gaps, padding and margins use these, plus `0` and `px`. */
const SPACING = new Set([...themeCss.matchAll(/--spacing-(monti-\d+):/g)].map((m) => m[1]));
/** Files that draw something other than the admin and keep its colors on purpose. */
const OWN_COLORS = new Set([
	// Imitates a search result page, so it uses that page's link colors.
	"seo/src/admin/preview.tsx",
]);

/** Files whose text runs over several lines in a field, which takes the design system's own line of 1.6 times the size (`.mt-textarea`), not a type role's. */
const MULTILINE = new Set(["ui/src/textarea.tsx"]);

/** The conversation's own line heights: 1.6 times the size in the admin's bubble and 1.7 in the assistant's answer (`.mt-msg-user`, the answer text). */
const CHAT_LINES = { file: "ui/src/chat-message.tsx", utilities: new Set(["leading-[1.6]", "leading-[1.7]"]) };

/** The modal's own type, which no role covers: a 20px title (28px line, -0.015em) and text at 1.65 times the size (`.mt-dialog-title`, `.mt-dialog` text). */
const MODAL_TEXT = {
	file: "ui/src/dialog.tsx",
	utilities: new Set(["text-[20px]", "leading-[28px]", "tracking-[-0.015em]", "leading-[1.65]"]),
};

/** The translation marker's text, 10px, the one size under the micro role (`.mt-marker`). */
const MARKER_TEXT = { file: "ui/src/marker.tsx", utilities: new Set(["text-[10px]"]) };

/** The heading icon's level number, 8px mono in the corner of the 16px glyph (`.mt-ico-level .lv`). */
const LEVEL_TEXT = { file: "ui/src/heading-icon.tsx", utilities: new Set(["text-[8px]", "leading-[8px]"]) };

function sourceFiles(dir: string): string[] {
	return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
		const full = path.join(dir, entry.name);
		if (entry.isDirectory()) return ["__test__", "node_modules", "dist"].includes(entry.name) ? [] : sourceFiles(full);
		return /\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) ? [full] : [];
	});
}

/** Every class-like word inside a string or template literal, with its line. */
function classWords(source: string): { word: string; line: number }[] {
	const out: { word: string; line: number }[] = [];
	for (const literal of source.matchAll(/"(?:[^"\\\n]|\\.)*"|`(?:[^`\\]|\\.)*`/g)) {
		const line = source.slice(0, literal.index).split("\n").length;
		for (const word of literal[0]
			.slice(1, -1)
			.replace(/\$\{[^}]*\}/g, " ")
			.split(/\s+/))
			if (word) out.push({ word, line });
	}
	return out;
}

/** The utility of a class without its variants (`hover:`, `monti-dark:`, `[&_svg]:`) and `!`. */
function utilityOf(word: string): string {
	let depth = 0;
	let last = -1;
	for (let i = 0; i < word.length; i++) {
		if (word[i] === "[") depth++;
		else if (word[i] === "]") depth--;
		else if (word[i] === ":" && depth === 0) last = i;
	}
	return word.slice(last + 1).replace(/^!/, "");
}

/** Why a utility is outside the system, or null. */
function problem(utility: string, inUi: boolean, ownColors: boolean): string | null {
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
		if (
			/^(slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|black|white)(-\d+)?$/.test(
				name,
			)
		)
			return ownColors ? null : "Tailwind palette color";
		if (kind === "text" && /^(xs|sm|base|lg|[2-9]?xl)$/.test(name)) return "Tailwind text size: use text-monti-<role>";
		if (kind === "shadow" && /^(2xs|xs|sm|md|lg|xl|2xl)$/.test(name))
			return "Tailwind shadow: use shadow-monti-floating or none";
		if (KEYWORDS.has(name) && !alpha) return null;
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

describe("design system", () => {
	it("each parser finds something: the admin UI packages, a role of every kind, and the spacing scale", () => {
		expect(ADMIN_UI_PACKAGES.length).toBeGreaterThan(0);
		for (const [kind, names] of Object.entries(ROLES)) expect(names.size, kind).toBeGreaterThan(0);
		expect(SPACING.size).toBeGreaterThan(0);
	});

	it("takes a role of the parsed theme and refuses a made-up one, and names an off-system class", () => {
		const role = [...ROLES.bg][0] as string;
		const space = [...SPACING][0] as string;
		expect(problem(`bg-monti-${role}`, false, false)).toBeNull();
		expect(problem(`bg-monti-${role}/90`, false, false)).toBeNull();
		expect(problem("bg-monti-not-a-role", false, false)).toMatch(/unknown role/);
		expect(problem(`gap-${space}`, false, false)).toBeNull();
		expect(problem("-mt-monti-4", false, false)).toBeNull();
		expect(problem("gap-roomy", false, false)).toMatch(/use the scale/);
		expect(problem("gap-2", false, false)).toMatch(/use the scale/);
		expect(problem("gap-1.5", true, false)).toBeNull();
		expect(problem("mx-auto", false, false)).toBeNull();
		expect(problem("text-xs", false, false)).toMatch(/text size/);
		expect(problem("rounded-md", false, false)).toMatch(/unprefixed radius/);
		expect(problem("bg-red-500", false, false)).toMatch(/palette/);
		expect(problem("text-[#fff]", false, false)).toMatch(/arbitrary color/);
		expect(problem("leading-relaxed", false, false)).toMatch(/line height/);
	});

	it("is the only thing the admin and its plugins use", () => {
		const offenders: string[] = [];
		for (const pkg of ADMIN_UI_PACKAGES) {
			for (const file of sourceFiles(path.join(packagesDir, pkg, "src"))) {
				const rel = path.relative(packagesDir, file);
				const inUi = rel.startsWith("ui/src/") || rel.startsWith("admin/src/ui/");
				for (const { word, line } of classWords(readFileSync(file, "utf8"))) {
					const utility = utilityOf(word);
					const why = problem(utility, inUi, OWN_COLORS.has(rel));
					if (why && MULTILINE.has(rel) && utility === "leading-[1.6]") continue;
					if (why && rel === CHAT_LINES.file && CHAT_LINES.utilities.has(utility)) continue;
					if (why && rel === MODAL_TEXT.file && MODAL_TEXT.utilities.has(utility)) continue;
					if (why && rel === MARKER_TEXT.file && MARKER_TEXT.utilities.has(utility)) continue;
					if (why && rel === LEVEL_TEXT.file && LEVEL_TEXT.utilities.has(utility)) continue;
					if (why) offenders.push(`${rel}:${line} ${word} (${why})`);
				}
			}
		}
		expect(offenders).toEqual([]);
	});
});
