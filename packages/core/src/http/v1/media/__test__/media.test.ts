import { beforeEach, describe, expect, it, vi } from "vitest";
import { contentCollection, otherContentCollection } from "../../../../../test/any-site";
import { testConfig } from "../../../../../test/site";
import { fakeCms } from "../../../../cms";
import { routeCaller } from "../../../../testing";
import { GET as handleListMediaHandler } from "../route";

const handleListMedia = routeCaller(handleListMediaHandler);

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
});
