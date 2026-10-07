import { describe, expect, it, vi } from "vitest";
import { contentCollection } from "../../../../../test/any-site";
import { testConfig } from "../../../../../test/site";
import { fakeCms } from "../../../../cms";
import { CmsError } from "../../../../core/store";
import { PATCH as patchFolder } from "../[id]/route";
import { GET as getFolders } from "../route";

const mockStore = {
	listFolders: vi.fn().mockResolvedValue([{ id: "f-1", name: "Folder 1", version: 1 }]),
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
		const req = new Request(`http://localhost/api/cms/v1/folders?collection=${contentCollection}`);
		const res = await getFolders(req, { cms });
		expect(res.status).toBe(200);
		const data = await res.json();
		expect(data[0].version).toBe(1);
	});

	it("PATCH /folders/:id rejects without expectedVersion with 428", async () => {
		const req = new Request("http://localhost/api/cms/v1/folders/f-1", {
			method: "PATCH",
			headers: { origin: "http://localhost", "content-type": "application/json" },
			body: JSON.stringify({ name: "Updated Name" }),
		});
		const res = await patchFolder(req, { params: Promise.resolve({ id: "f-1" }), cms });
		expect(res.status).toBe(428);
		const data = await res.json();
		expect(data.code).toBe("version_required");
	});

	it("PATCH /folders/:id maps conflict to 409", async () => {
		const req = new Request("http://localhost/api/cms/v1/folders/f-1", {
			method: "PATCH",
			headers: { origin: "http://localhost", "content-type": "application/json" },
			body: JSON.stringify({ name: "Updated Name", expectedVersion: 1 }),
		});
		const res = await patchFolder(req, { params: Promise.resolve({ id: "f-1" }), cms });
		expect(res.status).toBe(409);
		const data = await res.json();
		expect(data.code).toBe("conflict");
		expect(data.serverVersion).toBe(2);
	});
});
