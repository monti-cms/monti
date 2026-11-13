import type { AddressInfo } from "node:net";
import { createMonti, defineSchema, type ModelList, migrateContent } from "@monti-cms/core";
import { afterAll, describe, expect, it } from "vitest";
import { modelService, SUMMARY } from "../../../testing/e2e/model-service";
import { testDatabase } from "../../core/src/__test__/database";
import { assistant } from "./operations";
import type { RunEvent } from "./run";

const db = await testDatabase();
const schema = defineSchema({
	locales: { source: "ko", list: [{ code: "ko", name: "한국어" }], prefix: "never" },
	collections: {
		post: {
			kind: "document",
			path: "/posts/:slug",
			fields: {
				title: { kind: "text", required: true },
				slug: { kind: "slug", required: true },
				summary: { kind: "text", max: 120 },
			},
		},
	},
});
await migrateContent(db, schema, []);

// The flows' model service on a port of its own, reached over the network by the real provider (no `provider` is given).
const server = modelService().listen(0);
afterAll(() => {
	server.close();
});
const address = () => `http://localhost:${(server.address() as AddressInfo).port}/v1`;
const admin = { actor: "admin" } as const;

describe("the model service of the flow tests (testing/e2e/model-service.ts)", () => {
	it("10-1 the key window's check reads its model, and a run over the real provider reads the picked entry, proposes its summary and says so", async () => {
		const monti = createMonti({ db, schema, secret: "e2e-model-secret", plugins: [assistant()] });
		await monti.run("keys.add", { service: "openai-compatible", name: "E2E", baseUrl: address(), secret: "" }, admin);
		const models = (await monti.run("models.list", {}, admin)) as ModelList;
		expect(models.keys.map((key) => key.models.map((model) => model.id))).toEqual([["e2e-model"]]);

		const made = (await monti.run("entries.create", { collection: "post", locale: "ko", title: "글" }, admin)) as {
			output: { id: string };
		};
		const events: RunEvent[] = [];
		for await (const event of monti.stream(
			"assistant.run",
			{
				request: "고른 글의 요약을 채워 줘",
				context: { screen: "list", collection: "post", selection: { kind: "rows", ids: [made.output.id] } },
			},
			{ actor: "admin", session: null, signal: new AbortController().signal },
		))
			events.push(event as RunEvent);
		expect(events.at(-1)).toMatchObject({ type: "end", status: "done" });
		expect(events.flatMap((event) => (event.type === "text" ? [event.delta] : [])).join("")).toBe(
			"요약을 제안했습니다.",
		);
		const items = await db.selectFrom("monti_proposal_item").select(["operation", "input", "state"]).execute();
		expect(items).toMatchObject([
			{ operation: "entries.save", state: "pending", input: { id: made.output.id, values: { summary: SUMMARY } } },
		]);
	});
});
