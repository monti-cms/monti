import { NextResponse } from "next/server";
export declare const publicJson: (body: unknown) => NextResponse<unknown>;
export declare const publicError: (code: "invalid_input" | "not_found", message: string) => NextResponse<{
    code: "invalid_input" | "not_found";
    message: string;
}>;
/** Uses only 400, 404, and 503. Internal messages stay out of the response, and DB/config errors are not hidden as 404 (503, cause only in the log). */
export declare function publicApiError(error: unknown): NextResponse;
