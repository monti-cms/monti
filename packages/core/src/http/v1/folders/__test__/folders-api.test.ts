import { describe, expect, it, vi } from "vitest";
import { contentCollection, recordCollection } from "../../../../../test/any-site";
import { testConfig } from "../../../../../test/site";
import { fakeCms } from "../../../../cms";
import { CmsError } from "../../../../core/store";
import { routeCaller } from "../../../../testing";
import { PATCH as patchFolderHandler } from "../[id]/route";
import { POST as createFolderHandler, GET as getFoldersHandler } from "../route";

const patchFolder = routeCaller(patchFolderHandler);
const getFolders = routeCaller(getFoldersHandler);
const createFolder = routeCaller(createFolderHandler);

const mockStore = {
	listFolders: vi
		.fn()
		.mockResolvedValue([{ id: "00000000-0000-4000-8000-000000000007", name: "Folder 1", version: 1 }]),
	createFolder: vi.fn().mockImplementation((p) => Promise.resolve({ id: "f-new", version: 1, ...p })),
	updateFolder: vi.fn().mockImplementation((p) => {
		if (p.expectedVersion === 1) {
			throw new CmsError("Conflict", "conflict", 2);
		}
		return Promise.resolve({ id: p.id, version: p.expectedVersion + 1, name: p.name });
	}),
	deleteFolder: vi.fn().mockImplementation((p) => {
		if (p.expectedVersion === 1) {
			throw new CmsError("Conflict", "conflict", 2);
		}
		return Promise.resolve();
	}),
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

	it("GET /folders rejects collection without folders enabled with 400", async () => {
		const req = new Request(`http://localhost/api/monti/v1/folders?collection=${recordCollection}`);
		const res = await getFolders(req, { cms });
		expect(res.status).toBe(400);
		const data = await res.json();
		expect(data.error.code).toBe("invalid_input");
	});

	it("POST /folders rejects collection without folders enabled with 400", async () => {
		const req = new Request("http://localhost/api/monti/v1/folders", {
			method: "POST",
			headers: { origin: "http://localhost", "content-type": "application/json" },
			body: JSON.stringify({ collection: recordCollection, name: "Sub" }),
		});
		const res = await createFolder(req, { cms });
		expect(res.status).toBe(400);
		const data = await res.json();
		expect(data.error.code).toBe("invalid_input");
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
});
