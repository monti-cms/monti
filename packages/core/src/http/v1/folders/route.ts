import { adminRoute, ok, parseWith, readJsonBody } from "../handler";

/** Folder tree per collection. */
export const GET = adminRoute(async ({ request, cms }) => {
	const collection = parseWith(
		cms.site.api.folderCollectionSchema,
		new URL(request.url).searchParams.get("collection"),
		"collection is required",
	);
	return ok(await cms.store().listFolders({ collection }));
});

export const POST = adminRoute(async ({ request, cms }) => {
	const body = parseWith(cms.site.api.createFolderBodySchema, await readJsonBody(request));
	return ok(await cms.store().createFolder(body), { status: 201 });
});
