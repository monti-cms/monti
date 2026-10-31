import { beforeEach, describe, expect, it, vi } from "vitest";
import { testConfig } from "../../../../../../../test/site";
import { fakeCms } from "../../../../../../cms";
import { tellIssues } from "../../../../../../core/issue-text";
import { routeCaller } from "../../../../../../testing";
import { POST as POSTHandler } from "../route";

const POST = routeCaller(POSTHandler);

const { verifyAdmin, checkPublish } = vi.hoisted(() => ({ verifyAdmin: vi.fn(), checkPublish: vi.fn() }));

const cms = fakeCms({
	config: testConfig,
	contentService: { checkPublish },
	verifyAdmin: () => verifyAdmin(),
});

const id = "00000000-0000-4000-8000-000000000011";
const request = (origin = "http://localhost") =>
	new Request(`http://localhost/api/monti/v1/entries/${id}/check`, {
		method: "POST",
		headers: { origin, "content-type": "application/json" },
	});
const context = { params: Promise.resolve({ id }), cms };

describe("publish check HTTP contract", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		verifyAdmin.mockResolvedValue({ isAdmin: true });
	});

	it("WRITE-P1 answers the issues and warnings with their text and place", async () => {
		const issues = [{ code: "missing_field", path: "title", message: "Title" }];
		const warnings = [{ code: "image_media_not_ready", position: { line: 3, column: 2 } }];
		checkPublish.mockResolvedValue({ issues, warnings });
		const response = await POST(request(), context);
		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({
			issues: tellIssues(cms.site, issues),
			warnings: tellIssues(cms.site, warnings),
		});
		expect(checkPublish).toHaveBeenCalledWith({ id });
	});
});
