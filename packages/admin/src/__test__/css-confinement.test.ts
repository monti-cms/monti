// @vitest-environment node
import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import postcss from "postcss";
import { beforeAll, describe, expect, it } from "vitest";

/**
 * CSS confinement. The admin and plugin stylesheets ship prebuilt (`scripts/build-styles.mjs`), so the host needs no Tailwind and imports them as they are.
 * The sources only use names carrying the `monti` prefix, and the built files must not restyle the host: every selector sits under a document that
 * contains the admin, and every custom property, keyframes name is `monti`-prefixed, and no layer is left.
 */
const packagesDir = path.resolve(__dirname, "../../..");
const buildScript = path.resolve(packagesDir, "../scripts/build-styles.mjs");
const themeCss = readFileSync(path.resolve(__dirname, "../../../ui/styles/theme.css"), "utf8");
/** The token values (`@monti-cms/ui/tokens.css`) and the admin's own hand-written rules, read together as the admin bundle reads them. */
const adminCss = [
	readFileSync(path.resolve(__dirname, "../../../ui/styles/tokens.css"), "utf8"),
	readFileSync(path.resolve(__dirname, "../../styles/admin.css"), "utf8"),
].join("\n");
/** Packages with an admin stylesheet (`styles/index.css`). */
/** (ai, mdx, seo and git-sync ship none: their utilities are compiled into the admin's file, which scans their sources.) */
const STYLE_PACKAGES = ["admin", "blocks"];

/** The app's (shadcn) color names: the admin neither uses them unprefixed nor defines them, under its prefix or not. */
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
const scoped = (selector: string) => /^(?::where\()?html\b.*?:has\(\.monti-admin\)/.test(selector.trim());

describe("admin CSS confinement", () => {
	it("the theme defines only monti-prefixed names, after clearing Tailwind's own", () => {
		// `@theme` holds the color roles per namespace (`--background-color-monti-*` and so on), the type roles, the one shadow, the radius names
		// (computed from `--monti-radius`), the three weights, the one tracking, `--font-sans`/`--font-mono` (mapped to `--monti-font-*`), and the resets.
		const theme = themeCss.match(/@theme inline \{([\s\S]*?)\n\}/)?.[1] ?? "";
		const names = [...theme.matchAll(/(--[\w-]+(?:-\*)?)\s*:/g)].map((m) => m[1]);
		expect(names.filter((name) => name.startsWith("--background-color-monti-")).length).toBeGreaterThan(0);
		for (const name of names)
			expect(name).toMatch(
				/^--(?:(?:background-color|text-color|border-color|ring-color|ring-offset-color|outline-color|fill|stroke|text-decoration-color|caret-color|accent-color|text|shadow)-monti-|radius-(?:sm|md|lg|xl)$|font-(?:sans|mono)$|font-weight-(?:normal|medium|semibold)$|tracking-caps$|spacing-[a-z]+$|size-(?:icon|control)(?:-[a-z]+)?$|height-control(?:-[a-z]+)?$|container-[a-z-]+$|animate-monti-[a-z-]+$|color-(?:transparent|current|inherit)$|[a-z-]+-\*$)/,
			);
		// Tailwind's palette, text sizes, weights, shadows, tracking and line heights are cleared, so an off-system class compiles to nothing.
		for (const reset of [
			"--color-*",
			"--text-*",
			"--font-weight-*",
			"--shadow-*",
			"--tracking-*",
			"--leading-*",
			"--radius-*",
		])
			expect(theme).toContain(`${reset}: initial;`);
		for (const font of theme.matchAll(/--font-(?:sans|mono):\s*([^;]+);/g)) expect(font[1]).toContain("--monti-font-");
		for (const radius of theme.matchAll(/--radius-[a-z]+:\s*([^;]+);/g)) expect(radius[1]).toContain("--monti-radius");
		// Every role reads an admin variable.
		for (const role of theme.matchAll(/--[a-z-]+-monti-[a-z-]+:\s*([^;]+);/g))
			expect(role[1]).toMatch(/^var\(--monti-|^\d/);
		// Variant names also start with `monti-`.
		for (const variant of themeCss.matchAll(/@custom-variant\s+([\w-]+)/g)) expect(variant[1]).toMatch(/^monti-/);
		// The dark theme follows both `.dark` and `[data-theme="dark"]`.
		expect(themeCss).toMatch(/@custom-variant monti-dark[^;]*\.dark[^;]*\[data-theme="dark"\]/);
		expect(adminCss).toMatch(/html:is\(\.dark, \[data-theme="dark"\]\):has\(\.monti-admin\)/);
	});

	it("the default token values have zero specificity, so a site's own --monti-* wins in any import order", () => {
		const holders: string[] = [];
		postcss.parse(adminCss).walkRules((rule) => {
			if (rule.nodes.some((node) => node.type === "decl" && node.prop === "--monti-bg-page"))
				holders.push(rule.selector);
		});
		// One block for light, one for dark; each is a single `:where(...)`, so nothing outside it adds specificity.
		expect(holders).toHaveLength(2);
		for (const selector of holders) expect(selector).toMatch(/^:where\((?:[^()]|\([^()]*\))*\)$/);
	});

	it("each token block sets color-scheme, so light-dark() works in a site's override", () => {
		const schemes = new Map<string, string>();
		postcss.parse(adminCss).walkRules((rule) => {
			if (!rule.nodes.some((node) => node.type === "decl" && node.prop === "--monti-bg-page")) return;
			const scheme = rule.nodes.find((node) => node.type === "decl" && node.prop === "color-scheme");
			schemes.set(rule.selector.includes(".dark") ? "dark" : "light", scheme?.type === "decl" ? scheme.value : "");
		});
		expect(Object.fromEntries(schemes)).toEqual({ light: "light", dark: "dark" });
	});

	it("a role that points at a scale is declared once, so overriding the scale restyles it in both modes", () => {
		const blocks: Record<string, Map<string, string>> = {};
		postcss.parse(adminCss).walkRules((rule) => {
			if (!rule.nodes.some((node) => node.type === "decl" && node.prop === "--monti-bg-page")) return;
			const decls = new Map<string, string>();
			for (const node of rule.nodes) if (node.type === "decl") decls.set(node.prop, node.value);
			blocks[rule.selector.includes(".dark") ? "dark" : "light"] = decls;
		});
		const scaled = [...blocks.light].filter(([, value]) =>
			/^var\(--monti-(gray|accent|danger|warning|success)-\d+\)$/.test(value),
		);
		expect(scaled.length).toBeGreaterThan(20);
		expect(Object.fromEntries(scaled)).toMatchObject({
			"--monti-fg-default": "var(--monti-gray-12)",
			"--monti-fg-muted": "var(--monti-gray-11)",
			"--monti-border-focus": "var(--monti-accent-9)",
			"--monti-bg-accent-muted": "var(--monti-accent-3)",
		});
		for (const [name] of scaled) expect(blocks.dark.has(name)).toBe(false);
		// Every scale step exists in both modes.
		const steps = [...blocks.light.keys()].filter((name) =>
			/^--monti-(gray|accent|danger|warning|success)-\d+$/.test(name),
		);
		expect(steps.length).toBe(12 + 4 * 5);
		for (const step of steps) expect(blocks.dark.has(step)).toBe(true);
	});

	it("the accent exists in both modes, readable as text, and the focus ring follows it", () => {
		const luminance = (hex: string) => {
			const [r, g, b] = [1, 3, 5].map((i) => {
				const v = Number.parseInt(hex.slice(i, i + 2), 16) / 255;
				return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
			});
			return 0.2126 * r + 0.7152 * g + 0.0722 * b;
		};
		const contrast = (a: string, b: string) => {
			const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
			return (hi + 0.05) / (lo + 0.05);
		};
		const modes: Record<string, { accent: string; background: string }> = {};
		postcss.parse(adminCss).walkRules((rule) => {
			const value = (prop: string) => {
				const decl = rule.nodes.find((node) => node.type === "decl" && node.prop === prop);
				return decl?.type === "decl" ? decl.value : "";
			};
			if (!value("--monti-bg-page")) return;
			modes[rule.selector.includes(".dark") ? "dark" : "light"] = {
				accent: value("--monti-accent-11"),
				background: value("--monti-bg-page"),
			};
		});
		expect(Object.keys(modes).sort()).toEqual(["dark", "light"]);
		for (const { accent, background } of Object.values(modes)) {
			expect(accent).toMatch(/^#[\da-f]{6}$/);
			expect(contrast(accent, background)).toBeGreaterThanOrEqual(4.5);
		}
		expect(themeCss).toContain("--ring-color-monti-focus: var(--monti-border-focus)");
	});

	it("the theme keeps the admin's own names only", () => {
		// Tailwind's `--radius*` is not defined by the hand-written rules.
		expect(adminCss).not.toMatch(/^\s*--radius/m);
	});

	it("color variables only define --monti-* names", () => {
		const definitions = [...adminCss.matchAll(/^\t(--[\w-]+)\s*:/gm)].map((m) => m[1]);
		const colorVars = definitions.filter((name) => new RegExp(`^--(?:monti-)?(${TOKENS})$`).test(name));
		expect(colorVars).toEqual([]);
		expect(definitions.filter((name) => !name.startsWith("--monti-"))).toEqual([]);
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
				// Every custom property the file declares (and registers) is `--monti-*`.
				const declared = new Set<string>();
				root.walkDecls((decl) => {
					if (decl.prop.startsWith("--")) declared.add(decl.prop);
				});
				root.walkAtRules("property", (rule) => {
					declared.add(rule.params.trim());
				});
				expect([...declared].filter((name) => !name.startsWith("--monti-"))).toEqual([]);
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
				expect(keyframes.filter((name) => !name.startsWith("monti-"))).toEqual([]);
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
			expect(selectors).toContain(":where(html:has(.monti-admin)) button");
			expect(css).toContain(":where(html:has(.monti-admin)){color-scheme:light;--monti-gray-1:");
			expect(css).toContain(
				":where(html:is(.dark,[data-theme=dark]):has(.monti-admin)){color-scheme:dark;--monti-gray-1:",
			);
			expect(css).toContain(".katex");
			expect(css).toContain("KaTeX_Main");
			// The host's Tailwind names are not redefined: no `--radius*`, `--color-*`, `--spacing`, `--font-*` declaration.
			expect(css).not.toMatch(/(?:^|[;{])--(?:radius|color|spacing|font|text|shadow|ease|animate)(?:-[\w-]+)?:/);
			// Radius utilities are computed from the admin's own base radius.
			expect(css).toMatch(/border-radius:calc\(var\(--monti-radius\)/);
		});
	});

	it("admin and extension screen sources use no app-named color classes or dark: variants", () => {
		const offenders: string[] = [];
		const color = new RegExp(`(?<![\\w-])(?:${UTILITIES})-(?:${TOKENS})(?![\\w-])`, "g");
		const variable = new RegExp(`\\(\\s*--(?:color-)?(?:${TOKENS})(?![\\w-])`, "g");
		const dark = /(?<=[\s"'`:!([])dark:(?=[^\s,])/g;
		const orientation = /(?<![\w-])(?:group-|peer-|in-|has-)*data-(?:horizontal|vertical)(?![\w-[])/g;
		for (const pkg of ["core", "admin", "blocks", "mdx", "seo", "ai", "bareun", "git-sync"]) {
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
