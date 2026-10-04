import { getCmsContentStore } from "../../../../container";
import { updateFolderBodySchema } from "../../../../core/api";
import { adminRoute, json, readVersionedBody, readVersionQuery } from "../../handler";

type IdParams = { id: string };

/** Preview before deleting: the number of entries directly in it and its child folders. */
export const GET = adminRoute<IdParams>(async ({ params }) =>
	json(await getCmsContentStore().getFolderContents({ id: params.id })),
);

/** Rename, reorder, and move a folder. Rejects cycles and duplicate names within the same parent. */
export const PATCH = adminRoute<IdParams>(async ({ request, params }) => {
	const body = await readVersionedBody(request, updateFolderBodySchema);
	return json(await getCmsContentStore().updateFolder({ id: params.id, ...body }));
});

/** Deletes a folder. Entries directly in it and child folders move to the parent; entries are not deleted. */
export const DELETE = adminRoute<IdParams>(async ({ request, params }) => {
	await getCmsContentStore().deleteFolder({ id: params.id, expectedVersion: readVersionQuery(request) });
	return json({ success: true });
});
