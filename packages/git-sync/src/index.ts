import { definePlugin } from "@monti-cms/core";
import { GIT_SYNC_PLUGIN_NAME, type GitSyncOptions, validateGitSyncConfig } from "./options";

/**
 * Git sync. Add it to the site config `plugins` to sync the published entries of some collections two ways with files in a GitHub repo (a separate content repo,
 * or the `content` folder of a site repo such as Astro or Hugo).
 *
 * - Out: publishing commits the entry's file (or opens a pull request). Unpublishing, trashing and deleting remove it, and a new address renames it. Publishes close
 *   together go out in one commit. It is delivered through the event outbox, so a failed push is retried and not lost.
 * - In: GitHub's `push` webhook, "Pull now" on the admin screen and `monti git-sync:pull` write what changed in the repo to the CMS and publish it.
 * - If an entry changed on both sides since the last sync, nothing is merged: the admin screen lists the conflict with a diff and a person picks a side.
 * - Optionally (`drafts: true` on a target) drafts sync too: a branch `monti/draft/<slug>` and a pull request per entry with unpublished changes. Publishing in the CMS
 *   merges the pull request, and merging it on GitHub publishes the entry.
 *
 * The GitHub token and the webhook secret are saved on the plugin's admin screen (encrypted with a key derived from `MONTI_SECRET`), never in config.
 * It works with no arguments (`gitSync()`): no target is listed, so nothing syncs until `targets` names a repo.
 *
 * ```ts
 * plugins: [
 *   mdx(),
 *   gitSync({
 *     targets: [{ repo: "acme/site", folder: "content", collections: ["post"], path: "{collection}/{slug}.{locale}.{ext}" }],
 *   }),
 * ]
 * ```
 */
export const gitSync = (options: GitSyncOptions = {}) =>
	definePlugin({
		name: GIT_SYNC_PLUGIN_NAME,
		options,
		validate: (config) => validateGitSyncConfig(options, config),
		// With `enabled: false` the plugin registers nothing: no screen, hooks or routes.
		...(options.enabled === false
			? {}
			: {
					nav: [{ path: "git-sync", label: "Git sync", icon: "git-branch" }],
					// In the browser bundle `./server` is replaced by an empty entry point (`server.browser.ts`) (package.json `exports`).
					server: () => import("@monti-cms/git-sync/server"),
					admin: () => import("@monti-cms/git-sync/admin"),
				}),
	});

export type { GitHubClient, GitHubClientFactory, GitHubClientOptions } from "./github/client";
export {
	DEFAULT_BRANCH,
	DEFAULT_DRAFT_DEBOUNCE_MS,
	DEFAULT_FORMAT,
	DEFAULT_PATH_PATTERN,
	DEFAULT_PR_BRANCH,
	DRAFT_BRANCH_PREFIX,
	GIT_SYNC_PLUGIN_NAME,
	type GitSyncMode,
	type GitSyncOptions,
	type GitSyncTarget,
	type ResolvedTarget,
	resolveTargets,
	validateGitSyncConfig,
} from "./options";
