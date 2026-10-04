/** Stable error thrown by store implementations. The HTTP layer maps `code` to a status code. */
export class CmsError extends Error {
    code;
    serverVersion;
    details;
    constructor(message, code, serverVersion, details) {
        super(message);
        this.code = code;
        this.serverVersion = serverVersion;
        this.details = details;
        this.name = "CmsError";
    }
}
const pgError = (err) => (typeof err === "object" && err !== null ? err : {});
/** PostgreSQL unique constraint violation (23505). Judged by constraint name only; the message is not parsed. */
export function isUniqueViolation(err, constraints) {
    const { code, constraint } = pgError(err);
    const names = typeof constraints === "string" ? [constraints] : constraints;
    return code === "23505" && typeof constraint === "string" && names.includes(constraint);
}
export function isForeignKeyViolation(err) {
    return pgError(err).code === "23503";
}
/** Deadlock (40P01) and serialization failure (40001). Treated as a concurrent publish conflict. */
export function isTransactionConflict(err) {
    const { code } = pgError(err);
    return code === "40P01" || code === "40001";
}
/** Shared error mapping for content write transactions. */
export function mapEntryWriteError(err) {
    if (isUniqueViolation(err, "content_addresses_pkey"))
        return new CmsError("Slug conflict", "slug_conflict");
    // A translation group has one content per language (including trashed).
    if (isUniqueViolation(err, "entries_translation_locale_key")) {
        return new CmsError("A translation for this locale already exists", "translation_exists");
    }
    if (isTransactionConflict(err))
        return new CmsError("Concurrent publish conflict", "conflict");
    return err;
}
