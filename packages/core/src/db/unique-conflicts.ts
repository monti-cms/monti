/**
 * `0001-initial`의 고유 제약·고유 색인 이름별 `CONFLICT` 메시지. PostgreSQL은 이름을 주지 않은 기본 키를 `<테이블>_pkey`,
 * 열의 고유 제약을 `<테이블>_<열>_key`로 이름 짓는다.
 */
const MESSAGES: Record<string, string> = {
	folders_pkey: "이 `id`의 폴더가 이미 있다",
	folders_active_root_name: "이 위치에 같은 이름의 폴더가 있다",
	folders_active_child_name: "이 위치에 같은 이름의 폴더가 있다",
	templates_pkey: "이 `id`의 템플릿이 이미 있다",
	templates_collection_name_key: "이 컬렉션에 같은 이름의 템플릿이 있다",
	media_pkey: "이 `id`의 미디어가 이미 있다",
	media_key_key: "같은 저장 키의 미디어가 이미 있다",
	media_uses_pkey: "이 미디어 사용처가 이미 기록되어 있다",
	loose_files_pkey: "이 저장 키의 파일이 이미 기록되어 있다",
	admin_pkey: "이 `id`의 관리자가 이미 있습니다",
	admin_single_row: "관리자가 이미 있습니다",
	session_pkey: "이 세션이 이미 있습니다",
	api_keys_pkey: "이 `id`의 키가 이미 있습니다",
	api_keys_name_key: "같은 이름의 키가 있습니다",
};

/** 고유 제약 `constraint`를 어긴 쓰기의 `CONFLICT` 메시지. 위 목록에 없는 제약(컬렉션 테이블 등)은 일반 메시지다. */
export function uniqueConflictMessage(constraint: unknown): string {
	if (typeof constraint === "string" && Object.hasOwn(MESSAGES, constraint)) return MESSAGES[constraint] as string;
	return "이미 있는 값과 겹쳐 저장할 수 없다";
}
