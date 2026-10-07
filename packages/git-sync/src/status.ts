import { listDraftPullRequests } from "./drafts";
import type { GitSyncMode } from "./options";
import { type SettingsView, settingsView } from "./settings";
import type { PullSummary, TargetStatus } from "./state";
import type { SyncContext } from "./sync";

/** What the admin screen shows about one target. */
export interface TargetView {
	readonly id: string;
	readonly repo: string;
	readonly branch: string;
	readonly folder: string;
	readonly format: string;
	readonly path: string;
	readonly mode: GitSyncMode;
	readonly prBranch: string;
	/** Whether the target syncs drafts, and then the pull requests of the open ones. */
	readonly drafts: boolean;
	readonly draftPullRequests: Awaited<ReturnType<typeof listDraftPullRequests>>;
	readonly collections: readonly string[];
	/** Entries synced (with a file). */
	readonly synced: number;
	/** Publishes waiting for their commit. */
	readonly queued: number;
	readonly conflicts: number;
	readonly lastPull?: PullSummary;
	readonly lastFlush?: TargetStatus["lastFlush"];
}

export interface StatusView {
	readonly settings: SettingsView;
	readonly targets: readonly TargetView[];
}

export async function statusView(ctx: SyncContext): Promise<StatusView> {
	const targets: TargetView[] = [];
	const draftPullRequests = await listDraftPullRequests(ctx);
	for (const target of ctx.targets) {
		const [records, queue, conflicts, status] = await Promise.all([
			ctx.state.records.list(target.id),
			ctx.state.queue.list(target.id),
			ctx.state.conflicts.list(target.id),
			ctx.state.status.get(target.id),
		]);
		targets.push({
			id: target.id,
			repo: target.repo,
			branch: target.branch,
			folder: target.folder,
			format: target.format,
			path: target.path,
			mode: target.mode,
			prBranch: target.prBranch,
			drafts: target.drafts,
			draftPullRequests: draftPullRequests.filter((item) => item.target === target.id),
			collections: target.collections,
			synced: [...records.values()].filter((record) => record.blobSha !== null).length,
			queued: queue.length,
			conflicts: conflicts.length,
			...(status.lastPull ? { lastPull: status.lastPull } : {}),
			...(status.lastFlush ? { lastFlush: status.lastFlush } : {}),
		});
	}
	return { settings: await settingsView(ctx), targets };
}
