import { NextResponse } from "next/server";
import { AuthError } from "../../adapters/auth/index.js";
import { CmsError } from "../../adapters/postgres/content-store.js";
import { ServiceError } from "../../services/types.js";
/**
 * HTTP errors that routes throw directly (malformed request, missing version, etc.). Plugin errors extend this to set the status code.
 * The response shape matches other errors: `code`, `message`, and `issues` when present.
 */
export class HttpError extends Error {
    status;
    code;
    issues;
    constructor(status, code, message, issues) {
        super(message);
        this.status = status;
        this.code = code;
        this.issues = issues;
        this.name = "HttpError";
    }
}
const CMS_ERROR_STATUS = {
    not_found: 404,
    conflict: 409,
    slug_conflict: 409,
    in_use: 409,
    invalid_status: 409,
    locked: 409,
    folder_name_conflict: 409,
    translation_exists: 409,
    has_translations: 409,
    source_trashed: 409,
    invalid_input: 400,
    invalid_reference: 400,
    invalid_state: 500,
    media_not_configured: 501,
};
const SERVICE_ERROR_STATUS = {
    invalid_input: 400,
    unknown_collection: 400,
    slug_reserved: 409,
    mdx_too_large: 413,
    metadata_too_large: 413,
};
/** A DB connection failure is a transient error (503). It is not disguised as missing content or an empty list. */
const isUnavailable = (error) => {
    const code = error?.code;
    return (typeof code === "string" &&
        (code === "ECONNREFUSED" ||
            code === "ETIMEDOUT" ||
            code === "ENOTFOUND" ||
            code === "57P01" ||
            code.startsWith("08")));
};
export function handleApiError(error) {
    if (error instanceof HttpError) {
        return NextResponse.json({ code: error.code, message: error.message, ...(error.issues ? { issues: error.issues } : {}) }, { status: error.status });
    }
    if (error instanceof AuthError) {
        return NextResponse.json({ code: error.code, message: error.message }, { status: error.code === "unauthorized" ? 401 : 403 });
    }
    if (error instanceof CmsError) {
        const status = CMS_ERROR_STATUS[error.code] ?? 400;
        if (status === 500)
            console.error("CMS store invariant broken:", error);
        return NextResponse.json({
            code: error.code,
            message: status === 500 ? "Internal server error" : error.message,
            ...(error.serverVersion !== undefined ? { serverVersion: error.serverVersion } : {}),
            ...(error.details !== undefined ? { details: error.details } : {}),
        }, { status });
    }
    if (error instanceof ServiceError) {
        return NextResponse.json({ code: error.code, message: error.message, ...(error.issues ? { issues: error.issues } : {}) }, { status: SERVICE_ERROR_STATUS[error.code] ?? 422 });
    }
    // The UI withdrew the request (e.g. reloading the model list). Nobody is waiting, so end quietly.
    if (isClientAbort(error))
        return new NextResponse(null, { status: 499 });
    if (isUnavailable(error)) {
        console.error("CMS storage unavailable:", error);
        return NextResponse.json({ code: "unavailable", message: "Storage is temporarily unavailable" }, { status: 503 });
    }
    console.error("Unhandled API error:", error);
    return NextResponse.json({ code: "internal_error", message: "Internal server error" }, { status: 500 });
}
/** Work stopped because the browser dropped the request (body not fully read) or the request signal aborted. */
function isClientAbort(error) {
    if (!error || typeof error !== "object")
        return false;
    // DOMException does not extend Error in every runtime. Check by name.
    const { name, code, message } = error;
    return name === "AbortError" || (code === "ECONNRESET" && message === "aborted");
}
