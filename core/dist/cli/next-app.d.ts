/**
 * What `monti init` and `monti doctor` both ask about the Next app and the files Monti wires into it, answered once: which Next app this is (package.json, the App
 * Router folder, the root layout, the next config), whether it is wired for Monti (`withCms`, `suppressHydrationWarning` on `<html>`, the three Next files) and
 * whether `.gitignore` keeps the right things out of git. Everything here only reads; the edits are in `init-edit.ts`.
 */
/** The parts of `package.json` Monti reads. */
export interface PackageJson {
    readonly name?: unknown;
    readonly packageManager?: unknown;
    readonly scripts?: Readonly<Record<string, unknown>>;
    readonly dependencies?: Readonly<Record<string, string>>;
    readonly devDependencies?: Readonly<Record<string, string>>;
}
/** The `package.json` of the app in `cwd` (read as JSON with comments, like the other files of the app), or `undefined` when there is none or it cannot be read. */
export declare function readPackageJson(cwd: string): PackageJson | undefined;
/** The version range `package.json` lists for a package, in `dependencies` or `devDependencies`. */
export declare const dependencySpec: (pkg: PackageJson | undefined, name: string) => string | undefined;
/** The names of all the packages `package.json` lists. */
export declare const dependencyNames: (pkg: PackageJson | undefined) => Set<string>;
/** Whether the folder is a Next app: `next` is in its package.json. */
export declare const isNextApp: (cwd: string) => boolean;
/** The next config files Monti can edit, in the order it looks. */
export declare const NEXT_CONFIG_FILES: readonly ["next.config.ts", "next.config.mjs", "next.config.js"];
/** The next config files Monti cannot edit, and must not create a second one next to. */
export declare const OTHER_NEXT_CONFIG_FILES: readonly ["next.config.cjs", "next.config.mts", "next.config.cts"];
/** The next config file of the app (relative to `cwd`), if there is one Monti can edit. */
export declare const findNextConfig: (cwd: string) => string | undefined;
/** A next config file Monti cannot edit, if the app has one. */
export declare const findOtherNextConfig: (cwd: string) => string | undefined;
/**
 * The App Router folder of the app in `cwd`: `src/app` when it exists, else `app` when it exists, else the folder `init` would create (`src/app` when the
 * project keeps its code in `src/`, which is the case when `src/` exists and `app/` does not). `src` says whether the project keeps its code in `src/`.
 */
export declare function detectAppDir(cwd: string): {
    readonly dir: "app" | "src/app";
    readonly exists: boolean;
    readonly src: boolean;
};
/** The root layout of the App Router (relative to `cwd`, with `/`), or `undefined` when there is none. */
export declare function findRootLayout(cwd: string): string | undefined;
/** Whether the file imports `withCms` from `@monti-cms/nextjs` (a comment that says so does not count). */
export declare function importsWithCms(text: string): boolean;
/** Whether a `next.config` file imports `withCms` from `@monti-cms/nextjs` and calls it. `monti init` and `monti doctor` agree on whether the config is wrapped. */
export declare function usesWithCms(text: string): boolean;
/** The `<html>` tag of a layout: its text, where it starts and its attributes; `undefined` when the text has no `<html>` tag (a nested layout). */
export declare function findHtmlTag(text: string): {
    readonly start: number;
    readonly end: number;
    /** Everything between `<html` and the blank space before the closing `>`. */
    readonly attributes: string;
    /** The blank space before the closing `>` or `/>`. */
    readonly gap: string;
    /** `>` or `/>`. */
    readonly closer: string;
} | undefined;
/** What the attributes of an `<html>` tag say about `suppressHydrationWarning`: `on`, `off` (`={false}`), or `absent`. */
export declare function suppressHydrationState(attributes: string): "on" | "off" | "absent";
/** Whether the `<html>` tag of a layout has `suppressHydrationWarning` (set, not `={false}`); `undefined` when the text has no `<html>` tag (a nested layout). */
export declare function hasSuppressHydrationWarning(text: string): boolean | undefined;
/** What a `.gitignore` keeps out of git, of the things Monti needs kept out. */
export declare function gitignoreCoverage(gitignore: string): {
    readonly envLocal: boolean;
    readonly montiFolder: boolean;
};
/** Whether a `.gitignore` covers `.env.local`. */
export declare const ignoresEnvLocal: (gitignore: string) => boolean;
/** One of the three files Monti adds to the Next app: the admin layout, the admin page and the API route. */
export interface MontiNextFile {
    readonly id: "layout" | "page" | "route";
    readonly what: string;
    /** The file name without extension (`layout`, `page`, `route`). */
    readonly base: "layout" | "page" | "route";
    readonly extension: "ts" | "tsx";
    /** The route it serves, under the app folder, as written in the folder names (`/studio/[[...path]]`). */
    readonly route: string;
    /** The folders under the app folder. */
    readonly segments: readonly string[];
    /** What the file must use, to be Monti's. */
    readonly marker: string;
}
/** The three Next files for an admin path (`/studio`). The same list says what `monti init` writes and what `monti doctor` looks for. */
export declare function montiNextFiles(adminPath: string): MontiNextFile[];
/** Where `monti init` writes a Next file: under the app folder (`src/app/studio/layout.tsx`). */
export declare const montiNextFilePath: (appDir: string, file: MontiNextFile) => string;
/** The file for a route (`segments` after the app folder, route groups are transparent), or `undefined`. `base` is the file name without extension. */
export declare function findRouteFile(cwd: string, appDir: string, segments: readonly string[], base: string): string | undefined;
/** The files under the app folder named `base` that use `marker`, with the route they serve (route groups removed). */
export declare function routesUsing(cwd: string, appDir: string, marker: string, base: string): {
    file: string;
    route: string;
}[];
