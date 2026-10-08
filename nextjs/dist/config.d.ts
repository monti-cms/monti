import type { NextConfig } from "next";
/**
 * Keeps the types of the site's schema file (`monti.schema.json` -> `monti-env.d.ts`) in step with it while the dev server runs: writes them at start and again
 * whenever the schema file changes (for example when it is edited by hand or saved from the admin). Does nothing outside development (a production build reads
 * the committed types), when the site has no schema file, or when `cwd` is already watched (Next loads its config more than once). A schema that does not parse is
 * reported and the last good types stay. Returns the function that stops the watch, or `undefined` if there is none.
 */
export declare function watchSchemaTypesInDev(cwd: string, env?: {
    readonly NODE_ENV?: string;
}, log?: (message: string) => void): (() => void) | undefined;
/**
 * Warns, once per dev server start, when a client component (`"use client"`) imports `monti.config.ts` or another server-only module, directly or through other
 * files. The config file holds the database and login settings and is server-only. Does nothing outside development, and never stops the server: the check
 * reads source text, so `monti doctor` (the `config/boundary` check) is the one to fail a CI job. Returns the warning, or `undefined` when there is nothing to say.
 */
export declare function checkImportBoundaryInDev(cwd: string, env?: {
    readonly NODE_ENV?: string;
}, warn?: (message: string) => void): string | undefined;
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
export declare function withCms(nextConfig: NextConfig): NextConfig;
