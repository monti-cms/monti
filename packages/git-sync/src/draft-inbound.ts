import { applyDraftFile, applyFile, describeError, readEntry, recordOf } from "./apply";
import { exportDraft, exportEntry, hasDraftFile, isSyncable, parseEntryFile, sameContent } from "./entry-file";
import type { GitHubClient } from "./github/client";
import type { ResolvedTarget } from "./options";
import { enqueue, flushTarget } from "./outbound";
import { type ConflictRecord, type DraftRecord, entryKey } from "./state";
import { GitSyncError, type SyncContext } from "./sync";

/**
 * Drafts, inbound: from the draft branches to the CMS.
 *
 * - A push to a draft branch (`monti/draft/...`) reads the file on the branch and saves it as the entry's draft, through the target's format and the same
 *   pipeline as an edit in the admin, without publishing. If the entry's draft also changed on the server since the last sync, nothing is written: a conflict is
 *   recorded and a person picks a side, as for published files.
 * - A draft pull request merged on GitHub publishes the entry, with the merged file as its published version ({@link applyMergedDraft}).
 * - A draft pull request closed without merging leaves the draft as it is.
 */

export interface DraftPullResult {
	readonly target: string;
	readonly branch: string;
	readonly outcome: "applied" | "unchanged" | "conflict" | "ignored" | "error";
	readonly message?: string;
}

/**
 * Reads the file of a draft branch after a push and applies it to the entry's draft. Edits already known (the pushes git-sync made itself) change nothing.
 */
export async function pullDraft(ctx: SyncContext, target: ResolvedTarget, branch: string): Promise<DraftPullResult> {
	const result = (outcome: DraftPullResult["outcome"], message?: string): DraftPullResult => ({
		target: target.id,
		branch,
		outcome,
		...(message ? { message } : {}),
	});
	return ctx.withLock(target, async () => {
		const record = [...(await ctx.state.drafts.list(target.id)).values()].find((item) => item.branch === branch);
		if (!record) return result("ignored", "no draft uses this branch");
		if (record.publishing) return result("ignored", "the pull request carries a publish");
		const client = await ctx.client(target);
		const { pattern } = await ctx.format(target);
		const head = await client.getBranchHead(branch);
		if (!head) return result("ignored", "the branch is gone");
		const sha = (await client.listFiles(head, target.folder)).get(record.path);
		if (sha === undefined) return result("ignored", `the file ${record.path} is not on the branch`);
		const open = await ctx.state.conflicts.get(target.id, record.entryId, "draft");
		if (sha === record.blobSha) {
			// Back to what was last synced (the edit was undone): there is nothing to decide any more.
			if (open) await ctx.state.conflicts.remove(target.id, record.entryId, "draft");
			return result("unchanged");
		}

		const entry = await readEntry(ctx, record.entryId);
		if (!entry || (entry.status !== "draft" && entry.status !== "published")) {
			return result("ignored", "the entry is not editable (trashed, archived or deleted)");
		}
		const text = await client.getBlob(sha);
		const parsed = parseEntryFile(text);
		if (!parsed.ok) return result("error", `${record.path}: ${parsed.message}`);
		const { file } = parsed;

		const conflict = (): ConflictRecord => ({
			id: entryKey(target.id, `draft:${entry.id}`),
			scope: "draft",
			target: target.id,
			entryId: entry.id,
			collection: entry.collection,
			locale: entry.locale,
			path: record.path,
			kind: "changed",
			reason: "both-changed",
			gitSha: sha,
			gitText: text,
			detectedAt: new Date(ctx.now()).toISOString(),
		});
		if (open) {
			if (open.gitSha !== sha) await ctx.state.conflicts.put({ ...conflict(), detectedAt: open.detectedAt });
			return result("conflict");
		}
		const serverChanged = entry.working.contentHash !== record.contentHash || entry.workingSlug !== record.slug;
		if (serverChanged) {
			// The same text as the server's draft is not a conflict, only a record to bring up to date.
			if (hasDraftFile(entry, target)) {
				const exported = await exportDraft(ctx.cms, target, pattern, entry);
				if (sameContent(exported.text, text)) {
					await ctx.state.drafts.put({
						...record,
						blobSha: sha,
						contentHash: entry.working.contentHash,
						slug: entry.workingSlug,
						syncedAt: new Date(ctx.now()).toISOString(),
					});
					return result("unchanged");
				}
			}
			await ctx.state.conflicts.put(conflict());
			return result("conflict");
		}

		const slug = file.slug ?? pattern.parse(record.path)?.slug ?? record.slug;
		let saved: Awaited<ReturnType<typeof applyDraftFile>>;
		try {
			saved = await applyDraftFile(ctx, target, {
				path: record.path,
				sha,
				file,
				collection: entry.collection,
				locale: entry.locale,
				slug,
				entry,
			});
		} catch (error) {
			return result("error", describeError(error));
		}
		await ctx.state.drafts.put({
			...record,
			blobSha: sha,
			contentHash: saved.working.contentHash,
			slug: saved.workingSlug ?? record.slug,
			syncedAt: new Date(ctx.now()).toISOString(),
		});
		return result("applied");
	});
}

export type MergedDraftOutcome = "applied" | "in-sync" | "conflict" | "missing";

/**
 * A draft pull request was merged on GitHub: the file `sha` at the draft's path in the target's branch is the published version. The entry takes the file as its
 * draft and is published, so merging counts as publishing. Called with the target's lock held.
 *
 * - The file already says what the entry published (the CMS merged the pull request, or published it first): only the records are brought up to date.
 * - The entry's draft changed on the server since the last sync (a save inside the debounce window, say) and is not what was merged: a conflict is recorded, as when
 *   both sides changed anywhere else, and nothing is written.
 * - `"missing"`: the entry is gone or the merged pull request did not leave the file in the branch; there is nothing to apply.
 *
 * The draft's record and branch are cleaned up in every case.
 */
export async function applyMergedDraft(
	ctx: SyncContext,
	target: ResolvedTarget,
	client: GitHubClient,
	record: DraftRecord,
	sha: string | null,
): Promise<MergedDraftOutcome> {
	const finish = async () => {
		await ctx.state.drafts.remove(target.id, record.entryId);
		await ctx.state.conflicts.remove(target.id, record.entryId, "draft");
		await client.deleteBranch(record.branch).catch(() => undefined);
	};
	const entry = await readEntry(ctx, record.entryId);
	if (sha === null || !entry) {
		await finish();
		return "missing";
	}
	const { pattern } = await ctx.format(target);
	const text = await client.getBlob(sha);
	const now = new Date(ctx.now()).toISOString();

	if (isSyncable(entry, target)) {
		const published = await exportEntry(ctx.cms, target, pattern, entry);
		if (sameContent(published.text, text)) {
			await ctx.state.records.put({
				target: target.id,
				entryId: entry.id,
				collection: entry.collection,
				locale: entry.locale,
				slug: entry.publishedSlug,
				path: record.path,
				blobSha: sha,
				baseSha: sha,
				contentHash: entry.published.contentHash,
				syncedAt: now,
			});
			await finish();
			return "in-sync";
		}
	}

	const draftIsAsSynced = entry.working.contentHash === record.contentHash && entry.workingSlug === record.slug;
	const draftIsMerged =
		hasDraftFile(entry, target) && sameContent((await exportDraft(ctx.cms, target, pattern, entry)).text, text);
	if (!draftIsAsSynced && !draftIsMerged) {
		await ctx.state.conflicts.put({
			id: entryKey(target.id, entry.id),
			target: target.id,
			entryId: entry.id,
			collection: entry.collection,
			locale: entry.locale,
			path: record.path,
			kind: "changed",
			reason: "both-changed",
			gitSha: sha,
			gitText: text,
			detectedAt: now,
		});
		await finish();
		return "conflict";
	}

	const parsed = parseEntryFile(text);
	if (!parsed.ok) throw new GitSyncError(`${record.path} (the merged draft) cannot be read: ${parsed.message}`);
	const slug = parsed.file.slug ?? pattern.parse(record.path)?.slug ?? record.slug;
	const applied = await applyFile(ctx, target, {
		path: record.path,
		sha,
		file: parsed.file,
		collection: entry.collection,
		locale: entry.locale,
		slug,
		entry,
	});
	await ctx.state.records.put(recordOf(target, { path: record.path, sha }, applied, ctx.now()));
	await finish();
	return "applied";
}

export interface DraftPullRequestResult {
	readonly target: string;
	readonly number: number;
	readonly outcome: "published" | "closed" | "ignored" | "conflict";
	readonly message?: string;
}

/**
 * A `pull_request` event with the action `closed` for a pull request from a draft branch. Merged: the entry is published with the merged file. Closed without
 * merging: the draft is left as it is (the entry is untouched, and the next change of the draft opens a new pull request).
 */
export async function onDraftPullRequestClosed(
	ctx: SyncContext,
	target: ResolvedTarget,
	pullRequest: { readonly number: number; readonly branch: string; readonly merged: boolean },
): Promise<DraftPullRequestResult> {
	const result = (outcome: DraftPullRequestResult["outcome"], message?: string): DraftPullRequestResult => ({
		target: target.id,
		number: pullRequest.number,
		outcome,
		...(message ? { message } : {}),
	});
	let republish: string | undefined;
	const done = await ctx.withLock(target, async () => {
		const record = [...(await ctx.state.drafts.list(target.id)).values()].find(
			(item) => item.prNumber === pullRequest.number && item.branch === pullRequest.branch,
		);
		if (!record) return result("ignored", "no draft uses this pull request");
		if (!pullRequest.merged) {
			const { publishing, ...rest } = record;
			await ctx.state.drafts.put({ ...rest, prClosed: true });
			// A publish the CMS made was waiting in this pull request: it has to go out another way.
			if (publishing) republish = record.entryId;
			return result("closed");
		}
		const client = await ctx.client(target);
		const head = await client.getBranchHead(target.branch);
		const sha = head ? ((await client.listFiles(head, target.folder)).get(record.path) ?? null) : null;
		const outcome = await applyMergedDraft(ctx, target, client, record, sha);
		return outcome === "conflict"
			? result("conflict")
			: result("published", outcome === "missing" ? "no file" : undefined);
	});
	if (republish !== undefined) {
		await enqueue(ctx, target, republish);
		await flushTarget(ctx, target).catch((error) =>
			console.error(`[git-sync] publish of ${republish} after its draft pull request was closed failed`, error),
		);
	}
	return done;
}
