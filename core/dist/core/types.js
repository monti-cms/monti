export const normalizeReferenceKind = (kind) => (kind === "media" ? "media" : "entry");
/**
 * An occurrence as stored. Rows written before bodies were checked as documents hold `{type:"mdx", line, column, blockId?}` for a body
 * occurrence; it reads as `{type:"body", blockId?}` and is rewritten in the new form the next time the references are saved.
 * Returns `undefined` for a value that is not an occurrence.
 */
export const readReferenceOccurrence = (value) => {
    if (typeof value !== "object" || value === null)
        return undefined;
    const record = value;
    if (record.type === "body" || record.type === "mdx") {
        return typeof record.blockId === "string" ? { type: "body", blockId: record.blockId } : { type: "body" };
    }
    if (record.type === "metadata" && typeof record.path === "string") {
        return typeof record.ordinal === "number"
            ? { type: "metadata", path: record.path, ordinal: record.ordinal }
            : { type: "metadata", path: record.path };
    }
    return undefined;
};
/** Whether a stored occurrence list still has an occurrence in the old shape. */
export const hasLegacyOccurrence = (value) => Array.isArray(value) && value.some((item) => item?.type === "mdx");
/** The occurrences of a stored reference row, in the current shape. */
export const readReferenceOccurrences = (value) => (Array.isArray(value) ? value : []).flatMap((item) => readReferenceOccurrence(item) ?? []);
/**
 * The text of a `ServiceError` that was given no message: the code, then what its issues say (`validation_failed: The slug "A" must be lowercase (slug)`,
 * `publish_validation_failed: empty_body (body)`), so an error that reaches a log or a test failure tells what is wrong, not only a code.
 * An issue says its `message`, else its code, and where it is (`path`).
 */
const errorText = (code, issues) => {
    const told = (issues ?? []).map((issue) => {
        const what = issue.message || issue.code;
        return issue.path ? `${what} (${issue.path})` : what;
    });
    return told.length > 0
        ? `${code}: ${told.slice(0, 3).join("; ")}${told.length > 3 ? ` (and ${told.length - 3} more)` : ""}`
        : code;
};
export class ServiceError extends Error {
    code;
    issues;
    constructor(code, issues, message) {
        super(message ?? errorText(code, issues));
        this.code = code;
        this.issues = issues;
        this.name = "ServiceError";
    }
}
