import { beforeEach, describe, expect, it, vi } from "vitest";
import { testConfig } from "../../../../../../test/site";
import { fakeCms } from "../../../../../cms";
import { routeCaller } from "../../../../../testing";
import { POST as handleTrashMediaHandler } from "../route";

const handleTrashMedia = routeCaller(handleTrashMediaHandler);

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
describe("Media Upload API Endpoints", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockVerifyAdmin.mockResolvedValue({ id: "admin-1", email: "admin@example.com" });
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
});
