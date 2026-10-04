/** 저장소 구현이 던지는 안정적인 오류. `code`는 HTTP 계층이 상태 코드로 옮긴다. */
export class CmsError extends Error {
	public readonly code: string;
	public readonly serverVersion?: number;
	public readonly details?: unknown;

	constructor(message: string, code: string, serverVersion?: number, details?: unknown) {
		super(message);
		this.code = code;
		this.serverVersion = serverVersion;
		this.details = details;
		this.name = "CmsError";
	}
}

type PgErrorLike = { code?: unknown; constraint?: unknown };

const pgError = (err: unknown): PgErrorLike => (typeof err === "object" && err !== null ? (err as PgErrorLike) : {});

/** PostgreSQL 고유 제약 위반(23505). 제약 이름으로만 판정하고 메시지는 파싱하지 않는다(§9.2). */
export function isUniqueViolation(err: unknown, constraints: string | readonly string[]): boolean {
	const { code, constraint } = pgError(err);
	const names = typeof constraints === "string" ? [constraints] : constraints;
	return code === "23505" && typeof constraint === "string" && names.includes(constraint);
}

export function isForeignKeyViolation(err: unknown): boolean {
	return pgError(err).code === "23503";
}

/** 교착(40P01)·직렬화 실패(40001). 동시 발행 충돌로 본다. */
export function isTransactionConflict(err: unknown): boolean {
	const { code } = pgError(err);
	return code === "40P01" || code === "40001";
}

/** 콘텐츠 쓰기 트랜잭션의 공통 오류 매핑. */
export function mapEntryWriteError(err: unknown): unknown {
	if (isUniqueViolation(err, "content_addresses_pkey")) return new CmsError("Slug conflict", "slug_conflict");
	// v2 B4: 한 번역 묶음에는 언어마다 콘텐츠가 하나다(휴지통 포함).
	if (isUniqueViolation(err, "entries_translation_locale_key")) {
		return new CmsError("A translation for this locale already exists", "translation_exists");
	}
	if (isTransactionConflict(err)) return new CmsError("Concurrent publish conflict", "conflict");
	return err;
}
