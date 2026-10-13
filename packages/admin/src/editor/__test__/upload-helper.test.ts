import { afterEach, describe, expect, it, vi } from "vitest";
import { testSite } from "../../../../core/test/site";
import { screensMessages } from "../../screens/messages";
import { markSandboxSite } from "../../screens/shared/preview-sandbox";
import { editorMessages } from "../messages";
import { uploadImageFile } from "../upload-helper";

const t = testSite.createTranslator(editorMessages);
const file = () => new File(["x"], "a.png", { type: "image/png" });

describe("uploadImageFile", () => {
	afterEach(() => vi.unstubAllGlobals());

	it("refuses to upload from a preview site, without any request", async () => {
		const fetchMock = vi.fn();
		vi.stubGlobal("fetch", fetchMock);
		const sandbox = markSandboxSite(Object.create(testSite) as typeof testSite);
		await expect(uploadImageFile(sandbox, file())).rejects.toThrow(
			testSite.createTranslator(screensMessages)("api.previewNoWrite"),
		);
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it("shows the upload's network message when the server cannot be reached", async () => {
		vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
		await expect(uploadImageFile(testSite, file())).rejects.toThrow(t("upload.networkError"));
	});

	it("shows the preparation failure message when the server refuses the upload", async () => {
		vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({}), { status: 500 })));
		await expect(uploadImageFile(testSite, file())).rejects.toThrow(t("upload.prepareFailed"));
	});
});
