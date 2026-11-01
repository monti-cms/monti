import { beforeEach, describe, expect, it, vi } from "vitest";
import { testConfig } from "../../../../../test/site";
import { AuthError } from "../../../../adapters/auth";
import { fakeCms } from "../../../../cms";
import { routeCaller } from "../../../../testing";
import { GET as getMetaHandler } from "../route";

const getMeta = routeCaller(getMetaHandler);

const readFeatures = async (cms = fakeCms()) => {
	const res = await getMeta(new Request("http://localhost/api/monti/v1/meta"), { cms });
	expect(res.status).toBe(200);
	return (await res.json()).features as Record<string, boolean | Record<string, boolean>>;
};

describe("GET /v1/meta features.media", () => {
	it("MEDIA-U6 is true when the server config has media storage", async () => {
		expect((await readFeatures(fakeCms({ mediaStore: {} }))).media).toBe(true);
	});

	it("PLUG-S5 puts plugin features under the plugin name, next to the core ones", async () => {
		const features = await readFeatures(
			fakeCms({ plugins: [{ name: "ai", features: async () => ({ ready: true }) }] }),
		);
		expect(features.ai).toEqual({ ready: true });
		expect(features.media).toBe(false);
		expect(features.ready).toBeUndefined();
	});
});

describe("GET /v1/meta folders and templates", () => {
	const readMeta = async (cms: unknown) =>
		(await getMeta(new Request("http://localhost/api/monti/v1/meta"), { cms: cms as never })).json();

	it("LIST-F6 gives a collection its kind's default unless its schema says otherwise", async () => {
		const meta = await readMeta(fakeCms({ config: testConfig }));
		for (const name of meta.collections as string[]) {
			const explicit = meta.schemas[name].folders;
			const kind = meta.definitions[name].kind;
			expect(meta.definitions[name].folders).toBe(explicit ?? kind === "document");
		}
	});
});

describe("HTTP API Contract (Updated with Security & Atomic Folders)", () => {
	const mockVerifyAdmin = vi.fn();
	const cms = fakeCms({ config: testConfig, verifyAdmin: () => mockVerifyAdmin() });

	beforeEach(() => {
		mockVerifyAdmin.mockReset();
		mockVerifyAdmin.mockResolvedValue({ userId: "123", accountId: "123", isAdmin: true });
	});

	it("API-G1 returns 401 when user is unauthorized", async () => {
		mockVerifyAdmin.mockRejectedValue(new AuthError("unauthorized", "Not logged in"));
		const res = await getMeta(new Request("http://localhost/api/monti/v1/meta"), { cms });
		expect(res.status).toBe(401);
		const data = await res.json();
		expect(data.error.code).toBe("unauthorized");
	});

	it("API-G1 returns 403 when user is forbidden", async () => {
		mockVerifyAdmin.mockRejectedValue(new AuthError("forbidden", "Wrong admin id"));
		const res = await getMeta(new Request("http://localhost/api/monti/v1/meta"), { cms });
		expect(res.status).toBe(403);
		const data = await res.json();
		expect(data.error.code).toBe("forbidden");
	});
});
