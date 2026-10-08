import { type DetectedLocale } from "./locale-names.js";
/** What `monti init` finds out about the app before it asks anything. Read-only: nothing is written here. */
export type PackageManager = "npm" | "pnpm" | "yarn" | "bun";
/** The package manager of the app, by its lockfile, then its `packageManager` field; `npm` when neither says. */
export declare function detectPackageManager(cwd: string): PackageManager;
export type FrontMatterType = "string" | "list" | "boolean" | "number" | "date";
/** One front matter key seen in a content folder. */
export interface FrontMatterKey {
    readonly name: string;
    /** The type of the value in most files. */
    readonly type: FrontMatterType;
    /** In how many of the sampled files the key appears. */
    readonly count: number;
}
/** A folder of Markdown or MDX files the app already has. */
export interface ContentFolder {
    /** Relative to the app folder, with `/`. */
    readonly dir: string;
    /** Markdown (`.md`) and MDX (`.mdx`) files directly in it. */
    readonly files: number;
    /** The front matter keys of up to {@link SAMPLE_FILES} files, most common first. */
    readonly keys: readonly FrontMatterKey[];
    /**
     * The languages the files are written in, default first, when their names say so: `hello.ko.mdx` and `hello.en.mdx` (`filename`), or sibling folders named
     * `ko/` and `en/` that this folder merges (`folder`, then `dir` is their parent).
     */
    readonly locales?: readonly DetectedLocale[];
    readonly localesFrom?: "filename" | "folder";
}
export interface DetectedApp {
    readonly cwd: string;
    /** `name` of package.json. */
    readonly packageName?: string;
    /** The `next` version range listed in package.json, if Next is a dependency. */
    readonly next?: string;
    /** `app` or `src/app`: where the App Router folder is (or will be created). */
    readonly appDir: "app" | "src/app";
    /** Whether the project keeps its code in `src/`. */
    readonly src: boolean;
    /** Whether the app folder exists. */
    readonly hasAppRouter: boolean;
    /** `pages/` exists and `app/` does not. */
    readonly pagesRouterOnly: boolean;
    readonly packageManager: PackageManager;
    readonly typescript: boolean;
    /** `undefined` when there is no tsconfig. */
    readonly resolveJsonModule?: boolean;
    readonly contentFolders: readonly ContentFolder[];
    /** The next config file (`next.config.ts`, `.mjs` or `.js`), if any. */
    readonly nextConfig?: string;
    /** The port `next dev` is set to listen on, from the `dev` script. */
    readonly devPort: number;
    /** Whether the package.json already lists these packages. */
    readonly dependencies: ReadonlySet<string>;
    /** Config files of an earlier Monti setup, which `init` leaves alone. */
    readonly legacyConfig: readonly string[];
    /** The existing `monti.config.ts` (relative to cwd), if any. */
    readonly existingConfig?: string;
    /** Whether `.gitignore` covers `.env.local`. */
    readonly envLocalIgnored: boolean;
}
export declare const NEXT_CONFIG_FILES: readonly ["next.config.ts", "next.config.mjs", "next.config.js"];
/** Files read per folder for front matter keys. */
export declare const SAMPLE_FILES = 50;
/** The `key: value` lines at the top level of a front matter block (`---` fenced) as key -> type. Empty when the file has none. */
export declare function parseFrontMatterKeys(text: string): Map<string, FrontMatterType>;
/** Whether a `.gitignore` line list covers `.env.local`. */
export declare function ignoresEnvLocal(gitignore: string): boolean;
/** Reads the app in `cwd`. Throws when there is no package.json. */
export declare function detectApp(cwd: string): DetectedApp;
