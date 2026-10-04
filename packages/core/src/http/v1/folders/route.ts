import { getCmsContentStore } from "../../../container";
import { collectionSchema, createFolderBodySchema } from "../../../core/api";
import { adminRoute, json, parseWith, readJsonBody } from "../handler";

/** 컬렉션별 폴더 트리(§3.3). */
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
