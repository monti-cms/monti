import { describe, expect, it, vi } from "vitest";
import { createS3MediaStore, detectImageDimensionsAndType } from "../media-store";

describe("R2 MediaStore (Unit & Contract)", () => {
	it("detectImageDimensionsAndType detects PNG signatures and dimensions", () => {
		// Minimum valid PNG header: 8-byte signature + 4-byte chunk len + 4-byte 'IHDR' + 4-byte width + 4-byte height
		const buf = new Uint8Array(24);
		buf.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
		buf.set([0x00, 0x00, 0x00, 0x0d], 8);
		buf.set([0x49, 0x48, 0x44, 0x52], 12);
		// width = 800 (0x0320)
		buf[16] = 0x00;
		buf[17] = 0x00;
		buf[18] = 0x03;
		buf[19] = 0x20;
		// height = 600 (0x0258)
		buf[20] = 0x00;
		buf[21] = 0x00;
		buf[22] = 0x02;
		buf[23] = 0x58;

		const result = detectImageDimensionsAndType(buf);
		expect(result).not.toBeNull();
		expect(result?.mimeType).toBe("image/png");
		expect(result?.width).toBe(800);
		expect(result?.height).toBe(600);
	});

	it("detectImageDimensionsAndType rejects non-image or corrupted files", () => {
		const buf = new Uint8Array([1, 2, 3, 4, 5]);
		const result = detectImageDimensionsAndType(buf);
		expect(result).toBeNull();
	});

	it("detectImageDimensionsAndType rejects corrupted image stubs without real dimensions", () => {
		// JPEG stub: SOI + APP0 marker with no SOF markers
		const jpegStub = new Uint8Array([
			0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01,
		]);
		expect(detectImageDimensionsAndType(jpegStub)).toBeNull();

		// WebP stub: RIFF....WEBP with unknown/empty chunk
		const webpStub = new Uint8Array([
			0x52, 0x49, 0x46, 0x46, 0x20, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50, 0x00, 0x00, 0x00, 0x00,
		]);
		expect(detectImageDimensionsAndType(webpStub)).toBeNull();

		// AVIF stub: ftypavif header with no ispe box
		const avifStub = new Uint8Array([
			0x00, 0x00, 0x00, 0x1c, 0x66, 0x74, 0x79, 0x70, 0x61, 0x76, 0x69, 0x66, 0x00, 0x00, 0x00, 0x00,
		]);
		expect(detectImageDimensionsAndType(avifStub)).toBeNull();
	});

	it("detectImageDimensionsAndType detects valid JPEG with SOF0 marker", () => {
		// JPEG: FF D8 FF + SOF0 marker (FF C0) with len 11, precision 8, height 600 (0x0258), width 800 (0x0320)
		const jpeg = new Uint8Array([
			0xff, 0xd8, 0xff, 0xc0, 0x00, 0x0b, 0x08, 0x02, 0x58, 0x03, 0x20, 0x03, 0x01, 0x11, 0x00, 0x02,
		]);
		const result = detectImageDimensionsAndType(jpeg);
		expect(result).toEqual({
			mimeType: "image/jpeg",
			width: 800,
			height: 600,
		});
	});

	it("detectImageDimensionsAndType detects valid WebP VP8 lossy dimensions", () => {
		// WebP RIFF .... WEBP VP8 (lossy): at 26-29 width 800, height 600
		const buf = new Uint8Array(32);
		buf.set([0x52, 0x49, 0x46, 0x46], 0); // RIFF
		buf.set([0x57, 0x45, 0x42, 0x50], 8); // WEBP
		buf.set([0x56, 0x50, 0x38, 0x20], 12); // VP8_
		const view = new DataView(buf.buffer);
		view.setUint16(26, 800, true);
		view.setUint16(28, 600, true);

		const result = detectImageDimensionsAndType(buf);
		expect(result).toEqual({
			mimeType: "image/webp",
			width: 800,
			height: 600,
		});
	});

	it("detectImageDimensionsAndType detects valid AVIF with ispe box", () => {
		const buf = new Uint8Array(32);
		// ftypavif at 4-11
		buf.set([0x66, 0x74, 0x79, 0x70, 0x61, 0x76, 0x69, 0x66], 4);
		// ispe box at 12
		buf.set([0x69, 0x73, 0x70, 0x65], 12);
		const view = new DataView(buf.buffer);
		view.setUint32(20, 1920, false); // width
		view.setUint32(24, 1080, false); // height

		const result = detectImageDimensionsAndType(buf);
		expect(result).toEqual({
			mimeType: "image/avif",
			width: 1920,
			height: 1080,
		});
	});

	it("prepareUpload rejects disallowed mime types like SVG or PDF", async () => {
		const store = createS3MediaStore({
			accessKeyId: "test-key",
			secretAccessKey: "test-sec",
			bucket: "test-bucket",
			endpoint: "https://test.r2.cloudflarestorage.com",
			publicBaseUrl: "https://media.example.com",
		});

		await expect(
			store.prepareUpload({
				stagingKey: "staging/test.svg",
				// @ts-expect-error testing runtime validation
				contentType: "image/svg+xml",
				expiresInSeconds: 600,
			}),
		).rejects.toThrow(/disallowed|unsupported/i);
	});

	it("getPublicUrl constructs canonical URL from finalKey", () => {
		const store = createS3MediaStore({
			accessKeyId: "test-key",
			secretAccessKey: "test-sec",
			bucket: "test-bucket",
			endpoint: "https://test.r2.cloudflarestorage.com",
			publicBaseUrl: "https://media.example.com",
		});

		expect(store.getPublicUrl("media/asset-123.webp")).toBe("https://media.example.com/media/asset-123.webp");
		expect(store.getPublicUrl("/media/asset-123.webp")).toBe("https://media.example.com/media/asset-123.webp");
	});

	it("promoteFile passes CopySourceIfMatch when expectedEtag is provided", async () => {
		const store = createS3MediaStore({
			accessKeyId: "test-key",
			secretAccessKey: "test-sec",
			bucket: "test-bucket",
			endpoint: "https://test.r2.cloudflarestorage.com",
			publicBaseUrl: "https://media.example.com",
		});

		const sentCommands: unknown[] = [];
		const _s3Client = (store as unknown as { s3?: { send: (cmd: unknown) => Promise<unknown> } }).s3;
		// @ts-expect-error accessing private client for unit test
		store.s3 = {
			send: vi.fn(async (cmd: unknown) => {
				sentCommands.push(cmd);
				return { ContentType: "image/png", ContentLength: 100, ETag: '"promoted-etag"' };
			}),
		};

		// Test promoteFile using S3Client.prototype.send spy
		const { S3Client, CopyObjectCommand } = await import("@aws-sdk/client-s3");
		const sendSpy = vi.spyOn(S3Client.prototype, "send").mockImplementation(async (cmd: unknown) => {
			sentCommands.push(cmd);
			return { ContentType: "image/png", ContentLength: 100, ETag: '"promoted-etag"' } as never;
		});

		try {
			await store.promoteFile({
				stagingKey: "staging/test.png",
				finalKey: "media/test.png",
				expectedEtag: '"staging-etag-123"',
				contentType: "image/png",
			});

			const copyCmd = sentCommands.find((c) => c instanceof CopyObjectCommand) as InstanceType<
				typeof CopyObjectCommand
			>;
			expect(copyCmd).toBeDefined();
			expect(copyCmd.input.CopySourceIfMatch).toBe('"staging-etag-123"');
		} finally {
			sendSpy.mockRestore();
		}
	});
});
