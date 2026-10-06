import { createEntryBodySchema, LIST_ARRAY_QUERY_KEYS, listEntriesQuerySchema } from "../../../core/api";
import type { ServiceInput } from "../../../services/types";
import { adminRoute, json, parseWith, readJsonBody, readQuery } from "../handler";

/** Per-collection list, search, filter, sort, and paging. */
export const GET = adminRoute(async ({ request, cms }) => {
	const query = parseWith(
		listEntriesQuerySchema,
		readQuery(request, LIST_ARRAY_QUERY_KEYS),
		"Invalid query parameters",
	);
	const range = (from?: Date, to?: Date) => (from || to ? { from, to } : undefined);
	const result = await cms.store().listEntries({
		collection: query.collection,
		search: query.search,
		includeBody: query.includeBody,
		titleContains: query.titleContains?.trim() || undefined,
		slugContains: query.slugContains?.trim() || undefined,
		statuses: query.status,
		locales: query.locale,
		groupTranslations: query.group === "translation",
		folderId: query.folderId,
		includeDescendants: query.includeDescendants,
		relations: query.relation,
		hasUnpublishedChanges: query.hasChanges,
		createdAt: range(query.createdFrom, query.createdTo),
		updatedAt: range(query.updatedFrom, query.updatedTo),
		publishedAt: range(query.publishedFrom, query.publishedTo),
		sort: query.sortField ? { field: query.sortField, direction: query.sortDirection ?? "desc" } : undefined,
		page: query.page,
		pageSize: query.pageSize,
	});
	return json(result);
});

/** Create. For record collections (tags, categories, series) the service applies the public values together with creation. */
export const POST = adminRoute(async ({ request, cms }) => {
	const body = parseWith(createEntryBodySchema, await readJsonBody(request));
	const input = {
		collection: body.collection,
		slug: body.slug ?? null,
		metadata: body.metadata,
		...(body.doc !== undefined ? { doc: body.doc } : { mdx: body.mdx ?? "" }),
		...(body.folderId !== undefined ? { folderId: body.folderId } : {}),
	} as ServiceInput;
	const entry = await cms.contentService().createDraft(input);
	return json(entry, { status: 201 });
});
