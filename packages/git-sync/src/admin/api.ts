import { adminFetch } from "@monti-cms/admin/api";
import { adminApiUrl, type Site } from "@monti-cms/core/site";

/** The shapes of the plugin's API responses, as the screen reads them (dates arrive as ISO strings). */
export interface PullSummaryView {
	at: string;
	head: string;
	applied: number;
	created: number;
	unchanged: number;
	conflicts: number;
	skipped: { path: string; reason: string }[];
	errors: { path: string; message: string }[];
}

export interface TargetView {
	id: string;
	repo: string;
	branch: string;
	folder: string;
	format: string;
	path: string;
	mode: "commit" | "pr";
	prBranch: string;
	collections: string[];
	synced: number;
	queued: number;
	conflicts: number;
	lastPull?: PullSummaryView;
	lastFlush?: { at: string; files: number; commitSha: string; branch: string; pullRequestUrl?: string; note?: string };
}

export interface SlotKeyView {
	id: string;
	name: string;
	tail: string;
	readable: boolean;
}

export interface StatusView {
	keys: { secretsAvailable: boolean; token: SlotKeyView | null; webhookSecret: SlotKeyView | null };
	targets: TargetView[];
}

export interface ConflictView {
	id: string;
	target: string;
	repo: string;
	entryId: string;
	collection: string;
	locale: string;
	path: string;
	kind: "changed" | "removed";
	reason: "both-changed" | "unpublished-changes" | "unsynced" | "git-edit-blocks-removal";
	detectedAt: string;
	label: string;
	serverText: string | null;
	gitText: string;
	gitSha: string;
}

export type ResolveChoice = "git" | "server";
export type KeySlot = "token" | "webhook-secret";

export const gitSyncKeys = {
	all: ["cms", "git-sync"] as const,
	status: () => [...gitSyncKeys.all, "status"] as const,
	conflicts: () => [...gitSyncKeys.all, "conflicts"] as const,
};

export interface GitSyncRequestOptions {
	signal?: AbortSignal;
	fallback?: string;
}

/** `GET /v1/git-sync/status` */
export const getGitSyncStatus = (site: Site, options: GitSyncRequestOptions = {}) =>
	adminFetch<StatusView>(site, adminApiUrl("/v1/git-sync/status"), options);

/** `GET /v1/git-sync/conflicts` */
export const listGitSyncConflicts = (site: Site, options: GitSyncRequestOptions = {}) =>
	adminFetch<{ items: ConflictView[] }>(site, adminApiUrl("/v1/git-sync/conflicts"), options);

/** `POST /v1/git-sync/pull` */
export const pullGitSync = (site: Site, target: string, fallback?: string) =>
	adminFetch<{ results: { target: string; summary: PullSummaryView }[] }>(site, adminApiUrl("/v1/git-sync/pull"), {
		method: "POST",
		json: { target },
		fallback,
	});

/** `POST /v1/git-sync/flush` */
export const flushGitSync = (site: Site, target: string, fallback?: string) =>
	adminFetch<{ results: { written: number; removed: number }[] }>(site, adminApiUrl("/v1/git-sync/flush"), {
		method: "POST",
		json: { target },
		fallback,
	});

/** `POST /v1/git-sync/conflicts/resolve` */
export const resolveGitSyncConflict = (
	site: Site,
	conflict: ConflictView,
	resolution: ResolveChoice,
	fallback?: string,
) =>
	adminFetch(site, adminApiUrl("/v1/git-sync/conflicts/resolve"), {
		method: "POST",
		json: { target: conflict.target, entryId: conflict.entryId, resolution, gitSha: conflict.gitSha },
		fallback,
	});

/** `PUT /v1/api-keys/slots`: assigns an API key to one of the plugin's slots. */
export const assignGitSyncKey = (site: Site, values: { slot: KeySlot; key: unknown }, fallback?: string) =>
	adminFetch(site, adminApiUrl("/v1/api-keys/slots"), {
		method: "PUT",
		json: { plugin: "git-sync", ...values },
		fallback,
	});
