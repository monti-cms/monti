/**
 * The one error the server code throws for a request it cannot do. `code` is an {@link ErrorCode}, so the HTTP status comes from one table and
 * the response has one shape: `{ error: { code, message, issues?, details? } }`.
 */
export class CmsError extends Error {
    code;
    /** The version the server holds, for a `conflict`: the caller can reload and retry. It reaches the response as `details.serverVersion`. */
    serverVersion;
    details;
    /** Problems found in the request (the issues of a validation), when the code is about the content. */
    issues;
    constructor(message, code, serverVersion, details, issues) {
        super(message);
        this.code = code;
        this.serverVersion = serverVersion;
        this.details = details;
        this.issues = issues;
        this.name = "CmsError";
    }
}
