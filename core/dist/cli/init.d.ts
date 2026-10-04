export interface InitOptions {
    /** Next app folder (where `package.json` is). */
    readonly cwd: string;
    /** Admin UI path (default `/admin`). If different, set `admin.path` in the site config and create the route folder at that path too. */
    readonly adminPath?: string;
    /** Site default locale code (default `en`). The admin UI locale and date formatting follow it. */
    readonly locale?: string;
    /** Date/time zone (IANA, default `UTC`). */
    readonly timeZone?: string;
}
export interface InitReport {
    /** Newly created files (relative to `cwd`). */
    readonly created: string[];
    /** Files that already existed and were left as they are. Never overwritten. */
    readonly skipped: string[];
    /** Modified files (tsconfig `paths`, global CSS, next config). */
    readonly updated: string[];
    /** Manual steps (what could not be fixed automatically, installation, environment variables, next steps). */
    readonly todo: string[];
}
/**
 * `monti init`: creates the files that attach the CMS to a Next app. **Existing files are not overwritten**; they are reported as skipped.
 * Creates: site and server config, admin routes (page and layout), admin API route (including login).
 * Modifies (only when safe): tsconfig `paths`, the style line in global CSS, a next config of the default shape. If it cannot, it reports a manual step.
 */
export declare function initProject(options: InitOptions): InitReport;
/** Turns the report into human-readable text. */
export declare function formatInitReport(report: InitReport): string;
