import { type CollectionSchema, SUMMARY_ROLE, valueWithRole } from "@monti-cms/core";
import { SEO_ROLES } from "./fields";

/** 공개 화면이 쓸 SEO 값. 비운 값은 없다(`undefined`). */
export interface SeoValues {
	/** 검색 제목. 비었으면 제목(`title`, 라이브러리 약속). */
	readonly title?: string;
	/** 검색 설명. 비었으면 요약 역할(`summary`) 값. */
	readonly description?: string;
	/** 공유 이미지(미디어 ID). 공개 주소는 사이트가 미디어 저장소로 만든다. */
	readonly imageId?: string;
	/** 원본 주소(canonical). */
	readonly canonical?: string;
	/** 검색엔진에 숨긴다. */
	readonly noindex: boolean;
}

const filled = (value: string) => value.trim() || undefined;

/**
 * 컬렉션 정의(`defineCollection`의 결과)와 저장된 메타데이터에서 SEO 값을 읽는다. 필드 이름이 아니라 역할로 찾으므로
 * `seoFields({ keys })`로 이름을 바꿔도 그대로다. 제목·설명은 비면 제목·요약으로 채운다.
 *
 * ```ts
 * const seo = seoOf(post, entry.metadata);
 * ```
 */
export function seoOf(
	schema: Pick<CollectionSchema, "fields">,
	metadata: { readonly [key: string]: unknown },
): SeoValues {
	const role = (name: string) => filled(valueWithRole(schema, name, metadata));
	const title = role(SEO_ROLES.title) ?? (typeof metadata.title === "string" ? filled(metadata.title) : undefined);
	const description = role(SEO_ROLES.description) ?? role(SUMMARY_ROLE);
	const imageId = role(SEO_ROLES.image);
	const canonical = role(SEO_ROLES.canonical);
	return {
		...(title ? { title } : {}),
		...(description ? { description } : {}),
		...(imageId ? { imageId } : {}),
		...(canonical ? { canonical } : {}),
		noindex: role(SEO_ROLES.noindex) === "noindex",
	};
}
