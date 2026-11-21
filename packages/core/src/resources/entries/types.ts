import type { Doc } from "../../rich-text/types";

/** 글 한 언어·상태의 `data`: 키별 필드 값과 리치 텍스트 본문. */
export interface EntryData {
	fields: Record<string, unknown>;
	body?: Doc;
}

/** 글 액션이 돌려주는 한 언어의 글: 작업본과 발행본이 같은 모양이다. */
export interface Entry {
	id: string;
	collection: string;
	locale: string;
	source_locale: string;
	folder_id: string | null;
	slug: string | null;
	data: EntryData;
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
