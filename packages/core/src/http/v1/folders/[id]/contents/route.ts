import { adminRoute, ok } from "../../../handler";

/** What a folder holds before it is discarded, its subfolders included: entries (with the published ones), folders, media files (with those in use). The operation `folders.get`. */
export const GET = adminRoute<{ id: string }>(async ({ params, cms, auth }) =>
	ok(await cms.runOperation("folders.get", { id: params.id }, { auth })),
);
