import { brandErrorClass } from "./error-brand.js";
import { CmsError } from "./store/errors.js";
/** An occurrence as stored. Returns `undefined` for a value that is not an occurrence. */
export const readReferenceOccurrence = (value) => {
    if (typeof value !== "object" || value === null)
        return undefined;
    const record = value;
    if (record.type === "body") {
        return typeof record.blockId === "string" ? { type: "body", blockId: record.blockId } : { type: "body" };
    }
    if (record.type === "metadata" && typeof record.path === "string") {
        return typeof record.ordinal === "number"
            ? { type: "metadata", path: record.path, ordinal: record.ordinal }
            : { type: "metadata", path: record.path };
    }
    return undefined;
};
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
/** A request the service refuses; the issues say what is wrong with it. A {@link CmsError}, so the HTTP layer answers it like any other. */
export class ServiceError extends CmsError {
    constructor(code, issues, message, options) {
        super(message ?? errorText(code, issues), code, { issues, ...(options?.notice ? { notice: options.notice } : {}) });
        this.name = "ServiceError";
    }
}
brandErrorClass(ServiceError, "ServiceError");
