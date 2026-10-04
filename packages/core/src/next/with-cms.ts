import { existsSync, readFileSync, realpathSync } from "node:fs";
import path from "node:path";
import type { NextConfig } from "next";

export interface WithCmsOptions {
	/** Site config file path (shared by server and browser). Relative to the project root (e.g. `./src/cms.config.ts`). */
	readonly config: string;
	/** Server config file path (store and login connections, server only). E.g. `./src/cms.server.ts`. */
	readonly server: string;
}

const PACKAGES = ["@monti-cms/core"];
/** Core-side packages. Only the optional peer dependencies of these and of CMS plugin packages are checked. */
const CORE_PACKAGES = ["@monti-cms/core", "@monti-cms/admin"];
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

/**
 * Adds the CMS wiring to the Next config. Builds package sources (TypeScript) together with the app and points the `@cms-config` and
 * `@cms-server` aliases that CMS code reads at the config files. Aliases for type checking go separately in the app's `tsconfig.json` `paths`.
 * Optional dependencies of CMS packages that are not installed (e.g. the block extension's `mermaid`) are pointed at an empty module (using that feature raises an error telling you to install it).
 */
export function withCms(nextConfig: NextConfig, options: WithCmsOptions): NextConfig {
	const relative = (file: string) => (file.startsWith(".") ? file : `./${file}`);
	const aliases = { "@cms-config": options.config, "@cms-server": options.server };
	const turbopackRoot = nextConfig.turbopack?.root;
	const missing = missingOptionalPeers(
		process.cwd(),
		turbopackRoot ? realpathSync(path.resolve(process.cwd(), turbopackRoot)) : undefined,
	);
	const userWebpack = nextConfig.webpack;

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
				...Object.fromEntries(Object.entries(aliases).map(([alias, file]) => [alias, relative(file)])),
			},
		},
		webpack: (config, context) => {
			config.resolve ??= {};
			// Empty module inside the core package the app installed (the same file as `MISSING_OPTIONAL_MODULE`).
			const stub = path.join(process.cwd(), "node_modules", "@monti-cms", "core", "stubs", "missing-optional.cjs");
			config.resolve.alias = {
				...Object.fromEntries(missing.map((name) => [name, stub])),
				...config.resolve.alias,
				...Object.fromEntries(
					Object.entries(aliases).map(([alias, file]) => [alias, path.resolve(process.cwd(), file)]),
				),
			};
			return userWebpack ? userWebpack(config, context) : config;
		},
	};
}
