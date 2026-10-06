import { fakeCms } from "@monti-cms/core/testing";
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DELETE, GET, PATCH, POST, PUT } from "../routes/shared/route";

/** A store holding the shared text rows and action overrides. A version mismatch gives 409. */
const state = vi.hoisted(() => ({
	shared: null as { value: unknown; version: number } | null,
	overrides: [] as Array<{ key: string; value: unknown; version: number }>,
}));

vi.mock("../store", async () => {
	const { CmsError } = await import("@monti-cms/core/plugin/server");
	return {
		aiStoreFor: () => ({
			getAiSettings: async () => state.shared,
			saveAiSettings: async ({ expectedVersion, value }: { expectedVersion: number; value: unknown }) => {
				const version = state.shared?.version ?? 0;
				if (version !== expectedVersion) throw new CmsError("Conflict", "conflict", version);
				state.shared = { value, version: version + 1 };
				return version + 1;
			},
			listAiActionOverrides: async () => state.overrides.map((row) => ({ ...row, updatedAt: new Date(0) })),
			listAiCustomActions: async () => [],
		}),
	};
});

const cms = fakeCms();

const call = (
	handler: (request: NextRequest, context: { cms: typeof cms }) => Promise<Response>,
	method: string,
	body?: unknown,
	query = "",
) =>
	handler(
		new NextRequest(`http://localhost/api/cms/v1/ai/shared${query}`, {
			method,
			headers: { origin: "http://localhost", "content-type": "application/json" },
			...(body === undefined ? {} : { body: JSON.stringify(body) }),
		}),
		{ cms },
	);

describe("shared texts API", () => {
	beforeEach(() => {
		state.shared = null;
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
		state.overrides = [{ key: "summary", value: { prompt: "요약한다.\n{{shared.tone}}" }, version: 1 }];
		const res = await call(DELETE, "DELETE", undefined, "?key=tone&expectedVersion=1");
		expect(res.status).toBe(400);
		expect(await res.json()).toMatchObject({ message: "이 문구를 쓰는 기능이 있어 삭제할 수 없습니다: 요약 만들기" });
	});
});
