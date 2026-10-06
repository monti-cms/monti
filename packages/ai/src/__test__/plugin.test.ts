import { fakeCms } from "@monti-cms/core/testing";
import { describe, expect, it, vi } from "vitest";
import aiServer from "../server";

/** A store holding the screen action rows (including version check). */
const custom = vi.hoisted(() => ({ rows: new Map<string, { value: unknown; version: number }>() }));

vi.mock("../store", () => ({
	aiStoreFor: () => ({
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

describe("AI plugin registration", () => {
	it("the server side provides the AI API routes, table creation and meta flag", async () => {
		expect(aiServer.routes?.map((route) => route.pattern)).toContain("v1/ai/run");
		expect(aiServer.migrate).toBeTypeOf("function");
		expect(await aiServer.features?.(fakeCms())).toEqual({ ready: false });
	});

	it("the core API handler looks up paths missing from core routes in the plugin route table", async () => {
		const cms = fakeCms({ plugins: [{ name: "ai", ...aiServer }] });
		const call = (path: string) =>
			cms.handle(new Request(`http://localhost/api/cms/${path}`, { headers: { origin: "http://localhost" } }));
		const actions = await call("v1/ai/actions");
		expect(actions.status).toBe(200);
		expect(((await actions.json()) as { items: { key: string }[] }).items.map((item) => item.key)).toContain("summary");
		expect((await call("v1/ai/nope")).status).toBe(404);
	});

	it("creates (`POST /v1/ai/actions`) and deletes (`DELETE …?expectedVersion=`) screen actions through the API", async () => {
		const cms = fakeCms({ plugins: [{ name: "ai", ...aiServer }] });
		const request = (method: "POST" | "DELETE", path: string, body?: unknown) =>
			cms.handle(
				new Request(`http://localhost/api/cms/${path}`, {
					method,
					headers: { origin: "http://localhost", "content-type": "application/json" },
					...(body ? { body: JSON.stringify(body) } : {}),
				}),
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
