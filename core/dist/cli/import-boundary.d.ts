/**
 * The import-boundary check: `monti.config.ts` holds the database and login settings and makes the server-side CMS instance, so it must never reach a client
 * bundle. A file that starts with `"use client"` and everything it imports (through relative paths and the `paths` of `tsconfig.json`) is client code. The check
 * reports each import chain from such a file to the config file, or to a package that is server-only (`@monti-cms/core/server`, `@monti-cms/auth`, ...).
 * Type-only imports are erased by the compiler and do not count.
 *
 * It reads source text (no build), so it runs in a second: as the `config/boundary` check of `monti doctor` (`monti doctor --only config/boundary` in CI), and once per
 * dev server start from `withCms`.
 */
/** Packages that hold server code. A client file importing one drags the server into the browser bundle. */
export declare const SERVER_ONLY_MODULES: readonly ["@monti-cms/core/server", "@monti-cms/core/runtime", "@monti-cms/core/plugin/server", "@monti-cms/auth", "@monti-cms/nextjs/auth"];
export interface BoundaryViolation {
    /** The client file the chain starts in (relative to `cwd`, `/` separators). */
    readonly client: string;
    /** The files from `client` to the one that must stay on the server (the last item may be a package name). */
    readonly chain: readonly string[];
    /** What the chain ends in: `config` (the config file) or the server-only package. */
    readonly reaches: string;
}
/** Every source file under `dir`, skipping dependency, build and vendored folders. */
export declare function sourceFiles(dir: string, out?: string[]): string[];
/** Blank out comments, so an import written in a comment does not count. Keeps string contents (the `"use client"` directive and module names). */
export declare function stripComments(text: string): string;
/** The module names a file imports at run time (static, re-exported or dynamic), leaving out type-only imports and exports. */
export declare function importsOf(text: string): string[];
/**
 * Finds every import chain from a client file to the config file or a server-only package.
 * `cwd` is the app folder (where `package.json` and `tsconfig.json` are). Throws if it cannot read the folder.
 */
export declare function findBoundaryViolations(cwd: string): BoundaryViolation[];
/** The violations as text, one chain per line with how to fix it; empty when there is none. */
export declare function formatBoundaryViolations(violations: readonly BoundaryViolation[]): string;
