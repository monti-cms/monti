import { existsSync, readFileSync, realpathSync } from "node:fs";
import path from "node:path";
import { findSchemaFile, watchSchemaTypes } from "@monti-cms/core/schema-types";
import type { NextConfig } from "next";

const PACKAGES = ["@monti-cms/core"];
/** Core-side packages. Only the optional peer dependencies of these and of CMS plugin packages are checked. */
const CORE_PACKAGES = ["@monti-cms/core", "@monti-cms/admin", "@monti-cms/nextjs"];
/** Marker a CMS plugin package puts in `package.json` (`"cmsPlugin": true`). The name does not matter. */
export const PLUGIN_MARKER = "cmsPlugin";
/** Module substituted for an optional dependency that is not installed (importing it raises an error telling you to install it). */
export const MISSING_OPTIONAL_MODULE = "@monti-cms/core/stubs/missing-optional";

const readJson = (file: string): Record<string, unknown> | undefined => {
	try {
		return JSON.parse(readFileSync(file, "utf8"));
	} catch {
		return undefined;
	}
};

/**
 * Whether `node_modules/<name>` exists, walking up from the `from` folder (same order as Node and bundler package lookup).
 * If `boundary` (Turbopack `root`) is given, nothing outside it is checked (Turbopack does not look there either).
 */
const installedFrom = (from: string, name: string, boundary?: string): boolean => {
	for (let dir = from; ; dir = path.dirname(dir)) {
		if (boundary && path.relative(boundary, dir).startsWith("..")) return false;
		if (existsSync(path.join(dir, "node_modules", name, "package.json"))) return true;
		if (path.dirname(dir) === dir) return false;
	}
};

/**
 * Optional peer dependencies of the CMS packages the app installed (core and admin packages, and plugin packages with `"cmsPlugin": true` in `package.json`)
 * (`peerDependenciesMeta.optional`) that are not installed.
 * Example: the block extension's Mermaid preview loads `mermaid` only when a preview is opened, but the bundler also tries to resolve `import("mermaid")` of extensions in use or not,
 * so the build stops if it is not installed.
 */
export function missingOptionalPeers(root: string, boundary?: string): string[] {
	const app = readJson(path.join(root, "package.json"));
	const deps = { ...(app?.dependencies as object), ...(app?.devDependencies as object) };
	const missing = new Set<string>();
	for (const name of Object.keys(deps)) {
		const dir = path.join(root, "node_modules", name);
		const meta = readJson(path.join(dir, "package.json"));
		if (!CORE_PACKAGES.includes(name) && meta?.[PLUGIN_MARKER] !== true) continue;
		const optional = Object.entries((meta?.peerDependenciesMeta ?? {}) as Record<string, { optional?: boolean }>)
			.filter(([, value]) => value?.optional)
			.map(([peer]) => peer);
		if (optional.length === 0) continue;
		const real = realpathSync(dir);
		for (const peer of optional) if (!installedFrom(real, peer, boundary)) missing.add(peer);
	}
	return [...missing].sort();
}

const WATCHING = Symbol.for("monti.schema-types.watching");

/**
 * Keeps the types of the site's schema file (`monti.schema.json` -> `monti-env.d.ts`) in step with it while the dev server runs: writes them at start and again
 * whenever the schema file changes (for example when it is edited by hand or saved from the admin). Does nothing outside development (a production build reads
 * the committed types), when the site has no schema file, or when `cwd` is already watched (Next loads its config more than once). A schema that does not parse is
 * reported and the last good types stay. Returns the function that stops the watch, or `undefined` if there is none.
 */
export function watchSchemaTypesInDev(
	cwd: string,
	env: { readonly NODE_ENV?: string } = process.env,
	log: (message: string) => void = console.log,
): (() => void) | undefined {
	if (env.NODE_ENV !== "development") return undefined;
	let schema: string;
	try {
		schema = findSchemaFile(cwd);
	} catch {
		return undefined;
	}
	const holder = globalThis as { [WATCHING]?: Set<string> };
	const registry = holder[WATCHING] ?? new Set<string>();
	holder[WATCHING] = registry;
	const key = path.resolve(cwd, schema);
	if (registry.has(key)) return undefined;
	registry.add(key);
	const stop = watchSchemaTypes({ cwd, schema, log, persistent: false });
	return () => {
		stop();
		registry.delete(key);
	};
}

/**
 * Adds the CMS wiring to the Next config. Builds package sources (TypeScript) together with the app, tells the server and browser bundles Next's `basePath`, and
 * points optional dependencies of CMS packages that are not installed (e.g. the block extension's `mermaid`) at an empty module (using that feature raises
 * an error telling you to install it).
 *
 * In development it also keeps the generated types of the schema file up to date (see {@link watchSchemaTypesInDev}).
 *
 * It links no config file: the site config and the server config are passed to `createCms` in the app's own server file, and the admin gets the site
 * from that instance.
 */
export function withCms(nextConfig: NextConfig): NextConfig {
	const turbopackRoot = nextConfig.turbopack?.root;
	const missing = missingOptionalPeers(
		process.cwd(),
		turbopackRoot ? realpathSync(path.resolve(process.cwd(), turbopackRoot)) : undefined,
	);
	const userWebpack = nextConfig.webpack;
	watchSchemaTypesInDev(process.cwd());

	return {
		...nextConfig,
		// Tells the server and browser bundles Next `basePath` (read by `cmsApiUrl()` and `withBasePath()`). Site code has nothing to do.
		env: { ...nextConfig.env, NEXT_PUBLIC_CMS_BASE_PATH: nextConfig.basePath?.replace(/\/+$/, "") ?? "" },
		transpilePackages: [...new Set([...(nextConfig.transpilePackages ?? []), ...PACKAGES])],
		turbopack: {
			...nextConfig.turbopack,
			resolveAlias: {
				...Object.fromEntries(missing.map((name) => [name, MISSING_OPTIONAL_MODULE])),
				...nextConfig.turbopack?.resolveAlias,
			},
		},
		webpack: (config, context) => {
			config.resolve ??= {};
			// Empty module inside the core package the app installed (the same file as `MISSING_OPTIONAL_MODULE`).
			const stub = path.join(process.cwd(), "node_modules", "@monti-cms", "core", "stubs", "missing-optional.cjs");
			config.resolve.alias = {
				...Object.fromEntries(missing.map((name) => [name, stub])),
				...config.resolve.alias,
			};
			return userWebpack ? userWebpack(config, context) : config;
		},
	};
}
