import { CmsError, ServiceError } from "@monti-cms/core/plugin/server";
import { RelationImportError, resolveRelations } from "./entry-file.js";
import { GitSyncError } from "./sync.js";
/** Writing what a file says into the CMS: the pieces the import (`inbound.ts`) and the conflict resolution (`conflicts.ts`) share. */
/** A readable description of why a write failed: the error code and what the pipeline found, not a stack trace. */
export function describeError(error) {
    if (error instanceof ServiceError) {
        const issues = (error.issues ?? []);
        const found = issues
            .map((issue) => [issue.path, issue.code, issue.message].filter(Boolean).join(" "))
            .filter(Boolean);
        return found.length > 0 ? `${error.code}: ${found.slice(0, 5).join("; ")}` : error.code;
    }
    if (error instanceof RelationImportError)
        return `relations: ${error.message}`;
    return error instanceof Error ? error.message || error.name : String(error);
}
/** The entry as it is now, or `null` when it does not exist. */
export async function readEntry(ctx, entryId) {
    try {
        return await ctx.cms.store().getEntry(entryId);
    }
    catch (error) {
        if (error instanceof CmsError && error.code === "not_found")
            return null;
        throw error;
    }
}
/**
 * Writes a file to the CMS and publishes it: an existing entry takes the file's fields and body as its draft and publishes it; with no entry, one is created
 * (a translation from its source). Blocked states are cleared first (a trashed entry is restored, an archived one unarchived). Every step is the content
 * service's, so hooks, validation and the references of the body run as for any edit. The files being written are marked, so the publishes this causes are
 * not pushed back.
 */
export async function applyFile(ctx, target, input) {
    const { cms } = ctx;
    const service = cms.contentService();
    // Relations are written as slugs in a file; the pipeline takes ids.
    const metadata = await resolveRelations(cms, input.file, { collection: input.collection, locale: input.locale });
    const body = {
        collection: input.collection,
        slug: input.slug,
        metadata,
        body: input.file.body,
        format: target.format,
    };
    await ctx.state.applying.mark(target.id, input.path, ctx.now());
    ctx.importing.add(target.id);
    try {
        let current = input.entry;
        let created = false;
        if (current) {
            if (current.status === "trashed")
                current = (await service.restore({ id: current.id, expectedVersion: current.version })).entry;
            else if (current.status === "archived") {
                current = await cms.store().unarchiveEntry({ id: current.id, expectedVersion: current.version });
            }
        }
        else if (input.locale === cms.site.DEFAULT_LOCALE || cms.site.isItemCollection(input.collection)) {
            const entry = (await service.createDraft(body, { publishImmediately: true })).entry;
            return { entry: entry, created: true };
        }
        else {
            const sourceId = input.file.translationOf
                ? (input.resolveSource?.(input.file.translationOf) ?? input.file.translationOf)
                : undefined;
            if (!sourceId) {
                throw new GitSyncError(`${input.path} is a "${input.locale}" file with no entry yet; add \`monti.translationOf\` (the id of the source entry) to its front matter`);
            }
            current = (await service.createTranslation({ sourceId, locale: input.locale })).entry;
            created = true;
        }
        const saved = (await service.saveDraft(current.id, { ...body, expectedVersion: current.version }, {
            publishImmediately: false,
        })).entry;
        const { entry } = await service.publish({ id: current.id, expectedVersion: saved.version });
        return { entry: entry, created };
    }
    finally {
        ctx.importing.delete(target.id);
        await ctx.state.applying.clear(target.id, input.path).catch(() => undefined);
    }
}
/** The record of an entry synced from a file. */
export const recordOf = (target, file, applied, now) => ({
    target: target.id,
    entryId: applied.entry.id,
    collection: applied.entry.collection,
    locale: applied.entry.locale,
    slug: applied.entry.publishedSlug ?? "",
    path: file.path,
    blobSha: file.sha,
    baseSha: file.sha,
    contentHash: applied.entry.published.contentHash,
    syncedAt: new Date(now).toISOString(),
});
