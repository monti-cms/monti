import { adminRoute, ok, parseWith, readQuery } from "../../handler";

/**
 * How many rows of a list each value of one field (`field=<name>`) or of the translation filter (`facet=translation`) has, for the filter menu.
 * It counts the rows of the folder (`folderId`, `includeDescendants`) and the statuses (`status`) given, before any other filter, and with
 * `group=translation` one row per translation group, as the list is read. Answers `{ total, empty?, filled?, values }`.
 */
export const GET = adminRoute(async ({ request, cms }) => {
	const query = parseWith(
		cms.site.api.listCountsQuerySchema,
		readQuery(request, ["status"]),
		"Invalid query parameters",
	);
	return ok(
		await cms.store().countListValues({
			collection: query.collection,
			facet: query.field !== undefined ? { field: query.field } : "translation",
			groupTranslations: query.group === "translation",
			...(query.folderId === undefined ? {} : { folderId: query.folderId }),
			...(query.includeDescendants === undefined ? {} : { includeDescendants: query.includeDescendants }),
			...(query.status === undefined ? {} : { statuses: query.status }),
		}),
	);
});
