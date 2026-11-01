import { beforeEach, describe, expect, it, vi } from "vitest";
import { testConfig } from "../../../../../../test/site";
import { fakeCms } from "../../../../../cms";
import { noticeMessages } from "../../../../../core/error-notice";
import type { NoticeKey } from "../../../../../core/store/errors";
import type { MessageVars } from "../../../../../i18n/define";
import { routeCaller } from "../../../../../testing";
import { renameProblem } from "../../media-files";
import { PATCH as handlePatchMediaHandler } from "../route";

const handlePatchMedia = routeCaller(handlePatchMediaHandler);

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
