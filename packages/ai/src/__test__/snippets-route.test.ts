import { fakeCms, routeCaller } from "@monti-cms/core/testing";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { testConfig } from "../../test/site";
import {
	DELETE as DELETEHandler,
	GET as GETHandler,
	PATCH as PATCHHandler,
	POST as POSTHandler,
	PUT as PUTHandler,
} from "../routes/snippets/route";

const DELETE = routeCaller(DELETEHandler);
const GET = routeCaller(GETHandler);
const PATCH = routeCaller(PATCHHandler);
const POST = routeCaller(POSTHandler);
const PUT = routeCaller(PUTHandler);

/** A store holding the prompt snippet rows and action overrides. A version mismatch gives 409. */
const state = vi.hoisted(() => ({
	snippets: null as { value: unknown; version: number } | null,
	overrides: [] as Array<{ key: string; value: unknown; version: number }>,
}));

vi.mock("../store", async () => {
	const { CmsError } = await import("@monti-cms/core/server");
	return {
		aiStoreFor: () => ({
			getAiSettings: async () => state.snippets,
			saveAiSettings: async ({ expectedVersion, value }: { expectedVersion: number; value: unknown }) => {
				const version = state.snippets?.version ?? 0;
				if (version !== expectedVersion) throw new CmsError("Conflict", "conflict", { serverVersion: version });
				state.snippets = { value, version: version + 1 };
				return version + 1;
			},
			listAiActionOverrides: async () => state.overrides.map((row) => ({ ...row, updatedAt: new Date(0) })),
			listAiCustomActions: async () => [],
		}),
	};
});

const cms = fakeCms({ config: testConfig });

const call = (
	handler: (request: Request, context: { cms: typeof cms }) => Promise<Response>,
	method: string,
	body?: unknown,
	query = "",
) =>
	handler(
		new Request(`http://localhost/api/monti/v1/ai/snippets${query}`, {
			method,
			headers: { origin: "http://localhost", "content-type": "application/json" },
			...(body === undefined ? {} : { body: JSON.stringify(body) }),
		}),
		{ cms },
	);

describe("prompt snippets API", () => {
	beforeEach(() => {
		state.snippets = null;
		state.overrides = [];
	});

	it("the list separates config texts and added texts by `source`", async () => {
		const added = await call(POST, "POST", { expectedVersion: 0, key: "tone", label: "말투", text: "정중하게" });
		expect(added.status).toBe(201);
		const res = await call(GET, "GET");
		expect(await res.json()).toEqual({
			version: 1,
			items: [
				{ source: "config", key: "styleGuide", label: "문체 가이드", defaultText: "", text: "", overridden: false },
				{ source: "added", key: "tone", label: "말투", text: "정중하게" },
			],
		});
	});

	it("single and bulk edits and deletion check the version", async () => {
		await call(POST, "POST", { expectedVersion: 0, key: "tone", label: "말투", text: "" });
		const patched = await call(PATCH, "PATCH", { expectedVersion: 1, key: "tone", label: "어조", text: "짧게" });
		expect(await patched.json()).toMatchObject({ version: 2, items: [{}, { label: "어조", text: "짧게" }] });
		expect((await call(PATCH, "PATCH", { expectedVersion: 1, key: "tone", text: "x" })).status).toBe(409);
		expect((await call(PATCH, "PATCH", { key: "tone", text: "x" })).status).toBe(428);

		const put = await call(PUT, "PUT", { expectedVersion: 2, texts: { styleGuide: "다", tone: "길게" } });
		expect(await put.json()).toMatchObject({ version: 3, items: [{ text: "다" }, { text: "길게" }] });

		expect((await call(DELETE, "DELETE", undefined, "?key=tone&expectedVersion=2")).status).toBe(409);
		const deleted = await call(DELETE, "DELETE", undefined, "?key=tone&expectedVersion=3");
		expect(deleted.status).toBe(200);
		expect(((await deleted.json()) as { items: unknown[] }).items).toHaveLength(1);
	});

	it("cannot delete a text used by an edited prompt", async () => {
		await call(POST, "POST", { expectedVersion: 0, key: "tone", label: "말투", text: "" });
		state.overrides = [{ key: "summary", value: { prompt: "요약한다.\n{{snippet.tone}}" }, version: 1 }];
		const res = await call(DELETE, "DELETE", undefined, "?key=tone&expectedVersion=1");
		expect(res.status).toBe(400);
		expect(await res.json()).toMatchObject({
			error: { message: "이 조각을 쓰는 기능이 있어 삭제할 수 없어요: 요약 만들기" },
		});
	});
});
