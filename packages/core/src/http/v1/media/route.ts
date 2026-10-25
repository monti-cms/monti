import { adminRoute, ok, readQuery } from "../handler";

/** Media library: filename search, filters by type, upload date, and usage, newest upload first. The operation `media.list`. */
export const GET = adminRoute(async ({ request, cms, auth }) =>
	ok(await cms.runOperation("media.list", readQuery(request), { auth, invalidMessage: "Invalid query parameters" })),
);
