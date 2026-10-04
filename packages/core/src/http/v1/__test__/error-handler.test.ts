import { afterEach, describe, expect, it, vi } from "vitest";
import { handleApiError } from "../error-handler";

vi.mock("../../../adapters/auth", () => ({ AuthError: class AuthError extends Error {} }));

afterEach(() => vi.restoreAllMocks());

describe("API 오류 응답", () => {
	it("브라우저가 끊은 요청은 오류로 남기지 않는다", () => {
		const log = vi.spyOn(console, "error").mockImplementation(() => {});
		const aborted = Object.assign(new Error("aborted"), { code: "ECONNRESET" });
		expect(handleApiError(aborted).status).toBe(499);
		expect(handleApiError(new DOMException("stop", "AbortError")).status).toBe(499);
		expect(log).not.toHaveBeenCalled();
	});

	it("모르는 오류는 그대로 500으로 남긴다", () => {
		const log = vi.spyOn(console, "error").mockImplementation(() => {});
		expect(handleApiError(new Error("boom")).status).toBe(500);
		expect(log).toHaveBeenCalled();
	});
});
