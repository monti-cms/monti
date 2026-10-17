import { brandErrorClass } from "../error-brand.js";
/**
 * The one error the server code throws for a request it cannot do. `code` is an {@link ErrorCode}, so the HTTP status comes from one table and
 * the response has one shape: `{ error: { code, message, fix?, detail?, issues?, details? } }`.
 *
 * `message` is for developers and the server log (English, may name ids and values). The person reads the `notice`, or the text of the code when there is none.
 */
export class CmsError extends Error {
    code;
    serverVersion;
    details;
    issues;
    notice;
    constructor(message, code, options = {}) {
        super(message, options.cause === undefined ? undefined : { cause: options.cause });
        this.code = code;
        this.serverVersion = options.serverVersion;
        this.details = options.details;
        this.issues = options.issues;
        this.notice = options.notice;
        this.name = "CmsError";
    }
}
brandErrorClass(CmsError, "CmsError");
