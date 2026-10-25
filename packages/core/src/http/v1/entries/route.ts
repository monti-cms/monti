import { LIST_ARRAY_QUERY_KEYS } from "../../../core/api";
import { emptyStoredDocument } from "../../../doc/stored-document";
import { bodyInputOf } from "../../../services/body-input";
import type { ServiceInput } from "../../../services/types";
import { adminRoute, ok, parseWith, readJsonBody, readQuery, written } from "../handler";

/** Per-collection list, search, filter, sort, and paging (the operation `entries.list`). */
export const GET = adminRoute(async ({ request, cms, auth }) =>
	ok(
		await cms.runOperation("entries.list", readQuery(request, LIST_ARRAY_QUERY_KEYS), {
			auth,
			invalidMessage: "Invalid query parameters",
		}),
	),
);

/** Create. The body is `doc`, or `body` with its `format`. For record collections (tags, categories, series) the service applies the public values together with creation. */
export const POST = adminRoute(async ({ request, cms }) => {
	const body = parseWith(cms.site.api.createEntryBodySchema, await readJsonBody(request));
	const input = {
		collection: body.collection,
		slug: body.slug ?? null,
		metadata: body.metadata,
		// The body: a document, a text with its format, or none (an empty body).
		...bodyInputOf(body, emptyStoredDocument()),
		...(body.folderId !== undefined ? { folderId: body.folderId } : {}),
	} as ServiceInput;
	return written(cms, await cms.contentService().createDraft(input), { status: 201 });
});
