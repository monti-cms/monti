import { adminRoute, CmsError, ok, parseWith, readJsonBody } from "../handler";

/** Folder tree per collection. */
export const GET = adminRoute(async ({ request, cms }) => {
	const collection = parseWith(
		cms.site.api.folderCollectionSchema,
		new URL(request.url).searchParams.get("collection"),
		"collection is required",
	);
	if (!cms.site.foldersEnabled(collection)) {
		throw new CmsError("Folders are not enabled for this collection", "invalid_input");
	}
	return ok(await cms.store().listFolders({ collection }));
});

export const POST = adminRoute(async ({ request, cms }) => {
	const body = parseWith(cms.site.api.createFolderBodySchema, await readJsonBody(request));
	if (!cms.site.foldersEnabled(body.collection)) {
		throw new CmsError("Folders are not enabled for this collection", "invalid_input");
	}
	return ok(await cms.store().createFolder(body), { status: 201 });
});
