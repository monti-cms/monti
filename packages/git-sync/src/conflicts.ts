import { CmsError, type Entry } from "@monti-cms/core/plugin/server";
import { exportEntry, isSyncable, parseEntryFile } from "./entry-file";
import { applyFile, describeError, recordOf } from "./inbound";
import { pushEntries } from "./outbound";
import type { ConflictRecord } from "./state";
import { GitSyncError, type SyncContext } from "./sync";

/**
 * Conflicts: an entry that changed on both sides (or was removed on one and edited on the other) since the last sync waits here until a person picks a side.
 * Nothing is merged. The admin shows the two texts, both written by the target's format: the server's from the entry as it is now, the git one as it was when
 * the conflict was found.
 */

/** A conflict with the two texts to compare. */
export interface ConflictView {
	readonly id: string;
	readonly target: string;
	readonly repo: string;
	readonly entryId: string;
	readonly collection: string;
	readonly locale: string;
	readonly path: string;
	readonly kind: ConflictRecord["kind"];
	readonly reason: ConflictRecord["reason"];
	readonly detectedAt: string;
	/** The title (or slug) of the entry, for the list. */
	readonly label: string;
	/** What the server has now, in the target's format (front matter included). `null` when the entry is not published (the server's version is "removed"). */
	readonly serverText: string | null;
	/** What git has (as of the conflict). */
	readonly gitText: string;
	/** The blob sha of `gitText`. Sent back with the decision, so a file that changed again since is not decided blind. */
	readonly gitSha: string;
}

async function readEntry(ctx: SyncContext, entryId: string): Promise<Entry | null> {
	try {
		return await ctx.cms.store().getEntry(entryId);
	} catch (error) {
		if (error instanceof CmsError && error.code === "not_found") return null;
		throw error;
	}
}

const labelOf = (entry: Entry | null, fallback: string): string => {
	const metadata = (entry?.published?.metadata ?? entry?.working.metadata ?? {}) as Record<string, unknown>;
	return typeof metadata.title === "string" && metadata.title
		? metadata.title
		: (entry?.publishedSlug ?? entry?.workingSlug ?? fallback);
};

/** The open conflicts, each with the server's text as it is now. */
export async function listConflicts(ctx: SyncContext): Promise<ConflictView[]> {
	const views: ConflictView[] = [];
	for (const conflict of await ctx.state.conflicts.list()) {
		const target = ctx.targets.find((item) => item.id === conflict.target);
		if (!target) continue;
		const entry = await readEntry(ctx, conflict.entryId);
		let serverText: string | null = null;
		if (isSyncable(entry, target)) {
			const { pattern } = await ctx.format(target);
			serverText = (await exportEntry(ctx.cms, target, pattern, entry)).text;
		}
		views.push({
			id: conflict.id,
			target: conflict.target,
			repo: target.repo,
			entryId: conflict.entryId,
			collection: conflict.collection,
			locale: conflict.locale,
			path: conflict.path,
			kind: conflict.kind,
			reason: conflict.reason,
			detectedAt: conflict.detectedAt,
			label: labelOf(entry, conflict.entryId),
			serverText,
			gitText: conflict.gitText,
			gitSha: conflict.gitSha,
		});
	}
	return views.sort((a, b) => (a.detectedAt < b.detectedAt ? -1 : a.detectedAt > b.detectedAt ? 1 : 0));
}

export type Resolution = "git" | "server";

/**
 * Settles a conflict.
 *
 * - `"git"` ("Use git version"): the git text is written to the entry with the same pipeline as an edit and published, replacing what the server has (a draft with
 *   unpublished changes included). A trashed or archived entry comes back; a deleted one is created again.
 * - `"server"` ("Use server version"): the entry as the server has it is pushed to the repo, replacing the file in git (or deleting it, when the entry is not published
 *   any more), in a commit or a pull request as the target's mode says.
 *
 * `gitSha` is the blob the person looked at: if the file changed again since, the decision is refused, so a newer edit is never decided blind.
 */
export async function resolveConflict(
	ctx: SyncContext,
	params: {
		readonly target: string;
		readonly entryId: string;
		readonly resolution: Resolution;
		readonly gitSha?: string;
	},
): Promise<{ readonly resolution: Resolution; readonly pullRequestUrl?: string }> {
	const target = ctx.target(params.target);
	const conflict = await ctx.state.conflicts.get(params.target, params.entryId);
	if (!conflict) throw new CmsError("There is no such conflict", "not_found");
	if (params.gitSha !== undefined && params.gitSha !== conflict.gitSha) {
		throw new CmsError("The file changed in git since you looked at it; reload the conflict", "conflict");
	}

	if (params.resolution === "server") {
		const pushed = await pushEntries(ctx, target, [params.entryId]);
		await ctx.state.conflicts.remove(params.target, params.entryId);
		return { resolution: "server", ...(pushed.pullRequestUrl ? { pullRequestUrl: pushed.pullRequestUrl } : {}) };
	}

	const parsed = parseEntryFile(conflict.gitText);
	if (!parsed.ok) throw new GitSyncError(`The git version cannot be read: ${parsed.message}`);
	const { file } = parsed;
	const slug = file.slug ?? (await ctx.format(target)).pattern.parse(conflict.path)?.slug;
	if (!slug) throw new GitSyncError("The git version has no slug: add `slug` to its front matter");
	await ctx.withLock(target, async () => {
		const entry = await readEntry(ctx, params.entryId);
		let applied: Awaited<ReturnType<typeof applyFile>>;
		try {
			applied = await applyFile(ctx, target, {
				path: conflict.path,
				sha: conflict.gitSha,
				file,
				collection: conflict.collection,
				locale: conflict.locale,
				slug,
				entry,
			});
		} catch (error) {
			throw new GitSyncError(`The git version could not be written to the entry: ${describeError(error)}`);
		}
		await ctx.state.records.put(recordOf(target, { path: conflict.path, sha: conflict.gitSha }, applied, ctx.now()));
		await ctx.state.conflicts.remove(params.target, params.entryId);
	});
	return { resolution: "git" };
}
