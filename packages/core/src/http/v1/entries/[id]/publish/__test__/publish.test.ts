import { beforeEach, describe, expect, it, vi } from "vitest";
import { testConfig } from "../../../../../../../test/site";
import { AuthError } from "../../../../../../adapters/auth";
import { fakeCms } from "../../../../../../cms";
import { issueText, tellIssues } from "../../../../../../core/issue-text";
import { CmsError } from "../../../../../../core/store";
import { ServiceError } from "../../../../../../services/types";
import { routeCaller } from "../../../../../../testing";
import { POST as POSTHandler } from "../route";

const POST = routeCaller(POSTHandler);

const { verifyAdmin, publish } = vi.hoisted(() => ({
	verifyAdmin: vi.fn(),
	publish: vi.fn(),
}));

const cms = fakeCms({
	config: testConfig,
	store: {
		getTranslationGroup: async ({ entryId }: { entryId: string }) => ({ groupId: entryId, members: [] }),
	} as never,
	contentService: { publish },
	verifyAdmin: () => verifyAdmin(),
});

function request(body: unknown = { expectedVersion: 4 }, origin = "http://localhost") {
	return new Request("http://localhost/api/monti/v1/entries/00000000-0000-4000-8000-000000000011/publish", {
		method: "POST",
		headers: { origin, "content-type": "application/json" },
		body: JSON.stringify(body),
	});
}

const context = { params: Promise.resolve({ id: "00000000-0000-4000-8000-000000000011" }), cms };

describe("publish HTTP contract", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		verifyAdmin.mockResolvedValue({ isAdmin: true });
		publish.mockResolvedValue({
			entry: { id: "00000000-0000-4000-8000-000000000011", version: 5, status: "published" },
			warnings: [],
		});
	});

	it("WRITE-P2 returns warnings with a successful committed publish, each with its text and place", async () => {
		const warnings = [{ code: "image_media_not_ready", position: { line: 3, column: 2 } }];
		publish.mockResolvedValue({
			entry: { id: "00000000-0000-4000-8000-000000000011", version: 5, status: "published" },
			warnings,
		});
		const response = await POST(request(), context);
		expect(response.status).toBe(200);
		expect(await response.json()).toMatchObject({
			entry: { id: "00000000-0000-4000-8000-000000000011", status: "published" },
			warnings: tellIssues(cms.site, warnings),
		});
		expect(publish).toHaveBeenCalledWith({ id: "00000000-0000-4000-8000-000000000011", expectedVersion: 4 });
	});

	it("ignores a request publishedAt; the display date comes from the saved draft metadata", async () => {
		const response = await POST(request({ expectedVersion: 4, publishedAt: "2020-03-04T12:00:00.000Z" }), context);
		expect(response.status).toBe(200);
		expect(publish).toHaveBeenCalledWith({ id: "00000000-0000-4000-8000-000000000011", expectedVersion: 4 });
	});

	it("rejects a non-integer expectedVersion before publishing", async () => {
		const invalid = await POST(request({ expectedVersion: "4" }), context);
		expect(invalid.status).toBe(400);
		expect(publish).not.toHaveBeenCalled();
	});

	it("WRITE-P1 does not publish when validation fails, and tells each issue with its text next to its position", async () => {
		const issues = [
			{ code: "missing_field", path: "title", message: "제목" },
			{ code: "missing_block_attribute", path: "body", message: "src", position: { blockId: "b1" } },
		];
		publish.mockRejectedValue(new ServiceError("publish_validation_failed", issues));
		const response = await POST(request(), context);
		expect(response.status).toBe(422);
		const told = issues.map((issue) => ({ ...issue, ...issueText(cms.site, issue) }));
		expect(await response.json()).toMatchObject({ error: { code: "publish_validation_failed", issues: told } });
	});

	it("ADMIN-E1 tells a request value that does not check by its zod code, never in the library's words", async () => {
		const response = await POST(request({ expectedVersion: "4" }), context);
		const { error } = (await response.json()) as { error: { issues: { code: string; text: string }[] } };
		expect(error.issues[0]?.code).toBe("invalid_type");
		expect(error.issues[0]?.text).toBe(issueText(cms.site, { code: "invalid_type" }).text);
	});

	it("WRITE-H2 reports a failing hook with its own code and owner", async () => {
		publish.mockRejectedValue(
			new ServiceError("hook_failed", [{ code: "hook_failed", params: { hook: "transform", owner: "plugin:seo" } }]),
		);
		const response = await POST(request(), context);
		expect(response.status).toBe(500);
		expect(await response.json()).toMatchObject({
			error: {
				code: "hook_failed",
				issues: [{ params: { hook: "transform", owner: "plugin:seo" } }],
			},
		});
	});

	it("keeps optimistic version conflicts", async () => {
		publish.mockRejectedValue(new CmsError("Conflict", "conflict", { serverVersion: 7 }));
		const response = await POST(request(), context);
		expect(response.status).toBe(409);
		expect(await response.json()).toMatchObject({ error: { code: "conflict", details: { serverVersion: 7 } } });
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
