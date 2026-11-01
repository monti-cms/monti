import { describe, expect, it, vi } from "vitest";
import { contentCollection } from "../../../../../test/any-site";
import { testConfig } from "../../../../../test/site";
import { fakeCms } from "../../../../cms";
import { CmsError } from "../../../../core/store";
import { routeCaller } from "../../../../testing";
import { GET as folderContentsHandler } from "../[id]/contents/route";
import { DELETE as deleteFolderHandler, PATCH as patchFolderHandler } from "../[id]/route";
import { GET as getFoldersHandler } from "../route";

const _patchFolder = routeCaller(patchFolderHandler);
const _deleteFolder = routeCaller(deleteFolderHandler);
const _folderContents = routeCaller(folderContentsHandler);
const getFolders = routeCaller(getFoldersHandler);

const folders = [{ id: "00000000-0000-4000-8000-000000000007", name: "Folder 1", version: 1 }];

const mockStore = {
	listFolders: vi.fn().mockResolvedValue(folders),
	createFolder: vi.fn().mockImplementation((p) => Promise.resolve({ id: "f-new", version: 1, ...p })),
	updateFolder: vi.fn().mockImplementation((p) => {
		if (p.expectedVersion === 1) {
			throw new CmsError("Conflict", "conflict", { serverVersion: 2 });
		}
		return Promise.resolve({ id: p.id, version: p.expectedVersion + 1, name: p.name });
	}),
	trashFolder: vi.fn().mockImplementation((p) => {
		if (p.expectedVersion === 1) {
			throw new CmsError("Conflict", "conflict", { serverVersion: 2 });
		}
		return Promise.resolve({
			folder: { id: p.id, name: "Folder 1" },
			entries: 2,
			folders: 1,
			files: 0,
			kept: 0,
			entryIds: ["e1"],
		});
	}),
	getFolderContents: vi.fn().mockResolvedValue({ entries: 2, published: 1, folders: 1, files: 0, filesInUse: 0 }),
};

const cms = fakeCms({ config: testConfig, store: mockStore });

describe("Folders HTTP API Contract", () => {
	it("LIST-F6 GET /folders lists the folders of the collection it names", async () => {
		const req = new Request(`http://localhost/api/monti/v1/folders?collection=${contentCollection}`);
		const res = await getFolders(req, { cms });
		expect(res.status).toBe(200);
		expect(mockStore.listFolders).toHaveBeenCalledWith({ collection: contentCollection });
		expect(await res.json()).toEqual(folders);
	});
});
