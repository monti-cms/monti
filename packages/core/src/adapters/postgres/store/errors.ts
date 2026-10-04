/** Stable error thrown by store implementations. The HTTP layer maps `code` to a status code. */
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

/** PostgreSQL unique constraint violation (23505). Judged by constraint name only; the message is not parsed. */
export function isUniqueViolation(err: unknown, constraints: string | readonly string[]): boolean {
	const { code, constraint } = pgError(err);
	const names = typeof constraints === "string" ? [constraints] : constraints;
	return code === "23505" && typeof constraint === "string" && names.includes(constraint);
}

export function isForeignKeyViolation(err: unknown): boolean {
	return pgError(err).code === "23503";
}

/** Deadlock (40P01) and serialization failure (40001). Treated as a concurrent publish conflict. */
export function isTransactionConflict(err: unknown): boolean {
	const { code } = pgError(err);
	return code === "40P01" || code === "40001";
}

/** Shared error mapping for content write transactions. */
export function mapEntryWriteError(err: unknown): unknown {
	if (isUniqueViolation(err, "content_addresses_pkey")) return new CmsError("Slug conflict", "slug_conflict");
	// A translation group has one content per language (including trashed).
	if (isUniqueViolation(err, "entries_translation_locale_key")) {
		return new CmsError("A translation for this locale already exists", "translation_exists");
	}
	if (isTransactionConflict(err)) return new CmsError("Concurrent publish conflict", "conflict");
	return err;
}
