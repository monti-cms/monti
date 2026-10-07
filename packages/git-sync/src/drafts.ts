import type { ContentEvent, Entry } from "@monti-cms/core/plugin/server";
import { readEntry } from "./apply";
import { exportDraft, exportEntry, hasDraftFile, isSyncable } from "./entry-file";
import { type FileChange, type GitHubClient, isMergeBlocked } from "./github/client";
import { DRAFT_BRANCH_PREFIX, type ResolvedTarget } from "./options";
import { type EventOutcome, errorText } from "./outbound";
import type { DraftRecord } from "./state";
import { GitSyncError, GitSyncNotConfigured, NOT_CONFIGURED_RETRY_MS, type SyncContext } from "./sync";

/**
 * Drafts, outbound: from the CMS to the draft branches (targets with `drafts: true`).
 *
 * An entry with unpublished changes has a branch `monti/draft/<slug>`, created from the target's branch, with its draft file, and a pull request from that branch
 * into the target's branch. Every event of an entry makes {@link reconcileDraft} look at the entry as it is now, so a stale or repeated event does no harm:
 *
 * - The entry has a draft that is not published: its file goes to the branch (the branch and the pull request are created on the first save). The pull request is
 *   opened or updated with a title and a body that link back to the entry in the admin.
 * - It has none (the draft was discarded, the entry was trashed, archived or deleted): the pull request is closed and the branch deleted.
 *
 * Saves come in bursts (the editor autosaves), so an entry waits until it has been quiet for `draftDebounceMs` before its branch is written. The wait uses the event
 * outbox's defer, as the batching of published files does. Publishing in the CMS is not debounced: it merges the pull request ({@link publishDraft}). The outbox
 * keeps the order of an entry's events, so a publish made inside the quiet period is delivered when the period ends.
 */

const BLOCKED_NOTE = "Auto-merge is off for this repo, so the pull request waits for a merge";

/** The part of a slug that goes in a branch name: letters and digits of any language, `.`, `_` and `-`. */
const refPart = (slug: string, fallback: string): string => {
	const cleaned = slug
		.normalize("NFC")
		.replace(/[^\p{L}\p{N}._-]+/gu, "-")
		.replace(/\.{2,}/g, ".")
		.replace(/-{2,}/g, "-")
		.replace(/^[.-]+|[.-]+$/g, "")
		.replace(/\.lock$/i, "-lock");
	return cleaned || fallback;
};

/**
 * The branch of an entry's draft: `monti/draft/<slug>`. When another draft of the same repo already has that name (the same slug in another collection or language)
 * the entry's id is added, so two drafts never share a branch.
 */
async function pickBranch(ctx: SyncContext, target: ResolvedTarget, entry: Entry & { workingSlug: string }) {
	const wanted = `${DRAFT_BRANCH_PREFIX}${refPart(entry.workingSlug, entry.id)}`;
	for (const other of ctx.targets) {
		if (!other.drafts || other.repo.toLowerCase() !== target.repo.toLowerCase()) continue;
		for (const record of (await ctx.state.drafts.list(other.id)).values()) {
			if (record.branch === wanted && (record.entryId !== entry.id || other.id !== target.id)) {
				return `${wanted}-${entry.id.slice(0, 8)}`;
			}
		}
	}
	return wanted;
}

/** Where the entry is edited in the admin: an address with the site's origin when the site config has one, the path otherwise. */
export function adminLinkOf(ctx: SyncContext, entry: Pick<Entry, "id" | "collection">): string {
	const { site } = ctx.cms;
	const path = site.isItemCollection(entry.collection)
		? site.adminUrl(`?collection=${encodeURIComponent(entry.collection)}`)
		: site.adminUrl(`/entries/${entry.id}/edit`);
	const origin = site.config.site?.url;
	return origin ? new URL(path, origin).toString() : path;
}

const labelOf = (entry: Entry & { workingSlug: string }): string => {
	const title = (entry.working.metadata as Record<string, unknown>).title;
	return typeof title === "string" && title.trim() !== "" ? title.trim() : entry.workingSlug;
};

/** The title and the body of a draft pull request. */
function describePullRequest(ctx: SyncContext, entry: Entry & { workingSlug: string }) {
	const label = labelOf(entry);
	return {
		title: `Draft: ${label}`,
		body: [
			`Draft of "${label}" (${entry.collection}/${entry.workingSlug}, ${entry.locale}), saved in Monti.`,
			"",
			`[Edit it in Monti](${adminLinkOf(ctx, entry)})`,
			"",
			"Merging this pull request publishes the entry. Closing it leaves the draft in Monti as it is.",
		].join("\n"),
	};
}

/** Commits changes on top of a commit and returns the new commit's sha. */
async function commitOnto(
	client: GitHubClient,
	base: { readonly commitSha: string; readonly treeSha: string },
	changes: readonly FileChange[],
	message: string,
): Promise<string> {
	const entries: { path: string; sha: string | null }[] = [];
	for (const change of changes) {
		entries.push({ path: change.path, sha: change.delete ? null : await client.createBlob(change.text) });
	}
	const tree = await client.createTree({ baseTree: base.treeSha, entries });
	return client.createCommit({ message, tree, parents: [base.commitSha] });
}

/** Closes the draft's pull request, deletes its branch and forgets it. */
async function retireDraft(
	ctx: SyncContext,
	target: ResolvedTarget,
	client: GitHubClient,
	record: DraftRecord,
): Promise<void> {
	const pullRequest = await client.findOpenPullRequest({ head: record.branch, base: target.branch });
	if (pullRequest) await client.closePullRequest(pullRequest);
	await client.deleteBranch(record.branch);
	await ctx.state.drafts.remove(target.id, record.entryId);
	await ctx.state.conflicts.remove(target.id, record.entryId, "draft");
}

/**
 * Whether the entry was published in the CMS and that publish is not in git yet. The saves a publish makes (a save that publishes at once) arrive before the
 * publish event; they must not be taken for a discarded draft.
 */
async function publishInFlight(
	ctx: SyncContext,
	target: ResolvedTarget,
	entry: Entry | null,
	record: DraftRecord,
): Promise<boolean> {
	if (record.publishing) return true;
	if (!isSyncable(entry, target)) return false;
	const synced = await ctx.state.records.get(target.id, entry.id);
	return !(
		synced?.blobSha &&
		synced.contentHash === entry.published.contentHash &&
		synced.slug === entry.publishedSlug
	);
}

/**
 * Makes the draft branch and the pull request say what the entry's draft says now (see the top of the file). With `force` a file edited on the branch is
 * overwritten (what "Use server version" does); otherwise an edit on the branch since the last sync, together with a change on the server, is a conflict.
 */
export async function reconcileDraft(
	ctx: SyncContext,
	target: ResolvedTarget,
	entryId: string,
	options: { readonly force?: boolean } = {},
): Promise<void> {
	await ctx.withLock(target, async () => {
		const entry = await readEntry(ctx, entryId);
		const record = await ctx.state.drafts.get(target.id, entryId);

		if (!hasDraftFile(entry, target)) {
			// Discarded (back to the published version), trashed, archived or deleted: nothing to propose any more.
			if (!record) return;
			if (await publishInFlight(ctx, target, entry, record)) return;
			await retireDraft(ctx, target, await ctx.client(target), record);
			return;
		}

		// A pull request that carries a publish waiting for its merge is not touched: new edits go to a new pull request once it has merged.
		if (record?.publishing) return;
		if (
			!options.force &&
			((await ctx.state.conflicts.get(target.id, entryId, "draft")) ||
				(await ctx.state.conflicts.get(target.id, entryId)))
		) {
			return;
		}

		const client = await ctx.client(target);
		const { pattern } = await ctx.format(target);
		let current = record;
		if (current && current.slug !== entry.workingSlug) {
			// The draft has a new address: a new branch and pull request, and the old ones are closed (a branch cannot be renamed through the git data API).
			await retireDraft(ctx, target, client, current);
			current = null;
		}
		// Nothing changed on the server since the last sync (the save was an echo of an import, or an event delivered twice).
		if (current && !options.force && current.contentHash === entry.working.contentHash) return;

		const main = await client.getBranchHead(target.branch);
		if (!main) throw new GitSyncError(`The branch "${target.branch}" does not exist in ${target.repo}`);
		const draft = await exportDraft(ctx.cms, target, pattern, entry);
		const branch = current?.branch ?? (await pickBranch(ctx, target, entry));
		const branchHead = await client.getBranchHead(branch);
		const base = branchHead ?? main;
		const files = await client.listFiles(base, target.folder);

		if (current && branchHead && !options.force) {
			const onBranch = files.get(current.path) ?? null;
			// The file was edited on the branch since the last sync, and the draft changed on the server too: nothing is merged.
			if (onBranch !== null && onBranch !== current.blobSha && onBranch !== draft.blobSha) {
				await ctx.state.conflicts.put({
					id: `${target.id}:draft:${entry.id}`,
					scope: "draft",
					target: target.id,
					entryId: entry.id,
					collection: entry.collection,
					locale: entry.locale,
					path: current.path,
					kind: "changed",
					reason: "both-changed",
					gitSha: onBranch,
					gitText: await client.getBlob(onBranch),
					detectedAt: new Date(ctx.now()).toISOString(),
				});
				return;
			}
		}

		const changes: FileChange[] = [];
		if (files.get(draft.path) !== draft.blobSha) changes.push({ path: draft.path, text: draft.text });
		// A published entry whose draft has a new address: the merge renames its file, as a publish of the new address does.
		if (isSyncable(entry, target) && entry.publishedSlug !== entry.workingSlug) {
			const published = pattern.render({
				collection: entry.collection,
				slug: entry.publishedSlug,
				locale: entry.locale,
				id: entry.id,
			});
			if (published !== draft.path && files.has(published)) changes.push({ path: published, delete: true });
		}
		// The draft is what the target's branch already has (an unpublished entry whose file was not removed): there is nothing to propose.
		if (changes.length === 0 && !branchHead) return;

		if (changes.length > 0) {
			const commitSha = await commitOnto(
				client,
				base,
				changes,
				`Draft ${entry.collection}/${entry.workingSlug} (${entry.locale})`,
			);
			if (branchHead) await client.updateBranch(branch, commitSha);
			else await client.createBranch(branch, commitSha);
		}

		const { title, body } = describePullRequest(ctx, entry);
		let pullRequest = await client.findOpenPullRequest({ head: branch, base: target.branch });
		if (!pullRequest) pullRequest = await client.createPullRequest({ head: branch, base: target.branch, title, body });
		else if (current?.title !== title) await client.updatePullRequest(pullRequest, { title, body });

		await ctx.state.drafts.put({
			target: target.id,
			entryId: entry.id,
			collection: entry.collection,
			locale: entry.locale,
			slug: entry.workingSlug,
			branch,
			path: draft.path,
			prNumber: pullRequest.number,
			prUrl: pullRequest.url,
			title,
			blobSha: draft.blobSha,
			contentHash: entry.working.contentHash,
			syncedAt: new Date(ctx.now()).toISOString(),
		});
	});
}

/**
 * Publishing in the CMS, for an entry that has a draft pull request: the branch gets the published version (what is in the CMS now, which the debounce may not
 * have sent yet), and the pull request is squash-merged instead of making a separate commit. Returns whether the draft pull request took the publish (so the
 * published-file flow leaves it alone):
 *
 * - merged: the file is in the target's branch; the pull request and branch are done.
 * - blocked (a required check, branch protection, a conflict): in `"commit"` mode the pull request is closed and the publish goes the usual way, a commit to the
 *   branch (`false`). In `"pr"` mode the pull request stays open with auto-merge on and carries the publish; merging it, by auto-merge or by hand, completes it.
 * - no pull request any more (closed by hand, branch deleted): the record is dropped and the publish goes the usual way (`false`).
 */
export async function publishDraft(ctx: SyncContext, target: ResolvedTarget, entry: Entry | null): Promise<boolean> {
	if (!isSyncable(entry, target)) return false;
	if (!(await ctx.state.drafts.get(target.id, entry.id))) return false;
	return ctx.withLock(target, async () => {
		const record = await ctx.state.drafts.get(target.id, entry.id);
		if (!record) return false;
		// A decision is waiting: nothing is pushed for the entry until it is made (the decision publishes it).
		if (await ctx.state.conflicts.get(target.id, entry.id, "draft")) return true;
		const client = await ctx.client(target);
		const { pattern } = await ctx.format(target);
		const pullRequest = await client.findOpenPullRequest({ head: record.branch, base: target.branch });
		const branchHead = await client.getBranchHead(record.branch);
		if (!pullRequest || !branchHead) {
			if (branchHead) await client.deleteBranch(record.branch);
			await ctx.state.drafts.remove(target.id, entry.id);
			return false;
		}

		// The branch says what was published.
		const file = await exportEntry(ctx.cms, target, pattern, entry);
		const files = await client.listFiles(branchHead, target.folder);
		const synced = await ctx.state.records.get(target.id, entry.id);
		const changes: FileChange[] = [];
		if (files.get(file.path) !== file.blobSha) changes.push({ path: file.path, text: file.text });
		for (const stale of new Set([record.path, synced?.path])) {
			if (stale && stale !== file.path && files.has(stale)) changes.push({ path: stale, delete: true });
		}
		let tip = branchHead.commitSha;
		if (changes.length > 0) {
			tip = await commitOnto(client, branchHead, changes, `Publish ${entry.collection}/${file.slug} (${entry.locale})`);
			await client.updateBranch(record.branch, tip);
		}

		const heading = (entry.published.metadata as Record<string, unknown>).title;
		const title = `Publish: ${typeof heading === "string" && heading.trim() !== "" ? heading.trim() : file.slug}`;
		const publishedRecord = (baseSha: string | null) => ({
			target: target.id,
			entryId: entry.id,
			collection: entry.collection,
			locale: entry.locale,
			slug: file.slug,
			path: file.path,
			blobSha: file.blobSha,
			baseSha,
			contentHash: file.contentHash,
			syncedAt: new Date(ctx.now()).toISOString(),
		});

		try {
			const merged = await client.mergePullRequest(pullRequest, { title });
			await ctx.state.records.put(publishedRecord(file.blobSha));
			await ctx.state.drafts.remove(target.id, entry.id);
			await client.deleteBranch(record.branch);
			await ctx.state.status.patch(target.id, {
				lastFlushAt: ctx.now(),
				lastFlush: {
					at: new Date(ctx.now()).toISOString(),
					files: Math.max(changes.length, 1),
					commitSha: merged.sha ?? tip,
					branch: target.branch,
					pullRequestUrl: pullRequest.url,
					note: `Merged the draft pull request #${pullRequest.number}`,
				},
			});
			return true;
		} catch (error) {
			if (!isMergeBlocked(error)) throw error;
			if (target.mode === "commit") {
				// The usual way for this target is a commit to the branch: the draft pull request has served its purpose.
				await retireDraft(ctx, target, client, record);
				return false;
			}
			let note: string | undefined;
			try {
				if ((await client.getRepo()).allowAutoMerge) await client.enableAutoMerge(pullRequest);
				else note = BLOCKED_NOTE;
			} catch (autoMergeError) {
				note = `Auto-merge could not be enabled: ${errorText(autoMergeError)}`;
			}
			const main = await client.getBranchHead(target.branch);
			const onMain = main ? ((await client.listFiles(main, target.folder)).get(file.path) ?? null) : null;
			await ctx.state.records.put(publishedRecord(onMain));
			await ctx.state.drafts.put({
				...record,
				slug: file.slug,
				path: file.path,
				blobSha: file.blobSha,
				contentHash: file.contentHash,
				publishing: true,
				syncedAt: new Date(ctx.now()).toISOString(),
			});
			await ctx.state.status.patch(target.id, {
				lastFlushAt: ctx.now(),
				lastFlush: {
					at: new Date(ctx.now()).toISOString(),
					files: Math.max(changes.length, 1),
					commitSha: tip,
					branch: record.branch,
					pullRequestUrl: pullRequest.url,
					...(note ? { note } : { note: "The pull request could not merge yet; auto-merge is on" }),
				},
			});
			return true;
		}
	});
}

const timers = new WeakMap<SyncContext, Map<string, ReturnType<typeof setTimeout>>>();

/**
 * On a server that keeps running, writes the draft branch when the entry's quiet period ends, without waiting for the outbox to retry. A newer save of the same
 * entry replaces the timer. Harmless where the process is frozen: the outbox calls the subscriber again.
 */
function scheduleTrailingDraft(ctx: SyncContext, target: ResolvedTarget, entryId: string, delayMs: number): void {
	const pending = timers.get(ctx) ?? new Map<string, ReturnType<typeof setTimeout>>();
	timers.set(ctx, pending);
	const key = `${target.id}:${entryId}`;
	clearTimeout(pending.get(key));
	const timer = setTimeout(() => {
		pending.delete(key);
		reconcileDraft(ctx, target, entryId)
			// The events that waited behind the deferred save (a publish made inside the quiet period) are due now.
			.then(() => ctx.cms.events.retry())
			.catch((error) => {
				if (!(error instanceof GitSyncNotConfigured)) console.error(`[git-sync] draft of ${entryId} failed`, error);
			});
	}, delayMs + 50);
	timer.unref?.();
	pending.set(key, timer);
}

/** What handling an event for drafts did, and the targets whose draft pull request took a publish. */
export interface DraftEventOutcome extends EventOutcome {
	readonly skip: Set<string>;
}

/**
 * The part of the `afterCommit` subscriber for drafts. A publish is handled at once (it merges the pull request). Any other change makes the draft branch say what
 * the entry says now, once the entry has been quiet for `draftDebounceMs`: until then the delivery is deferred, and an event that a newer change of the entry
 * has overtaken is dropped (the newer one carries the entry as it is).
 */
export async function onDraftEvent(ctx: SyncContext, event: ContentEvent): Promise<DraftEventOutcome> {
	const outcome: DraftEventOutcome = { failures: [], deferred: [], skip: new Set() };
	const targets = ctx.targets.filter((target) => target.drafts && target.collections.includes(event.collection));
	if (targets.length === 0) return outcome;
	const entry = event.kind === "deleted" ? null : await event.read();
	const published = event.kind === "published";
	if (!published && entry && entry.version > event.version) return outcome;

	for (const target of targets) {
		try {
			// Writing files into the CMS holds the target's lock in this process: the draft waits until that is over.
			if (ctx.importing.has(target.id)) {
				outcome.deferred.push(new Date(ctx.now() + 1000));
				continue;
			}
			if (published) {
				if (await publishDraft(ctx, target, entry)) outcome.skip.add(target.id);
				continue;
			}
			if (!hasDraftFile(entry, target)) {
				if (await ctx.state.drafts.get(target.id, event.entryId)) await reconcileDraft(ctx, target, event.entryId);
				continue;
			}
			const due = event.occurredAt.getTime() + ctx.draftDebounceMs;
			if (ctx.now() < due) {
				scheduleTrailingDraft(ctx, target, event.entryId, due - ctx.now());
				outcome.deferred.push(new Date(due));
				continue;
			}
			await reconcileDraft(ctx, target, event.entryId);
		} catch (error) {
			// The pull request is in an unknown state: the usual publish must not run behind its back.
			if (published) outcome.skip.add(target.id);
			// No token saved yet is a setup state: wait for it instead of failing.
			if (error instanceof GitSyncNotConfigured) outcome.deferred.push(new Date(ctx.now() + NOT_CONFIGURED_RETRY_MS));
			else outcome.failures.push(error);
		}
	}
	return outcome;
}

/** The pull requests of a target's open drafts (the Sync tab), or of one entry (the editor's "Draft PR" link). */
export async function listDraftPullRequests(ctx: SyncContext, filter: { readonly entryId?: string } = {}) {
	const items: {
		readonly target: string;
		readonly repo: string;
		readonly entryId: string;
		readonly collection: string;
		readonly locale: string;
		readonly slug: string;
		readonly title: string;
		readonly branch: string;
		readonly number: number;
		readonly url: string;
		readonly publishing: boolean;
	}[] = [];
	for (const target of ctx.targets) {
		if (!target.drafts) continue;
		for (const record of (await ctx.state.drafts.list(target.id)).values()) {
			if (record.prClosed) continue;
			if (filter.entryId !== undefined && record.entryId !== filter.entryId) continue;
			items.push({
				target: target.id,
				repo: target.repo,
				entryId: record.entryId,
				collection: record.collection,
				locale: record.locale,
				slug: record.slug,
				title: record.title,
				branch: record.branch,
				number: record.prNumber,
				url: record.prUrl,
				publishing: record.publishing === true,
			});
		}
	}
	return items;
}
