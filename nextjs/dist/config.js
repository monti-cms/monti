import path from "node:path";
import { findBoundaryViolations, formatBoundaryViolations } from "@monti-cms/core/import-boundary";
import { findSchemaFile, watchSchemaTypes } from "@monti-cms/core/schema-types";
const PACKAGES = ["@monti-cms/core"];
const WATCHING = Symbol.for("monti.schema-types.watching");
/**
 * Keeps the types of the site's schema file (`monti.schema.json` -> `monti-env.d.ts`) in step with it while the dev server runs: writes them at start and again
 * whenever the schema file changes (for example when it is edited by hand or saved from the admin). Does nothing outside development (a production build reads
 * the committed types), when the site has no schema file, or when `cwd` is already watched (Next loads its config more than once). A schema that does not parse is
 * reported and the last good types stay. Returns the function that stops the watch, or `undefined` if there is none.
 */
export function watchSchemaTypesInDev(cwd, env = process.env, log = console.log) {
    if (env.NODE_ENV !== "development")
        return undefined;
    let schema;
    try {
        schema = findSchemaFile(cwd);
    }
    catch {
        return undefined;
    }
    const holder = globalThis;
    const registry = holder[WATCHING] ?? new Set();
    holder[WATCHING] = registry;
    const key = path.resolve(cwd, schema);
    if (registry.has(key))
        return undefined;
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
export function checkImportBoundaryInDev(cwd, env = process.env, warn = console.warn) {
    if (env.NODE_ENV !== "development")
        return undefined;
    const holder = globalThis;
    const checked = holder[CHECKED] ?? new Set();
    holder[CHECKED] = checked;
    if (checked.has(cwd))
        return undefined;
    checked.add(cwd);
    try {
        const message = formatBoundaryViolations(findBoundaryViolations(cwd));
        if (!message)
            return undefined;
        warn(`monti: ${message}`);
        return message;
    }
    catch {
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
 * To undo them, remove `withCms` from `next.config.ts`; the admin then needs
 * `transpilePackages: ["@monti-cms/core"]` and the base path set by hand.
 *
 * It links no config file: `monti.config.ts` exports the CMS instance, the app's server files import it, and the admin gets the site from that instance as data.
 * An optional package that a block needs (`mermaid`, `recharts`) is not stubbed: if an app imports the block without installing it, the bundler says which
 * package is missing.
 */
export function withCms(nextConfig) {
    watchSchemaTypesInDev(process.cwd());
    checkImportBoundaryInDev(process.cwd());
    return {
        ...nextConfig,
        // Tells the server and browser bundles Next `basePath` (read by `cmsApiUrl()` and `withBasePath()`). Site code has nothing to do.
        env: { ...nextConfig.env, NEXT_PUBLIC_CMS_BASE_PATH: nextConfig.basePath?.replace(/\/+$/, "") ?? "" },
        transpilePackages: [...new Set([...(nextConfig.transpilePackages ?? []), ...PACKAGES])],
    };
}
