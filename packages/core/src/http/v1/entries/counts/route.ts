import { adminRoute, ok, parseWith, readQuery } from "../../handler";

/**
 * How many rows of a list each value of one field (`field=<name>`), of the translation filter (`facet=translation`) or of the status (`facet=status`)
 * has, for a column's menu. It counts the rows of the folder (`folderId`, `includeDescendants`), before any filter, and with
 * `group=translation` one row per translation group, as the list is read. Answers `{ total, empty?, filled?, values }`.
 */
export const GET = adminRoute(async ({ request, cms }) => {
	const query = parseWith(cms.site.api.listCountsQuerySchema, readQuery(request), "Invalid query parameters");
	return ok(
		await cms.store().countListValues({
			collection: query.collection,
			facet: query.field !== undefined ? { field: query.field } : (query.facet ?? "translation"),
			groupTranslations: query.group === "translation",
			...(query.folderId === undefined ? {} : { folderId: query.folderId }),
			...(query.includeDescendants === undefined ? {} : { includeDescendants: query.includeDescendants }),
		}),
	);
});
