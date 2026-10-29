import { CmsError } from "../../../core/store/errors";

type PgErrorLike = { code?: unknown; constraint?: unknown };

const pgError = (err: unknown): PgErrorLike => (typeof err === "object" && err !== null ? (err as PgErrorLike) : {});

/** PostgreSQL unique constraint violation (23505). Judged by constraint name only; the message is not parsed. */
export function isUniqueViolation(err: unknown, constraints: string | readonly string[]): boolean {
	const { code, constraint } = pgError(err);
	const names = typeof constraints === "string" ? [constraints] : constraints;
	return code === "23505" && typeof constraint === "string" && names.includes(constraint);
}

/** Deadlock (40P01) and serialization failure (40001). Treated as a concurrent publish conflict. */
export function isTransactionConflict(err: unknown): boolean {
	const { code } = pgError(err);
	return code === "40P01" || code === "40001";
}

/** PostgreSQL foreign key violation (23503) on one of `constraints`. Judged by constraint name only. */
function isForeignKeyViolation(err: unknown, constraints: readonly string[]): boolean {
	const { code, constraint } = pgError(err);
	return code === "23503" && typeof constraint === "string" && constraints.includes(constraint);
}

/** Shared error mapping for content write transactions. */
export function mapEntryWriteError(err: unknown): unknown {
	if (isUniqueViolation(err, "content_addresses_pkey")) return new CmsError("Slug conflict", "slug_conflict");
	// A reference whose entry or media file is not in the store: gone since the write was prepared, or never there.
	if (isForeignKeyViolation(err, ["entry_references_target_entry_id_fkey", "entry_references_target_media_id_fkey"])) {
		return new CmsError("A reference points at an entry or a media file that does not exist", "invalid_reference");
	}
	// A translation group has one content per language (including trashed).
	if (isUniqueViolation(err, "entries_translation_locale_key")) {
		return new CmsError("A translation for this locale already exists", "translation_exists");
	}
	if (isTransactionConflict(err)) return new CmsError("Concurrent publish conflict", "conflict");
	return err;
}
