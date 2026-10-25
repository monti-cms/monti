import { SEARCH_ARRAY_QUERY_KEYS } from "../../../../core/api";
import { adminRoute, ok, readQuery } from "../../handler";

/**
 * Finds entries of one collection by title, for a picker (a relation field): `collection`, `query` (title, then slug), `locale`, `publishedOnly`
 * and `limit` (default 20, at most 50). The best matches come first. Answers `{ items: [{ id, title, slug, status }] }` and nothing else, so a picker
 * loads only the entries it shows. With `id` (repeat it) the entries are looked up by id instead, so a picker can show the titles of its values.
 * The operation `entries.find`.
 */
export const GET = adminRoute(async ({ request, cms, auth }) =>
	ok(
		await cms.runOperation("entries.find", readQuery(request, SEARCH_ARRAY_QUERY_KEYS), {
			auth,
			invalidMessage: "Invalid query parameters",
		}),
	),
);
