import { getCmsContentStore } from "../../../container";
import { collectionSchema, createFolderBodySchema } from "../../../core/api";
import { adminRoute, json, parseWith, readJsonBody } from "../handler";

/** Folder tree per collection. */
export const GET = adminRoute(async ({ request }) => {
	const collection = parseWith(
		collectionSchema,
		request.nextUrl.searchParams.get("collection"),
		"collection is required",
	);
	return json(await getCmsContentStore().listFolders({ collection }));
});

export const POST = adminRoute(async ({ request }) => {
	const body = parseWith(createFolderBodySchema, await readJsonBody(request));
	return json(await getCmsContentStore().createFolder(body), { status: 201 });
});
