import { describe, expect, it, vi } from "vitest";
import { validateMediaConfig } from "../media-types";

vi.mock("../../config/resolved", async (importOriginal) => {
	const original = await importOriginal<typeof import("../../config/resolved")>();
	return {
		...original,
		cmsConfig: {
			...original.cmsConfig,
			media: {
				maxImageBytes: 2048,
				maxPixels: 100,
				maxFileBytes: 4096,
				imageTypes: ["image/png"],
				fileTypes: ["application/pdf"],
			},
		},
	};
});

describe("M17-4 미디어 설정", () => {
	it("한도·형식을 사이트 설정에서 읽는다", async () => {
		const api = await import("../api");
		expect(api.MAX_MEDIA_BYTES).toBe(2048);
		expect(api.MAX_MEDIA_PIXELS).toBe(100);
		expect(api.MAX_FILE_BYTES).toBe(4096);
		expect(api.ALLOWED_IMAGE_MIME_TYPES).toEqual(["image/png"]);
		expect(api.ALLOWED_FILE_MIME_TYPES).toEqual(["application/pdf"]);
		expect(api.FILE_ACCEPT).toBe(".pdf");
		expect(api.fileTypeFor("a.pdf")).toBe("application/pdf");
		expect(api.fileTypeFor("a.zip")).toBeNull();
	});

	it("설정에서 뺀 형식은 업로드 요청에서 거절한다", async () => {
		const { mediaUploadBodySchema } = await import("../api");
		const base = { filename: "a", byteSize: 10 };
		expect(mediaUploadBodySchema.safeParse({ ...base, mimeType: "image/png" }).success).toBe(true);
		expect(mediaUploadBodySchema.safeParse({ ...base, mimeType: "image/jpeg" }).success).toBe(false);
		expect(mediaUploadBodySchema.safeParse({ ...base, filename: "a.pdf", mimeType: "application/pdf" }).success).toBe(
			true,
		);
		expect(mediaUploadBodySchema.safeParse({ ...base, filename: "a.zip", mimeType: "application/zip" }).success).toBe(
			false,
		);
	});

	it("잘못된 설정은 오류다", () => {
		expect(() => validateMediaConfig(undefined)).not.toThrow();
		expect(() => validateMediaConfig({ maxImageBytes: 0 })).toThrow(/maxImageBytes/);
		expect(() => validateMediaConfig({ maxPixels: 1.5 })).toThrow(/maxPixels/);
		expect(() => validateMediaConfig({ imageTypes: ["image/svg+xml" as "image/png"] })).toThrow(/unsupported/);
		expect(() => validateMediaConfig({ fileTypes: ["text/html" as "text/plain"] })).toThrow(/unsupported/);
		expect(() => validateMediaConfig({ imageTypes: [] })).toThrow(/empty/);
		expect(() => validateMediaConfig({ fileTypes: [] })).not.toThrow();
	});
});
