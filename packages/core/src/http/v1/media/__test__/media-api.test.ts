import { beforeEach, describe, expect, it, vi } from "vitest";
import { contentCollection, otherContentCollection } from "../../../../../test/any-site";
import { testConfig } from "../../../../../test/site";
import { AuthError } from "../../../../adapters/auth";
import { fakeCms } from "../../../../cms";
import { noticeMessages } from "../../../../core/error-notice";
import { CmsError, type NoticeKey } from "../../../../core/store/errors";
import type { MessageVars } from "../../../../i18n/define";
import { routeCaller } from "../../../../testing";
import { POST as handleCompleteHandler } from "../[id]/complete/route";
import { POST as handleReplaceHandler } from "../[id]/replace/route";
import { PATCH as handlePatchMediaHandler } from "../[id]/route";
import { renameProblem, typeNames } from "../media-files";
import { GET as handleListMediaHandler } from "../route";
import { POST as handleTrashMediaHandler } from "../trash/route";
import { POST as handleUploadsHandler } from "../uploads/route";

const handleComplete = routeCaller(handleCompleteHandler);
const handleReplace = routeCaller(handleReplaceHandler);
const handleTrashMedia = routeCaller(handleTrashMediaHandler);
const handlePatchMedia = routeCaller(handlePatchMediaHandler);
const handleListMedia = routeCaller(handleListMediaHandler);
const handleUploads = routeCaller(handleUploadsHandler);

const mockVerifyAdmin = vi.fn();

const mockCreateMediaAsset = vi.fn();
const mockGetMediaAsset = vi.fn();
const mockCompleteMediaAsset = vi.fn();
const mockFailMediaAsset = vi.fn();
const mockListMediaAssets = vi.fn();
const mockTrashMedia = vi.fn();
const mockFinalizeMediaDelete = vi.fn();
const mockUpdateMediaMetadata = vi.fn();
const mockReplaceMediaFile = vi.fn();

const mockPrepareUpload = vi.fn();
const mockHeadFile = vi.fn();
const mockReadFile = vi.fn();
const mockPromoteFile = vi.fn();
const mockDeleteFile = vi.fn();
const mockGetPublicUrl = vi.fn();
const mockDiscardUnusedMedia = vi.fn();
const mockListStaleUploads = vi.fn().mockResolvedValue([]);

const cms = fakeCms({
	config: testConfig,
	store: {
		createMediaAsset: mockCreateMediaAsset,
		getMediaAsset: mockGetMediaAsset,
		completeMediaAsset: mockCompleteMediaAsset,
		failMediaAsset: mockFailMediaAsset,
		listMediaAssets: mockListMediaAssets,
		trashMedia: mockTrashMedia,
		finalizeMediaDelete: mockFinalizeMediaDelete,
		updateMediaMetadata: mockUpdateMediaMetadata,
		replaceMediaFile: mockReplaceMediaFile,
		discardUnusedMedia: mockDiscardUnusedMedia,
		listStaleUploads: mockListStaleUploads,
	},
	mediaStore: {
		prepareUpload: mockPrepareUpload,
		headFile: mockHeadFile,
		readFile: mockReadFile,
		promoteFile: mockPromoteFile,
		deleteFile: mockDeleteFile,
		getPublicUrl: mockGetPublicUrl,
	},
	verifyAdmin: () => mockVerifyAdmin(),
});

/** What the person reads for a notice key in the answer: the `message`, and the `fix` when the key has one. */
const notice = (key: NoticeKey, vars?: MessageVars) => {
	const t = cms.site.createTranslator(noticeMessages);
	const fixKey = `${key}.fix`;
	return {
		message: t(key, vars),
		...(fixKey in noticeMessages.messages.en ? { fix: t(fixKey as NoticeKey, vars) } : {}),
	};
};

describe("Media Upload API Endpoints", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockVerifyAdmin.mockResolvedValue({ id: "admin-1", email: "admin@example.com" });
	});

	it("MEDIA-U7 POST /media/uploads rejects unauthenticated calls with 401", async () => {
		mockVerifyAdmin.mockRejectedValue(new AuthError("unauthorized", "Session required"));

		const req = new Request("http://localhost/api/monti/v1/media/uploads", {
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

		const res = await handleUploads(req, { cms });
		expect(res.status).toBe(401);
	});

	it("MEDIA-U2 POST /media/uploads rejects files larger than 10MiB (10485760 bytes)", async () => {
		const req = new Request("http://localhost/api/monti/v1/media/uploads", {
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

		const res = await handleUploads(req, { cms });
		expect(res.status).toBe(413);
		const limit = `${cms.site.api.MAX_MEDIA_BYTES / 1024 / 1024} MB`;
		expect((await res.json()).error).toMatchObject(notice("media.upload.size", { limit }));
	});

	it("MEDIA-U2 POST /media/uploads rejects disallowed MIME types (SVG, PDF, text)", async () => {
		const req = new Request("http://localhost/api/monti/v1/media/uploads", {
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

		const res = await handleUploads(req, { cms });
		expect(res.status).toBe(415);
		const types = typeNames([...cms.site.api.ALLOWED_IMAGE_MIME_TYPES, ...cms.site.api.ALLOWED_FILE_MIME_TYPES]);
		expect((await res.json()).error).toMatchObject(notice("media.upload.type", { types }));
	});

	it("MEDIA-U3 POST /media/uploads creates pending asset and returns presigned PUT URL", async () => {
		mockPrepareUpload.mockResolvedValue({
			url: "https://r2.example.com/staging/test?sig=123",
			method: "PUT",
			requiredHeaders: { "Content-Type": "image/png" },
			expiresAt: new Date("2026-09-21T12:10:00Z"),
		});

		const req = new Request("http://localhost/api/monti/v1/media/uploads", {
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

		const res = await handleUploads(req, { cms });
		expect(res.status).toBe(201);
		const json = await res.json();
		expect(json.mediaId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
		expect(json.uploadUrl).toBe("https://r2.example.com/staging/test?sig=123");
		expect(mockCreateMediaAsset).toHaveBeenCalledWith(
			expect.objectContaining({
				id: json.mediaId,
				stagingKey: `staging/${json.mediaId}.png`,
				filename: "test.png",
				mimeType: "image/png",
				byteSize: 2048,
			}),
		);
	});

	it("MEDIA-U2 POST /media/:id/complete returns 404 for nonexistent media asset", async () => {
		mockGetMediaAsset.mockResolvedValue(null);

		const req = new Request("http://localhost/api/monti/v1/media/00000000-0000-0000-0000-000000000000/complete", {
			method: "POST",
			headers: {
				origin: "http://localhost",
				host: "localhost",
				"content-type": "application/json",
			},
		});

		const res = await handleComplete(req, {
			params: Promise.resolve({ id: "00000000-0000-0000-0000-000000000000" }),
			cms,
		});
		expect(res.status).toBe(404);
	});

	it("MEDIA-U2 POST /media/:id/complete returns 409 if file not yet uploaded to staging", async () => {
		mockGetMediaAsset.mockResolvedValue({
			id: "00000000-0000-4000-8000-000000000009",
			status: "pending",
			stagingKey: "staging/00000000-0000-4000-8000-000000000009/pic.png",
			filename: "pic.png",
		});
		mockHeadFile.mockResolvedValue(null);

		const req = new Request("http://localhost/api/monti/v1/media/00000000-0000-4000-8000-000000000009/complete", {
			method: "POST",
			headers: {
				origin: "http://localhost",
				host: "localhost",
				"content-type": "application/json",
			},
		});

		const res = await handleComplete(req, {
			params: Promise.resolve({ id: "00000000-0000-4000-8000-000000000009" }),
			cms,
		});
		expect(res.status).toBe(409);
	});

	it("MEDIA-U2 POST /media/:id/complete verifies magic bytes, promotes to finalKey, and marks ready", async () => {
		mockGetMediaAsset.mockResolvedValue({
			id: "00000000-0000-4000-8000-000000000009",
			status: "pending",
			stagingKey: "staging/00000000-0000-4000-8000-000000000009/pic.png",
			filename: "pic.png",
		});
		mockHeadFile.mockResolvedValue({
			key: "staging/00000000-0000-4000-8000-000000000009/pic.png",
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
			key: "media/00000000-0000-4000-8000-000000000009/uuid.png",
			contentType: "image/png",
			contentLength: 24,
		});
		mockCompleteMediaAsset.mockResolvedValue({
			id: "00000000-0000-4000-8000-000000000009",
			status: "ready",
			storageKey: "media/00000000-0000-4000-8000-000000000009/uuid.png",
			mimeType: "image/png",
			byteSize: 24,
			width: 256,
			height: 256,
		});
		mockGetPublicUrl.mockReturnValue("https://media.example.com/media/00000000-0000-4000-8000-000000000009/uuid.png");

		const req = new Request("http://localhost/api/monti/v1/media/00000000-0000-4000-8000-000000000009/complete", {
			method: "POST",
			headers: {
				origin: "http://localhost",
				host: "localhost",
				"content-type": "application/json",
			},
		});

		const res = await handleComplete(req, {
			params: Promise.resolve({ id: "00000000-0000-4000-8000-000000000009" }),
			cms,
		});
		expect(res.status).toBe(200);
		const json = await res.json();
		expect(json.status).toBe("ready");
		expect(json.publicUrl).toBe("https://media.example.com/media/00000000-0000-4000-8000-000000000009/uuid.png");
		expect(json.width).toBe(256);
		expect(json.height).toBe(256);
		expect(mockPromoteFile).toHaveBeenCalled();
		expect(mockCompleteMediaAsset).toHaveBeenCalled();
	});

	it("MEDIA-U2 POST /media/:id/complete rejects images over 40 megapixels and marks the upload failed", async () => {
		mockGetMediaAsset.mockResolvedValue({
			id: "00000000-0000-4000-8000-000000000010",
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

		const req = new Request("http://localhost/api/monti/v1/media/00000000-0000-4000-8000-000000000010/complete", {
			method: "POST",
			headers: { origin: "http://localhost", host: "localhost", "content-type": "application/json" },
		});
		const res = await handleComplete(req, {
			params: Promise.resolve({ id: "00000000-0000-4000-8000-000000000010" }),
			cms,
		});
		expect(res.status).toBe(413);
		expect((await res.json()).error.code).toBe("too_many_pixels");
		expect(mockFailMediaAsset).toHaveBeenCalledWith("00000000-0000-4000-8000-000000000010");
		expect(mockPromoteFile).not.toHaveBeenCalled();
	});

	describe("completing an upload", () => {
		const id = "00000000-0000-4000-8000-000000000011";
		const png = () => {
			const bytes = new Uint8Array(24);
			bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0x0d, 0x49, 0x48, 0x44, 0x52], 0);
			bytes[18] = 0x01; // width 256
			bytes[22] = 0x01; // height 256
			return bytes;
		};
		const complete = () =>
			handleComplete(
				new Request(`http://localhost/api/monti/v1/media/${id}/complete`, {
					method: "POST",
					headers: { origin: "http://localhost", host: "localhost", "content-type": "application/json" },
				}),
				{ params: Promise.resolve({ id }), cms },
			);
		const pending = (extra: Record<string, unknown> = {}) =>
			mockGetMediaAsset.mockResolvedValue({
				id,
				status: "pending",
				stagingKey: `staging/${id}/pic.png`,
				filename: "pic.png",
				mimeType: "image/png",
				byteSize: 24,
				...extra,
			});

		beforeEach(() => {
			mockHeadFile.mockImplementation(async ({ key }: { key: string }) => ({
				key,
				contentType: "image/png",
				contentLength: 24,
				etag: `etag-${key}`,
			}));
			mockPromoteFile.mockResolvedValue({});
			mockCompleteMediaAsset.mockImplementation(async (input: Record<string, unknown>) => ({
				...input,
				status: "ready",
			}));
		});

		it("MEDIA-U2 refuses bytes that are not an image the site takes, marks the upload failed and promotes nothing", async () => {
			pending();
			mockReadFile.mockResolvedValue(new TextEncoder().encode("<svg xmlns='http://www.w3.org/2000/svg'/>"));
			const res = await complete();
			expect(res.status).toBe(415);
			expect((await res.json()).error.code).toBe("unsupported_media_type");
			expect(mockFailMediaAsset).toHaveBeenCalledWith(id);
			expect(mockPromoteFile).not.toHaveBeenCalled();
		});

		it("MEDIA-U3 promotes the original next to the web file and records it with its size", async () => {
			pending({ original: { stagingKey: `staging/${id}/pic-original.png`, mimeType: "image/png", byteSize: 24 } });
			mockReadFile.mockResolvedValue(png());
			expect((await complete()).status).toBe(200);
			expect(mockPromoteFile).toHaveBeenCalledWith(
				expect.objectContaining({ stagingKey: `staging/${id}/pic-original.png`, finalKey: `media/${id}-original.png` }),
			);
			expect(mockCompleteMediaAsset).toHaveBeenCalledWith(
				expect.objectContaining({
					original: {
						storageKey: `media/${id}-original.png`,
						mimeType: "image/png",
						byteSize: 24,
						width: 256,
						height: 256,
					},
				}),
			);
		});

		it("MEDIA-U2 refuses to complete an upload that already failed, and touches nothing", async () => {
			pending({ status: "failed" });
			const res = await complete();
			expect(res.status).toBe(409);
			expect(mockReadFile).not.toHaveBeenCalled();
			expect(mockPromoteFile).not.toHaveBeenCalled();
			expect(mockCompleteMediaAsset).not.toHaveBeenCalled();
		});
	});

	it("MEDIA-U3 POST /media/uploads creates the file in the folder it was dropped on", async () => {
		mockPrepareUpload.mockResolvedValue({
			url: "https://r2/upload",
			method: "PUT",
			requiredHeaders: {},
			expiresAt: new Date(),
		});
		mockCreateMediaAsset.mockResolvedValue({});
		const folderId = "00000000-0000-4000-8000-0000000000f1";
		const res = await handleUploads(
			new Request("http://localhost/api/monti/v1/media/uploads", {
				method: "POST",
				headers: { origin: "http://localhost", host: "localhost", "content-type": "application/json" },
				body: JSON.stringify({ filename: "photo.png", mimeType: "image/png", byteSize: 1000, folderId }),
			}),
			{ cms },
		);
		expect(res.status).toBe(201);
		expect(mockCreateMediaAsset).toHaveBeenCalledWith(expect.objectContaining({ folderId }));
	});

	it("MEDIA-U2 POST /media/uploads passes the declared size of each file to the upload ticket", async () => {
		mockPrepareUpload.mockResolvedValue({
			url: "https://r2/upload",
			method: "PUT",
			requiredHeaders: {},
			expiresAt: new Date(),
		});
		mockCreateMediaAsset.mockResolvedValue({});
		const req = new Request("http://localhost/api/monti/v1/media/uploads", {
			method: "POST",
			headers: { origin: "http://localhost", host: "localhost", "content-type": "application/json" },
			body: JSON.stringify({
				filename: "photo.jpg",
				mimeType: "image/webp",
				byteSize: 1000,
				original: { mimeType: "image/jpeg", byteSize: 5000 },
			}),
		});
		expect((await handleUploads(req, { cms })).status).toBe(201);
		expect(mockPrepareUpload).toHaveBeenCalledTimes(2);
		expect(mockPrepareUpload).toHaveBeenCalledWith(expect.objectContaining({ byteSize: 1000 }));
		expect(mockPrepareUpload).toHaveBeenCalledWith(expect.objectContaining({ byteSize: 5000 }));
	});

	it.each([
		["the file", { byteSize: 10, original: undefined }],
		["the original", { byteSize: 24, original: { stagingKey: "staging/o-original.png", byteSize: 10 } }],
	])("MEDIA-U2 POST /media/:id/complete fails the upload when the stored object is larger than the declared size of %s", async (_name, row) => {
		const id = "00000000-0000-4000-8000-000000000011";
		mockGetMediaAsset.mockResolvedValue({
			id,
			status: "pending",
			stagingKey: "staging/o.png",
			filename: "pic.png",
			mimeType: "image/png",
			...row,
		});
		// Every stored object is 24 bytes, whatever was declared.
		mockHeadFile.mockImplementation(async ({ key }: { key: string }) => ({
			key,
			contentType: "image/png",
			contentLength: 24,
			etag: "e",
		}));
		const png = new Uint8Array(24);
		png.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0x0d, 0x49, 0x48, 0x44, 0x52], 0);
		png[18] = 0x01;
		png[22] = 0x01;
		mockReadFile.mockResolvedValue(png);
		const req = new Request(`http://localhost/api/monti/v1/media/${id}/complete`, {
			method: "POST",
			headers: { origin: "http://localhost", host: "localhost", "content-type": "application/json" },
		});
		const res = await handleComplete(req, { params: Promise.resolve({ id }), cms });
		expect(res.status).toBeGreaterThanOrEqual(400);
		expect(mockFailMediaAsset).toHaveBeenCalledWith(id);
		expect(mockPromoteFile).not.toHaveBeenCalled();
	});

	it("MEDIA-U2 POST /media/:id/complete keeps an upload smaller than declared pending, so the client can finish it", async () => {
		const id = "00000000-0000-4000-8000-000000000012";
		mockGetMediaAsset.mockResolvedValue({
			id,
			status: "pending",
			stagingKey: "staging/o.png",
			filename: "pic.png",
			mimeType: "image/png",
			byteSize: 100,
		});
		mockHeadFile.mockImplementation(async ({ key }: { key: string }) => ({
			key,
			contentType: "image/png",
			contentLength: 24,
			etag: "e",
		}));
		mockFailMediaAsset.mockClear();
		const req = new Request(`http://localhost/api/monti/v1/media/${id}/complete`, {
			method: "POST",
			headers: { origin: "http://localhost", host: "localhost", "content-type": "application/json" },
		});
		const res = await handleComplete(req, { params: Promise.resolve({ id }), cms });
		expect((await res.json()).error.code).toBe("upload_incomplete");
		expect(mockFailMediaAsset).not.toHaveBeenCalled();
	});

	it("MEDIA-U3 POST /media/uploads prepares a second upload ticket for the original when optimised", async () => {
		mockPrepareUpload.mockResolvedValue({
			url: "https://r2/upload",
			method: "PUT",
			requiredHeaders: {},
			expiresAt: new Date(),
		});
		mockCreateMediaAsset.mockResolvedValue({});
		const req = new Request("http://localhost/api/monti/v1/media/uploads", {
			method: "POST",
			headers: { origin: "http://localhost", host: "localhost", "content-type": "application/json" },
			body: JSON.stringify({
				filename: "photo.jpg",
				mimeType: "image/webp",
				byteSize: 1000,
				original: { mimeType: "image/jpeg", byteSize: 5000 },
			}),
		});
		const res = await handleUploads(req, { cms });
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
					stagingKey: expect.stringMatching(/-original\.jpg$/),
				}),
			}),
		);
	});

	// --- Contract Tests ---

	it("MEDIA-B1 GET /media returns list of media items with references join", async () => {
		mockListMediaAssets.mockResolvedValue({
			items: [
				{
					id: "00000000-0000-4000-8000-000000000009",
					status: "ready",
					filename: "pic.png",
					mimeType: "image/png",
					byteSize: 1024,
					width: 800,
					height: 600,
					storageKey: "media/00000000-0000-4000-8000-000000000009/pic.png",
					publicUrl: "https://media.example.com/media/00000000-0000-4000-8000-000000000009/pic.png",
					createdAt: new Date(),
					referencesCount: 2,
					references: [
						{
							entryId: "00000000-0000-4000-8000-000000000011",
							title: "First Post",
							collection: contentCollection,
							state: "published",
						},
						{
							entryId: "00000000-0000-4000-8000-000000000012",
							title: "Draft Memo",
							collection: otherContentCollection ?? contentCollection,
							state: "working",
						},
					],
				},
			],
			total: 1,
			page: 1,
			pageSize: 25,
		});
		mockGetPublicUrl.mockReturnValue("https://media.example.com/media/00000000-0000-4000-8000-000000000009/pic.png");

		const req = new Request("http://localhost/api/monti/v1/media?search=pic&used=all", {
			method: "GET",
		});

		const res = await handleListMedia(req, { cms });
		expect(res.status).toBe(200);
		const json = await res.json();
		expect(json.total).toBe(1);
		expect(json.items[0].filename).toBe("pic.png");
		expect(json.items[0].referencesCount).toBe(2);
		expect(json.items[0].references[0].title).toBe("First Post");
	});

	it("MEDIA-B2 GET /media passes alt, folderId and includeDescendants to the store as typed values, and answers the counts", async () => {
		const folderId = "00000000-0000-4000-8000-0000000000f1";
		mockListMediaAssets.mockResolvedValue({
			items: [],
			total: 0,
			page: 1,
			pageSize: 25,
			kinds: { image: 4, file: 1 },
			alts: { none: 3, has: 1 },
		});
		const get = (query: string) => handleListMedia(new Request(`http://localhost/api/monti/v1/media${query}`), { cms });

		const res = await get(`?alt=none&folderId=${folderId}&includeDescendants=true&kind=image`);
		expect(res.status).toBe(200);
		expect(mockListMediaAssets).toHaveBeenCalledWith(
			expect.objectContaining({ alt: "none", folderId, includeDescendants: true, kind: "image" }),
		);
		expect(await res.json()).toMatchObject({ kinds: { image: 4, file: 1 }, alts: { none: 3, has: 1 } });

		await get("");
		expect(mockListMediaAssets).toHaveBeenLastCalledWith(expect.objectContaining({ alt: "all", kind: "all" }));
		expect(mockListMediaAssets.mock.lastCall?.[0].includeDescendants).not.toBe(true);

		expect((await get("?alt=maybe")).status).toBe(400);
	});

	it("TRASH-T5 POST /media/trash moves the files that nothing uses to the trash and reports the ones in use as kept", async () => {
		mockTrashMedia.mockResolvedValue({
			trashed: ["00000000-0000-4000-8000-000000000009"],
			kept: ["00000000-0000-4000-8000-00000000000a"],
		});
		const req = new Request("http://localhost/api/monti/v1/media/trash", {
			method: "POST",
			headers: { origin: "http://localhost", host: "localhost", "content-type": "application/json" },
			body: JSON.stringify({ ids: ["00000000-0000-4000-8000-000000000009", "00000000-0000-4000-8000-00000000000a"] }),
		});
		const res = await handleTrashMedia(req, { cms });
		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({
			trashed: ["00000000-0000-4000-8000-000000000009"],
			kept: ["00000000-0000-4000-8000-00000000000a"],
		});
		expect(mockTrashMedia).toHaveBeenCalledWith({
			ids: ["00000000-0000-4000-8000-000000000009", "00000000-0000-4000-8000-00000000000a"],
		});
		expect(mockDeleteFile).not.toHaveBeenCalled();
	});

	it("POST /media/trash rejects a body without ids", async () => {
		const req = new Request("http://localhost/api/monti/v1/media/trash", {
			method: "POST",
			headers: { origin: "http://localhost", host: "localhost", "content-type": "application/json" },
			body: JSON.stringify({ ids: [] }),
		});
		expect((await handleTrashMedia(req, { cms })).status).toBe(400);
	});

	it("TRASH-D1 has no DELETE /media/:id: a file is deleted for good only from the trash", async () => {
		const id = "00000000-0000-4000-8000-000000000009";
		const res = await cms.handle(
			new Request(`http://localhost/api/monti/v1/media/${id}`, {
				method: "DELETE",
				headers: { origin: "http://localhost" },
			}),
		);
		expect(res.status).toBe(405);
		expect(mockFinalizeMediaDelete).not.toHaveBeenCalled();
		expect(mockDeleteFile).not.toHaveBeenCalled();
	});
});

describe("attachment upload", () => {
	const post = (url: string, body?: unknown) =>
		new Request(url, {
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

	it("MEDIA-U5 accepts PDF, zip, and text files up to 50MiB, and rejects a type that differs from the extension or an oversized file", async () => {
		const upload = (body: unknown) => handleUploads(post("http://localhost/api/monti/v1/media/uploads", body), { cms });
		expect((await upload({ filename: "보고서.pdf", mimeType: "application/pdf", byteSize: 30_000_000 })).status).toBe(
			201,
		);
		expect((await upload({ filename: "main.ts", mimeType: "text/plain", byteSize: 100 })).status).toBe(201);
		const mismatch = await upload({ filename: "run.exe", mimeType: "text/plain", byteSize: 100 });
		expect(mismatch.status).toBe(415);
		expect((await mismatch.json()).error).toMatchObject(notice("media.upload.extension", { extension: ".exe" }));
		const noExtension = await upload({ filename: "README", mimeType: "text/plain", byteSize: 100 });
		expect((await noExtension.json()).error).toMatchObject(notice("media.upload.no_extension"));
		expect((await upload({ filename: "page.html", mimeType: "text/html", byteSize: 100 })).status).toBe(415);
		const big = await upload({ filename: "big.zip", mimeType: "application/zip", byteSize: 60_000_000 });
		expect(big.status).toBe(413);
		expect((await big.json()).error).toMatchObject(
			notice("media.upload.size", { limit: `${cms.site.api.MAX_FILE_BYTES / 1024 / 1024} MB` }),
		);
		expect(mockCreateMediaAsset).toHaveBeenCalledWith(
			expect.objectContaining({
				filename: "보고서.pdf",
				mimeType: "application/pdf",
				stagingKey: expect.stringMatching(/\.pdf$/),
			}),
		);
	});

	it("MEDIA-U5 on completion, verifies the actual content and stores it to download under the original name", async () => {
		mockGetMediaAsset.mockResolvedValue({
			id: "00000000-0000-4000-8000-000000000101",
			status: "pending",
			stagingKey: "staging/00000000-0000-4000-8000-000000000101/a.pdf",
			filename: "보고서.pdf",
			mimeType: "application/pdf",
		});
		mockHeadFile.mockResolvedValue({
			key: "staging/00000000-0000-4000-8000-000000000101/a.pdf",
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

		const res = await handleComplete(
			post("http://localhost/api/monti/v1/media/00000000-0000-4000-8000-000000000101/complete"),
			{
				params: Promise.resolve({ id: "00000000-0000-4000-8000-000000000101" }),
				cms,
			},
		);
		expect(res.status).toBe(200);
		expect(mockPromoteFile).toHaveBeenCalledWith(
			expect.objectContaining({
				contentType: "application/pdf",
				contentDisposition: `attachment; filename="___.pdf"; filename*=UTF-8''${encodeURIComponent("보고서.pdf")}`,
			}),
		);
		expect(mockCompleteMediaAsset).toHaveBeenCalledWith(expect.objectContaining({ width: null, height: null }));
	});

	it("MEDIA-U5 makes a binary uploaded as a text file unusable", async () => {
		mockGetMediaAsset.mockResolvedValue({
			id: "00000000-0000-4000-8000-000000000102",
			status: "pending",
			stagingKey: "staging/00000000-0000-4000-8000-000000000102/a.txt",
			filename: "notes.txt",
			mimeType: "text/plain",
		});
		mockHeadFile.mockResolvedValue({
			key: "staging/00000000-0000-4000-8000-000000000102/a.txt",
			contentType: "text/plain",
			contentLength: 4,
			etag: "e2",
		});
		mockReadFile.mockResolvedValue(new Uint8Array([0x4d, 0x5a, 0x00, 0x90]));

		const res = await handleComplete(
			post("http://localhost/api/monti/v1/media/00000000-0000-4000-8000-000000000102/complete"),
			{
				params: Promise.resolve({ id: "00000000-0000-4000-8000-000000000102" }),
				cms,
			},
		);
		expect(res.status).toBe(415);
		expect((await res.json()).error).toMatchObject(
			notice("media.upload.content_file", { type: typeNames(["text/plain"]) }),
		);
		expect(mockFailMediaAsset).toHaveBeenCalledWith("00000000-0000-4000-8000-000000000102");
	});

	describe("PATCH /media/:id file name", () => {
		const id = "00000000-0000-4000-8000-0000000000aa";
		const rename = (filename: string) =>
			handlePatchMedia(
				new Request(`http://localhost/api/monti/v1/media/${id}`, {
					method: "PATCH",
					headers: { origin: "http://localhost", host: "localhost", "content-type": "application/json" },
					body: JSON.stringify({ filename }),
				}),
				{ params: Promise.resolve({ id }), cms },
			);

		beforeEach(() => {
			mockGetMediaAsset.mockResolvedValue({ id, filename: "Photo.PNG", mimeType: "image/png", status: "ready" });
			mockUpdateMediaMetadata.mockResolvedValue({ id, filename: "sunset.PNG" });
		});

		it("MEDIA-B4 renames to a plain name that keeps the extension, ignoring the case of the extension", async () => {
			expect((await rename("sunset.png")).status).toBe(200);
			expect(mockUpdateMediaMetadata).toHaveBeenCalledWith({ id, filename: "sunset.png" });
		});

		it("MEDIA-B4 rejects a name that changes the extension, so the stored type cannot drift", async () => {
			const res = await rename("sunset.pdf");
			expect(res.status).toBe(400);
			const { error } = await res.json();
			expect(error.code).toBe("invalid_input");
			expect(error).toMatchObject(notice("media.rename.extension", { extension: ".png" }));
			expect(mockUpdateMediaMetadata).not.toHaveBeenCalled();
		});

		it.each([
			["a/b.png", "media.rename.slash"],
			["a\\b.png", "media.rename.slash"],
			["line\nbreak.png", "media.rename.slash"],
			["..", "media.rename.slash"],
			[".png", "media.rename.empty"],
			["  .png", "media.rename.empty"],
		] as const)("MEDIA-B4 rejects the name %j as it is not one plain name, and says why", async (name, key) => {
			const res = await rename(name);
			expect(res.status).toBe(400);
			expect((await res.json()).error).toMatchObject(notice(key));
			expect(mockUpdateMediaMetadata).not.toHaveBeenCalled();
		});

		it("MEDIA-B4 says a file without an extension cannot get one", () => {
			expect(renameProblem("README", "README.md")).toEqual({ key: "media.rename.no_extension" });
			expect(renameProblem("README", "NOTES")).toBeNull();
		});

		it("MEDIA-B4 answers 404 for a file that does not exist", async () => {
			mockGetMediaAsset.mockResolvedValue(null);
			expect((await rename("sunset.png")).status).toBe(404);
		});

		it("MEDIA-B4 leaves the default description edits alone: they do not read the file name", async () => {
			const res = await handlePatchMedia(
				new Request(`http://localhost/api/monti/v1/media/${id}`, {
					method: "PATCH",
					headers: { origin: "http://localhost", host: "localhost", "content-type": "application/json" },
					body: JSON.stringify({ defaultAlt: "A sunset" }),
				}),
				{ params: Promise.resolve({ id }), cms },
			);
			expect(res.status).toBe(200);
			expect(mockGetMediaAsset).not.toHaveBeenCalled();
		});
	});
});

describe("POST /media/:id/replace", () => {
	const id = "00000000-0000-4000-8000-0000000000a1";
	const fromId = "00000000-0000-4000-8000-0000000000a2";
	const asset = (assetId: string, mimeType: string, extra: Record<string, unknown> = {}) => ({
		id: assetId,
		status: "ready",
		filename: "photo.png",
		mimeType,
		...extra,
	});
	const replace = (body: unknown = { fromId }, target = id) =>
		handleReplace(
			new Request(`http://localhost/api/monti/v1/media/${target}/replace`, {
				method: "POST",
				headers: { origin: "http://localhost", host: "localhost", "content-type": "application/json" },
				body: JSON.stringify(body),
			}),
			{ params: Promise.resolve({ id: target }), cms },
		);

	beforeEach(() => {
		vi.clearAllMocks();
		mockVerifyAdmin.mockResolvedValue({ id: "admin-1", email: "admin@example.com" });
		mockDiscardUnusedMedia.mockResolvedValue(true);
		mockGetMediaAsset.mockImplementation(async (assetId: string) =>
			assetId === id ? asset(id, "image/png") : assetId === fromId ? asset(fromId, "image/webp") : null,
		);
		mockReplaceMediaFile.mockResolvedValue({
			media: {
				id,
				status: "ready",
				storageKey: `media/${fromId}.webp`,
				mimeType: "image/webp",
				byteSize: 2048,
				width: 20,
				height: 10,
				defaultAlt: "Kept alt",
				defaultCaption: "Kept caption",
			},
			released: { storageKey: `media/${id}.png`, originalStorageKey: `media/${id}-original.png` },
		});
		mockGetPublicUrl.mockImplementation((key: string) => `https://media.example.com/${key}`);
		mockDeleteFile.mockResolvedValue(undefined);
	});

	it("MEDIA-R4 moves the new file into the target, deletes the files it gave up, and answers like a completed upload", async () => {
		const res = await replace();
		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({
			mediaId: id,
			status: "ready",
			publicUrl: `https://media.example.com/media/${fromId}.webp`,
			width: 20,
			height: 10,
			byteSize: 2048,
			mimeType: "image/webp",
			defaultAlt: "Kept alt",
			defaultCaption: "Kept caption",
		});
		expect(mockReplaceMediaFile).toHaveBeenCalledWith({ id, fromId });
		expect(mockDeleteFile).toHaveBeenCalledTimes(2);
		expect(mockDeleteFile).toHaveBeenCalledWith(expect.objectContaining({ key: `media/${id}.png` }));
		expect(mockDeleteFile).toHaveBeenCalledWith(expect.objectContaining({ key: `media/${id}-original.png` }));
	});

	it("MEDIA-R4 does not delete a file the target did not have", async () => {
		mockReplaceMediaFile.mockResolvedValue({
			media: { id, status: "ready", storageKey: "media/new.webp", mimeType: "image/webp" },
			released: { storageKey: `media/${id}.png`, originalStorageKey: null },
		});
		expect((await replace()).status).toBe(200);
		expect(mockDeleteFile).toHaveBeenCalledTimes(1);
	});

	it("MEDIA-R4 still answers 200 when deleting an old file fails", async () => {
		mockDeleteFile.mockRejectedValue(new Error("storage down"));
		const res = await replace();
		expect(res.status).toBe(200);
		expect((await res.json()).mediaId).toBe(id);
		expect(mockDeleteFile).toHaveBeenCalledTimes(2);
	});

	it("MEDIA-R3 answers 404 for a target or a replacement that does not exist or is not ready", async () => {
		const other = "00000000-0000-4000-8000-0000000000a3";
		expect((await replace({ fromId }, other)).status).toBe(404);
		expect((await replace({ fromId: other })).status).toBe(404);
		mockGetMediaAsset.mockImplementation(async (assetId: string) =>
			assetId === id ? asset(id, "image/png") : asset(fromId, "image/webp", { status: "pending" }),
		);
		expect((await replace()).status).toBe(404);
		mockGetMediaAsset.mockImplementation(async (assetId: string) =>
			assetId === id ? asset(id, "image/png", { status: "trashed" }) : asset(fromId, "image/webp"),
		);
		expect((await replace()).status).toBe(404);
		expect(mockReplaceMediaFile).not.toHaveBeenCalled();
		expect(mockDeleteFile).not.toHaveBeenCalled();
	});

	it("MEDIA-R3 takes the replacement out of the library when the replace fails, so it does not stay as a file of its own", async () => {
		mockGetMediaAsset.mockImplementation(async (assetId: string) =>
			assetId === id ? asset(id, "image/png") : asset(fromId, "application/pdf"),
		);
		expect((await replace()).status).toBe(415);
		expect(mockDiscardUnusedMedia).toHaveBeenCalledWith(fromId);

		mockDiscardUnusedMedia.mockClear();
		mockGetMediaAsset.mockImplementation(async (assetId: string) =>
			assetId === id ? null : asset(fromId, "image/webp"),
		);
		expect((await replace()).status).toBe(404);
		expect(mockDiscardUnusedMedia).toHaveBeenCalledWith(fromId);

		// A failure of the store itself: the original error is the answer, even when taking the file out fails too.
		mockDiscardUnusedMedia.mockClear();
		mockDiscardUnusedMedia.mockRejectedValue(new Error("down"));
		mockGetMediaAsset.mockImplementation(async (assetId: string) =>
			assetId === id ? asset(id, "image/png") : asset(fromId, "image/webp"),
		);
		mockReplaceMediaFile.mockRejectedValueOnce(new Error("conflict"));
		expect((await replace()).status).toBe(500);
		expect(mockDiscardUnusedMedia).toHaveBeenCalledWith(fromId);
	});

	it("MEDIA-R3 keeps the replacement when the replace worked, and never discards the file itself", async () => {
		expect((await replace()).status).toBe(200);
		expect(mockDiscardUnusedMedia).not.toHaveBeenCalled();
		expect((await replace({ fromId: id })).status).toBe(400);
		expect(mockDiscardUnusedMedia).not.toHaveBeenCalled();
	});

	it("MEDIA-R2 answers 400 for the same file, or a body without a valid fromId", async () => {
		const same = await replace({ fromId: id });
		expect(same.status).toBe(400);
		expect((await same.json()).error.code).toBe("invalid_input");
		expect((await replace({})).status).toBe(400);
		expect((await replace({ fromId: "not-an-id" })).status).toBe(400);
		expect(mockReplaceMediaFile).not.toHaveBeenCalled();
	});

	it("MEDIA-R2 answers 415 with a notice when an image would be replaced by a file or the other way round", async () => {
		mockGetMediaAsset.mockImplementation(async (assetId: string) =>
			assetId === id ? asset(id, "image/png") : asset(fromId, "application/pdf"),
		);
		const res = await replace();
		expect(res.status).toBe(415);
		expect((await res.json()).error).toMatchObject({ code: "unsupported_media_type", ...notice("media.replace.kind") });

		mockGetMediaAsset.mockImplementation(async (assetId: string) =>
			assetId === id ? asset(id, "application/pdf") : asset(fromId, "image/png"),
		);
		expect((await replace()).status).toBe(415);
		expect(mockReplaceMediaFile).not.toHaveBeenCalled();
		expect(mockDeleteFile).not.toHaveBeenCalled();
	});

	it("MEDIA-R2 answers 415 with a notice when a file would be replaced by a file of another type", async () => {
		mockGetMediaAsset.mockImplementation(async (assetId: string) =>
			assetId === id ? asset(id, "application/pdf") : asset(fromId, "text/markdown"),
		);
		const res = await replace();
		expect(res.status).toBe(415);
		expect((await res.json()).error).toMatchObject(notice("media.replace.type"));
		expect(mockReplaceMediaFile).not.toHaveBeenCalled();
	});

	it("MEDIA-R2 replaces a file by a file of the same type", async () => {
		mockGetMediaAsset.mockImplementation(async (assetId: string) =>
			assetId === id ? asset(id, "application/pdf") : asset(fromId, "application/pdf"),
		);
		expect((await replace()).status).toBe(200);
		expect(mockReplaceMediaFile).toHaveBeenCalledWith({ id, fromId });
	});

	it("MEDIA-R3 keeps the old files when the store refuses, and shows its error", async () => {
		mockReplaceMediaFile.mockRejectedValue(new CmsError("The replacement media asset is in use", "conflict"));
		expect((await replace()).status).toBe(409);
		expect(mockDeleteFile).not.toHaveBeenCalled();
	});

	it("MEDIA-U7 rejects unauthenticated calls with 401", async () => {
		mockVerifyAdmin.mockRejectedValue(new AuthError("unauthorized", "Session required"));
		expect((await replace()).status).toBe(401);
		expect(mockReplaceMediaFile).not.toHaveBeenCalled();
	});
});
