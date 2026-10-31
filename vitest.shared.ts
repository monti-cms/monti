import path from "node:path";
import { playwright } from "@vitest/browser-playwright";
import { loadEnv } from "vite";
import { configDefaults, defineConfig } from "vitest/config";
import type { BrowserCommand } from "vitest/node";

/**
 * The one shape of a package's test project. Each `packages/<name>/vitest*.config.ts` calls {@link packageTests} with what differs (its name, environment,
 * files and site variant); the timeouts, the env files, UTC, the `server-only` stand-in and the browser API fill-ins are set here once.
 */

const ROOT = import.meta.dirname;

/** The site config the suites run against (`test/site.ts` of a package reads it from `MONTI_TEST_SITE`). */
export type TestSite = "blog" | "other-site" | "configured";

export interface PackageTestsOptions {
	/** The package folder (`import.meta.dirname` of the config file). */
	readonly dir: string;
	/** The package's short name (`core`, `admin`); a site variant adds ` (other-site)` or ` (configured)` to it. */
	readonly name: string;
	/** `node` for server code; `jsdom` when most files render. A file can still switch with `// @vitest-environment jsdom`. */
	readonly environment?: "node" | "jsdom";
	/** Loads jest-dom, the testing-library timeout and the browser APIs jsdom lacks (`packages/admin/src/test/setup-dom.ts`). */
	readonly dom?: boolean;
	/** Test files, relative to the package (default: every `src/**` test). */
	readonly include?: readonly string[];
	/** Files left out, on top of node_modules and the other defaults. */
	readonly exclude?: readonly string[];
	readonly site?: TestSite;
	/**
	 * The layer of `docs/testing.md` the project runs. Unset, it runs L1: every test file except those of the other layers (unless `include` names
	 * the files). `int` runs the L2 files, `*.int.test.ts`; `dom` runs the L3 files that need no layout, `*.dom.test.ts(x)`, in `environment`;
	 * `browser` runs the L3 files that need layout, focus or the editor, `*.browser.test.ts(x)`, in Chromium (Vitest browser mode with Playwright).
	 * The name gets ` (int)`, ` (dom)` or ` (browser)`.
	 */
	readonly layer?: "int" | "dom" | "browser";
	/** Module aliases the package needs on top of `server-only`. */
	readonly alias?: readonly { find: string | RegExp; replacement: string }[];
	/** Functions a `browser` test calls with `commands` of `vitest/browser`; they run in Node, for what cannot load in a browser. */
	// biome-ignore lint/suspicious/noExplicitAny: each command declares its own arguments in `BrowserCommands`.
	readonly commands?: Record<string, BrowserCommand<any[]>>;
}

/**
 * The test files of a layer (`docs/testing.md`): L2 needs Postgres, the file system or a child process; L3 needs a DOM, and a real browser when
 * it needs layout.
 */
const LAYER_TESTS = {
	int: "src/**/*.int.test.ts",
	dom: "src/**/*.dom.test.{ts,tsx}",
	browser: "src/**/*.browser.test.{ts,tsx}",
} as const;

/**
 * The real browser of the `browser` layer. The viewport is the size the admin is designed at (`docs/design/admin`), and the clock is UTC like the
 * `TZ` of the node projects below.
 */
const browserMode = (commands: PackageTestsOptions["commands"]) => ({
	enabled: true,
	provider: playwright({ contextOptions: { timezoneId: "UTC" } }),
	headless: true,
	instances: [{ browser: "chromium" as const }],
	viewport: { width: 1440, height: 900 },
	screenshotFailures: false,
	...(commands ? { commands } : {}),
});

/** `core`, `core (int)`, `core (other-site)`. */
const projectName = (options: PackageTestsOptions): string => {
	const variants = [options.layer, options.site === "blog" ? undefined : options.site].filter(Boolean);
	return variants.length === 0 ? options.name : `${options.name} (${variants.join(", ")})`;
};

export const packageTests = (options: PackageTestsOptions) =>
	defineConfig(({ mode }) => ({
		test: {
			name: projectName(options),
			environment: options.environment ?? "node",
			globals: true,
			include: [
				...(options.include ?? (options.layer ? [LAYER_TESTS[options.layer]] : ["src/**/*.{test,spec}.{ts,tsx}"])),
			],
			exclude: [
				...configDefaults.exclude,
				...(options.include || options.layer ? [] : Object.values(LAYER_TESTS)),
				// Browser files fail outside a browser, so a project that names its files itself (other-site, mutation) still leaves them out.
				...(options.layer === "browser" ? [] : [LAYER_TESTS.browser]),
				...(options.exclude ?? []),
			],
			...(options.layer === "browser" ? { browser: browserMode(options.commands) } : {}),
			setupFiles: options.dom ? [path.join(ROOT, "packages/admin/src/test/setup-dom.ts")] : [],
			testTimeout: 60000,
			hookTimeout: 60000,
			env: {
				// The same `.env.local` whether the suite runs from the repo root or from the package; a package's own file wins. Not in a browser
				// project: its values would reach the page, and the files hold secrets.
				...(options.layer === "browser" ? {} : { ...loadEnv(mode, ROOT, ""), ...loadEnv(mode, options.dir, "") }),
				// Production (Vercel) runs in UTC. Running tests in the local time zone would let regressions in time-zone-sensitive logic,
				// such as displayed dates, slip through on developer machines only.
				TZ: "UTC",
				...(options.site && options.site !== "blog" ? { MONTI_TEST_SITE: options.site } : {}),
			},
		},
		// Code a browser test imports still reads `process.env` (the site variant of `packages/core/test/site-under-test.ts`). The browser has no `process`,
		// so these few values are written into the code.
		...(options.layer === "browser"
			? {
					define: {
						"process.env": JSON.stringify({
							NODE_ENV: "test",
							...(options.site && options.site !== "blog" ? { MONTI_TEST_SITE: options.site } : {}),
						}),
					},
				}
			: {}),
		resolve: {
			alias: [
				{ find: "server-only", replacement: path.join(ROOT, "packages/core/test/server-only.ts") },
				...(options.alias ?? []),
			],
		},
	}));
