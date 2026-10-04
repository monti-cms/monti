import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthError } from "../../../../adapters/auth";
import { CmsError } from "../../../../adapters/postgres/content-store";
import { POST as handleComplete } from "../[id]/complete/route";
import { DELETE as handleDeleteMedia } from "../[id]/route";
import { GET as handleListMedia } from "../route";
import { POST as handleUploads } from "../uploads/route";

const mockVerifyAdmin = vi.fn();

vi.mock("../../../../adapters/auth", () => ({
	authGateway: {
		verifyAdmin: () => mockVerifyAdmin(),
	},
	AuthError: class AuthError extends Error {
		constructor(
			public code: string,
			message: string,
		) {
			super(message);
		}
	},
}));

const mockCreateMediaAsset = vi.fn();
const mockGetMediaAsset = vi.fn();
const mockCompleteMediaAsset = vi.fn();
const mockFailMediaAsset = vi.fn();
const mockListMediaAssets = vi.fn();
const mockBeginMediaDelete = vi.fn();
const mockFinalizeMediaDelete = vi.fn();

const mockPrepareUpload = vi.fn();
const mockHeadFile = vi.fn();
const mockReadFile = vi.fn();
const mockPromoteFile = vi.fn();
const mockDeleteFile = vi.fn();
const mockGetPublicUrl = vi.fn();

vi.mock("../../../../container", () => ({
	getCmsContentStore: () => ({
		createMediaAsset: mockCreateMediaAsset,
		getMediaAsset: mockGetMediaAsset,
		completeMediaAsset: mockCompleteMediaAsset,
		failMediaAsset: mockFailMediaAsset,
		listMediaAssets: mockListMediaAssets,
		beginMediaDelete: mockBeginMediaDelete,
		finalizeMediaDelete: mockFinalizeMediaDelete,
	}),
	getCmsMediaStore: () => ({
		prepareUpload: mockPrepareUpload,
		headFile: mockHeadFile,
		readFile: mockReadFile,
		promoteFile: mockPromoteFile,
		deleteFile: mockDeleteFile,
		getPublicUrl: mockGetPublicUrl,
	}),
}));

describe("Media Upload API Endpoints", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockVerifyAdmin.mockResolvedValue({ id: "admin-1", email: "admin@example.com" });
	});

	it("POST /media/uploads rejects unauthenticated calls with 401", async () => {
		mockVerifyAdmin.mockRejectedValue(new AuthError("unauthorized", "Session required"));

		const req = new NextRequest("http://localhost/api/cms/v1/media/uploads", {
			method: "POST",
			headers: {
				origin: "http://localhost",
				host: "localhost",
				"content-type": "application/json",
			},
			body: JSON.stringify({
				filename: "test.png",
				mimeType: "image/png",
				byteSize: 1024,
			}),
		});

		const res = await handleUploads(req);
		expect(res.status).toBe(401);
	});

	it("POST /media/uploads rejects files larger than 10MiB (10485760 bytes)", async () => {
		const req = new NextRequest("http://localhost/api/cms/v1/media/uploads", {
			method: "POST",
			headers: {
				origin: "http://localhost",
				host: "localhost",
				"content-type": "application/json",
			},
			body: JSON.stringify({
				filename: "giant.png",
				mimeType: "image/png",
				byteSize: 10485761,
			}),
		});

		const res = await handleUploads(req);
		expect(res.status).toBe(413);
	});

	it("POST /media/uploads rejects disallowed MIME types (SVG, PDF, text)", async () => {
		const req = new NextRequest("http://localhost/api/cms/v1/media/uploads", {
			method: "POST",
			headers: {
				origin: "http://localhost",
				host: "localhost",
				"content-type": "application/json",
			},
			body: JSON.stringify({
				filename: "danger.svg",
				mimeType: "image/svg+xml",
				byteSize: 2048,
			}),
		});

		const res = await handleUploads(req);
		expect(res.status).toBe(415);
	});

	it("POST /media/uploads creates pending asset and returns presigned PUT URL", async () => {
		mockPrepareUpload.mockResolvedValue({
			url: "https://r2.example.com/staging/test?sig=123",
			method: "PUT",
			requiredHeaders: { "Content-Type": "image/png" },
			expiresAt: new Date("2026-09-21T12:10:00Z"),
		});

		const req = new NextRequest("http://localhost/api/cms/v1/media/uploads", {
			method: "POST",
			headers: {
				origin: "http://localhost",
				host: "localhost",
				"content-type": "application/json",
			},
			body: JSON.stringify({
				filename: "test.png",
				mimeType: "image/png",
				byteSize: 2048,
			}),
		});

		const res = await handleUploads(req);
		expect(res.status).toBe(201);
		const json = await res.json();
		expect(json.mediaId).toBeDefined();
		expect(json.uploadUrl).toBe("https://r2.example.com/staging/test?sig=123");
		expect(mockCreateMediaAsset).toHaveBeenCalledWith(
			expect.objectContaining({
				filename: "test.png",
				mimeType: "image/png",
				byteSize: 2048,
			}),
		);
	});

	it("POST /media/:id/complete returns 404 for nonexistent media asset", async () => {
		mockGetMediaAsset.mockResolvedValue(null);

		const req = new NextRequest("http://localhost/api/cms/v1/media/00000000-0000-0000-0000-000000000000/complete", {
			method: "POST",
			headers: {
				origin: "http://localhost",
				host: "localhost",
				"content-type": "application/json",
			},
		});

		const res = await handleComplete(req, {
			params: Promise.resolve({ id: "00000000-0000-0000-0000-000000000000" }),
		});
		expect(res.status).toBe(404);
	});

	it("POST /media/:id/complete returns 409 if file not yet uploaded to staging", async () => {
		mockGetMediaAsset.mockResolvedValue({
			id: "media-1",
			status: "pending",
			stagingKey: "staging/media-1/pic.png",
			filename: "pic.png",
		});
		mockHeadFile.mockResolvedValue(null);

		const req = new NextRequest("http://localhost/api/cms/v1/media/media-1/complete", {
			method: "POST",
			headers: {
				origin: "http://localhost",
				host: "localhost",
				"content-type": "application/json",
			},
		});

		const res = await handleComplete(req, {
			params: Promise.resolve({ id: "media-1" }),
		});
		expect(res.status).toBe(409);
	});

	it("POST /media/:id/complete verifies magic bytes, promotes to finalKey, and marks ready", async () => {
		mockGetMediaAsset.mockResolvedValue({
			id: "media-1",
			status: "pending",
			stagingKey: "staging/media-1/pic.png",
			filename: "pic.png",
		});
		mockHeadFile.mockResolvedValue({
			key: "staging/media-1/pic.png",
			contentType: "image/png",
			contentLength: 24,
			etag: "etag-123",
		});

		// Valid 24-byte PNG
		const pngBytes = new Uint8Array(24);
		pngBytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
		pngBytes.set([0x00, 0x00, 0x00, 0x0d], 8);
		pngBytes.set([0x49, 0x48, 0x44, 0x52], 12);
		pngBytes[18] = 0x01; // width = 256
		pngBytes[22] = 0x01; // height = 256

		mockReadFile.mockResolvedValue(pngBytes);
		mockPromoteFile.mockResolvedValue({
			key: "media/media-1/uuid.png",
			contentType: "image/png",
			contentLength: 24,
		});
		mockCompleteMediaAsset.mockResolvedValue({
			id: "media-1",
			status: "ready",
			storageKey: "media/media-1/uuid.png",
			mimeType: "image/png",
			byteSize: 24,
			width: 256,
			height: 256,
		});
		mockGetPublicUrl.mockReturnValue("https://media.example.com/media/media-1/uuid.png");

		const req = new NextRequest("http://localhost/api/cms/v1/media/media-1/complete", {
			method: "POST",
			headers: {
				origin: "http://localhost",
				host: "localhost",
				"content-type": "application/json",
			},
		});

		const res = await handleComplete(req, {
			params: Promise.resolve({ id: "media-1" }),
		});
		expect(res.status).toBe(200);
		const json = await res.json();
		expect(json.status).toBe("ready");
		expect(json.publicUrl).toBe("https://media.example.com/media/media-1/uuid.png");
		expect(json.width).toBe(256);
		expect(json.height).toBe(256);
		expect(mockPromoteFile).toHaveBeenCalled();
		expect(mockCompleteMediaAsset).toHaveBeenCalled();
	});

	it("POST /media/:id/complete rejects images over 40 megapixels and marks the upload failed", async () => {
		mockGetMediaAsset.mockResolvedValue({
			id: "media-2",
			status: "pending",
			stagingKey: "staging/huge.png",
			filename: "huge.png",
		});
		mockHeadFile.mockResolvedValue({ key: "staging/huge.png", contentType: "image/png", contentLength: 24, etag: "e" });
		const pngBytes = new Uint8Array(24);
		pngBytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0x0d, 0x49, 0x48, 0x44, 0x52], 0);
		pngBytes.set([0x00, 0x00, 0x27, 0x10], 16); // width 10000
		pngBytes.set([0x00, 0x00, 0x13, 0x88], 20); // height 5000 → 50MP
		mockReadFile.mockResolvedValue(pngBytes);

		const req = new NextRequest("http://localhost/api/cms/v1/media/media-2/complete", {
			method: "POST",
			headers: { origin: "http://localhost", host: "localhost", "content-type": "application/json" },
		});
		const res = await handleComplete(req, { params: Promise.resolve({ id: "media-2" }) });
		expect(res.status).toBe(413);
		expect((await res.json()).code).toBe("too_many_pixels");
		expect(mockFailMediaAsset).toHaveBeenCalledWith("media-2");
		expect(mockPromoteFile).not.toHaveBeenCalled();
	});

	it("POST /media/uploads prepares a second upload ticket for the original when optimised", async () => {
		mockPrepareUpload.mockResolvedValue({
			url: "https://r2/upload",
			method: "PUT",
			requiredHeaders: {},
			expiresAt: new Date(),
		});
		mockCreateMediaAsset.mockResolvedValue({});
		const req = new NextRequest("http://localhost/api/cms/v1/media/uploads", {
			method: "POST",
			headers: { origin: "http://localhost", host: "localhost", "content-type": "application/json" },
			body: JSON.stringify({
				filename: "photo.jpg",
				mimeType: "image/webp",
				byteSize: 1000,
				original: { mimeType: "image/jpeg", byteSize: 5000 },
			}),
		});
		const res = await handleUploads(req);
		expect(res.status).toBe(201);
		const body = await res.json();
		expect(body.original.uploadUrl).toBe("https://r2/upload");
		expect(mockPrepareUpload).toHaveBeenCalledTimes(2);
		expect(mockCreateMediaAsset).toHaveBeenCalledWith(
			expect.objectContaining({
				mimeType: "image/webp",
				stagingKey: expect.stringMatching(/\.webp$/),
				original: expect.objectContaining({
					mimeType: "image/jpeg",
					stagingKey: expect.stringMatching(/original-.*\.jpg$/),
				}),
			}),
		);
	});

	// --- M4-BE-MEDIA-1 Contract Tests ---

	it("GET /media returns list of media items with references join", async () => {
		mockListMediaAssets.mockResolvedValue({
			items: [
				{
					id: "media-1",
					status: "ready",
					filename: "pic.png",
					mimeType: "image/png",
					byteSize: 1024,
					width: 800,
					height: 600,
					storageKey: "media/media-1/pic.png",
					publicUrl: "https://media.example.com/media/media-1/pic.png",
					createdAt: new Date(),
					referencesCount: 2,
					references: [
						{ entryId: "entry-1", title: "First Post", collection: "post", state: "published" },
						{ entryId: "entry-2", title: "Draft Memo", collection: "memo", state: "working" },
					],
				},
			],
			total: 1,
			page: 1,
			pageSize: 25,
		});
		mockGetPublicUrl.mockReturnValue("https://media.example.com/media/media-1/pic.png");

		const req = new NextRequest("http://localhost/api/cms/v1/media?search=pic&used=all", {
			method: "GET",
		});

		const res = await handleListMedia(req);
		expect(res.status).toBe(200);
		const json = await res.json();
		expect(json.total).toBe(1);
		expect(json.items[0].filename).toBe("pic.png");
		expect(json.items[0].referencesCount).toBe(2);
		expect(json.items[0].references[0].title).toBe("First Post");
	});

	it("DELETE /media/:id rejects deletion with 409 if media is in use", async () => {
		mockGetMediaAsset.mockResolvedValue({
			id: "media-1",
			status: "ready",
			storageKey: "media/media-1/pic.png",
			filename: "pic.png",
		});
		mockBeginMediaDelete.mockRejectedValue(new CmsError("Media asset is in use", "in_use"));

		const req = new NextRequest("http://localhost/api/cms/v1/media/media-1", {
			method: "DELETE",
			headers: {
				origin: "http://localhost",
				host: "localhost",
			},
		});

		const res = await handleDeleteMedia(req, {
			params: Promise.resolve({ id: "media-1" }),
		});
		expect(res.status).toBe(409);
		const json = await res.json();
		expect(json.code).toBe("in_use");
		expect(mockDeleteFile).not.toHaveBeenCalled();
		expect(mockFinalizeMediaDelete).not.toHaveBeenCalled();
	});

	it("DELETE /media/:id safely deletes unused media from R2 storage and DB", async () => {
		mockBeginMediaDelete.mockResolvedValue({
			id: "media-1",
			status: "deleting",
			storageKey: "media/media-1/pic.png",
			stagingKey: "staging/media-1/pic.png",
			original: null,
			filename: "pic.png",
		});
		mockFinalizeMediaDelete.mockResolvedValue(undefined);

		const req = new NextRequest("http://localhost/api/cms/v1/media/media-1", {
			method: "DELETE",
			headers: {
				origin: "http://localhost",
				host: "localhost",
			},
		});

		const res = await handleDeleteMedia(req, {
			params: Promise.resolve({ id: "media-1" }),
		});
		expect(res.status).toBe(200);
		const json = await res.json();
		expect(json.success).toBe(true);
		expect(mockDeleteFile).toHaveBeenCalledWith({ key: "media/media-1/pic.png" });
		expect(mockFinalizeMediaDelete).toHaveBeenCalledWith("media-1");
	});

	it("DELETE /media/:id keeps the deleting record when storage deletion fails so it can be retried", async () => {
		mockBeginMediaDelete.mockResolvedValue({
			id: "media-1",
			status: "deleting",
			storageKey: "media/media-1/pic.png",
			stagingKey: null,
			original: null,
			filename: "pic.png",
		});
		mockDeleteFile.mockRejectedValue(new Error("R2 unavailable"));

		const req = new NextRequest("http://localhost/api/cms/v1/media/media-1", {
			method: "DELETE",
			headers: { origin: "http://localhost", host: "localhost" },
		});
		const res = await handleDeleteMedia(req, { params: Promise.resolve({ id: "media-1" }) });
		expect(res.status).toBe(500);
		expect(mockFinalizeMediaDelete).not.toHaveBeenCalled();
	});
});

describe("첨부 파일 업로드(v3)", () => {
	const post = (url: string, body?: unknown) =>
		new NextRequest(url, {
			method: "POST",
			headers: { origin: "http://localhost", host: "localhost", "content-type": "application/json" },
			...(body ? { body: JSON.stringify(body) } : {}),
		});

	beforeEach(() => {
		vi.clearAllMocks();
		mockVerifyAdmin.mockResolvedValue({ id: "admin-1", email: "admin@example.com" });
		mockPrepareUpload.mockResolvedValue({
			url: "https://r2.example.com/staging",
			method: "PUT",
			requiredHeaders: {},
			expiresAt: new Date("2026-10-01T00:10:00Z"),
		});
	});

	it("PDF·zip·글자 파일을 50MiB까지 받고, 확장자와 형식이 다르거나 크면 거절한다", async () => {
		const upload = (body: unknown) => handleUploads(post("http://localhost/api/cms/v1/media/uploads", body));
		expect((await upload({ filename: "보고서.pdf", mimeType: "application/pdf", byteSize: 30_000_000 })).status).toBe(
			201,
		);
		expect((await upload({ filename: "main.ts", mimeType: "text/plain", byteSize: 100 })).status).toBe(201);
		expect((await upload({ filename: "run.exe", mimeType: "text/plain", byteSize: 100 })).status).toBe(415);
		expect((await upload({ filename: "page.html", mimeType: "text/html", byteSize: 100 })).status).toBe(415);
		expect((await upload({ filename: "big.zip", mimeType: "application/zip", byteSize: 60_000_000 })).status).toBe(413);
		expect(mockCreateMediaAsset).toHaveBeenCalledWith(
			expect.objectContaining({
				filename: "보고서.pdf",
				mimeType: "application/pdf",
				stagingKey: expect.stringMatching(/\.pdf$/),
			}),
		);
	});

	it("완료할 때 실제 내용을 확인하고 원래 이름으로 내려받게 저장한다", async () => {
		mockGetMediaAsset.mockResolvedValue({
			id: "file-1",
			status: "pending",
			stagingKey: "staging/file-1/a.pdf",
			filename: "보고서.pdf",
			mimeType: "application/pdf",
		});
		mockHeadFile.mockResolvedValue({
			key: "staging/file-1/a.pdf",
			contentType: "application/pdf",
			contentLength: 2048,
			etag: "e1",
		});
		mockReadFile.mockResolvedValue(new TextEncoder().encode("%PDF-1.7\n..."));
		mockCompleteMediaAsset.mockImplementation(async (input) => ({
			...input,
			status: "ready",
			defaultAlt: "",
			defaultCaption: "",
		}));
		mockGetPublicUrl.mockReturnValue("https://cdn.example/file.pdf");

		const res = await handleComplete(post("http://localhost/api/cms/v1/media/file-1/complete"), {
			params: Promise.resolve({ id: "file-1" }),
		});
		expect(res.status).toBe(200);
		expect(mockPromoteFile).toHaveBeenCalledWith(
			expect.objectContaining({
				contentType: "application/pdf",
				contentDisposition: `attachment; filename="___.pdf"; filename*=UTF-8''${encodeURIComponent("보고서.pdf")}`,
			}),
		);
		expect(mockCompleteMediaAsset).toHaveBeenCalledWith(expect.objectContaining({ width: null, height: null }));
	});

	it("글자 파일이라고 올린 바이너리는 사용할 수 없게 한다", async () => {
		mockGetMediaAsset.mockResolvedValue({
			id: "file-2",
			status: "pending",
			stagingKey: "staging/file-2/a.txt",
			filename: "notes.txt",
			mimeType: "text/plain",
		});
		mockHeadFile.mockResolvedValue({
			key: "staging/file-2/a.txt",
			contentType: "text/plain",
			contentLength: 4,
			etag: "e2",
		});
		mockReadFile.mockResolvedValue(new Uint8Array([0x4d, 0x5a, 0x00, 0x90]));

		const res = await handleComplete(post("http://localhost/api/cms/v1/media/file-2/complete"), {
			params: Promise.resolve({ id: "file-2" }),
		});
		expect(res.status).toBe(415);
		expect(mockFailMediaAsset).toHaveBeenCalledWith("file-2");
	});
});
