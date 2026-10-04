import { getCmsContentService, getCmsContentStore } from "../../../../container.js";
import { patchEntryBodySchema } from "../../../../core/api.js";
import { isItemCollection } from "../../../../core/collections.js";
import { adminRoute, json, readVersionedBody, readVersionQuery } from "../../handler.js";
/**
 * An entry and the translation group needed by the editor.
 * For a translation, also returns the source's latest draft metadata (`source`). The translation properties panel shows the shared values read-only.
 */
export const GET = adminRoute(async ({ params }) => {
    const store = getCmsContentStore();
    const entry = await store.getEntry(params.id);
    const translations = isItemCollection(entry.collection)
        ? null
        : await store.getTranslationGroup({ entryId: entry.id });
    const source = entry.translationGroupId !== entry.id ? await store.getEntry(entry.translationGroupId).catch(() => null) : null;
    return json({
        ...entry,
        translations: translations?.members ?? [],
        ...(source
            ? {
                source: {
                    id: source.id,
                    locale: source.locale,
                    status: source.status,
                    workingSlug: source.workingSlug,
                    metadata: source.working.metadata,
                    // The translation view lines up source blocks with the translation side by side.
                    mdx: source.working.mdx,
                },
            }
            : {}),
    });
});
/** Saves the latest draft. Fields not sent keep their current draft values. */
export const PATCH = adminRoute(async ({ request, params }) => {
    const body = await readVersionedBody(request, patchEntryBodySchema);
    const current = await getCmsContentStore().getEntry(params.id);
    const input = {
        collection: current.collection,
        expectedVersion: body.expectedVersion,
        slug: body.slug !== undefined ? body.slug : current.workingSlug,
        metadata: body.metadata ?? current.working.metadata,
        mdx: body.mdx ?? current.working.mdx,
        ...(body.folderId !== undefined ? { folderId: body.folderId } : {}),
        ...(body.translation !== undefined ? { translation: body.translation } : {}),
    };
    return json(await getCmsContentService().saveDraft(params.id, input));
});
/** Permanently deletes a trashed entry. Moving to trash is `POST /entries/:id/trash`. */
export const DELETE = adminRoute(async ({ request, params }) => {
    const expectedVersion = readVersionQuery(request);
    await getCmsContentStore().permanentDeleteEntry({ id: params.id, expectedVersion });
    return new Response(null, { status: 204 });
});
