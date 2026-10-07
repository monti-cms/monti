import type { PluginConfigView } from "@monti-cms/core";
import type { GitHubClientFactory } from "./github/client";

/** The name under which the plugin is found in the site config's `plugins`. */
export const GIT_SYNC_PLUGIN_NAME = "git-sync";

/** How a publish lands in the repo. */
export type GitSyncMode = "commit" | "pr";

/** The file path pattern when a target gives none. */
export const DEFAULT_PATH_PATTERN = "{collection}/{slug}.{locale}.{ext}";
export const DEFAULT_FORMAT = "mdx";
export const DEFAULT_BRANCH = "main";
/** The branch `"pr"` mode commits to and opens its pull request from. */
export const DEFAULT_PR_BRANCH = "monti/publish";
export const DEFAULT_DEBOUNCE_MS = 2000;
/** The prefix of the branch of a draft (`monti/draft/<slug>`). */
export const DRAFT_BRANCH_PREFIX = "monti/draft/";
/** How long an entry has to be quiet (no save) before its draft goes to the draft branch. */
export const DEFAULT_DRAFT_DEBOUNCE_MS = 30_000;

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
	/**
	 * Also sync drafts. Each entry with unpublished changes gets a branch `monti/draft/<slug>` and a pull request into `branch`; publishing in the CMS merges
	 * that pull request, and merging it on GitHub publishes the entry. Default `false`.
	 */
	readonly drafts?: boolean;
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
	 * Draft saves are frequent (the editor autosaves), so a draft goes to its branch only once the entry has been quiet for this many milliseconds: the branch gets
	 * one commit per pause, not one per save. Only for targets with `drafts: true`. `0` commits every save at once. Default 30000.
	 */
	readonly draftDebounceMs?: number;
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
	readonly drafts: boolean;
	readonly apiUrl?: string;
}

const NAME = /^[a-z][a-z0-9-]*$/;
const REPO = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;
const PLACEHOLDERS = ["collection", "slug", "locale", "id", "ext"] as const;

const trimSlashes = (value: string) => value.replace(/^\/+|\/+$/g, "");

/** Front matter keys git-sync writes itself; a collection field with one of these names would be lost in the file. */
export const RESERVED_FRONT_MATTER_KEYS = ["slug", "date", "lastmod", "monti"] as const;

/** The placeholders a pattern uses. */
export const patternPlaceholders = (pattern: string): string[] =>
	[...pattern.matchAll(/\{([a-z]+)\}/g)].map((match) => match[1] ?? "");

/** The default id of a target. */
const defaultId = (repo: string, folder: string): string =>
	[repo.replace("/", "-"), ...(folder ? [folder.replace(/\//g, "-")] : [])]
		.join("-")
		.toLowerCase()
		.replace(/[^a-z0-9-]/g, "-")
		.replace(/^[^a-z]+/, "t-");

/** Fills in the defaults of a target. Throws what is wrong with it, naming the target. */
export function resolveTarget(target: GitSyncTarget, index: number): ResolvedTarget {
	const label = `git-sync target #${index + 1}${target.repo ? ` (${target.repo})` : ""}`;
	if (typeof target.repo !== "string" || !REPO.test(target.repo)) {
		throw new Error(`${label}: \`repo\` must be "owner/name"`);
	}
	if (!Array.isArray(target.collections) || target.collections.length === 0) {
		throw new Error(`${label}: \`collections\` must list at least one collection`);
	}
	const folder = trimSlashes(target.folder ?? "");
	if (folder.split("/").some((part) => part === ".." || part === ".")) {
		throw new Error(`${label}: \`folder\` cannot contain "." or ".." segments`);
	}
	const id = target.id ?? defaultId(target.repo, folder);
	if (!NAME.test(id))
		throw new Error(`${label}: the id "${id}" must be lowercase letters, digits and "-", starting with a letter`);
	const path = target.path ?? DEFAULT_PATH_PATTERN;
	if (
		path.startsWith("/") ||
		path.endsWith("/") ||
		path.split("/").some((part) => part === "" || part === ".." || part === ".")
	) {
		throw new Error(`${label}: \`path\` must be a relative file path pattern such as "${DEFAULT_PATH_PATTERN}"`);
	}
	const used = patternPlaceholders(path);
	const unknown = used.find((name) => !(PLACEHOLDERS as readonly string[]).includes(name));
	if (unknown)
		throw new Error(
			`${label}: \`path\` has the unknown placeholder {${unknown}} (use ${PLACEHOLDERS.map((name) => `{${name}}`).join(", ")})`,
		);
	if (!used.includes("slug") && !used.includes("id")) {
		throw new Error(`${label}: \`path\` must contain {slug} or {id}, or two entries would share a file`);
	}
	const mode = target.mode ?? "commit";
	if (mode !== "commit" && mode !== "pr") throw new Error(`${label}: \`mode\` must be "commit" or "pr"`);
	const branch = target.branch ?? DEFAULT_BRANCH;
	const prBranch = target.prBranch ?? DEFAULT_PR_BRANCH;
	if (mode === "pr" && prBranch === branch) throw new Error(`${label}: \`prBranch\` must differ from \`branch\``);
	if (target.drafts !== undefined && typeof target.drafts !== "boolean") {
		throw new Error(`${label}: \`drafts\` must be true or false`);
	}
	if (target.drafts === true && (branch.startsWith(DRAFT_BRANCH_PREFIX) || prBranch.startsWith(DRAFT_BRANCH_PREFIX))) {
		throw new Error(
			`${label}: \`branch\` and \`prBranch\` cannot be under "${DRAFT_BRANCH_PREFIX}", which is for drafts`,
		);
	}
	return {
		id,
		repo: target.repo,
		branch,
		folder,
		format: target.format ?? DEFAULT_FORMAT,
		path,
		collections: target.collections,
		mode,
		prBranch,
		drafts: target.drafts === true,
		...(target.apiUrl ? { apiUrl: target.apiUrl } : {}),
	};
}

/** Every target with its defaults, after checking the list as a whole (ids are unique). */
export function resolveTargets(options: GitSyncOptions): ResolvedTarget[] {
	const given = options.targets ?? [];
	if (!Array.isArray(given)) throw new Error("git-sync: `targets` must be a list");
	const targets = given.map(resolveTarget);
	const seen = new Set<string>();
	for (const target of targets) {
		if (seen.has(target.id))
			throw new Error(`git-sync: two targets share the id "${target.id}"; give each its own \`id\``);
		seen.add(target.id);
	}
	if (options.debounceMs !== undefined && (!Number.isFinite(options.debounceMs) || options.debounceMs < 0)) {
		throw new Error("git-sync: `debounceMs` must be 0 or more");
	}
	if (
		options.draftDebounceMs !== undefined &&
		(!Number.isFinite(options.draftDebounceMs) || options.draftDebounceMs < 0)
	) {
		throw new Error("git-sync: `draftDebounceMs` must be 0 or more");
	}
	return targets;
}

/**
 * The checks that need the site (they run when the site config is created): the collections exist, the path pattern carries what the site needs to tell
 * files apart, and no field of a synced collection has the name of a front matter key git-sync writes itself.
 */
export function validateGitSyncConfig(options: GitSyncOptions, config: PluginConfigView): void {
	if (options.enabled === false) return;
	for (const target of resolveTargets(options)) {
		const used = patternPlaceholders(target.path);
		for (const collection of target.collections) {
			const schema = config.collections[collection];
			if (!schema) throw new Error(`git-sync target "${target.id}": there is no collection "${collection}"`);
			const clash = RESERVED_FRONT_MATTER_KEYS.find(
				(key) => Object.hasOwn(schema.fields, key) && (schema.fields[key] as { kind?: string }).kind !== "slug",
			);
			if (clash) {
				throw new Error(
					`git-sync target "${target.id}": field "${clash}" of collection "${collection}" has the name of a front matter key git-sync writes itself; rename the field`,
				);
			}
		}
		if (target.collections.length > 1 && !used.includes("collection") && !used.includes("id")) {
			throw new Error(
				`git-sync target "${target.id}": \`path\` needs {collection} (or {id}) because the target has more than one collection`,
			);
		}
		if (config.locales.length > 1 && !used.includes("locale") && !used.includes("id")) {
			throw new Error(
				`git-sync target "${target.id}": \`path\` needs {locale} (or {id}) because the site has more than one language`,
			);
		}
	}
}
