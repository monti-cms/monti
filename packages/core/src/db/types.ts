import type { ColumnType, JSONColumnType, Kysely } from "kysely";
import type { Doc } from "../rich-text/types";

/** `timestamptz` 열: `Date`로 읽고 `Date`나 ISO 문자열로 쓴다. */
type Timestamp = ColumnType<Date, Date | string, Date | string>;

/** null을 허용하는 `timestamptz` 열: `Date | null`로 읽고, 넣을 때는 생략할 수 있다. */
type NullableTimestamp = ColumnType<Date | null, Date | string | null | undefined, Date | string | null>;

/** null을 허용하는 `uuid` 열: `string | null`로 읽고, 넣을 때는 생략할 수 있다. */
type NullableUuid = ColumnType<string | null, string | null | undefined, string | null>;

/** null을 허용하는 열: 값이나 null로 읽고, 넣을 때는 생략할 수 있다. */
type Nullable<T> = ColumnType<T | null, T | null | undefined, T | null>;

export interface TemplatesTable {
	id: string;
	collection: string;
	name: string;
	/** 리치 텍스트 본문을 담는 `jsonb` 열: JSON 텍스트로 쓴다. */
	content: JSONColumnType<Doc>;
}

/** `scope`는 컬렉션 키이거나 `media`다. */
export interface FoldersTable {
	id: string;
	scope: string;
	parent_id: NullableUuid;
	name: string;
	trashed_at: NullableTimestamp;
}

export interface MediaTable {
	id: string;
	folder_id: NullableUuid;
	key: string;
	filename: string;
	mime_type: string;
	size: number;
	width: Nullable<number>;
	height: Nullable<number>;
	trashed_at: NullableTimestamp;
}

/** 글이나 템플릿이 미디어 파일을 쓰는 곳. `source_id`는 외래 키가 아닌 논리 참조다. */
export interface MediaUsesTable {
	media_id: string;
	source_kind: "entry" | "template";
	source_id: string;
	field_path: string;
}

/**
 * 아무도 쓰지 않아 지워지기를 기다리는 저장소 파일. `kind`는 `media.startUpload`가 발급해 아직 등록되지 않은 키(`"upload"`)와
 * 교체·영구 삭제로 쓰이지 않게 된 키(`"cleanup"`, 기본값)를 가른다.
 */
export interface LooseFilesTable {
	key: string;
	kind: ColumnType<"upload" | "cleanup", "upload" | "cleanup" | undefined, "upload" | "cleanup">;
	remove_after: Timestamp;
}

export interface AdminTable {
	id: string;
	email: string;
	password_hash: string;
}

export interface SessionTable {
	token_hash: string;
	admin_id: string;
	expires_at: Timestamp;
}

/** 외부 서비스 키. `secret`에 암호화해 보관한다. */
export interface ApiKeysTable {
	id: string;
	service: string;
	name: string;
	secret: string;
	last4: string;
}

/** core의 고정 도메인 테이블 8개. 컬렉션별 테이블은 스키마에서 만들어진다. */
export interface Database {
	templates: TemplatesTable;
	folders: FoldersTable;
	media: MediaTable;
	media_uses: MediaUsesTable;
	loose_files: LooseFilesTable;
	admin: AdminTable;
	session: SessionTable;
	api_keys: ApiKeysTable;
}

/**
 * DB 변경 한 단계. core와 플러그인은 각자 배열로 나열하고, 배열 순서대로 한 번씩 실행된다.
 * `db`는 타입이 없다: 한 단계는 지금이 아니라 그 단계를 쓴 시점의 테이블을 다룬다.
 */
export interface Migration {
	name: string;
	up: (db: Kysely<any>) => Promise<void>;
}
