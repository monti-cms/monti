import { updateFolderBodySchema } from "../../../../core/api.js";
import { adminRoute, json, readVersionedBody, readVersionQuery } from "../../handler.js";
/** Preview before deleting: the number of entries directly in it and its child folders. */
export const GET = adminRoute(async ({ params, cms }) => json(await cms.store().getFolderContents({ id: params.id })));
/** Rename, reorder, and move a folder. Rejects cycles and duplicate names within the same parent. */
export const PATCH = adminRoute(async ({ request, params, cms }) => {
    const body = await readVersionedBody(request, updateFolderBodySchema);
    return json(await cms.store().updateFolder({ id: params.id, ...body }));
});
/** Deletes a folder. Entries directly in it and child folders move to the parent; entries are not deleted. */
export const DELETE = adminRoute(async ({ request, params, cms }) => {
    await cms.store().deleteFolder({ id: params.id, expectedVersion: readVersionQuery(request) });
    return json({ success: true });
});
