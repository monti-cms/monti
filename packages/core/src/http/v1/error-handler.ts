import { AuthError } from "../../adapters/auth";
import { CmsError } from "../../core/store";
import { ServiceError } from "../../services/types";

/**
 * HTTP errors that routes throw directly (malformed request, missing version, etc.). Plugin errors extend this to set the status code.
 * The response shape matches other errors: `code`, `message`, and `issues` when present.
 */
export class HttpError extends Error {
	constructor(
		readonly status: number,
		readonly code: string,
		message: string,
		readonly issues?: unknown,
		/** More members of the response body (a machine-readable `reason`, say). */
		readonly extra?: Readonly<Record<string, unknown>>,
	) {
		super(message);
		this.name = "HttpError";
	}
}

const CMS_ERROR_STATUS: Record<string, number> = {
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

const SERVICE_ERROR_STATUS: Record<string, number> = {
	invalid_input: 400,
	unknown_collection: 400,
	slug_reserved: 409,
	body_too_large: 413,
	metadata_too_large: 413,
	// The `format` option names a format no plugin provides, or one that can only write text.
	unknown_format: 400,
	format_not_importable: 400,
	// The format could not read the text, or a plugin's format threw.
	format_import_failed: 422,
	format_export_failed: 500,
	// A hook of the server config or a plugin threw: a server-side failure, not a problem with the request.
	hook_failed: 500,
};

/** A DB connection failure is a transient error (503). It is not disguised as missing content or an empty list. */
const isUnavailable = (error: unknown) => {
	const code = (error as { code?: unknown })?.code;
	return (
		typeof code === "string" &&
		(code === "ECONNREFUSED" ||
			code === "ETIMEDOUT" ||
			code === "ENOTFOUND" ||
			code === "57P01" ||
			code.startsWith("08"))
	);
};

export function handleApiError(error: unknown): Response {
	if (error instanceof HttpError) {
		return Response.json(
			{
				code: error.code,
				message: error.message,
				...(error.issues ? { issues: error.issues } : {}),
				...error.extra,
			},
			{ status: error.status },
		);
	}

	if (error instanceof AuthError) {
		return Response.json(
			{ code: error.code, message: error.message },
			{ status: error.code === "unauthorized" ? 401 : 403 },
		);
	}

	if (error instanceof CmsError) {
		const status = CMS_ERROR_STATUS[error.code] ?? 400;
		if (status === 500) console.error("CMS store invariant broken:", error);
		return Response.json(
			{
				code: error.code,
				message: status === 500 ? "Internal server error" : error.message,
				...(error.serverVersion !== undefined ? { serverVersion: error.serverVersion } : {}),
				...(error.details !== undefined ? { details: error.details } : {}),
			},
			{ status },
		);
	}

	if (error instanceof ServiceError) {
		return Response.json(
			{ code: error.code, message: error.message, ...(error.issues ? { issues: error.issues } : {}) },
			{ status: SERVICE_ERROR_STATUS[error.code] ?? 422 },
		);
	}

	// The UI withdrew the request (e.g. reloading the model list). Nobody is waiting, so end quietly.
	if (isClientAbort(error)) return new Response(null, { status: 499 });

	if (isUnavailable(error)) {
		console.error("CMS storage unavailable:", error);
		return Response.json({ code: "unavailable", message: "Storage is temporarily unavailable" }, { status: 503 });
	}

	console.error("Unhandled API error:", error);
	return Response.json({ code: "internal_error", message: "Internal server error" }, { status: 500 });
}

/** Work stopped because the browser dropped the request (body not fully read) or the request signal aborted. */
function isClientAbort(error: unknown): boolean {
	if (!error || typeof error !== "object") return false;
	// DOMException does not extend Error in every runtime. Check by name.
	const { name, code, message } = error as { name?: unknown; code?: unknown; message?: unknown };
	return name === "AbortError" || (code === "ECONNRESET" && message === "aborted");
}
