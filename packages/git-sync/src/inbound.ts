import type { Entry } from "@monti-cms/core/plugin/server";
import { applyFile, describeError, type FileToApply, readEntry, recordOf } from "./apply";
import { applyMergedDraft } from "./draft-inbound";
import { exportEntry, isSyncable, parseEntryFile, sameContent } from "./entry-file";
import type { ResolvedTarget } from "./options";
import { enqueue, flushTarget, isKnownBlob } from "./outbound";
import type { ConflictReason, ConflictRecord, PullSummary, SyncRecord } from "./state";
import { entryKey } from "./state";
import { GitSyncError, type SyncContext } from "./sync";

// What a file is applied with lives in `apply.ts` (the draft code shares it); these are re-exported for the callers that always had them here.
export { type Applied, applyFile, describeError, type FileToApply, recordOf } from "./apply";

/**
 * Inbound: from the repo to the CMS.
 *
 * A pull compares the files of the target's folder with what was last synced (`SyncRecord`). A file whose blob is the one git-sync wrote (or read) is skipped.
 * A changed or new file is read into an entry through the target's format and written with the same pipeline as an edit in the admin (`cms.contentService()`:
 * hooks, validation, references), then published. If the entry also changed on the server since the last sync, nothing is written: a conflict is recorded
 * and a person picks a side.
 */

const conflictOf = (
	target: ResolvedTarget,
	entry: Pick<Entry, "id" | "collection" | "locale">,
	fields: { kind: ConflictRecord["kind"]; reason: ConflictReason; path: string; sha: string; text: string },
	now: number,
): ConflictRecord => ({
	id: entryKey(target.id, entry.id),
	target: target.id,
	entryId: entry.id,
	collection: entry.collection,
	locale: entry.locale,
	kind: fields.kind,
	reason: fields.reason,
	path: fields.path,
	gitSha: fields.sha,
	gitText: fields.text,
	detectedAt: new Date(now).toISOString(),
});

/**
 * Pulls one target: reads the files of its folder at the head of the branch and applies what changed. A file that cannot be applied is reported in `errors`
 * and does not stop the others. Returns what happened (also kept for the admin screen).
 */
export async function pullTarget(ctx: SyncContext, target: ResolvedTarget): Promise<PullSummary> {
	const summary = await ctx.withLock(target, async () => {
		const client = await ctx.client(target);
		const { pattern } = await ctx.format(target);
		const head = await client.getBranchHead(target.branch);
		if (!head) throw new GitSyncError(`The branch "${target.branch}" does not exist in ${target.repo}`);
		const files = await client.listFiles(head, target.folder);
		const records = await ctx.state.records.list(target.id);
		const drafts = target.drafts ? await ctx.state.drafts.list(target.id) : new Map();
		const byPath = new Map([...records.values()].map((record) => [record.path, record]));
		const open = new Map(
			(await ctx.state.conflicts.list(target.id))
				.filter((conflict) => conflict.scope !== "draft")
				.map((conflict) => [conflict.entryId, conflict]),
		);
		const created = new Map<string, string>();
		const skipped: { path: string; reason: string }[] = [];
		const errors: { path: string; message: string }[] = [];
		let applied = 0;
		let createdCount = 0;
		let unchanged = 0;
		let conflicts = 0;

		// The default language first: a translation may point to a source created from a file of the same pull.
		const candidates = [...files]
			.filter(([path]) => pattern.parse(path) !== null)
			.sort(([a], [b]) => {
				const rank = (path: string) =>
					(pattern.parse(path)?.locale ?? ctx.cms.site.DEFAULT_LOCALE) === ctx.cms.site.DEFAULT_LOCALE ? 0 : 1;
				return rank(a) - rank(b) || (a < b ? -1 : 1);
			});

		for (const [path, sha] of candidates) {
			try {
				const known = byPath.get(path);
				if (known && isKnownBlob(known, sha)) {
					if (sha === known.blobSha && known.baseSha !== sha) await ctx.state.records.put({ ...known, baseSha: sha });
					if (open.has(known.entryId)) {
						// The file is back to what was last synced (the edit in git was undone): there is nothing to decide any more, and what the server
						// changed in the meantime goes out with the next flush.
						await ctx.state.conflicts.remove(target.id, known.entryId);
						await enqueue(ctx, target, known.entryId);
					}
					unchanged += 1;
					continue;
				}
				const text = await client.getBlob(sha);
				const parsed = parseEntryFile(text);
				if (!parsed.ok) {
					errors.push({ path, message: parsed.message });
					continue;
				}
				const { file } = parsed;
				const where = pattern.parse(path) ?? {};
				const collection =
					file.collection ?? where.collection ?? (target.collections.length === 1 ? target.collections[0] : undefined);
				if (!collection || !target.collections.includes(collection)) {
					skipped.push({
						path,
						reason: `not a file of this target's collections${collection ? ` ("${collection}")` : ""}`,
					});
					continue;
				}
				const locale = file.locale ?? where.locale ?? ctx.cms.site.DEFAULT_LOCALE;
				if (!ctx.cms.site.isLocale(locale)) {
					errors.push({ path, message: `the language "${locale}" is not one of the site's languages` });
					continue;
				}
				const slug = file.slug ?? where.slug;
				if (!slug) {
					errors.push({
						path,
						message: "the file has no slug: add `slug` to its front matter, or use {slug} in the target's path",
					});
					continue;
				}

				// Which entry is this file? The one synced from this path, else the one the file names, else the published entry at its address.
				let entry: Entry | null = null;
				let record = known;
				if (record) entry = await readEntry(ctx, record.entryId);
				if (!entry && file.id) {
					const found = await readEntry(ctx, created.get(file.id) ?? file.id);
					if (found && found.collection === collection && found.locale === locale) entry = found;
				}
				if (!entry && !record) {
					const lookup = await ctx.cms
						.store()
						.getPublishedEntryBySlug({ collection, slug, locale, includeBody: false });
					if (lookup.status === "current") entry = await readEntry(ctx, lookup.entry.id);
				}
				if (entry) {
					const own = records.get(entry.id);
					if (own && own.path !== path) {
						if (files.has(own.path)) {
							skipped.push({ path, reason: `the same entry already has the file ${own.path}` });
							continue;
						}
						// The file moved (git mv): it is the entry's file now.
						record = own;
					}
					record ??= own;
				}

				// The file is what an entry's draft branch has: its draft pull request was merged on GitHub, which publishes the entry.
				const draft = entry ? drafts.get(entry.id) : undefined;
				if (draft && draft.path === path && draft.blobSha === sha) {
					const merged = await applyMergedDraft(ctx, target, client, draft, sha);
					if (merged === "applied") applied += 1;
					else if (merged === "conflict") conflicts += 1;
					else unchanged += 1;
					continue;
				}

				const found = { path, sha, file, collection, locale, slug };
				const subject =
					entry ?? (record ? { id: record.entryId, collection: record.collection, locale: record.locale } : null);
				if (subject) {
					const existing = open.get(subject.id);
					if (existing) {
						if (existing.gitSha !== sha) {
							await ctx.state.conflicts.put({
								...existing,
								path,
								gitSha: sha,
								gitText: text,
								detectedAt: new Date(ctx.now()).toISOString(),
							});
						}
						conflicts += 1;
						continue;
					}
				}
				if (!entry && record) {
					// The entry is gone from the server (deleted) while its file was edited in git.
					await ctx.state.conflicts.put(
						conflictOf(
							target,
							subject ?? { id: record.entryId, collection, locale },
							{ kind: "removed", reason: "git-edit-blocks-removal", path, sha, text },
							ctx.now(),
						),
					);
					conflicts += 1;
					continue;
				}
				if (entry) {
					const reason = await serverSide(ctx, target, pattern, entry, record, text);
					if (reason === "in-sync") {
						await ctx.state.records.put(syncedRecord(target, entry, found, ctx.now()));
						unchanged += 1;
						continue;
					}
					if (reason !== "unchanged") {
						const conflict = conflictOf(
							target,
							entry,
							{ kind: isSyncable(entry, target) ? "changed" : "removed", reason, path, sha, text },
							ctx.now(),
						);
						await ctx.state.conflicts.put(conflict);
						conflicts += 1;
						continue;
					}
				}

				const result = await applyFile(ctx, target, {
					...found,
					entry,
					resolveSource: (id) => created.get(id),
				});
				await ctx.state.records.put(recordOf(target, found, result, ctx.now()));
				if (file.id) created.set(file.id, result.entry.id);
				if (result.created) createdCount += 1;
				else applied += 1;
			} catch (error) {
				errors.push({ path, message: describeError(error) });
			}
		}

		for (const record of records.values()) {
			if (files.has(record.path)) continue;
			if (record.blobSha === null) {
				// The pull request that removes it has merged.
				await ctx.state.records.remove(target.id, record.entryId);
			} else {
				skipped.push({
					path: record.path,
					reason:
						"removed in git; the entry stays published (unpublish it in the CMS to remove it for good), and its next publish writes the file again",
				});
			}
		}

		const done: PullSummary = {
			at: new Date(ctx.now()).toISOString(),
			head: head.commitSha,
			applied,
			created: createdCount,
			unchanged,
			conflicts,
			skipped,
			errors,
		};
		await ctx.state.status.patch(target.id, { lastPull: done });
		return done;
	});
	// Publishes that came in while the files were being written wait in the queue: commit them now that the lock is free.
	if ((await ctx.state.queue.list(target.id)).length > 0) {
		await flushTarget(ctx, target).catch((error) =>
			console.error(`[git-sync] flush of ${target.id} after a pull failed`, error),
		);
	}
	return summary;
}

/** The record of an entry whose file already says what the entry says. */
const syncedRecord = (
	target: ResolvedTarget,
	entry: Entry,
	file: Pick<FileToApply, "path" | "sha">,
	now: number,
): SyncRecord => ({
	target: target.id,
	entryId: entry.id,
	collection: entry.collection,
	locale: entry.locale,
	slug: entry.publishedSlug ?? "",
	path: file.path,
	blobSha: file.sha,
	baseSha: file.sha,
	contentHash: entry.published?.contentHash ?? null,
	syncedAt: new Date(now).toISOString(),
});

/**
 * Where the server stands against a changed file: `unchanged` (the git version can be applied), `in-sync` (the file says what the entry already says), or the
 * reason a person has to decide.
 */
async function serverSide(
	ctx: SyncContext,
	target: ResolvedTarget,
	pattern: Awaited<ReturnType<SyncContext["format"]>>["pattern"],
	entry: Entry,
	record: SyncRecord | undefined,
	gitText: string,
): Promise<"unchanged" | "in-sync" | ConflictReason> {
	if (!record) {
		// Never synced: it is only safe when the file says the same thing.
		if (isSyncable(entry, target)) {
			const exported = await exportEntry(ctx.cms, target, pattern, entry);
			if (sameContent(exported.text, gitText)) return "in-sync";
		}
		return "unsynced";
	}
	if (!isSyncable(entry, target)) return "git-edit-blocks-removal";
	if (record.contentHash !== entry.published.contentHash || record.slug !== entry.publishedSlug) return "both-changed";
	// A draft with changes the file does not have would be replaced by the import.
	if (entry.working.contentHash !== entry.published.contentHash) return "unpublished-changes";
	return "unchanged";
}
