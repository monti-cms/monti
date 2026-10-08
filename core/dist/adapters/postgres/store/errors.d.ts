/** PostgreSQL unique constraint violation (23505). Judged by constraint name only; the message is not parsed. */
export declare function isUniqueViolation(err: unknown, constraints: string | readonly string[]): boolean;
export declare function isForeignKeyViolation(err: unknown): boolean;
/** Deadlock (40P01) and serialization failure (40001). Treated as a concurrent publish conflict. */
export declare function isTransactionConflict(err: unknown): boolean;
/** Shared error mapping for content write transactions. */
export declare function mapEntryWriteError(err: unknown): unknown;
