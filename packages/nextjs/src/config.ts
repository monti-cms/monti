import path from "node:path";
import { findBoundaryViolations, formatBoundaryViolations } from "@monti-cms/core/import-boundary";
import { findSchemaFile, watchSchemaTypes } from "@monti-cms/core/schema-types";
import type { NextConfig } from "next";

const PACKAGES = ["@monti-cms/core"];

/**
 * The environment variable `withCms` sets to say what it added to the Next config. The server reads it for the startup summary (`MONTI_WITHCMS` in
 * `@monti-cms/core`), because the config is loaded where the summary is not printed.
 */
const WITHCMS_ENV = "MONTI_WITHCMS";

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
 * Adds the CMS wiring to the Next config, and nothing else:
 *
 * - `transpilePackages` gets `@monti-cms/core`, so its TypeScript sources build with the app;
 * - `env.NEXT_PUBLIC_CMS_BASE_PATH` carries Next's `basePath` to the server and browser bundles;
 * - in development, the types of the schema file are kept up to date ({@link watchSchemaTypesInDev}) and a client component that imports the server-only
 *   `monti.config.ts` is warned about ({@link checkImportBoundaryInDev}).
 *
 * The startup summary of the server lists these (it reads `MONTI_WITHCMS`). To undo them, remove `withCms` from `next.config.ts`; the admin then needs
 * `transpilePackages: ["@monti-cms/core"]` and the base path set by hand.
 *
 * It links no config file: `monti.config.ts` exports the CMS instance, the app's server files import it, and the admin gets the site from that instance as data.
 * An optional package that a block needs (`mermaid`, `recharts`) is not stubbed: if an app imports the block without installing it, the bundler says which
 * package is missing.
 */
export function withCms(nextConfig: NextConfig): NextConfig {
	watchSchemaTypesInDev(process.cwd());
	checkImportBoundaryInDev(process.cwd());
	const development = process.env.NODE_ENV === "development";
	const added = [
		`transpilePackages += ${PACKAGES.join(", ")}`,
		`env.NEXT_PUBLIC_CMS_BASE_PATH = "${nextConfig.basePath?.replace(/\/+$/, "") ?? ""}" (Next basePath)`,
		...(development
			? [
					"monti-env.d.ts is rewritten when the schema file changes",
					"client imports of monti.config.ts are warned about",
				]
			: []),
	];
	process.env[WITHCMS_ENV] = added.join("; ");
	return {
		...nextConfig,
		// Tells the server and browser bundles Next `basePath` (read by `cmsApiUrl()` and `withBasePath()`). Site code has nothing to do.
		env: { ...nextConfig.env, NEXT_PUBLIC_CMS_BASE_PATH: nextConfig.basePath?.replace(/\/+$/, "") ?? "" },
		transpilePackages: [...new Set([...(nextConfig.transpilePackages ?? []), ...PACKAGES])],
	};
}
