import { NextResponse } from "next/server";
import { CmsError } from "../../../adapters/postgres/store/errors";

/** Public responses are not cached (errors too: if a CDN stores a 404, it stays 404 even right after publishing). */
const NO_STORE = { "Cache-Control": "no-store" } as const;

export const publicJson = (body: unknown) => NextResponse.json(body, { headers: NO_STORE });

export const publicError = (code: "invalid_input" | "not_found", message: string) =>
	NextResponse.json({ code, message }, { status: code === "not_found" ? 404 : 400, headers: NO_STORE });

/** Uses only 400, 404, and 503. Internal messages stay out of the response, and DB/config errors are not hidden as 404 (503, cause only in the log). */
export function publicApiError(error: unknown): NextResponse {
	if (error instanceof CmsError) {
		if (error.code === "not_found") return publicError("not_found", "Not found");
		if (error.code === "invalid_input") return publicError("invalid_input", error.message);
	}
	console.error("[cms] public API error:", error);
	return NextResponse.json(
		{ code: "unavailable", message: "Public content is temporarily unavailable" },
		{ status: 503, headers: NO_STORE },
	);
}
