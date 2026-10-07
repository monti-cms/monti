// @vitest-environment node
import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import postcss from "postcss";
import { beforeAll, describe, expect, it } from "vitest";

/**
 * CSS confinement. The admin and plugin stylesheets ship prebuilt (`scripts/build-styles.mjs`), so the host needs no Tailwind and imports them as they are.
 * The sources only use names carrying the `cms` prefix, and the built files must not restyle the host: every selector sits under a document that
 * contains the admin, and every custom property, keyframes name is `cms`-prefixed, and no layer is left.
 */
const packagesDir = path.resolve(__dirname, "../../..");
const buildScript = path.resolve(packagesDir, "../scripts/build-styles.mjs");
const themeCss = readFileSync(path.resolve(__dirname, "../../styles/theme.css"), "utf8");
const adminCss = readFileSync(path.resolve(__dirname, "../../styles/admin.css"), "utf8");
/** Packages with an admin stylesheet (`styles/index.css`). */
/** (ai, mdx and seo ship none: their utilities are compiled into the admin's file, which scans their sources.) */
const STYLE_PACKAGES = ["admin", "blocks"];

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

/** Selectors of every rule (keyframe steps excluded), split at top-level commas. */
function selectorsOf(root: postcss.Root): string[] {
	const out: string[] = [];
	root.walkRules((rule) => {
		const parent = rule.parent;
		if (parent?.type === "atrule" && /keyframes$/.test((parent as postcss.AtRule).name)) return;
		out.push(...rule.selectors);
	});
	return out;
}
/** Whether a selector sits under a document that contains the admin. */
const scoped = (selector: string) => /^(?::where\()?html\b.*?:has\(\.cms-admin\)/.test(selector.trim());

describe("admin CSS confinement", () => {
	it("the theme defines only cms-prefixed names", () => {
		// `@theme` holds `--color-cms-*` and the radius names (inlined into the bundle, computed from `--cms-radius`).
		const theme = themeCss.match(/@theme inline \{([\s\S]*?)\n\}/)?.[1] ?? "";
		const names = [...theme.matchAll(/(--[\w-]+)\s*:/g)].map((m) => m[1]);
		expect(names.filter((name) => name.startsWith("--color-cms-")).length).toBeGreaterThan(0);
		for (const name of names) expect(name).toMatch(/^--(?:color-cms-|radius-(?:sm|md|lg|xl)$)/);
		for (const radius of theme.matchAll(/--radius-[a-z]+:\s*([^;]+);/g)) expect(radius[1]).toContain("--cms-radius");
		// Variant names also start with `cms-`.
		for (const variant of themeCss.matchAll(/@custom-variant\s+([\w-]+)/g)) expect(variant[1]).toMatch(/^cms-/);
		// The dark theme follows both `.dark` and `[data-theme="dark"]`.
		expect(themeCss).toMatch(/@custom-variant cms-dark[^;]*\.dark[^;]*\[data-theme="dark"\]/);
		expect(adminCss).toMatch(/html:is\(\.dark, \[data-theme="dark"\]\):has\(\.cms-admin\)/);
		// Tailwind's `--radius*` is not defined by the hand-written rules.
		expect(adminCss).not.toMatch(/^\s*--radius/m);
	});

	it("color variables only define --cms-* names", () => {
		const definitions = [...adminCss.matchAll(/^\t(--[\w-]+)\s*:/gm)].map((m) => m[1]);
		const colorVars = definitions.filter((name) => new RegExp(`^--(${TOKENS})$`).test(name));
		expect(colorVars).toEqual([]);
		expect(definitions.filter((name) => !name.startsWith("--cms-"))).toEqual([]);
	});

	describe("prebuilt stylesheets", () => {
		const built = new Map<string, string>();
		beforeAll(() => {
			for (const pkg of STYLE_PACKAGES) {
				const cwd = path.join(packagesDir, pkg);
				const css = execFileSync("node", [buildScript, "--stdout"], {
					cwd,
					encoding: "utf8",
					maxBuffer: 64 * 1024 * 1024,
				});
				built.set(pkg, css);
			}
		}, 120_000);

		for (const pkg of STYLE_PACKAGES) {
			it(`${pkg}: no unscoped selector, no global custom property, no layer, no foreign keyframes`, () => {
				const css = built.get(pkg) ?? "";
				expect(css.length).toBeGreaterThan(0);
				const root = postcss.parse(css);
				// Every selector sits under a document that contains the admin.
				expect(selectorsOf(root).filter((selector) => !scoped(selector))).toEqual([]);
				// Every custom property the file declares (and registers) is `--cms-*`.
				const declared = new Set<string>();
				root.walkDecls((decl) => {
					if (decl.prop.startsWith("--")) declared.add(decl.prop);
				});
				root.walkAtRules("property", (rule) => {
					declared.add(rule.params.trim());
				});
				expect([...declared].filter((name) => !name.startsWith("--cms-"))).toEqual([]);
				// No Tailwind, theme or import directive is left in the output, and the host's names are not used as keyframes.
				const directives: string[] = [];
				const layers: string[] = [];
				const keyframes: string[] = [];
				const forbidden = [
					"import",
					"source",
					"theme",
					"plugin",
					"utility",
					"custom-variant",
					"tailwind",
					"apply",
					"config",
				];
				root.walkAtRules((rule) => {
					if (forbidden.includes(rule.name)) directives.push(`@${rule.name}`);
					if (rule.name === "layer") {
						layers.push(
							...rule.params
								.split(",")
								.map((name) => name.trim())
								.filter(Boolean),
						);
					}
					if (/keyframes$/.test(rule.name)) keyframes.push(rule.params);
				});
				expect(directives).toEqual([]);
				// Layers are flattened: a layered rule would rank against the host's layers by load order and could lose to its `.hidden` or `.prose`.
				expect(layers).toEqual([]);
				expect(keyframes.filter((name) => !name.startsWith("cms-"))).toEqual([]);
			});
		}

		it("no selector is defined in more than one bundle", () => {
			// Bundles load one after another (admin first). A second copy of `.prose` or another shared utility in a plugin's file would load later and
			// reset what the admin's dark variant had set, so a file defines only rules of its own.
			const owner = new Map<string, string>();
			const duplicates: string[] = [];
			for (const pkg of STYLE_PACKAGES) {
				const seen = new Set<string>();
				postcss.parse(built.get(pkg) ?? "").walkRules((rule) => {
					const parent = rule.parent;
					if (parent?.type === "atrule" && /keyframes$/.test((parent as postcss.AtRule).name)) return;
					const context =
						parent?.type === "atrule" ? `${(parent as postcss.AtRule).name} ${(parent as postcss.AtRule).params}` : "";
					for (const selector of rule.selectors) {
						const key = `${context}|${selector}`;
						const first = owner.get(key);
						if (first && first !== pkg) duplicates.push(`${selector} (${first}, ${pkg})`);
						seen.add(key);
					}
				});
				for (const key of seen) if (!owner.has(key)) owner.set(key, pkg);
			}
			expect(duplicates).toEqual([]);
		});

		it("no bundle reads Tailwind's own --tw-* variables under their original name", () => {
			for (const pkg of STYLE_PACKAGES) expect(built.get(pkg) ?? "").not.toMatch(/(?<![\w-])--tw-/);
		});

		it("every utility the admin and the first-party plugins use is in the admin CSS", () => {
			const cwd = path.join(packagesDir, "admin");
			const out = execFileSync("node", [buildScript, "--missing"], {
				cwd,
				encoding: "utf8",
				maxBuffer: 64 * 1024 * 1024,
			});
			// Tailwind decides what is a utility; one it knows in a source file but the bundle lacks means the scan missed that file.
			expect(JSON.parse(out) as string[]).toEqual([]);
		});

		it("admin: the reset is scoped, the tokens and color-scheme stay, KaTeX is included, and no radius name leaks", () => {
			const css = built.get("admin") ?? "";
			const selectors = selectorsOf(postcss.parse(css));
			// Tailwind's preflight is there, but only under the scope (the check above rejects a bare `*`, `body` or `button`).
			expect(selectors).toContain(":where(html:has(.cms-admin)) button");
			expect(css).toContain("html:has(.cms-admin){--cms-background:");
			expect(css).toMatch(/html:is\(\.dark,\[data-theme=dark\]\):has\(\.cms-admin\)\{[^}]*color-scheme:dark/);
			expect(css).toContain(".katex");
			expect(css).toContain("KaTeX_Main");
			// The host's Tailwind names are not redefined: no `--radius*`, `--color-*`, `--spacing`, `--font-*` declaration.
			expect(css).not.toMatch(/(?:^|[;{])--(?:radius|color|spacing|font|text|shadow|ease|animate)(?:-[\w-]+)?:/);
			// Radius utilities are computed from the admin's own base radius.
			expect(css).toMatch(/border-radius:calc\(var\(--cms-radius\)/);
		});
	});

	it("admin and extension screen sources use no app-named color classes or dark: variants", () => {
		const offenders: string[] = [];
		const color = new RegExp(`(?<![\\w-])(?:${UTILITIES})-(?:${TOKENS})(?![\\w-])`, "g");
		const variable = new RegExp(`\\(\\s*--(?:color-)?(?:${TOKENS})(?![\\w-])`, "g");
		const dark = /(?<=[\s"'`:!([])dark:(?=[^\s,])/g;
		const orientation = /(?<![\w-])(?:group-|peer-|in-|has-)*data-(?:horizontal|vertical)(?![\w-[])/g;
		for (const pkg of ["core", "admin", "blocks", "mdx", "seo", "ai", "bareun"]) {
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
