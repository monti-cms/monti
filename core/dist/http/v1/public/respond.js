import { CmsError } from "../../../core/store/index.js";
import { ServiceError } from "../../../core/types.js";
/** Public responses are not cached (errors too: if a CDN stores a 404, it stays 404 even right after publishing). */
const NO_STORE = { "Cache-Control": "no-store" };
export const publicJson = (body) => Response.json(body, { headers: NO_STORE });
export const publicError = (code, message) => Response.json({ code, message }, { status: code === "not_found" ? 404 : 400, headers: NO_STORE });
/** Uses only 400, 404, and 503. Internal messages stay out of the response, and DB/config errors are not hidden as 404 (503, cause only in the log). */
export function publicApiError(error) {
    if (error instanceof CmsError) {
        if (error.code === "not_found")
            return publicError("not_found", "Not found");
        if (error.code === "invalid_input")
            return publicError("invalid_input", error.message);
    }
    // The `format` option names a format the site does not have: a request problem, not an outage.
    if (error instanceof ServiceError && (error.code === "unknown_format" || error.code === "format_not_importable")) {
        return publicError("invalid_input", "Unknown format");
    }
    console.error("[cms] public API error:", error);
    return Response.json({ code: "unavailable", message: "Public content is temporarily unavailable" }, { status: 503, headers: NO_STORE });
}
