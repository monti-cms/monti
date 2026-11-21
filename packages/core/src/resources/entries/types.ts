import type { Doc } from "../../rich-text/types";

/** 글 한 언어·상태의 필드 값과 본문: 키별 필드 값과 리치 텍스트 본문. 본문이 없으면 `body` 키가 없다. */
export interface EntryData {
	fields: Record<string, unknown>;
	body?: Doc;
}

/** 글 액션이 돌려주는 한 언어의 글: 작업본과 발행본이 같은 모양이다. 필드 값과 본문은 껍데기 없이 펼친다. */
export interface Entry extends EntryData {
	id: string;
	collection: string;
	locale: string;
	source_locale: string;
	folder_id: string | null;
	slug: string | null;
	published_at: Date | null;
}

/** `<collection>_data`의 `status`: 작업본 또는 발행본. */
export type Status = "draft" | "published";

/** `<collection>_data` 한 행의 키. */
export interface CopyKey {
	entry_id: string;
	locale: string;
	status: Status;
}
