import { collectionSchema, createFolderBodySchema } from "../../../core/api";
import { adminRoute, json, parseWith, readJsonBody } from "../handler";

/** Folder tree per collection. */
export const GET = adminRoute(async ({ request, cms }) => {
	const collection = parseWith(
		collectionSchema,
		new URL(request.url).searchParams.get("collection"),
		"collection is required",
	);
	return json(await cms.store().listFolders({ collection }));
});

export const POST = adminRoute(async ({ request, cms }) => {
	const body = parseWith(createFolderBodySchema, await readJsonBody(request));
	return json(await cms.store().createFolder(body), { status: 201 });
});
