import { adminRoute, ok, parseWith, readJsonBody } from "../handler";

/** Folder tree per collection. The store rejects a collection that does not use folders (`assertFoldersEnabled`). The operation `folders.list`. */
export const GET = adminRoute(async ({ request, cms, auth }) =>
	ok(
		await cms.runOperation(
			"folders.list",
			{ collection: new URL(request.url).searchParams.get("collection") },
			{ auth, invalidMessage: "collection is required" },
		),
	),
);

export const POST = adminRoute(async ({ request, cms }) => {
	const body = parseWith(cms.site.api.createFolderBodySchema, await readJsonBody(request));
	return ok(await cms.store().createFolder(body), { status: 201 });
});
