import { existsSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import path from "node:path";
import { findBoundaryViolations, formatBoundaryViolations } from "@monti-cms/core/import-boundary";
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
 * The packages `monti eject` took into the site (`.monti/ejected.json`). Their source is TypeScript in a workspace folder, so they are built with the app like core.
 * A missing or unreadable record is no packages.
 */
export function ejectedPackages(root: string): string[] {
	const record = readJson(path.join(root, ".monti", "ejected.json"));
	const list = Array.isArray(record?.packages) ? (record.packages as unknown[]) : [];
	return list.flatMap((entry) => {
		const name = (entry as { package?: unknown } | null)?.package;
		return typeof name === "string" ? [name] : [];
	});
}

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

/** The text of the stub that stands in for the missing package `name`: loading it says which package to install. */
const stubText = (name: string): string =>
	`// Written by withCms: the optional package ${name} is not installed. Loading it is an error that says so.\n` +
	`throw new Error(${JSON.stringify(
		`[monti] The package "${name}" is not installed, and a block you use needs it. Install it with your package manager (for example \`pnpm add ${name}\`), delete the .next folder and restart the dev server. \`monti doctor\` lists what is missing.`,
	)});\n`;

/**
 * Where each missing package is redirected to: a stub file of its own that names the package in its error (written under `node_modules/.cache/monti`, the place tools
 * keep generated files), or core's shared stub when the file cannot be written. The paths are relative to `root`, with `/`.
 */
export function missingStubs(root: string, missing: readonly string[]): Record<string, string> {
	const stubs: Record<string, string> = {};
	const folder = path.join(root, "node_modules", ".cache", "monti", "missing");
	for (const name of missing) {
		// The build error for a missing export names this file, so the name says what is wrong.
		const file = `${name.replace(/[^A-Za-z0-9._-]+/g, "__")}-not-installed.cjs`;
		try {
			mkdirSync(folder, { recursive: true });
			writeFileSync(path.join(folder, file), stubText(name));
			stubs[name] = `./node_modules/.cache/monti/missing/${file}`;
		} catch {
			stubs[name] = MISSING_OPTIONAL_MODULE;
		}
	}
	return stubs;
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

const CHECKED = Symbol.for("monti.import-boundary.checked");

/**
 * Warns, once per dev server start, when a client component (`"use client"`) imports `monti.config.ts` or another server-only module, directly or through other
 * files. The config file holds the database and login settings and is server-only. Does nothing outside development, and never stops the server: the check
 * reads source text, so `monti doctor` (the `config/boundary` check) is the one to fail a CI job. Returns the warning, or `undefined` when there is nothing to say.
 */
export function checkImportBoundaryInDev(
	cwd: string,
	env: { readonly NODE_ENV?: string } = process.env,
	warn: (message: string) => void = console.warn,
): string | undefined {
	if (env.NODE_ENV !== "development") return undefined;
	const holder = globalThis as { [CHECKED]?: Set<string> };
	const checked = holder[CHECKED] ?? new Set<string>();
	holder[CHECKED] = checked;
	if (checked.has(cwd)) return undefined;
	checked.add(cwd);
	try {
		const message = formatBoundaryViolations(findBoundaryViolations(cwd));
		if (!message) return undefined;
		warn(`monti: ${message}`);
		return message;
	} catch {
		// A folder that cannot be read is not the check's business.
		return undefined;
	}
}

/**
 * Adds the CMS wiring to the Next config. Builds package sources (TypeScript) together with the app, tells the server and browser bundles Next's `basePath`, and
 * points optional dependencies of CMS packages that are not installed (e.g. the block extension's `mermaid`) at an empty module (using that feature raises
 * an error telling you to install it).
 *
 * In development it also keeps the generated types of the schema file up to date (see {@link watchSchemaTypesInDev}) and warns when a client component imports
 * the server-only `monti.config.ts` (see {@link checkImportBoundaryInDev}).
 *
 * It links no config file: `monti.config.ts` exports the CMS instance, the app's server files import it, and the admin gets the site from that instance as data.
 */
export function withCms(nextConfig: NextConfig): NextConfig {
	const turbopackRoot = nextConfig.turbopack?.root;
	const missing = missingOptionalPeers(
		process.cwd(),
		turbopackRoot ? realpathSync(path.resolve(process.cwd(), turbopackRoot)) : undefined,
	);
	const stubs = missingStubs(process.cwd(), missing);
	const userWebpack = nextConfig.webpack;
	watchSchemaTypesInDev(process.cwd());
	checkImportBoundaryInDev(process.cwd());

	return {
		...nextConfig,
		// Tells the server and browser bundles Next `basePath` (read by `cmsApiUrl()` and `withBasePath()`). Site code has nothing to do.
		env: { ...nextConfig.env, NEXT_PUBLIC_CMS_BASE_PATH: nextConfig.basePath?.replace(/\/+$/, "") ?? "" },
		transpilePackages: [
			...new Set([...(nextConfig.transpilePackages ?? []), ...PACKAGES, ...ejectedPackages(process.cwd())]),
		],
		turbopack: {
			...nextConfig.turbopack,
			resolveAlias: {
				...stubs,
				...nextConfig.turbopack?.resolveAlias,
			},
		},
		webpack: (config, context) => {
			config.resolve ??= {};
			// The stub of each package: its own file, or the one inside the core package the app installed (the same file as `MISSING_OPTIONAL_MODULE`).
			const shared = path.join(process.cwd(), "node_modules", "@monti-cms", "core", "stubs", "missing-optional.cjs");
			config.resolve.alias = {
				...Object.fromEntries(
					missing.map((name) => [
						name,
						stubs[name] === MISSING_OPTIONAL_MODULE ? shared : path.resolve(process.cwd(), stubs[name] ?? shared),
					]),
				),
				...config.resolve.alias,
			};
			return userWebpack ? userWebpack(config, context) : config;
		},
	};
}
