import { describe, expect, it, vi } from "vitest";
import { createS3MediaStore } from "../media-store";

describe("S3 media store", () => {
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
