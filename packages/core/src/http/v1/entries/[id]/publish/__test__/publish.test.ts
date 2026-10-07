import { beforeEach, describe, expect, it, vi } from "vitest";
import { testConfig } from "../../../../../../../test/site";
import { AuthError } from "../../../../../../adapters/auth";
import { fakeCms } from "../../../../../../cms";
import { CmsError } from "../../../../../../core/store";
import { ServiceError } from "../../../../../../services/types";
import { POST } from "../route";

const { verifyAdmin, publish, imageWarningsForSnapshot, getMediaAsset } = vi.hoisted(() => ({
	verifyAdmin: vi.fn(),
	publish: vi.fn(),
	imageWarningsForSnapshot: vi.fn(),
	getMediaAsset: vi.fn(),
}));

const cms = fakeCms({
	config: testConfig,
	contentService: { publish },
	store: { getMediaAsset },
	mediaStore: { headFile: vi.fn() },
	verifyAdmin: () => verifyAdmin(),
});

vi.mock("../../../../../../core/snapshot", () => ({ imageWarningsForSnapshot }));

function request(body: unknown = { expectedVersion: 4 }, origin = "http://localhost") {
	return new Request("http://localhost/api/cms/v1/entries/entry-1/publish", {
		method: "POST",
		headers: { origin, "content-type": "application/json" },
		body: JSON.stringify(body),
	});
}

const context = { params: Promise.resolve({ id: "entry-1" }), cms };

describe("publish HTTP contract", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		verifyAdmin.mockResolvedValue({ isAdmin: true });
		publish.mockResolvedValue({ entry: { id: "entry-1", version: 5, status: "published" }, warnings: [] });
	});

	it("returns warnings with a successful committed publish", async () => {
		const warnings = [{ code: "image_media_not_ready", position: { line: 3, column: 2 } }];
		publish.mockResolvedValue({ entry: { id: "entry-1", version: 5, status: "published" }, warnings });
		const response = await POST(request(), context);
		expect(response.status).toBe(200);
		expect(await response.json()).toMatchObject({ id: "entry-1", status: "published", warnings });
		expect(publish).toHaveBeenCalledWith({ id: "entry-1", expectedVersion: 4 }, expect.anything());
	});

	it("computes the image warnings from the snapshot the pipeline prepared", async () => {
		const snapshot = { collection: "post" };
		imageWarningsForSnapshot.mockResolvedValue([]);
		await POST(request(), context);
		const { extraWarnings } = publish.mock.calls[0][1];
		await extraWarnings(snapshot);
		expect(imageWarningsForSnapshot).toHaveBeenCalledWith(
			snapshot,
			expect.objectContaining({ getMediaAsset: expect.any(Function), headStorageKey: expect.any(Function) }),
		);
	});

	it("ignores a request publishedAt; the display date comes from the saved draft metadata", async () => {
		const response = await POST(request({ expectedVersion: 4, publishedAt: "2020-03-04T12:00:00.000Z" }), context);
		expect(response.status).toBe(200);
		expect(publish).toHaveBeenCalledWith({ id: "entry-1", expectedVersion: 4 }, expect.anything());
	});

	it("rejects a non-integer expectedVersion before publishing", async () => {
		const invalid = await POST(request({ expectedVersion: "4" }), context);
		expect(invalid.status).toBe(400);
		expect(publish).not.toHaveBeenCalled();
	});

	it("does not publish when validation fails", async () => {
		const issues = [{ code: "missing_field", path: "title", message: "제목" }];
		publish.mockRejectedValue(new ServiceError("publish_validation_failed", issues));
		const response = await POST(request(), context);
		expect(response.status).toBe(422);
		expect(await response.json()).toMatchObject({ code: "publish_validation_failed", issues });
	});

	it("reports a failing hook with its own code and owner", async () => {
		publish.mockRejectedValue(
			new ServiceError("hook_failed", [{ code: "hook_failed", params: { hook: "transform", owner: "plugin:seo" } }]),
		);
		const response = await POST(request(), context);
		expect(response.status).toBe(500);
		expect(await response.json()).toMatchObject({
			code: "hook_failed",
			issues: [{ params: { hook: "transform", owner: "plugin:seo" } }],
		});
	});

	it("keeps optimistic version conflicts", async () => {
		publish.mockRejectedValue(new CmsError("Conflict", "conflict", 7));
		const response = await POST(request(), context);
		expect(response.status).toBe(409);
		expect(await response.json()).toMatchObject({ code: "conflict", serverVersion: 7 });
	});

	it("requires expectedVersion before any publish", async () => {
		const response = await POST(request({}), context);
		expect(response.status).toBe(428);
		expect(publish).not.toHaveBeenCalled();
	});

	it("blocks unauthorized and cross-origin requests before reads and writes", async () => {
		verifyAdmin.mockRejectedValueOnce(new AuthError("unauthorized", "Not logged in"));
		const unauthorized = await POST(request(), context);
		expect(unauthorized.status).toBe(401);
		const crossOrigin = await POST(request({ expectedVersion: 4 }, "http://attacker.invalid"), context);
		expect(crossOrigin.status).toBe(403);
		expect(publish).not.toHaveBeenCalled();
	});
});
