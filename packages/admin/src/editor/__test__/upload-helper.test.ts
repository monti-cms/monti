import { afterEach, describe, expect, it, vi } from "vitest";
import { testSite } from "../../../../core/test/site";
import { errorText } from "../../api/client";
import { apiErrorMessages } from "../../api/error-message.messages";
import { markSandboxSite } from "../../screens/shared/preview-sandbox";
import { answer, fakeApi } from "../../test/fake-api";
import { editorMessages } from "../messages";
import { readBytes } from "../strip-location";
import { DEFAULT_OPTIMIZE_POLICY, imageAccept, prepareUpload, uploadImageFile } from "../upload-helper";

const t = testSite.createTranslator(editorMessages);
const file = () => new File(["x"], "a.png", { type: "image/png" });

describe("uploadImageFile", () => {
	afterEach(() => vi.unstubAllGlobals());

	it("MEDIA-U6 refuses to upload from a preview site, without any request", async () => {
		const api = fakeApi().install();
		const sandbox = markSandboxSite(Object.create(testSite) as typeof testSite);
		await expect(uploadImageFile(sandbox, file())).rejects.toThrow(
			testSite.createTranslator(apiErrorMessages)("previewNoWrite"),
		);
		expect(api.requests).toHaveLength(0);
	});

	it("MEDIA-E1 shows the upload's network message when the server cannot be reached", async () => {
		fakeApi()
			.on("POST /v1/media/uploads", () => {
				throw new TypeError("Failed to fetch");
			})
			.install();
		await expect(uploadImageFile(testSite, file())).rejects.toThrow(t("upload.networkError"));
	});

	it.each([
		["the storage cannot be reached", "onerror", "upload.networkError"],
		["the storage takes too long", "ontimeout", "upload.timeout"],
	] as const)("MEDIA-E1 says why when %s", async (_, event, message) => {
		fakeApi()
			.on("POST /v1/media/uploads", () => ({ mediaId: "m1", uploadUrl: "https://storage.test/put" }))
			.install();
		vi.stubGlobal(
			"XMLHttpRequest",
			class {
				upload = {};
				onerror?: () => void;
				ontimeout?: () => void;
				open() {}
				setRequestHeader() {}
				send() {
					queueMicrotask(() => this[event]?.());
				}
			},
		);
		const failure = await uploadImageFile(testSite, file()).catch((error: unknown) => error);
		// The screen shows the reason, not only its own fallback.
		expect(errorText(testSite, failure, "fallback")).toBe(t(message));
	});

	it("MEDIA-E1 shows the preparation failure message when the server refuses the upload", async () => {
		// A failure the server does not explain (no error body): the screen falls back to its own message.
		fakeApi()
			.on("POST /v1/media/uploads", () => answer(500, {}))
			.install();
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

	it("MEDIA-U1 builds the file input accept value from the allowed image types", () => {
		const types = ["image/png", "image/jpeg"];
		expect(imageAccept(siteAllowing(types)).split(",")).toEqual(types);
	});

	it("MEDIA-U3 keeps the original when the optimized output type is not allowed", async () => {
		const allowed = testSite.api.ALLOWED_IMAGE_MIME_TYPES.filter((m) => m !== DEFAULT_OPTIMIZE_POLICY.outputType);
		const png = new File(["x"], "a.png", { type: "image/png" });
		const result = await prepareUpload(siteAllowing(allowed), png);
		expect(result.optimized).toBe(false);
		expect(result.file).toBe(png);
		expect(result.skippedReason).toMatch(/\S/);
	});

	it("MEDIA-U1 refuses an image over the media size limit before any request", async () => {
		const api = fakeApi().install();
		const big = new File(["x"], "big.png", { type: "image/png" });
		Object.defineProperty(big, "size", { value: testSite.api.MAX_MEDIA_BYTES + 1 });
		await expect(uploadImageFile(testSite, big)).rejects.toThrow(
			t("upload.tooLarge", { mb: testSite.api.MAX_MEDIA_BYTES / 1024 / 1024 }),
		);
		expect(api.requests).toHaveLength(0);
	});
});

describe("location data never goes up", () => {
	const jpegWithGps = () => {
		// A JPEG with an Exif block holding only a GPS pointer to a GPS block with one entry.
		const tiff = new Uint8Array(64);
		const view = new DataView(tiff.buffer);
		tiff.set([0x49, 0x49]);
		view.setUint16(2, 42, true);
		view.setUint32(4, 8, true);
		view.setUint16(8, 1, true);
		view.setUint16(10, 0x8825, true);
		view.setUint16(12, 4, true);
		view.setUint32(14, 1, true);
		view.setUint32(18, 32, true);
		view.setUint16(32, 1, true);
		view.setUint16(34, 1, true);
		view.setUint16(36, 2, true);
		view.setUint32(38, 2, true);
		tiff[42] = 78;
		const exif = [0x45, 0x78, 0x69, 0x66, 0, 0, ...tiff];
		const length = exif.length + 2;
		return new Uint8Array([0xff, 0xd8, 0xff, 0xe1, length >> 8, length & 255, ...exif, 0xff, 0xd9]);
	};

	it("MEDIA-U4 removes the GPS tags from a file that is kept as it is, without changing its type or name", async () => {
		const photo = new File([jpegWithGps()], "walk.jpg", { type: "image/jpeg" });
		// The test browser cannot convert, so the photo goes up as it is: with its location removed.
		const prepared = await prepareUpload(testSite, photo);
		expect(prepared.optimized).toBe(false);
		expect(prepared.file).not.toBe(photo);
		expect(prepared.file.name).toBe("walk.jpg");
		expect(prepared.file.type).toBe("image/jpeg");
		expect(prepared.file.size).toBe(photo.size);
		const bytes = new Uint8Array(await readBytes(prepared.file));
		// The Exif block starts at byte 12; its first IFD (at +8) had one entry, the GPS pointer, and has none now.
		expect(new DataView(bytes.buffer).getUint16(20, true)).toBe(0);
	});
});
