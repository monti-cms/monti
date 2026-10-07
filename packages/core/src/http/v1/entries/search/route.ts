import { SEARCH_ARRAY_QUERY_KEYS } from "../../../../core/api";
import { adminRoute, json, parseWith, readQuery } from "../../handler";

/**
 * Finds entries of one collection by title, for a picker (a relation field): `collection`, `query` (title, then slug), `locale`, `publishedOnly`
 * and `limit` (default 20, at most 50). The best matches come first. Answers `{ items: [{ id, title, slug, status }] }` and nothing else, so a picker
 * loads only the entries it shows. With `id` (repeat it) the entries are looked up by id instead, so a picker can show the titles of its values.
 */
export const GET = adminRoute(async ({ request, cms }) => {
	const query = parseWith(
		cms.site.api.searchEntriesQuerySchema,
		readQuery(request, SEARCH_ARRAY_QUERY_KEYS),
		"Invalid query parameters",
	);
	const items = await cms.store().searchEntries({
		collection: query.collection,
		...(query.query === undefined ? {} : { query: query.query }),
		...(query.locale === undefined ? {} : { locale: query.locale }),
		...(query.publishedOnly === undefined ? {} : { publishedOnly: query.publishedOnly }),
		...(query.limit === undefined ? {} : { limit: query.limit }),
		...(query.id === undefined ? {} : { ids: query.id }),
	});
	return json({ items });
});
