import { CmsError } from "@monti-cms/core/plugin/server";
import { applyFile, describeError, recordOf } from "./apply.js";
import { exportEntry, isSyncable, parseEntryFile } from "./entry-file.js";
import { pushEntries } from "./outbound.js";
import { GitSyncError } from "./sync.js";
async function readEntry(ctx, entryId) {
    try {
        return await ctx.cms.store().getEntry(entryId);
    }
    catch (error) {
        if (error instanceof CmsError && error.code === "not_found")
            return null;
        throw error;
    }
}
const labelOf = (ctx, entry, fallback) => {
    const metadata = (entry?.published?.metadata ?? entry?.working.metadata ?? {});
    const title = entry && ctx.cms.site.isCollection(entry.collection)
        ? ctx.cms.site.titleOfValues(entry.collection, metadata)
        : null;
    return title ? title : (entry?.publishedSlug ?? entry?.workingSlug ?? fallback);
};
/** The open conflicts, each with the server's text as it is now. */
export async function listConflicts(ctx) {
    const views = [];
    for (const conflict of await ctx.state.conflicts.list()) {
        const target = ctx.targets.find((item) => item.id === conflict.target);
        if (!target)
            continue;
        const entry = await readEntry(ctx, conflict.entryId);
        let serverText = null;
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
            label: labelOf(ctx, entry, conflict.entryId),
            serverText,
            gitText: conflict.gitText,
            gitSha: conflict.gitSha,
        });
    }
    return views.sort((a, b) => (a.detectedAt < b.detectedAt ? -1 : a.detectedAt > b.detectedAt ? 1 : 0));
}
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
export async function resolveConflict(ctx, params) {
    const target = ctx.target(params.target);
    const conflict = await ctx.state.conflicts.get(params.target, params.entryId);
    if (!conflict)
        throw new CmsError("There is no such conflict", "not_found");
    if (params.gitSha !== undefined && params.gitSha !== conflict.gitSha) {
        throw new CmsError("The file changed in git since you looked at it; reload the conflict", "conflict");
    }
    if (params.resolution === "server") {
        const pushed = await pushEntries(ctx, target, [params.entryId]);
        await ctx.state.conflicts.remove(params.target, params.entryId);
        return { resolution: "server", ...(pushed.pullRequestUrl ? { pullRequestUrl: pushed.pullRequestUrl } : {}) };
    }
    const parsed = parseEntryFile(conflict.gitText);
    if (!parsed.ok)
        throw new GitSyncError(`The git version cannot be read: ${parsed.message}`);
    const { file } = parsed;
    const slug = file.slug ?? (await ctx.format(target)).pattern.parse(conflict.path)?.slug;
    if (!slug)
        throw new GitSyncError("The git version has no slug: add `slug` to its front matter");
    await ctx.withLock(target, async () => {
        const entry = await readEntry(ctx, params.entryId);
        let applied;
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
        }
        catch (error) {
            throw new GitSyncError(`The git version could not be written to the entry: ${describeError(error)}`);
        }
        await ctx.state.records.put(recordOf(target, { path: conflict.path, sha: conflict.gitSha }, applied, ctx.now()));
        await ctx.state.conflicts.remove(params.target, params.entryId);
    });
    return { resolution: "git" };
}
