import { CmsError, type ContentEvent, type Entry, problemText } from "@monti-cms/core/plugin/server";
import { exportEntry, isSyncable } from "./entry-file";
import type { BranchHead, FileChange, GitHubClient } from "./github/client";
import type { ResolvedTarget } from "./options";
import type { PathPattern } from "./path-pattern";
import type { ConflictRecord, SyncRecord } from "./state";
import { entryKey } from "./state";
import {
	APPLYING_WINDOW_MS,
	GitSyncError,
	GitSyncNotConfigured,
	NOT_CONFIGURED_RETRY_MS,
	type SyncContext,
} from "./sync";

/**
 * Outbound: from the CMS to the repo.
 *
 * An `afterCommit` event for a published entry, an unpublished one or a deleted one puts the entry in a queue (the plugin's storage, one item per entry and
 * target). The queue is flushed into one commit: the first publish after a quiet period goes out at once, publishes that follow within `debounceMs` wait for the
 * batch. A flush looks at each queued entry as it is now (not as the event saw it), so a stale or repeated event does no harm, and writes, renames or deletes
 * its file. Nothing here swallows an error: a failure throws, and the event outbox retries it with the queue intact.
 */

/** The event kinds that can change a file. A save of a published entry's draft does not: the file holds the published version. */
const FILE_KINDS: ReadonlySet<string> = new Set(["published", "restored", "trashed", "archived", "deleted"]);

/** Blobs created at the same time. */
const BLOB_BATCH = 4;

/** What a flush did. */
export interface FlushResult {
	readonly target: string;
	/** Files written (new, changed or renamed to). */
	readonly written: number;
	/** Files deleted. */
	readonly removed: number;
	readonly conflicts: number;
	readonly commitSha?: string;
	readonly branch?: string;
	readonly pullRequestUrl?: string;
	/** Entries that failed; they stay queued. */
	readonly failed: readonly { readonly entryId: string; readonly message: string }[];
}

export const errorText = (error: unknown): string =>
	error instanceof Error ? error.message || error.name : String(error);

/** The entry as it is now, or `null` when it does not exist (any more). */
async function readEntry(ctx: SyncContext, entryId: string): Promise<Entry | null> {
	try {
		return await ctx.cms.store().getEntry(entryId);
	} catch (error) {
		if (error instanceof CmsError && error.code === "not_found") return null;
		throw error;
	}
}

/** Whether a blob in git is the one git-sync knows about for an entry (it has not been edited in git since). */
export const isKnownBlob = (record: SyncRecord, sha: string | null): boolean =>
	sha === record.blobSha || sha === record.baseSha;

interface Planned {
	/** What goes into the commit. */
	readonly changes: FileChange[];
	/** The record to save once the commit is in (`null`: delete the record). `undefined`: leave it alone. */
	readonly record?: SyncRecord | null;
	readonly conflict?: ConflictRecord;
	/** How it reads in the commit message. */
	readonly summary?: string;
	readonly written?: boolean;
	readonly removed?: boolean;
}

const NOTHING: Planned = { changes: [] };

interface PlanContext {
	readonly ctx: SyncContext;
	readonly target: ResolvedTarget;
	readonly pattern: PathPattern;
	readonly client: GitHubClient;
	/** Path to blob sha on the branch, under the target's folder. */
	readonly remote: ReadonlyMap<string, string>;
	readonly records: ReadonlyMap<string, SyncRecord>;
	readonly conflicts: ReadonlyMap<string, ConflictRecord>;
	/** Entries to push whatever git says (the person chose the server version). */
	readonly forced: ReadonlySet<string>;
	/** In `"pr"` mode: whether a pull request from the pull request branch is open. */
	readonly prOpen: boolean;
}

const conflictOf = (
	{ target }: PlanContext,
	entry: { id: string; collection: string; locale: string },
	fields: Pick<ConflictRecord, "kind" | "reason" | "path" | "gitSha" | "gitText">,
	now: number,
): ConflictRecord => ({
	id: entryKey(target.id, entry.id),
	target: target.id,
	entryId: entry.id,
	collection: entry.collection,
	locale: entry.locale,
	...fields,
	detectedAt: new Date(now).toISOString(),
});

/** What to do for one queued entry. */
async function planEntry(plan: PlanContext, entryId: string, entry: Entry | null): Promise<Planned> {
	const { ctx, target, client, remote, records } = plan;
	const record = records.get(entryId);
	const force = plan.forced.has(entryId);
	const now = ctx.now();
	const open = plan.conflicts.get(entryId);
	// While a conflict waits for a decision nothing is pushed for the entry. The decision (or a forced push) settles it.
	if (open && !force) return NOTHING;

	if (!isSyncable(entry, target)) {
		// Not published (any more): the file goes, unless it was edited in git.
		if (!record) return NOTHING;
		const sha = remote.get(record.path) ?? null;
		if (sha === null) return { changes: [], record: null };
		// Already asked for in a pull request that has not merged yet.
		if (record.blobSha === null && !force && isKnownBlob(record, sha)) return NOTHING;
		if (!force && !isKnownBlob(record, sha)) {
			const where = { id: entryId, collection: record.collection, locale: record.locale };
			return {
				changes: [],
				conflict: conflictOf(
					plan,
					where,
					{
						kind: "removed",
						reason: "git-edit-blocks-removal",
						path: record.path,
						gitSha: sha,
						gitText: await client.getBlob(sha),
					},
					now,
				),
			};
		}
		return {
			changes: [{ path: record.path, delete: true }],
			// In "pr" mode the file is still on the branch until the pull request merges: the record stays, marked removed, so that file is not taken for an edit.
			record:
				target.mode === "pr"
					? { ...record, blobSha: null, contentHash: null, syncedAt: new Date(now).toISOString() }
					: null,
			summary: `Remove ${record.collection}/${record.slug} (${record.locale})`,
			removed: true,
		};
	}

	const file = await exportEntry(ctx.cms, target, plan.pattern, entry);
	const where = { id: entryId, collection: entry.collection, locale: entry.locale };
	const oldPath = record?.path;
	const atOld = oldPath === undefined ? null : (remote.get(oldPath) ?? null);
	const atNew = remote.get(file.path) ?? null;
	const same =
		record && record.contentHash === file.contentHash && record.path === file.path && record.blobSha !== null;

	const nextRecord = (blobShaNow: string | null, baseSha: string | null): SyncRecord => ({
		target: target.id,
		entryId,
		collection: entry.collection,
		locale: entry.locale,
		slug: file.slug,
		path: file.path,
		blobSha: blobShaNow,
		baseSha,
		contentHash: file.contentHash,
		syncedAt: new Date(now).toISOString(),
	});

	// Nothing changed on the server since the last sync: there is nothing to push, unless the file is gone from git.
	if (same && !force) {
		if (atNew === null) {
			return {
				changes: [{ path: file.path, text: file.text }],
				record: nextRecord(file.blobSha, target.mode === "pr" ? null : file.blobSha),
				summary: `Restore ${entry.collection}/${file.slug} (${entry.locale})`,
				written: true,
			};
		}
		// The merged pull request (or a push) brought the base up to date.
		if (atNew === record.blobSha && record.baseSha !== atNew)
			return { changes: [], record: { ...record, baseSha: atNew } };
		// The pull request that carried this version was closed without merging: the base still has the old file and nothing is on its way.
		if (target.mode === "pr" && atNew !== record.blobSha && atNew === record.baseSha && !plan.prOpen) {
			return {
				changes: [{ path: file.path, text: file.text }],
				record: nextRecord(file.blobSha, atNew),
				summary: `Publish ${entry.collection}/${file.slug} (${entry.locale})`,
				written: true,
			};
		}
		return NOTHING;
	}

	// The server changed (or the entry was never synced). The file about to be replaced must not have been edited in git.
	if (!force) {
		if (record) {
			if (atOld !== null && !isKnownBlob(record, atOld) && atOld !== file.blobSha) {
				return {
					changes: [],
					conflict: conflictOf(
						plan,
						where,
						{
							kind: "changed",
							reason: "both-changed",
							path: record.path,
							gitSha: atOld,
							gitText: await client.getBlob(atOld),
						},
						now,
					),
				};
			}
			if (oldPath !== file.path && atNew !== null && atNew !== file.blobSha) {
				return {
					changes: [],
					conflict: conflictOf(
						plan,
						where,
						{
							kind: "changed",
							reason: "unsynced",
							path: file.path,
							gitSha: atNew,
							gitText: await client.getBlob(atNew),
						},
						now,
					),
				};
			}
		} else if (atNew !== null && atNew !== file.blobSha) {
			return {
				changes: [],
				conflict: conflictOf(
					plan,
					where,
					{ kind: "changed", reason: "unsynced", path: file.path, gitSha: atNew, gitText: await client.getBlob(atNew) },
					now,
				),
			};
		}
	}

	// The file already says exactly this: only the record is missing.
	if (atNew === file.blobSha && (!record || record.path === file.path)) {
		return { changes: [], record: nextRecord(file.blobSha, file.blobSha) };
	}

	const changes: FileChange[] = [{ path: file.path, text: file.text }];
	if (oldPath !== undefined && oldPath !== file.path && atOld !== null) changes.push({ path: oldPath, delete: true });
	const renamed = oldPath !== undefined && oldPath !== file.path;
	return {
		changes,
		record: nextRecord(file.blobSha, target.mode === "pr" ? atNew : file.blobSha),
		summary: `${renamed ? "Rename to" : "Publish"} ${entry.collection}/${file.slug} (${entry.locale})`,
		written: true,
	};
}

/** The commit message: one line for a single change, a headline and a list for a batch. */
const messageOf = (summaries: readonly string[]): string =>
	summaries.length === 1
		? (summaries[0] ?? "Sync from Monti")
		: `Sync ${summaries.length} changes from Monti\n\n${summaries.map((line) => `- ${line}`).join("\n")}`;

interface Committed {
	readonly commitSha: string;
	readonly branch: string;
	readonly pullRequestUrl?: string;
	readonly note?: string;
}

/**
 * Puts the changes in the repo: a commit on the branch (`"commit"`), or a commit on the pull request branch and an open pull request (`"pr"`). A pull request that
 * is already open is added to; with none open, the branch starts again from the head of the base branch, so each pull request holds only what is new since the last.
 */
async function commitChanges(
	target: ResolvedTarget,
	client: GitHubClient,
	head: BranchHead,
	changes: readonly FileChange[],
	summaries: readonly string[],
): Promise<Committed> {
	const message = messageOf(summaries);
	// A few blobs at a time: a first sync has many files, and GitHub does not like a flood of writes.
	const entries: { path: string; sha: string | null }[] = [];
	for (let start = 0; start < changes.length; start += BLOB_BATCH) {
		entries.push(
			...(await Promise.all(
				changes.slice(start, start + BLOB_BATCH).map(async (change) => ({
					path: change.path,
					sha: change.delete ? null : await client.createBlob(change.text),
				})),
			)),
		);
	}

	if (target.mode === "commit") {
		const tree = await client.createTree({ baseTree: head.treeSha, entries });
		const commitSha = await client.createCommit({ message, tree, parents: [head.commitSha] });
		await client.updateBranch(target.branch, commitSha);
		return { commitSha, branch: target.branch };
	}

	const open = await client.findOpenPullRequest({ head: target.prBranch, base: target.branch });
	const prHead = await client.getBranchHead(target.prBranch);
	const parent = open && prHead ? prHead : head;
	const tree = await client.createTree({ baseTree: parent.treeSha, entries });
	const commitSha = await client.createCommit({ message, tree, parents: [parent.commitSha] });
	if (prHead) await client.updateBranch(target.prBranch, commitSha, { force: !open });
	else await client.createBranch(target.prBranch, commitSha);
	if (open) return { commitSha, branch: target.prBranch, pullRequestUrl: open.url };

	const body = `Published from Monti:\n\n${summaries.map((line) => `- ${line}`).join("\n")}`;
	const pullRequest = await client.createPullRequest({
		head: target.prBranch,
		base: target.branch,
		title: summaries.length === 1 ? (summaries[0] ?? "Sync from Monti") : `Sync ${summaries.length} changes from Monti`,
		body,
	});
	let note: string | undefined;
	try {
		if ((await client.getRepo()).allowAutoMerge) await client.enableAutoMerge(pullRequest);
		else note = "Auto-merge is off for this repo, so the pull request waits for a merge";
	} catch (error) {
		// The pull request is open and complete; only the convenience failed (a repo with no required checks has nothing to wait for, for instance).
		note = `Auto-merge could not be enabled: ${errorText(error)}`;
	}
	return { commitSha, branch: target.prBranch, pullRequestUrl: pullRequest.url, ...(note ? { note } : {}) };
}

/**
 * Commits everything in a target's queue. Entries that cannot be planned (an export that fails, a conflict) do not hold the others back; the failed ones stay
 * queued and make the call throw once the rest is committed, so the outbox retries. `entries` adds entries to push whatever git says about them.
 */
export async function flushTarget(
	ctx: SyncContext,
	target: ResolvedTarget,
	options: { readonly force?: readonly string[] } = {},
): Promise<FlushResult> {
	const result = await ctx.withLock(target, async (): Promise<FlushResult> => {
		const queued = await ctx.state.queue.list(target.id);
		const empty = { target: target.id, written: 0, removed: 0, conflicts: 0, failed: [] };
		if (queued.length === 0) return empty;
		const client = await ctx.client(target);
		const { pattern } = await ctx.format(target);
		const head = await client.getBranchHead(target.branch);
		if (!head)
			throw new GitSyncError(
				problemText({
					what: `The branch "${target.branch}" does not exist in ${target.repo}`,
					where: "`branch` of the target in gitSync() of monti.config.ts",
					fix: `create the branch in the repo (a new repo needs a first commit), or set \`branch\` to one that exists`,
				}),
			);
		const plan: PlanContext = {
			ctx,
			target,
			pattern,
			client,
			remote: await client.listFiles(head, target.folder),
			records: await ctx.state.records.list(target.id),
			conflicts: new Map((await ctx.state.conflicts.list(target.id)).map((conflict) => [conflict.entryId, conflict])),
			forced: new Set(options.force ?? []),
			prOpen:
				target.mode === "pr" &&
				(await client.findOpenPullRequest({ head: target.prBranch, base: target.branch })) !== null,
		};

		const planned: { entryId: string; version: number; plan: Planned }[] = [];
		const failed: { entryId: string; message: string }[] = [];
		for (const { item, version } of queued) {
			try {
				planned.push({
					entryId: item.entryId,
					version,
					plan: await planEntry(plan, item.entryId, await readEntry(ctx, item.entryId)),
				});
			} catch (error) {
				failed.push({ entryId: item.entryId, message: errorText(error) });
			}
		}

		// One path is touched once: the last plan for it wins, and a write beats a delete of the same path (a rename onto a path another entry frees).
		const byPath = new Map<string, FileChange>();
		for (const { plan: entryPlan } of planned) {
			for (const change of entryPlan.changes) {
				const existing = byPath.get(change.path);
				if (!existing || !change.delete || existing.delete) byPath.set(change.path, change);
			}
		}
		const changes = [...byPath.values()];
		const summaries = planned.flatMap(({ plan: entryPlan }) => (entryPlan.summary ? [entryPlan.summary] : []));

		let committed: Committed | undefined;
		if (changes.length > 0) committed = await commitChanges(target, client, head, changes, summaries);

		let conflicts = 0;
		for (const { entryId, version, plan: entryPlan } of planned) {
			if (entryPlan.conflict) {
				await ctx.state.conflicts.put(entryPlan.conflict);
				conflicts += 1;
			}
			if (entryPlan.record === null) await ctx.state.records.remove(target.id, entryId);
			else if (entryPlan.record) await ctx.state.records.put(entryPlan.record);
			await ctx.state.queue.removeIfUnchanged(target.id, entryId, version);
		}
		if (committed) {
			await ctx.state.status.patch(target.id, {
				lastFlushAt: ctx.now(),
				lastFlush: {
					at: new Date(ctx.now()).toISOString(),
					files: changes.length,
					commitSha: committed.commitSha,
					branch: committed.branch,
					...(committed.pullRequestUrl ? { pullRequestUrl: committed.pullRequestUrl } : {}),
					...(committed.note ? { note: committed.note } : {}),
				},
			});
		}
		return {
			target: target.id,
			written: planned.filter(({ plan: entryPlan }) => entryPlan.written).length,
			removed: planned.filter(({ plan: entryPlan }) => entryPlan.removed).length,
			conflicts,
			...(committed ? { commitSha: committed.commitSha, branch: committed.branch } : {}),
			...(committed?.pullRequestUrl ? { pullRequestUrl: committed.pullRequestUrl } : {}),
			failed,
		};
	});
	if (result.failed.length > 0) {
		const first = result.failed[0];
		throw new GitSyncError(
			`${result.failed.length} queued ${result.failed.length === 1 ? "entry" : "entries"} could not be synced (${first?.entryId}: ${first?.message}); they stay queued and are retried`,
		);
	}
	return result;
}

/** Puts an entry in the queue of a target. */
export async function enqueue(ctx: SyncContext, target: ResolvedTarget, entryId: string): Promise<number> {
	const queuedAt = ctx.now();
	await ctx.state.queue.put({ target: target.id, entryId, queuedAt });
	return queuedAt;
}

const trailing = new WeakMap<SyncContext, Map<string, ReturnType<typeof setTimeout>>>();

/** On a server that keeps running, flushes the queue when the batching window ends, without waiting for the outbox to retry. Harmless where the process is frozen. */
function scheduleTrailingFlush(ctx: SyncContext, target: ResolvedTarget, delayMs: number): void {
	const timers = trailing.get(ctx) ?? new Map<string, ReturnType<typeof setTimeout>>();
	trailing.set(ctx, timers);
	if (timers.has(target.id)) return;
	const timer = setTimeout(() => {
		timers.delete(target.id);
		flushTarget(ctx, target).catch((error) => {
			if (!(error instanceof GitSyncNotConfigured)) console.error(`[git-sync] flush of ${target.id} failed`, error);
		});
	}, delayMs);
	timer.unref?.();
	timers.set(target.id, timer);
}

/** Flushes now, or, inside the batching window, waits for the window to end. Throws until the entry is committed. */
async function settle(
	ctx: SyncContext,
	target: ResolvedTarget,
	entryId: string,
	queuedAt: number,
): Promise<Date | undefined> {
	const { lastFlushAt } = await ctx.state.status.get(target.id);
	const sinceLast = ctx.now() - (lastFlushAt ?? 0);
	if (ctx.debounceMs > 0 && sinceLast < ctx.debounceMs) {
		const wait = ctx.debounceMs - sinceLast;
		scheduleTrailingFlush(ctx, target, wait);
		// Not a failure: the outbox calls the subscriber again when the window ends.
		return new Date(ctx.now() + wait);
	}
	await flushTarget(ctx, target);
	// Still queued although nothing failed: another process holds it (or a newer event queued the entry again and will flush it itself).
	const left = await ctx.state.queue.get(target.id, entryId);
	if (left && left.value.queuedAt <= queuedAt) {
		throw new GitSyncError("The entry is queued but was not committed yet; it is retried");
	}
	return undefined;
}

/** What handling one event did for each target: failures to throw, and the moments to be called again at. */
export interface EventOutcome {
	readonly failures: unknown[];
	readonly deferred: Date[];
}

/**
 * The part of the `afterCommit` subscriber for published files. For each target that syncs the entry's collection it queues the entry and commits the queue.
 * The event only says that something happened; what goes to the repo is the entry as it is now (its published version, or none).
 */
export async function onPublishedEvent(ctx: SyncContext, event: ContentEvent): Promise<EventOutcome> {
	const failures: unknown[] = [];
	const deferred: Date[] = [];
	if (!FILE_KINDS.has(event.kind)) return { failures, deferred };
	const targets = ctx.targets.filter((target) => target.collections.includes(event.collection));
	if (targets.length === 0) return { failures, deferred };
	const entry = event.kind === "deleted" ? null : await event.read();
	for (const target of targets) {
		try {
			if (isSyncable(entry, target)) {
				// The publish an import caused: its file is already what the entry says.
				const { pattern } = await ctx.format(target);
				const path = pattern.render({
					collection: entry.collection,
					slug: entry.publishedSlug,
					locale: entry.locale,
					id: entry.id,
				});
				if (await ctx.state.applying.isMarked(target.id, path, ctx.now(), APPLYING_WINDOW_MS)) continue;
				// A later call for an event whose entry went out in the meantime (the batch window ended and a flush, which came after the event, took it)
				// has nothing left to do.
				const record = await ctx.state.records.get(target.id, entry.id);
				if (record?.blobSha && record.contentHash === entry.published.contentHash && record.path === path) {
					const { lastFlushAt } = await ctx.state.status.get(target.id);
					if (lastFlushAt !== undefined && lastFlushAt >= event.occurredAt.getTime()) continue;
				}
			}
			const queuedAt = await enqueue(ctx, target, event.entryId);
			// Writing files into the CMS holds the target's lock in this process: the commit waits until that is over.
			if (ctx.importing.has(target.id)) {
				deferred.push(new Date(ctx.now() + 1000));
				continue;
			}
			const retryAt = await settle(ctx, target, event.entryId, queuedAt);
			if (retryAt) deferred.push(retryAt);
		} catch (error) {
			// No token saved yet is a setup state: wait for it (an hour at a time; saving the token resumes the deliveries at once) instead of failing.
			if (error instanceof GitSyncNotConfigured) deferred.push(new Date(ctx.now() + NOT_CONFIGURED_RETRY_MS));
			else failures.push(error);
		}
	}
	return { failures, deferred };
}

/**
 * Called after a token was saved: commits what waited in the queues and delivers the deferred events (they find their entries committed). Failures are not
 * the save's business, so none is thrown: they stay queued and are retried like any other.
 */
export async function resumeAfterToken(ctx: SyncContext): Promise<void> {
	for (const target of ctx.targets) {
		if ((await ctx.state.queue.list(target.id)).length === 0) continue;
		await flushTarget(ctx, target).catch((error) =>
			console.error(`[git-sync] flush of ${target.id} after saving the token failed`, error),
		);
	}
	await ctx.cms.events
		.retry({ all: true })
		.catch((error) => console.error("[git-sync] event retry after saving the token failed", error));
}

/** Queues every published entry of a target (the first sync) and commits them in one go. Entries already in git as they are cost nothing. */
export async function pushAll(
	ctx: SyncContext,
	target: ResolvedTarget,
): Promise<FlushResult & { readonly queued: number }> {
	const entries = await ctx.cms.store().listPublishedEntries({ collections: target.collections, includeBody: false });
	for (const entry of entries) await enqueue(ctx, target, entry.id);
	const result = await flushTarget(ctx, target);
	return { ...result, queued: entries.length };
}

/** Pushes the server's version of the given entries, whatever git says (what "Use server version" does). */
export async function pushEntries(
	ctx: SyncContext,
	target: ResolvedTarget,
	entryIds: readonly string[],
): Promise<FlushResult> {
	for (const entryId of entryIds) await enqueue(ctx, target, entryId);
	return flushTarget(ctx, target, { force: entryIds });
}
