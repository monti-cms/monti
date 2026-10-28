import { describe, expect, it, vi } from "vitest";
import { contentCollection } from "../../../../../test/any-site";
import { testConfig } from "../../../../../test/site";
import { fakeCms } from "../../../../cms";
import { CmsError } from "../../../../core/store";
import { routeCaller } from "../../../../testing";
import { GET as folderContentsHandler } from "../[id]/contents/route";
import { DELETE as deleteFolderHandler, PATCH as patchFolderHandler } from "../[id]/route";
import { GET as getFoldersHandler } from "../route";

const patchFolder = routeCaller(patchFolderHandler);
const deleteFolder = routeCaller(deleteFolderHandler);
const folderContents = routeCaller(folderContentsHandler);
const getFolders = routeCaller(getFoldersHandler);

const mockStore = {
	listFolders: vi
		.fn()
		.mockResolvedValue([{ id: "00000000-0000-4000-8000-000000000007", name: "Folder 1", version: 1 }]),
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
	it("GET /folders returns list", async () => {
		const req = new Request(`http://localhost/api/monti/v1/folders?collection=${contentCollection}`);
		const res = await getFolders(req, { cms });
		expect(res.status).toBe(200);
		const data = await res.json();
		expect(data[0].version).toBe(1);
	});

	it("PATCH /folders/:id rejects without expectedVersion with 428", async () => {
		const req = new Request("http://localhost/api/monti/v1/folders/00000000-0000-4000-8000-000000000007", {
			method: "PATCH",
			headers: { origin: "http://localhost", "content-type": "application/json" },
			body: JSON.stringify({ name: "Updated Name" }),
		});
		const res = await patchFolder(req, {
			params: Promise.resolve({ id: "00000000-0000-4000-8000-000000000007" }),
			cms,
		});
		expect(res.status).toBe(428);
		const data = await res.json();
		expect(data.error.code).toBe("version_required");
	});

	it("PATCH /folders/:id maps conflict to 409", async () => {
		const req = new Request("http://localhost/api/monti/v1/folders/00000000-0000-4000-8000-000000000007", {
			method: "PATCH",
			headers: { origin: "http://localhost", "content-type": "application/json" },
			body: JSON.stringify({ name: "Updated Name", expectedVersion: 1 }),
		});
		const res = await patchFolder(req, {
			params: Promise.resolve({ id: "00000000-0000-4000-8000-000000000007" }),
			cms,
		});
		expect(res.status).toBe(409);
		const data = await res.json();
		expect(data.error.code).toBe("conflict");
		expect(data.error.details.serverVersion).toBe(2);
	});

	it("GET /folders/:id/contents tells what the folder holds", async () => {
		const res = await folderContents(
			new Request("http://localhost/api/monti/v1/folders/00000000-0000-4000-8000-000000000007/contents"),
			{
				params: Promise.resolve({ id: "00000000-0000-4000-8000-000000000007" }),
				cms,
			},
		);
		expect(await res.json()).toEqual({ entries: 2, published: 1, folders: 1, files: 0, filesInUse: 0 });
	});

	it("DELETE /folders/:id moves the folder to the trash and answers with what went, without the event bookkeeping", async () => {
		const res = await deleteFolder(
			new Request("http://localhost/api/monti/v1/folders/00000000-0000-4000-8000-000000000007?expectedVersion=3", {
				method: "DELETE",
				headers: { origin: "http://localhost" },
			}),
			{ params: Promise.resolve({ id: "00000000-0000-4000-8000-000000000007" }), cms },
		);
		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({
			folder: { id: "00000000-0000-4000-8000-000000000007", name: "Folder 1" },
			entries: 2,
			folders: 1,
			files: 0,
			kept: 0,
		});
	});

	it("DELETE /folders/:id maps a stale version to 409 and needs a version", async () => {
		const target = { params: Promise.resolve({ id: "00000000-0000-4000-8000-000000000007" }), cms };
		const stale = await deleteFolder(
			new Request("http://localhost/api/monti/v1/folders/00000000-0000-4000-8000-000000000007?expectedVersion=1", {
				method: "DELETE",
				headers: { origin: "http://localhost" },
			}),
			target,
		);
		expect(stale.status).toBe(409);
		const missing = await deleteFolder(
			new Request("http://localhost/api/monti/v1/folders/00000000-0000-4000-8000-000000000007", {
				method: "DELETE",
				headers: { origin: "http://localhost" },
			}),
			target,
		);
		expect(missing.status).toBe(428);
	});
});
