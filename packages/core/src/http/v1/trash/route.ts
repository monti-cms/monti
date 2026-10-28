import { trashListQuerySchema } from "../../../core/api";
import { adminRoute, ok, parseWith, readQuery } from "../handler";

/**
 * The trash: the units at the top (an entry with the translations discarded with it, a folder, a media file), the inside of a trashed folder (`folder`), or everything
 * that matches a search (`q`, inside folders too), by the day each was discarded. Looking at it purges the expired units, at most once a day.
 */
export const GET = adminRoute(async ({ request, cms }) => {
	const query = parseWith(trashListQuerySchema, readQuery(request), "Invalid query parameters");
	return ok(
		await cms.trashService().list({
			kind: query.kind,
			folderId: query.folder,
			search: query.q,
			direction: query.sort,
			page: query.page,
			pageSize: query.pageSize,
		}),
	);
});
