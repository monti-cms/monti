import type { PluginConfigView } from "@monti-cms/core";
import type { GitHubClientFactory } from "./github/client.js";
/** The name under which the plugin is found in the site config's `plugins`. */
export declare const GIT_SYNC_PLUGIN_NAME = "git-sync";
/** How a publish lands in the repo. */
export type GitSyncMode = "commit" | "pr";
/** The file path pattern when a target gives none. */
export declare const DEFAULT_PATH_PATTERN = "{collection}/{slug}.{locale}.{ext}";
export declare const DEFAULT_FORMAT = "mdx";
export declare const DEFAULT_BRANCH = "main";
/** The branch `"pr"` mode commits to and opens its pull request from. */
export declare const DEFAULT_PR_BRANCH = "monti/publish";
export declare const DEFAULT_DEBOUNCE_MS = 2000;
/**
 * One place published entries are synced to: a branch of a GitHub repo, optionally a folder in it. A separate content repo uses the whole repo; a site repo
 * (Astro, Hugo, ...) uses its `content` folder.
 */
export interface GitSyncTarget {
    /**
     * Name of the target (lowercase letters, digits and `-`). It keys the target's saved state, so renaming it starts the target afresh. Default: the repo as
     * `owner-name`, with the folder appended when there is one.
     */
    readonly id?: string;
    /** `owner/name` of the GitHub repo. */
    readonly repo: string;
    /** Branch to sync with. Default `main`. */
    readonly branch?: string;
    /** Folder of the repo the files live in (`content`). Default: the whole repo. */
    readonly folder?: string;
    /** Name of the format the files are written in (`cms.formats()`). It must be able to import. Default `mdx`. */
    readonly format?: string;
    /**
     * Where a file goes, relative to the folder. Placeholders: `{collection}`, `{slug}`, `{locale}`, `{id}` (the entry id) and `{ext}` (the format's file extension).
     * It has to contain `{slug}` or `{id}`, `{collection}` when the target has more than one collection, and `{locale}` when the site has more than one language.
     * Default `{collection}/{slug}.{locale}.{ext}`; a Hugo-style site uses for example `{collection}/{slug}/index.{locale}.md`.
     */
    readonly path?: string;
    /** The collections whose published entries are synced. */
    readonly collections: readonly string[];
    /**
     * `"commit"` (the default) commits to the branch. `"pr"` commits to a separate branch and opens (or updates) a pull request, which merges itself when the
     * repo allows auto-merge: for a site repo where a bad file could break the build, and for protected branches.
     */
    readonly mode?: GitSyncMode;
    /** The branch `"pr"` mode works on. Default `monti/publish`. */
    readonly prBranch?: string;
    /** REST API root of GitHub Enterprise Server (`https://git.example.com/api/v3`). Default: github.com. */
    readonly apiUrl?: string;
}
export interface GitSyncOptions {
    /**
     * The places to sync to. Default: none, so `gitSync()` with no arguments adds the screen and the commands but syncs nothing until a target is listed.
     */
    readonly targets?: readonly GitSyncTarget[];
    /** `false` registers nothing (no screen, hooks or routes), so a config can carry the plugin switched off. Default `true`. */
    readonly enabled?: boolean;
    /**
     * Publishes that arrive within this many milliseconds of the last commit wait in a queue (saved in the plugin's storage) and go out together in one commit.
     * A publish after a quiet period is committed at once. `0` commits every publish at once. Default 2000.
     */
    readonly debounceMs?: number;
    /**
     * Makes the GitHub client (the REST client by default). For tests and for hosts that reach GitHub another way; `@monti-cms/git-sync/testing` has a fake.
     * It runs on the server only.
     */
    readonly client?: GitHubClientFactory;
}
/** A target with every default filled in. */
export interface ResolvedTarget {
    readonly id: string;
    readonly repo: string;
    readonly branch: string;
    /** No leading or trailing slash; `""` is the whole repo. */
    readonly folder: string;
    readonly format: string;
    readonly path: string;
    readonly collections: readonly string[];
    readonly mode: GitSyncMode;
    readonly prBranch: string;
    readonly apiUrl?: string;
}
/** Front matter keys git-sync writes itself; a collection field with one of these names would be lost in the file. */
export declare const RESERVED_FRONT_MATTER_KEYS: readonly ["slug", "date", "lastmod", "monti"];
/** The placeholders a pattern uses. */
export declare const patternPlaceholders: (pattern: string) => string[];
/** Fills in the defaults of a target. Throws what is wrong with it, naming the target. */
export declare function resolveTarget(target: GitSyncTarget, index: number): ResolvedTarget;
/** Every target with its defaults, after checking the list as a whole (ids are unique). */
export declare function resolveTargets(options: GitSyncOptions): ResolvedTarget[];
/**
 * The checks that need the site (they run when the site config is created): the collections exist, the path pattern carries what the site needs to tell
 * files apart, and no field of a synced collection has the name of a front matter key git-sync writes itself.
 */
export declare function validateGitSyncConfig(options: GitSyncOptions, config: PluginConfigView): void;
