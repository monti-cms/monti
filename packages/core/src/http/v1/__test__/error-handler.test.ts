import { afterEach, describe, expect, it, vi } from "vitest";
import { handleApiError } from "../error-handler";

vi.mock("../../../adapters/auth", () => ({ AuthError: class AuthError extends Error {} }));

afterEach(() => vi.restoreAllMocks());

describe("API error responses", () => {
	it("does not log a request the browser dropped as an error", () => {
		const log = vi.spyOn(console, "error").mockImplementation(() => {});
		const aborted = Object.assign(new Error("aborted"), { code: "ECONNRESET" });
		expect(handleApiError(aborted).status).toBe(499);
		expect(handleApiError(new DOMException("stop", "AbortError")).status).toBe(499);
		expect(log).not.toHaveBeenCalled();
	});

	it("keeps an unknown error as a 500", () => {
		const log = vi.spyOn(console, "error").mockImplementation(() => {});
		expect(handleApiError(new Error("boom")).status).toBe(500);
		expect(log).toHaveBeenCalled();
	});
});
