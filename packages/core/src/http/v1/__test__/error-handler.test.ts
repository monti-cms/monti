import { afterEach, describe, expect, it, vi } from "vitest";
import { testSite } from "../../../../test/site";
import { errorMessages, noticeMessages } from "../../../core/error-notice";
import { problemError } from "../../../core/problem";
import { CmsError, cmsErrorText, type ErrorBody, handleApiError } from "../error-handler";

afterEach(() => vi.restoreAllMocks());

describe("API error responses", () => {
	it("ADMIN-E2 keeps an unknown error as a 500", () => {
		const log = vi.spyOn(console, "error").mockImplementation(() => {});
		const error = new Error("boom");
		expect(handleApiError(error).status).toBe(500);
		// The server log keeps the error itself, for the developer.
		expect(log).toHaveBeenCalledWith(expect.any(String), error);
	});
});

describe("what an admin route tells the person", () => {
	const t = testSite.createTranslator(errorMessages);
	const bodyOf = async (response: Response) => ((await response.json()) as ErrorBody).error;

	it("ADMIN-E1 answers with the text of the code and keeps the developer words as the detail", async () => {
		const error = await bodyOf(
			handleApiError(new CmsError("Cannot change status from trashed", "invalid_status"), testSite),
		);
		expect(error.message).toBe(t("invalid_status"));
		expect(error.detail).toBe("Cannot change status from trashed");
	});

	it("ADMIN-E1 tells what to do when the code has a fix", async () => {
		const error = await bodyOf(handleApiError(new CmsError("Conflict", "conflict", { serverVersion: 3 }), testSite));
		expect(error.message).toBe(t("conflict"));
		expect(error.fix).toBe(t("conflict.fix"));
		expect(error.details).toEqual({ serverVersion: 3 });
	});

	it("ADMIN-E1 prefers the notice the thrower wrote", async () => {
		const notice = { what: "The AI service didn't accept the key.", fix: "Check the key." };
		const error = await bodyOf(
			handleApiError(new CmsError("401 invalid x-api-key", "service_unavailable", { notice }), testSite),
		);
		expect(error).toMatchObject({ message: notice.what, fix: notice.fix, detail: "401 invalid x-api-key" });
	});

	it("ADMIN-E1 reads a notice from the core dictionary in the admin language, with its values", async () => {
		const n = testSite.createTranslator(noticeMessages);
		const vars = { extension: ".png" };
		const error = await bodyOf(
			handleApiError(
				new CmsError("Invalid file name", "invalid_input", { notice: { key: "media.rename.extension", vars } }),
				testSite,
			),
		);
		expect(error).toMatchObject({
			message: n("media.rename.extension", vars),
			fix: n("media.rename.extension.fix", vars),
			detail: "Invalid file name",
		});
	});

	it("ADMIN-E2 keeps an unknown error and a setup mistake out of the answer", async () => {
		vi.spyOn(console, "error").mockImplementation(() => {});
		const unknown = await bodyOf(handleApiError(new Error("relation cms_entries does not exist"), testSite));
		expect(unknown.message).toBe(t("internal_error"));
		expect(unknown.detail).toBeUndefined();
		const setup = await bodyOf(
			handleApiError(
				problemError({ what: "db.internal:5432 refused", fix: "start it" }, undefined, "database_unreachable"),
				testSite,
			),
		);
		expect(setup.message).toBe(t("database_unreachable"));
		expect(JSON.stringify(setup)).not.toContain("db.internal");
	});

	it("ADMIN-E1 gives the same text to a stream line or a batch item", () => {
		const text = cmsErrorText(testSite, new CmsError("Slug conflict", "slug_conflict"));
		expect(text).toEqual({ message: t("slug_conflict"), fix: t("slug_conflict.fix"), detail: "Slug conflict" });
	});
});
