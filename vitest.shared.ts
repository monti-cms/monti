import path from "node:path";
import { loadEnv } from "vite";
import { configDefaults, defineConfig } from "vitest/config";

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
	/** Loads the testing-library timeout and the browser APIs jsdom lacks (`packages/admin/src/test/setup-dom.ts`). */
	readonly dom?: boolean;
	/** Test files, relative to the package (default: every `src/**` test). */
	readonly include?: readonly string[];
	/** Files left out, on top of node_modules and the other defaults. */
	readonly exclude?: readonly string[];
	readonly site?: TestSite;
	/** Module aliases the package needs on top of `server-only`. */
	readonly alias?: readonly { find: string | RegExp; replacement: string }[];
}

export const packageTests = (options: PackageTestsOptions) =>
	defineConfig(({ mode }) => ({
		test: {
			name: !options.site || options.site === "blog" ? options.name : `${options.name} (${options.site})`,
			environment: options.environment ?? "node",
			globals: true,
			include: [...(options.include ?? ["src/**/*.{test,spec}.{ts,tsx}"])],
			exclude: [...configDefaults.exclude, ...(options.exclude ?? [])],
			setupFiles: options.dom ? [path.join(ROOT, "packages/admin/src/test/setup-dom.ts")] : [],
			testTimeout: 60000,
			hookTimeout: 60000,
			env: {
				// The same `.env.local` whether the suite runs from the repo root or from the package; a package's own file wins.
				...loadEnv(mode, ROOT, ""),
				...loadEnv(mode, options.dir, ""),
				// Production (Vercel) runs in UTC. Running tests in the local time zone would let regressions in time-zone-sensitive logic,
				// such as displayed dates, slip through on developer machines only.
				TZ: "UTC",
				...(options.site && options.site !== "blog" ? { MONTI_TEST_SITE: options.site } : {}),
			},
		},
		resolve: {
			alias: [
				{ find: "server-only", replacement: path.join(ROOT, "packages/core/test/server-only.ts") },
				...(options.alias ?? []),
			],
		},
	}));
