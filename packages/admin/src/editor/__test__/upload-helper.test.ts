import { afterEach, describe, expect, it, vi } from "vitest";
import { testSite } from "../../../../core/test/site";
import { apiErrorMessages } from "../../api/error-message.messages";
import { markSandboxSite } from "../../screens/shared/preview-sandbox";
import { editorMessages } from "../messages";
import { DEFAULT_OPTIMIZE_POLICY, imageAccept, prepareUpload, uploadImageFile } from "../upload-helper";

const t = testSite.createTranslator(editorMessages);
const file = () => new File(["x"], "a.png", { type: "image/png" });

describe("uploadImageFile", () => {
	afterEach(() => vi.unstubAllGlobals());

	it("refuses to upload from a preview site, without any request", async () => {
		const fetchMock = vi.fn();
		vi.stubGlobal("fetch", fetchMock);
		const sandbox = markSandboxSite(Object.create(testSite) as typeof testSite);
		await expect(uploadImageFile(sandbox, file())).rejects.toThrow(
			testSite.createTranslator(apiErrorMessages)("previewNoWrite"),
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

/** The test site with a different set of allowed image types. */
const siteAllowing = (types: readonly string[]) =>
	Object.create(testSite, {
		api: {
			value: Object.create(testSite.api, {
				ALLOWED_IMAGE_MIME_TYPES: { value: types },
				isAllowedImage: { value: (mime: string) => types.includes(mime) },
			}),
		},
	}) as typeof testSite;

describe("image types and size follow the site", () => {
	afterEach(() => vi.unstubAllGlobals());

	it("builds the file input accept value from the allowed image types", () => {
		const types = ["image/png", "image/jpeg"];
		expect(imageAccept(siteAllowing(types)).split(",")).toEqual(types);
	});

	it("keeps the original when the optimized output type is not allowed", async () => {
		const allowed = testSite.api.ALLOWED_IMAGE_MIME_TYPES.filter((m) => m !== DEFAULT_OPTIMIZE_POLICY.outputType);
		const png = new File(["x"], "a.png", { type: "image/png" });
		const result = await prepareUpload(siteAllowing(allowed), png, { optimize: true });
		expect(result.optimized).toBe(false);
		expect(result.file).toBe(png);
		expect(result.skippedReason).toBeTruthy();
	});

	it("refuses an image over the media size limit before any request", async () => {
		const fetchMock = vi.fn();
		vi.stubGlobal("fetch", fetchMock);
		const big = new File(["x"], "big.png", { type: "image/png" });
		Object.defineProperty(big, "size", { value: testSite.api.MAX_MEDIA_BYTES + 1 });
		await expect(uploadImageFile(testSite, big)).rejects.toThrow(
			t("upload.tooLarge", { mb: testSite.api.MAX_MEDIA_BYTES / 1024 / 1024 }),
		);
		expect(fetchMock).not.toHaveBeenCalled();
	});
});
