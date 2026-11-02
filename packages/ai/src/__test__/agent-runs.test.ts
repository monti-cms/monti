import { fakeCms } from "@monti-cms/core/testing";
import { describe, expect, it } from "vitest";
import { testConfig, testSite } from "../../test/site";
import type { AgentRunValue } from "../agent-store";
import { AI_PLUGIN_NAME } from "../name";
import { getAiSettingsView, setUnopenedDays, unopenedDaysOf } from "../settings";
import { createAiStore } from "../store";

const DAY = 24 * 60 * 60 * 1000;

function setup() {
	const cms = fakeCms({ config: testConfig as never, server: { secret: "test-secret" } });
	const store = createAiStore(cms.plugin(AI_PLUGIN_NAME).storage, { site: testSite, apiKeys: () => cms.apiKeys });
	const value = (adminId: string, title: string): AgentRunValue => ({
		adminId,
		title,
		status: "done",
		messages: [{ id: "u", role: "user", parts: [{ type: "text", text: title }] }],
		usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
	});
	return { store, value };
}

describe("past conversations", () => {
	it("ASSIST-H2 keeps a conversation opened or asked in within the days, deletes the rest, and keeps all when the setting says so", async () => {
		const { store, value } = setup();
		const runs = store.agentRuns;
		await runs.create("old", value("me", "오래된 대화"));
		await runs.create("opened", value("me", "다시 연 대화"));
		await runs.create("theirs", value("other", "다른 사람의 대화"));
		const later = new Date(Date.now() + 40 * DAY);
		// Opened again 35 days on: kept 5 days later; the one left alone goes.
		await runs.open("me", "opened", new Date(Date.now() + 35 * DAY));
		await runs.sweep("me", null, later);
		expect((await runs.list("me", { page: 1, pageSize: 20 })).total).toBe(2);
		await runs.sweep("me", 30, later);
		const left = await runs.list("me", { page: 1, pageSize: 20 });
		expect(left.items.map((run) => run.id)).toEqual(["opened"]);
		expect(left.items[0]?.openedAt).toBeTypeOf("string");
		// Another admin's conversations are neither swept nor deleted by this one.
		expect(await runs.remove("me", "theirs")).toBe(false);
		expect(await runs.get("other", "theirs")).not.toBeNull();
		expect(await runs.remove("me", "opened")).toBe(true);
		expect(await runs.get("me", "opened")).toBeNull();
	});

	it("ASSIST-H2 keeps unopened conversations 30 days until the admin chooses, without touching the quick-task model", async () => {
		const { store } = setup();
		expect(await unopenedDaysOf(store)).toBe(30);
		const before = await getAiSettingsView(testSite, store);
		const after = await setUnopenedDays(testSite, store, before.version, 7);
		expect(after.unopenedDays).toBe(7);
		expect(after.quick).toEqual(before.quick);
		expect((await setUnopenedDays(testSite, store, after.version, null)).unopenedDays).toBeNull();
	});
});
