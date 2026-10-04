import type { ReadEntry } from "../../../read";

/**
 * 공개 JSON API(`/api/cms/v1/public/*`, M14-6). 서버 설정의 `publicApi`로 켠다. 없으면 공개 API 경로는 404다.
 * 로그인 없이 공개본만 돌려주고 응답은 캐시하지 않는다(보관·주소 변경이 다음 요청에 바로 반영된다).
 */
export interface PublicApiOptions {
	/** 공개할 컬렉션. 목록·단건 모두 이 안에서만 받는다. */
	readonly collections: readonly string[];
	/** 목록에서 `collection`을 주지 않을 때. 없으면 `collections`의 첫 컬렉션. */
	readonly defaultCollection?: string;
	/**
	 * 목록 질의 이름 → 관계 필드. 값은 대상 항목의 주소(slug)다. 예: `{ category: "categoryId", tag: "tagIds" }`이면
	 * `?category=react`가 주소가 `react`인 항목을 가리키는 글만 돌려준다.
	 */
	readonly filters?: Readonly<Record<string, string>>;
	/** 쪽 크기 상한(기본 100). 기본 쪽 크기는 25. */
	readonly maxPageSize?: number;
	/**
	 * 응답의 글 모양. 없으면 기본 모양(`defaultPublicJson`). 본문은 단건에만 실린다(`body: true`).
	 * `null`을 돌려주면 그 글을 공개 API에서 숨긴다(목록에서 빠지고 단건은 404). 쪽의 `total`은 숨기기 전 개수다.
	 */
	readonly toJson?: (entry: ReadEntry, options: { readonly body: boolean }) => unknown;
}

/** 기본 응답 모양. 관리자 전용 값(판·폴더·상태)은 없다. */
export function defaultPublicJson(entry: ReadEntry, { body }: { readonly body: boolean }) {
	return {
		id: entry.translationGroupId,
		collection: entry.collection,
		locale: entry.locale,
		slug: entry.slug,
		path: entry.path,
		title: entry.title,
		publishedAt: entry.publishedAt?.toISOString() ?? null,
		updatedAt: entry.updatedAt.toISOString(),
		metadata: entry.metadata,
		relations: entry.relations,
		...(body ? { body: entry.mdx } : {}),
	};
}
