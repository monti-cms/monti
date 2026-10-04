import type { NextConfig } from "next";
export interface WithCmsOptions {
    /** Site config file path (shared by server and browser). Relative to the project root (e.g. `./src/cms.config.ts`). */
    readonly config: string;
    /** Server config file path (store and login connections, server only). E.g. `./src/cms.server.ts`. */
    readonly server: string;
}
/** Marker a CMS plugin package puts in `package.json` (`"cmsPlugin": true`). The name does not matter. */
export declare const PLUGIN_MARKER = "cmsPlugin";
/** Module substituted for an optional dependency that is not installed (importing it raises an error telling you to install it). */
export declare const MISSING_OPTIONAL_MODULE = "@monti-cms/core/stubs/missing-optional";
/**
 * Optional peer dependencies of the CMS packages the app installed (core and admin packages, and plugin packages with `"cmsPlugin": true` in `package.json`)
 * (`peerDependenciesMeta.optional`) that are not installed.
 * Example: the block extension's Mermaid preview loads `mermaid` only when a preview is opened, but the bundler also tries to resolve `import("mermaid")` of extensions in use or not,
 * so the build stops if it is not installed.
 */
export declare function missingOptionalPeers(root: string, boundary?: string): string[];
/**
 * Adds the CMS wiring to the Next config. Builds package sources (TypeScript) together with the app and points the `@cms-config` and
 * `@cms-server` aliases that CMS code reads at the config files. Aliases for type checking go separately in the app's `tsconfig.json` `paths`.
 * Optional dependencies of CMS packages that are not installed (e.g. the block extension's `mermaid`) are pointed at an empty module (using that feature raises an error telling you to install it).
 */
export declare function withCms(nextConfig: NextConfig, options: WithCmsOptions): NextConfig;
