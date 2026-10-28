import { updateFolderBodySchema } from "../../../../core/api";
import { adminRoute, ok, readVersionedBody, readVersionQuery } from "../../handler";

type IdParams = { id: string };

/** Rename, reorder, and move a folder. Rejects cycles and duplicate names within the same parent. */
export const PATCH = adminRoute<IdParams>(async ({ request, params, cms }) => {
	const body = await readVersionedBody(request, updateFolderBodySchema);
	return ok(await cms.store().updateFolder({ id: params.id, ...body }));
});

/**
 * Moves a folder to the trash with everything in it, as one unit (`FolderTrashResult`). An entry folder always goes whole. A media folder goes whole unless a
 * file in it is in use: then only the unused files go and `folder` is null. Putting it back is `POST /v1/trash/restore`.
 */
export const DELETE = adminRoute<IdParams>(async ({ request, params, cms }) =>
	ok(await cms.trashService().trashFolder({ id: params.id, expectedVersion: readVersionQuery(request) })),
);
