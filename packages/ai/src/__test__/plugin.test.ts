import { createCmsRouteHandler } from "@monti-cms/core/next/route-handler";
import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";
import aiServer from "../server";

vi.mock("@monti-cms/core/adapters/auth", () => ({
	authGateway: { verifyAdmin: async () => ({ userId: "u", accountId: "g", isAdmin: true }) },
	AuthError: class AuthError extends Error {},
}));

/** 화면 기능 줄을 들고 있는 저장소(버전 확인 포함). */
const custom = vi.hoisted(() => ({ rows: new Map<string, { value: unknown; version: number }>() }));

vi.mock("../store", () => ({
	getAiStore: () => ({
		getAiSettings: async () => null,
		listAiActionOverrides: async () => [],
		listAiCustomActions: async () => [...custom.rows].map(([key, row]) => ({ key, ...row, updatedAt: new Date(0) })),
		saveAiCustomAction: async ({
			key,
			expectedVersion,
			value,
		}: {
			key: string;
			expectedVersion: number;
			value: unknown;
		}) => {
			const version = (custom.rows.get(key)?.version ?? 0) + 1;
			if (version - 1 !== expectedVersion) throw new Error("conflict");
			custom.rows.set(key, { value, version });
			return { key, value, version, updatedAt: new Date(0) };
		},
		deleteAiCustomAction: async ({ key }: { key: string }) => {
			custom.rows.delete(key);
		},
	}),
}));

describe("AI 플러그인 등록", () => {
	it("서버 쪽이 AI API 경로·표 만들기·메타 표시를 준다", async () => {
		expect(aiServer.routes?.map((route) => route.pattern)).toContain("v1/ai/run");
		expect(aiServer.migrate).toBeTypeOf("function");
		expect(await aiServer.features?.()).toEqual({ ready: false });
	});

	it("본체 API 처리기가 본체 경로에 없는 주소를 플러그인 경로표에서 찾는다", async () => {
		const handler = createCmsRouteHandler();
		const call = (path: string) =>
			handler.GET(new NextRequest(`http://localhost/api/cms/${path}`, { headers: { origin: "http://localhost" } }), {
				params: Promise.resolve({ path: path.split("/") }),
			});
		const actions = await call("v1/ai/actions");
		expect(actions.status).toBe(200);
		expect(((await actions.json()) as { items: { key: string }[] }).items.map((item) => item.key)).toContain("summary");
		expect((await call("v1/ai/nope")).status).toBe(404);
	});

	it("화면 기능을 API로 만들고(`POST /v1/ai/actions`) 지운다(`DELETE …?expectedVersion=`)", async () => {
		const handler = createCmsRouteHandler();
		const request = (method: "POST" | "DELETE", path: string, body?: unknown) =>
			handler[method](
				new NextRequest(`http://localhost/api/cms/${path}`, {
					method,
					headers: { origin: "http://localhost", "content-type": "application/json" },
					...(body ? { body: JSON.stringify(body) } : {}),
				}),
				{ params: Promise.resolve({ path: path.split("?")[0]?.split("/") ?? [] }) },
			);
		const created = await request("POST", "v1/ai/actions", {
			base: { label: "새 기능", surface: { slot: "insert" }, result: "mdx" },
		});
		expect(created.status).toBe(201);
		const view = (await created.json()) as { key: string; version: number };
		expect(custom.rows.has(view.key)).toBe(true);

		const removed = await request("DELETE", `v1/ai/actions/${view.key}?expectedVersion=${view.version}`);
		expect(removed.status).toBe(204);
		expect(custom.rows.has(view.key)).toBe(false);
	});
});
