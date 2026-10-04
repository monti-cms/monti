import { adminEntryEditHref, adminHref, isItemCollection } from "@monti-cms/core/client";

/** 목록 화면에서 항목을 열어 두는 주소 값(`?collection=tag&open=<ID>`). 항목 컬렉션은 편집 화면 대신 목록의 작은 폼으로 연다. */
export const OPEN_ITEM_PARAM = "open";

/**
 * 콘텐츠 하나를 여는 관리자 주소. 문서 컬렉션은 편집 화면, 항목 컬렉션(`kind: "item"`)은 그 목록에서 항목 칸을 연 주소다.
 * 미디어 사용처처럼 여러 컬렉션의 항목을 가리키는 곳이 쓴다.
 */
export function entryHref(collection: string | null | undefined, id: string): string {
	if (collection && isItemCollection(collection)) {
		return adminHref(`?${new URLSearchParams({ collection, [OPEN_ITEM_PARAM]: id }).toString()}`);
	}
	return adminEntryEditHref(id);
}
