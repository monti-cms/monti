import { describe, expect, it } from "vitest";
import { CmsApiError } from "../../screens/admin-api";
import { toEditorError } from "../result";

const api = (status: number, code?: string, issues: CmsApiError["issues"] = []) =>
	new CmsApiError(status, code, `server ${status}`, issues, {});

describe("toEditorError", () => {
	it("maps API errors by status and code, keeping the server message", () => {
		expect(toEditorError(api(401), "fallback")).toMatchObject({
			code: "session_expired",
			message: "server 401",
			status: 401,
			retryable: false,
		});
		expect(toEditorError(api(409, "conflict"), "fallback")).toMatchObject({ code: "conflict", retryable: false });
		expect(toEditorError(api(404), "fallback")).toMatchObject({ code: "not_found", retryable: false });
		expect(toEditorError(api(422, undefined, [{ message: "bad" }]), "fallback")).toMatchObject({
			code: "validation",
			issues: [{ message: "bad" }],
			retryable: false,
		});
	});

	it("passes other server codes through, and a 4xx is not retryable while a 5xx is", () => {
		expect(toEditorError(api(403, "forbidden"), "fallback")).toMatchObject({ code: "forbidden", retryable: false });
		expect(toEditorError(api(400), "fallback")).toMatchObject({ code: "failed", retryable: false });
		expect(toEditorError(api(409, "other"), "fallback")).toMatchObject({ code: "other", retryable: false });
		expect(toEditorError(api(500), "fallback")).toMatchObject({ code: "failed", retryable: true });
		expect(toEditorError(api(503, "unavailable"), "fallback")).toMatchObject({ code: "unavailable", retryable: true });
	});

	it("uses the fallback text when the API error has no message", () => {
		const error = new CmsApiError(500, undefined, "", [], {});
		expect(toEditorError(error, "fallback").message).toBe("fallback");
	});

	it("maps a fetch TypeError to offline with the localized fallback, retryable", () => {
		expect(toEditorError(new TypeError("Failed to fetch"), "You are offline.")).toMatchObject({
			code: "offline",
			message: "You are offline.",
			retryable: true,
		});
	});

	it("maps an AbortError to aborted", () => {
		const abort = new DOMException("The operation was aborted.", "AbortError");
		expect(toEditorError(abort, "fallback")).toMatchObject({ code: "aborted", message: "fallback" });
	});

	it("maps a plain Error to failed with its message, and anything else to failed with the fallback", () => {
		expect(toEditorError(new Error("boom"), "fallback")).toMatchObject({
			code: "failed",
			message: "boom",
			retryable: false,
		});
		expect(toEditorError(new Error(""), "fallback").message).toBe("fallback");
		expect(toEditorError("string", "fallback")).toMatchObject({ code: "failed", message: "fallback" });
	});

	it("keeps the original error as cause", () => {
		const cause = new Error("boom");
		expect(toEditorError(cause, "fallback").cause).toBe(cause);
	});
});
