import { getCmsContentService, getCmsContentStore } from "../../../container";
import { createEntryBodySchema, LIST_ARRAY_QUERY_KEYS, listEntriesQuerySchema } from "../../../core/api";
import type { ServiceInput } from "../../../services/types";
import { adminRoute, json, parseWith, readJsonBody, readQuery } from "../handler";

/** 컬렉션별 목록·검색·필터·정렬·페이지(§3.2). */
export const GET = adminRoute(async ({ request }) => {
	const query = parseWith(
		listEntriesQuerySchema,
		readQuery(request, LIST_ARRAY_QUERY_KEYS),
		"Invalid query parameters",
	);
	const range = (from?: Date, to?: Date) => (from || to ? { from, to } : undefined);
	const result = await getCmsContentStore().listEntries({
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

/** 생성. record 컬렉션(태그·카테고리·모음집)은 서비스가 생성과 함께 공개 값에 반영한다(§5.2). */
export const POST = adminRoute(async ({ request }) => {
	const body = parseWith(createEntryBodySchema, await readJsonBody(request));
	const input = {
		collection: body.collection,
		slug: body.slug ?? null,
		metadata: body.metadata,
		mdx: body.mdx,
		...(body.folderId !== undefined ? { folderId: body.folderId } : {}),
	} as ServiceInput;
	const entry = await getCmsContentService().createDraft(input);
	return json(entry, { status: 201 });
});
