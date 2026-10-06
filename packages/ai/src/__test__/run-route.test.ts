import { fakeCms } from "@monti-cms/core/testing";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST as postRun } from "../routes/run/route";

const mockVerifyAdmin = vi.fn();
const overrides = vi.hoisted(() => ({ rows: [] as Array<{ key: string; value: unknown; version: number }> }));

vi.mock("../store", () => ({
	aiStoreFor: () => ({
		listAiActionOverrides: async () => overrides.rows.map((row) => ({ ...row, updatedAt: new Date(0) })),
		getAiSettings: async () => null,
	}),
}));

vi.mock("@monti-cms/core/plugin/server", async (importOriginal) => ({
	...(await importOriginal<typeof import("@monti-cms/core/plugin/server")>()),
	createContentLookup: () => ({ slugsInUse: async () => new Set(["taken"]) }),
}));

const cms = fakeCms({
	store: {
		listEntries: async () => ({ items: [], total: 0, page: 1, pageSize: 20 }),
		getMediaAsset: async () => null,
	},
	mediaStore: {},
	verifyAdmin: () => mockVerifyAdmin(),
});

const run = (body: unknown) =>
	postRun(
		new Request("http://localhost/api/cms/v1/ai/run", {
			method: "POST",
			headers: { origin: "http://localhost", "content-type": "application/json" },
			body: JSON.stringify(body),
		}),
		{ cms },
	);

describe("AI run API", () => {
	beforeEach(() => {
		mockVerifyAdmin.mockResolvedValue({ userId: "u", accountId: "g", isAdmin: true });
		vi.stubEnv("CMS_AI_FAKE", "1");
		overrides.rows = [];
	});
	afterEach(() => vi.unstubAllEnvs());

	it("runs an action by name and input", async () => {
		const res = await run({
			action: "summary",
			input: { title: "React 훅", body: "본문" },
			env: { collection: "post" },
		});
		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({ result: { kind: "text", text: "(fake) React 훅" } });
	});

	it("multiple inputs return a result or failure reason per input, in order", async () => {
		const res = await run({
			action: "translate",
			inputs: [
				{ block: "안녕 **세계**", from: "ko", to: "en" },
				{ block: "", from: "ko", to: "en" },
			],
		});
		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({
			results: [{ result: { kind: "mdx", text: "안녕 **세계**" } }, { error: "원문이 없습니다." }],
		});
	});

	it("rejects unknown actions, inputs that do not match the definition, disabled actions and invalid test values", async () => {
		expect((await run({ action: "nope", input: {} })).status).toBe(404);
		expect((await run({ action: "translate", input: { block: 1, from: "ko", to: "en" } })).status).toBe(400);
		expect((await run({ action: "summary", input: {}, inputs: [{}] })).status).toBe(400);

		overrides.rows = [{ key: "summary", value: { enabled: false }, version: 1 }];
		expect((await run({ action: "summary", input: { title: "t" } })).status).toBe(503);
		// A test runs even a disabled action with unsaved values. Placeholders in the prompt that are not language inputs are rejected.
		expect((await run({ action: "summary", input: { title: "t" }, draft: { enabled: false } })).status).toBe(200);
		const bad = await run({ action: "summary", input: { title: "t" }, draft: { prompt: "{{title}}" } });
		expect(bad.status).toBe(400);
		expect(await bad.json()).toMatchObject({ code: "ai_invalid_input" });
	});

	it("the fake connection answers by input kind, and an action's own fake answer passes that action's checks", async () => {
		// Block action: an answer that adds one line to the diagram passes the Mermaid syntax check.
		const diagram = "```mermaid\ngraph TD\n  A --> B\n```";
		const edit = await run({ action: "diagramEdit", input: { block: diagram } });
		expect(edit.status).toBe(200);
		const edited = (await edit.json()) as { result: { kind: string; text: string } };
		expect(edited.result.kind).toBe("mdx");
		expect(edited.result.text).toContain("A --> B");
		expect(edited.result.text).not.toBe(diagram);

		// Selection action: returns the MDX input as is (ignores the input name).
		const polish = await run({ action: "polish", input: { selection: "고칠 글" } });
		expect(await polish.json()).toEqual({ result: { kind: "mdx", text: "고칠 글" } });

		// Slug candidates: a candidate reported as used by the core content lookup is dropped.
		const slug = await run({ action: "slug", input: { title: "Taken" }, env: { collection: "post" } });
		const slugs = (await slug.json()) as { result: { items: Array<{ value: string }> } };
		expect(slugs.result.items.map((item) => item.value)).toEqual(["taken-guide", "fake-taken"]);
	});
});
