import { contentCollection, defaultLocale, otherContentCollection, recordRelationField } from "../../../test/any-site";
import type { ExportSnapshot } from "../../adapters/postgres/content-store";
import { isItemCollection } from "../../core/collections";
import { roleField, storedFields } from "../../schema/derive";

/**
 * 픽스처가 쓰는 컬렉션·언어·필드 이름은 지금 설정에서 찾는다(M10-1). 블로그 예시 설정에서는 공개 글이 게시글(`post`),
 * 초안이 메모(`memo`)다. 본문이 있는 문서 컬렉션이 하나뿐인 설정은 둘 다 그 컬렉션이다.
 */
export const FIXTURE_CONTENT_COLLECTION = contentCollection;
export const FIXTURE_DRAFT_COLLECTION = otherContentCollection ?? contentCollection;
export const FIXTURE_LOCALE = defaultLocale;

/** 공개 글 작업본이 가리키는 분류 관계(항목 컬렉션을 가리키는 여러 개짜리 관계 먼저). 참조 `kind`는 대상 컬렉션이다. */
const fixtureRelation = (() => {
	for (const { name, field } of storedFields(contentCollection)) {
		if (field.kind === "relation" && field.many && isItemCollection(field.to)) return { name, to: field.to };
	}
	const found = recordRelationField(contentCollection);
	return found ? { name: found.name, to: found.to as string } : { name: "relationIds", to: "relation" };
})();
export const FIXTURE_RELATION_KIND = fixtureRelation.to;

/**
 * 공개본에 담는 SEO 값(역할로 찾은 필드 이름 → 값). 설정에 없는 역할은 뺀다.
 * M7-FE-2 SEO 메타가 공개 아카이브에 살아남는지 확인한다.
 */
export const FIXTURE_SEO_METADATA: Readonly<Record<string, string>> = Object.fromEntries(
	(
		[
			["seoTitle", "검색 제목"],
			["seoDescription", "검색 설명"],
			["canonical", "https://dev.to/crosspost"],
			["ogImage", "44444444-4444-4444-8444-444444444444"],
		] as const
	).flatMap(([role, value]) => {
		const name = roleField(contentCollection, role)?.name;
		return name ? [[name, value]] : [];
	}),
);

/** 아카이브 안 항목 파일 경로. */
export const fixtureEntryPath = (collection: string, id: string, file: string) => `entries/${collection}/${id}/${file}`;

export const FIXTURE_TIME = new Date("2026-09-22T00:00:00.000Z");

export const fixtureBody = (
	mdx: string,
	title: string,
	contentHash: string,
	extraMetadata: Record<string, unknown> = {},
) => ({
	metadata: { title, ...extraMetadata },
	mdx,
	schemaVersion: 1,
	contentHash,
	updatedAt: FIXTURE_TIME,
});

/** 내보내기 테스트 공용 스냅샷: 공개 글 1건 + 초안 1건. */
export const makeExportFixtureSnapshot = (): ExportSnapshot => ({
	entries: [
		{
			id: "11111111-1111-4111-8111-111111111111",
			collection: FIXTURE_CONTENT_COLLECTION,
			locale: FIXTURE_LOCALE,
			translationGroupId: "11111111-1111-4111-8111-111111111111",
			status: "published",
			version: 3,
			folderId: null,
			workingSlug: "published-post",
			publishedSlug: "published-post",
			createdAt: FIXTURE_TIME,
			updatedAt: FIXTURE_TIME,
			publishedAt: FIXTURE_TIME,
			working: fixtureBody("working body", "게시글", "hash-working-1"),
			published: fixtureBody("published body", "게시글", "hash-published-1", FIXTURE_SEO_METADATA),
		},
		{
			id: "22222222-2222-4222-8222-222222222222",
			collection: FIXTURE_DRAFT_COLLECTION,
			locale: FIXTURE_LOCALE,
			translationGroupId: "22222222-2222-4222-8222-222222222222",
			status: "draft",
			version: 1,
			folderId: null,
			workingSlug: "draft-memo",
			publishedSlug: null,
			createdAt: FIXTURE_TIME,
			updatedAt: FIXTURE_TIME,
			publishedAt: null,
			working: fixtureBody("draft secret body", "메모", "hash-working-2"),
		},
		{
			// 보관된 글. published 본문이 남아 있어도 공개 아카이브에는 나가면 안 된다.
			id: "88888888-8888-4888-8888-888888888888",
			collection: FIXTURE_CONTENT_COLLECTION,
			locale: FIXTURE_LOCALE,
			translationGroupId: "88888888-8888-4888-8888-888888888888",
			status: "archived",
			version: 2,
			folderId: null,
			workingSlug: "archived-post",
			publishedSlug: "archived-post",
			createdAt: FIXTURE_TIME,
			updatedAt: FIXTURE_TIME,
			publishedAt: FIXTURE_TIME,
			working: fixtureBody("archived working body", "보관글", "hash-working-3"),
			published: fixtureBody("archived published body", "보관글", "hash-published-3"),
		},
	],
	references: [
		{
			entryId: "11111111-1111-4111-8111-111111111111",
			state: "working",
			kind: FIXTURE_RELATION_KIND,
			targetId: "33333333-3333-4333-8333-333333333333",
			isStale: false,
			occurrences: [{ type: "metadata", path: fixtureRelation.name, ordinal: 0 }],
		},
		{
			entryId: "22222222-2222-4222-8222-222222222222",
			state: "working",
			kind: "media",
			targetId: "44444444-4444-4444-8444-444444444444",
			isStale: false,
			occurrences: [{ type: "mdx", line: 3, column: 1 }],
		},
		{
			// 공개 글의 작업본에서만 참조하는 이미지. 공개 목록에 나가면 안 된다.
			entryId: "11111111-1111-4111-8111-111111111111",
			state: "working",
			kind: "media",
			targetId: "99999999-9999-4999-8999-999999999999",
			isStale: false,
			occurrences: [{ type: "mdx", line: 7, column: 1 }],
		},
		{
			// 공개 상태에서 참조하는 이미지. 공개 목록에 포함되어야 한다.
			entryId: "11111111-1111-4111-8111-111111111111",
			state: "published",
			kind: "media",
			targetId: "44444444-4444-4444-8444-444444444444",
			isStale: false,
			occurrences: [{ type: "mdx", line: 3, column: 1 }],
		},
	],
	folders: [
		{
			id: "55555555-5555-4555-8555-555555555555",
			collection: FIXTURE_CONTENT_COLLECTION,
			parentId: null,
			name: "루트",
			position: 0,
			version: 1,
		},
	],
	addresses: [
		{
			collection: FIXTURE_CONTENT_COLLECTION,
			locale: FIXTURE_LOCALE,
			slug: "old-slug",
			entryId: "11111111-1111-4111-8111-111111111111",
			type: "alias",
		},
	],
	media: [
		{
			id: "44444444-4444-4444-8444-444444444444",
			status: "ready",
			filename: "draft-only.png",
			mimeType: "image/png",
			byteSize: 10,
			width: 1,
			height: 1,
			stagingKey: null,
			storageKey: "media/draft-only.png",
			createdAt: FIXTURE_TIME,
			original: null,
			defaultAlt: "",
			defaultCaption: "",
			updatedAt: FIXTURE_TIME,
			readyAt: FIXTURE_TIME,
		},
		{
			id: "99999999-9999-4999-8999-999999999999",
			status: "ready",
			filename: "working-only.png",
			mimeType: "image/png",
			byteSize: 20,
			width: 2,
			height: 2,
			stagingKey: null,
			storageKey: "media/working-only.png",
			createdAt: FIXTURE_TIME,
			original: null,
			defaultAlt: "",
			defaultCaption: "",
			updatedAt: FIXTURE_TIME,
			readyAt: FIXTURE_TIME,
		},
	],
	templates: [
		{
			id: "66666666-6666-4666-8666-666666666666",
			name: "기본",
			mdx: "## 문제",
			version: 1,
			createdAt: FIXTURE_TIME,
			updatedAt: FIXTURE_TIME,
		},
	],
	preferences: [{ userId: "admin", preferences: { defaultPageSize: 25 }, updatedAt: FIXTURE_TIME }],
});
